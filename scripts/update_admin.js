const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');

async function updateAdmin() {
  try {
    console.log('[UpdateAdmin] Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('[UpdateAdmin] Connected successfully.');

    // 1. Update Admin User
    const userUpdate = await mongoose.connection.collection('users').updateOne(
      { role: 'admin' },
      {
        $set: {
          name: 'Dhrub Pandit',
          email: 'dhrub.pandit@draft.io',
          storeLocation: '',
        }
      }
    );
    console.log('[UpdateAdmin] User update matched:', userUpdate.matchedCount, 'modified:', userUpdate.modifiedCount);

    // 2. Update Admin Staff Member (formerly Marcus Vance)
    const staffUpdate = await mongoose.connection.collection('staffs').updateOne(
      { $or: [{ name: 'Marcus Vance' }, { roleKey: 'inventory_lead' }] },
      {
        $set: {
          name: 'Dhrub Pandit',
          email: 'dhrub.p@draft.io',
        }
      }
    );
    console.log('[UpdateAdmin] Staff update matched:', staffUpdate.matchedCount, 'modified:', staffUpdate.modifiedCount);

    // 3. Verify
    const updatedUser = await mongoose.connection.collection('users').findOne({ role: 'admin' });
    console.log('[UpdateAdmin] Verified User:', {
      _id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role,
      storeLocation: updatedUser.storeLocation,
    });

    const updatedStaff = await mongoose.connection.collection('staffs').findOne({ name: 'Dhrub Pandit' });
    console.log('[UpdateAdmin] Verified Staff:', {
      _id: updatedStaff._id,
      name: updatedStaff.name,
      email: updatedStaff.email,
      role: updatedStaff.role,
    });

    console.log('[UpdateAdmin] Database updated successfully.');
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('[UpdateAdmin Error]:', err);
    process.exit(1);
  }
}

updateAdmin();
