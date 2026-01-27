// Routes/ChartRoute.js
import express from 'express';
import { getChartData, getIntradayData } from '../Controllers/ChartController.js';

const router = express.Router();

// Daily historical data
router.get('/getChartData', getChartData);

// Intraday historical data (1, 5, 15, 25, 60 minute intervals)
router.get('/getIntradayData', getIntradayData);

export default router;
