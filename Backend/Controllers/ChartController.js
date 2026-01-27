// Backend/Controllers/ChartController.js
// Updated to use Kite historical API instead of Dhan

import { getKiteHistoricalData } from '../services/kiteHistorical.js';
import Instrument from '../Model/InstrumentModel.js';

/**
 * Get historical candle data from Kite
 * Query params:
 *   - instrument_token: Kite instrument token (required)
 *   - symbol: Alternative - tradingSymbol for lookup
 *   - from: Start date (YYYY-MM-DD or YYYY-MM-DD HH:MM:SS)
 *   - to: End date (YYYY-MM-DD or YYYY-MM-DD HH:MM:SS)
 *   - interval: Time interval (1, 5, 15, 60, day) - default: day
 */
async function getChartData(req, res) {
  try {
    const { instrument_token, symbol, from, to, interval = 'day' } = req.query;

    // Validate required parameters
    if ((!instrument_token && !symbol) || !from || !to) {
      return res.status(400).json({
        error: 'Missing required parameters',
        details: 'instrument_token (or symbol), from, and to are required. Format: from=YYYY-MM-DD&to=YYYY-MM-DD'
      });
    }

    let token, tradingSymbol, instrument;

    if (instrument_token) {
      // Direct instrument_token provided
      token = String(instrument_token);

      // Look up instrument for metadata
      instrument = await Instrument.findOne({ instrument_token: token }).lean();
      tradingSymbol = instrument?.tradingsymbol || `Token: ${token}`;
    } else if (symbol) {
      // Look up by trading symbol
      instrument = await Instrument.findOne({
        tradingsymbol: { $regex: new RegExp(`^${symbol}$`, 'i') }
      }).lean();

      if (!instrument) {
        console.error('[ChartController] Instrument not found:', symbol);
        return res.status(404).json({
          error: 'Instrument not found',
          details: `No instrument found with trading symbol: ${symbol}`
        });
      }

      token = instrument.instrument_token;
      tradingSymbol = instrument.tradingsymbol;
    }

    if (!token) {
      return res.status(400).json({
        error: 'Could not resolve instrument_token',
        details: 'Please provide a valid instrument_token or symbol'
      });
    }

    console.log(`[ChartController] Fetching daily data for ${tradingSymbol} (${token})`);

    // Fetch from Kite API
    const candles = await getKiteHistoricalData({
      instrument_token: token,
      interval: interval,
      from: from,
      to: to,
      continuous: false
    });

    // Check if we got data
    if (!candles || candles.length === 0) {
      console.warn('[ChartController] No candles returned from Kite');
      return res.json({
        ok: true,
        data: {
          candles: [],
          message: 'No data available for the specified period'
        }
      });
    }

    console.log(`[ChartController] Successfully fetched ${candles.length} candles`);

    // Return in expected format for frontend
    return res.json({
      ok: true,
      data: {
        candles: candles,
        meta: {
          symbol: tradingSymbol,
          instrument_token: token,
          segment: instrument?.segment,
          from: from,
          to: to,
          count: candles.length
        }
      }
    });

  } catch (error) {
    console.error('[ChartController] Error:', error);

    // Return user-friendly error
    return res.status(500).json({
      error: 'Failed to fetch chart data',
      details: error.message,
      hint: 'Please check if the instrument exists and dates are valid (YYYY-MM-DD format)'
    });
  }
}

/**
 * Get intraday candle data from Kite (1, 3, 5, 10, 15, 30, 60 minute intervals)
 * Query params:
 *   - instrument_token: Kite instrument token (required)
 *   - symbol: Alternative - tradingSymbol for lookup
 *   - from: Start datetime (YYYY-MM-DD HH:MM:SS or ISO string)
 *   - to: End datetime (YYYY-MM-DD HH:MM:SS or ISO string)
 *   - interval: Time interval in minutes (1, 3, 5, 10, 15, 30, or 60) - default: 5
 *   - oi: Include Open Interest (optional, boolean)
 */
async function getIntradayData(req, res) {
  try {
    const { instrument_token, symbol, from, to, interval = '5', oi = 'false' } = req.query;

    // Validate required parameters
    if ((!instrument_token && !symbol) || !from || !to) {
      return res.status(400).json({
        error: 'Missing required parameters',
        details: 'instrument_token (or symbol), from, and to are required. Format: from=YYYY-MM-DD HH:MM:SS&to=YYYY-MM-DD HH:MM:SS'
      });
    }

    // Validate interval
    const validIntervals = ['1', '3', '5', '10', '15', '30', '60'];
    if (!validIntervals.includes(String(interval))) {
      return res.status(400).json({
        error: 'Invalid interval',
        details: `interval must be one of: ${validIntervals.join(', ')} minutes`
      });
    }

    let token, tradingSymbol, instrument;

    if (instrument_token) {
      token = String(instrument_token);
      instrument = await Instrument.findOne({ instrument_token: token }).lean();
      tradingSymbol = instrument?.tradingsymbol || `Token: ${token}`;
    } else if (symbol) {
      instrument = await Instrument.findOne({
        tradingsymbol: { $regex: new RegExp(`^${symbol}$`, 'i') }
      }).lean();

      if (!instrument) {
        console.error('[ChartController] Instrument not found:', symbol);
        return res.status(404).json({
          error: 'Instrument not found',
          details: `No instrument found with trading symbol: ${symbol}`
        });
      }

      token = instrument.instrument_token;
      tradingSymbol = instrument.tradingsymbol;
    }

    if (!token) {
      return res.status(400).json({
        error: 'Could not resolve instrument_token',
        details: 'Please provide a valid instrument_token or symbol'
      });
    }

    console.log(`[ChartController] Fetching intraday data for ${tradingSymbol} (${token}), interval: ${interval}m`);

    // Fetch from Kite API
    const candles = await getKiteHistoricalData({
      instrument_token: token,
      interval: interval,
      from: from,
      to: to,
      oi: oi === 'true' || oi === true
    });

    // Check if we got data
    if (!candles || candles.length === 0) {
      console.warn('[ChartController] No candles returned from Kite');
      return res.json({
        ok: true,
        data: {
          candles: [],
          message: 'No data available for the specified period'
        }
      });
    }

    console.log(`[ChartController] Successfully fetched ${candles.length} intraday candles`);

    // Return in expected format for frontend
    return res.json({
      ok: true,
      data: {
        candles: candles,
        meta: {
          symbol: tradingSymbol,
          instrument_token: token,
          segment: instrument?.segment,
          interval: `${interval}m`,
          from: from,
          to: to,
          count: candles.length
        }
      }
    });

  } catch (error) {
    console.error('[ChartController] Intraday error:', error);

    // Return user-friendly error
    return res.status(500).json({
      error: 'Failed to fetch intraday chart data',
      details: error.message,
      hint: 'Please check if the instrument exists and dates are valid (YYYY-MM-DD HH:MM:SS format)'
    });
  }
}

export { getChartData, getIntradayData };
