const marketHolidays = [
  "2025-01-26",
  "2025-02-26",
  "2025-03-14",
  "2025-03-31",
  "2025-04-06",
  "2025-04-10",
  "2025-04-14",
  "2025-04-18",
  "2025-05-01",
  "2025-06-07",
  "2025-07-06",
  "2025-08-15",
  "2025-08-27",
  "2025-10-02",
  "2025-10-21",
  "2025-10-22",
  "2025-11-05",
  "2025-12-25"
];

const holidaySet = new Set(marketHolidays);

export function getISTTime() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
}

export function getISTDateString(date = new Date()) {
  return date.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

function isTradingDay(date) {
  const istDate = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const dayOfWeek = istDate.getDay();
  
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return false;
  }
  
  const dateStr = getISTDateString(date);
  if (holidaySet.has(dateStr)) {
    return false;
  }
  
  return true;
}

function isMarketHours(date) {
  const istDate = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const hours = istDate.getHours();
  const minutes = istDate.getMinutes();
  const totalMinutes = hours * 60 + minutes;
  
  const marketOpen = 9 * 60 + 15;
  const marketClose = 15 * 60 + 15;
  
  return totalMinutes >= marketOpen && totalMinutes <= marketClose;
}

export function isMarketOpen() {
  const now = new Date();
  return isTradingDay(now) && isMarketHours(now);
}

export function logMarketStatus() {
  const istTime = getISTTime();
  const open = isMarketOpen();
  const timeStr = istTime.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
  const isOpen = open ? true : false;
  return isOpen;
  console.log(`[Market Status] ${open ? "🟢 OPEN" : "🔴 CLOSED"} | IST: ${timeStr}`);
}
