import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { RefreshCw, Trash2, User, Calendar, LogOut } from 'lucide-react';
import RegistrationDetailBottomWindow from './RegistrationDetailBottomWindow';

const AdminRegistrations = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedRegistration, setSelectedRegistration] = useState(null);
  const [deleting, setDeleting] = useState(null); // ID of registration being deleted

  const apiBase = import.meta.env.VITE_REACT_APP_API_URL || '';
  const token = localStorage.getItem('token');

  // Check if user is admin
  useEffect(() => {
    const userStr = localStorage.getItem('loggedInUser');
    if (userStr) {
      const user = JSON.parse(userStr);
      if (user.role !== 'admin') {
        navigate('/');
      }
    } else {
      navigate('/');
    }
  }, [navigate]);

  // Fetch registrations
  const fetchRegistrations = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/api/registration/all`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!res.ok) {
        throw new Error('Failed to fetch registrations');
      }

      const data = await res.json();
      setRegistrations(data.registrations || []);
    } catch (err) {
      console.error('[AdminRegistrations] Fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRegistrations();
  }, []);

  // Handle delete
  const handleDelete = async (id, e) => {
    e.stopPropagation(); // Prevent card click

    if (!window.confirm('Are you sure you want to delete this registration?')) {
      return;
    }

    setDeleting(id);
    try {
      const res = await fetch(`${apiBase}/api/registration/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!res.ok) {
        throw new Error('Failed to delete registration');
      }

      // Remove from list
      setRegistrations(prev => prev.filter(r => r._id !== id));
    } catch (err) {
      console.error('[AdminRegistrations] Delete error:', err);
      alert('Failed to delete: ' + err.message);
    } finally {
      setDeleting(null);
    }
  };

  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('authToken');
    localStorage.removeItem('loggedInUser');
    localStorage.removeItem('associatedBrokerStringId');
    localStorage.removeItem('activeContext');
    navigate('/');
  };

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  // Handle card click
  const handleCardClick = (registration) => {
    setSelectedRegistration(registration);
  };

  const tabs = [
    { label: 'Registrations', path: '/admin/registrations' },
    { label: 'Access Token', path: '/admin/access-token' },
  ];

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[var(--bg-secondary)] border-b border-[var(--border-color)] px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold text-[var(--text-primary)]">
            Admin Panel
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchRegistrations}
              disabled={loading}
              className="p-2 rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition disabled:opacity-50"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={handleLogout}
              className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={`px-4 py-2 rounded-lg font-semibold text-sm transition ${location.pathname === tab.path
                  ? 'bg-indigo-600 text-white'
                  : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <p className="text-sm text-[var(--text-muted)] mt-2">
          {registrations.length} registration{registrations.length !== 1 ? 's' : ''} found
        </p>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-3" />
              <p className="text-[var(--text-muted)]">Loading registrations...</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <p className="text-red-400 mb-3">{error}</p>
              <button
                onClick={fetchRegistrations}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
              >
                Try Again
              </button>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && registrations.length === 0 && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <User className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-3" />
              <p className="text-[var(--text-muted)]">No registration requests yet</p>
            </div>
          </div>
        )}

        {/* Registration List */}
        {!loading && !error && registrations.length > 0 && (
          <div className="space-y-3">
            {registrations.map((reg) => (
              <div
                key={reg._id}
                onClick={() => handleCardClick(reg)}
                className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] p-4 cursor-pointer hover:bg-[var(--bg-hover)] transition-all duration-200 active:scale-[0.99]"
              >
                <div className="flex items-center justify-between">
                  {/* Left: Name and Date */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                      <User className="w-5 h-5 text-indigo-400" />
                    </div>

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <h3 className="text-[var(--text-primary)] font-semibold truncate">
                        {reg.firstName} {reg.middleName || ''} {reg.lastName}
                      </h3>
                      <div className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
                        <Calendar className="w-3 h-3" />
                        <span>{formatDate(reg.createdAt)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Delete Button */}
                  <button
                    onClick={(e) => handleDelete(reg._id, e)}
                    disabled={deleting === reg._id}
                    className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition disabled:opacity-50 flex-shrink-0 ml-2"
                  >
                    {deleting === reg._id ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail Bottom Window */}
      <RegistrationDetailBottomWindow
        registration={selectedRegistration}
        onClose={() => setSelectedRegistration(null)}
      />
    </div>
  );
};

export default AdminRegistrations;
