// Routes/quotes.js - KITE VERSION
// Uses instrument_token as the primary identifier
import express from "express";
import { getFeedInstance } from "../services/feedState.js";

const router = express.Router();

// POST /api/quotes/snapshot
// body: { items: [{ instrument_token }, ...] }
router.post("/snapshot", async (req, res) => {
  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const tokens = items.map(i => String(i.instrument_token));
    const lmf = getFeedInstance();

    // 1) try cached snapshot from live feed
    const cached = lmf?.getSnapshot?.(tokens) || {};
    // build response using cached where present
    const out = {};
    for (const token of tokens) {
      const v = cached[String(token)];
      if (v) {
        out[String(token)] = {
          instrument_token: token,
          ltp: v.ltp,
          open: v.open,
          high: v.high,
          low: v.low,
          close: v.close,
          volume: v.volume,
          oi: v.oi,
          bestBidPrice: v.bestBidPrice,
          bestBidQuantity: v.bestBidQuantity,
          bestAskPrice: v.bestAskPrice,
          bestAskQuantity: v.bestAskQuantity,
          lastTradeQty: v.lastTradeQty,
          lastTradeTime: v.lastTradeTime,
          avgPrice: v.avgPrice,
          netChange: v.netChange,
          percentChange: v.percentChange,
          change: v.change,
          depth: v.depth || null, // Full market depth (5 levels buy/sell)
        };
      }
    }

    // 2) find tokens that are missing or appear empty
    const missing = tokens.filter(token => {
      const v = out[String(token)];
      return !v || (v.ltp == null && v.close == null && v.netChange == null && v.percentChange == null);
    });

    // If data is missing, it means these instruments haven't been subscribed to the WebSocket feed yet.
    if (missing.length) {
      console.log(`[Snapshot] ${missing.length} instruments not found in cache. They may not be subscribed to the feed yet.`);
      for (const token of missing) {
        if (!out[String(token)]) {
          out[String(token)] = {
            instrument_token: token,
            ltp: null, open: null, high: null, low: null, close: null, volume: null, oi: null,
            bestBidPrice: null, bestBidQuantity: null, bestAskPrice: null, bestAskQuantity: null,
            lastTradeQty: null, lastTradeTime: null, avgPrice: null, netChange: null, percentChange: null,
            depth: null, // Market depth not available
          };
        }
      }
      out.__snapshot_info = `${missing.length} instruments not in cache. Ensure they are subscribed via WebSocket.`;
    }

    return res.json(out);
  } catch (err) {
    console.error("snapshot route error:", err);
    return res.status(500).json({ error: "internal" });
  }
});

export default router;
