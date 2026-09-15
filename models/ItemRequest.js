const mongoose = require('mongoose');

const RequestedItemSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Item name is required'],
      trim: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
    targetPrice: {
      type: Number,
      min: 0,
      default: null,
    },
    specs: {
      type: String,
      default: '',
      trim: true,
    },
    category: {
      type: String,
      default: '',
      trim: true,
    },
    referenceImage: {
      type: String,
      default: '',
    },
    availabilityStatus: {
      type: String,
      enum: ['in_stock', 'bopis_ready', 'available_online', 'expected_soon', 'unavailable', 'pending', ''],
      default: 'pending',
    },
    availableQty: {
      type: Number,
      default: null,
    },
    availablePrice: {
      type: Number,
      default: null,
    },
  },
  { _id: true, timestamps: true }
);

const ItemRequestMessageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    senderName: {
      type: String,
      required: true,
      trim: true,
    },
    senderRole: {
      type: String,
      default: 'customer',
    },
    message: {
      type: String,
      default: '',
      trim: true,
    },
    image: {
      type: String,
      default: '',
      trim: true,
    },
    isEncrypted: {
      type: Boolean,
      default: true,
    },
    encryptedMeta: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const ItemRequestSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
    },
    userName: {
      type: String,
      required: true,
      trim: true,
    },
    userEmail: {
      type: String,
      required: true,
      trim: true,
    },
    title: {
      type: String,
      required: [true, 'Item request title is required'],
      trim: true,
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
      default: 'Custom Sourcing',
    },
    targetPrice: {
      type: Number,
      min: 0,
      default: null,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
    urgency: {
      type: String,
      enum: ['low', 'standard', 'high', 'urgent'],
      default: 'standard',
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
    },
    referenceImage: {
      type: String,
      default: '',
    },
    // Itemized list of items in this procurement inquiry
    items: [RequestedItemSchema],
    status: {
      type: String,
      enum: ['pending', 'in_sourcing', 'approved', 'fulfilled', 'declined'],
      default: 'pending',
    },
    adminNotes: {
      type: String,
      default: '',
      trim: true,
    },
    adminUpdatedBy: {
      type: String,
      default: '',
      trim: true,
    },
    adminUpdatedAt: {
      type: Date,
      default: null,
    },
    linkedProductId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      default: null,
    },
    availabilityStatus: {
      type: String,
      enum: ['in_stock', 'bopis_ready', 'available_online', 'expected_soon', 'unavailable', ''],
      default: '',
    },
    availableQty: {
      type: Number,
      default: null,
    },
    availablePrice: {
      type: Number,
      default: null,
    },
    availableLocation: {
      type: String,
      default: '',
      trim: true,
    },
    availableDate: {
      type: String,
      default: '',
      trim: true,
    },
    // Direct chat messages between admin/staff and customer
    messages: [ItemRequestMessageSchema],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);
// Performance Indexes for customer queues and status filters
ItemRequestSchema.index({ user: 1, createdAt: -1 });
ItemRequestSchema.index({ status: 1, createdAt: -1 });
ItemRequestSchema.index({ 'messages.createdAt': 1 });

module.exports = mongoose.model('ItemRequest', ItemRequestSchema);
