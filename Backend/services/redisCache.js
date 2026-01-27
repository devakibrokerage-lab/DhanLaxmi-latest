// services/redisCache.js
/**
 * Redis caching service with graceful fallback
 * Falls back to in-memory Map if Redis is not available
 */

let redis = null;
let redisClient = null;
let useRedis = false;

// Try to import redis, fallback to null if not installed
try {
    redis = await import('redis');
    console.log('[Redis] Module found, attempting connection...');
} catch (e) {
    console.log('[Redis] Module not installed, using in-memory fallback');
}

// In-memory fallback cache
const memoryCache = new Map();
const MEMORY_CACHE_MAX_SIZE = 1000; // Limit memory cache size

// Initialize Redis client if available
async function initRedis() {
    if (!redis) return false;
    
    try {
        const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
        redisClient = redis.createClient({
            url: redisUrl,
            socket: {
                reconnectStrategy: (retries) => {
                    if (retries > 3) {
                        console.log('[Redis] Max reconnection attempts reached, using memory cache');
                        return false; // Stop reconnecting
                    }
                    return Math.min(retries * 100, 3000);
                }
            }
        });

        redisClient.on('error', (err) => {
            console.error('[Redis] Connection error:', err.message);
            useRedis = false;
        });

        redisClient.on('connect', () => {
            console.log('[Redis] ✅ Connected successfully');
            useRedis = true;
        });

        redisClient.on('ready', () => {
            console.log('[Redis] ✅ Ready to accept commands');
            useRedis = true;
        });

        redisClient.on('end', () => {
            console.log('[Redis] Connection closed, falling back to memory cache');
            useRedis = false;
        });

        await redisClient.connect();
        return true;
    } catch (err) {
        console.error('[Redis] Failed to initialize:', err.message);
        console.log('[Redis] Falling back to in-memory cache');
        return false;
    }
}

/**
 * Get value from cache (Redis or memory)
 * @param {string} key - Cache key
 * @returns {Promise<any|null>} - Cached value or null
 */
export async function getCache(key) {
    if (useRedis && redisClient) {
        try {
            const value = await redisClient.get(key);
            if (value) {
                return JSON.parse(value);
            }
            return null;
        } catch (err) {
            console.error('[Redis] Get error:', err.message);
            // Fallback to memory cache
        }
    }
    
    // Memory cache fallback
    const cached = memoryCache.get(key);
    if (cached && cached.expiry > Date.now()) {
        return cached.value;
    }
    if (cached) {
        memoryCache.delete(key); // Remove expired
    }
    return null;
}

/**
 * Set value in cache (Redis or memory)
 * @param {string} key - Cache key
 * @param {any} value - Value to cache
 * @param {number} ttlSeconds - Time to live in seconds
 * @returns {Promise<boolean>} - Success status
 */
export async function setCache(key, value, ttlSeconds = 120) {
    if (useRedis && redisClient) {
        try {
            await redisClient.setEx(key, ttlSeconds, JSON.stringify(value));
            return true;
        } catch (err) {
            console.error('[Redis] Set error:', err.message);
            // Fallback to memory cache
        }
    }
    
    // Memory cache fallback
    if (memoryCache.size >= MEMORY_CACHE_MAX_SIZE) {
        // Remove oldest entry
        const firstKey = memoryCache.keys().next().value;
        memoryCache.delete(firstKey);
    }
    
    memoryCache.set(key, {
        value,
        expiry: Date.now() + (ttlSeconds * 1000)
    });
    return true;
}

/**
 * Delete value from cache
 * @param {string} key - Cache key
 * @returns {Promise<boolean>}
 */
export async function delCache(key) {
    if (useRedis && redisClient) {
        try {
            await redisClient.del(key);
            return true;
        } catch (err) {
            console.error('[Redis] Del error:', err.message);
        }
    }
    
    memoryCache.delete(key);
    return true;
}

/**
 * Check if key exists in cache
 * @param {string} key - Cache key
 * @returns {Promise<boolean>}
 */
export async function hasCache(key) {
    if (useRedis && redisClient) {
        try {
            const exists = await redisClient.exists(key);
            return exists === 1;
        } catch (err) {
            console.error('[Redis] Exists error:', err.message);
        }
    }
    
    const cached = memoryCache.get(key);
    return cached && cached.expiry > Date.now();
}

/**
 * Get cache statistics
 * @returns {Promise<object>}
 */
export async function getCacheStats() {
    const stats = {
        type: useRedis ? 'redis' : 'memory',
        size: 0,
        connected: useRedis
    };
    
    if (useRedis && redisClient) {
        try {
            const info = await redisClient.info('stats');
            stats.info = info;
        } catch (err) {
            console.error('[Redis] Stats error:', err.message);
        }
    } else {
        stats.size = memoryCache.size;
    }
    
    return stats;
}

// Initialize on startup (non-blocking)
initRedis().catch(err => {
    console.error('[Redis] Initialization failed:', err.message);
    console.log('[Redis] Using in-memory cache');
});

// Cleanup on process exit
process.on('SIGINT', async () => {
    if (redisClient) {
        await redisClient.quit();
    }
    process.exit(0);
});

export default {
    getCache,
    setCache,
    delCache,
    hasCache,
    getCacheStats
};
