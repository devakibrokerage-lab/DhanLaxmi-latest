// src/components/CutomerDetailPage.jsx
import React, { useEffect, useState } from 'react';
import { useParams, useLocation, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import ConfirmDeleteDialog from './ConfirmDeleteDialog';
import { API_URL } from '../../config.js';

/* ---------- Add Customer Modal (no external icons) ---------- */
const AddCustomerModal = ({ isVisible, onClose, onCustomerAdded }) => {
  const [formData, setFormData] = useState({ name: '', password: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  if (!isVisible) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((p) => ({ ...p, [name]: value }));
    setMessage('');
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.password) {
      setMessage('Kripya naam aur password dono daalein.');
      return;
    }
    setIsSubmitting(true);
    try {

      const url = API_URL;

      const res = await axios.post(
        `${url}/api/auth/addCustomer`,
        formData,
        { headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` } }
      );
      if (res.data?.success && res.data?.newCustomer) {
        onCustomerAdded(res.data.newCustomer);
        onClose();
      } else {
        setMessage(res.data?.message || '❌ Customer add nahi ho paya.');
      }
    } catch (err) {
      setMessage(err.response?.data?.message || '❌ Network error.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-6 shadow-2xl">
        <h3 className="mb-4 text-lg font-bold text-[var(--text-primary)]">Naya Customer Jodein</h3>
        {message && (
          <p className={`mb-3 text-sm ${message.startsWith('❌') ? 'text-red-400' : 'text-green-400'}`}>
            {message}
          </p>
        )}
        <form onSubmit={handleAddSubmit} className="space-y-3">
          <label className="block text-sm text-[var(--text-secondary)]">
            <span className="mb-1 block font-medium">Customer Naam</span>
            <input
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-input)] p-2 text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-indigo-600"
              placeholder="Customer ka poora naam"
              required
              disabled={isSubmitting}
            />
          </label>
          <label className="block text-sm text-[var(--text-secondary)]">
            <span className="mb-1 block font-medium">Password</span>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-input)] p-2 text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-indigo-600"
              placeholder="Login Password set karein"
              required
              disabled={isSubmitting}
            />
          </label>

          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-gray-600 px-4 py-2 text-white hover:bg-gray-700"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-green-600 px-4 py-2 font-semibold text-white hover:bg-green-700 disabled:opacity-60"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Adding…' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ---------------- Main Page ---------------- */
export default function CustomerDetailsPage() {
  const { brokerId: urlBrokerId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  // Safe read from localStorage
  let activeBroker = null;
  try { activeBroker = JSON.parse(localStorage.getItem('activeBroker') || 'null'); } catch { activeBroker = null; }
  let loggedInUser = null;
  try { loggedInUser = JSON.parse(localStorage.getItem('loggedInUser') || 'null'); } catch { loggedInUser = null; }

  // Only for title/display (data is decided by token)
  const queryParams = new URLSearchParams(location.search);
  const displayBrokerId = activeBroker?.id || queryParams.get('brokerId') || urlBrokerId || loggedInUser?.id || '-';

  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errText, setErrText] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null); // Customer to delete

  const handleCustomerAdded = (c) => setCustomers((prev) => [c, ...prev]);
  const handleCustomerDeleted = (id) => setCustomers((prev) => prev.filter((c) => c.id !== id));

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (!token) { window.location.href = '/'; return; }

    (async () => {
      try {
        const url = API_URL;

        const res = await axios.get(
          `${url}/api/auth/getCustomers`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        console.log(res)
        setCustomers(res.data?.customers || []);
        console.log(customers)
      } catch (e) {
        setErrText(e?.response?.data?.message || '❌ Failed to load customers.');
        if (e?.response?.status === 401) window.location.href = '/';
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // View → open watchlist with brokerId(from localStorage) + customerId
  const openWatchlist = (customerId) => {
    const brokerId10 = loggedInUser?.id || displayBrokerId;

    if (!brokerId10) return alert('Broker ID missing.');
    if (!customerId) return alert('Customer ID missing.');

    // ✅ STEP 1: Find the specific customer object from the array
    const selectedCustomer = customers.find((c) => c.id === customerId);

    // ✅ STEP 2: Get the name safely
    const customerName = selectedCustomer ? selectedCustomer.name : "Unknown Customer";

    console.log('Selected Customer Name:', customerName);

    localStorage.setItem('activeContext', JSON.stringify({ brokerId: brokerId10, customerId }));

    // ✅ STEP 3: Save the name correctly
    localStorage.setItem('customerName', customerName);

    navigate(`/watchlist?brokerId=${encodeURIComponent(brokerId10)}&customerId=${encodeURIComponent(customerId)}`);
  };

  if (loading) return <div className="p-6 text-[var(--text-secondary)]">Loading customers…</div>;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] p-4">
      {/* Header */}
      <div className="mx-auto mb-4 flex w-full max-w-3xl items-center justify-between">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">
          Customers <span className="ml-2 text-sm font-semibold text-[var(--text-secondary)]">({displayBrokerId})</span>
        </h1>
        <Link
          to="/recycle-bin"
          className="rounded-lg bg-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
        >
          🗑️ Recycle Bin
        </Link>
      </div>

      {/* List */}
      <div className="mx-auto w-full max-w-3xl space-y-4 pb-24">
        {customers.map((c) => (
          <div key={c.id} className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-4 shadow-md transition hover:bg-[var(--bg-hover)]">
            <div className="flex items-start justify-between">
              <div className='flex flex-col space-y-2'>
                <div className="text-sm font-semibold">
                  <span className="text-[var(--text-secondary)]">ID:</span>{' '}
                  <span className="text-[#8aa2ff]">{c.id}</span>
                </div>

                <div className="text-sm font-semibold">
                  <span className="text-[var(--text-secondary)]">password:</span>{' '}
                  <span className="text-[#8aa2ff]">{c.password}</span>
                </div>
              </div>
              <div className="text-right text-[var(--text-primary)]">{c.name} </div>

            </div>

            <div className="mt-3 flex gap-2">
              <button
                onClick={() => openWatchlist(c.id)}
                className="rounded-md bg-[#6C63FF] px-4 py-1 text-sm font-medium text-white hover:bg-indigo-600"
                type="button"
              >
                View
              </button>
              <Link
                to={`/profile?customerId=${encodeURIComponent(c.id)}`}
                className="rounded-md bg-yellow-600 px-4 py-1 text-sm font-medium text-white hover:bg-yellow-700"
              >
                Edit
              </Link>
              <button
                onClick={() => setDeleteTarget(c)}
                className="rounded-md bg-red-600 px-4 py-1 text-sm font-medium text-white hover:bg-red-700"
                type="button"
              >
                Delete
              </button>
            </div>
          </div>
        ))}

        {!customers.length && !errText && (
          <div className="rounded-xl border border-[var(--border-color)] p-6 text-center text-[var(--text-secondary)]">
            No customers found.
          </div>
        )}

        {errText && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">
            {errText}
          </div>
        )}
      </div>

      {/* Floating Add */}
      <div className="fixed bottom-5 left-1/2 -translate-x-1/2">
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 rounded-full bg-[#6C63FF] px-5 py-3 font-semibold text-white shadow-lg hover:bg-indigo-600"
        >
          + Add Customer
        </button>
      </div>

      <AddCustomerModal
        isVisible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onCustomerAdded={handleCustomerAdded}
      />

      <ConfirmDeleteDialog
        isVisible={!!deleteTarget}
        customer={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDeleted={handleCustomerDeleted}
      />
    </div>
  );
}
