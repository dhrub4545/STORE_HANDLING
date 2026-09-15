const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Product = require('../models/Product');
const User = require('../models/User');
const Staff = require('../models/Staff');
const Quicklist = require('../models/Quicklist');
const Order = require('../models/Order');
const Address = require('../models/Address');

async function pruneDb() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('[Prune] Connected to MongoDB Atlas');

  // 1. Keep only 2 products
  const keptSkus = ['AUR-09', 'KB-ERG-88'];
  const keptProducts = await Product.find({ sku: { $in: keptSkus } });
  const keptProductIds = keptProducts.map((p) => p._id);
  const deletedProducts = await Product.deleteMany({ _id: { $nin: keptProductIds } });
  console.log('[Products] Kept:', keptProducts.length, 'Deleted:', deletedProducts.deletedCount);

  // 2. Keep only Quicklist items for the 2 kept products
  const keptQuicklist = await Quicklist.find({ product: { $in: keptProductIds } });
  const keptQuicklistIds = keptQuicklist.map((q) => q._id);
  const deletedQuicklist = await Quicklist.deleteMany({ _id: { $nin: keptQuicklistIds } });
  console.log('[Quicklist] Kept:', keptQuicklist.length, 'Deleted:', deletedQuicklist.deletedCount);

  // 3. Keep only 2 Staff members
  const keptStaffEmails = ['sarah.j@draft.io', 'marcus.v@draft.io', 'sarah.j@omniflow.io', 'marcus.v@omniflow.io'];
  const keptStaff = await Staff.find({ email: { $in: keptStaffEmails } });
  const keptStaffIds = keptStaff.map((s) => s._id);
  const deletedStaff = await Staff.deleteMany({ _id: { $nin: keptStaffIds } });
  console.log('[Staff] Kept:', keptStaff.length, 'Deleted:', deletedStaff.deletedCount);

  // 4. Keep only 2 Orders
  const keptOrderNums = ['PO-9412', 'PO-9388'];
  const keptOrders = await Order.find({ orderNumber: { $in: keptOrderNums } });
  const keptOrderIds = keptOrders.map((o) => o._id);
  const deletedOrders = await Order.deleteMany({ _id: { $nin: keptOrderIds } });
  console.log('[Orders] Kept:', keptOrders.length, 'Deleted:', deletedOrders.deletedCount);

  // 5. Keep only 2 Addresses
  const allAddresses = await Address.find({});
  if (allAddresses.length > 2) {
    const keepAddrIds = allAddresses.slice(0, 2).map((a) => a._id);
    const deletedAddr = await Address.deleteMany({ _id: { $nin: keepAddrIds } });
    console.log('[Addresses] Kept: 2, Deleted:', deletedAddr.deletedCount);
  } else {
    console.log('[Addresses] Kept:', allAddresses.length);
  }

  // 6. Users count
  const users = await User.find({});
  console.log('[Users] Kept:', users.length);

  // Final verification
  console.log('\n--- FINAL COUNTS ---');
  console.log('Products count:', await Product.countDocuments());
  console.log('Users count:', await User.countDocuments());
  console.log('Staff count:', await Staff.countDocuments());
  console.log('Quicklist count:', await Quicklist.countDocuments());
  console.log('Orders count:', await Order.countDocuments());
  console.log('Addresses count:', await Address.countDocuments());

  await mongoose.disconnect();
  console.log('[Prune] Complete!');
}

pruneDb().catch((e) => {
  console.error(e);
  process.exit(1);
});
