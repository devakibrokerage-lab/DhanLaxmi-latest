// src/page/User/ConfirmDeleteBrokerDialog.jsx
import React, { useState } from 'react';
import axios from 'axios';

const ConfirmDeleteBrokerDialog = ({ isVisible, broker, onClose, onDeleted }) => {
    const [isDeleting, setIsDeleting] = useState(false);
    const [error, setError] = useState('');

    if (!isVisible || !broker) return null;

    const handleDelete = async () => {
        setIsDeleting(true);
        setError('');
        try {
            const url = import.meta.env.VITE_REACT_APP_API_URL || '';
            const res = await axios.delete(
                `${url}/api/superbroker/delete-broker/${broker.id}`,
                { headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` } }
            );

            if (res.data?.success) {
                onDeleted(broker.id);
                onClose();
            } else {
                setError(res.data?.message || 'Failed to delete broker.');
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Network error.');
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-6 shadow-2xl transform transition-all scale-100">
                <h3 className="mb-4 text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
                    <i className="fas fa-exclamation-triangle text-amber-500"></i>
                    Delete Broker?
                </h3>

                <p className="mb-4 text-[var(--text-secondary)]">
                    Are you sure you want to delete <span className="font-bold text-[var(--text-primary)]">{broker.name}</span>?
                </p>

                <div className="mb-6 rounded-lg bg-red-500/10 border border-red-500/20 p-4">
                    <p className="text-sm text-red-400 font-semibold mb-1">
                        ⚠️ Critical Warning
                    </p>
                    <p className="text-xs text-red-300/80">
                        Deleting this broker will move <strong>ALL associated Customers</strong> and their active data (Funds, Orders, etc.) to the Recycle Bin immediately.
                    </p>
                </div>

                {error && (
                    <p className="mb-4 text-sm bg-red-500/10 text-red-400 p-2 rounded border border-red-500/20">
                        ❌ {error}
                    </p>
                )}

                <div className="flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg bg-gray-600 px-4 py-2 text-white hover:bg-gray-700 transition-colors"
                        disabled={isDeleting}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleDelete}
                        className="rounded-lg bg-red-600 px-5 py-2 font-semibold text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all shadow-lg shadow-red-900/20"
                        disabled={isDeleting}
                    >
                        {isDeleting ? (
                            <>
                                <i className="fas fa-circle-notch fa-spin"></i>
                                <span>Deleting...</span>
                            </>
                        ) : (
                            <>
                                <i className="fas fa-trash-alt"></i>
                                <span>Confirm Delete</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmDeleteBrokerDialog;
