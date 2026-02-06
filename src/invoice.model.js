import mongoose from 'mongoose';

const invoiceSchema = new mongoose.Schema({
  invoiceId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  vendorId: {
    type: String,
    required: true,
    trim: true
  },
  vendorName: {
    type: String,
    required: true,
    trim: true
  },
  vendorEmail: {
    type: String,
    trim: true
  },
  vendorGstId: {
    type: String,
    trim: true
  },
  items: [{
    product_id: {
      type: String,
      required: true
    },
    productName: {
      type: String,
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    rate: {
      type: Number,
      required: true,
      min: 0
    },
    gst: {
      type: Number,
      required: true,
      min: 0
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    }
  }],
  subtotal: {
    type: Number,
    required: true,
    min: 0
  },
  gstTotal: {
    type: Number,
    required: true,
    min: 0
  },
  total: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['Draft', 'Sent', 'Paid', 'Cancelled', 'Overdue'],
    default: 'Draft'
  },
  dueDate: {
    type: Date
  },
  paidDate: {
    type: Date
  },
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Index for faster queries
invoiceSchema.index({ invoiceId: 1 });
invoiceSchema.index({ vendorId: 1 });
invoiceSchema.index({ status: 1 });
invoiceSchema.index({ createdAt: -1 });

// Virtual for checking if invoice is overdue
invoiceSchema.virtual('isOverdue').get(function() {
  if (this.status === 'Paid' || this.status === 'Cancelled') {
    return false;
  }
  if (this.dueDate && new Date() > this.dueDate) {
    return true;
  }
  return false;
});

// Static method to get invoice statistics
invoiceSchema.statics.getInvoiceStats = async function() {
  const stats = await this.aggregate([
    {
      $facet: {
        totalInvoices: [{ $count: 'count' }],
        byStatus: [
          { $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: '$total' } } }
        ],
        totalRevenue: [
          { $match: { status: 'Paid' } },
          { $group: { _id: null, total: { $sum: '$total' } } }
        ],
        pendingAmount: [
          { $match: { status: { $in: ['Draft', 'Sent'] } } },
          { $group: { _id: null, total: { $sum: '$total' } } }
        ]
      }
    }
  ]);
  
  return stats[0];
};

// Ensure virtuals are included in JSON
invoiceSchema.set('toJSON', { virtuals: true });
invoiceSchema.set('toObject', { virtuals: true });

const Invoice = mongoose.model('Invoice', invoiceSchema);

export default Invoice;