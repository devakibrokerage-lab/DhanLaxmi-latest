import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

// Reusable Input Field Component
const InputField = ({ label, type, name, placeholder, value, onChange, error, required = false, maxLength, pattern }) => (
  <div className="mb-4">
    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <input
      type={type}
      name={name}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      maxLength={maxLength}
      pattern={pattern}
      className={`w-full p-3 rounded-lg bg-[var(--bg-input)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50 transition duration-200 border ${
        error ? 'border-red-500' : 'border-[var(--border-color)]'
      } focus:border-indigo-500`}
    />
    {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
  </div>
);

// File Upload Component
const FileUploadField = ({ label, name, onChange, error, required = false, preview }) => (
  <div className="mb-4">
    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
      {label} {required && <span className="text-red-500">*</span>}
      <span className="text-xs text-[var(--text-muted)] ml-2">(Max 5MB, JPG/PNG)</span>
    </label>
    <div className="relative">
      <input
        type="file"
        name={name}
        accept="image/jpeg,image/png,image/jpg"
        onChange={onChange}
        className="hidden"
        id={`file-${name}`}
      />
      <label
        htmlFor={`file-${name}`}
        className={`flex items-center justify-center w-full p-4 rounded-lg border-2 border-dashed cursor-pointer transition duration-200 ${
          error ? 'border-red-500 bg-red-500/10' : 'border-[var(--border-color)] bg-[var(--bg-input)] hover:border-indigo-500 hover:bg-indigo-500/10'
        }`}
      >
        {preview ? (
          <div className="flex items-center gap-3">
            <img src={preview} alt="Preview" className="w-12 h-12 object-cover rounded" />
            <span className="text-sm text-green-400">✓ File selected</span>
          </div>
        ) : (
          <div className="text-center">
            <i className="fas fa-cloud-upload-alt text-2xl text-[var(--text-muted)] mb-1"></i>
            <p className="text-sm text-[var(--text-muted)]">Click to upload</p>
          </div>
        )}
      </label>
    </div>
    {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
  </div>
);

const RegistrationForm = () => {
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    mobileNumber: '',
    whatsappNumber: '',
    email: '',
    nameAsPerAadhaar: '',
    aadhaarNumber: '',
    panNumber: '',
    permanentAddress: '',
  });

  const [files, setFiles] = useState({
    aadhaarFront: null,
    aadhaarBack: null,
    panCard: null,
    passportPhoto: null,
  });

  const [previews, setPreviews] = useState({
    aadhaarFront: null,
    aadhaarBack: null,
    panCard: null,
    passportPhoto: null,
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState({ text: '', type: '' });

  // Validation rules
  const validate = () => {
    const newErrors = {};

    // Personal Info
    if (!formData.firstName.trim()) newErrors.firstName = 'First name is required';
    if (!formData.lastName.trim()) newErrors.lastName = 'Last name is required';
    
    // Mobile validation (10 digits, starts with 6-9)
    const mobileRegex = /^[6-9]\d{9}$/;
    if (!formData.mobileNumber) newErrors.mobileNumber = 'Mobile number is required';
    else if (!mobileRegex.test(formData.mobileNumber)) newErrors.mobileNumber = 'Invalid mobile number (10 digits, starts with 6-9)';
    
    if (!formData.whatsappNumber) newErrors.whatsappNumber = 'WhatsApp number is required';
    else if (!mobileRegex.test(formData.whatsappNumber)) newErrors.whatsappNumber = 'Invalid WhatsApp number (10 digits, starts with 6-9)';

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email) newErrors.email = 'Email is required';
    else if (!emailRegex.test(formData.email)) newErrors.email = 'Invalid email format';

    // KYC validation
    if (!formData.nameAsPerAadhaar.trim()) newErrors.nameAsPerAadhaar = 'Name as per Aadhaar is required';
    
    // Aadhaar validation (12 digits)
    const aadhaarRegex = /^\d{12}$/;
    if (!formData.aadhaarNumber) newErrors.aadhaarNumber = 'Aadhaar number is required';
    else if (!aadhaarRegex.test(formData.aadhaarNumber)) newErrors.aadhaarNumber = 'Aadhaar must be 12 digits';

    // PAN validation (ABCDE1234F format)
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    if (!formData.panNumber) newErrors.panNumber = 'PAN number is required';
    else if (!panRegex.test(formData.panNumber.toUpperCase())) newErrors.panNumber = 'Invalid PAN format (e.g., ABCDE1234F)';

    // Address validation
    if (!formData.permanentAddress.trim()) newErrors.permanentAddress = 'Permanent address is required';

    // Document validation (Aadhaar and PAN are mandatory)
    if (!files.aadhaarFront) newErrors.aadhaarFront = 'Aadhaar front image is required';
    if (!files.aadhaarBack) newErrors.aadhaarBack = 'Aadhaar back image is required';
    if (!files.panCard) newErrors.panCard = 'PAN card image is required';
    // Passport photo is optional

    return newErrors;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Auto-uppercase PAN number
    const processedValue = name === 'panNumber' ? value.toUpperCase() : value;
    
    setFormData((prev) => ({ ...prev, [name]: processedValue }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: null }));
    setSubmitMessage({ text: '', type: '' });
  };

  const handleFileChange = (e) => {
    const { name, files: fileList } = e.target;
    const file = fileList[0];

    if (!file) return;

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB in bytes
    if (file.size > maxSize) {
      setErrors((prev) => ({ ...prev, [name]: 'File size must be less than 5MB' }));
      return;
    }

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      setErrors((prev) => ({ ...prev, [name]: 'Only JPG/PNG images are allowed' }));
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviews((prev) => ({ ...prev, [name]: reader.result }));
    };
    reader.readAsDataURL(file);

    setFiles((prev) => ({ ...prev, [name]: file }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: null }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const validationErrors = validate();
    setErrors(validationErrors);
    
    if (Object.keys(validationErrors).length > 0) {
      setSubmitMessage({ text: 'Please fix the errors above', type: 'error' });
      // Scroll to top to show errors
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setIsSubmitting(true);
    setSubmitMessage({ text: '', type: '' });

    try {
      // Create FormData for multipart upload
      const submitData = new FormData();
      
      // Append text fields
      Object.keys(formData).forEach(key => {
        submitData.append(key, formData[key]);
      });

      // Append files
      if (files.aadhaarFront) submitData.append('aadhaarFront', files.aadhaarFront);
      if (files.aadhaarBack) submitData.append('aadhaarBack', files.aadhaarBack);
      if (files.panCard) submitData.append('panCard', files.panCard);
      if (files.passportPhoto) submitData.append('passportPhoto', files.passportPhoto);

      const apiUrl = import.meta.env.VITE_REACT_APP_API_URL || '';
      
      const response = await fetch(`${apiUrl}/api/registration/submit`, {
        method: 'POST',
        body: submitData, // FormData automatically sets correct Content-Type
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setSubmitMessage({ 
          text: '✅ Registration submitted successfully! We will review your application and contact you soon.', 
          type: 'success' 
        });
        
        // Clear form after success
        setFormData({
          firstName: '',
          middleName: '',
          lastName: '',
          mobileNumber: '',
          whatsappNumber: '',
          email: '',
          nameAsPerAadhaar: '',
          aadhaarNumber: '',
          panNumber: '',
          permanentAddress: '',
        });
        setFiles({
          aadhaarFront: null,
          aadhaarBack: null,
          panCard: null,
          passportPhoto: null,
        });
        setPreviews({
          aadhaarFront: null,
          aadhaarBack: null,
          panCard: null,
          passportPhoto: null,
        });

        // Scroll to top to show success message
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        throw new Error(result.message || 'Registration failed');
      }

    } catch (err) {
      setSubmitMessage({ 
        text: err.message || 'Registration failed. Please try again.', 
        type: 'error' 
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] py-8 px-4">
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"
        crossOrigin="anonymous"
      />
      
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <button
            onClick={() => navigate('/')}
            className="absolute left-4 top-4 sm:left-8 sm:top-8 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
          >
            <i className="fas fa-arrow-left mr-2"></i> Back to Login
          </button>
          <h1 className="text-3xl font-extrabold text-[var(--text-primary)] mb-2">Create Account</h1>
          <p className="text-[var(--text-secondary)]">Fill in your details to register for trading</p>
        </div>

        {/* Form Card */}
        <div 
          className="bg-[var(--bg-card)] rounded-xl shadow-2xl p-6 sm:p-8 border border-[var(--border-color)]"
          style={{ boxShadow: '0 10px 30px rgba(0, 0, 0, 0.4), 0 0 40px rgba(79, 70, 229, 0.2)' }}
        >
          {/* Submit Message */}
          {submitMessage.text && (
            <div
              className={`p-4 mb-6 rounded-lg font-semibold text-sm text-center ${
                submitMessage.type === 'success' ? 'bg-green-600/20 text-green-400' : 'bg-red-600/20 text-red-400'
              }`}
            >
              {submitMessage.text}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* ===== PERSONAL INFO SECTION ===== */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4 pb-2 border-b border-[var(--border-color)]">
                <i className="fas fa-user mr-2 text-indigo-400"></i>
                Personal Information
              </h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <InputField
                  label="First Name"
                  type="text"
                  name="firstName"
                  placeholder="Enter first name"
                  value={formData.firstName}
                  onChange={handleChange}
                  error={errors.firstName}
                  required
                />
                <InputField
                  label="Middle Name"
                  type="text"
                  name="middleName"
                  placeholder="Enter middle name"
                  value={formData.middleName}
                  onChange={handleChange}
                  error={errors.middleName}
                />
                <InputField
                  label="Last Name"
                  type="text"
                  name="lastName"
                  placeholder="Enter last name"
                  value={formData.lastName}
                  onChange={handleChange}
                  error={errors.lastName}
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InputField
                  label="Mobile Number"
                  type="tel"
                  name="mobileNumber"
                  placeholder="10-digit mobile number"
                  value={formData.mobileNumber}
                  onChange={handleChange}
                  error={errors.mobileNumber}
                  required
                  maxLength={10}
                />
                <InputField
                  label="WhatsApp Number"
                  type="tel"
                  name="whatsappNumber"
                  placeholder="10-digit WhatsApp number"
                  value={formData.whatsappNumber}
                  onChange={handleChange}
                  error={errors.whatsappNumber}
                  required
                  maxLength={10}
                />
              </div>

              <InputField
                label="Email Address"
                type="email"
                name="email"
                placeholder="your.email@example.com"
                value={formData.email}
                onChange={handleChange}
                error={errors.email}
                required
              />
            </div>

            {/* ===== KYC DETAILS SECTION ===== */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4 pb-2 border-b border-[var(--border-color)]">
                <i className="fas fa-id-card mr-2 text-indigo-400"></i>
                KYC Details
              </h2>

              <InputField
                label="Name (as per Aadhaar)"
                type="text"
                name="nameAsPerAadhaar"
                placeholder="Full name as printed on Aadhaar card"
                value={formData.nameAsPerAadhaar}
                onChange={handleChange}
                error={errors.nameAsPerAadhaar}
                required
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InputField
                  label="Aadhaar Card Number"
                  type="text"
                  name="aadhaarNumber"
                  placeholder="12-digit Aadhaar number"
                  value={formData.aadhaarNumber}
                  onChange={handleChange}
                  error={errors.aadhaarNumber}
                  required
                  maxLength={12}
                />
                <InputField
                  label="PAN Card Number"
                  type="text"
                  name="panNumber"
                  placeholder="e.g., ABCDE1234F"
                  value={formData.panNumber}
                  onChange={handleChange}
                  error={errors.panNumber}
                  required
                  maxLength={10}
                />
              </div>
            </div>

            {/* ===== ADDRESS SECTION ===== */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4 pb-2 border-b border-[var(--border-color)]">
                <i className="fas fa-map-marker-alt mr-2 text-indigo-400"></i>
                Address
              </h2>

              <div className="mb-4">
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                  Permanent Address (as per Aadhaar) <span className="text-red-500">*</span>
                </label>
                <textarea
                  name="permanentAddress"
                  placeholder="Enter your complete permanent address as per Aadhaar card"
                  value={formData.permanentAddress}
                  onChange={handleChange}
                  rows={3}
                  className={`w-full p-3 rounded-lg bg-[var(--bg-input)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50 transition duration-200 border ${
                    errors.permanentAddress ? 'border-red-500' : 'border-[var(--border-color)]'
                  } focus:border-indigo-500 resize-none`}
                />
                {errors.permanentAddress && <p className="text-red-400 text-xs mt-1">{errors.permanentAddress}</p>}
              </div>
            </div>

            {/* ===== DOCUMENTS SECTION ===== */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4 pb-2 border-b border-[var(--border-color)]">
                <i className="fas fa-file-upload mr-2 text-indigo-400"></i>
                Document Upload
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FileUploadField
                  label="Aadhaar Card - Front"
                  name="aadhaarFront"
                  onChange={handleFileChange}
                  error={errors.aadhaarFront}
                  required
                  preview={previews.aadhaarFront}
                />
                <FileUploadField
                  label="Aadhaar Card - Back"
                  name="aadhaarBack"
                  onChange={handleFileChange}
                  error={errors.aadhaarBack}
                  required
                  preview={previews.aadhaarBack}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FileUploadField
                  label="PAN Card - Front"
                  name="panCard"
                  onChange={handleFileChange}
                  error={errors.panCard}
                  required
                  preview={previews.panCard}
                />
                <FileUploadField
                  label="Passport Size Photo"
                  name="passportPhoto"
                  onChange={handleFileChange}
                  error={errors.passportPhoto}
                  preview={previews.passportPhoto}
                />
              </div>
            </div>

            {/* ===== SUBMIT BUTTON ===== */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 rounded-lg text-lg font-bold text-white uppercase bg-indigo-600 hover:bg-indigo-700 transition duration-200 shadow-lg shadow-indigo-500/50 disabled:bg-gray-500 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <i className="fas fa-spinner fa-spin"></i>
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <i className="fas fa-paper-plane"></i>
                  <span>Submit Registration</span>
                </>
              )}
            </button>

            {/* Login Link */}
            <p className="text-center mt-6 text-[var(--text-secondary)]">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => navigate('/')}
                className="text-indigo-400 hover:text-indigo-300 font-semibold"
              >
                Login here
              </button>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};

export default RegistrationForm;
