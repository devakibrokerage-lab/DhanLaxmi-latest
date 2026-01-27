// Backend/Model/WatchlistModel.js

import mongoose from 'mongoose';

const WatchlistSchema = new mongoose.Schema({
    userId: { 
        // type: mongoose.Schema.Types.ObjectId, 
        type: String, 
        ref: 'User', 
        required: true, 
        index: true 
    },
    
    // --- Stable Intent (User Input) ---
    underlying: { 
        type: String, 
        required: true,
        uppercase: true,
        trim: true,
        // Example: RELIANCE, NIFTY
    }, 
    preference: { 
        type: String, 
        required: true,
        default: 'nearest_month_future',
        // Example: nearest_month_future, nearest_month_atm_option
    },
    segmentPref: { 
        type: [String], 
        default: ['NSE_FO', 'NSE_COM'] 
    },

    // --- Dynamic Cache (Resolver's Output) ---
    cachedInstrumentKey: { 
        type: String, 
        required: false 
        // Example: NSE_FO|164693
    },
    cacheExpiresAt: { 
        type: Date, 
        required: false 
        // TTL for the cached key (Set 1 day before contract expiry)
    },
    
    // Compound index for efficient lookup by user and symbol
}, { timestamps: true });

// Ensure a user cannot add the same underlying twice
WatchlistSchema.index({ userId: 1, underlying: 1 }, { unique: true });

// Optional: MongoDB TTL Index (If you want MongoDB to automatically clean up expired cache)
// WatchlistSchema.index({ cacheExpiresAt: 1 }, { expireAfterSeconds: 0 }); 

export default mongoose.model('Watchlist', WatchlistSchema);