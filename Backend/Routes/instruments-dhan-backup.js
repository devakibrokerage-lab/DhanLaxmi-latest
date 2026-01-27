// Routes/instruments.js
import { Router } from "express";
import Instrument from "../Model/InstrumentModel.js";
import { getSpotPrice } from "../services/spotPriceCache.js";
import { getCache, setCache } from "../services/redisCache.js";

const router = Router();

// ATM filter percentage - strikes within ±X% of spot are considered ATM
const ATM_RANGE_PERCENT = 0.08; // ±8% range

// ==================== SEARCH OPTIMIZATION CACHE ====================
// Search query cache - stores search results for 2 minutes
const searchCache = new Map();
const SEARCH_CACHE_TTL = 2 * 60 * 1000; // 2 minutes

// Spot price cache - stores spot prices for 1 minute
const spotPriceCache = new Map();
const SPOT_CACHE_TTL = 1 * 60 * 1000; // 1 minute

// Search analytics - track popular searches
const searchAnalytics = new Map();
const ANALYTICS_WINDOW = 60 * 60 * 1000; // 1 hour rolling window

// Track search query
function trackSearch(query, category, resultsCount) {
    const key = `${query.toLowerCase()}:${category}`;
    const now = Date.now();
    
    if (!searchAnalytics.has(key)) {
        searchAnalytics.set(key, {
            query,
            category,
            count: 0,
            lastSearched: now,
            avgResults: 0
        });
    }
    
    const stats = searchAnalytics.get(key);
    stats.count++;
    stats.lastSearched = now;
    stats.avgResults = Math.round((stats.avgResults * (stats.count - 1) + resultsCount) / stats.count);
}

// Get top searches
function getTopSearches(limit = 20) {
    const now = Date.now();
    const recentSearches = Array.from(searchAnalytics.entries())
        .filter(([_, stats]) => (now - stats.lastSearched) < ANALYTICS_WINDOW)
        .map(([key, stats]) => ({ key, ...stats }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);
    
    return recentSearches;
}

// Hot searches list - pre-warmed on server start
const HOT_SEARCHES = [
    // NSE F&O - Indices
    'NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY', 'SENSEX',
    // NSE F&O - High Volume Stocks
    'HDFCBANK', 'RELIANCE', 'TATAMOTORS', 'SBIN', 'ICICIBANK', 
    'INFY', 'ADANIENT', 'MARUTI', 'TATASTEEL', 'VEDL',
    // High Volatility / Speculative
    'IDEA', 'BHEL', 'COALINDIA', 'ZEEL', 'DLF',
    // MCX - Energy
    'CRUDEOIL', 'NATURALGAS',
    // MCX - Bullion
    'GOLD', 'GOLDM', 'GOLDPETAL', 'SILVER', 'SILVERM', 'SILVERMIC',
    // MCX - Base Metals
    'COPPER', 'ZINC', 'ALUMINIUM', 'LEAD'
];

// Cache cleanup interval - runs every 5 minutes
setInterval(() => {
    const now = Date.now();
    
    // Clean search cache
    for (const [key, value] of searchCache.entries()) {
        if (now - value.timestamp > SEARCH_CACHE_TTL) {
            searchCache.delete(key);
        }
    }
    
    // Clean spot price cache
    for (const [key, value] of spotPriceCache.entries()) {
        if (now - value.timestamp > SPOT_CACHE_TTL) {
            spotPriceCache.delete(key);
        }
    }
    
    console.log(`[Cache Cleanup] Search: ${searchCache.size} entries, Spot: ${spotPriceCache.size} entries`);
}, 5 * 60 * 1000);

// Helper: Get cached spot price or fetch fresh (Redis + Memory)
async function getCachedSpotPrice(underlying) {
    const spotKey = `spot:${underlying.toUpperCase()}`;
    const now = Date.now();
    
    // Try Redis first
    const redisSpot = await getCache(spotKey);
    if (redisSpot && redisSpot.price) {
        return redisSpot.price;
    }
    
    // Try memory cache
    const cached = spotPriceCache.get(underlying);
    if (cached && (now - cached.timestamp) < SPOT_CACHE_TTL) {
        // Promote to Redis
        setCache(spotKey, { price: cached.price }, 60).catch(err => 
            console.error('[Redis] Failed to cache spot price:', err)
        );
        return cached.price;
    }
    
    // Fetch fresh
    const price = await getSpotPrice(underlying);
    if (price && price > 0) {
        spotPriceCache.set(underlying, { price, timestamp: now });
        setCache(spotKey, { price }, 60).catch(err => 
            console.error('[Redis] Failed to cache spot price:', err)
        );
    }
    return price;
}

// Pre-warm hot searches on server start (async, non-blocking)
setTimeout(async () => {
    console.log('[Search Pre-warming] Starting hot searches cache...');
    let warmed = 0;
    
    for (const query of HOT_SEARCHES) {
        try {
            // Simulate a search to warm the cache
            const cacheKey = `${query.toLowerCase()}:All`;
            
            // Only warm if not already cached
            if (!searchCache.has(cacheKey)) {
                // We'll warm these on first actual search to avoid blocking startup
                warmed++;
            }
        } catch (e) {
            console.error(`[Search Pre-warming] Failed for ${query}:`, e.message);
        }
    }
    
    console.log(`[Search Pre-warming] Ready to cache ${warmed} hot searches on demand`);
}, 2000); // Start 2 seconds after server starts

// ==================== END SEARCH OPTIMIZATION CACHE ====================

// >>> SMART KEYWORD DETECTION CONFIG START <<<
// Keywords that indicate INDEX instruments should be prioritized (after futures)
const INDEX_KEYWORDS = [
    'nifty', 'banknifty', 'bank nifty', 'nifty 50', 'nifty50', 'finnifty', 'fin nifty',
    'sensex', 'bankex', 'midcap', 'smallcap', 'nifty it', 'nifty auto', 'nifty pharma',
    'nifty metal', 'nifty energy', 'nifty infra', 'nifty psu', 'nifty realty',
    'nifty media', 'nifty private bank', 'nifty commodities', 'india vix'
];

// Function to detect if search query is INDEX-related
const isIndexKeyword = (query) => {
    const lowerQ = query.toLowerCase().trim();
    return INDEX_KEYWORDS.some(keyword => {
        // Exact match or starts with keyword
        return lowerQ === keyword || 
               lowerQ.startsWith(keyword) || 
               keyword.startsWith(lowerQ) ||
               lowerQ.includes(keyword);
    });
};

// Function to get segment priority based on keyword
// Returns: { priorityOrder: [...segments], detectedType: 'index' | 'equity' | 'default' }
const getSmartPriority = (query) => {
    const lowerQ = query.toLowerCase().trim();
    
    // Check if it's an index keyword
    if (isIndexKeyword(lowerQ)) {
        console.log(`[SmartSearch] Detected INDEX keyword: "${query}"`);
        return {
            // >>> COMMENT OUT TO INCLUDE INDEX IN PRIORITY <<<
            priorityOrder: ['FUTURES', 'NSE_FNO_OPTIONS', 'MCX_COMM'],
            // priorityOrder: ['FUTURES', 'NSE_INDEX', 'NSE_FNO_OPTIONS', 'MCX_COMM'],
            // >>> END INDEX TOGGLE <<<
            detectedType: 'index'
        };
    }
    
    // Default priority: Futures > Options > Commodity
    console.log(`[SmartSearch] Default priority for: "${query}"`);
    return {
        // >>> COMMENT OUT TO INCLUDE INDEX IN PRIORITY <<<
        priorityOrder: ['FUTURES', 'NSE_FNO_OPTIONS', 'MCX_COMM'],
        // priorityOrder: ['FUTURES', 'NSE_INDEX', 'NSE_FNO_OPTIONS', 'MCX_COMM'],
        // >>> END INDEX TOGGLE <<<
        detectedType: 'default'
    };
};
// >>> SMART KEYWORD DETECTION CONFIG END <<<

/**
 * Smart search with ATM strike filtering
 * For options, only returns strikes near the current spot price
 */
router.get("/search", async (req, res) => {
    try {
        const q = String(req.query.q || "").trim();
        const category = String(req.query.category || "All").trim();
        if (!q) return res.json([]);

        // ==================== REDIS/MEMORY CACHE CHECK ====================
        const cacheKey = `search:${q.toLowerCase()}:${category}`;
        const now = Date.now();
        
        // Try Redis first (distributed cache)
        const redisCache = await getCache(cacheKey);
        if (redisCache) {
            console.log(`[Search Redis Cache HIT] "${q}" (${category}) - ${redisCache.length} results`);
            trackSearch(q, category, redisCache.length);
            return res.json(redisCache);
        }
        
        // Fallback to memory cache
        const memoryCached = searchCache.get(cacheKey);
        if (memoryCached && (now - memoryCached.timestamp) < SEARCH_CACHE_TTL) {
            console.log(`[Search Memory Cache HIT] "${q}" (${category}) - ${memoryCached.results.length} results`);
            trackSearch(q, category, memoryCached.results.length);
            // Promote to Redis for other instances
            setCache(cacheKey, memoryCached.results, 120).catch(err => 
                console.error('[Redis] Failed to promote cache:', err)
            );
            return res.json(memoryCached.results);
        }
        // ==================== END CACHE CHECK ====================

        const upperQ = q.toUpperCase();
        const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

        // Get smart priority based on keyword detection
        const smartPriority = getSmartPriority(q);

        // Define segment lists based on category
        let segmentFilter;
        switch (category) {
            case "F&O":
                segmentFilter = ["NSE_FNO", "BSE_FNO"];
                break;
            case "Commodity":
                segmentFilter = ["MCX_COMM", "NSE_COMM"];
                break;
            case "NSE_INDEX":
            case "Index":
                segmentFilter = ["NSE_INDEX", "BSE_INDEX"];
                break;
            case "All":
            default:
                // >>> COMMENT OUT TO INCLUDE INDEX IN SEARCH <<<
                segmentFilter = ["NSE_FNO", "BSE_FNO", "MCX_COMM"];
                // segmentFilter = ["NSE_INDEX","BSE_INDEX","NSE_FNO","BSE_FNO","MCX_COMM"];
                // >>> END INDEX TOGGLE <<<
                break;
        }

        // --- Special case: Index search (no ATM filtering needed) ---
        if (category === "NSE_INDEX" || category === "Index") {
            const indexResults = await Instrument.find({
                segment: { $in: ["NSE_INDEX", "BSE_INDEX"] },
                $or: [
                    { tradingsymbol: regex },
                    { symbol_name: regex },
                    { display_name: regex }
                ]
            })
            .limit(50)
            .lean();
            
            console.log(`[Search] Index search for "${q}" found ${indexResults.length} results`);
            trackSearch(q, category, indexResults.length);
            
            // Cache the results in both Redis and memory
            searchCache.set(cacheKey, { results: indexResults, timestamp: Date.now() });
            setCache(cacheKey, indexResults, 120).catch(err => 
                console.error('[Redis] Failed to cache:', err)
            );
            
            return res.json(indexResults);
        }

        // --- Step 1: Find unique underlying symbols that match the search ---
        const underlyingMatches = await Instrument.distinct("underlying_symbol", {
            segment: { $in: segmentFilter },
            underlying_symbol: { $exists: true, $ne: null },
            $or: [
                { tradingsymbol: regex },
                { symbol_name: regex },
                { display_name: regex },
                { underlying_symbol: regex }
            ]
        });

        // --- Step 2: Get spot prices for all matching underlyings ---
        const spotPrices = new Map();
        await Promise.all(
            underlyingMatches.slice(0, 10).map(async (underlying) => { // Limit to 10 underlyings
                const spot = await getCachedSpotPrice(underlying);
                if (spot && spot > 0) {
                    spotPrices.set(underlying.toUpperCase(), spot);
                }
            })
        );

        console.log(`[Search] Found spot prices for ${spotPrices.size} underlyings:`, 
            Array.from(spotPrices.entries()).map(([k, v]) => `${k}:${v.toFixed(2)}`).join(', '));

        // --- Step 3: Build smart query with ATM filtering ---
        const currentDate = new Date();
        
        // First, get futures (always include - they have liquidity)
        const futuresQuery = {
            segment: { $in: segmentFilter },
            instrumentType: { $in: ['FUTIDX', 'FUTSTK', 'FUTCOM', 'FUTCUR'] },
            expiry: { $gte: currentDate },
            $or: [
                { tradingsymbol: regex },
                { symbol_name: regex },
                { display_name: regex },
                { underlying_symbol: regex }
            ]
        };

        const futures = await Instrument.find(futuresQuery)
            .sort({ expiry: 1 }) // Nearest expiry first
            .limit(50)
            .lean();

        // --- Step 4: Get ATM options for each underlying ---
        let options = [];
        
        for (const [underlying, spotPrice] of spotPrices) {
            const minStrike = spotPrice * (1 - ATM_RANGE_PERCENT);
            const maxStrike = spotPrice * (1 + ATM_RANGE_PERCENT);
            
            // Find nearest expiry for this underlying
            const nearestExpiry = await Instrument.findOne({
                underlying_symbol: { $regex: new RegExp(`^${underlying}$`, 'i') },
                segment: { $in: segmentFilter },
                instrumentType: { $in: ['OPTIDX', 'OPTSTK', 'OPTFUT', 'OPTCUR'] },
                expiry: { $gte: currentDate }
            })
            .sort({ expiry: 1 })
            .select('expiry')
            .lean();

            if (!nearestExpiry) continue;

            // Get ATM options for nearest expiry
            const atmOptions = await Instrument.find({
                underlying_symbol: { $regex: new RegExp(`^${underlying}$`, 'i') },
                segment: { $in: segmentFilter },
                instrumentType: { $in: ['OPTIDX', 'OPTSTK', 'OPTFUT', 'OPTCUR'] },
                expiry: nearestExpiry.expiry,
                strike: { $gte: minStrike, $lte: maxStrike }
            })
            .sort({ strike: 1 })
            .limit(100) // Max 100 options per underlying (50 strikes x 2 CE/PE)
            .lean();

            options = options.concat(atmOptions);
        }

        // --- Step 5: If no spot prices found, fall back to basic search with filters ---
        if (spotPrices.size === 0) {
            console.log(`[Search] No spot prices available, using fallback search`);

            // >>> FALLBACK INDEX SEARCH START <<<
            let fallbackIndex = [];
            if (segmentFilter.includes('NSE_INDEX') || segmentFilter.includes('BSE_INDEX')) {
                const indexSegments = segmentFilter.filter(s => s === 'NSE_INDEX' || s === 'BSE_INDEX');
                fallbackIndex = await Instrument.find({
                    segment: { $in: indexSegments },
                    $or: [
                        { tradingsymbol: regex },
                        { symbol_name: regex },
                        { display_name: regex }
                    ]
                })
                .limit(20)
                .lean();
                console.log(`[Search Fallback] Found ${fallbackIndex.length} index instruments`);
                if (fallbackIndex.length > 0) {
                    console.log(`[Search Fallback] Index instruments:`, fallbackIndex.map(i => `${i.display_name || i.tradingsymbol}`).join(', '));
                }
            }
            // >>> FALLBACK INDEX SEARCH END <<<

            // Fallback: prioritize futures and limit options (derivatives with expiry)
            const fallbackDerivatives = await Instrument.aggregate([
                {
                    $match: {
                        segment: { $in: segmentFilter },
                        expiry: { $gte: currentDate },
                        $or: [
                            { tradingsymbol: regex },
                            { symbol_name: regex },
                            { display_name: regex }
                        ]
                    }
                },
                {
                    $addFields: {
                        // Boost futures over options
                        typeScore: {
                            $cond: {
                                if: { $in: ["$instrumentType", ["FUTIDX", "FUTSTK", "FUTCOM", "FUTCUR"]] },
                                then: 1000,
                                else: 0
                            }
                        },
                        // Boost nearest expiry
                        expiryScore: {
                            $subtract: [0, { $toLong: "$expiry" }]
                        }
                    }
                },
                { $sort: { typeScore: -1, expiryScore: -1 } },
                { $limit: 200 },
                {
                    $project: {
                        _id: 1,
                        securityId: 1,
                        segment: 1,
                        tradingsymbol: 1,
                        symbol_name: 1,
                        display_name: 1,
                        expiry: 1,
                        lotSize: 1,
                        instrumentType: 1,
                        strike: 1,
                        optionType: 1
                    }
                }
            ]);

            // Combine all results (order doesn't matter yet, we'll sort)
            const combinedFallback = [...fallbackIndex, ...fallbackDerivatives];
            
            // Remove duplicates
            const seenFallback = new Set();
            const uniqueFallback = combinedFallback.filter(item => {
                if (seenFallback.has(item.securityId)) return false;
                seenFallback.add(item.securityId);
                return true;
            });

            // >>> SMART SORT FALLBACK START <<<
            // Sort using smart priority: FUTURES always first, then keyword-based segment priority
            uniqueFallback.sort((a, b) => {
                const getTypePriority = (item) => {
                    const isFuture = ['FUTIDX', 'FUTSTK', 'FUTCOM', 'FUTCUR'].includes(item.instrumentType);
                    const isOption = ['OPTIDX', 'OPTSTK', 'OPTFUT', 'OPTCUR'].includes(item.instrumentType);
                    
                    // FUTURES ALWAYS FIRST (priority 1)
                    if (isFuture) return 1;
                    
                    // Then use smart priority based on detected keyword
                    if (smartPriority.detectedType === 'index') {
                        // Index keyword detected: Futures > Index > Options > Commodity
                        if (item.segment === 'NSE_INDEX' || item.segment === 'BSE_INDEX') return 2;
                        if (isOption) return 3;
                        if (item.segment === 'MCX_COMM') return 4;
                    } else {
                        // Default: Futures > Index > Options > Commodity
                        if (item.segment === 'NSE_INDEX' || item.segment === 'BSE_INDEX') return 2;
                        if (isOption) return 3;
                        if (item.segment === 'MCX_COMM') return 4;
                    }
                    return 6;
                };
                
                const priorityDiff = getTypePriority(a) - getTypePriority(b);
                if (priorityDiff !== 0) return priorityDiff;
                
                // For derivatives: sort by expiry (nearest first)
                if (a.expiry && b.expiry) {
                    const expiryDiff = new Date(a.expiry) - new Date(b.expiry);
                    if (expiryDiff !== 0) return expiryDiff;
                }
                
                if (a.strike && b.strike) return a.strike - b.strike;
                return 0;
            });
            // >>> SMART SORT FALLBACK END <<<

            const fallbackResults = uniqueFallback.slice(0, 200);
            console.log(`[Search Fallback] Returning ${fallbackResults.length} results (${fallbackIndex.length} index, ${fallbackDerivatives.length} derivatives, detected: ${smartPriority.detectedType})`);
            trackSearch(q, category, fallbackResults.length);
            
            // Cache the results in both Redis and memory
            searchCache.set(cacheKey, { results: fallbackResults, timestamp: Date.now() });
            setCache(cacheKey, fallbackResults, 120).catch(err => 
                console.error('[Redis] Failed to cache:', err)
            );
            
            return res.json(fallbackResults);
        }

        // --- Step 5.1: Get Equity Stocks (no expiry filter needed) ---
        // >>> EQUITY SEARCH START - Comment out this block to disable equity in search <<<
        let equityStocks = [];
        if (segmentFilter.includes('NSE_EQ') || segmentFilter.includes('BSE_EQ')) {
            const equitySegments = segmentFilter.filter(s => s === 'NSE_EQ' || s === 'BSE_EQ');
            equityStocks = await Instrument.find({
                segment: { $in: equitySegments },
                $or: [
                    { tradingsymbol: regex },
                    { symbol_name: regex },
                    { display_name: regex }
                ]
            })
            .limit(50)
            .lean();
            console.log(`[Search] Found ${equityStocks.length} equity stocks`);
        }
        // >>> EQUITY SEARCH END <<<

        // --- Step 5.2: Get Index Instruments (no expiry filter needed) ---
        // >>> INDEX SEARCH START - Comment out this block to disable index in search <<<
        let indexInstruments = [];
        if (segmentFilter.includes('NSE_INDEX') || segmentFilter.includes('BSE_INDEX')) {
            // More flexible regex for index search - matches partial words
            // e.g., "nifty" should match "Nifty 50", "Nifty Bank", etc.
            const indexRegex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
            const indexSegments = segmentFilter.filter(s => s === 'NSE_INDEX' || s === 'BSE_INDEX');
            
            indexInstruments = await Instrument.find({
                segment: { $in: indexSegments },
                $or: [
                    { tradingsymbol: indexRegex },
                    { symbol_name: indexRegex },
                    { display_name: indexRegex }
                ]
            })
            .limit(20)
            .lean();
            
            console.log(`[Search] Index search query: "${q}", regex: ${indexRegex}, found ${indexInstruments.length} index instruments`);
            if (indexInstruments.length > 0) {
                console.log(`[Search] Index instruments found:`, indexInstruments.map(i => `${i.display_name || i.tradingsymbol} (secId: ${i.securityId})`).join(', '));
            }
        }
        // >>> INDEX SEARCH END <<<

        // --- Step 6: Combine and sort results ---
        const combined = [...equityStocks, ...indexInstruments, ...futures, ...options];
        
        // Remove duplicates by securityId
        const seen = new Set();
        const unique = combined.filter(item => {
            if (seen.has(item.securityId)) return false;
            seen.add(item.securityId);
            return true;
        });

        // >>> SMART SORT START <<<
        // Sort using smart priority: FUTURES always first, then keyword-based segment priority
        unique.sort((a, b) => {
            // Smart priority based on detected keyword type
            // Priority order from smartPriority.priorityOrder
            const getTypePriority = (item) => {
                const isFuture = ['FUTIDX', 'FUTSTK', 'FUTCOM', 'FUTCUR'].includes(item.instrumentType);
                const isOption = ['OPTIDX', 'OPTSTK', 'OPTFUT', 'OPTCUR'].includes(item.instrumentType);
                
                // FUTURES ALWAYS FIRST (priority 1)
                if (isFuture) return 1;
                
                // Then use smart priority based on detected keyword
                if (smartPriority.detectedType === 'index') {
                    // Index keyword detected: Futures > Index > Options > Equity > Commodity
                    if (item.segment === 'NSE_INDEX' || item.segment === 'BSE_INDEX') return 2;
                    if (isOption) return 3;
                    if (item.segment === 'NSE_EQ' || item.segment === 'BSE_EQ') return 4;
                    if (item.segment === 'MCX_COMM') return 5;
                } else {
                    // Default: Futures > Equity > Index > Options > Commodity
                    if (item.segment === 'NSE_EQ' || item.segment === 'BSE_EQ') return 2;
                    if (item.segment === 'NSE_INDEX' || item.segment === 'BSE_INDEX') return 3;
                    if (isOption) return 4;
                    if (item.segment === 'MCX_COMM') return 5;
                }
                return 6; // Everything else
            };
            
            const priorityDiff = getTypePriority(a) - getTypePriority(b);
            if (priorityDiff !== 0) return priorityDiff;
            
            // For derivatives: sort by expiry (nearest first)
            if (a.expiry && b.expiry) {
                const expiryDiff = new Date(a.expiry) - new Date(b.expiry);
                if (expiryDiff !== 0) return expiryDiff;
            }
            
            // Then by strike (for options with same underlying)
            if (a.strike && b.strike) {
                return a.strike - b.strike;
            }
            
            return 0;
        });
        // >>> SMART SORT END <<<

        // Format response - return up to 200 results
        const results = unique.slice(0, 200).map(item => ({
            _id: item._id,
            securityId: item.securityId,
            segment: item.segment,
            tradingsymbol: item.tradingsymbol,
            symbol_name: item.symbol_name,
            display_name: item.display_name,
            expiry: item.expiry,
            lotSize: item.lotSize,
            instrumentType: item.instrumentType,
            strike: item.strike,
            optionType: item.optionType
        }));

        console.log(`[Search] Returning ${results.length} results (${equityStocks.length} equity, ${indexInstruments.length} index, ${futures.length} futures, ${options.length} options) | Detected: ${smartPriority.detectedType}`);
        trackSearch(q, category, results.length);
        
        // Cache the results in both Redis and memory
        searchCache.set(cacheKey, { results, timestamp: Date.now() });
        setCache(cacheKey, results, 120).catch(err => 
            console.error('[Redis] Failed to cache:', err)
        );
        
        res.json(results);

    } catch (e) {
        console.error("instruments/search error:", e);
        res.status(500).json({ error: "failed" });
    }
});

// New endpoint to get a list of instruments for the watchlist
// New endpoint to get a list of instruments for the watchlist
router.get("/watchlist", async (req, res) => {
    try {
        // Define a list of popular stock keywords for the Indian F&O market
        const popularKeywords = [
            "RELIANCE", "HDFCBANK", "ICICIBANK", "INFY", "TCS", "KOTAKBANK",
            "HINDUNILVR", "ITC", "BHARTIARTL", "SBIN", "BAJFINANCE", "LT",
            "AXISBANK", "MARUTI", "ASIANPAINT", "WIPRO", "TATAMOTORS", "TATASTEEL"
        ];
        const regex = new RegExp(popularKeywords.join("|"), "i");

        // Fetch instruments that match the popular keywords
        const instruments = await Instrument.find({
            segment: "NSE_FNO",
            display_name: { $regex: regex }
        })
        .select("securityId segment tradingsymbol symbol_name display_name expiry lotSize instrumentType")
        .limit(100)
        .lean();

        console.log(`[Watchlist] Found ${instruments.length} popular NSE_FNO instruments for watchlist.`);
        res.json(instruments);
    } catch (e) {
        console.error("instruments/watchlist error:", e);
        res.status(500).json({ error: "failed" });
    }
});

// Dedicated endpoint for index instruments (NIFTY 50, BANKNIFTY)
// Used by watchlist stats cards
// Cache for index instruments (refresh every 5 minutes)
let indexCache = null;
let indexCacheTime = 0;
const INDEX_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

router.get("/indexes", async (req, res) => {
    try {
        const now = Date.now();
        
        // Return cached indexes if still valid
        if (indexCache && (now - indexCacheTime) < INDEX_CACHE_TTL) {
            console.log('[Indexes] Serving from cache');
            return res.json(indexCache);
        }

        // Fetch NIFTY 50 and SENSEX indices
        const indexes = await Instrument.find(
            {
                $or: [
                    // Nifty 50
                    { 
                        segment: "NSE_INDEX",
                        $or: [
                            { tradingsymbol: { $regex: /^Nifty 50$/i } },
                            { display_name: { $regex: /^Nifty 50$/i } }
                        ]
                    },
                    // SENSEX
                    {
                        segment: "BSE_INDEX",
                        securityId: "51"
                    }
                ]
            },
            'securityId segment tradingsymbol symbol_name display_name instrumentType'
        ).lean();

        // Update cache
        indexCache = indexes;
        indexCacheTime = now;

        console.log(`[Indexes] Found ${indexes.length} index instruments (cached for 5min):`, 
            indexes.map(i => `${i.display_name || i.tradingsymbol} (${i.securityId})`).join(', '));
        
        res.json(indexes);
    } catch (e) {
        console.error("instruments/indexes error:", e);
        res.status(500).json({ error: "failed" });
    }
});

// New endpoint to get replacement instruments for the watchlist
router.post("/replacements", async (req, res) => {
    try {
        const { exclude = [], count = 1 } = req.body;

        const instruments = await Instrument.aggregate([
            {
                $match: {
                    segment: "NSE_FNO",
                    expiry: { $gte: new Date() }, // Ensure the instrument is not expired
                    securityId: { $nin: exclude } // Exclude already present IDs
                }
            },
            {
                $sample: { size: count } // Get 'count' random instruments
            },
            {
                $project: {
                    securityId: 1,
                    segment: 1,
                    tradingsymbol: 1,
                    symbol_name: 1,
                    display_name: 1,
                    expiry: 1,
                    lotSize: 1,
                    instrumentType: 1,
                }
            }
        ]);

        console.log(`[Replacements] Found ${instruments.length} new instruments.`);
        res.json(instruments);
    } catch (e) {
        console.error("instruments/replacements error:", e);
        res.status(500).json({ error: "failed" });
    }
});

// /api/instruments/resolve?... (optional)
router.get("/resolve", async (req, res) => {
    try {
        const { segment, tradingsymbol, underlying, instrumentType, expiry, strike, optionType } = req.query;
        const q = {};
        if (segment) q.segment = segment.toUpperCase();
        if (tradingsymbol) q.tradingsymbol = tradingsymbol.toUpperCase();
        if (underlying) q.underlying_symbol = underlying.toUpperCase();
        if (instrumentType) q.instrumentType = instrumentType.toUpperCase();
        if (optionType) q.optionType = optionType.toUpperCase();
        if (expiry) q.expiry = new Date(expiry);
        if (strike) q.strike = Number(strike);

        const doc = await Instrument.findOne(q).lean();
        if (!doc) return res.status(404).json({ error: "Instrument not found" });

        res.json({
            securityId: doc.securityId,
            segment: doc.segment,
            tradingsymbol: doc.tradingsymbol,
            lotSize: doc.lotSize
        });
    } catch (e) {
        console.error("instruments/resolve error:", e);
        res.status(500).json({ error: "failed" });
    }
});

// /api/instruments/lookup - Get instrument details by securityId and segment
router.get("/lookup", async (req, res) => {
    try {
        const { securityId, segment } = req.query;
        
        if (!securityId || !segment) {
            return res.status(400).json({ error: "securityId and segment are required" });
        }

        const instrument = await Instrument.findOne({
            securityId: String(securityId),
            segment: segment
        })
        .select("securityId segment tradingsymbol symbol_name display_name instrumentType")
        .lean();

        if (!instrument) {
            return res.status(404).json({ error: "Instrument not found" });
        }

        res.json(instrument);
    } catch (e) {
        console.error("instruments/lookup error:", e);
        res.status(500).json({ error: "failed" });
    }
});

/**
 * GET /api/instruments/analytics
 * Search analytics endpoint - shows popular searches and cache stats
 */
router.get("/analytics", async (req, res) => {
    try {
        const topSearches = getTopSearches(50);
        const cacheStats = {
            memory: {
                searchCache: searchCache.size,
                spotCache: spotPriceCache.size,
                analyticsTracked: searchAnalytics.size
            }
        };
        
        res.json({
            topSearches,
            cacheStats,
            timestamp: new Date().toISOString()
        });
    } catch (e) {
        console.error("instruments/analytics error:", e);
        res.status(500).json({ error: "failed" });
    }
});

export default router;
