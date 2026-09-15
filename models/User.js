const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: 6,
    select: false,
  },
  role: {
    type: String,
    enum: ['member', 'customer', 'admin', 'super_admin', 'inventory_lead', 'store_clerk'],
    default: 'member',
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  verifiedAt: {
    type: Date,
    default: null,
  },
  verifiedBy: {
    type: String,
    default: '',
  },
  avatar: {
    type: String,
    default: '',
  },
  storeLocation: {
    type: String,
    default: '',
  },
  accessScope: {
    type: String,
    default: 'Retail Member Hub',
  },
  mfaEnabled: {
    type: Boolean,
    default: true,
  },
  preferences: {
    darkMode: { type: Boolean, default: false },
    biometricLogin: { type: Boolean, default: true },
    restockNotifications: { type: Boolean, default: true },
    displayUnits: { type: String, default: 'Metric • Detailed' },
    lowStockThreshold: { type: Number, default: 10 },
    primaryAddress: { type: String, default: 'Dock 4, Distribution Center West' },
  },
}, {
  timestamps: true,
});

UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

UserSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);
