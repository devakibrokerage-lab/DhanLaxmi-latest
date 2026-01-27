// cron/autoLoginCron.js
// Scheduled auto-login for Kite Connect
// Runs daily at 7:55 AM IST (before market opens at 9:15 AM)

import cron from 'node-cron';
import { runAutoLogin, isAutoLoginConfigured } from '../services/AutoLoginService.js';
import KiteCredential from '../Model/KiteCredentialModel.js';

/**
 * Start the auto-login cron job
 * Runs at 7:55 AM IST every day to ensure fresh token before market opens
 */
export function startAutoLoginCron() {
    // Schedule: 55 7 * * * = At 7:55 AM every day
    // IST is UTC+5:30, so 7:55 AM IST = 2:25 AM UTC
    const schedule = '25 2 * * *'; // 2:25 AM UTC = 7:55 AM IST

    console.log('[AutoLoginCron] 📅 Scheduling daily auto-login at 7:55 AM IST');

    cron.schedule(schedule, async () => {
        console.log('[AutoLoginCron] ⏰ Cron triggered at', new Date().toISOString());

        try {
            // Check if auto-login is configured and enabled
            const status = await isAutoLoginConfigured();

            if (!status.configured) {
                console.log('[AutoLoginCron] ⚠️ Auto-login not configured. Skipping.');
                return;
            }

            if (!status.enabled) {
                console.log('[AutoLoginCron] ⚠️ Auto-login disabled. Skipping.');
                return;
            }

            // Check if token is still valid
            const credential = await KiteCredential.findOne({ is_active: true }).lean();
            if (credential?.token_expiry) {
                const expiry = new Date(credential.token_expiry);
                const now = new Date();
                const hoursRemaining = (expiry - now) / (1000 * 60 * 60);

                // If token is still valid for more than 2 hours, skip
                if (hoursRemaining > 2) {
                    console.log(`[AutoLoginCron] Token still valid for ${hoursRemaining.toFixed(1)} hours. Skipping.`);
                    return;
                }
            }

            // Run auto-login
            console.log('[AutoLoginCron] 🚀 Running auto-login...');
            const result = await runAutoLogin();

            if (result.success) {
                console.log('[AutoLoginCron] ✅ Auto-login completed successfully!');
                console.log('[AutoLoginCron]    User:', result.user_id);
                console.log('[AutoLoginCron]    Token expires:', result.token_expiry);
            } else {
                console.error('[AutoLoginCron] ❌ Auto-login failed:', result.error);
            }

        } catch (error) {
            console.error('[AutoLoginCron] ❌ Error:', error.message);
        }
    }, {
        timezone: 'Asia/Kolkata'
    });

    console.log('[AutoLoginCron] ✅ Cron job registered');
}

/**
 * Check token status and run auto-login if needed (on server start)
 */
export async function checkAndRefreshOnStartup() {
    console.log('[AutoLoginCron] Checking token status on startup...');

    try {
        const status = await isAutoLoginConfigured();

        if (!status.configured || !status.enabled) {
            console.log('[AutoLoginCron] Auto-login not configured or disabled');
            return;
        }

        const credential = await KiteCredential.findOne({ is_active: true }).lean();

        if (!credential) {
            console.log('[AutoLoginCron] No active credentials found');
            return;
        }

        // Check token expiry
        if (credential.token_expiry) {
            const expiry = new Date(credential.token_expiry);
            const now = new Date();

            if (expiry > now) {
                const hoursRemaining = (expiry - now) / (1000 * 60 * 60);
                console.log(`[AutoLoginCron] Token valid for ${hoursRemaining.toFixed(1)} more hours`);
                return;
            }
        }

        // Token expired or no expiry set - try auto-login
        console.log('[AutoLoginCron] Token expired. Running auto-login...');
        const result = await runAutoLogin();

        if (result.success) {
            console.log('[AutoLoginCron] ✅ Startup auto-login successful!');
        } else {
            console.log('[AutoLoginCron] ⚠️ Startup auto-login failed:', result.error);
        }

    } catch (error) {
        console.error('[AutoLoginCron] Startup check error:', error.message);
    }
}

export default { startAutoLoginCron, checkAndRefreshOnStartup };
