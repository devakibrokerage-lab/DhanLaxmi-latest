import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function BrokerRecycleBin() {
    const navigate = useNavigate();
    const [deletedBrokers, setDeletedBrokers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [errText, setErrText] = useState('');
    const [actionLoading, setActionLoading] = useState(null); // broker id being actioned

    useEffect(() => {
        const token = localStorage.getItem('authToken');
        if (!token) { window.location.href = '/'; return; }

        (async () => {
            try {
                const res = await axios.get(
                    `${import.meta.env.VITE_REACT_APP_API_URL}/api/superbroker/deleted-brokers`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                setDeletedBrokers(res.data?.deletedBrokers || []);
            } catch (e) {
                setErrText(e?.response?.data?.message || '❌ Failed to load deleted brokers.');
                if (e?.response?.status === 401) window.location.href = '/';
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const [confirmDialog, setConfirmDialog] = useState(null); // { type: 'restore'|'delete', brokerId: string }

    const openConfirmDialog = (type, brokerId) => {
        setConfirmDialog({ type, brokerId });
    };

    const closeConfirmDialog = () => {
        setConfirmDialog(null);
    };

    const confirmAction = () => {
        if (!confirmDialog) return;
        if (confirmDialog.type === 'restore') {
            handleRestore(confirmDialog.brokerId);
        } else if (confirmDialog.type === 'delete') {
            handlePermanentDelete(confirmDialog.brokerId);
        }
        closeConfirmDialog();
    };

    const handleRestore = async (brokerId) => {
        setActionLoading(brokerId);
        try {
            const res = await axios.post(
                `${import.meta.env.VITE_REACT_APP_API_URL}/api/superbroker/restore-broker/${brokerId}`,
                {},
                { headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` } }
            );
            if (res.data?.success) {
                setDeletedBrokers((prev) => prev.filter((b) => b.id !== brokerId));
                // Optional: Toast success
            } else {
                alert(res.data?.message || 'Failed to restore broker.');
            }
        } catch (err) {
            alert(err.response?.data?.message || 'Network error.');
        } finally {
            setActionLoading(null);
        }
    };

    const handlePermanentDelete = async (brokerId) => {
        setActionLoading(brokerId);
        try {
            const res = await axios.delete(
                `${import.meta.env.VITE_REACT_APP_API_URL}/api/superbroker/permanent-delete/${brokerId}`,
                { headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` } }
            );
            if (res.data?.success) {
                setDeletedBrokers((prev) => prev.filter((b) => b.id !== brokerId));
            } else {
                alert(res.data?.message || 'Failed to permanently delete broker.');
            }
        } catch (err) {
            alert(err.response?.data?.message || 'Network error.');
        } finally {
            setActionLoading(null);
        }
    };

    if (loading) return <div className="p-6 text-[var(--text-secondary)]">Loading deleted brokers…</div>;

    return (
        <div className="min-h-screen bg-[var(--bg-primary)] p-4 relative">
            {/* Confirmation Modal */}
            {confirmDialog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
                    <div className="w-full max-w-sm rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-6 shadow-2xl animate-fade-in-up">
                        <h3 className="mb-2 text-lg font-bold text-[var(--text-primary)]">
                            {confirmDialog.type === 'restore' ? 'Restore Broker?' : 'Delete Forever?'}
                        </h3>
                        <p className="mb-6 text-sm text-[var(--text-secondary)]">
                            {confirmDialog.type === 'restore'
                                ? 'This will restore the broker and all associated customers. They will be able to log in again.'
                                : '⚠️ This will PERMANENTLY delete the broker, all customers, and ALL associated data (Orders, Funds, etc). This cannot be undone.'}
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={closeConfirmDialog}
                                className="rounded-lg bg-gray-600 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmAction}
                                className={`rounded-lg px-4 py-2 text-sm font-medium text-white ${confirmDialog.type === 'restore'
                                        ? 'bg-green-600 hover:bg-green-700'
                                        : 'bg-red-600 hover:bg-red-700'
                                    }`}
                            >
                                {confirmDialog.type === 'restore' ? 'Confirm Restore' : 'Confirm Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="mx-auto mb-4 flex w-full max-w-3xl items-center justify-between">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate(-1)}
                        className="rounded-lg bg-[var(--bg-secondary)] px-3 py-2 text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
                    >
                        ← Back
                    </button>
                    {/* <h1 className="text-2xl font-bold text-[var(--text-primary)]">
                        🗑️ Broker Recycle Bin
                    </h1> */}
                </div>
                <span className="text-sm text-[var(--text-secondary)]">
                    {deletedBrokers.length} deleted broker(s)
                </span>
            </div>

            {/* List */}
            <div className="mx-auto w-full max-w-3xl space-y-4 pb-8">
                {deletedBrokers.map((b) => {
                    return (
                        <div key={b.id} className="relative rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-4 shadow-sm transition hover:bg-[var(--bg-hover)]">
                            <div className="flex flex-col gap-4">
                                <div className="flex items-start justify-between">
                                    <div className="space-y-1">
                                        <h3 className="text-lg font-bold text-[var(--text-primary)]">
                                            {b.name}
                                            {b.organization_name && <span className="text-xs text-[var(--text-secondary)] font-normal ml-2">({b.organization_name})</span>}
                                        </h3>
                                        <div className="text-sm">
                                            <span className="text-[var(--text-secondary)]">Login ID:</span>{' '}
                                            <span className="text-[#8aa2ff]">{b.id}</span>
                                        </div>
                                        <div className="text-sm">
                                            <span className="text-[var(--text-secondary)]">Password:</span>{' '}
                                            <span className="text-indigo-400 font-mono">{b.password}</span>
                                        </div>
                                        <div className="text-xs text-[var(--text-secondary)]">
                                            Deleted At: {b.deleted_at}
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-2 sm:flex-row">
                                        <button
                                            onClick={() => openConfirmDialog('restore', b.id)}
                                            disabled={actionLoading === b.id}
                                            className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
                                        >
                                            {actionLoading === b.id ? '...' : 'Restore'}
                                        </button>
                                        <button
                                            onClick={() => openConfirmDialog('delete', b.id)}
                                            disabled={actionLoading === b.id}
                                            className="rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-60"
                                        >
                                            {actionLoading === b.id ? '...' : 'Delete Forever'}
                                        </button>
                                    </div>
                                </div>

                                {/* Data Summary Section */}
                                <div className="border-t border-[var(--border-color)] pt-3">
                                    <div className="flex gap-4 text-xs">
                                        <div className="rounded-lg bg-[var(--bg-primary)] p-2 text-center min-w-[100px]">
                                            <div className="text-[var(--text-secondary)]">👥 Customers</div>
                                            <div className="font-semibold text-[var(--text-primary)]">{b.customers_count || 0}</div>
                                        </div>
                                    </div>

                                    {/* Collapsible Customer List */}
                                    {b.customers && b.customers.length > 0 && (
                                        <details className="mt-3 group">
                                            <summary className="cursor-pointer text-xs font-semibold text-blue-400 hover:text-blue-300 select-none">
                                                View Archived Customers ({b.customers.length})
                                            </summary>
                                            <div className="mt-2 max-h-40 overflow-y-auto rounded bg-[var(--bg-primary)] p-2">
                                                <table className="w-full text-left text-xs">
                                                    <thead>
                                                        <tr className="text-[var(--text-secondary)] border-b border-[var(--border-color)]">
                                                            <th className="pb-1">Name</th>
                                                            <th className="pb-1">ID</th>
                                                            <th className="pb-1">Password</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="text-[var(--text-primary)]">
                                                        {b.customers.map((c, idx) => (
                                                            <tr key={idx} className="border-b border-[var(--border-color)]/50 last:border-0 hover:bg-white/5">
                                                                <td className="py-1">{c.name}</td>
                                                                <td className="py-1 text-[#8aa2ff]">{c.customer_id}</td>
                                                                <td className="py-1 font-mono text-amber-400">{c.password}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </details>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}

                {!loading && deletedBrokers.length === 0 && (
                    <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-8 text-center text-[var(--text-secondary)]">
                        <div className="mb-2 text-4xl">🗑️</div>
                        <p>Recycle bin is empty.</p>
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
