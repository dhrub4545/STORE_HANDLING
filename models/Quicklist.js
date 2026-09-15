const mongoose = require('mongoose');

const QuicklistSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  notifyOnRestock: {
    type: Boolean,
    default: true,
  },
  notes: {
    type: String,
    default: '',
  },
}, {
  timestamps: true,
});

QuicklistSchema.index({ user: 1, product: 1 }, { unique: true });

module.exports = mongoose.model('Quicklist', QuicklistSchema);
