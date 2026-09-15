const mongoose = require('mongoose');

let isConnecting = false;
let retryCount = 0;

const connectDB = async () => {
  if (mongoose.connection.readyState === 1) {
    return; // Already connected
  }
  if (isConnecting) {
    return;
  }

  isConnecting = true;
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 15000,
    });
    retryCount = 0;
    isConnecting = false;
    console.log(`[Database] MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    isConnecting = false;
    retryCount += 1;
    console.error(`[Database] MongoDB Connection Error (attempt ${retryCount}): ${error.message}`);
    console.warn('[Database] If IP is not whitelisted, add your IP or 0.0.0.0/0 to MongoDB Atlas Network Access.');
    console.log('[Database] Retrying connection in 5 seconds...');
    setTimeout(connectDB, 5000);
  }
};

mongoose.connection.on('disconnected', () => {
  console.warn('[Database] MongoDB disconnected. Reconnecting in 5s...');
  setTimeout(connectDB, 5000);
});

mongoose.connection.on('error', (err) => {
  console.error('[Database] MongoDB connection error:', err.message);
});

module.exports = connectDB;

