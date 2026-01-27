import 'dotenv/config';
import dotenv from "dotenv";
import http from "http";
import mongoose from "mongoose";
import { createApp } from "./app.js";
import { createIO, setFeedSubscriber, setFeedUnsubscriber } from "./sockets/io.js";
import { KiteWebSocket } from './services/KiteWebSocket.js';
import { startMasterRefreshCron } from './cron/masterRefresh.js';
import { setFeedInstance } from "./services/feedState.js";
import { config } from "./config.js";
import { stockSquareoffScheduler } from './cron/Scheduler/cron-squareoff.js';
import FundCronJobs from './cron/FundScheduler/fundCorn.js';
import { isMarketOpen } from './Utils/marketStatus.js';
import { startAutoLoginCron, checkAndRefreshOnStartup } from './cron/autoLoginCron.js';

// 👇 1. IMPORT ORDER MANAGER
import { loadOpenOrders } from './Utils/OrderManager.js';

const app = createApp();
const server = http.createServer(app);

// createIO now returns { io, market } (market = namespace)
const { io, market } = createIO(server);

// Initialize Kite WebSocket directly (uses KITE_API_KEY and KITE_ACCESS_TOKEN from .env)
export const lmf = new KiteWebSocket();

// allow sockets layer to forward client "subscribe" to LMF
setFeedSubscriber((list, subscriptionType) => lmf.subscribe(list, subscriptionType));

// allow sockets layer to forward client "unsubscribe" to LMF when rooms become empty
setFeedUnsubscriber((list) => lmf.unsubscribe(list));

// make it accessible to routes
setFeedInstance(lmf);

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URL;

await mongoose.connect(MONGODB_URI);
console.log("✅ Mongo connected");

// 👇 3. LOAD ACTIVE ORDERS & START SOCKET
// DB connect hone ke baad hi purane orders load karo
await loadOpenOrders();

// Check and refresh token on startup if needed
await checkAndRefreshOnStartup();

// Connect to Kite WebSocket
lmf.connect();

const PORT = Number(config?.port || process.env.PORT || 8081);
server.listen(PORT, async () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);

  // Start auto-login cron (runs daily at 7:55 AM IST)
  startAutoLoginCron();
  console.log("✅ Auto-login cron scheduled (7:55 AM IST daily)");

  FundCronJobs();
  console.log(`[Market Status] ${isMarketOpen() ? "🟢 OPEN" : "🔴 CLOSED"}`);
  stockSquareoffScheduler();
  // Start the cron job for automatic master data refresh
  startMasterRefreshCron();
});