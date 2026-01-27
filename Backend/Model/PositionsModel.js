
import mongoose from 'mongoose';
const {Schema} = mongoose;

const PositionsSchemas = new Schema({
    userId : {
        type : mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required : true // 'require' ko 'required' kiya gaya
    },
    symbol: String,
    qty: Number,
    avg: { // Average entry price
        type: Number,
        required: true,
    },
    ltp: Number,
    pnl: { // Current Profit/Loss
        type: Number,
        default: 0,
    },
    net_change: Number,
    day_change: Number,
    isLoss: Boolean,
    position_type: { // Intraday, Futures, Options
        type: String,
        required: true,
    },
});

export default mongoose.model('Positions', PositionsSchemas);
