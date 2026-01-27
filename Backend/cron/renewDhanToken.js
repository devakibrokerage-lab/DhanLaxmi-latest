// Backend/cron/renewDhanToken.js
import cron from 'node-cron';
import { renewAccessToken } from '../services/dhanAuth.js';
import { getDhanCredentials } from '../services/dhanCredentialService.js';

/**
 * Decode JWT and extract expiry time
 * @param {string} token - JWT token
 * @returns {Date|null} - Expiry date or null if invalid
 */
function getTokenExpiry(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    return new Date(payload.exp * 1000);
  } catch (e) {
    console.error('Failed to decode token expiry:', e.message);
    return null;
  }
}

// Schedule the cron job to run every hour
export function startTokenRenewalCron() {
  console.log('Scheduling cron job for Dhan token renewal...');
  cron.schedule('0 * * * *', async () => {
    console.log('Running scheduled Dhan token renewal check...');
    const credentials = await getDhanCredentials();
    if (credentials && credentials.accessToken) {
      const expiryTime = getTokenExpiry(credentials.accessToken);
      
      if (!expiryTime) {
        console.error('❌ Cannot determine token expiry. Skipping renewal.');
        return;
      }

      const now = new Date();
      const hoursUntilExpiry = (expiryTime - now) / (1000 * 60 * 60);

      console.log(`Token expires at: ${expiryTime.toISOString()} (${hoursUntilExpiry.toFixed(2)} hours remaining)`);

      // Renew if less than 2 hours remaining (safe buffer before expiry)
      if (hoursUntilExpiry < 2) {
        if (hoursUntilExpiry <= 0) {
          console.error('❌ Token has EXPIRED! Cannot renew. Please generate fresh token from Dhan Web.');
          console.error('   Go to: https://web.dhan.co → My Profile → Access DhanHQ APIs');
          return;
        }
        console.log(`⏰ Token expires in ${hoursUntilExpiry.toFixed(2)} hours. Renewing now...`);
        await renewAccessToken();
      } else {
        console.log(`✅ Token is still valid for ${hoursUntilExpiry.toFixed(2)} hours. No renewal needed.`);
      }
    } else {
      console.error('❌ No credentials found in database.');
    }
  }, {
    scheduled: true,
    timezone: "Asia/Kolkata"
  });
  console.log('Cron job for Dhan token renewal has been scheduled to run every hour.');
}
