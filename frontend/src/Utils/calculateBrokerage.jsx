// Utils/brokerage.js

/**
 * Calculate P&L and brokerage for a trade.
 *
 * @param {Object} params
 * @param {"BUY"|"SELL"} params.side               - Trade side
 * @param {number} params.avgPrice                 - Entry average price
 * @param {number} params.ltp                      - Current / exit price
 * @param {number} params.qty                      - Quantity
 * @param {number} [params.brokeragePercentPerSide=0.01] - Brokerage % per side (e.g. 0.01 for 0.01%)
 * @param {"entry-only"|"round-trip"} [params.mode="entry-only"]
 *        "entry-only"  → sirf executed entry leg par brokerage
 *        "round-trip"  → entry + exit dono side brokerage
 *
 * @returns {{
 *   entryValue: number,
 *   currentValue: number,
 *   brokerageEntry: number,
 *   brokerageExit: number,
 *   totalBrokerage: number,
 *   grossPnl: number,
 *   netPnl: number,
 *   pct: number
 * }}
 */
export function calculatePnLAndBrokerage({
  side,
  avgPrice,
  ltp,
  qty,
  brokeragePercentPerSide = 0.01,
  mode = "entry-only",
}) {
  const safeSide = String(side || "BUY").toUpperCase();
  const quantity = Number(qty || 0);
  const entry = Number(avgPrice || 0);
  const last = Number(ltp || 0);

  const entryValue = entry * quantity;
  const currentValue = last * quantity;

  // % ko decimal me convert karo → 0.01% = 0.0001
  const rate = Number(brokeragePercentPerSide) / 100;

  const brokerageEntry = entryValue * rate;
  const brokerageExit = mode === "round-trip" ? currentValue * rate : 0;
  const totalBrokerage = brokerageEntry + brokerageExit;

  // Gross P&L (brokerage ke bina)
  const diffPerShare =
    safeSide === "BUY" ? last - entry : entry - last;

  const grossPnl = diffPerShare * quantity;

  // Net P&L (brokerage ke baad)
  const netPnl = grossPnl - totalBrokerage;

  // % return (entry capital ke base par)
  const pct = entryValue ? (netPnl / entryValue) * 100 : 0;

  return {
    entryValue,
    currentValue,
    brokerageEntry,
    brokerageExit,
    totalBrokerage,
    grossPnl,
    netPnl,
    pct,
  };
}

/**
 * Simple helper: sirf brokerage amount nikalne ke liye,
 * agar tumhare paas already turnover (value) hai.
 *
 * @param {number} turnover                - e.g. price * qty
 * @param {number} [brokeragePercent=0.01] - percent, e.g. 0.01 for 0.01%
 * @returns {number}                       - brokerage amount
 */
export function calculateBrokerage(turnover, brokeragePercent = 0.01) {
  const value = Number(turnover || 0);
  const rate = Number(brokeragePercent) / 100;
  return value * rate;
}






// Utils/calculateBrokerage.jsx

/**
 * EXIT ke time full trade ka brokerage + P&L calculate karega
 *  - side: "BUY" ya "SELL" (original entry side)
 *  - avgPrice: entry average price
 *  - exitPrice: jis price pe tum EXIT kar rahi ho (closed_ltp)
 *  - qty: total quantity
 *  - brokeragePercentPerSide: har side ka %, e.g. 0.01 => 0.01%
 *
 * Returns:
 *  {
 *    entryValue,
 *    exitValue,
 *    brokerageEntry,
 *    brokerageExit,
 *    totalBrokerage,
 *    grossPnl,
 *    netPnl,
 *    pct
 *  }
 */
export function calculateExitBrokerageAndPnL({
  side,
  avgPrice,
  exitPrice,
  qty,
  brokeragePercentPerSide = 0.01, // 0.01%
}) {
  const safeSide = String(side || "BUY").toUpperCase();
  const quantity = Number(qty || 0);
  const entry = Number(avgPrice || 0);
  const exit = Number(exitPrice || 0);

  const entryValue = entry * quantity;
  const exitValue = exit * quantity;

  // 0.01% => 0.0001
  const rate = Number(brokeragePercentPerSide) / 100;

  // Dono side brokerage
  const brokerageEntry = entryValue * rate;
  const brokerageExit = exitValue * rate;
  const totalBrokerage = brokerageEntry + brokerageExit;

  // Gross P&L (brokerage ke bina)
  const diffPerShare =
    safeSide === "BUY" ? exit - entry : entry - exit;

  const grossPnl = diffPerShare * quantity;

  // Net P&L (brokerage ke baad)
  const netPnl = grossPnl - totalBrokerage;

  // % return (entry capital ke base par)
  const pct = entryValue ? (netPnl / entryValue) * 100 : 0;

  return {
    entryValue,
    exitValue,
    brokerageEntry,
    brokerageExit,
    totalBrokerage,
    grossPnl,
    netPnl,
    pct,
  };
}
