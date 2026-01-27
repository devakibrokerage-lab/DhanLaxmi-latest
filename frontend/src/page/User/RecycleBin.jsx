// src/page/User/RecycleBin.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function RecycleBin() {
  const navigate = useNavigate();
  const [deletedCustomers, setDeletedCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errText, setErrText] = useState('');
  const [actionLoading, setActionLoading] = useState(null); // customer id being actioned

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (!token) { window.location.href = '/'; return; }

    (async () => {
      try {
        const res = await axios.get(
          `${import.meta.env.VITE_REACT_APP_API_URL}/api/auth/deleted-customers`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setDeletedCustomers(res.data?.deletedCustomers || []);
      } catch (e) {
        setErrText(e?.response?.data?.message || '❌ Failed to load deleted customers.');
        if (e?.response?.status === 401) window.location.href = '/';
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleRestore = async (customerId) => {
    setActionLoading(customerId);
    try {
      const res = await axios.post(
        `${import.meta.env.VITE_REACT_APP_API_URL}/api/auth/restore-customer/${customerId}`,
        {},
        { headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` } }
      );
      if (res.data?.success) {
        setDeletedCustomers((prev) => prev.filter((c) => c.id !== customerId));
      } else {
        alert(res.data?.message || 'Failed to restore customer.');
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Network error.');
    } finally {
      setActionLoading(null);
    }
  };

  const handlePermanentDelete = async (customerId) => {
    if (!window.confirm('⚠️ This will PERMANENTLY delete the customer. This cannot be undone. Are you sure?')) {
      return;
    }
    setActionLoading(customerId);
    try {
      const res = await axios.delete(
        `${import.meta.env.VITE_REACT_APP_API_URL}/api/auth/permanent-delete/${customerId}`,
        { headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` } }
      );
      if (res.data?.success) {
        setDeletedCustomers((prev) => prev.filter((c) => c.id !== customerId));
      } else {
        alert(res.data?.message || 'Failed to permanently delete customer.');
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Network error.');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) return <div className="p-6 text-[var(--text-secondary)]">Loading deleted customers…</div>;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] p-4">
      {/* Header */}
      <div className="mx-auto mb-4 flex w-full max-w-3xl items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="rounded-lg bg-[var(--bg-secondary)] px-3 py-2 text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
          >
            ← Back
          </button>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">
            🗑️ Recycle Bin
          </h1>
        </div>
        <span className="text-sm text-[var(--text-secondary)]">
          {deletedCustomers.length} deleted customer(s)
        </span>
      </div>

      {/* List */}
      <div className="mx-auto w-full max-w-3xl space-y-4 pb-8">
        {deletedCustomers.map((c) => {
          const summary = c.data_summary || {};
          return (
          <div 
            key={c.id} 
            className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-4 shadow-md"
          >
            <div className="flex flex-col gap-3">
              {/* Top Row: Customer Info & Actions */}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                {/* Customer Info */}
                <div className="space-y-1">
                  <div className="text-lg font-semibold text-[var(--text-primary)]">{c.name}</div>
                  <div className="text-sm">
                    <span className="text-[var(--text-secondary)]">ID:</span>{' '}
                    <span className="text-[#8aa2ff]">{c.id}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-[var(--text-secondary)]">Password:</span>{' '}
                    <span className="font-mono text-green-400">{c.password}</span>
                  </div>
                  <div className="text-xs text-[var(--text-secondary)]">
                    Created: {c.joining_date} | Deleted: {c.deleted_date}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 sm:flex-col">
                  <button
                    onClick={() => handleRestore(c.id)}
                    disabled={actionLoading === c.id}
                    className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
                  >
                    {actionLoading === c.id ? '...' : '↩️ Restore'}
                  </button>
                  <button
                    onClick={() => handlePermanentDelete(c.id)}
                    disabled={actionLoading === c.id}
                    className="rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-60"
                  >
                    {actionLoading === c.id ? '...' : '🗑️ Delete Forever'}
                  </button>
                </div>
              </div>

              {/* Data Summary Section */}
              <div className="border-t border-[var(--border-color)] pt-3">
                <div className="text-xs font-medium text-[var(--text-secondary)] mb-2">📦 Archived Data:</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="rounded-lg bg-[var(--bg-primary)] p-2 text-center">
                    <div className="text-[var(--text-secondary)]">💰 Fund</div>
                    <div className="font-semibold text-[var(--text-primary)]">₹{(summary.fund_balance || 0).toLocaleString()}</div>
                  </div>
                  <div className="rounded-lg bg-[var(--bg-primary)] p-2 text-center">
                    <div className="text-[var(--text-secondary)]">📊 Orders</div>
                    <div className="font-semibold text-[var(--text-primary)]">{summary.total_orders || 0}</div>
                    <div className="text-[10px] text-[var(--text-secondary)]">
                      {summary.open_orders || 0} open / {summary.closed_orders || 0} closed
                    </div>
                  </div>
                  <div className="rounded-lg bg-[var(--bg-primary)] p-2 text-center">
                    <div className="text-[var(--text-secondary)]">📈 Holdings</div>
                    <div className="font-semibold text-[var(--text-primary)]">{summary.total_holdings || 0}</div>
                  </div>
                  <div className="rounded-lg bg-[var(--bg-primary)] p-2 text-center">
                    <div className="text-[var(--text-secondary)]">👁️ Watchlist</div>
                    <div className="font-semibold text-[var(--text-primary)]">{summary.watchlist_count || 0}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          );
        })}

        {!deletedCustomers.length && !errText && (
          <div className="rounded-xl border border-[var(--border-color)] p-6 text-center text-[var(--text-secondary)]">
            🎉 Recycle Bin is empty. No deleted customers.
          </div>
        )}

        {errText && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">
            {errText}
          </div>
        )}
      </div>
    </div>
  );
}
