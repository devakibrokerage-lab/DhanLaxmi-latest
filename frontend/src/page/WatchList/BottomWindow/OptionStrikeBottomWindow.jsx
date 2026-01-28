import React, { useState, useMemo, useRef, useEffect } from 'react';
import { X, ShoppingCart, DollarSign, Hash } from 'lucide-react';
import { logMarketStatus } from '../../../Utils/marketStatus.js'
import { getFundsData } from '../../../Utils/fetchFund.jsx';
import { useMarketData } from '../../../contexts/MarketDataContext';

const OptionStrikeBottomWindow = ({
    isOpen,
    onClose,
    optionType,          // 'CE' | 'PE'
    strikePrice,         // Number
    instrumentToken,     // String (instrument token)
    underlyingStock,     // Object (Parent Info)
    spotPrice,           // Number
    expiry,              // String
}) => {
    // --- Market Data Context ---
    const { subscribe, unsubscribe, ticksRef } = useMarketData();

    // --- Local States ---
    const [actionTab, setActionTab] = useState('Buy');
    const [productType, setProductType] = useState('Intraday');
    const [localLotsStr, setLocalLotsStr] = useState('1');
    const [jobbin_price, setJobbin_price] = useState("0.08");

    const [submitting, setSubmitting] = useState(false);
    const [feedback, setFeedback] = useState(null);
    const [dataUpdateTrigger, setDataUpdateTrigger] = useState(0); // To trigger re-renders on data updates
    const inputRef = useRef(null);

    // --- Context & Role ---
    const isMarketOpen = logMarketStatus(underlyingStock?.segment);
    const userString = localStorage.getItem('loggedInUser');
    const userObject = userString ? JSON.parse(userString) : {};
    const userRole = userObject.role;

    // Get live data from ticksRef
    const liveData = useMemo(() => {
        if (!instrumentToken || !ticksRef.current) return null;
        return ticksRef.current.get(String(instrumentToken)) || null;
    }, [instrumentToken, ticksRef, dataUpdateTrigger]);

    // Get live data from ticksRef (full data when window is open)
    const liveDataFull = useMemo(() => {
        if (!instrumentToken || !ticksRef.current) return null;
        return ticksRef.current.get(String(instrumentToken)) || null;
    }, [instrumentToken, ticksRef, dataUpdateTrigger]);

    // --- Derived Values ---
    const ltp = liveDataFull?.ltp || liveData?.ltp || 0;
    const bestBid = liveDataFull?.bestBidPrice || liveData?.bestBidPrice || 0;
    const bestAsk = liveDataFull?.bestAskPrice || liveData?.bestAskPrice || 0;

    // Lot Size
    const lotSize = underlyingStock?.lot_size || underlyingStock?.lotSize || 50;

    // Reset on Open
    useEffect(() => {
        if (isOpen) {
            setLocalLotsStr('1');
            setFeedback(null);
            setActionTab('Buy');
            setProductType('Intraday');
        }
    }, [isOpen, strikePrice, optionType]);

    // Subscribe to full market data when window opens
    useEffect(() => {
        if (isOpen && instrumentToken) {
            // Subscribe to full market data for this instrument
            subscribe([{ instrument_token: instrumentToken }], 'full');
        }

        // Unsubscribe when window closes
        return () => {
            if (instrumentToken) {
                unsubscribe([{ instrument_token: instrumentToken }], 'full');
            }
        };
    }, [isOpen, instrumentToken, subscribe, unsubscribe]);

    // Trigger re-renders when tick data updates
    useEffect(() => {
        let interval;
        if (isOpen) {
            // When window is open, check for updates more frequently
            interval = setInterval(() => {
                setDataUpdateTrigger(prev => prev + 1);
            }, 100); // Update every 100ms for smooth UI updates
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [isOpen]);

    // --- Calculations ---
    const lotsNum = useMemo(() => {
        const n = Number(localLotsStr);
        return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
    }, [localLotsStr]);

    const qtyNum = useMemo(() => {
        return lotsNum * lotSize;
    }, [lotsNum, lotSize]);

    const jobbinPct = useMemo(() => {
        const v = parseFloat(String(jobbin_price).trim());
        return Number.isFinite(v) ? v / 100 : 0;
    }, [jobbin_price]);

    const { adjustedPricePerShare } = useMemo(() => {
        if (!ltp) return { adjustedPricePerShare: 0 };
        const perShareFactor = actionTab === 'Buy' ? (1 + jobbinPct) : (1 - jobbinPct);
        const pxRaw = ltp * perShareFactor;
        return { adjustedPricePerShare: Number(pxRaw.toFixed(4)) };
    }, [ltp, actionTab, jobbinPct]);

    const totalOrderValue = useMemo(() => {
        if (!adjustedPricePerShare || !qtyNum) return 0;
        return Number((adjustedPricePerShare * qtyNum).toFixed(2));
    }, [adjustedPricePerShare, qtyNum]);

    if (!isOpen) return null;

    // --- Name Construction ---
    // For Option Chain orders, use underlying_symbol (clean base name like "HDFCBANK", "NIFTY")
    // This prevents names like "HDFCBANK 30 DEC 870 CALL 30 DEC 985 CALL"
    const getInstrumentName = () => {
        // Priority: underlying_symbol (clean base name) > symbol_name > symbol > tradingSymbol
        const symbol = underlyingStock?.underlying_symbol
            || underlyingStock?.symbol_name
            || underlyingStock?.name
            || underlyingStock?.symbol
            || "UNKNOWN";

        let expiryStr = "";
        if (expiry) {
            try {
                const d = new Date(expiry);
                const day = String(d.getDate()).padStart(2, '0');
                const month = d.toLocaleString('default', { month: 'short' }).toUpperCase();
                expiryStr = `${day} ${month}`;
            } catch (e) { }
        }
        const typeStr = (optionType === 'CE' || optionType === 'CALL') ? 'CALL' : 'PUT';
        return `${symbol} ${expiryStr} ${strikePrice} ${typeStr}`.trim();
    };
    const instrumentName = getInstrumentName();

    const formatExpiryFull = (dateStr) => {
        if (!dateStr) return '';
        try {
            const date = new Date(dateStr);
            return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
        } catch (e) { return dateStr; }
    };

    const handleInputChange = (e) => {
        setLocalLotsStr(e.target.value);
        setFeedback(null);
    };

    // --- CONFIRM ORDER HANDLER ---
    const handleConfirm = async () => {
        setSubmitting(true);
        setFeedback(null);

        const apiBase = import.meta.env.VITE_REACT_APP_API_URL || "";

        try {
            // 1. Input Validation
            if (!lotsNum || lotsNum < 1) {
                setFeedback({ type: 'error', message: 'Please enter a valid lot count.' });
                setSubmitting(false);
                return;
            }

            // ============================================================
            // 🔥 FIX: LOOKUP CORRECT OPTION INSTRUMENT TOKEN FROM INSTRUMENTS
            // The option chain API returns instrument_token for Kite
            // ============================================================
            let finalInstrumentToken = String(
                instrumentToken ||
                ''
            );

            // If strikeData doesn't have instrument_token, look it up from instruments
            if (!finalInstrumentToken && strikePrice && optionType && expiry) {
                try {
                    const underlyingSymbol = underlyingStock?.underlying_symbol
                        || underlyingStock?.symbol_name
                        || underlyingStock?.name
                        || '';

                    const lookupParams = new URLSearchParams({
                        name: underlyingSymbol,
                        strike: strikePrice,
                        optionType: optionType === 'CE' || optionType === 'CALL' ? 'CE' : 'PE',
                        expiry: expiry
                    });

                    console.log('[OptionOrder] Looking up instrument token:', lookupParams.toString());

                    const lookupRes = await fetch(`${apiBase}/api/option-chain/security-id?${lookupParams.toString()}`);

                    if (lookupRes.ok) {
                        const lookupData = await lookupRes.json();
                        // API returns instrument_token (Kite format)
                        if (lookupData.data?.instrument_token) {
                            finalInstrumentToken = String(lookupData.data.instrument_token);
                            console.log('[OptionOrder] Found instrument token:', finalInstrumentToken);
                        }
                    }
                } catch (lookupErr) {
                    console.warn('[OptionOrder] Instrument token lookup failed:', lookupErr);
                }
            }

            // Last resort fallback to parent's instrument_token
            if (!finalInstrumentToken) {
                finalInstrumentToken = String(
                    underlyingStock?.instrument_token ||
                    ''
                );
                console.warn('[OptionOrder] Using parent instrument token as fallback:', finalInstrumentToken);
            }

            if (!finalInstrumentToken) {
                setFeedback({ type: 'error', message: "Instrument token missing. Check console." });
                console.error("Data Missing for instrument_token:", { instrumentToken, underlyingStock });
                setSubmitting(false);
                return;
            }

            // 2. Fund Validation
            try {
                const fundsData = await getFundsData();
                if (!fundsData) throw new Error("Unable to fetch wallet balance.");

                const requiredAmount = Number(totalOrderValue);
                let availableLimit = 0;
                let limitType = "";

                if (productType === 'Intraday') {
                    const max = fundsData.intraday?.available_limit || 0;
                    const used = fundsData.intraday?.used_limit || 0;
                    availableLimit = max - used;
                    limitType = "Intraday";
                } else {
                    availableLimit = fundsData.overnight?.available_limit || 0;
                    limitType = "Overnight";
                }

                if (requiredAmount > availableLimit) {
                    setFeedback({
                        type: 'error',
                        message: `Insufficient ${limitType} Funds! Required: ₹${requiredAmount.toFixed(2)}, Available: ₹${availableLimit.toFixed(2)}. Add funds.`
                    });
                    setSubmitting(false);
                    return;
                }
            } catch (fundErr) {
                setFeedback({ type: 'error', message: "Fund validation failed. Try again." });
                setSubmitting(false);
                return;
            }

            const activeContextString = localStorage.getItem('activeContext');
            const activeContext = activeContextString ? JSON.parse(activeContextString) : null;
            const brokerId = activeContext?.brokerId || '';
            const customerId = activeContext?.customerId || '';

            const side = actionTab === 'Buy' ? 'BUY' : 'SELL';
            const product = productType === 'Intraday' ? 'MIS' : 'NRML';
            const finalPrice = adjustedPricePerShare || ltp;

            const payload = {
                broker_id_str: brokerId,
                customer_id_str: customerId,
                instrument_token: finalInstrumentToken,
                symbol: instrumentName,
                segment: underlyingStock?.segment || 'NFO-OPT',
                side,
                product,
                price: Number(finalPrice),
                quantity: qtyNum,
                lots: lotsNum,
                lot_size: lotSize,
                jobbin_price: jobbin_price === '' ? 0 : Number(jobbin_price),
                order_status: "OPEN",
                came_From: 'Open', // Explicitly set origin
                meta: {
                    from: 'ui_option_chain',
                    underlying: underlyingStock?.name,
                    expiry: expiry,
                    spotPrice: spotPrice,
                    strike: strikePrice,
                    optionType: optionType
                },
                placed_at: new Date()
            };

            console.log('Option Order Payload:', payload);

            const res = await fetch(`${apiBase}/api/orders/postOrder`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            let body = null;
            try { body = await res.json(); } catch (e) { body = null; }

            if (!res.ok || (body && body.success === false)) {
                const message = body?.error || body?.message || `Server responded with ${res.status}`;
                throw new Error(message);
            }

            setFeedback({ type: 'success', message: 'Order placed successfully!' });
            setTimeout(() => { onClose(); }, 1500);

        } catch (err) {
            console.error('Option Order failed:', err);
            setFeedback({ type: 'error', message: `Order failed: ${String(err.message || err)}` });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[120] bg-black/60 flex items-end justify-center sm:items-center animate-in fade-in duration-200">
            {/* Main Window Container - Matches BottomWindow style */}
            <div className="bg-[var(--bg-card)] w-full h-full sm:h-auto sm:max-w-md sm:rounded-xl flex flex-col shadow-2xl relative overflow-hidden animate-slide-up">

                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b border-[var(--border-color)] bg-[var(--bg-card)]">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                        <button onClick={onClose} className="p-1 -ml-1 rounded-full hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition flex-shrink-0">
                            <X className="w-5 h-5" />
                        </button>
                        <div className="min-w-0">
                            <h2 className="text-[var(--text-primary)] font-bold text-base sm:text-lg truncate">{instrumentName}</h2>
                            <p className="text-[var(--text-secondary)] text-xs truncate">{formatExpiryFull(expiry)}</p>
                        </div>
                    </div>
                </div>

                {/* Content Scroll Area */}
                <div className="flex-grow overflow-y-auto p-4 content-area">

                    {/* CMP Section - Matches Summary.jsx */}
                    <div className="mb-6 mt-1">
                        <p className="text-xl font-bold">
                            <span className="text-[var(--text-secondary)] mr-1">₹</span>
                            <span className={
                                (ltp - (underlyingStock?.close || 0)) >= 0
                                    ? "text-green-500"
                                    : "text-red-500"
                            }>
                                {ltp ? Number(ltp).toFixed(2) : '—'}
                            </span>
                            {/* Optional: Add percentage change if available in future */}
                        </p>
                        <p className="text-xs text-[var(--text-muted)] mt-1">Current Market Price (CMP)</p>
                    </div>

                    {/* Buy/Sell Toggle: Hide Sell for Customers (All items here are Options) */}
                    <div className="flex space-x-4 mb-6">
                        <button
                            className={`flex-1 p-2 rounded-lg text-xs font-semibold transition ${actionTab === 'Buy' ? 'bg-green-600 text-white shadow-lg' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                            onClick={() => setActionTab('Buy')}
                        >
                            BUY
                        </button>
                        {userRole !== 'customer' && (
                            <button
                                className={`flex-1 p-2 rounded-lg text-xs font-semibold transition ${actionTab === 'Sell' ? 'bg-red-600 text-white shadow-lg' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                                onClick={() => setActionTab('Sell')}
                            >
                                SELL
                            </button>
                        )}
                    </div>

                    {/* Product Type */}
                    <h4 className="text-xs font-semibold mb-3 text-[var(--text-secondary)] uppercase tracking-wider">Product Order</h4>
                    <div className="flex space-x-4 mb-6">
                        <button
                            className={`flex-1 p-2 rounded-lg text-xs font-semibold transition ${productType === 'Intraday' ? (actionTab === 'Buy' ? 'bg-green-600 text-white shadow-lg' : 'bg-red-600 text-white shadow-lg') : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                            onClick={() => setProductType('Intraday')}
                        >
                            INTRADAY
                        </button>
                        <button
                            className={`flex-1 p-2 rounded-lg text-xs font-semibold transition ${productType === 'Overnight' ? (actionTab === 'Buy' ? 'bg-green-600 text-white shadow-lg' : 'bg-red-600 text-white shadow-lg') : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                            onClick={() => setProductType('Overnight')}
                        >
                            OVERNIGHT
                        </button>
                    </div>

                    {/* Inputs Container */}
                    <div className="p-3 bg-[var(--bg-secondary)] rounded-lg mb-4">
                        <div className="space-y-3">

                            {/* Quantity (Lots) Input - Floating Label Style */}
                            <div className="relative mt-4">
                                <input
                                    ref={inputRef}
                                    type="number"
                                    value={localLotsStr}
                                    onChange={handleInputChange}
                                    placeholder=" "
                                    className="peer w-full p-3 bg-transparent text-[var(--text-primary)] rounded-md border border-[var(--border-color)] outline-none focus:border-indigo-500 transition-colors"
                                    min="1"
                                />
                                <label className="absolute left-3 -top-2.5 bg-[var(--bg-secondary)] px-1 text-xs peer-focus:text-indigo-500 peer-focus:scale-100 peer-placeholder-shown:scale-100 transition-all leading-none text-[var(--text-secondary)]">
                                    Lot <span className="text-[10px]">(Lot Size: {lotSize})</span>
                                </label>
                                <div className="absolute right-3 top-3 text-xs text-[var(--text-muted)] pointer-events-none">
                                    Qty: {qtyNum}
                                </div>
                            </div>

                            {/* Jobbing % (Broker Only) */}
                            {userRole === 'broker' && (
                                <div className="relative mt-5">
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        placeholder=" "
                                        value={jobbin_price}
                                        onChange={(e) => setJobbin_price(e.target.value)}
                                        className="peer w-full p-3 bg-transparent text-[var(--text-primary)] rounded-md border border-[var(--border-color)] outline-none focus:border-indigo-500 transition-colors"
                                    />
                                    <label className="absolute left-3 -top-2.5 bg-[var(--bg-secondary)] px-1 text-xs peer-focus:text-indigo-500 transition-all leading-none text-[var(--text-secondary)]">
                                        Jobbing %
                                    </label>
                                    <div className="absolute right-3 top-3 text-xs text-[var(--text-muted)] pointer-events-none">
                                        {jobbin_price || '0'}%
                                    </div>
                                </div>
                            )}

                            {/* Price Summary */}
                            <div className="text-sm bg-[var(--bg-input)] rounded-md p-4 flex flex-col border border-[var(--border-color)] mt-6 mb-2 gap-2">
                                {userRole === 'broker' && (
                                    <div className="flex justify-between">
                                        <span className="text-[var(--text-secondary)]">Price / share (Jobbing applied)</span>
                                        <span className="text-[var(--text-primary)] font-semibold">{adjustedPricePerShare ? `₹${adjustedPricePerShare.toFixed(4)}` : '—'}</span>
                                    </div>
                                )}
                                <div className="flex justify-between">
                                    <span className="text-[var(--text-secondary)]">Total Order Value</span>
                                    <span className="text-[var(--text-primary)] font-semibold">{totalOrderValue ? `₹${totalOrderValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}</span>
                                </div>
                            </div>

                            {/* Feedback */}
                            {feedback && (
                                <div className={`p-2 rounded-md text-sm text-center ${feedback.type === 'error' ? 'bg-red-500/20 text-red-500' : 'bg-green-500/20 text-green-500'}`}>
                                    {feedback.message}
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="flex space-x-2 pt-2">
                                {(userRole === 'broker' || isMarketOpen) && (
                                    <button
                                        onClick={handleConfirm}
                                        disabled={submitting || !lotsNum}
                                        className={`flex-1 p-4 rounded-lg text-white font-bold text-lg shadow-md transition-transform active:scale-95 ${actionTab === 'Buy' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'} ${(submitting || !lotsNum) ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        {submitting ? 'Placing...' : `INSTANT ${actionTab.toUpperCase()}`}
                                    </button>
                                )}
                                <button
                                    onClick={onClose}
                                    className="p-3 rounded-lg bg-[var(--bg-primary)] text-[var(--text-secondary)] font-medium hover:bg-[var(--bg-hover)]"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <style>{`
                @keyframes slide-up {
                    from { transform: translateY(100%); }
                    to { transform: translateY(0); }
                }
                .animate-slide-up { animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
            `}</style>
        </div>
    );
};

export default OptionStrikeBottomWindow;