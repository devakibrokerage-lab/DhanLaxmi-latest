import axios from 'axios';
import fs from 'fs';
import path from 'path';

const NSE_HOME_URL = 'https://www.nseindia.com';
const NSE_HOLIDAY_URL = 'https://www.nseindia.com/api/holiday-master?type=trading';

async function fetchNseHolidays() {
  try {
    console.log("1. Connecting to NSE Homepage to get Cookies...");
    
    // Step 1: Get Cookies
    const homeResponse = await axios.get(NSE_HOME_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      }
    });

    const cookies = homeResponse.headers['set-cookie'];
    if (!cookies) throw new Error("Failed to get cookies from NSE");
    const cookieHeader = cookies.map(c => c.split(';')[0]).join('; ');

    console.log("2. Fetching Holiday Data...");

    // Step 2: Call API with Cookies
    const apiResponse = await axios.get(NSE_HOLIDAY_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Cookie': cookieHeader,
        'Referer': 'https://www.nseindia.com/resources/exchange-communication-holidays',
        'X-Requested-With': 'XMLHttpRequest'
      }
    });

    const data = apiResponse.data;
    
    // NSE Response structure: { CM: [...], FO: [...], CD: [...] }
    // Hum 'CM' (Capital Market) ya 'FO' (Futures & Options) ka data use karenge
    const rawHolidays = data.CM || []; 
    
    const holidayList = rawHolidays.map(h => h.tradingDate); // Extract dates like "26-Jan-2025"

    console.log(`✅ Found ${holidayList.length} holidays.`);

    // Step 3: File Generate karna
    generateCalendarFile(holidayList);

  } catch (err) {
    console.error("❌ Error:", err.message);
    if (err.response) console.error("Status:", err.response.status);
  }
}

function generateCalendarFile(holidayList) {
    // Dates ko "DD-MMM-YYYY" se standard "YYYY-MM-DD" me badalna
    const formattedHolidays = holidayList.map(dateStr => {
        const date = new Date(dateStr);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    });

    const fileContent = `// AUTO-GENERATED via NSE Official API
// Source: ${NSE_HOLIDAY_URL}
// Last Updated: ${new Date().toLocaleString()}

const marketHolidays = ${JSON.stringify(formattedHolidays, null, 2)};
const holidaySet = new Set(marketHolidays);

export function isTradingDay(dateObj = new Date()) {
  const indianDateStr = dateObj.toLocaleDateString("en-CA", {
    timeZone: "Asia/Kolkata",
  }); 

  const indianDate = new Date(dateObj.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const dayOfWeek = indianDate.getDay();

  // Weekend Check (Sat=6, Sun=0)
  if (dayOfWeek === 0 || dayOfWeek === 6) return false;

  // Holiday Check
  if (holidaySet.has(indianDateStr)) return false;

  return true;
}
`;

    // --- FIX IS HERE ---
    
    // 1. Sahi folder path banana (Cross-platform compatible)
    // Ensure we use the correct lowercase 'cron' directory (Linux is case-sensitive)
    const folderPath = path.join(process.cwd(), 'Backend', 'cron'); 
    
    // 2. File ka naam jodna
    const fullPath = path.join(folderPath, 'marketCalendar.js');

    // 3. Folder exist karta hai ya nahi check karna (Agar nahi hai to banana padega)
    if (!fs.existsSync(folderPath)){
        console.log(`Creating directory: ${folderPath}`);
        fs.mkdirSync(folderPath, { recursive: true });
    }

    // 4. File write karna
    fs.writeFileSync(fullPath, fileContent);
    console.log(`✅ File saved successfully to: ${fullPath}`);
}

fetchNseHolidays();