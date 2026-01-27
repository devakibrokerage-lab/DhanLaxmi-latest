import cron from "node-cron";
import { exec } from "child_process";
import path from "path";
import { fileURLToPath } from 'url';

// Get current file path for proper path resolution
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve paths relative to this file
const csvPath = path.resolve(__dirname, "../data/master-detailed.csv");
const fetchScript = path.resolve(__dirname, "../scripts/fetch_master_csv.js");
const loadScript  = path.resolve(__dirname, "../scripts/load_dhan_master_detailed.js");

export function startMasterRefreshCron() {
  cron.schedule("0 8 * * 1-6", () => {
    console.log("🔁 Master Data Auto-Refresh Started (NSE F&O, MCX, Indices)");

    // Step 1: Fetch latest CSV from Dhan
    exec(`node ${fetchScript}`, (err, stdout, stderr) => {
      if (err) {
        console.error("❌ CSV Fetch Failed:", err.message);
        console.error("stderr:", stderr);
        return;
      }
      console.log("✅ CSV Downloaded Successfully");
      console.log(stdout);

      // Step 2: Load CSV into MongoDB
      exec(`node ${loadScript} ${csvPath}`, (err2, stdout2, stderr2) => {
        if (err2) {
          console.error("❌ DB Load Failed:", err2.message);
          console.error("stderr:", stderr2);
          return;
        }
        console.log("✅ Database Successfully Updated with Latest Master Data");
        console.log(stdout2);
      });
    });
  });

  console.log("🔁 Master refresh cron scheduled: Every weekday + Saturday at 8:00 AM IST");
  console.log("   Next run will fetch fresh data from Dhan and update database");
}
