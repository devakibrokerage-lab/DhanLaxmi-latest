// scripts/testFullAutoLogin.js
// Complete auto-login flow test
// Usage: node scripts/testFullAutoLogin.js

import { authenticator } from 'otplib';
import crypto from 'crypto';

// Configuration - will be stored in database later
const CONFIG = {
    api_key: 'elyolh5ti0la4bj5',
    api_secret: 'y2qd15dhfxlb50e8gcar0xblkeecgulk',
    user_id: 'ZJX292',
    password: 'Anjel@7878',
    totp_secret: 'NZDM2DTQKRAEP74AIK53JW27B466UZND'
};

const BASE_URL = 'https://kite.zerodha.com';

// Helper to parse cookies from response
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

// Helper to format cookies for request
const formatCookies = (cookies) => {
    return Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
};

const autoLogin = async () => {
    console.log('\n🚀 KITE AUTO-LOGIN SERVICE TEST\n');
    console.log('═'.repeat(60));

    let allCookies = {};

    try {
        // ═══════════════════════════════════════════════════════════
        // STEP 1: Get sess_id from initial login page
        // ═══════════════════════════════════════════════════════════
        console.log('\n📍 STEP 1: Get sess_id from login page');
        console.log('─'.repeat(60));

        const loginPageUrl = `${BASE_URL}/connect/login?v=3&api_key=${CONFIG.api_key}`;
        console.log('GET:', loginPageUrl);

        const loginPageResponse = await fetch(loginPageUrl, {
            method: 'GET',
            redirect: 'manual', // Don't follow redirects
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        // Get sess_id from redirect location or cookies
        const redirectUrl = loginPageResponse.headers.get('location');
        console.log('Redirect URL:', redirectUrl);

        // Parse sess_id from redirect URL
        let sess_id = null;
        if (redirectUrl) {
            const urlParams = new URL(redirectUrl, BASE_URL).searchParams;
            sess_id = urlParams.get('sess_id');
        }

        // Also collect any cookies
        const step1Cookies = parseCookies(loginPageResponse);
        Object.assign(allCookies, step1Cookies);

        console.log('sess_id:', sess_id);
        console.log('Cookies:', Object.keys(allCookies));

        if (!sess_id) {
            // Try to get it from the actual redirected page
            const followResponse = await fetch(redirectUrl || loginPageUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });
            const finalUrl = followResponse.url;
            console.log('Final URL:', finalUrl);
            sess_id = new URL(finalUrl).searchParams.get('sess_id');
            console.log('sess_id (from final URL):', sess_id);
            Object.assign(allCookies, parseCookies(followResponse));
        }

        if (!sess_id) {
            throw new Error('Could not get sess_id');
        }

        console.log('✅ Got sess_id:', sess_id.substring(0, 20) + '...');

        // ═══════════════════════════════════════════════════════════
        // STEP 2: POST /api/login with credentials
        // ═══════════════════════════════════════════════════════════
        console.log('\n📍 STEP 2: POST /api/login');
        console.log('─'.repeat(60));

        const loginResponse = await fetch(`${BASE_URL}/api/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Cookie': formatCookies(allCookies)
            },
            body: new URLSearchParams({
                user_id: CONFIG.user_id,
                password: CONFIG.password,
                type: 'user_id'
            })
        });

        Object.assign(allCookies, parseCookies(loginResponse));
        const loginData = await loginResponse.json();

        if (loginData.status !== 'success') {
            throw new Error('Login failed: ' + JSON.stringify(loginData));
        }

        const request_id = loginData.data.request_id;
        console.log('✅ Login successful!');
        console.log('   User:', loginData.data.profile.user_name);
        console.log('   request_id:', request_id.substring(0, 20) + '...');

        // ═══════════════════════════════════════════════════════════
        // STEP 3: Generate and submit TOTP
        // ═══════════════════════════════════════════════════════════
        console.log('\n📍 STEP 3: POST /api/twofa with TOTP');
        console.log('─'.repeat(60));

        const totp = authenticator.generate(CONFIG.totp_secret);
        console.log('Generated TOTP:', totp);

        const twofaResponse = await fetch(`${BASE_URL}/api/twofa`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Cookie': formatCookies(allCookies)
            },
            body: new URLSearchParams({
                user_id: CONFIG.user_id,
                request_id: request_id,
                twofa_value: totp,
                twofa_type: 'totp',
                skip_session: 'true'
            })
        });

        Object.assign(allCookies, parseCookies(twofaResponse));
        const twofaData = await twofaResponse.json();

        if (twofaData.status !== 'success') {
            throw new Error('TOTP failed: ' + JSON.stringify(twofaData));
        }

        console.log('✅ TOTP verified!');
        console.log('   Cookies collected:', Object.keys(allCookies).length);

        // ═══════════════════════════════════════════════════════════
        // STEP 4: Get request_token via /connect/login
        // ═══════════════════════════════════════════════════════════
        console.log('\n📍 STEP 4: GET /connect/login (with session)');
        console.log('─'.repeat(60));

        const connectUrl = `${BASE_URL}/connect/login?api_key=${CONFIG.api_key}&sess_id=${sess_id}&skip_session=true`;
        console.log('GET:', connectUrl);

        const connectResponse = await fetch(connectUrl, {
            method: 'GET',
            redirect: 'manual',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Cookie': formatCookies(allCookies)
            }
        });

        let redirectLocation = connectResponse.headers.get('location');
        console.log('Status:', connectResponse.status);
        console.log('Redirect:', redirectLocation);

        // ═══════════════════════════════════════════════════════════
        // STEP 5: Follow redirects to get request_token
        // ═══════════════════════════════════════════════════════════
        console.log('\n📍 STEP 5: Follow redirects');
        console.log('─'.repeat(60));

        let request_token = null;
        let maxRedirects = 5;

        while (redirectLocation && maxRedirects > 0) {
            console.log('Following:', redirectLocation);

            // Check if we've reached the callback URL
            if (redirectLocation.includes('request_token=')) {
                const callbackUrl = new URL(redirectLocation, BASE_URL);
                request_token = callbackUrl.searchParams.get('request_token');
                console.log('🎉 Found request_token!');
                break;
            }

            // Follow the redirect
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
            throw new Error('Could not get request_token');
        }

        console.log('✅ request_token:', request_token);

        // ═══════════════════════════════════════════════════════════
        // STEP 6: Exchange request_token for access_token
        // ═══════════════════════════════════════════════════════════
        console.log('\n📍 STEP 6: Exchange for access_token');
        console.log('─'.repeat(60));

        // Generate checksum: SHA256(api_key + request_token + api_secret)
        const checksum = crypto
            .createHash('sha256')
            .update(CONFIG.api_key + request_token + CONFIG.api_secret)
            .digest('hex');

        console.log('Checksum generated');

        const tokenResponse = await fetch('https://api.kite.trade/session/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-Kite-Version': '3'
            },
            body: new URLSearchParams({
                api_key: CONFIG.api_key,
                request_token: request_token,
                checksum: checksum
            })
        });

        const tokenData = await tokenResponse.json();

        if (tokenData.status !== 'success') {
            throw new Error('Token exchange failed: ' + JSON.stringify(tokenData));
        }

        console.log('\n' + '═'.repeat(60));
        console.log('🎉 AUTO-LOGIN SUCCESSFUL!');
        console.log('═'.repeat(60));
        console.log('User:', tokenData.data.user_name, `(${tokenData.data.user_id})`);
        console.log('Email:', tokenData.data.email);
        console.log('Broker:', tokenData.data.broker);
        console.log('Access Token:', tokenData.data.access_token);
        console.log('Public Token:', tokenData.data.public_token);
        console.log('Login Time:', tokenData.data.login_time);
        console.log('═'.repeat(60));

        return {
            success: true,
            access_token: tokenData.data.access_token,
            public_token: tokenData.data.public_token,
            user_id: tokenData.data.user_id,
            user_name: tokenData.data.user_name,
            email: tokenData.data.email,
            login_time: tokenData.data.login_time
        };

    } catch (error) {
        console.error('\n❌ AUTO-LOGIN FAILED:', error.message);
        return { success: false, error: error.message };
    }
};

// Run the test
autoLogin().then(result => {
    console.log('\nFinal Result:', result.success ? '✅ SUCCESS' : '❌ FAILED');
    if (!result.success) {
        console.log('Error:', result.error);
    }
});
