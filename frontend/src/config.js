// Centralized config to manage API URL
// Priority: 
// 1. Environment Variable (VITE_REACT_APP_API_URL)
// 2. Hardcoded Production URL (Fall back if env var is missing)

const PROD_BACKEND = "https://devaki-backend-rnj5.onrender.com";

export const API_URL = import.meta.env.VITE_REACT_APP_API_URL || PROD_BACKEND;

console.log("🔌 API Config Loaded:", API_URL);
