// Market Depth View - 5 Level Order Book
import React from 'react';
import { Layers } from 'lucide-react';

// Single row component for order book
const DepthRow = ({ price, quantity, orders, type, maxQty }) => {
    const isBuy = type === 'buy';
    const barWidth = maxQty > 0 ? (quantity / maxQty) * 100 : 0;

    return (
        <div className="relative flex items-center text-xs py-1 hover:bg-[var(--bg-hover)] transition-colors">
            {/* Background bar showing volume */}
            <div 
                className={`absolute h-full ${isBuy ? 'bg-green-500/20 right-0' : 'bg-red-500/20 left-0'}`} 
                style={{ width: `${barWidth}%` }}
            />
            
            {/* Content */}
            <div className="relative z-10 flex w-full items-center px-2 font-mono">
                {/* BUY SIDE - Left aligned */}
                {isBuy ? (
                    <>
                        <span className="w-1/4 text-[var(--text-secondary)]">{orders}</span>
                        <span className="w-1/4 text-right text-[var(--text-primary)] font-medium">{quantity.toLocaleString()}</span>
                        <span className="w-1/2 text-right text-green-400 font-semibold">{Number(price).toFixed(2)}</span>
                    </>
                ) : (
                    <>
                        <span className="w-1/2 text-left text-red-400 font-semibold">{Number(price).toFixed(2)}</span>
                        <span className="w-1/4 text-left text-[var(--text-primary)] font-medium">{quantity.toLocaleString()}</span>
                        <span className="w-1/4 text-right text-[var(--text-secondary)]">{orders}</span>
                    </>
                )}
            </div>
        </div>
    );
};


function MarketDepthView({ stockName, sheetData }) {
    const depth = sheetData?.depth;
    const ltp = sheetData?.ltp;
    const bestBidPrice = sheetData?.bestBidPrice;
    const bestAskPrice = sheetData?.bestAskPrice;

    if (!depth || !depth.buy || !depth.sell) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-[var(--text-muted)] bg-[var(--bg-secondary)] rounded-lg">
                <Layers className="w-8 h-8 mb-2 opacity-50" />
                <p className="text-sm">Market Depth Not Available</p>
                <p className="text-xs text-[var(--text-muted)] mt-1">Subscribe to full data mode</p>
            </div>
        );
    }
    
    // Sort depth data - take only 5 levels
    const buyDepth = [...depth.buy]
        .sort((a, b) => b.price - a.price)
        .slice(0, 5);
    const sellDepth = [...depth.sell]
        .sort((a, b) => a.price - b.price)
        .slice(0, 5)
        .reverse(); // Reverse to show highest sell at bottom

    // Calculate max quantity for bar width scaling
    const allQuantities = [
        ...buyDepth.map(i => i.quantity), 
        ...sellDepth.map(i => i.quantity)
    ];
    const maxQty = Math.max(...allQuantities, 1);
    
    // Calculate totals
    const totalBuyQty = buyDepth.reduce((sum, item) => sum + item.quantity, 0);
    const totalSellQty = sellDepth.reduce((sum, item) => sum + item.quantity, 0);
    
    // Calculate spread
    const spread = bestAskPrice && bestBidPrice ? (bestAskPrice - bestBidPrice).toFixed(2) : '--';

    return (
        <div className="w-full h-full bg-[var(--bg-primary)] text-[var(--text-primary)] overflow-hidden">
            
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 bg-[var(--bg-secondary)] border-b border-[var(--border-color)]">
                <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-400" />
                    <span className="text-sm font-semibold">Market Depth</span>
                </div>
                <div className="text-xs text-[var(--text-secondary)]">
                    Top 5 Orders
                </div>
            </div>

            {/* Column Headers */}
            <div className="flex items-center px-2 py-1.5 bg-[var(--bg-secondary)] border-b border-[var(--border-color)] text-[10px] font-medium text-[var(--text-muted)]">
                <span className="w-1/4">Orders</span>
                <span className="w-1/4 text-right">Qty</span>
                <span className="w-1/2 text-right">Bid</span>
            </div>

            {/* BUY SIDE (5 levels) */}
            <div className="border-b border-[var(--border-color)]">
                {buyDepth.length > 0 ? (
                    buyDepth.map((item, index) => (
                        <DepthRow key={`b-${index}`} {...item} type="buy" maxQty={maxQty} />
                    ))
                ) : (
                    <div className="py-8 text-center text-[var(--text-muted)] text-xs">No buy orders</div>
                )}
            </div>

            {/* LTP / SPREAD Section */}
            <div className="flex items-center justify-between px-2 py-2 bg-[var(--bg-secondary)] border-y border-[var(--border-color)]">
                <div className="flex flex-col">
                    <span className="text-[10px] text-[var(--text-muted)]">LTP</span>
                    <span className="text-sm font-bold text-yellow-400">{ltp ? Number(ltp).toFixed(2) : '--'}</span>
                </div>
                <div className="flex flex-col items-end">
                    <span className="text-[10px] text-[var(--text-muted)]">Spread</span>
                    <span className="text-sm font-semibold text-[var(--text-secondary)]">{spread}</span>
                </div>
            </div>

            {/* Column Headers for SELL */}
            <div className="flex items-center px-2 py-1.5 bg-[var(--bg-secondary)] border-b border-[var(--border-color)] text-[10px] font-medium text-[var(--text-muted)]">
                <span className="w-1/2">Ask</span>
                <span className="w-1/4 text-left">Qty</span>
                <span className="w-1/4 text-right">Orders</span>
            </div>

            {/* SELL SIDE (5 levels) */}
            <div className="border-b border-[var(--border-color)]">
                {sellDepth.length > 0 ? (
                    sellDepth.map((item, index) => (
                        <DepthRow key={`s-${index}`} {...item} type="sell" maxQty={maxQty} />
                    ))
                ) : (
                    <div className="py-8 text-center text-[var(--text-muted)] text-xs">No sell orders</div>
                )}
            </div>
            
            {/* Footer Summary */}
            <div className="px-3 py-2 bg-[var(--bg-secondary)] border-t border-[var(--border-color)]">
                <div className="flex justify-between text-xs mb-1">
                    <span className="text-[var(--text-muted)]">Total Bid Qty:</span>
                    <span className="text-green-400 font-semibold">{totalBuyQty.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs">
                    <span className="text-[var(--text-muted)]">Total Ask Qty:</span>
                    <span className="text-red-400 font-semibold">{totalSellQty.toLocaleString()}</span>
                </div>
            </div>

        </div>
    );
}

export default MarketDepthView;