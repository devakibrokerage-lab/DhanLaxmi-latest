import express from 'express';
// import { getDhanCredentials } from '../services/dhanCredentialService.js';
// import { renewAccessToken } from '../services/dhanAuth.js';
import Order from '../Model/OrdersModel.js';
import { attemptSquareoff } from '../cron/Scheduler/attemptSquareoff.js';

const router = express.Router();

// Dhan token renewal disabled - now using Kite
// A temporary endpoint to manually trigger the token renewal logic.
router.post('/force-token-check', async (req, res) => {
  res.status(410).json({ 
    status: 'DISABLED', 
    message: 'Dhan token renewal is disabled. Now using Kite WebSocket.' 
  });
});

// Manual trigger to run squareoff for a given category (for debugging)
router.post('/run-squareoff', async (req, res) => {
  const type = req.body?.type || 'OPEN_INTRADAY';
  try {
    let query;
    if (type === 'OPEN_INTRADAY') query = { order_category: 'INTRADAY', order_status: 'OPEN' };
    else if (type === 'HOLD_INTRADAY') query = { order_category: 'INTRADAY', order_status: 'HOLD' };
    else if (type === 'OVERNIGHT') query = { order_category: 'OVERNIGHT' };
    else return res.status(400).json({ error: 'unknown type' });

    const candidates = await Order.find(query).limit(200).lean();
    const results = [];
    for (const cand of candidates) {
      const orderDoc = await Order.findById(cand._id);
      if (!orderDoc) continue;
      const result = await attemptSquareoff(orderDoc);
      results.push({ id: orderDoc._id, result });
    }
    return res.json({ ok: true, count: results.length, results });
  } catch (err) {
    console.error('[debug/run-squareoff] error', err);
    return res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

export default router;