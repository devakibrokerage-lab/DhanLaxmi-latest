const marketHolidays = [
  "2026-01-15",
  "2026-01-26",
  "2026-03-03",
  "2026-03-26",
  "2026-03-31",
  "2026-04-03",
  "2026-04-14",
  "2026-05-01",
  "2026-05-28",
  "2026-06-26",
  "2026-09-14",
  "2026-10-02",
  "2026-10-20",
  "2026-11-10",
  "2026-11-24",
  "2026-12-25"
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

function isMarketHours(date, segment) {
  const istDate = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const hours = istDate.getHours();
  const minutes = istDate.getMinutes();
  const totalMinutes = hours * 60 + minutes;
  
  const marketOpen = 9 * 60 + 15;
  let marketClose = 15 * 60 + 15;

  if (segment && segment.toUpperCase().includes('MCX')) {
    marketClose = 23 * 60 + 15; // 11:15 PM for MCX
  }
  
  
  return totalMinutes >= marketOpen && totalMinutes <= marketClose;
}

export function canUserTrade(segment) {
  try {
    const activeContextString = localStorage.getItem('activeContext');
    if (activeContextString) {
      const activeContext = JSON.parse(activeContextString);
      const role = activeContext?.role?.toLowerCase();
      if (role && role !== 'customer') {
        return { canTrade: true };
      }
    }
  } catch (e) {
    // Continue with market checks
  }
  
  const now = new Date();
  
  if (!isTradingDay(now)) {
    return { canTrade: false };
  }
  
  if (!isMarketHours(now, segment)) {
    return { canTrade: false };
  }
  
  return { canTrade: true };
}

export function isMarketOpen(segment) {
  const now = new Date();
  return isTradingDay(now) && isMarketHours(now, segment);
}

export function logMarketStatus(segment) {
  const istTime = getISTTime();
  const open = isMarketOpen(segment);
  const timeStr = istTime.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
  const isOpen = open ? true : false;
  // console.log(`[Market Status] ${open ? "🟢 OPEN" : "🔴 CLOSED"} | IST: ${timeStr} | Segment: ${segment || 'Default'}`);
  return isOpen;
}
