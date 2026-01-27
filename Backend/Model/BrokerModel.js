import mongoose from 'mongoose';
const { Schema } = mongoose;

// Helper function to generate a unique 10-digit ID for login
function generateId() {
    return Math.floor(1000000000 + Math.random() * 9000000000).toString();
}

const BrokerSchema = new Schema({
    // 🔑 PRIMARY LOGIN IDENTIFIER: Ab 'login_id' hai
    login_id: {
        type: String,
        required: true,
        unique: true,
        default: generateId, // ID will be auto-generated upon creation
    },
    
    password: {
        type: String,
        required: true,
    },
    
    name: {
        type: String,
        required: true,
    },
    
    // Broker/Admin role
    role: {
        type: String,
        enum: ['broker', 'admin'],
        default: 'broker',
    },

    created_at: {
        type: Date,
        default: Date.now,
    },
});

    const BrokerModel = mongoose.model('Broker', BrokerSchema);
    export default BrokerModel;