#!/usr/bin/env node
/**
 * Force Token Renewal Script
 * 
 * This script manually triggers the Dhan access token renewal process.
 * Use this to test if your token renewal is working correctly.
 * 
 * Usage: node Backend/scripts/force-renew-token.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { renewAccessToken } from '../services/dhanAuth.js';
import { getDhanCredentials } from '../services/dhanCredentialService.js';
import { loadDhanConfig } from '../config.js';

// Setup environment
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: envPath });

const MONGODB_URI = process.env.MONGO_URL || process.env.MONGODB_URI;

async function forceRenewal() {
  if (!MONGODB_URI) {
    console.error('❌ ERROR: No MongoDB URI found in .env file');
    process.exit(1);
  }

  try {
    // Connect to database
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ MongoDB connected\n');

    // Load current credentials
    console.log('📋 Loading Dhan configuration from database...');
    await loadDhanConfig();
    
    const credentials = await getDhanCredentials();
    if (!credentials) {
      console.error('❌ No Dhan credentials found in database.');
      console.error('   Please run: node Backend/scripts/init-dhan-credentials.js');
      process.exit(1);
    }

    console.log('✅ Current credentials loaded');
    console.log(`   Client ID: ${credentials.clientId}`);
    console.log(`   Last Updated: ${credentials.updatedAt}`);
    
    // Decode and display token info
    try {
      const payload = JSON.parse(
        Buffer.from(credentials.accessToken.split('.')[1], 'base64').toString()
      );
      const expiryTime = new Date(payload.exp * 1000);
      const now = new Date();
      const hoursUntilExpiry = (expiryTime - now) / (1000 * 60 * 60);

      console.log(`   Token Expires: ${expiryTime.toISOString()}`);
      console.log(`   Time Remaining: ${hoursUntilExpiry.toFixed(2)} hours`);
      
      if (hoursUntilExpiry <= 0) {
        console.error('\n❌ TOKEN HAS EXPIRED!');
        console.error('   You cannot renew an expired token.');
        console.error('   Please generate a fresh token from Dhan Web:');
        console.error('   1. Go to https://web.dhan.co');
        console.error('   2. My Profile → Access DhanHQ APIs');
        console.error('   3. Generate new access token');
        console.error('   4. Run: node Backend/scripts/init-dhan-credentials.js');
        process.exit(1);
      }
      
      console.log('\n🔄 Starting token renewal...\n');
    } catch (e) {
      console.warn('⚠️  Could not decode token expiry, proceeding anyway...\n');
    }

    // Perform renewal
    const newToken = await renewAccessToken();

    if (newToken) {
      console.log('\n✅ TOKEN RENEWAL SUCCESSFUL!\n');
      
      // Verify the new token was saved
      const updatedCredentials = await getDhanCredentials();
      const newPayload = JSON.parse(
        Buffer.from(updatedCredentials.accessToken.split('.')[1], 'base64').toString()
      );
      const newExpiry = new Date(newPayload.exp * 1000);
      const now = new Date();
      const newHoursRemaining = (newExpiry - now) / (1000 * 60 * 60);
      
      console.log('📊 New Token Details:');
      console.log(`   Expires: ${newExpiry.toISOString()}`);
      console.log(`   Valid for: ${newHoursRemaining.toFixed(2)} hours`);
      console.log(`   Updated at: ${updatedCredentials.updatedAt}`);
      console.log('\n🎉 Your token has been successfully renewed and saved to the database!');
    } else {
      console.error('\n❌ TOKEN RENEWAL FAILED!');
      console.error('   Check the error messages above for details.');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ Error during token renewal:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 MongoDB disconnected');
  }
}

// Run the script
forceRenewal();
