import mongoose from 'mongoose';
const { Schema } = mongoose;

const DeletedCustomerSchema = new Schema({
    // Original customer data
    customer_id: {
        type: String,
        required: true,
    },
    
    password: {
        type: String,
        default: '', // Some customers may not have passwords
    },
    
    name: {
        type: String,
        required: true,
    },
    
    role: {
        type: String,
        default: 'customer',
    },
    
    // 🔗 BROKER LINKAGE: Which broker this customer belonged to
    attached_broker_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Broker',
        required: true,
    },
    
    // 🗑️ DELETION INFO
    original_id: {
        type: mongoose.Schema.Types.ObjectId,
        required: true, // Original MongoDB _id from Customer collection
    },
    
    deleted_at: {
        type: Date,
        default: Date.now,
    },
    
    deleted_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Broker', // Broker who deleted this customer
        required: true,
    },
    
    // Original creation date (preserved from Customer)
    original_created_at: {
        type: Date,
        required: true,
    },

    // =============================================
    // 📦 ARCHIVED RELATED DATA
    // =============================================

    // 💰 Fund Data
    archived_fund: {
        net_available_balance: { type: Number, default: 0 },
        intraday: {
            available_limit: { type: Number, default: 0 },
            used_limit: { type: Number, default: 0 },
            free_limit: { type: Number, default: 0 },
        },
        overnight: {
            available_limit: { type: Number, default: 0 },
        },
        broker_mobile_number: { type: Number },
    },

    // 📊 Orders Data (all orders - open, closed, holding, overnight)
    archived_orders: [{
        broker_id_str: String,
        customer_id_str: String,
        security_Id: String,
        symbol: String,
        segment: String,
        side: String,
        product: String,
        price: Number,
        closed_ltp: Number,
        expire: Date,
        came_From: String,
        quantity: Number,
        lots: Number,
        lot_size: Number,
        stop_loss: Number,
        target: Number,
        exit_reason: String,
        margin_blocked: Number,
        filled_qty: Number,
        avg_fill_price: Number,
        order_status: String,
        order_category: String,
        increase_price: Number,
        broker_order_id: String,
        exchange_order_id: String,
        notional_value: Number,
        placed_at: Date,
        closed_at: Date,
        updated_at: Date,
        meta: Object,
        createdAt: Date,
        updatedAt: Date,
    }],

    // 📈 Holdings Data
    archived_holdings: [{
        symbol: String,
        qty: Number,
        avg: Number,
        ltp: Number,
        net_change: Number,
        day_change: Number,
    }],

    // 📉 Positions Data
    archived_positions: [{
        symbol: String,
        qty: Number,
        avg: Number,
        ltp: Number,
        pnl: Number,
        net_change: Number,
        day_change: Number,
        isLoss: Boolean,
        position_type: String,
    }],

    // 👁️ Watchlist Data
    archived_watchlist: [{
        type: String, // instrument strings
    }],

    // 📊 Data Summary (for quick display in UI)
    data_summary: {
        total_orders: { type: Number, default: 0 },
        open_orders: { type: Number, default: 0 },
        closed_orders: { type: Number, default: 0 },
        total_holdings: { type: Number, default: 0 },
        total_positions: { type: Number, default: 0 },
        watchlist_count: { type: Number, default: 0 },
        fund_balance: { type: Number, default: 0 },
    },

}, { timestamps: true }); // createdAt here = when moved to recycle bin

export default mongoose.model('DeletedCustomer', DeletedCustomerSchema);
