// Backend/scripts/init-dhan-credentials.js
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeDhanCredentials } from '../services/dhanCredentialService.js';

// --- ensure .env is loaded relative to this file (works even if you run node from a different cwd)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../.env'); // Backend/.env

dotenv.config({ path: envPath });

// --- Helpful debug logging
console.log('Using env file:', envPath);
console.log('MONGO_URL env value (hidden if present):', !!process.env.MONGO_URL ? 'FOUND' : 'MISSING');
console.log('MONGODB_URI env value:', !!process.env.MONGODB_URI ? 'FOUND' : 'MISSING');
console.log('DHAN_CLIENT_ID present:', !!process.env.DHAN_CLIENT_ID);
console.log('DHAN_ACCESS_TOKEN present:', !!process.env.DHAN_ACCESS_TOKEN);

// --- pick the mongo uri from either name
const MONGODB_URI = process.env.MONGO_URL || process.env.MONGODB_URI;

const clientId = process.env.DHAN_CLIENT_ID;
const accessToken = process.env.DHAN_ACCESS_TOKEN;

const init = async () => {
  if (!MONGODB_URI) {
    console.error('❌ ERROR: No MongoDB URI found. Add MONGO_URL or MONGODB_URI to Backend/.env');
    process.exit(1);
  }
  if (!clientId || !accessToken) {
    console.error('❌ ERROR: DHAN_CLIENT_ID or DHAN_ACCESS_TOKEN missing in Backend/.env');
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGODB_URI /*, options if needed */);
    console.log('✅ MongoDB connected');

    await initializeDhanCredentials(clientId, accessToken);
    console.log('✅ initializeDhanCredentials finished');
  } catch (error) {
    console.error('Error during script execution:', error);
  } finally {
    await mongoose.disconnect();
    console.log('MongoDB disconnected');
  }
};

init();
