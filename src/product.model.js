import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
    product_id: {
        type: String,
        required: true,
        unique: true  // Optional: ensure no duplicate product IDs
    },
    name: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        required: true
    },
    gst: {
        type: Number,
        enum: [0, 5, 12, 18, 28],
        required: true
    },
    category: {
        type: String,
        required: true
    },
    expiry_date: { type: String,default: "N/A" }
}, { timestamps: true });

const productCollection = mongoose.model('product', productSchema);
export default productCollection;
