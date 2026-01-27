// src/page/User/ConfirmDeleteDialog.jsx
import React, { useState } from 'react';
import axios from 'axios';

const ConfirmDeleteDialog = ({ isVisible, customer, onClose, onDeleted }) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');

  if (!isVisible || !customer) return null;

  const handleDelete = async () => {
    setIsDeleting(true);
    setError('');
    try {
      const res = await axios.delete(
        `${import.meta.env.VITE_REACT_APP_API_URL}/api/auth/deleteCustomer/${customer.id}`,
        { headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` } }
      );
      if (res.data?.success) {
        onDeleted(customer.id);
        onClose();
      } else {
        setError(res.data?.message || 'Failed to delete customer.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Network error.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-6 shadow-2xl">
        <h3 className="mb-4 text-lg font-bold text-[var(--text-primary)]">Delete Customer?</h3>
        
        <p className="mb-2 text-[var(--text-secondary)]">
          Are you sure you want to delete this customer?
        </p>
        
        <div className="mb-4 rounded-lg bg-[var(--bg-secondary)] p-3">
          <p className="text-sm text-[var(--text-secondary)]">
            <span className="font-medium">Name:</span>{' '}
            <span className="text-[var(--text-primary)]">{customer.name}</span>
          </p>
          <p className="text-sm text-[var(--text-secondary)]">
            <span className="font-medium">ID:</span>{' '}
            <span className="text-[#8aa2ff]">{customer.id}</span>
          </p>
        </div>

        <p className="mb-4 text-sm text-yellow-400">
          ⚠️ Customer will be moved to Recycle Bin. You can restore them later.
        </p>

        {error && (
          <p className="mb-3 text-sm text-red-400">❌ {error}</p>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-gray-600 px-4 py-2 text-white hover:bg-gray-700"
            disabled={isDeleting}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="rounded-lg bg-red-600 px-4 py-2 font-semibold text-white hover:bg-red-700 disabled:opacity-60"
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDeleteDialog;
