// Model/KiteCredentialModel.js
import mongoose from 'mongoose';

const kiteCredentialSchema = new mongoose.Schema({
  api_key: {
    type: String,
    required: true
  },
  api_secret: {
    type: String,
    required: true
  },
  access_token: {
    type: String,
    default: null
  },
  public_token: {
    type: String,
    default: null
  },
  user_id: {
    type: String,
    default: null
  },
  broker: {
    type: String,
    default: 'ZERODHA'
  },
  login_time: {
    type: Date,
    default: null
  },
  token_expiry: {
    type: Date,
    default: null
  },
  is_active: {
    type: Boolean,
    default: true
  },
  // Auto-login credentials (encrypted)
  kite_password: {
    type: String,
    default: null  // Stored encrypted with AES-256
  },
  totp_secret: {
    type: String,
    default: null  // Stored encrypted with AES-256
  },
  // Auto-login settings
  auto_login_enabled: {
    type: Boolean,
    default: false
  },
  last_auto_login: {
    type: Date,
    default: null
  },
  auto_login_error: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// Ensure only one active credential record
kiteCredentialSchema.index({ is_active: 1 });

const KiteCredential = mongoose.model('KiteCredential', kiteCredentialSchema);

export default KiteCredential;
