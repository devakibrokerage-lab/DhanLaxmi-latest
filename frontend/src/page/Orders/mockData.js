// mockData.js
export const MOCK_ORDERS = [
  { id: 1, symbol: "HDFCBANK", side: "BUY",  qty: 50,  avgPrice: 1450.0, ltp: 1485.86, status: "OPEN",   type: "MARKET", time: "10:15 AM" },
  { id: 2, symbol: "TCS",      side: "BUY",  qty: 20,  avgPrice: 3800.0, ltp: 3744.89, status: "OPEN",   type: "MARKET", time: "11:02 AM" },
  { id: 3, symbol: "RELIANCE", side: "BUY",  qty: 10,  avgPrice: 2400.0, ltp: 2421.28, status: "CLOSED", type: "LIMIT",  time: "09:55 AM" },
  { id: 4, symbol: "INFY",     side: "SELL", qty: 75,  avgPrice: 1560.0, ltp: 1552.10, status: "CLOSED", type: "MARKET", time: "12:10 PM" },
  { id: 5, symbol: "ICICIBANK",side: "BUY",  qty: 25,  avgPrice: 980.0,  ltp: 990.50,  status: "OPEN",   type: "LIMIT",  time: "12:40 PM" },
];

export const MOCK_HOLDINGS = [
  { id: "h1", symbol: "HDFCBANK", qty: 50,  avgPrice: 1450.0, ltp: 1485.86 },
  { id: "h2", symbol: "TCS",      qty: 20,  avgPrice: 3800.0, ltp: 3744.89 },
  { id: "h3", symbol: "RELIANCE", qty: 10,  avgPrice: 2400.0, ltp: 2421.28 },
  { id: "h4", symbol: "INFY",     qty: 100, avgPrice: 1550.0, ltp: 1558.23 },
];
