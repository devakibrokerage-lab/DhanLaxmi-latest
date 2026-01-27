import React, { useState, useEffect } from "react";
import { DollarSign, Pencil, Check, X, Phone, Save, Smartphone, Banknote } from "lucide-react";
import { formatCurrency } from "./FundHelpers.jsx";
import IntradayFundCard from "./intraday fund/IntradayFund.jsx";
import OvernightFundCard from "./overnight fund/OvernightFund.jsx";

const Tab = ({ active, label, onClick }) => (
  <button
    onClick={onClick}
    className={`px-4 py-1 rounded-full text-sm font-semibold ${
      active ? "bg-indigo-600 text-white" : "bg-[var(--bg-card)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
    }`}
  >
    {label}
  </button>
);

export default function FundsView() {
  const [tab, setTab] = useState("intraday");
  const [fundsData, setFundsData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Broker Edit States
  const [isEditing, setIsEditing] = useState(false);
  const [tempBalance, setTempBalance] = useState("");
  const [updating, setUpdating] = useState(false);
  const [mobileInput, setMobileInput] = useState("");
  const [mobileUpdating, setMobileUpdating] = useState(false);
  const [isMobileEditing, setIsMobileEditing] = useState(false);

  // Customer Popup State
  const [showPopup, setShowPopup] = useState(false);

  // Context
  const userString = localStorage.getItem('loggedInUser');
  const userObject = userString ? JSON.parse(userString) : {};
  const userRole = userObject.role;

  const activeContextString = localStorage.getItem('activeContext');
  const activeContext = activeContextString ? JSON.parse(activeContextString) : {};
  const { brokerId, customerId } = activeContext;
  const token = localStorage.getItem("token");
  const apiBase = import.meta.env.VITE_REACT_APP_API_URL || "";

  // Fetch Data
  const fetchFunds = async () => {
    if (!brokerId || !customerId) return;
    setLoading(true);
    try {
        const res = await fetch(`${apiBase}/api/funds/getFunds?broker_id_str=${brokerId}&customer_id_str=${customerId}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const result = await res.json();
        if (result.success && result.data) {
            setFundsData(result.data);
            if (result.data.broker_mobile_number) {
                setMobileInput(String(result.data.broker_mobile_number));
            }
        }
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  useEffect(() => { fetchFunds(); }, [brokerId, customerId]);

  // Update Balance (Broker)
  const handleUpdateBalance = async () => {
    if (!tempBalance || isNaN(tempBalance)) return;
    setUpdating(true);
    try {
        const response = await fetch(`${apiBase}/api/funds/updateNetAvailableBalance`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ broker_id_str: brokerId, customer_id_str: customerId, new_balance: Number(tempBalance) })
        });
        if (response.ok) { setIsEditing(false); await fetchFunds(); }
    } catch (error) { console.error(error); } finally { setUpdating(false); }
  };

  // Update Mobile (Broker)
  const handleSaveMobile = async () => {
    if (!mobileInput) return alert("Please enter a mobile number");
    setMobileUpdating(true);
    try {
        const response = await fetch(`${apiBase}/api/funds/updateBrokerMobile`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ broker_id_str: brokerId, customer_id_str: customerId, mobile: Number(mobileInput) })
        });
        if (response.ok) { setIsMobileEditing(false); await fetchFunds(); }
    } catch (error) { console.error(error); } finally { setMobileUpdating(false); }
  };

  const d = {
    net_available_balance: fundsData?.net_available_balance || 0,
    intraday_available: fundsData?.intraday?.available_limit || 0,
    intraday_used: fundsData?.intraday?.used_limit || 0,
    overnight_available: fundsData?.overnight?.available_limit || 0,
    overnight_used: fundsData?.overnight?.used_limit || 0,
    broker_phone: fundsData?.broker_mobile_number || "Not Set"
  };

  if (loading && !fundsData) return <div className="p-10 text-center text-gray-500">Loading Funds...</div>;

  return (
    <div className="p-4 space-y-5 bg-[var(--bg-primary)] min-h-screen pb-24 relative">

      {/* Top Card: Balance */}
      <div className="bg-[var(--bg-secondary)] p-4 rounded-xl border border-indigo-500/50 relative">
        <h3 className="text-[var(--text-secondary)] text-sm mb-1 font-semibold">Net Available Balance (Cash)</h3>
        <div className="flex items-center gap-3">
            {isEditing ? (
                <div className="flex items-center gap-2 mt-1">
                    <span className="text-2xl text-[var(--text-secondary)] font-bold">₹</span>
                    <input type="number" value={tempBalance} onChange={(e) => setTempBalance(e.target.value)} className="bg-[var(--bg-card)] text-[var(--text-primary)] text-xl font-bold p-1 rounded border border-indigo-500/50 w-48 focus:outline-none" autoFocus />
                    <button onClick={handleUpdateBalance} disabled={updating} className="p-1.5 bg-green-600/20 text-green-400 rounded hover:bg-green-600/40 transition"><Check size={20} /></button>
                    <button onClick={() => setIsEditing(false)} className="p-1.5 bg-red-600/20 text-red-400 rounded hover:bg-red-600/40 transition"><X size={20} /></button>
                </div>
            ) : (
                <div className="flex items-center gap-3">
                    <p className="text-3xl font-extrabold ">{formatCurrency(d.net_available_balance)}</p>
                    {userRole === 'broker' && (
                        <button onClick={() => { setTempBalance(d.net_available_balance); setIsEditing(true); }} className="text-gray-500 hover:text-indigo-400 transition p-1 rounded-full hover:bg-white/5"><Pencil size={16} /></button>
                    )}
                </div>
            )}
        </div>
      </div>

      <div className="mt-3 flex gap-3">
        <Tab active={tab === "intraday"} label="Intraday Fund" onClick={() => setTab("intraday")} />
        <Tab active={tab === "overnight"} label="Overnight Fund" onClick={() => setTab("overnight")} />
      </div>

      {tab === "intraday" ? (
        <IntradayFundCard intradayMaxLimit={d.intraday_available} intradayUsedMargin={d.intraday_used} onRefresh={fetchFunds} />
      ) : (
        <OvernightFundCard availableBalance={d.overnight_available} holdingsValue={0} onRefresh={fetchFunds} />
      )}

      {/* --- BROKER: Set Number --- */}
      {userRole === 'broker' && (
        <div className="bg-[var(--bg-secondary)] p-4 rounded-xl shadow-inner border border-[var(--border-color)] mt-6">
            <h3 className="text-[var(--text-primary)] text-lg font-bold mb-3 border-b border-[var(--border-color)] pb-2 flex items-center">
                 <Smartphone className="w-5 h-5 mr-2 text-blue-400" /> Support Contact
            </h3>
            <div className="flex justify-between items-center py-2">
                <div className="flex items-center text-[var(--text-secondary)] text-sm">
                    <Phone className="w-4 h-4 mr-2 text-indigo-400" /> Broker Mobile Number
                </div>
                <div className="flex items-center gap-2">
                    {isMobileEditing ? (
                        <>
                            <input type="number" value={mobileInput} onChange={(e) => setMobileInput(e.target.value)} className="bg-[var(--bg-card)] text-[var(--text-primary)] text-sm font-bold p-1 rounded border border-indigo-500/50 w-32 focus:outline-none" autoFocus placeholder="Enter Number" />
                            <button onClick={handleSaveMobile} disabled={mobileUpdating} className="p-1 bg-green-600/20 text-green-400 rounded hover:bg-green-600/40 transition"><Check size={16} /></button>
                            <button onClick={() => setIsMobileEditing(false)} className="p-1 bg-red-600/20 text-red-400 rounded hover:bg-red-600/40 transition"><X size={16} /></button>
                        </>
                    ) : (
                        <>
                            <span className="text-[var(--text-primary)] font-bold text-base tracking-wider">{mobileInput || "Not Set"}</span>
                            <button onClick={() => setIsMobileEditing(true)} className="text-gray-600 hover:text-indigo-400 transition p-1"><Pencil size={14} /></button>
                        </>
                    )}
                </div>
            </div>
        </div>
      )}

      {/* --- CUSTOMER: Add Fund Button --- */}
      {userRole === 'customer' && (
        <div className="mt-8">
             <button 
                onClick={() => setShowPopup(true)}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition shadow-lg"
             >
                <Banknote className="w-5 h-5" /> Add Funds
             </button>
        </div>
      )}

      {/* --- CUSTOMER POPUP --- */}
      {showPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center relative transform transition-all scale-100">
                <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Phone className="w-8 h-8 text-blue-400" />
                </div>
                <h3 className="text-xl font-bold text-[var(--text-primary)] mb-2">Add Fund Request</h3>
                <p className="text-[var(--text-secondary)] text-sm mb-6">
                    To add funds to your wallet, please contact your broker at this number:
                </p>
                <div className="bg-[var(--bg-primary)] p-4 rounded-lg border border-[var(--border-color)] mb-6">
                    <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">Broker Contact</p>
                    <p className="text-2xl font-mono font-bold text-[var(--text-primary)] tracking-wide select-all">{d.broker_phone}</p>
                </div>
                <button 
                    onClick={() => setShowPopup(false)}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition"
                >
                    Okay
                </button>
            </div>
        </div>
      )}

    </div>
  );
}