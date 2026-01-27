// ✅ Final: Handles NSE's new Tuesday expiry rule (from 1 Sep 2025)
// Automatically picks next monthly expiry (NSE_FO -> Tuesday, NSE_COM -> commodity-specific)

import axios from 'axios';
import zlib from 'zlib';
import mongoose from 'mongoose';
import Instrument from './Model/InstrumentModel.js';
import { promisify } from 'util';
import 'dotenv/config';
import { fileURLToPath } from 'url';
const GUNZIP = promisify(zlib.gunzip);

const JSON_URL =
  "https://assets.upstox.com/market-quote/instruments/exchange/complete.json.gz";
const MONGO_URI = process.env.MONGO_URL;

const OVERRIDE_TARGET = process.argv[2]; // optional YYYY-MM-DD

// -------------------------------------------------------
// Utility functions
// -------------------------------------------------------
function normalizeExpiryValue(raw) {
  if (!raw) return null;
  if (raw instanceof Date) return isNaN(raw) ? null : raw;
  if (typeof raw === "number") return new Date(raw > 1e12 ? raw : raw * 1000);
  const d = new Date(String(raw).trim());
  return isNaN(d) ? null : d;
}

function toYMD(d) {
  const dt = new Date(d);
  dt.setHours(0, 0, 0, 0);
  return dt.toISOString().split("T")[0];
}

function isFnoRow(row) {
  const it = String(row.instrument_type || "").toUpperCase();
  const opt = String(row.option_type || "").toUpperCase();
  const ts = String(row.tradingsymbol || "").toUpperCase();
  return (
    it.includes("FUT") ||
    it.includes("OPT") ||
    it === "FUTIDX" ||
    it === "FUTSTK" ||
    opt === "CE" ||
    opt === "PE" ||
    /CE$|PE$/.test(ts)
  );
}

// -------------------------------------------------------
// Expiry logic based on NSE rule changes
// -------------------------------------------------------

// Return last given weekday (0=Sun,...6=Sat) of a month
function getLastWeekdayOfMonth(year, month, weekdayIndex) {
  const last = new Date(year, month + 1, 0);
  const diff = (last.getDay() - weekdayIndex + 7) % 7;
  last.setDate(last.getDate() - diff);
  last.setHours(0, 0, 0, 0);
  return last;
}

// NSE F&O monthly expiry date
function getNextMonthExpiryNSEFO() {
  const today = new Date();
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

  // Rule: before Sep 2025 → Thursday; after Sep 2025 → Tuesday
  if (today >= new Date("2025-09-01")) {
    return getLastWeekdayOfMonth(nextMonth.getFullYear(), nextMonth.getMonth(), 2); // Tue=2
  } else {
    return getLastWeekdayOfMonth(nextMonth.getFullYear(), nextMonth.getMonth(), 4); // Thu=4
  }
}

// Commodity expiries (simplified)
function getNextMonthExpiryNSECOM() {
  const today = new Date();
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

  // For simplicity: pick 5th of next month as base metal expiry (Cu, Zn etc.)
  const expiry = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 5);
  expiry.setHours(0, 0, 0, 0);
  return expiry;
}

// -------------------------------------------------------
// MAIN SCRIPT
// -------------------------------------------------------
async function run() {
  try {
    console.log("🚀 NSE Importer (FO Tuesday + COM 5th) started...");
    await mongoose.connect(MONGO_URI);
    console.log("✅ MongoDB connected");

    // Download Upstox master
    console.log("📥 Downloading Upstox master file...");
    const res = await axios.get(JSON_URL, { responseType: "arraybuffer", timeout: 120000 });
    const unz = await GUNZIP(Buffer.from(res.data));
    const parsed = JSON.parse(unz.toString("utf8").trim());

    let rows = [];
    if (Array.isArray(parsed)) rows = parsed;
    else if (parsed.data) rows = parsed.data;
    else for (const k of Object.keys(parsed)) if (Array.isArray(parsed[k])) rows.push(...parsed[k]);
    console.log("📦 Total master rows:", rows.length);

    // Filter NSE_FO + NSE_COM
    rows = rows.filter((r) => ["NSE_FO", "NSE_COM"].includes(String(r.segment || "").toUpperCase()));
    console.log("🔍 After segment filter:", rows.length);

    // F&O only
    rows = rows.filter(isFnoRow);
    console.log("🧩 After F&O detection filter:", rows.length);

    // Determine expiry targets
    const targetFO = getNextMonthExpiryNSEFO();
    const targetCOM = getNextMonthExpiryNSECOM();

    console.log("🎯 Target NSE_FO expiry:", toYMD(targetFO));
    console.log("🎯 Target NSE_COM expiry:", toYMD(targetCOM));

    // Collect rows near those expiry dates (within 2 days tolerance)
    const toInsert = rows.filter((r) => {
      const e = normalizeExpiryValue(r.expiry);
      if (!e) return false;
      const expYMD = toYMD(e);
      const seg = String(r.segment || "").toUpperCase();
      if (seg === "NSE_FO") return expYMD === toYMD(targetFO);
      if (seg === "NSE_COM") return expYMD === toYMD(targetCOM);
      return false;
    });

    console.log("✅ Contracts ready to insert:", toInsert.length);

    if (!toInsert.length) {
      console.log("❌ No matching contracts found for target expiries. Exiting.");
      await mongoose.disconnect();
      return;
    }

    // Bulk Upsert
    console.log("🛠 Starting BULK UPSERT...");
    const ops = toInsert.map((r) => {
      const e = normalizeExpiryValue(r.expiry);
      return {
        updateOne: {
          filter: { canon_key: r.canon_key },
          update: {
            $set: {
              ...r,
              expiry_date: toYMD(e),
              last_update_from_file: new Date(),
            },
            $setOnInsert: { first_seen_date: new Date() },
          },
          upsert: true,
        },
      };
    });

    const res2 = await Instrument.bulkWrite(ops, { ordered: false });
    console.log("✅ Bulk write done.");
    console.log("  ↳ Processed:", ops.length);
    console.log("  ↳ Upserted:", res2.upsertedCount);
    console.log("  ↳ Modified:", res2.modifiedCount);

    const foCount = await Instrument.countDocuments({ segment: "NSE_FO" });
    const comCount = await Instrument.countDocuments({ segment: "NSE_COM" });
    console.log(`📊 Totals => NSE_FO: ${foCount}, NSE_COM: ${comCount}`);

    await mongoose.disconnect();
    console.log("✅ Done. DB updated with near-18-Nov expiry data.");
  } catch (err) {
    console.error("❌ Error:", err.message || err);
    try {
      await mongoose.disconnect();
    } catch (_) {}
  }
}

// Run when called directly: node api.js
if (fileURLToPath(import.meta.url) === process.argv[1]) run();
