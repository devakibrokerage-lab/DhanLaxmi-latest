import mongoose from 'mongoose';
const { Schema } = mongoose;

const UserWatchlistSchema = new Schema({
  broker_id_str : {
    type : String,
    required : true, // Note: it is 'required', not 'require'
  },
  customer_id_str : {
    type : String,
    required : true,
  },
  instruments: [{
    type: String, 
  }],
}, { timestamps: true });

// ADD THIS: Create a compound unique index
// This ensures one watchlist per broker+customer pair
UserWatchlistSchema.index({ broker_id_str: 1, customer_id_str: 1 }, { unique: true });

export default mongoose.model('UserWatchlist', UserWatchlistSchema);