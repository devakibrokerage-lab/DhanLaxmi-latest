import React, { useEffect, useMemo, useState } from "react";
import {
  BarChart, Zap, Filter, PieChart, X, FileText
} from "lucide-react";
import { useNavigate } from 'react-router-dom';
import { calculateExitBrokerageAndPnL } from "../../Utils/calculateBrokerage.jsx";

// --- Helpers ---
const money = (n) => `₹${Number(n ?? 0).toFixed(2)}`;
// Chip background for gain/loss indication
const chipBg = (n) => Number(n) > 0 ? "bg-[var(--gain-chip-bg)]" : Number(n) < 0 ? "bg-[var(--loss-chip-bg)]" : "bg-transparent";
// Text color for % and P&L (green/red)
const pnlTextColor = (n) => Number(n) > 0 ? "text-[var(--gain-text)]" : Number(n) < 0 ? "text-[var(--loss-text)]" : "text-[var(--text-primary)]";
const signSym = (n) => (Number(n) > 0 ? "+" : "");
const arrow = (n) => (Number(n) > 0 ? "▲" : Number(n) < 0 ? "▼" : "");

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

const getOrderValues = (order) => {
  const qty = parseFloat(order.quantity) || 0;
  let entryPrice = parseFloat(order.average_price);
  if (!entryPrice) entryPrice = parseFloat(order.price) || 0;
  let exitPrice = parseFloat(order.closed_ltp);
  if (!exitPrice) exitPrice = parseFloat(order.ltp) || 0;
  return { qty, entryPrice, exitPrice };
};

// ==========================================
// 1. CLOSED ORDER FILTER COMPONENT
// ==========================================
const RANGE_OPTIONS = [
  { value: "all", label: "All" },
  { value: "today", label: "Today" },
  { value: "day", label: "Day(s)" },
  { value: "month", label: "Month(s)" },
  { value: "year", label: "Year(s)" },
  { value: "expiry", label: "Expired Symbol" },
];

function ClosedOrderFilter({ closedOrders = [], onFilter }) {
  const [range, setRange] = useState("all");
  const [nValue, setNValue] = useState(1);
  const [selectedExpiredSymbol, setSelectedExpiredSymbol] = useState("");

  // compute expired symbols
  const expiredSymbols = useMemo(() => {
    const now = new Date();
    const setSym = new Set();
    for (const o of closedOrders) {
      const expRaw = o?.meta?.selectedStock?.expiry || o?.expireDate;
      const tradingSymbol = o?.meta?.selectedStock?.tradingSymbol ?? o?.symbol ?? "";
      if (!expRaw || !tradingSymbol) continue;
      const exp = new Date(expRaw);
      if (exp <= endOfDay(now)) {
        setSym.add(tradingSymbol);
      }
    }
    return Array.from(setSym).sort();
  }, [closedOrders]);

  const computeFiltered = () => {
    const now = new Date();
    const end = endOfDay(now);

    if (range === "all") return closedOrders.slice();

    if (range === "expiry") {
      const list = closedOrders.filter((o) => {
        const expRaw = o?.meta?.selectedStock?.expiry || o?.expireDate;
        if (!expRaw) return false;
        return new Date(expRaw) <= end;
      });
      if (!selectedExpiredSymbol) return list;
      return list.filter((o) => {
        const tradingSymbol = o?.meta?.selectedStock?.tradingSymbol ?? o?.symbol ?? "";
        return String(tradingSymbol) === String(selectedExpiredSymbol);
      });
    }

    let start = null;
    if (range === "today") start = startOfDay(now);
    else if (range === "day") {
      const s = new Date(now); s.setDate(s.getDate() - Math.max(1, Number(nValue) || 1));
      start = startOfDay(s);
    } else if (range === "month") {
      const s = new Date(now); s.setMonth(s.getMonth() - Math.max(1, Number(nValue) || 1));
      start = startOfDay(s);
    } else if (range === "year") {
      const s = new Date(now); s.setFullYear(s.getFullYear() - Math.max(1, Number(nValue) || 1));
      start = startOfDay(s);
    }

    if (!start) return closedOrders.slice();

    return closedOrders.filter((o) => {
      const closedAtRaw = o?.closed_at || o?.closedAt || o?.updatedAt || o?.createdAt;
      if (!closedAtRaw) return false;
      const closed = new Date(closedAtRaw);
      return closed >= start && closed <= end;
    });
  };

  const applyFilter = () => {
    if (onFilter) onFilter(computeFiltered());
  };

  const resetFilter = () => {
    setRange("today");
    setNValue(1);
    setSelectedExpiredSymbol("");
    if (onFilter) onFilter(closedOrders.slice());
  };

  // Run initial filter on mount (defaults to showing all or today based on preference, here defaulting to ALL via effect in parent)
  // But strictly per component logic:

  const showNumberInput = ["day", "month", "year"].includes(range);

  return (
    <div className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="flex justify-between items-center mb-1">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Filter Orders</h3>
      </div>

      <div>
        <label className="text-xs text-[var(--text-secondary)]">Time Range</label>
        <select
          value={range}
          onChange={(e) => { setRange(e.target.value); setSelectedExpiredSymbol(""); setNValue(1); }}
          className="w-full mt-1 p-2 bg-[var(--bg-input)] border border-[var(--border-color)] rounded text-sm text-[var(--text-primary)] outline-none focus:border-indigo-500"
        >
          {RANGE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </div>

      {showNumberInput && (
        <div>
          <label className="text-xs text-[var(--text-secondary)]">Units back</label>
          <input
            type="number" min="1" value={nValue}
            onChange={(e) => setNValue(e.target.value)}
            className="w-full mt-1 p-2 bg-[var(--bg-input)] border border-[var(--border-color)] rounded text-sm text-[var(--text-primary)]"
          />
        </div>
      )}

      {range === "expiry" && (
        <div>
          <label className="text-xs text-[var(--text-secondary)]">Select Symbol</label>
          <select
            value={selectedExpiredSymbol}
            onChange={(e) => setSelectedExpiredSymbol(e.target.value)}
            className="w-full mt-1 p-2 bg-[var(--bg-input)] border border-[var(--border-color)] rounded text-sm text-[var(--text-primary)]"
          >
            <option value="">— All expired —</option>
            {expiredSymbols.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button onClick={applyFilter} className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white font-medium text-sm transition-colors">Apply Filter</button>
        <button onClick={resetFilter} className="flex-1 py-2 bg-transparent border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors">Reset</button>
      </div>
    </div>
  );
}

// ==========================================
// 2. PORTFOLIO ITEM CARD
// ==========================================
const PortfolioItem = ({ data, onClick }) => {
  const tradingsymbol = data?.meta?.selectedStock?.tradingSymbol ?? data?.symbol ?? "—";
  const { qty, entryPrice, exitPrice } = getOrderValues(data);
  const sideUpper = String(data.side ?? "").toUpperCase();

  const { netPnl, pct } = calculateExitBrokerageAndPnL({
    side: sideUpper,
    avgPrice: entryPrice,
    exitPrice,
    qty
  });

  return (
    <div
      onClick={() => onClick(data)}
      className="relative bg-[var(--bg-secondary)] p-4 rounded-xl border border-[var(--border-color)] hover:bg-[var(--bg-hover)] transition mb-3 cursor-pointer group"
    >
      <span className="absolute left-0 top-3 bottom-3 w-1 rounded-r-full bg-indigo-500 transition-all group-hover:bg-indigo-400" />

      <div className="flex justify-between items-center mb-2">
        <p className="text-sm sm:text-base md:text-lg font-bold text-[var(--text-primary)] tracking-wide truncate pr-2 flex-1 max-w-[50%]">{tradingsymbol}</p>
        {/* Tinted chip for P&L with colored text */}
        <span className={`text-xs sm:text-sm font-semibold px-1.5 sm:px-2 py-0.5 rounded ${chipBg(netPnl)} ${pnlTextColor(netPnl)} whitespace-nowrap flex-shrink-0`}>
          {arrow(netPnl)} {signSym(netPnl)}{money(netPnl)}
          <span className="text-[9px] sm:text-[10px] ml-1 opacity-70">({signSym(pct)}{pct.toFixed(2)}%)</span>
        </span>
      </div>

      <div className="flex justify-between text-xs md:text-sm text-[var(--text-secondary)]">
        <div className="space-y-1">
          <p>Qty: <span className="text-[var(--text-primary)] font-medium">{qty}</span></p>
          <p>Entry: <span className="text-[var(--text-primary)] font-medium">{money(entryPrice)}</span></p>
        </div>
        <div className="space-y-1 text-right">
          <p>Exit: <span className="text-[var(--text-primary)] font-semibold">{money(exitPrice)}</span></p>
          <p>Type: <span className="font-semibold text-[var(--text-primary)]">{sideUpper}</span></p>
        </div>
      </div>

      <div className="mt-2 flex items-center text-indigo-500 group-hover:text-indigo-400 text-xs font-medium transition-colors">
        <BarChart className="w-3 h-3 mr-1" /> View Details
      </div>
    </div>
  );
};

// ==========================================
// 3. MAIN PORTFOLIO COMPONENT
// ==========================================
export default function Portfolio() {
  const [allOrders, setAllOrders] = useState([]); // Raw data from API
  const [filteredOrders, setFilteredOrders] = useState([]); // Data shown in list
  const [summary, setSummary] = useState({ invested: 0, current: 0, totalPnl: 0 });
  const [loader, setLoader] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const navigate = useNavigate();

  // UI State for Switcher
  const [showFilter, setShowFilter] = useState(false);

  // API Params
  const activeContext = JSON.parse(localStorage.getItem('activeContext') || '{}');
  const { brokerId, customerId } = activeContext;
  const token = localStorage.getItem("token");

  // Fetch Data
  const fetchClosedOrders = async () => {
    if (!brokerId || !customerId) { setLoader(false); return; }
    setLoader(true);
    try {
      const baseUrl = import.meta.env.VITE_REACT_APP_API_URL || "";
      const res = await fetch(`${baseUrl}/api/orders/getOrderInstrument?broker_id_str=${brokerId}&customer_id_str=${customerId}&orderStatus=CLOSED`, {
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });

      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      const orders = Array.isArray(data?.ordersInstrument) ? data.ordersInstrument : [];
      const sortedOrders = orders.sort((a, b) => new Date(b.closed_at) - new Date(a.closed_at));

      setAllOrders(sortedOrders);
      setFilteredOrders(sortedOrders); // Initially show all
      calculateSummary(sortedOrders);
    } catch (err) {
      console.error(err);
    } finally {
      setLoader(false);
    }
  };

  // Recalculate summary based on visible orders
  const calculateSummary = (orders) => {
    const acc = orders.reduce((a, order) => {
      const { qty, entryPrice, exitPrice } = getOrderValues(order);
      const side = String(order.side ?? "").toUpperCase();

      const { entryValue, exitValue, netPnl } = calculateExitBrokerageAndPnL({
        side,
        avgPrice: entryPrice,
        exitPrice,
        qty
      });

      a.invested += entryValue;
      a.current += exitValue;
      a.totalPnl += netPnl;
      return a;
    }, { invested: 0, current: 0, totalPnl: 0 });

    setSummary(acc);
  };

  const handleFilterResult = (results) => {
    setFilteredOrders(results);
    calculateSummary(results);
    // Optional: Auto close filter on apply? 
    // setShowFilter(false); 
  };

  useEffect(() => {
    fetchClosedOrders();
    const handler = () => fetchClosedOrders();
    window.addEventListener('orders:changed', handler);
    return () => window.removeEventListener('orders:changed', handler);
  }, [brokerId, customerId]);

  const userString = localStorage.getItem('loggedInUser');
  const userObject = userString ? JSON.parse(userString) : {};
  const userRole = userObject.role;


  return (
    <div className="flex flex-col min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] overflow-hidden">

      {/* Header with Switcher */}
      <div className="flex justify-between items-center px-4 pt-4 pb-2">
        <h2 className="text-[26px] font-semibold leading-none">Portfolio</h2>

        <div className="flex gap-2">
          {/* Invoice Button */}
          {userRole === 'broker' && <button
            onClick={() => navigate('/portfolio/invoice')}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border bg-[var(--bg-secondary)] text-[var(--text-secondary)] border-[var(--border-color)] hover:bg-[var(--bg-hover)] transition-colors"
          >
            <FileText className="w-3.5 h-3.5" />
            Invoice
          </button>}

          {/* Switcher Button */}
          <button
            onClick={() => setShowFilter(!showFilter)}
            className={`
                        flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-300
                        ${showFilter
                ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/50"
                : "bg-[var(--bg-secondary)] text-[var(--text-secondary)] border-[var(--border-color)] hover:bg-[var(--bg-hover)]"
              }
                    `}
          >
            {showFilter ? (
              <>
                <PieChart className="w-3.5 h-3.5" />
                Show Summary
              </>
            ) : (
              <>
                <Filter className="w-3.5 h-3.5" />
                Filter
              </>
            )}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-24 mt-2">

        {/* SWAPPABLE AREA: Summary vs Filter */}
        <div className="mb-6 relative">
          {showFilter ? (
            <ClosedOrderFilter
              closedOrders={allOrders}
              onFilter={handleFilterResult}
            />
          ) : (
            <div className="bg-[var(--bg-secondary)] p-5 rounded-xl shadow border border-[var(--border-color)] animate-in fade-in zoom-in-95 duration-300">
              {/* Portfolio Summary Card */}
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-[var(--text-secondary)] text-sm">Total Invested</p>
                  <p className="text-xl font-bold">{money(summary.invested)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[var(--text-secondary)] text-sm">Realized Value</p>
                  <p className="text-xl font-bold">{money(summary.current)}</p>
                </div>
              </div>

              <div className="flex justify-between items-center pt-3 border-t border-[var(--border-color)]">
                <p className="text-[var(--text-secondary)] text-xs sm:text-sm">Total Realized P&L</p>
                <span className={`text-base sm:text-lg font-bold px-1.5 sm:px-2 py-0.5 rounded ${chipBg(summary.totalPnl)} ${pnlTextColor(summary.totalPnl)} whitespace-nowrap`}>
                  {arrow(summary.totalPnl)} {signSym(summary.totalPnl)}
                  {Number(summary.totalPnl).toFixed(2)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* List Header */}
        <h3 className="text-base font-semibold mb-3 flex items-center justify-between">
          <span>Closed Positions ({filteredOrders.length})</span>
          {/* Show indicator if filtered */}
          {allOrders.length !== filteredOrders.length && (
            <span className="text-[10px] bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-full">Filtered</span>
          )}
        </h3>

        {/* The List */}
        {loader && <div className="text-center text-[var(--text-secondary)] text-sm mt-10">Loading positions...</div>}

        {!loader && filteredOrders.map((order, idx) => (
          <PortfolioItem
            key={order._id || idx}
            data={order}
            onClick={setSelectedOrder}
          />
        ))}

        {!loader && filteredOrders.length === 0 && (
          <div className="text-[var(--text-secondary)] bg-indigo-900/10 border border-indigo-900/30 rounded-lg p-6 text-sm text-center flex flex-col items-center">
            <Filter className="w-8 h-8 mb-2 opacity-50" />
            <p>No orders found.</p>
            {allOrders.length > 0 && <p className="text-xs opacity-60 mt-1">Try adjusting your filters.</p>}
          </div>
        )}
      </div>

      {/* Helper Window - Uncomment when needed */}
      {/* {selectedOrder && (
                <ClosedOrderBottomWindow 
                    selectedOrder={selectedOrder} 
                    onClose={() => setSelectedOrder(null)} 
                />
            )} */}
    </div>
  );
}