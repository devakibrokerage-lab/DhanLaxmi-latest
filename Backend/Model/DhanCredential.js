
import mongoose from 'mongoose';

const DhanCredentialSchema = new mongoose.Schema({
  clientId: {
    type: String,
    required: true,
    unique: true,
  },
  accessToken: {
    type: String,
    required: true,
  },
}, { timestamps: true });

const DhanCredential = mongoose.model('DhanCredential', DhanCredentialSchema);

export default DhanCredential;
