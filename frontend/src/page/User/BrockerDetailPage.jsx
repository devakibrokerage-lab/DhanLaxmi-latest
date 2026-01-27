// src/components/BrockerDetailPage.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../../config.js';

// ---------------- Add Broker Modal ----------------
function generateDummyId() {
  return Math.floor(1000000000 + Math.random() * 9000000000).toString();
}

const AddBrokerModal = ({ isVisible, onClose, onBrokerAdded, isSetupMode = false }) => {
  const [formData, setFormData] = useState({ name: '', password: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  if (!isVisible) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setMessage('');
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.password) {
      setMessage('Please enter both name and password.');
      return;
    }
    setIsSubmitting(true);

    // URL definition with fallback
    const url = import.meta.env.VITE_REACT_APP_API_URL || '';

    try {
      const response = await axios.post(
        `${url}/api/auth/add-broker`,
        formData
      );

      if (response.data.success) {
        const newBroker = response.data.newBroker || {
          id: generateDummyId(),
          name: formData.name,
          password: formData.password
        };

        // Pass data to parent to update UI immediately
        onBrokerAdded(newBroker);

        setMessage(`✅ Success! Broker added. Login ID: ${newBroker.id}.`);
        setFormData({ name: '', password: '' });

        // Close modal automatically after success if not setup mode
        if (!isSetupMode) {
          setTimeout(() => {
            onClose();
            setMessage('');
          }, 1500);
        }
      } else {
        setMessage(response.data.message || '❌ Failed to add broker.');
      }
    } catch (error) {
      console.error('Add broker error:', error.response?.data || error.message);
      const status = error.response?.status;
      let errorMessage = '❌ Network error: No data received from server.';
      if (status === 404) errorMessage = '❌ Error: Add Broker API Route Not Found (404).';
      setMessage(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={isSetupMode ? 'w-full max-w-lg mx-auto' : 'fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4'}>
      <div className="bg-[var(--bg-card)] p-6 rounded-xl shadow-2xl w-full max-w-md border border-[var(--border-color)]">
        <h2 className="text-xl font-bold text-[var(--text-primary)] mb-4">
          {isSetupMode ? 'System Setup: Add First Broker' : 'Add New Broker'}
        </h2>

        {message && (
          <p className={`mb-4 font-semibold ${message.startsWith('✅ Success') ? 'text-green-400' : 'text-red-400'}`}>{message}</p>
        )}

        <form onSubmit={handleAddSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Broker Name</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Broker's full name"
              className="w-full p-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-primary)] focus:ring-indigo-500 focus:border-indigo-500"
              disabled={isSubmitting}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Password</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Set initial password"
              className="w-full p-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-primary)] focus:ring-indigo-500 focus:border-indigo-500"
              disabled={isSubmitting}
              required
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            {!isSetupMode && (
              <button type="button" onClick={onClose} className="bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded-lg transition duration-150" disabled={isSubmitting}>
                Cancel
              </button>
            )}
            <button type="submit" className="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg font-semibold transition duration-150 flex items-center" disabled={isSubmitting}>
              {isSubmitting ? (<><i className="fas fa-spinner fa-spin mr-2"></i> Adding...</>) : (isSetupMode ? 'Complete Setup' : 'Add Broker')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ---------------- Main Page ----------------
const BrokerDetailsPage = () => {
  const [brokers, setBrokers] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const loggedInUserName = (() => {
    try {
      const raw = localStorage.getItem('loggedInUser');
      if (!raw) return 'Admin';
      const obj = JSON.parse(raw);
      return obj?.name || 'Admin';
    } catch {
      return 'Admin';
    }
  })();

  // Updated handler to correctly update state
  const handleNewBrokerAdded = (newBrokerData) => {
    console.log("Adding new broker to UI:", newBrokerData);
    setBrokers((prev) => {
      // Prevent duplicate addition if API sends weird data
      if (prev.find(b => b.id === newBrokerData.id)) return prev;
      return [newBrokerData, ...prev];
    });
    // Clear error immediately so the list shows up
    setError(null);
  };

  const fetchBrokers = async () => {
    setLoading(true);
    // URL definition with fallback
    const url = import.meta.env.VITE_REACT_APP_API_URL || '';

    try {
      console.log("Fetching brokers from:", `${url}/api/auth/get-all-brocker`);
      // NOTE: Check spelling in your API. 'brocker' vs 'broker'
      const res = await axios.get(`${url}/api/auth/get-all-brocker`);

      console.log("Fetch response:", res.data);

      if (res.data.success) {
        // Handle if key is 'brokers' or 'data' or just inside response
        const list = res.data.brokers || res.data.data || [];
        setBrokers(list);
        setError(null);
      } else {
        // Even if success is false, if we have empty list, it's not an error state unless we want it to be
        setBrokers([]);
      }
    } catch (err) {
      console.error('Fetch error:', err);
      let msg = '❌ Network error: No data received from server.';
      if (err.response?.status === 404) {
        msg = '❌ Error: Broker List API Route Not Found (404). Check spelling (broker vs brocker).';
      }
      // If we fail to fetch, we keep the list empty but show error
      // However, if we added a broker manually in this session, we might want to keep showing it?
      // For now, let's show the error.
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      window.location.href = '/';
      return;
    }
    fetchBrokers();
  }, []);

  const openBrokerCustomers = (broker) => {
    localStorage.setItem('activeBroker', JSON.stringify(broker));
    navigate(`/broker/${broker.id}/customerDetail`);
  };

  const handleEdit = (brokerId) => {
    alert(`Edit action on Broker ID: ${brokerId}`);
  };

  // --- RENDER LOGIC ---

  if (loading && brokers.length === 0) {
    return <div className="text-center p-12 text-[var(--text-secondary)]">⏳ Loading Broker data...</div>;
  }

  // Condition for "Setup Required": Not loading, Empty List, No API Error
  const showSetupScreen = !loading && brokers.length === 0 && !error;

  if (showSetupScreen) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] p-6 md:p-16 text-[var(--text-primary)] text-center">
        <h1 className="text-4xl font-extrabold mb-4 text-indigo-400">System Setup Required</h1>
        <p className="text-xl mb-8 text-[var(--text-secondary)]">No brokers found in the database. Please add the first Broker.</p>
        {/* Pass the handler correctly here */}
        <AddBrokerModal isVisible={true} onClose={() => { }} onBrokerAdded={handleNewBrokerAdded} isSetupMode={true} />
      </div>
    );
  }

  // If there is an error but we have data (rare), show data. 
  // If error and no data, show error.
  if (error && brokers.length === 0) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] p-8 flex flex-col items-center justify-center">
        <div className="text-center p-12 text-red-500 font-bold text-xl">{error}</div>
        <button onClick={fetchBrokers} className="mt-4 bg-indigo-600 text-white px-4 py-2 rounded">Retry Fetch</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] p-4 md:p-8 flex flex-col ">
      {/* Header */}
      <header className="mb-4 flex justify-between items-center">
        <h1 className="text-2xl md:text-3xl font-bold text-[var(--text-primary)]">
          Broker Management <span className="text-sm text-[var(--text-secondary)] ml-2">({loggedInUserName})</span>
        </h1>
        <div className="hidden md:flex items-center">
          <button onClick={() => setShowAddModal(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded-lg font-semibold transition duration-150 flex items-center space-x-2">
            <i className="fas fa-plus"></i>
            <span>Add New Broker</span>
          </button>
        </div>
      </header>

      {/* List */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-20 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
        {brokers.map((broker) => (
          <div key={broker.id} className="bg-[var(--bg-card)] rounded-xl p-4 border border-[var(--border-color)] shadow-md hover:bg-[var(--bg-hover)] transition">
            <div className="flex flex-wrap justify-between items-center">
              <div className="flex flex-col md:flex-row gap-2 md:gap-8">
                <p className="text-[var(--text-primary)] font-medium text-base"><span className="text-indigo-400 font-semibold">ID:</span> {broker.id}</p>
                <p className="text-[var(--text-secondary)] font-medium text-base">Name: {broker.name}</p>
                {/* Password usually shouldn't be shown, but keeping per your request */}
                {broker.password && (
                  <p className="text-[var(--text-secondary)] font-medium text-base"><span className="text-indigo-400 font-semibold">Pass:</span> {broker.password}</p>
                )}
              </div>
            </div>
            <div className="mt-3 flex space-x-2">
              <button onClick={() => openBrokerCustomers(broker)} className="bg-indigo-600 hover:bg-indigo-700 text-white py-1 px-4 rounded-md text-sm transition">
                View Customers
              </button>
              <button onClick={() => handleEdit(broker.id)} className="bg-red-600 hover:bg-red-700 text-white py-1 px-4 rounded-md text-sm transition">
                Edit
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal for "Add New Broker" button in header */}
      <AddBrokerModal
        isVisible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onBrokerAdded={handleNewBrokerAdded}
        isSetupMode={false}
      />

      {/* Mobile FAB */}
      <div className="md:hidden fixed bottom-5 left-1/2 transform -translate-x-1/2 z-40">
        <button onClick={() => setShowAddModal(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white py-3 px-6 rounded-full shadow-lg flex items-center space-x-3">
          <i className="fas fa-plus"></i>
          <span className="font-semibold">Add Broker</span>
        </button>
      </div>

      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" crossOrigin="anonymous" />
    </div>
  );
};

export default BrokerDetailsPage;