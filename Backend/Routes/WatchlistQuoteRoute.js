// routes/watchlistQuotes.js
import express from 'express';
import axios from 'axios';
import Instrument from '../Model/InstrumentModel.js';
import { ensureAccessToken } from '../Controllers/upstoxController.js';

const router = express.Router();

// In-memory cache
const quoteCache = {};
const CACHE_TTL = 5; // seconds

/**
 * POST /api/watchlist-quotes
 * Body: { names: ["ASTRAL LIMITED", "AXIS BANK LIMITED", ...] }
 */
router.post('/watchlist-quotes', async (req, res) => {
  try {
    const names = req.body.names || req.body.name;
    if (!Array.isArray(names) || names.length === 0) {
      return res.status(400).json({ error: 'names array required' });
    }

    // ✅ Step 1: Lookup all instruments (Equity + F&O + Commodity)
    const instruments = await Instrument.find({
      name: { $in: names },
      segment: { $in: ['NSE_FO', 'NSE_COM'] }
    });

    if (!instruments.length) {
      return res.status(404).json({ error: 'No instruments found for given names' });
    }

    // ✅ Step 2: Extract instrument keys
    const keys = instruments.map(inst => inst.instrument_key).filter(Boolean);
    if (!keys.length) {
      return res.status(404).json({ error: 'No instrument_keys found for given names' });
    }

    // ✅ Step 3: Caching logic
    const cacheKey = keys.sort().join(',');
    const now = Date.now();
    if (quoteCache[cacheKey] && (now - quoteCache[cacheKey].ts < CACHE_TTL * 1000)) {
      return res.json({ fromCache: true, data: quoteCache[cacheKey].data });
    }

    // ✅ Step 4: Get Upstox access token
    const access_token = await ensureAccessToken();

    // ✅ Step 5: Fetch quotes for all instruments
    const upstoxRes = await axios.get(
      `https://api.upstox.com/v2/market-quote/quotes?instrument_key=${encodeURIComponent(keys.join(','))}`,
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
          Accept: 'application/json',
        },
      }
    );

    // ✅ Step 6: Save in cache
    quoteCache[cacheKey] = { ts: now, data: upstoxRes.data };

    // ✅ Step 7: Return result
    res.json({ fromCache: false, data: upstoxRes.data });
  } catch (err) {
    console.error('Watchlist quote error:', err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data || err.message });
  }
});

export default router;
