// Chart.jsx — Full Working TradingView-Style Chart Component with Intraday Support

import React, { useEffect, useState, useCallback, useRef } from "react";
import Chart from "react-apexcharts";
import { Calendar, Clock, AlertCircle } from "lucide-react";
import { useMarketData } from "../../../contexts/MarketDataContext.jsx";

// ✅ Helper to format candle data for ApexCharts
const formatCandles = (candles) =>
  candles.map(([timestamp, open, high, low, close, volume]) => ({
    x: new Date(timestamp),
    y: [open, high, low, close],
    volume,
  }));

// Interval configurations with realistic defaults
const INTERVALS = [
  { label: '1m', value: '1', type: 'intraday', days: 1, maxCandles: 375 },      // ~375 candles per day
  { label: '5m', value: '5', type: 'intraday', days: 5, maxCandles: 1875 },     // ~375 candles per day
  { label: '15m', value: '15', type: 'intraday', days: 15, maxCandles: 1875 },  // ~125 candles per day
  { label: '1h', value: '60', type: 'intraday', days: 30, maxCandles: 1875 },   // ~31 candles per day
  { label: '1D', value: 'daily', type: 'daily', days: 90, maxCandles: 90 },     // Changed from 365 to 90 days
];

function StockChart({ symbol, tradingSymbol }) {
  const [candles, setCandles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedInterval, setSelectedInterval] = useState('5'); // Default: 5 minutes
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [isInitialized, setIsInitialized] = useState(false);
  const [liveCandle, setLiveCandle] = useState(null); // Current candle being built from live ticks

  // Refs for tracking
  const lastCandleTimeRef = useRef(null);
  const isSubscribedRef = useRef(false);

  // Get live market data
  const { ticksRef, subscribe, unsubscribe, isConnected } = useMarketData();

  // Display name for chart title
  const displayName = tradingSymbol || symbol.split("|")[1] || symbol;

  // Get current interval config
  const currentInterval = INTERVALS.find(i => i.value === selectedInterval) || INTERVALS[1];

  // Calculate default date range based on interval (memoized)
  const getDefaultDateRange = useCallback((intervalConfig) => {
    const today = new Date();
    const from = new Date(today);

    // Use default days from interval config
    from.setDate(today.getDate() - intervalConfig.days);

    return {
      from: from.toISOString().slice(0, 10),
      to: today.toISOString().slice(0, 10)
    };
  }, []);

  // Initialize date range ONCE on mount
  useEffect(() => {
    if (!isInitialized) {
      const defaults = getDefaultDateRange(currentInterval);
      setDateRange(defaults);
      setIsInitialized(true);
    }
  }, [isInitialized, currentInterval, getDefaultDateRange]);

  // Format date for API based on interval type
  const formatDateForAPI = (date, isStartDate = false) => {
    const d = new Date(date);

    if (currentInterval.type === 'intraday') {
      // Intraday requires "YYYY-MM-DD HH:MM:SS" format
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');

      // Set time: 09:15:00 for start, 15:30:00 for end
      const time = isStartDate ? '09:15:00' : '15:30:00';
      return `${year}-${month}-${day} ${time}`;
    } else {
      // Daily requires "YYYY-MM-DD" format
      return date;
    }
  };

  // Validate 90-day limit for intraday
  const validateDateRange = (from, to) => {
    if (currentInterval.type === 'intraday') {
      const fromDate = new Date(from);
      const toDate = new Date(to);
      const daysDiff = (toDate - fromDate) / (1000 * 60 * 60 * 24);

      if (daysDiff > 90) {
        return { valid: false, message: 'Intraday data is limited to 90 days. Please select a shorter range.' };
      }
    }
    return { valid: true };
  };

  // Fetch chart data from backend (with debounce to prevent rapid re-fetches)
  useEffect(() => {
    if (!dateRange.from || !dateRange.to || !isInitialized) return;

    // Use a ref to track if this effect should run
    let isCancelled = false;

    const fetchChartData = async () => {

      try {
        setLoading(true);
        setError(null);

        // Validate date range
        const validation = validateDateRange(dateRange.from, dateRange.to);
        if (!validation.valid) {
          throw new Error(validation.message);
        }

        const fromDate = formatDateForAPI(dateRange.from, true);
        const toDate = formatDateForAPI(dateRange.to, false);

        let url;
        const baseUrl = import.meta.env.VITE_REACT_APP_API_URL || 'http://localhost:8080';

        if (currentInterval.type === 'intraday') {
          // Use intraday endpoint
          url = `${baseUrl}/api/chart/getIntradayData?symbol=${encodeURIComponent(
            symbol
          )}&from=${encodeURIComponent(fromDate)}&to=${encodeURIComponent(toDate)}&interval=${selectedInterval}`;
        } else {
          // Use daily endpoint
          url = `${baseUrl}/api/chart/getChartData?symbol=${encodeURIComponent(
            symbol
          )}&from=${dateRange.from}&to=${dateRange.to}`;
        }

        console.log('[StockChart] Fetching:', url);

        const res = await fetch(url);

        if (!res.ok) {
          const text = await res.text().catch(() => '');
          console.error('[StockChart] API error:', text);
          throw new Error(`Chart fetch failed: ${res.status} ${res.statusText}`);
        }

        const json = await res.json();

        const candleData = json?.data?.candles ?? json?.data?.ohlc ?? null;
        if (!candleData || !Array.isArray(candleData) || candleData.length === 0) {
          console.warn('[StockChart] No candle data returned');
          if (!isCancelled) {
            setCandles([]);
            setError('No data available for selected period');
          }
          return;
        }

        const formatted = formatCandles(candleData);
        if (!isCancelled) {
          setCandles(formatted);
          console.log('[StockChart] Loaded', formatted.length, 'candles');
        }
      } catch (err) {
        console.error('[StockChart] Fetch error:', err);
        if (!isCancelled) {
          setError(err.message || 'Failed to load chart data');
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    fetchChartData();

    // Cleanup function to cancel any pending state updates
    return () => {
      isCancelled = true;
    };
  }, [symbol, selectedInterval, dateRange.from, dateRange.to, isInitialized, currentInterval.type]);

  // Subscribe to live market data for this symbol
  useEffect(() => {
    if (!isConnected || !symbol || candles.length === 0) return;

    const [segment, securityId] = symbol.split('|');
    if (!segment || !securityId) return;

    const subscription = [{
      segment: segment,
      securityId: securityId
    }];

    console.log('[StockChart] Subscribing to live data:', subscription);

    // Subscribe to live ticks
    subscribe(subscription, 'full').catch(err => {
      console.warn('[StockChart] Subscribe failed:', err);
    });

    isSubscribedRef.current = true;

    return () => {
      if (isSubscribedRef.current) {
        console.log('[StockChart] Unsubscribing from live data');
        unsubscribe(subscription, 'full').catch(err => {
          console.warn('[StockChart] Unsubscribe failed:', err);
        });
        isSubscribedRef.current = false;
      }
    };
  }, [symbol, isConnected, subscribe, unsubscribe, candles.length]);

  // Use ref for candles to access latest data in interval without restarting it
  const candlesRef = useRef(candles);
  useEffect(() => {
    candlesRef.current = candles;
  }, [candles]);

  // Process live ticks and update current candle
  useEffect(() => {
    if (currentInterval.type === 'daily') return;

    const [segment, securityId] = symbol.split('|');
    if (!segment || !securityId) return;

    // Map segment to numeric format for ticks
    const segmentMap = {
      "IDX_I": 0, "NSE_EQ": 1, "NSE_FNO": 2, "NSE_CURRENCY": 3,
      "BSE_EQ": 4, "BSE_CURRENCY": 7, "MCX_COMM": 5, "NSE_INDEX": 0, "BSE_INDEX": 0, "BSE_FNO": 8
    };

    const numericSegment = segmentMap[segment];
    const tickKey = `${numericSegment}-${securityId}`;

    const updateLoop = () => {
      if (!ticksRef.current) return;
      const tick = ticksRef.current.get(tickKey);
      if (!tick || !tick.ltp) return;

      const currentCandles = candlesRef.current;
      if (!currentCandles || currentCandles.length === 0) return;

      const lastCandle = currentCandles[currentCandles.length - 1];
      if (!lastCandle) return;

      const lastCandleTime = lastCandle.x.getTime();
      const intervalMs = Number(selectedInterval) * 60 * 1000;
      const now = Date.now();
      const timeSinceLastCandle = now - lastCandleTime;

      if (timeSinceLastCandle < intervalMs) {
        // Update existing candle
        setLiveCandle(prev => {
          // If we already have a live candle, base it on that, else base on last historical
          // But wait, lastCandle IS the historical one.
          // If we are "updating existing", we are effectively modifying the last candle relative to itself.
          // ApexCharts expects us to replace the last point.

          // Construct the "new" version of the last candle
          // We need to know if 'prev' corresponds to the same timeslot
          return {
            x: lastCandle.x,
            y: [
              lastCandle.y[0],
              Math.max(prev?.y?.[1] ?? lastCandle.y[1], tick.ltp),
              Math.min(prev?.y?.[2] ?? lastCandle.y[2], tick.ltp),
              tick.ltp
            ],
            volume: (tick.volume || lastCandle.volume)
          };
        });
      } else if (timeSinceLastCandle >= intervalMs && timeSinceLastCandle < intervalMs * 2) {
        // Create new candle
        const newCandleTime = new Date(lastCandleTime + intervalMs);
        setLiveCandle(prev => {
          if (prev && prev.x.getTime() === newCandleTime.getTime()) {
            // Update the *new* candle we are building
            return {
              x: newCandleTime,
              y: [
                prev.y[0],
                Math.max(prev.y[1], tick.ltp),
                Math.min(prev.y[2], tick.ltp),
                tick.ltp
              ],
              volume: (tick.volume || 0)
            };
          }
          // Init new candle
          return {
            x: newCandleTime,
            y: [tick.ltp, tick.ltp, tick.ltp, tick.ltp],
            volume: tick.volume || 0
          };
        });
      }
    };

    const intervalId = setInterval(updateLoop, 1000);
    return () => clearInterval(intervalId);
  }, [symbol, selectedInterval, currentInterval.type]);
  // Merge live candle with historical candles
  const displayCandles = React.useMemo(() => {
    if (!liveCandle || candles.length === 0) return candles;

    // Check if live candle is updating the last candle or adding a new one
    const lastCandle = candles[candles.length - 1];
    const lastCandleTime = lastCandle.x.getTime();
    const liveCandleTime = liveCandle.x.getTime();

    if (liveCandleTime === lastCandleTime) {
      // Update last candle
      return [...candles.slice(0, -1), liveCandle];
    } else if (liveCandleTime > lastCandleTime) {
      // Append new candle
      return [...candles, liveCandle];
    }

    return candles;
  }, [candles, liveCandle]);

  // Separate volume for secondary chart with color coding
  const volumeSeries = displayCandles.map((c, idx) => {
    // Compare close with open for current candle color
    const isUp = c.y[3] >= c.y[0]; // close >= open
    return {
      x: c.x,
      y: c.volume,
      fillColor: isUp ? '#00B746' : '#EF403C'
    };
  });

  // --- ApexCharts Config ---
  const candleOptions = {
    chart: {
      id: 'stock-candlestick-chart', // Stable ID to preserve zoom state
      type: "candlestick",
      background: "#1A1F30",
      foreColor: "#ccc",
      height: 400,
      toolbar: {
        show: true,
        tools: {
          download: true,
          zoom: true,
          zoomin: true,
          zoomout: true,
          pan: true,
          reset: true
        }
      },
      zoom: {
        enabled: true,
        type: 'x',
        autoScaleYaxis: true
      },
      animations: {
        enabled: false,
        dynamicAnimation: {
          enabled: false
        }
      }
    },
    dataLabels: {
      enabled: false
    },
    title: {
      text: `${displayName} (${currentInterval.label})${liveCandle && currentInterval.type === 'intraday' ? ' • 🟢 LIVE' : ''}`,
      align: "left",
      style: { color: "#fff", fontWeight: 600, fontSize: '16px' },
    },
    xaxis: {
      type: "datetime",
      labels: {
        style: { colors: "#aaa" },
        datetimeFormatter: {
          year: 'yyyy',
          month: 'MMM \'yy',
          day: 'dd MMM',
          hour: 'HH:mm'
        }
      },
    },
    yaxis: {
      tooltip: { enabled: true },
      labels: {
        style: { colors: "#aaa" },
        formatter: (val) => `₹${val?.toFixed(2) || 0}`
      },
    },
    grid: {
      borderColor: "#333",
      strokeDashArray: 3,
    },
    plotOptions: {
      candlestick: {
        colors: {
          upward: '#00B746',
          downward: '#EF403C'
        },
        wick: {
          useFillColor: true
        }
      }
    },
    tooltip: {
      theme: "dark",
      x: {
        show: true,
        format: currentInterval.type === 'intraday' ? 'dd MMM HH:mm' : 'dd MMM yyyy'
      },
      y: {
        formatter: (val) => `₹${val?.toFixed(2) || 0}`
      }
    },
    states: {
      active: {
        filter: {
          type: 'none' // Prevents color change on zoom/interaction
        }
      }
    }
  };

  const volumeOptions = {
    chart: {
      id: 'stock-volume-chart', // Stable ID to preserve state
      type: "bar",
      background: "#1A1F30",
      foreColor: "#ccc",
      height: 150,
      toolbar: { show: false },
      animations: {
        enabled: false,
        dynamicAnimation: {
          enabled: false
        }
      },
    },
    plotOptions: {
      bar: {
        columnWidth: candles.length > 100 ? "95%" : candles.length > 50 ? "90%" : "80%",
        borderRadius: 2,
        colors: {
          ranges: [{
            from: -Infinity,
            to: Infinity,
            color: undefined // Will use fillColor from data
          }]
        }
      },
    },
    dataLabels: {
      enabled: false
    },
    xaxis: {
      type: "datetime",
      labels: { show: false },
    },
    yaxis: {
      labels: {
        style: { colors: "#aaa" },
        formatter: (val) => {
          if (val >= 10000000) return `${(val / 10000000).toFixed(1)}Cr`;
          if (val >= 100000) return `${(val / 100000).toFixed(1)}L`;
          if (val >= 1000) return `${(val / 1000).toFixed(1)}K`;
          return val?.toFixed(0) || 0;
        }
      },
    },
    grid: {
      borderColor: "#333",
    },
    tooltip: {
      theme: "dark",
      y: {
        formatter: (val) => val?.toLocaleString() || 0
      }
    },
    states: {
      active: {
        filter: {
          type: 'none'
        }
      }
    }
  };

  // Handle interval change
  const handleIntervalChange = (interval) => {
    if (interval === selectedInterval) return; // Prevent unnecessary updates

    setSelectedInterval(interval);
    setCandles([]); // Clear old candles immediately
    setLoading(true);

    // Get new interval config and set appropriate date range
    const newInterval = INTERVALS.find(i => i.value === interval) || INTERVALS[1];
    const defaults = getDefaultDateRange(newInterval);
    setDateRange(defaults);
  };

  // Handle date change
  const handleDateChange = (field, value) => {
    setDateRange(prev => ({
      ...prev,
      [field]: value
    }));
  };

  if (loading)
    return (
      <div className="p-4 text-center text-gray-400 bg-[#1A1F30] rounded-lg min-h-[400px] flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
          <p>Loading chart data...</p>
        </div>
      </div>
    );

  if (error)
    return (
      <div className="p-4 text-center bg-[#1A1F30] rounded-lg min-h-[400px] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 max-w-md">
          <AlertCircle className="w-12 h-12 text-red-400" />
          <p className="text-red-400 font-semibold">{error}</p>
          <button
            onClick={() => {
              setError(null);
              setLoading(true);
            }}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );

  return (
    <div className="bg-[#1A1F30] rounded-xl p-3 shadow-lg space-y-3">
      {/* Control Bar */}
      <div className="flex flex-wrap items-center gap-3 pb-3 border-b border-white/10">
        {/* Interval Selector */}
        <div className="flex items-center gap-1 bg-[#0E1324] rounded-lg p-1">
          <Clock className="w-4 h-4 text-gray-400 ml-1" />
          {INTERVALS.map((interval) => (
            <button
              key={interval.value}
              onClick={() => handleIntervalChange(interval.value)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${selectedInterval === interval.value
                ? 'bg-indigo-600 text-white'
                : 'bg-transparent text-gray-400 hover:text-white hover:bg-white/5'
                }`}
            >
              {interval.label}
            </button>
          ))}
        </div>

        {/* Date Range Picker */}
        <div className="flex items-center gap-2 bg-[#0E1324] rounded-lg p-2 flex-1 min-w-[280px]">
          <Calendar className="w-4 h-4 text-gray-400" />
          <div className="flex items-center gap-2 text-xs flex-1">
            <input
              type="date"
              value={dateRange.from}
              onChange={(e) => handleDateChange('from', e.target.value)}
              max={dateRange.to}
              className="bg-transparent text-gray-300 border border-white/10 rounded px-2 py-1 focus:outline-none focus:border-indigo-500"
            />
            <span className="text-gray-500">to</span>
            <input
              type="date"
              value={dateRange.to}
              onChange={(e) => handleDateChange('to', e.target.value)}
              min={dateRange.from}
              max={new Date().toISOString().slice(0, 10)}
              className="bg-transparent text-gray-300 border border-white/10 rounded px-2 py-1 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Info Badge */}
        {currentInterval.type === 'intraday' && (
          <div className="text-xs text-yellow-400 bg-yellow-400/10 px-2 py-1 rounded border border-yellow-400/20">
            Max 90 days for intraday
          </div>
        )}
      </div>

      {/* Candlestick Chart */}
      <Chart
        key={`candle-${symbol}-${selectedInterval}`}
        options={candleOptions}
        series={[{ data: displayCandles }]}
        type="candlestick"
        height={400}
      />

      {/* Volume Chart */}
      <Chart
        key={`volume-${symbol}-${selectedInterval}`}
        options={volumeOptions}
        series={[{ name: "Volume", data: volumeSeries }]}
        type="bar"
        height={150}
      />

      {/* Data Info */}
      <div className="text-xs text-gray-500 text-center pt-2 border-t border-white/10">
        Showing {displayCandles.length} candles • {currentInterval.label} interval
        {liveCandle && currentInterval.type === 'intraday' && (
          <span className="text-green-400 ml-2">
            🟢 Live updating
          </span>
        )}
        {candles.length >= currentInterval.maxCandles && (
          <span className="text-yellow-400 ml-2">
            ⚠️ Large dataset may affect performance
          </span>
        )}
      </div>
    </div>
  );
}

export default StockChart;
