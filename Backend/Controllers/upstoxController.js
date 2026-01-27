// Controllers/upstoxController.js (FINAL FIX: Ensures all helpers are accessible)

import axios from 'axios';
import fs from 'fs';
import { URLSearchParams } from 'url';

// --- CONFIGURATION (Reads from environment variables) ---
const TOKEN_STORE = process.env.TOKEN_STORE || "./token.json";
const TOKEN_URL = process.env.UPSTOX_TOKEN_URL || "https://api.upstox.com/v2/login/token"; // Fallback URL
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI || "http://127.0.0.1:8080/callback"; 


let tokenState = {
    access_token: null,
    refresh_token: null, // Must be saved on initial exchange
    expires_at: 0,
};

// --- Token Utility Functions ---

function loadToken() {
    try {
        if (fs.existsSync(TOKEN_STORE)) {
            const data = JSON.parse(fs.readFileSync(TOKEN_STORE, "utf8"));
            
            tokenState.access_token = data.access_token || null;
            // FIX 1: Ensure refresh_token is properly loaded
            tokenState.refresh_token = data.refresh_token || null; 
            tokenState.expires_at = Number(data.expires_at) || 0;
            
            if (tokenState.access_token) {
                console.log("Upstox: Token loaded successfully. Expires:", new Date(tokenState.expires_at).toLocaleTimeString());
            }
        }
    } catch (err) {
        console.warn("Upstox: Token file missing or invalid. Re-authorization likely required.");
    }
}

function saveToken() {
    try {
        // FIX 2: Ensure we save the refresh token state, even if it's null/missing
        fs.writeFileSync(TOKEN_STORE, JSON.stringify({
            access_token: tokenState.access_token,
            refresh_token: tokenState.refresh_token,
            expires_at: tokenState.expires_at,
        }, null, 2));
    } catch (err) {
        console.error("Upstox: Failed to save token:", err.message);
    }
}

async function refreshToken() {
    // Check 1: Ensure we have the refresh token to proceed
    if (!tokenState.refresh_token) {
        console.error("Upstox: Cannot refresh token. Refresh token is missing.");
        tokenState.access_token = null;
        throw new Error("RE-AUTHORIZATION REQUIRED: Refresh token missing.");
    }

    // Prepare x-www-form-urlencoded body for refresh request
    const body = new URLSearchParams({
        refresh_token: tokenState.refresh_token,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: "refresh_token", 
    });

    try {
        const response = await axios.post(TOKEN_URL, body.toString(), {
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
        });
        
        // Update access token
        tokenState.access_token = response.data.access_token;
        
        // Calculate new expiry time (in milliseconds)
        tokenState.expires_at = Date.now() + (response.data.expires_in - 60) * 1000; 
        
        saveToken(); // saveToken is now accessible via export/import
        console.log("Upstox: Access token refreshed successfully.");
        
    } catch (err) {
        console.error("Upstox: Token refresh FAILED. API Response:", err.response?.data || err.message);
        tokenState.access_token = null;
        throw new Error("Failed to refresh token: Check client/secret/token validity.");
    }
}

/**
 * Ensures the access token is valid, refreshing it if necessary.
 * @returns {Promise<string>} The valid access token.
 */
async function ensureAccessToken() {
    const now = Date.now();
    
    // Check if token is missing (null) OR has expired (expires_at < now)
    if (!tokenState.access_token || tokenState.expires_at < now) {
        await refreshToken(); 
    }
    
    if (!tokenState.access_token) {
         throw new Error("Authorization is completely broken. Please restart initial auth flow.");
    }
    
    return tokenState.access_token;
}


// --- Initial Token Exchange Handler (For the first manual login) ---
const handleUpstoxCallback = async (req, res) => {
    const { code } = req.query;

    if (!code) {
        return res.status(400).send("Authorization code missing.");
    }

    const body = new URLSearchParams({
        code: code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code",
    });

    try {
        const response = await axios.post(TOKEN_URL, body.toString(), {
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
        });

        // CRITICAL FIX: Store the new access token AND the refresh token
        tokenState.access_token = response.data.access_token;
        tokenState.refresh_token = response.data.refresh_token; 
        tokenState.expires_at = Date.now() + (response.data.expires_in - 60) * 1000;
        
        saveToken(); // Calls the correctly defined function
        res.send("<h1>Upstox Authorization Complete!</h1><p>Tokens saved. You can close this tab.</p>");

    } catch (err) {
        console.error("Upstox Initial Exchange Failed:", err.response?.data || err.message);
        res.status(500).send("<h1>Authorization Failed!</h1><p>Error exchanging code for tokens.</p>");
    }
};

// Load token state on module startup
loadToken();


// FIX 3: Export all necessary functions so the callback logic can work
export { ensureAccessToken, handleUpstoxCallback, loadToken, saveToken, tokenState };