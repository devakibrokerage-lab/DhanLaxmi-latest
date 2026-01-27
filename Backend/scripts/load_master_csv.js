// Backend/scripts/load_dhan_master_detail.js
// Robust loader: skips index-drop if collection missing, ensures canon_key unique index, clears collection, loads CSV.

import fs from "fs";
import path from "path";
import csv from "csv-parser";
import mongoose from "mongoose";
import Instrument from "../Model/InstrumentModel.js";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

// --- load .env relative to this file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, "../.env");
dotenv.config({ path: envPath });

// --- config check
const mongoUri = process.env.MONGO_URL || process.env.MONGODB_URI || process.env.MONGODB;
if (!mongoUri) {
  console.error("❌ ERROR: No MongoDB URI found. Set MONGO_URL or MONGODB_URI in Backend/.env");
  process.exit(1);
}
console.log("Using env file:", envPath);
console.log("Mongo URI found:", !!mongoUri);

// --- helpers
const toNum = (v) => {
  if (v === "" || v == null) return null;
  const num = Number(v);
  return Number.isFinite(num) ? num : null;
};
const toDate = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
};

const BATCH_SIZE = 2000;

async function fixIndexesSafe() {
  // Check whether collection exists first
  const db = mongoose.connection.db;
  const collName = Instrument.collection.name; // "instruments"
  const exists = await db.listCollections({ name: collName }).toArray();
  if (!exists.length) {
    console.log(`Collection "${collName}" does not exist yet. Skipping index-drop step.`);
    // Still create the unique index on canon_key (createIndex will create collection if needed)
    try {
      await db.collection(collName).createIndex({ canon_key: 1 }, { unique: true, name: "canon_key_1" });
      console.log("Created unique index: canon_key_1 (collection created if it did not exist).");
    } catch (err) {
      console.error("Failed to create canon_key index:", err);
    }
    return;
  }

  // If it exists, inspect indexes and drop any index that references 'instrument_key'
  try {
    const idxs = await db.collection(collName).indexes();
    const bad = idxs.find(i => i.key && (i.key.instrument_key !== undefined || (i.name && i.name.includes('instrument_key'))));
    if (bad) {
      console.log("Found bad index:", bad.name || JSON.stringify(bad.key));
      try {
        await db.collection(collName).dropIndex(bad.name);
        console.log("Dropped index:", bad.name);
      } catch (err) {
        console.error("Failed to drop bad index:", err);
      }
    } else {
      console.log("No instrument_key index found.");
    }

    // Ensure unique index on canon_key exists (create if missing)
    const hasCanon = idxs.find(i => i.key && i.key.canon_key);
    if (!hasCanon) {
      try {
        await db.collection(collName).createIndex({ canon_key: 1 }, { unique: true, name: "canon_key_1" });
        console.log("Created unique index: canon_key_1");
      } catch (err) {
        console.error("Failed to create canon_key index:", err);
      }
    } else {
      console.log("canon_key index already exists.");
    }
  } catch (err) {
    // Defensive: if listing indexes throws for any reason, log and attempt to create the canon_key index
    console.error("Error while inspecting/dropping indexes (continuing):", err.message || err);
    try {
      await db.collection(collName).createIndex({ canon_key: 1 }, { unique: true, name: "canon_key_1" });
      console.log("Created unique index: canon_key_1 (after error).");
    } catch (e) {
      console.error("Failed to create canon_key index after error:", e);
    }
  }
}

async function run() {
  try {
    await mongoose.connect(mongoUri);
    console.log("✅ Mongo connected");

    // Fix indexes safely
    await fixIndexesSafe();

    // Clear collection (keeps indexes); if collection does not exist yet, deleteMany is fine
    console.log("Clearing existing instruments collection...");
    await Instrument.deleteMany({});
    console.log("✅ Collection cleared.");

    // CSV file argument or default - resolve relative to Backend directory
    const defaultCsv = path.resolve(__dirname, "../data/master-detailed.csv");
    const file = path.resolve(process.argv[2] || defaultCsv);
    if (!fs.existsSync(file)) {
      console.error("❌ CSV not found:", file);
      await mongoose.disconnect();
      process.exit(1);
    }
    console.log("Reading CSV:", file);

    const batch = [];
    let rowCount = 0, kept = 0;
    let lastLog = Date.now();

    async function flushBatch() {
      if (!batch.length) return;
      console.log(`Flushing batch of ${batch.length}. Sample doc:`, JSON.stringify(batch[0]).slice(0, 400));
      try {
        const res = await Instrument.insertMany(batch, { ordered: false });
        console.log(`... inserted ${res.length} docs`);
      } catch (e) {
        console.error("❌ Bulk insert failed:", e.message || e);
        if (Array.isArray(e.writeErrors) && e.writeErrors.length > 0) {
          console.error(`Found ${e.writeErrors.length} writeErrors — showing first 5:`);
          e.writeErrors.slice(0, 5).forEach((we, i) => {
            try {
              console.error(`#${i+1} errmsg:`, we.err?.errmsg || we.toString());
              console.error("   failing op (trim):", JSON.stringify(we.err?.op || we.op || {}).slice(0, 500));
            } catch (_) {}
          });
        } else if (e.name === "ValidationError") {
          console.error("ValidationError details:", e.errors);
        } else {
          console.error("Full error object:", e);
        }
      } finally {
        batch.length = 0;
      }
    }

    function logProgress() {
      const now = Date.now();
      if (now - lastLog > 2000) {
        console.log(`... parsed=${rowCount}, kept=${kept}, pendingBatch=${batch.length}`);
        lastLog = now;
      }
    }

    const readStream = fs.createReadStream(file).pipe(csv({ mapHeaders: ({ header }) => header.trim() }));
    
    readStream.on("data", async function (r) {
      rowCount++;
      try {
        // Kite CSV columns:
        // instrument_token, exchange_token, tradingsymbol, name, last_price,
        // expiry, strike, tick_size, lot_size, instrument_type, segment, exchange
    
        const instrument_token = String(r.instrument_token || r.INSTRUMENT_TOKEN || "").trim();
        const exchange_token = String(r.exchange_token || r.EXCHANGE_TOKEN || "").trim();
        const tradingsymbol = String(r.tradingsymbol || r.TRADINGSYMBOL || "").trim();
        const name = String(r.name || r.NAME || "").trim();
        const last_price = toNum(r.last_price || r.LAST_PRICE);
        const expiry = toDate(r.expiry || r.EXPIRY);
        const strike = toNum(r.strike || r.STRIKE);
        const tick_size = toNum(r.tick_size || r.TICK_SIZE);
        const lot_size = toNum(r.lot_size || r.LOT_SIZE);
        const instrument_type = String(r.instrument_type || r.INSTRUMENT_TYPE || "").trim();
        const segment = String(r.segment || r.SEGMENT || "").trim();
        const exchange = String(r.exchange || r.EXCHANGE || "").trim();
    
        if (!instrument_token) {
          // Skip rows without a primary identifier
          return;
        }
    
        // Build a canonical key similar to previous logic:
        const canon_key = `${exchange}|${segment}|${instrument_token}`;
    
        const doc = {
          instrument_token,
          exchange_token,
          tradingsymbol,
          name,
          last_price,
          expiry,
          strike,
          tick_size,
          lot_size,
          instrument_type,
          segment,
          exchange,
          canon_key
        };
    
        batch.push(doc);
        kept++;
    
        if (batch.length >= BATCH_SIZE) {
          readStream.pause();
          await flushBatch();
          logProgress();
          readStream.resume();
        } else {
          logProgress();
        }
      } catch (err) {
        console.error("Row processing error (row " + rowCount + "):", err);
      }
    });

    readStream.on("end", async () => {
      console.log("CSV parsing finished. Final flush...");
      await flushBatch();
      console.log(`✅ Done. Total rows parsed=${rowCount}, Instruments kept=${kept}`);
      await mongoose.disconnect();
      process.exit(0);
    });

    readStream.on("error", async (e) => {
      console.error("CSV read error:", e);
      await flushBatch();
      await mongoose.disconnect();
      process.exit(1);
    });

  } catch (err) {
    console.error("Fatal error in loader:", err);
    try { await mongoose.disconnect(); } catch (_) {}
    process.exit(1);
  }
}

run();
