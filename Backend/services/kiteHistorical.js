// services/kiteHistorical.js
// Kite Connect Historical Data API service
// Fetches OHLC candle data using Kite's historical API

import KiteCredential from '../Model/KiteCredentialModel.js';

const BASE_URL = 'https://api.kite.trade';

/**
 * Map frontend interval values to Kite API interval format
 */
const INTERVAL_MAP = {
    '1': 'minute',
    '3': '3minute',
    '5': '5minute',
    '10': '10minute',
    '15': '15minute',
    '30': '30minute',
    '60': '60minute',
    'daily': 'day',
    'day': 'day',
    'D': 'day',
    '1D': 'day'
};

/**
 * Format date for Kite API (yyyy-mm-dd HH:MM:SS)
 */
function formatDateForKite(date, isEndDate = false) {
    const d = date instanceof Date ? date : new Date(date);

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');

    // For date-only inputs, add market times
    if (typeof date === 'string' && date.length === 10) {
        const time = isEndDate ? '15:30:00' : '09:15:00';
        return `${year}-${month}-${day} ${time}`;
    }

    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * Get active Kite credentials from database
 */
async function getKiteCredentials() {
    const credential = await KiteCredential.findOne({ is_active: true }).lean();

    if (!credential || !credential.api_key || !credential.access_token) {
        throw new Error('No active Kite credentials found. Please login first.');
    }

    return {
        api_key: credential.api_key,
        access_token: credential.access_token
    };
}

/**
 * Fetch historical OHLC data from Kite API
 * 
 * @param {Object} params
 * @param {string|number} params.instrument_token - Kite instrument token
 * @param {string} params.interval - Time interval (1, 5, 15, 60, day, etc.)
 * @param {string|Date} params.from - Start date/datetime
 * @param {string|Date} params.to - End date/datetime
 * @param {boolean} params.oi - Include Open Interest (default: false)
 * @param {boolean} params.continuous - Continuous data for F&O (default: false)
 * @returns {Promise<Array>} Array of [timestamp, open, high, low, close, volume]
 */
export async function getKiteHistoricalData(params) {
    const {
        instrument_token,
        interval = '5',
        from,
        to,
        oi = false,
        continuous = false
    } = params;

    if (!instrument_token) {
        throw new Error('instrument_token is required');
    }

    if (!from || !to) {
        throw new Error('from and to dates are required');
    }

    // Map interval to Kite format
    const kiteInterval = INTERVAL_MAP[String(interval)] || interval;

    if (!Object.values(INTERVAL_MAP).includes(kiteInterval) &&
        !['minute', '3minute', '5minute', '10minute', '15minute', '30minute', '60minute', 'day'].includes(kiteInterval)) {
        throw new Error(`Invalid interval: ${interval}. Valid values: 1, 3, 5, 10, 15, 30, 60, day`);
    }

    try {
        // Get credentials
        const { api_key, access_token } = await getKiteCredentials();

        // Format dates
        const fromDate = formatDateForKite(from, false);
        const toDate = formatDateForKite(to, true);

        // Build URL
        const token = String(instrument_token);
        const url = new URL(`${BASE_URL}/instruments/historical/${token}/${kiteInterval}`);
        url.searchParams.set('from', fromDate);
        url.searchParams.set('to', toDate);
        if (oi) url.searchParams.set('oi', '1');
        if (continuous) url.searchParams.set('continuous', '1');

        console.log(`[KiteHistorical] Fetching: ${url.pathname}?from=${fromDate}&to=${toDate}`);

        // Make request
        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: {
                'X-Kite-Version': '3',
                'Authorization': `token ${api_key}:${access_token}`
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[KiteHistorical] API Error:', response.status, errorText);

            if (response.status === 403) {
                throw new Error('Access token expired. Please login again.');
            } else if (response.status === 400) {
                throw new Error(`Invalid request: ${errorText}`);
            } else if (response.status === 404) {
                throw new Error('Historical data not found for this instrument.');
            }

            throw new Error(`Kite API error: ${response.status} ${errorText}`);
        }

        const data = await response.json();

        if (data.status !== 'success') {
            throw new Error(data.message || 'Failed to fetch historical data');
        }

        const candles = data.data?.candles;

        if (!candles || !Array.isArray(candles)) {
            console.warn('[KiteHistorical] No candles in response');
            return [];
        }

        // Transform Kite response to our format
        // Kite: ["2024-12-01T09:15:00+0530", open, high, low, close, volume, oi?]
        // Our format: [timestamp_ms, open, high, low, close, volume]
        const transformed = candles.map(candle => {
            const [timestamp, open, high, low, close, volume] = candle;
            return [
                new Date(timestamp).getTime(),  // Convert ISO to milliseconds
                open,
                high,
                low,
                close,
                volume
            ];
        });

        console.log(`[KiteHistorical] Received ${transformed.length} candles`);
        return transformed;

    } catch (error) {
        console.error('[KiteHistorical] Error:', error.message);
        throw error;
    }
}

/**
 * Get intraday historical data (convenience wrapper)
 * Same as getKiteHistoricalData but with explicit interval validation
 */
export async function getKiteIntradayData(params) {
    const validIntradayIntervals = ['1', '3', '5', '10', '15', '30', '60'];
    const interval = String(params.interval || '5');

    if (!validIntradayIntervals.includes(interval)) {
        throw new Error(`Invalid intraday interval: ${interval}. Valid: ${validIntradayIntervals.join(', ')}`);
    }

    return getKiteHistoricalData(params);
}

/**
 * Get daily historical data (convenience wrapper)
 */
export async function getKiteDailyData(params) {
    return getKiteHistoricalData({
        ...params,
        interval: 'day'
    });
}

export default {
    getKiteHistoricalData,
    getKiteIntradayData,
    getKiteDailyData,
    INTERVAL_MAP
};
