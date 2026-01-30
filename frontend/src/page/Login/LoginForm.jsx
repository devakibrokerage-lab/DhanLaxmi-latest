import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { preloadSecondaryPages } from '../../App.jsx';
import { API_URL } from '../../config.js';

const superBrockerId = '9999912345';
const superBrockerPass = '7180';

const InputField = ({ iconClass, type, name, placeholder, value, onChange, error }) => (
  <div className="relative mb-6">
    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-[var(--text-secondary)]">
      <i className={iconClass}></i>
    </div>
    <input
      type={type}
      name={name}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      className={`w-full p-3 pl-10 rounded-lg bg-[var(--bg-input)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50 transition duration-200 border ${error ? 'border-red-500' : 'border-transparent'
        } focus:border-indigo-500 shadow-inner`}
      required
      autoComplete={name === 'password' ? 'current-password' : 'username'}
    />
    {error && <p className="text-red-400 text-xs mt-1 absolute -bottom-5 left-0">{error}</p>}
  </div>
);

const LoginForm = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ identifier: '', password: '' });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiMessage, setApiMessage] = useState({ text: '', type: '' });

  const validate = (data) => {
    const newErrors = {};
    const digitRegex = /^\d{10}$/;
    const adminRegex = /^admin\d+$/; // Allow admin123, admin456, etc.

    // Translated validation messages
    if (!data.identifier) newErrors.identifier = 'Login ID is required.';
    else if (!digitRegex.test(data.identifier) && !adminRegex.test(data.identifier)) {
      newErrors.identifier = 'ID must be 10 digits or valid admin ID.';
    }

    if (!data.password) newErrors.password = 'Password is required.';

    return newErrors;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: null }));
    setApiMessage({ text: '', type: '' });
  };

  // ---- helper: compute final redirect
  const computeRedirect = (role, assocBrokerId) => {
    // Admin redirects to registration requests page
    if (role === 'admin') {
      return '/admin/registrations';
    }
    if (role === 'broker') {
      const id = assocBrokerId || localStorage.getItem('associatedBrokerStringId');
      return id ? `/broker/${id}/customerDetail` : '/customerDetail';
    }
    // customer
    return '/watchlist';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validate(formData);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length) return;

    setIsSubmitting(true);
    setApiMessage({ text: '', type: '' });

    // ✅ SUPER BROKER (local)
    if (formData.identifier === superBrockerId && formData.password === superBrockerPass) {
      const fakeToken = 'super-broker-local-token';
      const user = { id: formData.identifier, name: 'Super Broker', role: 'broker' };

      localStorage.setItem('token', fakeToken);
      localStorage.setItem('authToken', fakeToken);
      localStorage.setItem('loggedInUser', JSON.stringify(user));

      localStorage.setItem('associatedBrokerStringId', superBrockerId);

      axios.defaults.headers.common['Authorization'] = `Bearer ${fakeToken}`;

      // Preload secondary pages in background
      preloadSecondaryPages();

      navigate('/brockerDetail'); // polite React redirect

      setIsSubmitting(false);
      return;
    }

    const apiUrl = API_URL;
    console.log("[Login] API URL:", apiUrl); // Debug log to check env var
    try {
      const res = await axios.post(
        `${apiUrl}/api/auth/login`,
        formData
      );

      if (res.data?.success) {
        console.log('[LoginForm] Response Data:', res.data); // Debug Log
        const { name, role, token, associatedBrokerStringId, organizationName } = res.data;
        const user = { id: formData.identifier, name, role };

        console.log('[LoginForm] Organization Name extracted:', organizationName); // Debug Log

        if (organizationName) {
          localStorage.setItem('organizationName', organizationName);
        } else {
          console.warn('[LoginForm] Organization Name missing, using default.');
          localStorage.setItem('organizationName', 'DHANLAXMI');
        }

        localStorage.setItem('token', token);
        localStorage.setItem('authToken', token);
        localStorage.setItem('loggedInUser', JSON.stringify(user));
        if (associatedBrokerStringId) {
          localStorage.setItem('associatedBrokerStringId', associatedBrokerStringId);
          localStorage.setItem('activeContext', JSON.stringify({ brokerId: associatedBrokerStringId, customerId: user.id }));

        }

        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

        // Preload secondary pages in background
        preloadSecondaryPages();

        setApiMessage("Login successful..");

        // 🔁 CHANGED: broker -> /broker/:id/customerDetail ; customer -> /watchlist
        const redirectionPath = computeRedirect(role, associatedBrokerStringId);

        // Use navigate for smooth SPA transition instead of full reload
        setTimeout(() => {
          navigate(redirectionPath, { replace: true });
        }, 600);
      } else {
        setApiMessage({ text: res.data?.message || 'Login failed.', type: 'error' });
      }
    } catch (err) {
      // Handle different error response formats
      const errorData = err.response?.data;
      let msg;

      if (err.response) {
        // Server responded with an error status
        msg = errorData?.message || errorData?.error || `Login failed (${err.response.status})`;
      } else if (err.request) {
        // Request made but no response received
        msg = 'Network error: Server unreachable. Please check your connection.';
      } else {
        // Something else went wrong
        msg = err.message || 'An unexpected error occurred.';
      }

      setApiMessage({ text: msg, type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-4">
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"
        crossOrigin="anonymous"
      />
      <div
        className="w-full max-w-sm p-8 bg-[var(--bg-card)] rounded-xl shadow-lg border border-[var(--border-color)]"
      >
        <h1 className="text-3xl font-extrabold text-[var(--text-primary)] mb-8 text-center tracking-wide">Sign In</h1>

        {apiMessage.text && (
          <div
            className={`p-3 mb-4 rounded-lg font-semibold text-sm text-center ${apiMessage.type === 'success' ? 'bg-green-600/20 text-green-400' : 'bg-red-600/20 text-red-400'
              }`}
          >
            {apiMessage.text}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <InputField
            iconClass="fas fa-id-card"
            type="text"
            name="identifier"
            placeholder="10-Digit Login ID"
            value={formData.identifier}
            onChange={handleChange}
            error={errors.identifier}
          />
          <InputField
            iconClass="fas fa-lock"
            type="password"
            name="password"
            placeholder="Password"
            value={formData.password}
            onChange={handleChange}
            error={errors.password}
          />



          <button
            type="submit"
            className="w-full py-3 rounded-lg text-base sm:text-lg font-bold text-white uppercase bg-indigo-600 hover:bg-indigo-700 transition duration-200 shadow-md disabled:bg-gray-500 flex items-center justify-center space-x-2"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <i className="fas fa-spinner fa-spin"></i> <span>Logging In...</span>
              </>
            ) : (
              'Login'
            )}
          </button>
        </form>

        {/* Registration Link */}
        <div className="mt-6 pt-6 border-t border-[var(--border-color)]">
          <p className="text-[var(--text-secondary)] text-center mb-3">Don't have an account?</p>
          <button
            onClick={() => navigate('/register')}
            className="w-full py-3 rounded-lg text-base sm:text-lg font-semibold text-indigo-400 border-2 border-indigo-500 hover:bg-indigo-500/20 transition duration-200 flex items-center justify-center space-x-2"
          >
            <i className="fas fa-user-plus"></i>
            <span>Create New Account</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;