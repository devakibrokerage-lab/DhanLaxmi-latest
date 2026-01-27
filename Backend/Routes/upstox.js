// Routes/upstox.js
import express from 'express';
import { getQuote } from '../Controllers/quoteController.js';

const router = express.Router();
// Example: GET /upstox/quote?symbol=NSE_EQ:INFY
router.get('/quote', getQuote);

export default router;
