// config.js

import { getDhanCredentials } from './services/dhanCredentialService.js';

let dhanConfig = {};

export const loadDhanConfig = async () => {
    const credentials = await getDhanCredentials();
    if (!credentials) {
        console.warn("⚠️ Could not load Dhan credentials from database (not using Dhan)");
        return;
    }
    dhanConfig.clientId = credentials.clientId;
    dhanConfig.token = credentials.accessToken;
};

export const config = {
    // Kite Connect configuration
    kite: {
        apiKey: process.env.KITE_API_KEY,
        accessToken: process.env.KITE_ACCESS_TOKEN,
        apiSecret: process.env.KITE_API_SECRET // Optional, for token generation
    },
    // Legacy Dhan configuration (kept for reference, can be removed)
    dhan: {
        endpoint: "wss://api-feed.dhan.co",
        get clientId() {
            return dhanConfig.clientId;
        },
        get token() {
            return dhanConfig.token;
        },
        set token(newToken) {
            dhanConfig.token = newToken;
        }
    },
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
    port: process.env.PORT
};

