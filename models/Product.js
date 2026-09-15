const mongoose = require('mongoose');

const SpecSchema = new mongoose.Schema({
  label: { type: String, required: true },
  value: { type: String, required: true },
}, { _id: false });

const ProductSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
  },
  sku: {
    type: String,
    required: [true, 'SKU is required'],
    unique: true,
    trim: true,
    uppercase: true,
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    trim: true,
    default: 'Electronics',
  },
  basePrice: {
    type: Number,
    required: [true, 'Base price is required'],
    min: 0,
  },
  originalPrice: {
    type: Number,
    default: null,
  },
  stockQty: {
    type: Number,
    required: true,
    default: 0,
    min: 0,
  },
  lowStockThreshold: {
    type: Number,
    default: 10,
  },
  images: [{
    type: String,
  }],
  coverImage: {
    type: String,
    default: '',
  },
  description: {
    type: String,
    default: '',
  },
  specs: [SpecSchema],
  status: {
    type: String,
    enum: ['published', 'draft', 'archived'],
    default: 'published',
  },
  featured: {
    type: Boolean,
    default: false,
  },
  location: {
    type: String,
    default: 'Flagship',
  },
  bopisReady: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

ProductSchema.virtual('inStock').get(function () {
  return this.stockQty > 0;
});

ProductSchema.virtual('isLowStock').get(function () {
  return this.stockQty > 0 && this.stockQty <= this.lowStockThreshold;
});

ProductSchema.virtual('stockStatus').get(function () {
  if (this.stockQty === 0) return 'out_of_stock';
  if (this.stockQty <= this.lowStockThreshold) return 'low_stock';
  return 'in_stock';
});

// Performance Indexes for fast filtering and search
ProductSchema.index({ status: 1, category: 1, createdAt: -1 });
ProductSchema.index({ status: 1, stockQty: 1 });
ProductSchema.index({ name: 'text', sku: 'text', description: 'text' });

module.exports = mongoose.model('Product', ProductSchema);
