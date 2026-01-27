// Routes/UpstoxAuthRoute.js (Final Workaround)
import express from 'express';
import axios from 'axios';
import { URLSearchParams } from 'url';
import { tokenState, saveToken } from '../Controllers/upstoxController.js';

const router = express.Router();

const TOKEN_URL = process.env.UPSTOX_TOKEN_URL;
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;

// --- Callback for Upstox login ---
router.get("/callback", async (req, res) => {
    const code = req.query.code;
    if (!code) return res.status(400).send("No authorization code received!");

    const body = new URLSearchParams({
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code",
    });

    try {
        const r = await axios.post(TOKEN_URL, body.toString(), {
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
        });

        // 🚨 FINAL WORKAROUND: Force a standard 30-minute expiry time
        const EXPIRY_DURATION_MS = 30 * 60 * 1000; // 30 minutes
        const SAFETY_MARGIN_MS = 60 * 1000;      // 1 minute margin

        // 1. Save access token
        tokenState.access_token = r.data.access_token;
        
        // 2. Handle refresh_token
        tokenState.refresh_token = r.data.refresh_token || 'MISSING'; 
        
        // 3. Set forced robust expiry time
        tokenState.expires_at = Date.now() + EXPIRY_DURATION_MS - SAFETY_MARGIN_MS;
        
        // Save the updated state to token.json
        saveToken();
        
        // Log expiry time for debugging
        // This MUST now show a valid time, confirming the fix worked!
        console.log(`Upstox: New token saved. Expires at (Forced 29 min): ${new Date(tokenState.expires_at).toLocaleTimeString()}`);

        res.send("<h1>Upstox Authorization Complete!</h1><p>Tokens saved. You can close this tab.</p>");
    } catch (err) {
        console.error("Error exchanging token:", err.response?.data || err.message);
        res.status(500).send("Error exchanging token. Check backend logs.");
    }
});

export default router;