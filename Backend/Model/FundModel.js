import mongoose from 'mongoose';

const fundSchema = new mongoose.Schema({
    customer_id_str: {
        type: String,
        required: true,
        index: true
    },
    broker_id_str: {
        type: String,
        required: true,
        index: true
    },

    net_available_balance: {
        type: Number,
        required: true,
        default: 0.00
    },


    intraday: {

        available_limit: { 
            type: Number, 
            default: 0.00 
        },

        used_limit: { 
            type: Number, 
            default: 0.00 
        },

        free_limit: {
            type : Number,
            default: 0.00
        }

    },

    // 3. Overnight/Delivery Fund Section (Grey Tab)
    overnight: {
        available_limit: { 
            type: Number, 
            default: 0.00 
        },
    },

    // 4. Option Limit Tracking (Daily 10% Cap) - SEGREGATED
    option_limit: {
        intraday: {
            used_today: { type: Number, default: 0.00 },
            last_trade_date: { type: Date }
        },
        overnight: {
            used_today: { type: Number, default: 0.00 },
            last_trade_date: { type: Date }
        }
    },

    // Dynamic Option Limit Percentage (Default 10%)
    option_limit_percentage: {
        type: Number,
        default: 10
    },

    broker_mobile_number:{type: Number}

}, {
    timestamps: true, 
});



const Fund = mongoose.model('FundModel', fundSchema);

export default Fund;
