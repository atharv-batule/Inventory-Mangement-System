import mongoose from "mongoose";

const orderSchema = new mongoose.Schema({
  order_id: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  customer_name: {
    type: String,
    required: true,
    trim: true
  },
  customer_email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  customer_phone: {
    type: String,
    required: true,
    trim: true
  },
  product_name: {
    type: String,
    required: true,
    trim: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  unit_price: {
    type: Number,
    required: true,
    min: 0
  },
  total_amount: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'],
    default: 'Pending'
  },
  payment_method: {
    type: String,
    enum: ['Cash', 'Card', 'UPI', 'Net Banking'],
    required: true
  },
  shipping_address: {
    type: String,
    required: true,
    trim: true
  },
  order_date: {
    type: Date,
    default: Date.now
  },
  delivery_date: {
    type: Date,
    default: null
  },
  notes: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Static method to get order statistics
orderSchema.statics.getOrderStats = async function() {
  const allOrders = await this.find();
  
  const stats = {
    totalOrders: allOrders.length,
    totalRevenue: allOrders.reduce((sum, order) => sum + order.total_amount, 0),
    pendingOrders: allOrders.filter(order => order.status === 'Pending').length,
    completedOrders: allOrders.filter(order => order.status === 'Delivered').length,
    cancelledOrders: allOrders.filter(order => order.status === 'Cancelled').length,
    statusBreakdown: {},
    paymentMethodBreakdown: {},
    averageOrderValue: 0
  };
  
  // Calculate status breakdown
  allOrders.forEach(order => {
    if (!stats.statusBreakdown[order.status]) {
      stats.statusBreakdown[order.status] = {
        count: 0,
        revenue: 0
      };
    }
    stats.statusBreakdown[order.status].count++;
    stats.statusBreakdown[order.status].revenue += order.total_amount;
  });
  
  // Calculate payment method breakdown
  allOrders.forEach(order => {
    if (!stats.paymentMethodBreakdown[order.payment_method]) {
      stats.paymentMethodBreakdown[order.payment_method] = {
        count: 0,
        revenue: 0
      };
    }
    stats.paymentMethodBreakdown[order.payment_method].count++;
    stats.paymentMethodBreakdown[order.payment_method].revenue += order.total_amount;
  });
  
  // Calculate average order value
  if (allOrders.length > 0) {
    stats.averageOrderValue = stats.totalRevenue / allOrders.length;
  }
  
  return stats;
};

const Order = mongoose.model("Order", orderSchema);

export default Order;