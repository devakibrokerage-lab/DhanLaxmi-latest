// services/spotPriceCache.js
// Caches spot prices for underlying instruments using Dhan Option Chain API

import { getDhanOptionChain, getDhanExpiryList, getNearestExpiry } from './dhanOptionChain.js';
import Instrument from '../Model/InstrumentModel.js';

// Cache: underlying_symbol -> { ltp, timestamp }
const spotCache = new Map();
const CACHE_TTL_MS = 60 * 1000; // 60 seconds cache

/**
 * Get spot price for an underlying symbol using Dhan Option Chain API
 * The Option Chain API returns `last_price` which is the underlying's current price
 * @param {string} underlyingSymbol - e.g., "GOLD", "SILVER", "NIFTY", "RELIANCE"
 * @returns {Promise<number|null>} - LTP or null if unavailable
 */
export async function getSpotPrice(underlyingSymbol) {
    if (!underlyingSymbol) return null;
    
    const symbol = underlyingSymbol.toUpperCase();
    
    // Check cache first
    const cached = spotCache.get(symbol);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
        return cached.ltp;
    }
    
    try {
        // Step 1: Find a futures/option instrument for this underlying to get securityId
        const instrument = await findUnderlyingInstrument(symbol);
        if (!instrument) {
            console.log(`[SpotPriceCache] No instrument found for ${symbol}`);
            return null;
        }
        
        // Step 2: Map segment to Dhan format (IDX_I for indices)
        let underlyingSeg = instrument.segment;
        if (underlyingSeg === 'NSE_INDEX') {
            underlyingSeg = 'IDX_I';
        }
        
        // Step 3: Get expiry list
        const expiries = await getDhanExpiryList({
            underlyingScrip: instrument.securityId,
            underlyingSeg: underlyingSeg
        });
        
        const nearestExpiry = getNearestExpiry(expiries);
        if (!nearestExpiry) {
            console.log(`[SpotPriceCache] No expiries found for ${symbol}`);
            return null;
        }
        
        // Step 4: Fetch option chain - it returns underlyingLtp
        const optionChainData = await getDhanOptionChain({
            underlyingScrip: instrument.securityId,
            underlyingSeg: underlyingSeg,
            expiry: nearestExpiry
        });
        
        const ltp = optionChainData?.underlyingLtp;
        
        if (ltp && ltp > 0) {
            // Cache the result
            spotCache.set(symbol, { 
                ltp: ltp, 
                timestamp: Date.now()
            });
            console.log(`[SpotPriceCache] Cached ${symbol} LTP: ${ltp}`);
            return ltp;
        }
        
        return null;
        
    } catch (error) {
        console.error(`[SpotPriceCache] Error fetching spot for ${symbol}:`, error.message);
        return null;
    }
}

/**
 * Find an underlying instrument (futures or the underlying itself)
 * The securityId of this instrument is used to call Option Chain API
 */
async function findUnderlyingInstrument(underlyingSymbol) {
    const symbol = underlyingSymbol.toUpperCase();
    const now = new Date();
    
    try {
        // Priority 1: Find nearest FUTURES for this underlying (MCX commodities)
        const commodityFutures = await Instrument.findOne({
            underlying_symbol: { $regex: new RegExp(`^${symbol}$`, 'i') },
            instrumentType: { $in: ['FUTCOM', 'FUTCUR'] },
            segment: 'MCX_COMM',
            expiry: { $gte: now }
        })
        .sort({ expiry: 1 })
        .lean();
        
        if (commodityFutures) {
            console.log(`[SpotPriceCache] Found MCX futures for ${symbol}: ${commodityFutures.tradingsymbol}`);
            return commodityFutures;
        }
        
        // Priority 2: Find NSE index futures (NIFTY, BANKNIFTY, etc.)
        const indexFutures = await Instrument.findOne({
            underlying_symbol: { $regex: new RegExp(`^${symbol}$`, 'i') },
            instrumentType: 'FUTIDX',
            segment: 'NSE_FNO',
            expiry: { $gte: now }
        })
        .sort({ expiry: 1 })
        .lean();
        
        if (indexFutures) {
            console.log(`[SpotPriceCache] Found index futures for ${symbol}: ${indexFutures.tradingsymbol}`);
            return indexFutures;
        }
        
        // Priority 3: Find stock futures
        const stockFutures = await Instrument.findOne({
            underlying_symbol: { $regex: new RegExp(`^${symbol}$`, 'i') },
            instrumentType: 'FUTSTK,OPTSTK,OPTFUT,FUTCOM',
            segment: 'NSE_FNO,NSE_FNO',
            expiry: { $gte: now }
        })
        .sort({ expiry: 1 })
        .lean();
        
        if (stockFutures) {
            console.log(`[SpotPriceCache] Found stock futures for ${symbol}: ${stockFutures.tradingsymbol}`);
            return stockFutures;
        }
        
        // Priority 4: Find ANY option for this underlying (to get the underlying securityId)
        const anyOption = await Instrument.findOne({
            underlying_symbol: { $regex: new RegExp(`^${symbol}$`, 'i') },
            instrumentType: { $in: ['OPTIDX', 'OPTSTK', 'OPTFUT', 'OPTCUR'] },
            segment: { $in: ['NSE_FNO', 'MCX_COMM'] },
            expiry: { $gte: now }
        })
        .sort({ expiry: 1 })
        .lean();
        
        if (anyOption) {
            console.log(`[SpotPriceCache] Found option for ${symbol}: ${anyOption.tradingsymbol}`);
            return anyOption;
        }
        
        return null;
        
    } catch (error) {
        console.error(`[SpotPriceCache] Error finding instrument for ${symbol}:`, error.message);
        return null;
    }
}

/**
 * Get multiple spot prices at once (for batch operations)
 * @param {string[]} symbols - Array of underlying symbols
 * @returns {Promise<Map<string, number>>} - Map of symbol -> LTP
 */
export async function getMultipleSpotPrices(symbols) {
    const results = new Map();
    
    // Fetch sequentially to avoid rate limiting (Dhan has 3-second rate limit)
    for (const symbol of symbols.slice(0, 5)) { // Limit to 5 to avoid rate limits
        const ltp = await getSpotPrice(symbol);
        if (ltp) {
            results.set(symbol.toUpperCase(), ltp);
        }
    }
    
    return results;
}

/**
 * Clear the spot price cache (useful for testing)
 */
export function clearSpotCache() {
    spotCache.clear();
}

export default {
    getSpotPrice,
    getMultipleSpotPrices,
    clearSpotCache
};
