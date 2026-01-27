// scripts/fetch_master_csv.js
import fs from "fs";
import https from "https";
import path from "path";
import zlib from "zlib";
import dotenv from "dotenv";

const envPath = path.resolve(process.cwd(), ".env");
dotenv.config({ path: envPath });
if (!fs.existsSync(envPath)) {
  console.warn(`⚠️ .env not found at: ${envPath}`);
}

const url = "https://api.kite.trade/instruments";
const dest = "data/master-detailed.csv";

fs.mkdirSync(path.dirname(dest), { recursive: true });

// Check if old file exists and delete it before downloading new one
if (fs.existsSync(dest)) {
    console.log("🗑️  Found existing file, deleting:", dest);
    try {
        fs.unlinkSync(dest);
        console.log("✅ Old file deleted successfully");
    } catch (err) {
        console.error("❌ Failed to delete old file:", err.message);
        process.exit(1);
    }
}

function download(u, outFile) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        "X-Kite-Version": "3",
        "Authorization": `token ${process.env.KITE_API_KEY}:${process.env.KITE_ACCESS_TOKEN}`
      }
    };
    https.get(u, options, (res) => {
      // handle redirect
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(download(res.headers.location, outFile));
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const file = fs.createWriteStream(outFile);
      const encoding = (res.headers["content-encoding"] || "").toLowerCase();
      if (encoding.includes("gzip")) {
        const gunzip = zlib.createGunzip();
        res.pipe(gunzip).pipe(file);
      } else {
        res.pipe(file);
      }
      file.on("finish", () => file.close(() => resolve(outFile)));
      file.on("error", (e) => reject(e));
    }).on("error", reject);
  });
}

// Ensure Kite credentials are present
// const { KITE_API_KEY, KITE_ACCESS_TOKEN } = process.env;
// if (!KITE_API_KEY || !KITE_ACCESS_TOKEN) {
//   console.error("❌ Missing Kite API credentials in .env");
//   process.exit(1);
// }

try {
  const out = await download(url, dest);
  console.log("✅ CSV saved:", out);
} catch (e) {
  console.error("❌ Download error:", e.message || e);
  process.exit(1);
}
