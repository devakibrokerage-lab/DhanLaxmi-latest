// scripts/create-admin-user.js
// Run: node Backend/scripts/create-admin-user.js

import 'dotenv/config';
import mongoose from 'mongoose';
import BrokerModel from '../Model/BrokerModel.js';

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URL;

const ADMIN_CREDENTIALS = {
  login_id: 'admin123',
  password: 'admin@123',
  name: 'Admin User',
  role: 'admin',
};

async function createAdminUser() {
  try {
    console.log('[Admin Setup] Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('[Admin Setup] Connected!');

    // Check if admin already exists
    const existingAdmin = await BrokerModel.findOne({ login_id: ADMIN_CREDENTIALS.login_id });
    
    if (existingAdmin) {
      console.log('[Admin Setup] Admin user already exists!');
      console.log('  Login ID:', existingAdmin.login_id);
      console.log('  Name:', existingAdmin.name);
      console.log('  Role:', existingAdmin.role);
    } else {
      // Create new admin user
      const admin = await BrokerModel.create(ADMIN_CREDENTIALS);
      console.log('[Admin Setup] ✅ Admin user created successfully!');
      console.log('  Login ID:', admin.login_id);
      console.log('  Password:', ADMIN_CREDENTIALS.password);
      console.log('  Name:', admin.name);
      console.log('  Role:', admin.role);
    }

    await mongoose.disconnect();
    console.log('[Admin Setup] Done!');
    process.exit(0);

  } catch (error) {
    console.error('[Admin Setup] Error:', error.message);
    process.exit(1);
  }
}

createAdminUser();
