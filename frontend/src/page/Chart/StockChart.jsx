// StockChart.jsx — Trading Chart with TradingView Lightweight Charts
// Updated to use instrument_token for Kite API

import React, { useEffect, useState, useCallback, useRef } from "react";
import { Calendar, Clock, AlertCircle, Maximize2 } from "lucide-react";
import { useMarketData } from "../../contexts/MarketDataContext.jsx";
import TradingChart from "./TradingChart.jsx";

// Interval configurations with realistic defaults
const INTERVALS = [
  { label: '1m', value: '1', type: 'intraday', days: 1, maxCandles: 375 },
  { label: '5m', value: '5', type: 'intraday', days: 5, maxCandles: 1875 },
  { label: '15m', value: '15', type: 'intraday', days: 15, maxCandles: 1875 },
  { label: '1h', value: '60', type: 'intraday', days: 30, maxCandles: 1875 },
  { label: '1D', value: 'daily', type: 'daily', days: 90, maxCandles: 90 },
];

function StockChart({
  instrument_token,  // Primary identifier (Kite format)
  tradingSymbol,     // Display name
  instrumentData,    // Full instrument data from lookup
  initialInterval,
  initialFrom,
  initialTo
}) {
  const [candles, setCandles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedInterval, setSelectedInterval] = useState(initialInterval || '5');
  const [dateRange, setDateRange] = useState({ from: initialFrom || '', to: initialTo || '' });
  const [isInitialized, setIsInitialized] = useState(false);
  const [liveConnectionStatus, setLiveConnectionStatus] = useState('disconnected');

  // Refs for tracking
  const isSubscribedRef = useRef(false);
  const candlesLoadedRef = useRef(false);

  // Get live market data
  const { subscribe, unsubscribe, isConnected } = useMarketData();

  // Display name for chart title
  const displayName = tradingSymbol || instrumentData?.tradingsymbol || `Token: ${instrument_token}`;

  // Get current interval config
  const currentInterval = INTERVALS.find(i => i.value === selectedInterval) || INTERVALS[1];

  // Calculate default date range based on interval
  const getDefaultDateRange = useCallback((intervalConfig) => {
    const today = new Date();
    const from = new Date(today);
    from.setDate(today.getDate() - intervalConfig.days);

    return {
      from: from.toISOString().slice(0, 10),
      to: today.toISOString().slice(0, 10)
    };
  }, []);

  // Initialize date range ONCE on mount
  useEffect(() => {
    if (!isInitialized) {
      if (!initialFrom || !initialTo) {
        const defaults = getDefaultDateRange(currentInterval);
        setDateRange(defaults);
      }
      setIsInitialized(true);
    }
  }, [isInitialized, currentInterval, getDefaultDateRange, initialFrom, initialTo]);

  // Format date for API based on interval type
  const formatDateForAPI = (date, isStartDate = false) => {
    const d = new Date(date);

    if (currentInterval.type === 'intraday') {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const time = isStartDate ? '09:15:00' : '15:30:00';
      return `${year}-${month}-${day} ${time}`;
    } else {
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

  // Fetch chart data from backend
  useEffect(() => {
    if (!dateRange.from || !dateRange.to || !isInitialized || !instrument_token) return;

    let isCancelled = false;

    const fetchChartData = async () => {
      try {
        setLoading(true);
        setError(null);

        const validation = validateDateRange(dateRange.from, dateRange.to);
        if (!validation.valid) {
          throw new Error(validation.message);
        }

        const fromDate = formatDateForAPI(dateRange.from, true);
        const toDate = formatDateForAPI(dateRange.to, false);

        let url;
        const baseUrl = import.meta.env.VITE_REACT_APP_API_URL || 'http://localhost:8080';

        if (currentInterval.type === 'intraday') {
          // Use intraday endpoint with instrument_token
          url = `${baseUrl}/api/chart/getIntradayData?instrument_token=${encodeURIComponent(
            instrument_token
          )}&from=${encodeURIComponent(fromDate)}&to=${encodeURIComponent(toDate)}&interval=${selectedInterval}`;
        } else {
          // Use daily endpoint with instrument_token
          url = `${baseUrl}/api/chart/getChartData?instrument_token=${encodeURIComponent(
            instrument_token
          )}&from=${dateRange.from}&to=${dateRange.to}&interval=day`;
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

        if (!isCancelled) {
          setCandles(candleData);
          candlesLoadedRef.current = true;
          console.log('[StockChart] Loaded', candleData.length, 'candles');
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

    return () => {
      isCancelled = true;
    };
  }, [instrument_token, selectedInterval, dateRange.from, dateRange.to, isInitialized, currentInterval.type]);

  // Subscribe to live market data (only for intraday charts)
  useEffect(() => {
    if (!isConnected || !instrument_token || currentInterval.type !== 'intraday') {
      setLiveConnectionStatus('disconnected');
      return;
    }

    if (loading || !candlesLoadedRef.current) return;

    if (isSubscribedRef.current) return;

    // Use instrument_token for subscription
    const subscription = [{
      instrument_token: instrument_token
    }];

    setLiveConnectionStatus('connecting');

    subscribe(subscription, 'full')
      .then(() => {
        console.log('[StockChart] Successfully subscribed to live feed');
        setLiveConnectionStatus('connected');
        isSubscribedRef.current = true;
      })
      .catch(err => {
        console.warn('[StockChart] Subscribe failed:', err);
        setLiveConnectionStatus('error');
        isSubscribedRef.current = false;
      });

    return () => {
      if (isSubscribedRef.current) {
        console.log('[StockChart] Cleaning up subscription');
        unsubscribe(subscription, 'full').catch(err => {
          console.warn('[StockChart] Unsubscribe failed:', err);
        });
        isSubscribedRef.current = false;
        setLiveConnectionStatus('disconnected');
      }
    };
  }, [instrument_token, isConnected, currentInterval.type, loading]);

  // Handle interval change
  const handleIntervalChange = (interval) => {
    if (interval === selectedInterval) return;

    setSelectedInterval(interval);
    setCandles([]);
    candlesLoadedRef.current = false;
    setLoading(true);

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
      <div className="p-4 text-center text-[var(--text-secondary)] bg-[var(--bg-card)] rounded-lg min-h-[400px] flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
          <p>Loading chart data...</p>
        </div>
      </div>
    );

  if (error)
    return (
      <div className="p-4 text-center bg-[var(--bg-card)] rounded-lg min-h-[400px] flex items-center justify-center">
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
    <div className="bg-[var(--bg-card)] rounded-xl p-3 shadow-lg space-y-3">
      {/* Control Bar */}
      <div className="flex flex-wrap items-center gap-3 pb-3 border-b border-[var(--border-color)]">
        {/* Interval Selector */}
        <div className="flex items-center gap-1 bg-[var(--bg-primary)] rounded-lg p-1">
          <Clock className="w-4 h-4 text-[var(--text-secondary)] ml-1" />
          {INTERVALS.map((interval) => (
            <button
              key={interval.value}
              onClick={() => handleIntervalChange(interval.value)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${selectedInterval === interval.value
                ? 'bg-indigo-600 text-white'
                : 'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                }`}
            >
              {interval.label}
            </button>
          ))}
        </div>

        {/* Date Range Picker */}
        <div className="flex items-center gap-2 bg-[var(--bg-primary)] rounded-lg p-2 flex-1 min-w-[280px]">
          <Calendar className="w-4 h-4 text-[var(--text-secondary)]" />
          <div className="flex items-center gap-2 text-xs flex-1">
            <input
              type="date"
              value={dateRange.from}
              onChange={(e) => handleDateChange('from', e.target.value)}
              max={dateRange.to}
              className="bg-transparent text-[var(--text-secondary)] border border-[var(--border-color)] rounded px-2 py-1 focus:outline-none focus:border-indigo-500"
            />
            <span className="text-[var(--text-muted)]">to</span>
            <input
              type="date"
              value={dateRange.to}
              onChange={(e) => handleDateChange('to', e.target.value)}
              min={dateRange.from}
              max={new Date().toISOString().slice(0, 10)}
              className="bg-transparent text-[var(--text-secondary)] border border-[var(--border-color)] rounded px-2 py-1 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Info Badge */}
        {currentInterval.type === 'intraday' && (
          <div className="text-xs text-yellow-400 bg-yellow-400/10 px-2 py-1 rounded border border-yellow-400/20">
            Max 90 days for intraday
          </div>
        )}

        {/* Fullscreen Toggle */}
        <button
          onClick={() => {
            const chartContainer = document.querySelector('.chart-container');
            if (chartContainer) {
              if (document.fullscreenElement) {
                document.exitFullscreen();
              } else {
                chartContainer.requestFullscreen();
              }
            }
          }}
          title="Toggle Fullscreen"
          className="p-2 bg-[var(--bg-primary)] text-[var(--text-secondary)] rounded-lg hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition ml-auto"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      {/* Chart Container */}
      <div className="chart-container space-y-3">
        {/* Live Connection Status Badge */}
        {currentInterval.type === 'intraday' && (
          <div className="flex items-center justify-center gap-2 py-1">
            {liveConnectionStatus === 'connected' && (
              <div className="flex items-center gap-1.5 text-xs text-green-400 bg-green-400/10 px-3 py-1 rounded-full border border-green-400/30">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                <span className="font-semibold">LIVE</span>
              </div>
            )}
            {liveConnectionStatus === 'connecting' && (
              <div className="flex items-center gap-1.5 text-xs text-yellow-400 bg-yellow-400/10 px-3 py-1 rounded-full border border-yellow-400/30">
                <span className="w-2 h-2 bg-yellow-400 rounded-full animate-spin"></span>
                <span className="font-semibold">CONNECTING...</span>
              </div>
            )}
            {liveConnectionStatus === 'error' && (
              <div className="flex items-center gap-1.5 text-xs text-red-400 bg-red-400/10 px-3 py-1 rounded-full border border-red-400/30">
                <span className="w-2 h-2 bg-red-400 rounded-full"></span>
                <span className="font-semibold">CONNECTION ERROR</span>
              </div>
            )}
            {liveConnectionStatus === 'disconnected' && isConnected && (
              <div className="flex items-center gap-1.5 text-xs text-gray-400 bg-gray-400/10 px-3 py-1 rounded-full border border-gray-400/30">
                <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
                <span className="font-semibold">HISTORICAL DATA</span>
              </div>
            )}
          </div>
        )}

        {/* Trading Chart */}
        <div style={{ height: '500px', width: '100%' }}>
          <TradingChart
            candles={candles}
            symbol={displayName}
            interval={selectedInterval}
            isLiveEnabled={currentInterval.type === 'intraday' && liveConnectionStatus === 'connected'}
            loading={loading}
          />
        </div>

        {/* Data Info */}
        <div className="text-xs text-[var(--text-muted)] text-center pt-2 border-t border-[var(--border-color)]">
          Showing {candles.length} candles • {currentInterval.label} interval
          {liveConnectionStatus === 'connected' && currentInterval.type === 'intraday' && (
            <span className="text-green-400 ml-2">• Live updating</span>
          )}
          {candles.length >= currentInterval.maxCandles && (
            <span className="text-yellow-400 ml-2">
              ⚠️ Large dataset may affect performance
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default StockChart;
