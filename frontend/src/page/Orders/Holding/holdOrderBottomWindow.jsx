import React, { useState, useEffect } from 'react';
import { ShoppingCart, DollarSign, Hash, Zap, XCircle, Clock, Target, AlertCircle } from 'lucide-react';
import { getFundsData } from '../../../Utils/fetchFund.jsx';
import { logMarketStatus } from '../../../Utils/marketStatus.js';
import { calculatePnLAndBrokerage } from '../../../Utils/calculateBrokerage.jsx';

const money = (n) => `₹${Number(n ?? 0).toFixed(2)}`;

// Entry side brokerage 0.01%
const ENTRY_BROKERAGE_PERCENT = 0.01;

const DetailRow = ({ Icon, label, value, colorClass }) => {
    return (
        <div className="flex justify-between items-center py-0.5 px-2">
            <div className="flex items-center text-[var(--text-secondary)]">
                {Icon && <Icon className="w-3 h-3 mr-2" />}
                <span className="text-xs">{label}</span>
            </div>
            <span className={`text-sm font-medium ${colorClass || "text-[var(--text-primary)]"}`}>
                {value}
            </span>
        </div>
    );
};

export default function HoldOrderBottomWindow({ selectedOrder, onClose, sheetData }) {

    if (!selectedOrder) return null;
    const isOpen = logMarketStatus();

    const userString = localStorage.getItem('loggedInUser');
    const userObject = userString ? JSON.parse(userString) : {};
    const userRole = userObject.role;

    // expiry display
    // For option chain orders, expiry is in meta.expiry
    // For regular orders, expiry is in meta.selectedStock.expiry
    const expireDate = selectedOrder.meta?.expiry || selectedOrder.meta?.selectedStock?.expiry;
    const formattedStockExpireDate = expireDate ?
        new Date(expireDate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
        : 'N/A';

    const {
        symbol, side, product, quantity: initialQty, price: initialPrice, jobbin_price,
        instrument_token, segment, _id: orderId, lots, lot_size, stop_loss, target
    } = selectedOrder;

    const currentLotSize = lot_size || selectedOrder.meta?.selectedStock?.lot_size || 1;
    const tradingsymbol = selectedOrder.meta?.selectedStock?.tradingSymbol ?? symbol ?? "N/A";
    const orderSide = String(side ?? "").toUpperCase();

    // ---- PRICE / QTY / P&L WITH BROKERAGE ----
    // Avg: prefer average_price if available
    const avg = Number(
        selectedOrder.average_price ?? initialPrice ?? 0
    );
    const qty = Number(initialQty ?? 0);

    // live LTP (sheetData) fallback avg
    const ltp = Number(sheetData?.ltp ?? avg);
    const currentPrice = ltp;
    const formattedCMP = currentPrice ? `₹${currentPrice.toFixed(2)}` : '—';

    // helper se sab calculate
    const {
        grossPnl,
        netPnl,
        pct,
        brokerageEntry,
    } = calculatePnLAndBrokerage({
        side: orderSide,
        avgPrice: avg,
        ltp: currentPrice,
        qty,
        brokeragePercentPerSide: ENTRY_BROKERAGE_PERCENT,
        mode: "entry-only",
    });

    const profit = netPnl >= 0;
    const pnlChipBg = profit ? "bg-[var(--gain-chip-bg)]" : "bg-[var(--loss-chip-bg)]";
    const pnlTextColor = profit ? "text-[var(--gain-text)]" : "text-[var(--loss-text)]";

    const isBuy = orderSide === 'BUY';
    const adjustActionColor = 'bg-indigo-600';
    const closeActionColor = 'bg-[var(--bg-secondary)] border border-[var(--border-color)] hover:bg-[var(--bg-hover)]';

    // --- STATES ---
    const [addLotInput, setAddLotInput] = useState('');

    // SL & Target
    const [slPrice, setSlPrice] = useState(selectedOrder.stop_loss || '');
    const [targetPrice, setTargetPrice] = useState(selectedOrder.target || '');

    const [submitting, setSubmitting] = useState(false);
    const [action, setAction] = useState('Adjust');
    const [feedback, setFeedback] = useState(null);

    const apiBase = import.meta.env.VITE_REACT_APP_API_URL || "";
    const token = localStorage.getItem("token") || null;
    const activeContextString = localStorage.getItem('activeContext');
    const activeContext = activeContextString ? JSON.parse(activeContextString) : {};
    const brokerId = activeContext.brokerId;
    const customerId = activeContext.customerId;

    useEffect(() => {
        setAddLotInput('');
        setSlPrice(selectedOrder.stop_loss || '');
        setTargetPrice(selectedOrder.target || '');
        setFeedback(null);
        setAction('Adjust');
    }, [selectedOrder]);

    // --- ADD LOT CALCULATION ---
    const currentLots = Number(lots ?? 0);
    const parsedAddLots = Math.max(0, parseInt(String(addLotInput).trim() || '0', 10));

    const targetTotalLots = currentLots + parsedAddLots;
    const targetTotalQuantity = targetTotalLots * Number(currentLotSize || 1);

    // Weighted Avg Price
    let computedAvg = avg || 0;
    if (parsedAddLots > 0) {
        const totalExisting = avg * qty;
        const totalNew = currentPrice * (parsedAddLots * currentLotSize);
        computedAvg = (totalExisting + totalNew) / targetTotalQuantity;
    }
    const displayComputedAvg = `₹${Number(computedAvg || 0).toFixed(2)}`;


    // --- ACTION HANDLER ---
    const handleAction = async (intendedAction) => {
        setSubmitting(true);
        setFeedback(null);
        setAction(intendedAction);

        try {
            // Validation & Fund Check for "BUY MORE"
            if (intendedAction === 'Adjust') {

                const sl = Number(slPrice) || 0;
                const tgt = Number(targetPrice) || 0;

                // --- 1. STOP LOSS & TARGET VALIDATION (Real Market Rules) ---
                if (currentPrice > 0) {
                    if (orderSide === 'BUY') {
                        // [BUY RULE]: SL must be LOWER than Current Price
                        if (sl > 0 && sl >= currentPrice) {
                            setFeedback({ type: 'error', message: `Invalid SL: For BUY, SL must be lower than CMP (${currentPrice})` });
                            setSubmitting(false); return;
                        }
                        // [BUY RULE]: Target must be HIGHER than Current Price
                        if (tgt > 0 && tgt <= currentPrice) {
                            setFeedback({ type: 'error', message: `Invalid Target: For BUY, Target must be higher than CMP (${currentPrice})` });
                            setSubmitting(false); return;
                        }
                    } else {
                        // [SELL RULE]: SL must be HIGHER than Current Price
                        if (sl > 0 && sl <= currentPrice) {
                            setFeedback({ type: 'error', message: `Invalid SL: For SELL, SL must be higher than CMP (${currentPrice})` });
                            setSubmitting(false); return;
                        }
                        // [SELL RULE]: Target must be LOWER than Current Price
                        if (tgt > 0 && tgt >= currentPrice) {
                            setFeedback({ type: 'error', message: `Invalid Target: For SELL, Target must be lower than CMP (${currentPrice})` });
                            setSubmitting(false); return;
                        }
                    }
                }

                // --- 2. FUND CHECK FOR ADDING LOTS ---
                if (parsedAddLots > 0) {
                    try {
                        const fundsData = await getFundsData();
                        if (!fundsData) throw new Error("Unable to fetch wallet balance.");

                        const requiredAmount = (parsedAddLots * currentLotSize) * currentPrice;

                        // NOTE: Holdings usually consume Delivery/Intraday limit depending on your system logic.
                        // Assuming Intraday limit logic as per original code, or check if 'Hold' uses different limit.
                        // Defaulting to original logic:
                        const maxLimit = fundsData.intraday?.available_limit || 0;
                        const usedLimit = fundsData.intraday?.used_limit || 0;
                        const availableLimit = maxLimit - usedLimit;

                        if (requiredAmount > availableLimit) {
                            setFeedback({
                                type: 'error',
                                message: `Insufficient Funds! Required: ₹${requiredAmount.toFixed(2)}, Available: ₹${availableLimit.toFixed(2)}`
                            });
                            setSubmitting(false);
                            return;
                        }
                    } catch (fundErr) {
                        setFeedback({ type: 'error', message: "Fund validation failed. Try again." });
                        setSubmitting(false);
                        return;
                    }
                }
            }

            const endpoint = `${apiBase.replace(/\/$/, "")}/api/orders/updateOrder`;
            const basePayload = {
                broker_id_str: brokerId,
                customer_id_str: customerId,
                order_id: orderId,
                instrument_token: instrument_token,
                symbol: tradingsymbol,
                side: orderSide,
                product: product,
                segment: segment,
            };

            let payload = {};

            if (intendedAction === 'Adjust') {
                // *** BUY MORE / UPDATE SL-TARGET ***
                payload = {
                    ...basePayload,
                    lots: String(targetTotalLots),
                    quantity: Number(targetTotalQuantity),
                    price: Number(Number(computedAvg).toFixed(2)),
                    order_status: "HOLD",

                    // --- SEND SL & TARGET ---
                    stop_loss: slPrice ? Number(slPrice) : 0,
                    target: targetPrice ? Number(targetPrice) : 0,

                    meta: { from: 'ui_holding_order_adjustment' }
                };

            } else if (intendedAction === 'Close') {
                // *** EXIT LOGIC ***
                const liveLtp = Number(sheetData?.ltp ?? 0);
                const jobbingRaw = Number(selectedOrder.jobbin_price ?? jobbin_price ?? 0);
                const jobbingPct = Number.isFinite(jobbingRaw) ? (jobbingRaw / 100) : 0;

                let closedLtp = liveLtp || currentPrice || initialPrice || 0;
                if (closedLtp > 0 && !Number.isNaN(jobbingPct) && jobbingPct !== 0) {
                    if (orderSide === 'BUY') closedLtp = closedLtp - (closedLtp * jobbingPct);
                    else closedLtp = closedLtp + (closedLtp * jobbingPct);
                }

                payload = {
                    ...basePayload,
                    lots: String(lots),
                    quantity: Number(initialQty),
                    closed_ltp: Number(Number(closedLtp || 0).toFixed(4)),
                    closed_at: new Date().toISOString(),
                    order_status: "CLOSED",
                    came_From: 'Hold',
                    meta: { from: 'ui_holding_order_closure' }
                };
            }

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                body: JSON.stringify(payload)
            });

            let body = null;
            try { body = await res.json(); } catch (e) { body = null; }

            if (!res.ok) {
                const message = body?.message || body?.error || `Server error: ${res.status}`;
                throw new Error(message);
            }

            if (body && body.success === false) {
                throw new Error(body.message || 'Server returned failure');
            }

            let successMsg = `${intendedAction} successful.`;
            if (intendedAction === 'Adjust' && parsedAddLots === 0) successMsg = "Order Updated Successfully!";

            setFeedback({ type: 'success', message: successMsg });
            try {
                window.dispatchEvent(new CustomEvent('orders:changed', { detail: { order: body?.order } }));
            } catch (e) { }

            setTimeout(() => onClose(), 1000);

        } catch (err) {
            console.error("Error inside handleAction:", err);
            setFeedback({ type: 'error', message: `Failed to ${intendedAction}: ${String(err.message || err)}` });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="open-order-bottom-window fixed bottom-0 left-0 right-0 z-50 bg-[var(--bg-card)] border-t border-[var(--border-color)] shadow-2xl p-4 transition-transform duration-300 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-3 border-b border-[var(--border-color)] pb-2">
                <div className="flex-1 min-w-0 pr-2">
                    <h3 className="text-base sm:text-lg text-[var(--text-primary)] font-bold tracking-wide truncate">{tradingsymbol}</h3>
                    <span className="text-xs text-[var(--text-secondary)]">({orderSide})</span>
                </div>
                <button onClick={onClose} className="p-1 rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition flex-shrink-0"><XCircle className="w-6 h-6" /></button>
            </div>

            {feedback && (
                <div className={`p-2 mb-3 rounded-md text-sm ${feedback.type === 'error' ? 'bg-[var(--loss-chip-bg)] text-[var(--text-primary)]' : 'bg-[var(--gain-chip-bg)] text-[var(--text-primary)]'}`}>
                    {feedback.message}
                </div>
            )}

            <div className="mb-4 flex justify-between items-end">
                <div>
                    <p className="text-xl font-bold">
                        <span className="text-[var(--text-secondary)] mr-1">₹</span>
                        <span className="text-[var(--text-primary)]">{formattedCMP}</span>
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">Current Market Price</p>
                </div>
                <div className="text-right">
                    <span className={`text-xl font-bold px-2 py-0.5 rounded ${pnlChipBg} ${pnlTextColor}`}>{money(netPnl)}</span>
                    <p className="text-xs text-[var(--text-muted)] mt-1">Net P&L (after brokerage)</p>
                </div>
            </div>

            <div className="mb-4 p-2 bg-[var(--bg-secondary)] rounded-lg">
                <DetailRow label="Quantity" value={`${initialQty} shares`} />
                <DetailRow label="Lots" value={`${lots} lots`} />
                <DetailRow label="Avg. Buy Price" value={money(avg)} />
                <DetailRow label="Type" value={orderSide} />
                <DetailRow label="Order Instant" value={product === 'MIS' ? 'Intraday' : 'Overnight'} colorClass="text-indigo-500" />
                <DetailRow label="Expire Date" value={formattedStockExpireDate} colorClass="text-[var(--text-muted)]" />
                {(stop_loss !== 0 || null || undefined) && <DetailRow label="stop_loss" value={stop_loss} colorClass="text-[var(--text-muted)]" />}
                {(target !== 0 || null || undefined) && <DetailRow label="target" value={target} colorClass="text-[var(--text-muted)]" />}
                <DetailRow label="Est. Brokerage (entry)" value={`-${money(brokerageEntry)}`} colorClass="text-[var(--text-muted)]" />
            </div>

            <div className="p-3 bg-[var(--bg-secondary)] rounded-lg mb-4">
                <h4 className="text-lg font-semibold mb-3 text-[var(--text-primary)]">MODIFY HOLDING</h4>

                <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                        <h6 className='text-lg font-semibold text-[var(--text-primary)]'>Add Lot</h6>
                        <input
                            type="number"
                            min="0"
                            value={addLotInput}
                            onChange={(e) => setAddLotInput(e.target.value)}
                            placeholder="Add Lots"
                            className="flex-1 p-2 bg-[var(--bg-input)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-md transition"
                        />
                        <div className="text-xs text-[var(--text-muted)] italic">Size: <span className="font-medium text-[var(--text-primary)] ml-1">{currentLotSize}</span></div>
                    </div>

                    {userRole === 'broker' && (
                        <div className="flex items-center">
                            <Hash className="w-5 h-5 text-[var(--text-secondary)] mr-2" />
                            <div className="w-full p-2 bg-[var(--bg-input)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-md transition flex items-center justify-between">
                                <span className="text-sm">New Avg. Price</span>
                                <span className="font-medium">{displayComputedAvg}</span>
                            </div>
                        </div>
                    )}

                    {/* SL & TARGET INPUTS */}
                    <div className="flex space-x-2">
                        <div className="flex-1 flex items-center space-x-2 bg-[var(--bg-input)] border border-[var(--border-color)] p-2 rounded-md">
                            <AlertCircle className="w-4 h-4 text-[var(--text-secondary)]" />
                            <div className="flex flex-col w-full">
                                <span className="text-[10px] text-[var(--text-muted)] uppercase">Stop Loss</span>
                                <input
                                    type="number"
                                    value={slPrice}
                                    onChange={(e) => setSlPrice(e.target.value)}
                                    placeholder="0.00"
                                    className="bg-transparent text-[var(--text-primary)] font-medium focus:outline-none w-full"
                                />
                            </div>
                        </div>

                        <div className="flex-1 flex items-center space-x-2 bg-[var(--bg-input)] border border-[var(--border-color)] p-2 rounded-md">
                            <Target className="w-4 h-4 text-[var(--text-secondary)]" />
                            <div className="flex flex-col w-full">
                                <span className="text-[10px] text-[var(--text-muted)] uppercase">Target</span>
                                <input
                                    type="number"
                                    value={targetPrice}
                                    onChange={(e) => setTargetPrice(e.target.value)}
                                    placeholder="0.00"
                                    className="bg-transparent text-[var(--text-primary)] font-medium focus:outline-none w-full"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {(userRole === 'broker' || isOpen) && (
                <div className="flex space-x-2">
                    {userRole === 'broker' &&
                        <button
                            onClick={() => handleAction('Adjust')}
                            disabled={submitting}
                            className={`flex-1 p-3 rounded-lg text-white font-semibold transition ${adjustActionColor} ${submitting && action === 'Adjust' ? 'opacity-50' : ''}`}
                        >
                            {submitting && action === 'Adjust' ? 'BUYING...' : 'BUY MORE'}
                        </button>
                    }

                    {userRole === 'broker' && <button
                        onClick={() => handleAction('Close')}
                        disabled={submitting}
                        className={`flex-1 p-3 rounded-lg text-[var(--text-primary)] font-semibold transition ${closeActionColor} ${submitting && action === 'Close' ? 'opacity-50' : ''}`}
                    >
                        {submitting && action === 'Close' ? 'EXITING...' : 'EXIT'}
                    </button>}
                </div>
            )}
        </div>
    );
}