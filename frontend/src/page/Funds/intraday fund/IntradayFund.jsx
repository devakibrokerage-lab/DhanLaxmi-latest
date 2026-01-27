import React, { useState } from "react";
import { Wallet, DollarSign, XCircle, Pencil, Check, X } from "lucide-react";
import { FundMetric, formatCurrency } from "../FundHelpers.jsx";

export default function IntradayFund({ intradayMaxLimit, intradayUsedMargin, onRefresh }) {
  // --- Props & Calculation ---
  const max = Number(intradayMaxLimit ?? 0);
  const used = Number(intradayUsedMargin ?? 0);
  const free = Math.max(0, max - used);

  // --- Local State for Editing ---
  const [isEditing, setIsEditing] = useState(false);
  const [tempLimit, setTempLimit] = useState("");
  const [updating, setUpdating] = useState(false);

  // --- Context & Role ---
  const userString = localStorage.getItem('loggedInUser');
  const userObject = userString ? JSON.parse(userString) : {};
  const userRole = userObject.role; // 'broker' check

  const activeContextString = localStorage.getItem('activeContext');
  const activeContext = activeContextString ? JSON.parse(activeContextString) : {};
  const { brokerId, customerId } = activeContext;
  const token = localStorage.getItem("token");
  const apiBase = import.meta.env.VITE_REACT_APP_API_URL || "http://localhost:8080";

  // --- API Call to Update Limit ---
  const handleUpdateLimit = async () => {
    if (!tempLimit || isNaN(tempLimit)) return;
    setUpdating(true);
    // console.log(tempLimit)
    try {
      const response = await fetch(`${apiBase}/api/funds/updateIntradayAvailableLimit`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          broker_id_str: brokerId,
          customer_id_str: customerId,
          new_limit: Number(tempLimit)
        })
      });

      if (response.ok) {
        setIsEditing(false);
        if (onRefresh) onRefresh(); // Parent ko bolo data refresh kare
      } else {
        alert("Failed to update Intraday Limit");
      }
    } catch (error) {
      console.error("Error updating limit:", error);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="bg-[var(--bg-secondary)] p-4 rounded-xl shadow-inner space-y-2">
      <h3 className="text-[var(--text-primary)] text-lg font-bold mb-3 border-b border-[var(--border-color)] pb-2 flex items-center">
        Intraday Trading Margin
      </h3>

      {/* --- 1. Available Limit (Editable for Broker) --- */}
      <div className="flex justify-between items-center py-2 border-b border-[var(--border-light)]">
        <div className="flex items-center text-[var(--text-secondary)] text-sm">
          <Wallet className="w-4 h-4 mr-2 text-indigo-400" />
          Available Limit
        </div>

        <div className="flex items-center gap-2">
          {isEditing ? (
            // Edit Mode
            <>
              <input
                type="number"
                value={tempLimit}
                onChange={(e) => setTempLimit(e.target.value)}
                className="bg-[var(--bg-card)] text-[var(--text-primary)] text-sm font-bold p-1 rounded border border-indigo-500/50 w-28 focus:outline-none"
                autoFocus
              />
              <button
                onClick={handleUpdateLimit}
                disabled={updating}
                className="p-1 bg-green-600/20 text-green-400 rounded hover:bg-green-600/40 transition"
              >
                <Check size={16} />
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="p-1 bg-red-600/20 text-red-400 rounded hover:bg-red-600/40 transition"
              >
                <X size={16} />
              </button>
            </>
          ) : (
            // Display Mode
            <>
              <span className="text-[var(--text-primary)] font-bold text-base">
                {formatCurrency(max)}
              </span>
              {userRole === 'broker' && (
                <button
                  onClick={() => {
                    setTempLimit(max);
                    setIsEditing(true);
                  }}
                  className="text-gray-600 hover:text-indigo-400 transition p-1"
                  title="Edit Limit"
                >
                  <Pencil size={14} />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* --- 2. Free Limit (Calculated: Max - Used) --- */}
      <FundMetric 
        label="Free Limit (Unused)" 
        value={free} 
        icon={DollarSign} 
        valueColorClass="text-[var(--text-primary)]" 
      />

      {/* --- 3. Used Limit (Blocked) --- */}
      <FundMetric 
        label="Used Limit (Blocked)" 
        value={used} 
        icon={XCircle} 
        valueColorClass="text-[var(--text-primary)]" 
      />
    </div>
  );
}