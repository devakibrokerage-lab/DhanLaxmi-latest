import React, { useState } from "react";
import { TrendingUp, Wallet, Clock, Pencil, Check, X } from "lucide-react";
import { FundMetric, formatCurrency } from "../FundHelpers.jsx";

export default function OvernightFund({ availableBalance, holdingsValue, onRefresh }) {
  // --- Props ---
  const cash = Number(availableBalance ?? 0);
  // const stock = Number(holdingsValue ?? 0); // Agar future me use karna ho

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
  const apiBase = import.meta.env.VITE_REACT_APP_API_URL || "";

  // --- API Call to Update Limit ---
  const handleUpdateLimit = async () => {
    if (!tempLimit || isNaN(tempLimit)) return;
    setUpdating(true);

    try {
      // Alag API Endpoint Overnight ke liye
      const response = await fetch(`${apiBase}/api/funds/updateOvernightAvailableLimit`, {
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
        alert("Failed to update Overnight Limit");
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
        <Clock className="w-5 h-5 mr-2 text-indigo-400" /> Overnight / Delivery Limit
      </h3>

      {/* --- Available Limit (Editable Section) --- */}
      <div className="flex justify-between items-center py-2 border-b border-[var(--border-light)]">
        <div className="flex items-center text-[var(--text-secondary)] text-sm">
          <Wallet className="w-4 h-4 mr-2 text-indigo-400" />
          Available Limit (Cash)
        </div>

        <div className="flex items-center gap-2">
          {isEditing ? (
            // --- Edit Mode ---
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
            // --- Display Mode ---
            <>
              <span className="text-[var(--text-primary)] font-bold text-base">
                {formatCurrency(cash)}
              </span>
              
              {/* Only Broker can edit */}
              {userRole === 'broker' && (
                <button
                  onClick={() => {
                    setTempLimit(cash);
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
      
    </div>
  );
}