// import axios from 'axios';
// import { ensureAccessToken } from './upstoxController.js';

/**
 * Fetches a single quote.
 * This feature is currently disabled pending migration to Dhan.
 */
export async function getQuote(req, res) {
  return res.status(501).json({ error: 'Quote feature is not implemented yet.' });
}
