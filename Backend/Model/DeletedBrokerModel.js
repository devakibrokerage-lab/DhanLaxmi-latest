import mongoose from 'mongoose';
const { Schema } = mongoose;

const DeletedBrokerSchema = new Schema({
    // Original Broker Data
    login_id: {
        type: String,
        required: true,
    },
    
    password: {
        type: String, // Plain text as per original model
        required: true,
    },
    
    name: {
        type: String,
        required: true,
    },

    organization_name: {
        type: String,
    },
    
    role: {
        type: String,
        default: 'broker',
    },

    // 🗑️ DELETION INFO
    original_id: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
    },

    deleted_at: {
        type: Date,
        default: Date.now,
    },

    deleted_by: {
        type: String, // Likely 'SuperBroker' or Admin ID
        default: 'SuperBroker',
    },

    // Preservation of original dates
    original_created_at: {
        type: Date,
    },

    // 📊 Data Summary
    data_summary: {
        customers_count: { type: Number, default: 0 },
    },

    // 👥 Archived Customers List (Metadata only, for reference/restore)
    customers: [{
        customer_id: String,
        password: String,
        name: String,
        original_id: mongoose.Schema.Types.ObjectId
    }],

}, { timestamps: true });

export default mongoose.model('DeletedBroker', DeletedBrokerSchema);
