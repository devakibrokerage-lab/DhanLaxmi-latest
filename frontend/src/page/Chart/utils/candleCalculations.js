// Pure utility functions for candle calculations (no React dependencies)

/**
 * Initialize a new candle with LTP as all OHLC values
 */
export function initializeCandle(ltp, timestamp = Date.now()) {
  return {
    open: ltp,
    high: ltp,
    low: ltp,
    close: ltp,
    volume: 0,
    startTime: timestamp,
  };
}

/**
 * Update candle OHLC based on new tick (pure function, returns new candle)
 */
export function updateCandleWithTick(candle, tick) {
  if (!candle || !tick || !tick.ltp) return candle;

  return {
    ...candle,
    high: Math.max(candle.high, tick.ltp),
    low: Math.min(candle.low, tick.ltp),
    close: tick.ltp,
    volume: tick.volume || candle.volume,
  };
}

/**
 * Check if current candle interval has expired
 */
export function shouldCreateNewCandle(candle, intervalMinutes) {
  const now = Date.now();
  const elapsed = now - candle.startTime;
  const intervalMs = intervalMinutes * 60 * 1000;
  return elapsed >= intervalMs;
}

/**
 * Convert candle to ApexCharts format
 */
export function candleToChartFormat(candle) {
  return {
    x: new Date(candle.startTime),
    y: [candle.open, candle.high, candle.low, candle.close],
    volume: candle.volume,
  };
}

/**
 * Map segment string to numeric format for tick lookup
 */
export function getTickKey(symbol) {
  const [segment, securityId] = symbol.split('|');
  if (!segment || !securityId) return null;

  const segmentMap = {
    "IDX_I": 0,
    "NSE_EQ": 1,
    "NSE_FNO": 2,
    "NSE_CURRENCY": 3,
    "BSE_EQ": 4,
    "BSE_CURRENCY": 5,
    "MCX_COMM": 5,
    "NSE_INDEX": 0,
  };

  const numericSegment = segmentMap[segment];
  if (numericSegment === undefined) return null;

  return `${numericSegment}-${securityId}`;
}

/**
 * Calculate candle color based on open/close
 */
export function getCandleColor(candle) {
  return candle.close >= candle.open ? '#00B746' : '#EF403C';
}

/**
 * Format number with K/M/B suffixes
 */
export function formatVolume(volume) {
  if (!volume) return '0';
  if (volume >= 1e9) return (volume / 1e9).toFixed(2) + 'B';
  if (volume >= 1e6) return (volume / 1e6).toFixed(2) + 'M';
  if (volume >= 1e3) return (volume / 1e3).toFixed(2) + 'K';
  return volume.toFixed(0);
}
