import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X,
  ChevronDown,
  ChevronUp,
  ShoppingCart,
  Tag,
  TrendingUp,
  Trash2,
  ArrowLeft
} from 'lucide-react';

import SummaryView from './Summery';
import MarketDepthView from './marketDepth';
import OptionChainFullscreen from './OptionChainFullscreen';

function BottomWindow({
  selectedStock,
  sheetData,
  actionTab,
  setActionTab,
  quantity,
  setQuantity,
  orderPrice,
  setOrderPrice,
  setSelectedStock,
  onAddToWatchlist,
  onRemoveFromWatchlist,
  subscriptionType = 'full',
  ticksRef,
}) {

  // viewMode: 'Menu' | 'Order'
  const [viewMode, setViewMode] = useState('Menu');
  const [productType, setProductType] = useState('Intraday');
  const [isDepthExpanded, setIsDepthExpanded] = useState(false);

  // Reset state when stock changes
  useEffect(() => {
    setViewMode('Menu');
    setIsDepthExpanded(false);
  }, [selectedStock]);

  const navigate = useNavigate();

  const apiBase = import.meta.env.VITE_REACT_APP_API_URL || "";

  // Helper: Place fake order (same verification logic as original if needed, 
  // currently SummaryView handles real orders. This fake order might be legacy or specific debug)
  const placeFakeOrder = async () => {
    if (!selectedStock || quantity <= 0 || !orderPrice) return;

    const payload = {
      symbol: selectedStock.tradingSymbol,
      name: selectedStock.name,
      action: actionTab,
      quantity: Number(quantity),
      price: Number(orderPrice),
      timestamp: new Date().toISOString(),
      fake: true,
    };

    try {
      const res = await fetch(`${apiBase}/api/fake-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to save fake order');

      alert(`${actionTab} order saved (fake) for ${selectedStock.name}`);
      setSelectedStock(null);
    } catch (err) {
      console.error('placeFakeOrder error:', err);
      alert('Could not save order. Check console.');
    }
  };

  if (!selectedStock) return null;

  // --- Handlers ---

  const handleBuy = () => {
    setActionTab('Buy');
    setViewMode('Order');
  };

  const handleSell = () => {
    setActionTab('Sell');
    setViewMode('Order');
  };

  const handleDelete = () => {
    if (onRemoveFromWatchlist) {
      onRemoveFromWatchlist(selectedStock);
      setSelectedStock(null); // Close window after delete
    } else {
      // Fallback if prop not provided (though it should be for watchlist)
      console.warn("Delete handler not provided");
      setSelectedStock(null);
    }
  };

  const handleBackToMenu = () => {
    setViewMode('Menu');
  };

  // --- Renderers ---

  const renderOrderView = () => {
    const commonProps = { selectedStock, sheetData };
    const summaryProps = {
      actionTab,
      setActionTab,
      quantity,
      setQuantity,
      orderPrice,
      setOrderPrice,
      placeFakeOrder,
      setSelectedStock, // Passing this lets Summary close the window if needed
      productType,
      setProductType,
      ticksRef,
    };

    return (
      <div className="flex flex-col h-full items-center justify-center bg-[var(--bg-card)]">
        <div className="w-full max-w-2xl h-full overflow-y-auto">
          <SummaryView {...commonProps} {...summaryProps} />
        </div>
      </div>
    );
  };

  const renderDepthView = () => {
    return (
      <div className="flex flex-col h-full bg-[var(--bg-card)] items-center pt-10">
        <div className="w-full max-w-4xl h-full px-4">
          <MarketDepthView
            stockName={selectedStock.name}
            sheetData={sheetData}
          />
        </div>
      </div>
    );
  };

  const renderOptionChainView = () => {
    return (
      <div className="w-full h-full bg-[var(--bg-card)]">
        <OptionChainFullscreen
          selectedStock={selectedStock}
          sheetData={sheetData}
          onClose={() => setViewMode('Menu')}
        />
      </div>
    );
  };

  const renderMenu = () => {

    const hasOptionChain = true; // Placeholder logic, refined by backend data usually

    const userString = localStorage.getItem('loggedInUser');
    const userRole = userString ? JSON.parse(userString).role : '';
    const isCustomer = userRole === 'customer';
    // Helper to identify F&O
    const isFnO = selectedStock?.segment?.includes('FUT') || selectedStock?.segment?.includes('OPT') || selectedStock?.instrument_type === 'FUT' || selectedStock?.instrument_type === 'CE' || selectedStock?.instrument_type === 'PE';

    return (
      <div className="flex flex-col py-2">
        {/* Market Depth - Navigates to new view now */}
        <button
          onClick={() => setViewMode('MarketDepth')}
          className="w-full flex items-center justify-between p-4 hover:bg-[var(--bg-secondary)]/50 transition border-b border-[var(--border-color)]/50"
        >
          <div className="flex items-center gap-3">
            {/* Using Layers icon instead of Chevron for consistency with menu items */}
            <div className="text-[var(--text-secondary)]">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-layers"><path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" /><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" /><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" /></svg>
            </div>
            <span className="text-[var(--text-primary)] font-medium">Market Depth</span>
          </div>
        </button>

        {/* Buy */}
        <button
          onClick={handleBuy}
          className="w-full flex items-center gap-3 p-4 hover:bg-[var(--bg-secondary)]/50 transition text-left"
        >
          <ShoppingCart className="w-5 h-5 text-[var(--text-secondary)]" />
          <span className="text-[var(--text-primary)] font-semibold">Buy</span>
        </button>

        {/* Sell - Hide for Customers in F&O */}
        {!(isCustomer && isFnO) && (
          <button
            onClick={handleSell}
            className="w-full flex items-center gap-3 p-4 hover:bg-[var(--bg-secondary)]/50 transition text-left"
          >
            <Tag className="w-5 h-5 text-[var(--text-secondary)]" />
            <span className="text-[var(--text-primary)] font-semibold">Sell</span>
          </button>
        )}

        {/* Option Chain + Charts */}
        {hasOptionChain && (
          <button
            onClick={() => setViewMode('OptionChain')}
            className="w-full flex items-center gap-3 p-4 hover:bg-[var(--bg-secondary)]/50 transition text-left"
          >
            <TrendingUp className="w-5 h-5 text-indigo-500" />
            <span className="text-indigo-500 font-semibold">Option Chain + Charts</span>
          </button>
        )}

        {/* Delete */}
        <button
          onClick={handleDelete}
          className="w-full flex items-center gap-3 p-4 hover:bg-[var(--bg-secondary)]/50 transition text-left border-t border-[var(--border-color)]/50 mt-2"
        >
          <Trash2 className="w-5 h-5 text-[var(--text-secondary)]" />
          <span className="text-[var(--text-primary)] font-semibold">Delete</span>
        </button>

      </div>
    );
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 z-40 transition-opacity"
        onClick={() => setSelectedStock(null)}
      ></div>

      {/* Bottom Sheet Window */}
      <div
        className={`fixed bg-[var(--bg-card)] shadow-2xl z-50 overflow-hidden flex flex-col ring-1 ring-white/10 transition-all duration-300 ${viewMode === 'Menu'
          ? 'bottom-0 left-0 right-0 rounded-t-xl md:left-auto md:right-4 md:bottom-4 md:rounded-xl md:max-w-sm max-h-[90vh]'
          : 'inset-0 w-full h-full rounded-none'
          }`}
      >

        {/* Header - Always Visible */}
        <div className="flex justify-between items-center p-4 border-b border-[var(--border-color)] bg-[var(--bg-card)]">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {(viewMode === 'Order' || viewMode === 'MarketDepth' || viewMode === 'OptionChain') && (
              <button
                onClick={handleBackToMenu}
                className="p-1 -ml-1 rounded-full hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition flex-shrink-0"
                title="Back"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <h3 className="text-[var(--text-primary)] text-base sm:text-lg font-bold truncate">
              {selectedStock.tradingSymbol || selectedStock.name}
            </h3>
            {/* Optional: Show LTP/Change here too? */}
          </div>

          <div className="flex items-center gap-1">
            <button
              className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition p-1 rounded-full hover:bg-[var(--bg-secondary)] flex-shrink-0"
              onClick={() => setSelectedStock(null)}
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-grow overflow-y-auto">
          {viewMode === 'Menu' ? renderMenu() :
            viewMode === 'MarketDepth' ? renderDepthView() :
              viewMode === 'OptionChain' ? renderOptionChainView() :
                renderOrderView()}
        </div>
      </div>
    </>
  );
}

export default BottomWindow;
