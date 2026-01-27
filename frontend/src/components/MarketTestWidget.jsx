import { useEffect, useMemo, useState } from "react";
import { useMarketTicks } from "../hooks/useMarketTicks.js";

/**
 * Minimal test widget:
 * - Searches 4 seeds
 * - Picks one contract per seed (prefers FUT)
 * - Subscribes to ticks and shows live LTP/quotes
 */
export default function MarketTestWidget({
  apiBase = import.meta.env.VITE_REACT_APP_API_URL || "http://localhost:8080",
  socketBase = import.meta.env.VITE_REACT_APP_API_URL || "http://localhost:8080",
  seeds = ["NIFTY", "BANKNIFTY", "FINNIFTY", "CRUDEOIL"], // change as you like
}) {
  const { ticks, subscribe } = useMarketTicks(socketBase);
  const [loading, setLoading] = useState(false);
  const [chosen, setChosen] = useState([]); // [{securityId, segment, tradingsymbol, symbol_name, expiry, lotSize}...]
  const [error, setError] = useState("");

  const api = useMemo(() => ({
    search: async (q) => {
      const r = await fetch(`${apiBase}/api/instruments/search?q=${encodeURIComponent(q)}`);
      if (!r.ok) throw new Error(`search failed: ${q}`);
      return r.json();
    }
  }), [apiBase]);

  // Pick "best" row from search results: prefer FUT, else first
  const pickOne = (rows) => {
    if (!Array.isArray(rows) || !rows.length) return null;
    const fut = rows.find(r => String(r.instrumentType).toUpperCase() === "FUT");
    return fut || rows[0];
  };

  // Initial load: find 1 contract per seed, then subscribe
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError("");

        const picks = [];
        for (const seed of seeds) {
          try {
            const rows = await api.search(seed);
            const one = pickOne(rows);
            if (one && one.securityId && one.segment) {
              picks.push({
                securityId: String(one.securityId),
                segment: one.segment, // 'NSE_FNO' | 'MCX_COMM' | etc.
                tradingsymbol: one.tradingsymbol || one.symbol_name || seed,
                symbol_name: one.symbol_name || one.tradingsymbol || seed,
                expiry: one.expiry ? new Date(one.expiry).toISOString().slice(0,10) : null,
                lotSize: one.lotSize ?? null,
              });
            }
          } catch (e) {
            // ignore individual seed failure, continue
            console.warn("search error:", seed, e?.message || e);
          }
        }

        if (!cancelled) {
          setChosen(picks);
          if (picks.length) {
            const ack = await subscribe(picks.map(p => ({ segment: p.segment, securityId: p.securityId })));
            console.log("subscribe ack:", ack);
          } else {
            setError("No instruments found for test seeds.");
          }
        }
      } catch (e) {
        if (!cancelled) setError(e?.message || "Failed to prepare subscriptions");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [api, seeds, subscribe]);

  return (
    <div style={{ padding: 16, fontFamily: "Inter, system-ui, Arial", maxWidth: 900 }}>
      <h2 style={{ marginBottom: 8 }}>Market Test Widget</h2>
      <div style={{ fontSize: 12, color: "#666", marginBottom: 12 }}>
        Auto-searching: {seeds.join(", ")} → picking one contract each → subscribing via Socket.IO
      </div>

      {loading && <div>Loading instruments…</div>}
      {error && <div style={{ color: "crimson" }}>{error}</div>}

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
            <th style={{ padding: "8px 6px" }}>Symbol</th>
            <th style={{ padding: "8px 6px" }}>Segment</th>
            <th style={{ padding: "8px 6px" }}>SecurityId</th>
            <th style={{ padding: "8px 6px" }}>Expiry</th>
            <th style={{ padding: "8px 6px" }}>Lot</th>
            <th style={{ padding: "8px 6px" }}>LTP</th>
            <th style={{ padding: "8px 6px" }}>Bid</th>
            <th style={{ padding: "8px 6px" }}>Ask</th>
            <th style={{ padding: "8px 6px" }}>% Chg</th>
          </tr>
        </thead>
        <tbody>
          {chosen.map((c) => {
            const t = ticks.get(String(c.securityId));
            return (
              <tr key={c.securityId} style={{ borderBottom: "1px solid #f1f1f1" }}>
                <td style={{ padding: "8px 6px" }}>{c.tradingsymbol || c.symbol_name}</td>
                <td style={{ padding: "8px 6px" }}>{c.segment}</td>
                <td style={{ padding: "8px 6px", fontFamily: "monospace" }}>{c.securityId}</td>
                <td style={{ padding: "8px 6px" }}>{c.expiry || "-"}</td>
                <td style={{ padding: "8px 6px" }}>{c.lotSize ?? "-"}</td>
                <td style={{ padding: "8px 6px", fontVariantNumeric: "tabular-nums" }}>{t?.ltp ?? "-"}</td>
                <td style={{ padding: "8px 6px", fontVariantNumeric: "tabular-nums" }}>{t?.bestBidPrice ?? "-"}</td>
                <td style={{ padding: "8px 6px", fontVariantNumeric: "tabular-nums" }}>{t?.bestAskPrice ?? "-"}</td>
                <td style={{ padding: "8px 6px", fontVariantNumeric: "tabular-nums" }}>
                  {t?.percentChange ?? "-"}
                </td>
              </tr>
            );
          })}
          {!chosen.length && !loading && (
            <tr><td colSpan={9} style={{ padding: 12, color: "#999" }}>No instruments selected</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
