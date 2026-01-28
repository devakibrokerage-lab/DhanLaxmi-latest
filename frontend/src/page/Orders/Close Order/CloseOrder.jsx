import React, { useEffect, useState, useRef } from "react";
import { ShoppingCart, DollarSign, Hash, Zap, XCircle, Clock, Layers, RefreshCw, Trash2, AlertTriangle } from 'lucide-react';
import { motion, useMotionValue, useTransform } from "framer-motion";
import ClosedOrderFilter from "./CloseOrderFilter";
import { logMarketStatus } from '../../../Utils/marketStatus.js';
import { calculateExitBrokerageAndPnL } from "../../../Utils/calculateBrokerage.jsx";
import Toast from "../../../Utils/Toast";

const money = (n) => `₹${Number(n ?? 0).toFixed(2)}`;

// --- Helper to ensure consistent math everywhere ---
const getOrderValues = (order) => {
    const qty = parseFloat(order.quantity) || 0;

    // Priority: average_price -> price
    let entryPrice = parseFloat(order.average_price);
    if (!entryPrice) entryPrice = parseFloat(order.price) || 0;

    // Exit: closed_ltp -> ltp
    let exitPrice = parseFloat(order.closed_ltp);
    if (!exitPrice) exitPrice = parseFloat(order.ltp) || 0;

    return { qty, entryPrice, exitPrice };
};

// --- Internal Component: DetailRow (Safe Icon Rendering) ---
const DetailRow = ({ Icon, label, value, colorClass }) => (
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

// --- Swipeable Item Component (Matches Watchlist Style) ---
const SwipeableClosedOrderItem = ({ data, onSelect, onDelete }) => {
    const x = useMotionValue(0);
    const bgOpacity = useTransform(x, [-100, 0], [1, 0]); // Background redness opacity

    const tradingsymbolRaw = data?.meta?.selectedStock?.tradingSymbol ?? data?.symbol ?? "";
    const tradingsymbol = String(tradingsymbolRaw ?? "");

    const { qty, entryPrice, exitPrice } = getOrderValues(data);
    const sideUpper = String(data.side ?? "").toUpperCase();

    const {
        pct,
        netPnl
    } = calculateExitBrokerageAndPnL({
        side: sideUpper,
        avgPrice: entryPrice,
        exitPrice,
        qty
    });

    const isZero = Math.abs(netPnl) < 0.01;
    const profit = netPnl > 0;
    const pnlChipBg = isZero ? "bg-transparent" : (profit ? "bg-[var(--gain-chip-bg)]" : "bg-[var(--loss-chip-bg)]");
    const pnlTextColor = isZero ? "text-[var(--text-primary)]" : (profit ? "text-[var(--gain-text)]" : "text-[var(--loss-text)]");
    const arrow = isZero ? "" : (profit ? "▲" : "▼");

    const pctText = `${arrow} ${profit && !isZero ? '+' : ''}${netPnl.toFixed(2)} (${profit && !isZero ? '+' : ''}${pct.toFixed(2)}%)`;

    return (
        <div className="relative overflow-hidden rounded-lg mb-2">
            {/* Background Layer (Red with Delete Icon) */}
            <motion.div
                style={{ opacity: bgOpacity }}
                className="absolute inset-y-0 right-0 w-full bg-red-600/20 rounded-lg flex items-center justify-end pr-6 z-0"
            >
                <Trash2 className="text-red-500 w-6 h-6" />
            </motion.div>

            {/* Foreground Layer (The Actual Item) */}
            <motion.div
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={{ left: 0.5, right: 0 }}
                onDragEnd={(e, { offset }) => {
                    if (offset.x < -100) {
                        onDelete(data._id);
                    }
                }}
                whileTap={{ cursor: "grabbing" }}
                style={{ x, backgroundColor: "var(--bg-card)" }}
                className="relative z-10 border border-[var(--border-color)] p-3 rounded-lg hover:bg-[var(--bg-hover)] transition-colors cursor-pointer select-none"
                onClick={() => {
                    if (x.get() === 0) onSelect(data);
                }}
            >
                <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-indigo-500" />

                <div className="flex flex-col mb-1 pl-2">
                    <h4 className="text-[var(--text-primary)] font-bold tracking-wide text-sm truncate pr-2">
                        {tradingsymbol || '—'}
                    </h4>
                    <div className="flex items-center justify-between mt-1">
                        <span className="text-[10px] sm:text-xs text-[var(--text-secondary)]">({sideUpper})</span>
                        <span className={`text-[10px] sm:text-xs font-bold px-1 sm:px-1.5 py-0.5 rounded ${pnlChipBg} ${pnlTextColor} whitespace-nowrap`}>{pctText}</span>
                    </div>
                </div>

                <div className="mt-1 grid grid-cols-2 gap-y-1 text-[12px] pl-2">
                    {/* Qty and Exit */}
                    <div className="text-[var(--text-secondary)]">
                        Qty: <span className="text-[var(--text-primary)]">{qty}</span>
                    </div>
                    <div className="text-right text-[var(--text-secondary)]">
                        Exit: <span className="text-[var(--text-primary)] font-semibold">{money(exitPrice)}</span>
                    </div>

                    {/* Lots and Avg */}
                    <div className="text-[var(--text-secondary)]">
                        Lots: <span className="text-[var(--text-primary)]">{data.lots ?? '-'}</span>
                        <span className="text-[var(--text-muted)] ml-1 text-[10px]">({data.lot_size ?? '-'})</span>
                    </div>
                    <div className="text-right text-[var(--text-secondary)]">
                        Avg: <span className="text-[var(--text-primary)]">{money(entryPrice)}</span>
                    </div>

                    {/* Total P&L Row */}
                    <div className="col-span-2 text-right pt-1 mt-1 border-t border-[var(--border-color)]">
                        <span className="text-[var(--text-secondary)] mr-2">
                            Net P&L (After Brokerage):
                        </span>
                        <span className={`${pnlTextColor} font-semibold text-sm`}>{money(netPnl)}</span>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

// --- Internal Component: ClosedOrderBottomWindow ---
const ClosedOrderBottomWindow = ({ selectedOrder, onClose }) => {
    if (!selectedOrder) return null;
    //console.log(selectedOrder);

    // 1. Get User Role for Permissions
    const userString = localStorage.getItem('loggedInUser');
    const userObject = userString ? JSON.parse(userString) : {};
    const userRole = userObject.role; // 'broker' or 'customer'
    const isOpen = logMarketStatus();

    const [submitting, setSubmitting] = useState(false);
    const [feedback, setFeedback] = useState(null);

    // --- Price Editing State ---
    const [isEditing, setIsEditing] = useState(false);
    const [editEntry, setEditEntry] = useState('');
    const [editExit, setEditExit] = useState('');

    // For option chain orders, expiry is in meta.expiry
    // For regular orders, expiry is in meta.selectedStock.expiry
    const expireDate = selectedOrder.meta?.expiry || selectedOrder.meta?.selectedStock?.expiry;
    const date = expireDate ? new Date(expireDate) : null;
    const formattedStockExpireDate = date ? (
        String(date.getDate()).padStart(2, '0') + '-' +
        String(date.getMonth() + 1).padStart(2, '0') + '-' +
        date.getFullYear()
    ) : "—";

    const {
        symbol, side, product, lots, lot_size, closed_at,
        _id: orderId, instrument_token, segment, quantity, price, came_From
    } = selectedOrder;

    const tradingsymbol = selectedOrder.meta?.selectedStock?.tradingSymbol ?? symbol ?? "N/A";
    const orderSide = String(side ?? "").toUpperCase();
    const productType = product === 'MIS' ? 'Intraday' : 'Overnight';

    const { qty, entryPrice, exitPrice } = getOrderValues(selectedOrder);

    // Initialize edit values on mount/change
    useEffect(() => {
        setEditEntry(entryPrice);
        setEditExit(exitPrice);
        setIsEditing(false); // Reset edit mode when order changes
        setFeedback(null);
    }, [selectedOrder, entryPrice, exitPrice]);


    // 🔹 EXIT P&L + FULL BROKERAGE (entry + exit) helper se
    // Calculate P&L based on EDIT values if editing, else original
    const currentEntry = isEditing ? Number(editEntry) : entryPrice;
    const currentExit = isEditing ? Number(editExit) : exitPrice;

    const {
        exitValue,
        brokerageEntry,
        brokerageExit,
        grossPnl,
        netPnl,
        pct
    } = calculateExitBrokerageAndPnL({
        side: orderSide,
        avgPrice: currentEntry,
        exitPrice: currentExit,
        qty
    });

    const isZero = Math.abs(netPnl) < 0.01;
    const profit = netPnl > 0;

    const pnlChipBg = isZero ? "bg-transparent" : (profit ? "bg-[var(--gain-chip-bg)]" : "bg-[var(--loss-chip-bg)]");
    const pnlTextColor = isZero ? "text-[var(--text-primary)]" : (profit ? "text-[var(--gain-text)]" : "text-[var(--loss-text)]");

    const closedTime = closed_at ? (() => {
        const d = new Date(closed_at);
        const datePart = String(d.getDate()).padStart(2, "0") + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + d.getFullYear();
        const timePart = d.toLocaleTimeString();
        return `${datePart}, ${timePart}`;
    })() : "—";

    // --- REOPEN LOGIC ---
    const handleReopen = async () => {
        setSubmitting(true);
        setFeedback(null);

        try {
            const activeContextString = localStorage.getItem('activeContext');
            const activeContext = activeContextString ? JSON.parse(activeContextString) : {};
            const brokerId = activeContext.brokerId;
            const customerId = activeContext.customerId;
            const token = localStorage.getItem("token") || null;
            const apiBase = import.meta.env.VITE_REACT_APP_API_URL || "";
            const endpoint = `${apiBase}/api/orders/updateOrder`;

            const payload = {
                broker_id_str: brokerId,
                customer_id_str: customerId,
                order_id: orderId,
                instrument_token: instrument_token,
                symbol: tradingsymbol,
                side: orderSide,
                product: product,
                segment: segment,
                lots: String(lots),
                quantity: Number(quantity),
                price: Number(price),
                order_status: "OPEN", // Reopening
                meta: { from: 'ui_closed_order_reopen' }
            };

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                },
                body: JSON.stringify(payload)
            });

            let body = null;
            try { body = await res.json(); } catch (e) { body = null; }

            if (!res.ok) throw new Error(body?.message || body?.error || `Server error: ${res.status}`);
            if (body && body.success === false) throw new Error(body.message || 'Server returned failure');

            setFeedback({ type: 'success', message: 'Order Reopened Successfully!' });

            // Notify app
            try { window.dispatchEvent(new CustomEvent('orders:changed', { detail: { order: body?.order } })); } catch (e) { }

            setTimeout(() => { onClose(); }, 1000);

        } catch (err) {
            console.error("Reopen error:", err);
            setFeedback({ type: 'error', message: `Failed to reopen: ${err.message}` });
        } finally {
            setSubmitting(false);
        }
    };

    // --- SAVE EDITED PRICES ---
    const handleSavePrices = async () => {
        setSubmitting(true);
        setFeedback(null);
        try {
            const token = localStorage.getItem("token") || null;
            const apiBase = import.meta.env.VITE_REACT_APP_API_URL || "";
            // Use the NEW safe endpoint
            const endpoint = `${apiBase}/api/orders/updateClosedOrderPrices`;

            const payload = {
                order_id: orderId,
                price: Number(editEntry),
                closed_ltp: Number(editExit)
            };

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                },
                body: JSON.stringify(payload)
            });

            let body = null;
            try { body = await res.json(); } catch (e) { body = null; }

            if (!res.ok) throw new Error(body?.message || body?.error || `Server error: ${res.status}`);
            if (body && body.success === false) throw new Error(body.message || 'Failed to update prices');

            setFeedback({ type: 'success', message: 'Prices Updated Successfully!' });
            setIsEditing(false);

            // Notify app to refresh list
            try { window.dispatchEvent(new CustomEvent('orders:changed', { detail: { order: body?.order } })); } catch (e) { }

            setTimeout(() => { onClose(); }, 500);

        } catch (err) {
            console.error("Update error:", err);
            setFeedback({ type: 'error', message: `Failed to update: ${err.message}` });
        } finally {
            setSubmitting(false);
        }
    };


    return (
        <div className="open-order-bottom-window fixed bottom-0 left-0 right-0 z-50 bg-[var(--bg-card)] border-t border-[var(--border-color)] shadow-2xl p-4 transition-transform duration-300 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex justify-between items-start mb-3 border-b border-[var(--border-color)] pb-2">
                <div className="flex-1 min-w-0 pr-2">
                    <h3 className="text-base sm:text-lg text-[var(--text-primary)] font-bold tracking-wide truncate">{tradingsymbol}</h3>
                    <span className="text-xs text-[var(--text-secondary)]">({orderSide})</span>
                </div>
                <div className="flex items-center gap-2">
                    {/* Toggle Edit Mode */}
                    {!isEditing && (userRole === 'broker') && (
                        <button
                            onClick={() => setIsEditing(true)}
                            className="p-1.5 rounded-full text-indigo-400 hover:bg-indigo-500/10 transition"
                            title="Edit Prices"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-pencil"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></svg>
                        </button>
                    )}
                    <button onClick={onClose} className="p-1 rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition flex-shrink-0">
                        <XCircle className="w-6 h-6" />
                    </button>
                </div>
            </div>

            {/* Feedback */}
            {feedback && (
                <div className={`p-2 mb-3 rounded-md text-sm ${feedback.type === 'error' ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                    {feedback.message}
                </div>
            )}

            {/* P&L Display - LIVE UPDATE DURING EDIT */}
            <div className="mb-4 flex justify-between items-end">
                <div>
                    <p className="text-xl font-bold">
                        <span className="text-[var(--text-secondary)] mr-1">₹</span>
                        <span className="text-[var(--text-primary)]">{isEditing ? currentExit.toFixed(2) : exitPrice.toFixed(2)}</span>
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">Exit Price</p>
                </div>
                <div className="text-right">
                    <span className={`text-xl font-bold px-2 py-0.5 rounded ${pnlChipBg} ${pnlTextColor}`}>{money(netPnl)}</span>
                    <p className="text-xs text-[var(--text-muted)] mt-1">Realized P&L (After Brokerage)</p>
                </div>
            </div>

            {/* Brokerage Breakdown */}
            <div className="mb-2 p-2 bg-[var(--bg-secondary)] rounded-md text-[11px]">
                <div className="flex justify-between text-[var(--text-secondary)]">
                    <span>Gross P&L</span>
                    <span>{money(grossPnl)}</span>
                </div>
                <div className="flex justify-between text-[var(--text-secondary)]">
                    <span>Entry Brokerage 0.01%</span>
                    <span className="text-[var(--text-secondary)]">-{money(brokerageEntry)}</span>
                </div>
                <div className="flex justify-between text-[var(--text-secondary)]">
                    <span>Exit Brokerage 0.01%</span>
                    <span className="text-[var(--text-secondary)]">-{money(brokerageExit)}</span>
                </div>
                <div className="flex justify-between mt-1 border-t border-[var(--border-color)] pt-1 font-semibold">
                    <span>Net P&L</span>
                    <span className={pnlTextColor}>{money(netPnl)} ({pct.toFixed(2)}%)</span>
                </div>
            </div>

            {/* Details Grid (Compact) */}
            <div className="mb-2 p-2 bg-[var(--bg-secondary)] rounded-md text-xs space-y-1">
                <DetailRow label="Quantity" value={`${qty} shares`} />

                {/* EDITABLE ENTRY PRICE */}
                <div className="flex justify-between items-center py-0.5 px-2">
                    <div className="flex items-center text-[var(--text-secondary)]"><span className="text-xs">Entry Price</span></div>
                    {isEditing ? (
                        <input
                            type="number"
                            value={editEntry}
                            onChange={(e) => setEditEntry(e.target.value)}
                            className="bg-[var(--bg-input)] border border-[var(--border-color)] rounded px-1 py-0.5 text-right w-24 text-[var(--text-primary)] focus:outline-none focus:border-indigo-500"
                        />
                    ) : (
                        <span className="text-sm font-medium text-[var(--text-primary)]">{money(entryPrice)}</span>
                    )}
                </div>

                {/* EDITABLE EXIT PRICE */}
                <div className="flex justify-between items-center py-0.5 px-2">
                    <div className="flex items-center text-[var(--text-secondary)]"><span className="text-xs">Exit Price</span></div>
                    {isEditing ? (
                        <input
                            type="number"
                            value={editExit}
                            onChange={(e) => setEditExit(e.target.value)}
                            className="bg-[var(--bg-input)] border border-[var(--border-color)] rounded px-1 py-0.5 text-right w-24 text-[var(--text-primary)] focus:outline-none focus:border-indigo-500"
                        />
                    ) : (
                        <span className="text-sm font-medium text-[var(--text-primary)]">{money(exitPrice)}</span>
                    )}
                </div>

                <DetailRow label="Type" value={orderSide} />
                <DetailRow label="Product" value={productType} colorClass="text-indigo-500" />
                <DetailRow label="From" value={came_From} colorClass="text-indigo-500" />
                <DetailRow label="Closed At" value={closedTime} colorClass="text-[var(--text-muted)] text-xs" />
                <DetailRow label="Expire Date" value={formattedStockExpireDate} colorClass="text-[var(--text-muted)] text-xs" />
            </div>

            {/* Actions */}
            <div className="flex space-x-2 mt-4">
                {isEditing ? (
                    <>
                        <button
                            onClick={() => setIsEditing(false)}
                            className="flex-1 p-3 rounded-lg bg-[var(--bg-secondary)] text-[var(--text-secondary)] font-semibold hover:bg-[var(--bg-hover)] transition border border-[var(--border-color)]"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSavePrices}
                            disabled={submitting}
                            className={`flex-1 p-3 rounded-lg font-semibold text-white transition flex items-center justify-center gap-2
                             ${submitting ? 'bg-indigo-600/50 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 shadow-lg shadow-green-900/20'}`}
                        >
                            {submitting ? 'Saving...' : 'Save Changes'}
                        </button>
                    </>
                ) : (
                    <>
                        <button
                            onClick={onClose}
                            className="flex-1 p-3 rounded-lg bg-[var(--bg-secondary)] text-[var(--text-primary)] font-semibold hover:bg-[var(--bg-hover)] transition border border-[var(--border-color)]"
                        >
                            Close
                        </button>

                        {/* Condition: Not Hold, Not Overnight AND User is Broker */}
                        {((came_From !== 'Hold' && came_From !== 'Overnight' && userRole === 'broker') || isOpen) && (
                            <button
                                onClick={handleReopen}
                                disabled={submitting}
                                className={`flex-1 p-3 rounded-lg font-semibold text-white transition flex items-center justify-center gap-2
                                ${submitting ? 'bg-indigo-600/50 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-900/20'}`}
                            >
                                {submitting ? (
                                    <>Processing...</>
                                ) : (
                                    <>
                                        <RefreshCw className="w-4 h-4" />
                                        To Open
                                    </>
                                )}
                            </button>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};


// --- Main Component: ClosedOrder ---

export default function ClosedOrder() {
    const [closedOrders, setClosedOrders] = useState([]);
    const [filteredOrders, setFilteredOrders] = useState([]);
    const [loader, setLoader] = useState(true);
    const [error, setError] = useState(null);
    const [selectedOrderData, setSelectedOrderData] = useState(null);
    const [toast, setToast] = useState({ show: false, message: '', type: '' });

    // Modal State
    const [deleteTarget, setDeleteTarget] = useState(null); // null, 'ALL', or specific orderId
    const [isDeleting, setIsDeleting] = useState(false);

    const activeContextString = localStorage.getItem('activeContext');
    const activeContext = activeContextString ? JSON.parse(activeContextString) : {};
    const brokerId = activeContext.brokerId;
    const customerId = activeContext.customerId;
    const token = localStorage.getItem("token") || null;
    const apiBase = import.meta.env.VITE_REACT_APP_API_URL || "";

    const orderStatus = "CLOSED";

    // --- Toast Handler ---
    const showToast = (message, type = 'success') => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast({ show: false, message: '', type: '' }), 3000);
    };

    const handleOrderSelect = (orderData) => {
        setSelectedOrderData(orderData);
    };

    const handleCloseWindow = () => {
        setSelectedOrderData(null);
    };

    const fetchClosedOrders = async () => {
        if (!brokerId || !customerId) {
            setLoader(false);
            return;
        }
        setLoader(true);
        try {
            const endPoint = `${apiBase.replace(/\/$/, "")}/api/orders/getOrderInstrument?broker_id_str=${brokerId}&customer_id_str=${customerId}&orderStatus=${orderStatus}`;
            const res = await fetch(endPoint, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                },
                credentials: "include",
            });

            if (!res.ok) {
                setClosedOrders([]);
                setFilteredOrders([]);
                setError("Failed to load closed orders");
                return;
            }

            const data = await res.json();
            const orders = Array.isArray(data?.ordersInstrument) ? data.ordersInstrument : (Array.isArray(data) ? data : []);
            // Sort by closing time desc
            const sortedOrders = orders.sort((a, b) => new Date(b.closed_at) - new Date(a.closed_at));

            setClosedOrders(sortedOrders);
            setFilteredOrders(sortedOrders.slice());
            setError(null);
        } catch (err) {
            console.error("fetchClosedOrders exception:", err);
            setClosedOrders([]);
            setFilteredOrders([]);
            setError(String(err));
        } finally {
            setLoader(false);
        }
    };

    // --- Delete Handlers ---
    const handleDeleteOrder = (orderId) => {
        setDeleteTarget(orderId);
    };

    const handleDeleteAllClick = () => {
        if (filteredOrders.length === 0) return;
        setDeleteTarget("ALL");
    };

    const executeDelete = async () => {
        if (!deleteTarget) return;
        setIsDeleting(true);

        try {
            let url = "";
            let body = {};

            if (deleteTarget === "ALL") {
                url = `${apiBase}/api/orders/deleteAllClosedOrders`;
                body = { broker_id_str: brokerId, customer_id_str: customerId };
            } else {
                url = `${apiBase}/api/orders/deleteOrder`;
                body = { order_id: deleteTarget };
            }

            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            const data = await res.json();

            if (data.success) {
                const msg = deleteTarget === "ALL"
                    ? `All Orders Deleted (${data.message})`
                    : "Order Deleted Successfully";
                showToast(msg, deleteTarget === "ALL" ? "success" : "error"); // Red toast for single delete usually implies significant action

                fetchClosedOrders();
                setDeleteTarget(null);
            } else {
                showToast(data.message || "Failed to delete", "error");
            }
        } catch (e) {
            console.error(e);
            showToast("Server Error", "error");
        } finally {
            setIsDeleting(false);
        }
    };

    useEffect(() => {
        fetchClosedOrders();
        const handler = () => fetchClosedOrders();
        window.addEventListener('orders:changed', handler);
        return () => window.removeEventListener('orders:changed', handler);
    }, [brokerId, customerId, apiBase, token]);

    // Modal Content Helper
    const isAll = deleteTarget === "ALL";
    const modalTitle = isAll ? "Delete All Closed Orders?" : "Delete This Order?";
    const modalDesc = isAll
        ? `Are you sure you want to delete all ${filteredOrders.length} closed orders? This action cannot be undone.`
        : "Are you sure you want to delete this closed order? This action cannot be undone.";
    const confirmBtnText = isAll ? "Yes, Delete All" : "Yes, Delete";

    return (
        <>
            <Toast show={toast.show} message={toast.message} type={toast.type} />
            <div className="flex flex-col md:grid md:grid-cols-[280px_1fr] gap-4 h-full overflow-hidden">
                {/* Left: Filter Sidebar */}
                <div className="flex-shrink-0">
                    <ClosedOrderFilter
                        closedOrders={closedOrders}
                        onFilter={(newList) => setFilteredOrders(newList)}
                    />
                </div>

                {/* Right: Order List */}
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                    <div className="flex justify-between items-center mb-2 flex-shrink-0">
                        <h3 className="text-[var(--text-secondary)] text-sm">Closed Orders ({filteredOrders.length})</h3>
                        {filteredOrders.length > 0 && (
                            <button
                                onClick={handleDeleteAllClick}
                                className="flex items-center gap-1 text-xs text-red-500 hover:text-red-400 bg-red-500/10 px-2 py-1 rounded"
                            >
                                <Trash2 className="w-3 h-3" /> Clear All
                            </button>
                        )}
                    </div>

                    {loader ? (
                        <div className="flex justify-center items-center py-8">
                            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    ) : filteredOrders.length === 0 ? (
                        <div className="text-[var(--text-muted)] text-center py-8 text-sm italic">
                            No closed positions found.
                        </div>
                    ) : (
                        <div className="flex-1 overflow-y-auto pb-20 space-y-2">
                            {filteredOrders.map((data, idx) => (
                                <SwipeableClosedOrderItem
                                    key={data._id || idx}
                                    data={data}
                                    onSelect={handleOrderSelect}
                                    onDelete={handleDeleteOrder}
                                />
                            ))}
                        </div>
                    )}

                    {selectedOrderData && (
                        <ClosedOrderBottomWindow
                            selectedOrder={selectedOrderData}
                            onClose={handleCloseWindow}
                        />
                    )}

                    {/* DYNAMIC DELETE CONFIRMATION MODAL */}
                    {deleteTarget && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                            <div
                                className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                                onClick={() => !isDeleting && setDeleteTarget(null)}
                            />
                            <div className="relative bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl shadow-2xl w-full max-w-sm p-6 transform transition-all scale-100">
                                <div className="flex flex-col items-center text-center">
                                    <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center mb-4">
                                        <AlertTriangle className="text-red-500 w-6 h-6" />
                                    </div>
                                    <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2">
                                        {modalTitle}
                                    </h3>
                                    <p className="text-[var(--text-secondary)] text-sm mb-6">
                                        {modalDesc}
                                    </p>
                                    <div className="flex gap-3 w-full">
                                        <button
                                            onClick={() => setDeleteTarget(null)}
                                            disabled={isDeleting}
                                            className="flex-1 px-4 py-2.5 bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] border border-[var(--border-color)] text-[var(--text-secondary)] rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={executeDelete}
                                            disabled={isDeleting}
                                            className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-70 flex justify-center items-center gap-2"
                                        >
                                            {isDeleting ? (
                                                <>
                                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                    Deleting...
                                                </>
                                            ) : (
                                                confirmBtnText
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
