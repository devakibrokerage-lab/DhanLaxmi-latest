// ClosedOrderFilter.jsx
// Image/ref: file:///mnt/data/6b16fda7-f4b5-4074-ad00-c2f6a89b6279.png

import React, { useEffect, useMemo, useState } from "react";

/**
 * Props:
 * - closedOrders: array (all closed orders)
 * - onFilter: function(filteredOrders)
 *
 * Behavior:
 * - Range dropdown: All / Today / Day(s) / Month(s) / Year(s) / Expiry
 * - If Range === 'all'  -> number input hidden, Apply returns all orders
 * - If Range === 'today' -> number input hidden, Apply returns only today's closed orders
 * - If Range === 'expiry' -> number input hidden, show expired symbols dropdown (expiry ≤ today)
 *      -> Apply returns only expired orders (or filtered symbol)
 * - If Range === 'day'/'month'/'year' -> show number input (n)
 *   -> Apply returns orders closed between (today - n units) and today (inclusive)
 *
 * Notes:
 * - Filtering uses closed_at (or createdAt/updatedAt fallback)
 * - Expiry check uses meta.selectedStock.expiry or expireDate
 */

const RANGE_OPTIONS = [
  { value: "all", label: "All" },
  { value: "today", label: "Today" },
  { value: "day", label: "Day(s)" },
  { value: "month", label: "Month(s)" },
  { value: "year", label: "Year(s)" },
  { value: "expiry", label: "Expired Symbol" },
];

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

export default function ClosedOrderFilter({ closedOrders = [], onFilter }) {
  const [range, setRange] = useState("all");
  const [nValue, setNValue] = useState(1);
  const [selectedExpiredSymbol, setSelectedExpiredSymbol] = useState("");

  // compute expired symbols (expiry <= today)
  const expiredSymbols = useMemo(() => {
    const now = new Date();
    const setSym = new Set();
    for (const o of closedOrders) {
      // For option chain orders, expiry is in meta.expiry
      const expRaw = o?.meta?.expiry || o?.meta?.selectedStock?.expiry || o?.expireDate;
      const tradingSymbol = o?.meta?.selectedStock?.tradingSymbol ?? o?.symbol ?? "";
      if (!expRaw || !tradingSymbol) continue;
      const exp = new Date(expRaw);
      if (exp <= endOfDay(now)) {
        setSym.add(tradingSymbol);
      }
    }
    return Array.from(setSym).sort();
  }, [closedOrders]);

  // compute filtered based on controls
  const computeFiltered = () => {
    const now = new Date();
    const end = endOfDay(now);

    // ALL -> return everything
    if (range === "all") {
      return closedOrders.slice();
    }

    // EXPIRY -> ignore number input, filter by expiry <= today and optional symbol
    if (range === "expiry") {
      const list = closedOrders.filter((o) => {
        const expRaw = o?.meta?.expiry || o?.meta?.selectedStock?.expiry || o?.expireDate;
        if (!expRaw) return false;
        const exp = new Date(expRaw);
        return exp <= end;
      });

      if (!selectedExpiredSymbol) return list;
      return list.filter((o) => {
        const tradingSymbol = o?.meta?.selectedStock?.tradingSymbol ?? o?.symbol ?? "";
        return String(tradingSymbol) === String(selectedExpiredSymbol);
      });
    }

    // For date-based ranges compute start
    let start = null;
    if (range === "today") {
      start = startOfDay(now);
    } else if (range === "day") {
      const n = Math.max(1, Number(nValue) || 1);
      const s = new Date(now);
      s.setDate(s.getDate() - n); // subtract n days
      start = startOfDay(s);
    } else if (range === "month") {
      const n = Math.max(1, Number(nValue) || 1);
      const s = new Date(now);
      s.setMonth(s.getMonth() - n); // subtract n months
      start = startOfDay(s);
    } else if (range === "year") {
      const n = Math.max(1, Number(nValue) || 1);
      const s = new Date(now);
      s.setFullYear(s.getFullYear() - n); // subtract n years
      start = startOfDay(s);
    }

    if (!start) return closedOrders.slice();

    // Filter by closed_at in [start, end]
    return closedOrders.filter((o) => {
      const closedAtRaw = o?.closed_at || o?.closedAt || o?.updatedAt || o?.createdAt;
      if (!closedAtRaw) return false;
      const closed = new Date(closedAtRaw);
      return closed >= start && closed <= end;
    });
  };

  const applyFilter = () => {
    const filtered = computeFiltered();
    if (onFilter) onFilter(filtered);
  };

  const resetFilter = () => {
    setRange("today");
    setNValue(1);
    setSelectedExpiredSymbol("");
    if (onFilter) onFilter(closedOrders.slice());
  };

  useEffect(() => {
    if (onFilter) onFilter(closedOrders.slice());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closedOrders]);

  // Determine when to show the number input:
  // showNumberInput = true only for day/month/year
  const showNumberInput = range === "day" || range === "month" || range === "year";

  return (
    <div className="w-full md:w-80 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-3 space-y-3">
      <div>
        <label className="text-xs text-[var(--text-secondary)]">Range</label>
        <select
          value={range}
          onChange={(e) => {
            setRange(e.target.value);
            setSelectedExpiredSymbol("");
            setNValue(1);
          }}
          className="w-full mt-1 p-2 bg-[var(--bg-input)] border border-[var(--border-color)] rounded text-sm text-[var(--text-primary)]"
        >
          {RANGE_OPTIONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      {/* show number input only for day/month/year */}
      {showNumberInput && (
        <div>
          <label className="text-xs text-[var(--text-secondary)]">Number (units back from today)</label>
          <input
            type="number"
            min="1"
            value={nValue}
            onChange={(e) => setNValue(e.target.value)}
            className="w-full mt-1 p-2 bg-[var(--bg-input)] border border-[var(--border-color)] rounded text-sm text-[var(--text-primary)]"
            placeholder="1"
          />
          <p className="text-xs text-[var(--text-muted)] mt-1">
            For Day/Month/Year: choose how many units back from today.
          </p>
        </div>
      )}

      {/* show expired symbols dropdown only for expiry range */}
      {range === "expiry" && (
        <div>
          <label className="text-xs text-[var(--text-secondary)]">Expired Symbol (expiry ≤ today)</label>
          <select
            value={selectedExpiredSymbol}
            onChange={(e) => setSelectedExpiredSymbol(e.target.value)}
            className="w-full mt-1 p-2 bg-[var(--bg-input)] border border-[var(--border-color)] rounded text-sm text-[var(--text-primary)]"
          >
            <option value="">— All expired symbols —</option>
            {expiredSymbols.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          {/* <p className="text-xs text-[var(--text-muted)] mt-1">Select a symbol and click Apply to show only expired orders for that symbol.</p> */}
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <button
          onClick={applyFilter}
          className="flex-1 p-2 bg-indigo-600 hover:bg-indigo-500 rounded text-white font-semibold text-sm"
        >
          Apply
        </button>
        <button
          onClick={resetFilter}
          className="flex-1 p-2 bg-transparent border border-[var(--border-color)] rounded text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
        >
          Reset
        </button>
      </div>

      <div className="text-xs text-[var(--text-muted)] mt-2">
        {/* Tip: <span className="text-[var(--text-primary)]">All</span> shows everything. For <span className="text-[var(--text-primary)]">Today</span> or <span className="text-[var(--text-primary)]">Expiry</span> the number input is hidden. */}
      </div>
    </div>
  );
}
