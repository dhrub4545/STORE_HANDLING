const mongoose = require('mongoose');

const OrderItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  qty: { type: Number, required: true, default: 1 },
  price: { type: String, required: true },
  sku: { type: String, default: '' },
});

const OrderSchema = new mongoose.Schema({
  orderNumber: { type: String, required: true, unique: true },
  dateDisplay: { type: String, default: '' },
  status: {
    type: String,
    enum: ['Delivered', 'In Transit', 'Processing', 'Cancelled'],
    default: 'Delivered',
  },
  statusColor: { type: String, default: '#059669' },
  statusBg: { type: String, default: '#ecfdf5' },
  total: { type: String, required: true },
  itemCount: { type: Number, default: 1 },
  fulfillment: { type: String, default: 'Direct Dispatch • Dock 4' },
  deliveryBay: { type: String, required: true },
  tracking: { type: String, default: '' },
  eta: { type: String, default: '' },
  items: [OrderItemSchema],
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, {
  timestamps: true,
});

// Performance Indexes for order history & status queries
OrderSchema.index({ user: 1, createdAt: -1 });
OrderSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Order', OrderSchema);
