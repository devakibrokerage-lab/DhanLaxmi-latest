import cron from "node-cron";
import Order from "../../Model/OrdersModel.js";
import { isTradingDay } from "../marketCalendar.js";
import { attemptSquareoff } from "./attemptSquareoff.js";

// Helper to process list of orders
async function processCandidates(query, label) {
  try {
    const candidates = await Order.find(query).limit(1000);
    console.log(`[cron] 🔍 ${label}: Found ${candidates.length} orders`);

    for (const orderDoc of candidates) {
      await attemptSquareoff(orderDoc);
    }
  } catch (err) {
    console.error(`[cron] Error in ${label}:`, err);
  }
}

export function stockSquareoffScheduler() {
  console.log('🚀 Stock Squareoff Scheduler Started...');

  // =========================================================
  // 1. INTRADAY SQUARE OFF - STANDARD MARKETS (NSE/BSE/CDS)
  // Time: 3:15 PM Mon-Fri
  // Excludes MCX
  // =========================================================
  cron.schedule("15 15 * * 1-5", async () => {
    if (!isTradingDay(new Date())) {
      return console.log("[cron] Market holiday, skipping Standard Intraday Squareoff.");
    }

    console.log(`[cron] ⏰ Running STANDARD INTRADAY Auto-Squareoff (Excluding MCX)`);

    // Exclude MCX segments (MCX-FUT, MCX-OPT, etc.)
    await processCandidates(
      {
        order_category: "INTRADAY",
        order_status: { $in: ["OPEN"] },
        segment: { $not: /^MCX/ } 
      },
      "OPEN_INTRADAY_STANDARD"
    );
  }, {
    scheduled: true,
    timezone: "Asia/Kolkata"
  });

 
  
  cron.schedule("15 23 * * 1-5", async () => {
     if (!isTradingDay(new Date())) {
      return console.log("[cron] Market holiday, skipping MCX Intraday Squareoff.");
    }

    console.log(`[cron] ⏰ Running MCX INTRADAY Auto-Squareoff`);

    await processCandidates(
      {
        order_category: "INTRADAY",
        order_status: { $in: ["OPEN"] },
        segment: { $regex: /^MCX/ }
      },
      "OPEN_INTRADAY_MCX"
    );
  }, {
    scheduled: true,
    timezone: "Asia/Kolkata"
  });

  // =========================================================
  // 2. MIDNIGHT CLEANUP & EXPIRY CHECK (Daily 12:05 AM)
  // Shifted slightly to 12:05 to avoid conflict with MCX squareoff
  
  cron.schedule("2 0 * * *", async () => {
    console.log(`[cron] 🌙 Running Midnight Maintenance`);

    // A. Intraday Cleanup (Move remaining OPEN/MIS to CLOSED/Cancelled or whatever logic)
    // Note: This logic assumes everything should have been squared off by now.
    // If anything remains, we mark it.
    await processCandidates(
      {
        order_category: "INTRADAY",
        order_status: { $in: ["HOLD"] }
      },
      "INTRADAY_CLEANUP"
    );

    // B. OVERNIGHT / HOLD Expiry Check 
    // Sabhi active overnight orders check karo (null included)
    await processCandidates(
      {
        order_category: "OVERNIGHT",
        order_status: { $in: [null, "OPEN", "HOLD"] }
      },
      "OVERNIGHT_EXPIRY_CHECK"
    );

  }, {
    scheduled: true,
    timezone: "Asia/Kolkata" // ✅ Timezone Added Here
  });
}
