import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { User, Shield, IdCard, LogOut, UserCheck, Moon, Sun, Loader2, Camera } from "lucide-react";
import { useTheme } from "../../contexts/ThemeContext";

const Row = ({ label, value, icon: Icon }) => (
  <div className="flex items-center justify-between py-2 border-b border-[var(--border-color)] last:border-none">
    <div className="flex items-center gap-2 text-[var(--text-secondary)]">
      {Icon && <Icon className="w-4 h-4 opacity-80" />}
      <span className="text-sm">{label}</span>
    </div>
    <span className="text-[var(--text-primary)] font-semibold text-sm">{value || "—"}</span>
  </div>
);

export default function Profile() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { theme, toggleTheme, isDark } = useTheme();
  const fileInputRef = useRef(null);

  const [customerData, setCustomerData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const apiBase = import.meta.env.VITE_REACT_APP_API_URL || "";
  const token = localStorage.getItem("authToken") || localStorage.getItem("token");

  // ------------------ 1. READ USER & CONTEXT ------------------
  let loggedInUser = null;
  try {
    loggedInUser = JSON.parse(localStorage.getItem("loggedInUser") || "null");
  } catch {
    loggedInUser = null;
  }

  const role = loggedInUser?.role || "customer";
  const userName = loggedInUser?.name || "User";
  const brokerIdStr = localStorage.getItem("associatedBrokerStringId") || "";

  // ✅ STEP 1: Pehle Active Context Read karo
  let activeContext = null;
  try {
    activeContext = JSON.parse(localStorage.getItem("activeContext") || "null");
  } catch {
    activeContext = null;
  }

  const activeCustomerId = activeContext?.customerId || null;
  const customerId = role === "customer" ? loggedInUser?.id : null;

  // ✅ STEP 2: Ab Customer Name nikalo (Sirf tab jab Broker ho AUR Customer ID set ho)
  // Isse Login time par 'null' ya garbage value nahi dikhegi
  const customerName = (role === 'broker' && activeCustomerId) 
      ? localStorage.getItem('customerName') 
      : null;

  // ------------------ REMAINDER LOGIC ------------------
  
  const urlCustomerId = searchParams.get("customerId");
  const viewingCustomerId = urlCustomerId || customerId;
  const isBrokerViewingCustomer = role === "broker" && urlCustomerId;

  useEffect(() => {
    const fetchCustomerData = async () => {
      if (!viewingCustomerId || !token) return;
      setLoading(true);
      try {
        const res = await fetch(`${apiBase}/api/auth/customer/${viewingCustomerId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success && data.customer) {
          setCustomerData(data.customer);
        }
      } catch (error) {
        console.error("Failed to fetch customer data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchCustomerData();
  }, [viewingCustomerId, token, apiBase]);

  const handlePhotoClick = () => {
    if (isBrokerViewingCustomer && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e) => {
    // ... (File upload logic same as before) ...
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/jpg'].includes(file.type)) {
        setUploadError("Only JPG and PNG images are allowed"); return;
    }
    if (file.size > 2 * 1024 * 1024) {
        setUploadError("File size must be less than 2MB"); return;
    }
    setUploadError("");
    setUploading(true);
    try {
        const formData = new FormData();
        formData.append("profilePhoto", file);
        const res = await fetch(`${apiBase}/api/auth/customer/${viewingCustomerId}/profile-photo`, {
            method: "PUT",
            headers: { Authorization: `Bearer ${token}` },
            body: formData
        });
        const data = await res.json();
        if (data.success) {
            setCustomerData(prev => ({ ...prev, profile_photo: data.profile_photo }));
        } else {
            setUploadError(data.message || "Failed to upload photo");
        }
    } catch (error) {
        setUploadError("Failed to upload photo.");
    } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleLogout = () => {
    // ... (Logout logic same as before) ...
    if (token) {
        fetch(`${apiBase}/api/auth/logout`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` }
        }).catch(() => {});
    }
    const keepBrokerId = brokerIdStr;
    localStorage.removeItem("loggedInUser");
    localStorage.removeItem("authToken");
    localStorage.removeItem("token");
    localStorage.removeItem("activeContext");
    localStorage.removeItem("customerName"); // Clear name on logout
    localStorage.setItem("associatedBrokerStringId", keepBrokerId);
    if (keepBrokerId) {
        navigate(`/broker/${keepBrokerId}/customerDetail`, { replace: true });
    } else {
        navigate("/", { replace: true });
    }
  };

  const profilePhoto = customerData?.profile_photo;

  return (
    <div className="p-4 bg-[var(--bg-primary)] min-h-screen text-[var(--text-primary)]">
      <div className="max-w-xl mx-auto">
        <h2 className="text-2xl font-bold mb-2">Profile</h2>
        <div className="h-1 bg-indigo-600 w-16 rounded mb-6" />

        <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl shadow p-5 space-y-4">
          
          <div className="flex items-center gap-4">
            <div 
              className={`relative ${isBrokerViewingCustomer ? 'cursor-pointer group' : ''}`}
              onClick={handlePhotoClick}
            >
              <div className="w-20 h-20 rounded-full overflow-hidden bg-indigo-600/20 flex items-center justify-center border-2 border-indigo-500/30">
                {uploading ? (
                  <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                ) : profilePhoto ? (
                  <img src={profilePhoto} alt="Profile" className="w-full h-full object-cover"/>
                ) : (
                  <User className="w-10 h-10 text-indigo-400" />
                )}
              </div>
              
              {isBrokerViewingCustomer && !uploading && (
                <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Camera className="w-6 h-6 text-white" />
                </div>
              )}
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/jpg" onChange={handleFileChange} className="hidden"/>
            </div>
            
            <div>
              <div className="text-lg font-semibold capitalize">{userName}</div>
              <div className="text-xs text-[var(--text-secondary)] capitalize">Role: {role}</div>
              
              {/* ✅ CONDITION: Customer Name tabhi dikhao jab Broker ho aur Name exist kare */}
              {role === 'broker' && customerName && (
                <div className="text-xs text-[var(--text-secondary)] capitalize mt-1">
                    Currently Viewing: <span className="text-indigo-400 font-medium">{customerName}</span>
                </div>
              )}
            </div>
          </div>

          {uploadError && <div className="text-red-400 text-sm bg-red-500/10 p-2 rounded-lg">{uploadError}</div>}

          <div className="pt-2">
            {role === "customer" && !isBrokerViewingCustomer && (
              <Row label="Customer ID" value={customerId} icon={IdCard} />
            )}

            {isBrokerViewingCustomer && (
              <>
                <Row label="Customer ID" value={viewingCustomerId} icon={IdCard} />
                <Row label="Customer Name" value={customerData?.name} icon={User} />
                <Row label="Joining Date" value={customerData?.joining_date} icon={UserCheck} />
              </>
            )}

            {role === "broker" && !isBrokerViewingCustomer && (
              <>
                <Row label="Broker ID" value={brokerIdStr} icon={Shield} />
                {activeCustomerId && (
                  <Row label="Currently Viewing ID" value={activeCustomerId} icon={UserCheck} />
                )}
              </>
            )}
          </div>

          {/* ... (Theme Toggle & Back/Logout Buttons same as before) ... */}
          <div className="flex items-center justify-between py-3 border-t border-[var(--border-color)]">
            <div className="flex items-center gap-2 text-[var(--text-secondary)]">
              {isDark ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
              <span className="text-sm">{isDark ? 'Dark Mode' : 'Light Mode'}</span>
            </div>
            <button onClick={toggleTheme} className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${isDark ? 'bg-indigo-600' : 'bg-gray-300'}`}>
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-300 ${isDark ? 'translate-x-6' : 'translate-x-0'}`}/>
            </button>
          </div>

          {isBrokerViewingCustomer && (
            <button onClick={() => navigate(-1)} className="w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 bg-gray-600 hover:bg-gray-700 font-semibold shadow transition text-white">
              ← Back to Customers
            </button>
          )}

          {!isBrokerViewingCustomer && (
            <button onClick={handleLogout} className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 bg-indigo-600 hover:bg-indigo-700 font-semibold shadow transition text-white">
              <LogOut className="w-5 h-5" /> Logout
            </button>
          )}

        </div>
      </div>
    </div>
  );
}