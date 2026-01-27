import mongoose from 'mongoose';
const { Schema } = mongoose;

const HoldingSchemas = new Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // User (Customer) se link
        required: true,
    },
    symbol: { // Stock ka naam/ticker (e.g., RELIANCE)
        type: String,
        required: true,
    },
    qty: { // Quantity
        type: Number,
        required: true,
    },
    avg: { // Average Buy Price
        type: Number,
        required: true,
    },
    ltp: { // Last Traded Price (Real-time update ke liye)
        type: Number,
        default: 0,
    },
    net_change: { // Net change in price (String se Number kiya gaya)
        type: Number,
        default: 0,
    },
    day_change: { // Day's change percentage
        type: Number,
        default: 0,
    },
});

export default mongoose.model('Holding', HoldingSchemas);
