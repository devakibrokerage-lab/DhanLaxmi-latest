// Order.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, ArrowDown, ArrowLeftRight, Package } from "lucide-react";

import OpenOrder from "./Open Order/OpenOrder";
import CloseOrder from "./Close Order/CloseOrder";
import OvernightOrder from "./Overnight Orders/OvernightOrder";
import HoldOrder from "./Holding/HoldOrder";
import { MOCK_ORDERS, MOCK_HOLDINGS } from "./mockData";

export default function Order() {
  const TABS = [
    { key: "Open", label: "Open", },
    { key: "Closed", label: "Closed",  },
    { key: "Overnight", label: "Overnight", },
    { key: "Holding", label: "Holding", },
  ];

  const counts = useMemo(() => ({
    Open: MOCK_ORDERS.filter(o => o.status === "OPEN").length,
    Closed: MOCK_ORDERS.filter(o => o.status === "CLOSED" || o.status === "CANCELLED").length,
    Overnight: MOCK_ORDERS.filter(o => o.type === "LIMIT").length,
    Holding: MOCK_HOLDINGS.length,
  }), []);

  const [active, setActive] = useState("Open");

  // moving purple indicator
  const wrapRef = useRef(null);
  const pillRefs = useRef({});
  const indicatorRef = useRef(null);

  useEffect(() => {
    const pill = pillRefs.current[active];
    const wrap = wrapRef.current;
    const ind = indicatorRef.current;
    if (!pill || !wrap || !ind) return;
    const pillRect = pill.getBoundingClientRect();
    const wrapRect = wrap.getBoundingClientRect();
    ind.style.width = `${pillRect.width}px`;
    ind.style.transform = `translateX(${pillRect.left - wrapRect.left}px)`;
  }, [active]);

  return (
    <div className="bg-[var(--bg-primary)] text-[var(--text-primary)] p-4 min-h-screen">
      <h2 className="text-lg md:text-xl font-semibold text-[26px] mb-2">Orders</h2>
      {/* Tabs with top indicator */}
      <div className="relative">
        <div className="h-1 relative">
          <div
            ref={indicatorRef}
            className="absolute top-0 left-0 h-1 bg-indigo-500 rounded-full transition-all duration-300"
            style={{ width: 0, transform: "translateX(0px)" }}
          />
        </div>

        <div ref={wrapRef} className="mt-2 flex items-center gap-2">
          {TABS.map(t => {
            const isActive = active === t.key;
            return (
              <button
                key={t.key}
                ref={el => (pillRefs.current[t.key] = el)}
                onClick={() => setActive(t.key)}
                className={`px-3 py-1.5 rounded-full text-[13px] font-semibold transition flex items-center
                  ${isActive ? "bg-indigo-600 text-white" : "bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"}`}
              >
                {t.icon && <span className="mr-1">{t.icon}</span>}
                {t.label} <span className="ml-1 opacity-90"></span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-3">
        {active === "Open" && <OpenOrder />}
        {active === "Closed" && <CloseOrder />}
        {active === "Overnight" && <OvernightOrder />}
        {active === "Holding" && <HoldOrder />}
      </div>
    </div>
  );
}
