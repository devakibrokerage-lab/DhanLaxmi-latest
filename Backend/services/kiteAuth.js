// services/kiteAuth.js
// Kite Connect authentication and WebSocket initialization

import { KiteWebSocket } from './KiteWebSocket.js';
import { config } from '../config.js';

let kiteWS = null;

/**
 * Initialize Kite WebSocket instance
 * @returns {KiteWebSocket} The Kite WebSocket instance
 */
export function initializeKiteWS() {
  if (!kiteWS) {
    kiteWS = new KiteWebSocket();
  }
  return kiteWS;
}

/**
 * Get the current Kite WebSocket instance
 * @returns {KiteWebSocket|null}
 */
export function getKiteWS() {
  return kiteWS;
}

/**
 * Validate Kite credentials
 * @returns {boolean} True if credentials are valid
 */
export function validateKiteCredentials() {
  const { apiKey, accessToken } = config.kite;
  
  if (!apiKey) {
    console.error("❌ KITE_API_KEY is not set in environment variables");
    return false;
  }
  
  if (!accessToken) {
    console.error("❌ KITE_ACCESS_TOKEN is not set in environment variables");
    console.error("   To get access token:");
    console.error("   1. Go to https://kite.zerodha.com/connect/login?api_key=YOUR_API_KEY");
    console.error("   2. Complete the login flow");
    console.error("   3. Exchange request_token for access_token using KiteConnect.generateSession()");
    return false;
  }
  
  console.log("✅ Kite credentials found");
  console.log(`   API Key: ${apiKey.substring(0, 8)}...`);
  console.log(`   Access Token: ${accessToken.substring(0, 10)}...`);
  
  return true;
}

/**
 * Refresh access token (for Kite, this typically requires re-login)
 * Note: Kite access tokens expire at end of trading day
 * @param {string} requestToken - New request token from login
 * @param {string} apiSecret - API secret for generating session
 * @returns {Promise<string|null>} New access token or null
 */
export async function refreshAccessToken(requestToken, apiSecret) {
  try {
    // Dynamic import to avoid issues if KiteConnect is not needed
    const { KiteConnect } = await import('kiteconnect');
    
    const kc = new KiteConnect({ api_key: config.kite.apiKey });
    const session = await kc.generateSession(requestToken, apiSecret);
    
    if (session && session.access_token) {
      const newToken = session.access_token;
      console.log("✅ Successfully generated new Kite access token");
      
      // Update config
      config.kite.accessToken = newToken;
      
      // Update WebSocket if running
      if (kiteWS) {
        kiteWS.setToken(newToken);
        console.log("🔄 Reconnecting Kite WebSocket with new token...");
        kiteWS.close();
        kiteWS.connect();
      }
      
      return newToken;
    }
    
    console.error("❌ Failed to generate session - no access token in response");
    return null;
  } catch (error) {
    console.error("❌ Error refreshing Kite access token:", error.message);
    return null;
  }
}

/**
 * Check if access token is likely valid
 * Note: Kite tokens don't have JWT structure, so we can't decode expiry
 * They typically expire at 6 AM the next trading day
 */
export function isTokenLikelyValid() {
  const { accessToken } = config.kite;
  
  if (!accessToken) {
    return false;
  }
  
  // Kite tokens are typically 48 characters
  if (accessToken.length < 40) {
    console.warn("⚠️ Access token seems too short, might be invalid");
    return false;
  }
  
  return true;
}
