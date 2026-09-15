const mongoose = require('mongoose');

const StaffSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  role: {
    type: String,
    enum: ['Super Admin', 'Admin', 'Inventory Lead', 'Inventory Manager', 'Store Clerk', 'Warehouse Associate'],
    default: 'Store Clerk',
  },
  roleKey: {
    type: String,
    enum: ['super_admin', 'admin', 'inventory_lead', 'inventory_manager', 'store_clerk', 'warehouse_associate'],
    default: 'store_clerk',
  },
  avatar: {
    type: String,
    default: '',
  },
  accessScope: {
    type: String,
    default: 'Floor POS Access',
  },
  status: {
    type: String,
    enum: ['active', 'pending', 'inactive'],
    default: 'active',
  },
  lastActive: {
    type: String,
    default: 'Just now',
  },
  mfaVerified: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Staff', StaffSchema);
