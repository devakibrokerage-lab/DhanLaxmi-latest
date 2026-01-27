// LiveCandleOverlay.jsx - Canvas-based live candle rendering
import React, { useRef, useEffect, useState } from 'react';
import { 
  initializeCandle, 
  updateCandleWithTick, 
  shouldCreateNewCandle, 
  candleToChartFormat,
  getTickKey,
  getCandleColor,
  formatVolume
} from './utils/candleCalculations';

function LiveCandleOverlay({ 
  ticks, 
  symbol, 
  intervalMinutes, 
  lastHistoricalCandle, 
  chartBounds,
  onNewCandleCreated,
  isConnected
}) {
  const canvasRef = useRef(null);
  const currentCandleRef = useRef(null);
  const animationFrameRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);
  const [isHovering, setIsHovering] = useState(false);

  // Initialize candle when component mounts or symbol changes
  useEffect(() => {
    if (!lastHistoricalCandle || !isConnected) {
      currentCandleRef.current = null;
      return;
    }

    const tickKey = getTickKey(symbol);
    if (!tickKey) return;

    const tick = ticks.get(tickKey);
    if (!tick || !tick.ltp) return;

    // Initialize with current LTP
    currentCandleRef.current = initializeCandle(tick.ltp);
    
  }, [symbol, lastHistoricalCandle, isConnected]);

  // Process ticks and update candle (no state changes!)
  useEffect(() => {
    if (!currentCandleRef.current || !isConnected) return;

    const tickKey = getTickKey(symbol);
    if (!tickKey) return;

    const tick = ticks.get(tickKey);
    if (!tick || !tick.ltp) return;

    // Check if we need to create a new candle
    if (shouldCreateNewCandle(currentCandleRef.current, intervalMinutes)) {
      // Notify parent to append this candle to historical data
      if (onNewCandleCreated) {
        const completedCandle = candleToChartFormat(currentCandleRef.current);
        onNewCandleCreated(completedCandle);
      }
      
      // Start new candle
      currentCandleRef.current = initializeCandle(tick.ltp);
    } else {
      // Update existing candle
      currentCandleRef.current = updateCandleWithTick(currentCandleRef.current, tick);
    }

  }, [ticks, symbol, intervalMinutes, isConnected, onNewCandleCreated]);

  // Canvas drawing loop using RAF
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    // Set canvas size accounting for device pixel ratio
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    let rafId;
    
    function draw() {
      // Clear canvas
      ctx.clearRect(0, 0, rect.width, rect.height);

      // Draw live candle if exists
      if (currentCandleRef.current && chartBounds && isConnected) {
        drawCandle(ctx, currentCandleRef.current, chartBounds, rect);
      }

      rafId = requestAnimationFrame(draw);
    }

    draw();

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [chartBounds, isConnected]);

  // Draw candle on canvas
  function drawCandle(ctx, candle, bounds, canvasRect) {
    const { open, high, low, close } = candle;
    
    // Calculate candle position (rightmost position)
    const candleWidth = bounds.candleWidth || 8;
    const xPos = canvasRect.width - candleWidth - 20; // 20px padding from right

    // Calculate Y positions based on price scale
    const priceRange = bounds.maxPrice - bounds.minPrice;
    const chartHeight = canvasRect.height - 40; // Leave space for padding
    
    const yOpen = chartHeight - ((open - bounds.minPrice) / priceRange) * chartHeight + 20;
    const yClose = chartHeight - ((close - bounds.minPrice) / priceRange) * chartHeight + 20;
    const yHigh = chartHeight - ((high - bounds.minPrice) / priceRange) * chartHeight + 20;
    const yLow = chartHeight - ((low - bounds.minPrice) / priceRange) * chartHeight + 20;

    // Determine color
    const color = getCandleColor(candle);
    
    // Draw wick (thin line from high to low)
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(xPos + candleWidth / 2, yHigh);
    ctx.lineTo(xPos + candleWidth / 2, yLow);
    ctx.stroke();

    // Draw body (rectangle from open to close)
    const bodyTop = Math.min(yOpen, yClose);
    const bodyHeight = Math.abs(yClose - yOpen) || 1; // Min 1px for doji
    
    ctx.fillStyle = color;
    ctx.fillRect(xPos, bodyTop, candleWidth, bodyHeight);

    // Add outline for better visibility
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.strokeRect(xPos, bodyTop, candleWidth, bodyHeight);
  }

  // Mouse/touch event handlers for tooltip
  const handlePointerMove = (e) => {
    if (!currentCandleRef.current || !isConnected) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check if hovering over live candle area (rightmost 50px)
    if (x > rect.width - 50) {
      setIsHovering(true);
      setTooltip({
        x: e.clientX,
        y: e.clientY,
        candle: currentCandleRef.current
      });
    } else {
      setIsHovering(false);
      setTooltip(null);
    }
  };

  const handlePointerLeave = () => {
    setIsHovering(false);
    setTooltip(null);
  };

  if (!lastHistoricalCandle || !chartBounds) return null;

  return (
    <>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-auto"
        style={{ 
          width: '100%', 
          height: '100%',
          cursor: isHovering ? 'crosshair' : 'default'
        }}
        onMouseMove={handlePointerMove}
        onMouseLeave={handlePointerLeave}
        onTouchStart={handlePointerMove}
        onTouchMove={handlePointerMove}
        onTouchEnd={handlePointerLeave}
      />

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg shadow-xl p-3 text-xs pointer-events-none"
          style={{
            left: tooltip.x + 15,
            top: tooltip.y - 60,
            minWidth: '150px'
          }}
        >
          <div className="space-y-1">
            <div className="flex justify-between gap-4">
              <span className="text-[var(--text-secondary)]">Open:</span>
              <span className="text-[var(--text-primary)] font-medium">{tooltip.candle.open.toFixed(2)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-[var(--text-secondary)]">High:</span>
              <span className="text-green-400 font-medium">{tooltip.candle.high.toFixed(2)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-[var(--text-secondary)]">Low:</span>
              <span className="text-red-400 font-medium">{tooltip.candle.low.toFixed(2)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-[var(--text-secondary)]">Close:</span>
              <span className="text-[var(--text-primary)] font-medium">{tooltip.candle.close.toFixed(2)}</span>
            </div>
            {tooltip.candle.volume > 0 && (
              <div className="flex justify-between gap-4 pt-1 border-t border-[var(--border-color)]">
                <span className="text-[var(--text-secondary)]">Volume:</span>
                <span className="text-indigo-400 font-medium">{formatVolume(tooltip.candle.volume)}</span>
              </div>
            )}
            <div className="mt-2 pt-2 border-t border-[var(--border-color)]">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                <span className="text-green-400 text-[10px] font-semibold">LIVE</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default LiveCandleOverlay;
