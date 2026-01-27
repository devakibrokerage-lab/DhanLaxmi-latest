// Model/RegistrationModel.js
// MongoDB Schema for Registration Requests

import mongoose from 'mongoose';
const { Schema } = mongoose;

const RegistrationSchema = new Schema({
  // ===== PERSONAL INFO =====
  firstName: {
    type: String,
    required: true,
    trim: true,
  },
  middleName: {
    type: String,
    trim: true,
    default: '',
  },
  lastName: {
    type: String,
    required: true,
    trim: true,
  },
  mobileNumber: {
    type: String,
    required: true,
    match: [/^[6-9]\d{9}$/, 'Invalid mobile number'],
  },
  whatsappNumber: {
    type: String,
    required: true,
    match: [/^[6-9]\d{9}$/, 'Invalid WhatsApp number'],
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
  },

  // ===== KYC DETAILS =====
  nameAsPerAadhaar: {
    type: String,
    required: true,
    trim: true,
  },
  aadhaarNumber: {
    type: String,
    required: true,
    match: [/^\d{12}$/, 'Aadhaar must be 12 digits'],
  },
  panNumber: {
    type: String,
    required: true,
    uppercase: true,
    match: [/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid PAN format'],
  },

  // ===== ADDRESS =====
  permanentAddress: {
    type: String,
    required: true,
    trim: true,
  },

  // ===== DOCUMENTS (Stored URLs from Cloud Storage) =====
  documents: {
    aadhaarFront: {
      url: { type: String, required: true },
      publicId: { type: String, required: true },
      uploadedAt: { type: Date, default: Date.now },
    },
    aadhaarBack: {
      url: { type: String, required: true },
      publicId: { type: String, required: true },
      uploadedAt: { type: Date, default: Date.now },
    },
    panCard: {
      url: { type: String, required: true },
      publicId: { type: String, required: true },
      uploadedAt: { type: Date, default: Date.now },
    },
    passportPhoto: {
      url: { type: String, default: '' },
      publicId: { type: String, default: '' },
      uploadedAt: { type: Date },
    },
  },

  // ===== STATUS & WORKFLOW =====
  status: {
    type: String,
    enum: ['pending', 'under_review', 'approved', 'rejected'],
    default: 'pending',
  },
  
  reviewNotes: {
    type: String,
    default: '',
  },
  
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Broker',
  },
  
  reviewedAt: {
    type: Date,
  },

  // ===== TELEGRAM TRACKING =====
  telegramSent: {
    type: Boolean,
    default: false,
  },
  telegramMessageId: {
    type: String,
  },

  // ===== LINKED CUSTOMER (after approval) =====
  linkedCustomerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
  },

  // ===== METADATA =====
  ipAddress: {
    type: String,
  },
  userAgent: {
    type: String,
  },

}, { 
  timestamps: true, // createdAt, updatedAt
});

// Index for faster queries
RegistrationSchema.index({ status: 1, createdAt: -1 });
RegistrationSchema.index({ mobileNumber: 1 });
RegistrationSchema.index({ email: 1 });
RegistrationSchema.index({ aadhaarNumber: 1 });
RegistrationSchema.index({ panNumber: 1 });

// Virtual for full name
RegistrationSchema.virtual('fullName').get(function() {
  const middle = this.middleName ? ` ${this.middleName}` : '';
  return `${this.firstName}${middle} ${this.lastName}`;
});

// Ensure virtuals are included in JSON
RegistrationSchema.set('toJSON', { virtuals: true });
RegistrationSchema.set('toObject', { virtuals: true });

export default mongoose.model('Registration', RegistrationSchema);
