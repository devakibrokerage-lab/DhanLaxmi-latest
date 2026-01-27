import React, { useState } from 'react';
import { X, User, Phone, Mail, CreditCard, MapPin, FileText, Image } from 'lucide-react';

// Lightbox Modal Component
const ImageLightbox = ({ imageUrl, title, onClose }) => {
  if (!imageUrl) return null;

  return (
    <div 
      className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition z-10"
      >
        <X className="w-6 h-6" />
      </button>
      
      <div className="max-w-4xl max-h-[90vh] w-full" onClick={(e) => e.stopPropagation()}>
        <p className="text-white text-center mb-3 font-medium">{title}</p>
        <img
          src={imageUrl}
          alt={title}
          className="w-full h-auto max-h-[80vh] object-contain rounded-lg"
        />
      </div>
    </div>
  );
};

// Document Card Component
const DocumentCard = ({ label, url, onClick }) => {
  if (!url) {
    return (
      <div className="bg-[var(--bg-tertiary)] rounded-lg p-3 flex items-center gap-3 opacity-50">
        <div className="w-12 h-12 bg-gray-500/20 rounded-lg flex items-center justify-center">
          <Image className="w-6 h-6 text-gray-500" />
        </div>
        <div>
          <p className="text-sm font-medium text-[var(--text-primary)]">{label}</p>
          <p className="text-xs text-[var(--text-muted)]">Not uploaded</p>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={() => onClick(url, label)}
      className="bg-[var(--bg-tertiary)] rounded-lg p-3 flex items-center gap-3 cursor-pointer hover:bg-[var(--bg-hover)] transition active:scale-[0.98]"
    >
      <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-800 flex-shrink-0">
        <img
          src={url}
          alt={label}
          className="w-full h-full object-cover"
          onError={(e) => {
            e.target.style.display = 'none';
            e.target.nextSibling.style.display = 'flex';
          }}
        />
        <div className="hidden w-full h-full items-center justify-center">
          <FileText className="w-6 h-6 text-gray-500" />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--text-primary)]">{label}</p>
        <p className="text-xs text-indigo-400">Tap to view</p>
      </div>
    </div>
  );
};

// Info Row Component
const InfoRow = ({ icon: Icon, label, value }) => (
  <div className="flex items-start gap-3 py-2">
    <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
      <Icon className="w-4 h-4 text-indigo-400" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-xs text-[var(--text-muted)]">{label}</p>
      <p className="text-sm text-[var(--text-primary)] break-words">{value || 'N/A'}</p>
    </div>
  </div>
);

const RegistrationDetailBottomWindow = ({ registration, onClose }) => {
  const [lightboxImage, setLightboxImage] = useState({ url: null, title: '' });

  if (!registration) return null;

  const {
    firstName,
    middleName,
    lastName,
    mobileNumber,
    whatsappNumber,
    email,
    nameAsPerAadhaar,
    aadhaarNumber,
    panNumber,
    permanentAddress,
    documents,
    createdAt,
  } = registration;

  const fullName = `${firstName} ${middleName || ''} ${lastName}`.trim();

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleImageClick = (url, title) => {
    setLightboxImage({ url, title });
  };

  const closeLightbox = () => {
    setLightboxImage({ url: null, title: '' });
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-[100]"
        onClick={onClose}
      />

      {/* Bottom Window */}
      <div className="fixed bottom-0 left-0 right-0 z-[110] bg-[var(--bg-secondary)] rounded-t-3xl max-h-[90vh] overflow-hidden animate-slide-up">
        {/* Handle Bar */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-12 h-1.5 bg-gray-600 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-3 border-b border-[var(--border-color)]">
          <div>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">{fullName}</h2>
            <p className="text-xs text-[var(--text-muted)]">Submitted: {formatDate(createdAt)}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-100px)] pb-8">
          {/* Personal Information */}
          <div className="px-4 pt-4">
            <h3 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-3">
              Personal Information
            </h3>
            <div className="bg-[var(--bg-card)] rounded-xl p-3 space-y-1">
              <InfoRow icon={User} label="Full Name" value={fullName} />
              <InfoRow icon={Phone} label="Mobile Number" value={mobileNumber} />
              <InfoRow icon={Phone} label="WhatsApp Number" value={whatsappNumber} />
              <InfoRow icon={Mail} label="Email" value={email} />
            </div>
          </div>

          {/* KYC Information */}
          <div className="px-4 pt-4">
            <h3 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-3">
              KYC Details
            </h3>
            <div className="bg-[var(--bg-card)] rounded-xl p-3 space-y-1">
              <InfoRow icon={User} label="Name as per Aadhaar" value={nameAsPerAadhaar} />
              <InfoRow icon={CreditCard} label="Aadhaar Number" value={aadhaarNumber} />
              <InfoRow icon={CreditCard} label="PAN Number" value={panNumber} />
              <InfoRow icon={MapPin} label="Permanent Address" value={permanentAddress} />
            </div>
          </div>

          {/* Documents */}
          <div className="px-4 pt-4">
            <h3 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-3">
              Documents
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <DocumentCard
                label="Aadhaar Front"
                url={documents?.aadhaarFront?.url}
                onClick={handleImageClick}
              />
              <DocumentCard
                label="Aadhaar Back"
                url={documents?.aadhaarBack?.url}
                onClick={handleImageClick}
              />
              <DocumentCard
                label="PAN Card"
                url={documents?.panCard?.url}
                onClick={handleImageClick}
              />
              <DocumentCard
                label="Passport Photo"
                url={documents?.passportPhoto?.url}
                onClick={handleImageClick}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lightboxImage.url && (
        <ImageLightbox
          imageUrl={lightboxImage.url}
          title={lightboxImage.title}
          onClose={closeLightbox}
        />
      )}

      {/* Animation Styles */}
      <style>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </>
  );
};

export default RegistrationDetailBottomWindow;
