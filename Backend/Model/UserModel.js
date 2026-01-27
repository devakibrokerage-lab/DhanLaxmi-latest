import mongoose from 'mongoose';
const { Schema } = mongoose;

// Helper function to generate a unique 10-digit customer ID
function generateCustomerId() {
    // Generate a number between 1,000,000,000 and 9,999,999,999 (10 digits)
    return Math.floor(1000000000 + Math.random() * 9000000000).toString();
}

const UserSchemas = new Schema({
    // 🔑 PRIMARY LOGIN IDENTIFIER: Customer ID (10 Digits)
    customer_id: {
        type: String,
        required: true,
        unique: true,
        // Default value MongoDB mein save hone se pehle generate hoga
        default: generateCustomerId,
    },
    
    hashed_password: {
        type: String,
        required: true,
    },
    name: {
        type: String,
        required: true,
    },
    
    // 🔑 ROLE DEFINITION: Broker ya Customer
    role: {
        type: String,
        enum: ['customer', 'broker'],
        default: 'customer',
        required: true,
    },
    
    // 🔑 BROKER LINKAGE (Agar role 'customer' hai toh zaroori)
    attached_broker_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', 
        default: null, // Broker ke liye yeh null rahega, Customer ke liye Broker ki _id hogi
    },

    created_at: {
        type: Date,
        default: Date.now,
    },
});

// Model ko export karte hain
export default mongoose.model('User', UserSchemas);