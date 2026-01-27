// services/AutoLoginService.js
// Automated Kite login service using stored credentials and TOTP
// Handles the complete OAuth flow without browser interaction

import crypto from 'crypto';
import { authenticator } from 'otplib';
import KiteCredential from '../Model/KiteCredentialModel.js';

const BASE_URL = 'https://kite.zerodha.com';

// Encryption key from environment (32 bytes for AES-256)
const getEncryptionKey = () => {
    const key = process.env.CREDENTIAL_ENCRYPTION_KEY || 'default-key-change-in-production!';
    // Ensure key is 32 bytes
    return crypto.createHash('sha256').update(key).digest();
};

/**
 * Encrypt a string using AES-256-GCM
 */
export function encrypt(text) {
    if (!text) return null;
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return iv.toString('hex') + ':' + authTag + ':' + encrypted;
}

/**
 * Decrypt a string using AES-256-GCM
 */
export function decrypt(encryptedText) {
    if (!encryptedText) return null;
    try {
        const key = getEncryptionKey();
        const [ivHex, authTagHex, encrypted] = encryptedText.split(':');
        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(authTag);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (error) {
        console.error('[AutoLogin] Decryption failed:', error.message);
        return null;
    }
}

/**
 * Parse cookies from fetch response
 */
const parseCookies = (response) => {
    const cookies = {};
    const setCookieHeaders = response.headers.getSetCookie?.() || [];
    setCookieHeaders.forEach(cookie => {
        const [keyValue] = cookie.split(';');
        const [key, value] = keyValue.split('=');
        if (key && value) cookies[key.trim()] = value.trim();
    });
    return cookies;
};

/**
 * Format cookies for request header
 */
const formatCookies = (cookies) => {
    return Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
};

/**
 * Perform automated login to Kite and get access token
 * @param {Object} credential - Credential document from database
 * @returns {Object} Result with success status and token data
 */
export async function performAutoLogin(credential) {
    console.log('[AutoLogin] Starting automated login...');

    if (!credential) {
        throw new Error('No credential provided');
    }

    // Decrypt credentials
    const password = decrypt(credential.kite_password);
    const totpSecret = decrypt(credential.totp_secret);

    if (!password || !totpSecret) {
        throw new Error('Missing decrypted credentials (password or TOTP secret)');
    }

    if (!credential.api_key || !credential.api_secret) {
        throw new Error('Missing API key or secret');
    }

    if (!credential.user_id) {
        throw new Error('Missing user_id');
    }

    let allCookies = {};

    try {
        // ═══════════════ STEP 1: Get sess_id ═══════════════
        console.log('[AutoLogin] Step 1: Getting sess_id...');

        const loginPageUrl = `${BASE_URL}/connect/login?v=3&api_key=${credential.api_key}`;
        const loginPageResponse = await fetch(loginPageUrl, {
            method: 'GET',
            redirect: 'manual',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const redirectUrl = loginPageResponse.headers.get('location');
        let sess_id = null;

        if (redirectUrl) {
            sess_id = new URL(redirectUrl, BASE_URL).searchParams.get('sess_id');
        }

        Object.assign(allCookies, parseCookies(loginPageResponse));

        if (!sess_id) {
            throw new Error('Could not get sess_id from login page');
        }

        console.log('[AutoLogin] Got sess_id:', sess_id.substring(0, 10) + '...');

        // ═══════════════ STEP 2: Login ═══════════════
        console.log('[AutoLogin] Step 2: Logging in with credentials...');

        const loginResponse = await fetch(`${BASE_URL}/api/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Cookie': formatCookies(allCookies)
            },
            body: new URLSearchParams({
                user_id: credential.user_id,
                password: password,
                type: 'user_id'
            })
        });

        Object.assign(allCookies, parseCookies(loginResponse));
        const loginData = await loginResponse.json();

        if (loginData.status !== 'success') {
            throw new Error('Login failed: ' + (loginData.message || JSON.stringify(loginData)));
        }

        const request_id = loginData.data.request_id;
        console.log('[AutoLogin] Login successful, got request_id');

        // ═══════════════ STEP 3: TOTP ═══════════════
        console.log('[AutoLogin] Step 3: Generating and submitting TOTP...');

        const totp = authenticator.generate(totpSecret);
        console.log('[AutoLogin] Generated TOTP:', totp);

        const twofaResponse = await fetch(`${BASE_URL}/api/twofa`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Cookie': formatCookies(allCookies)
            },
            body: new URLSearchParams({
                user_id: credential.user_id,
                request_id: request_id,
                twofa_value: totp,
                twofa_type: 'totp',
                skip_session: 'true'
            })
        });

        Object.assign(allCookies, parseCookies(twofaResponse));
        const twofaData = await twofaResponse.json();

        if (twofaData.status !== 'success') {
            throw new Error('TOTP verification failed: ' + (twofaData.message || JSON.stringify(twofaData)));
        }

        console.log('[AutoLogin] TOTP verified successfully');

        // ═══════════════ STEP 4-5: Get request_token ═══════════════
        console.log('[AutoLogin] Step 4-5: Getting request_token...');

        const connectUrl = `${BASE_URL}/connect/login?api_key=${credential.api_key}&sess_id=${sess_id}&skip_session=true`;
        const connectResponse = await fetch(connectUrl, {
            method: 'GET',
            redirect: 'manual',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Cookie': formatCookies(allCookies)
            }
        });

        let redirectLocation = connectResponse.headers.get('location');
        let request_token = null;
        let maxRedirects = 5;

        while (redirectLocation && maxRedirects > 0) {
            if (redirectLocation.includes('request_token=')) {
                const callbackUrl = new URL(redirectLocation, BASE_URL);
                request_token = callbackUrl.searchParams.get('request_token');
                break;
            }

            const nextResponse = await fetch(
                redirectLocation.startsWith('http') ? redirectLocation : `${BASE_URL}${redirectLocation}`,
                {
                    method: 'GET',
                    redirect: 'manual',
                    headers: {
                        'User-Agent': 'Mozilla/5.0',
                        'Cookie': formatCookies(allCookies)
                    }
                }
            );

            Object.assign(allCookies, parseCookies(nextResponse));
            redirectLocation = nextResponse.headers.get('location');
            maxRedirects--;
        }

        if (!request_token) {
            throw new Error('Could not get request_token from redirects');
        }

        console.log('[AutoLogin] Got request_token:', request_token.substring(0, 10) + '...');

        // ═══════════════ STEP 6: Exchange for access_token ═══════════════
        console.log('[AutoLogin] Step 6: Exchanging for access_token...');

        const checksum = crypto
            .createHash('sha256')
            .update(credential.api_key + request_token + credential.api_secret)
            .digest('hex');

        const tokenResponse = await fetch('https://api.kite.trade/session/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-Kite-Version': '3'
            },
            body: new URLSearchParams({
                api_key: credential.api_key,
                request_token: request_token,
                checksum: checksum
            })
        });

        const tokenData = await tokenResponse.json();

        if (tokenData.status !== 'success') {
            throw new Error('Token exchange failed: ' + (tokenData.message || JSON.stringify(tokenData)));
        }

        console.log('[AutoLogin] ✅ Got access_token successfully!');

        return {
            success: true,
            access_token: tokenData.data.access_token,
            public_token: tokenData.data.public_token,
            user_id: tokenData.data.user_id,
            login_time: tokenData.data.login_time
        };

    } catch (error) {
        console.error('[AutoLogin] ❌ Failed:', error.message);
        throw error;
    }
}

/**
 * Run the auto-login process and update database
 * Also hot-reloads the Kite WebSocket
 */
export async function runAutoLogin() {
    console.log('[AutoLogin] ═══════════════════════════════════════');
    console.log('[AutoLogin] Starting scheduled auto-login...');
    console.log('[AutoLogin] Time:', new Date().toISOString());
    console.log('[AutoLogin] ═══════════════════════════════════════');

    try {
        // Get active credential
        const credential = await KiteCredential.findOne({ is_active: true });

        if (!credential) {
            throw new Error('No active Kite credentials found');
        }

        if (!credential.auto_login_enabled) {
            console.log('[AutoLogin] Auto-login is disabled for this credential');
            return { success: false, reason: 'Auto-login disabled' };
        }

        // Perform auto-login
        const result = await performAutoLogin(credential);

        if (result.success) {
            // Calculate token expiry (6 AM next day)
            const expiry = new Date();
            expiry.setDate(expiry.getDate() + 1);
            expiry.setHours(6, 0, 0, 0);

            // Update database
            await KiteCredential.findByIdAndUpdate(credential._id, {
                access_token: result.access_token,
                public_token: result.public_token,
                user_id: result.user_id,
                login_time: new Date(result.login_time),
                token_expiry: expiry,
                last_auto_login: new Date(),
                auto_login_error: null
            });

            console.log('[AutoLogin] ✅ Database updated with new token');
            console.log('[AutoLogin]    Token expires:', expiry.toISOString());

            // Note: WebSocket reconnection is handled by KiteWebSocket itself
            // It will auto-detect the new token on next connection attempt

            return {
                success: true,
                user_id: result.user_id,
                token_expiry: expiry
            };
        }

        return result;

    } catch (error) {
        console.error('[AutoLogin] ❌ Auto-login failed:', error.message);

        // Update error in database
        try {
            await KiteCredential.updateOne(
                { is_active: true },
                {
                    auto_login_error: error.message,
                    last_auto_login: new Date()
                }
            );
        } catch (dbError) {
            console.error('[AutoLogin] Failed to update error in DB:', dbError.message);
        }

        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Set up auto-login credentials
 * @param {string} password - Kite password (will be encrypted)
 * @param {string} totpSecret - TOTP secret (will be encrypted)
 */
export async function setupAutoLoginCredentials(password, totpSecret) {
    const credential = await KiteCredential.findOne({ is_active: true });

    if (!credential) {
        throw new Error('No active Kite credentials found. Please login manually first.');
    }

    // Encrypt and save
    await KiteCredential.findByIdAndUpdate(credential._id, {
        kite_password: encrypt(password),
        totp_secret: encrypt(totpSecret),
        auto_login_enabled: true
    });

    console.log('[AutoLogin] ✅ Auto-login credentials saved (encrypted)');

    return { success: true, message: 'Auto-login credentials saved' };
}

/**
 * Check if auto-login is configured
 */
export async function isAutoLoginConfigured() {
    const credential = await KiteCredential.findOne({ is_active: true }).lean();

    if (!credential) {
        return { configured: false, reason: 'No active credentials' };
    }

    return {
        configured: !!(credential.kite_password && credential.totp_secret),
        enabled: credential.auto_login_enabled,
        lastAutoLogin: credential.last_auto_login,
        lastError: credential.auto_login_error
    };
}
