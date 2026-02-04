//inventory.model.js

import mongoose from "mongoose";

const inventorySchema = new mongoose.Schema({
  product_id: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  name: { 
    type: String, 
    required: true,
    trim: true,
  },
  description: { 
    type: String, 
    required: true,
    trim: true,
  },
  price: { 
    type: Number, 
    required: true,
    min: 0,
  },
  gst: { 
    type: Number, 
    required: true,
    enum: [0, 5, 12, 18, 28], // <-- GST dropdown constraint
  },
  category: { 
    type: String, 
    required: true,
    enum: ["Electronics", "Clothing", "Furniture", "Books", "Food"], // <-- Category dropdown constraint
  },
  quantity: { 
    type: Number, 
    required: true, 
    min: 0,
    default: 1,
  },
  expiry_date: { 
    type: String, 
    required: true, 
    default: "N/A", // "N/A" for non-expiry items
    trim: true,
  },
  created_at: {
    type: Date,
    default: Date.now,
  }
});

const Inventory = mongoose.model("Inventory", inventorySchema);

export default Inventory;
