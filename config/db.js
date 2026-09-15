const mongoose = require('mongoose');

let isConnecting = false;
let retryCount = 0;

const connectDB = async () => {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection; // Already connected
  }

  if (!process.env.MONGO_URI) {
    console.warn('[Database Warning] MONGO_URI is not set in environment variables.');
    return null;
  }

  if (isConnecting) {
    // Wait briefly for in-flight connection
    let waited = 0;
    while (mongoose.connection.readyState !== 1 && waited < 10000) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      waited += 200;
    }
    return mongoose.connection;
  }

  isConnecting = true;
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
    });
    retryCount = 0;
    isConnecting = false;
    console.log(`[Database] MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    isConnecting = false;
    retryCount += 1;
    console.error(`[Database] MongoDB Connection Error (attempt ${retryCount}): ${error.message}`);
    console.warn('[Database] If IP is not whitelisted, add 0.0.0.0/0 to MongoDB Atlas Network Access.');

    if (!process.env.VERCEL) {
      console.log('[Database] Retrying connection in 5 seconds...');
      setTimeout(connectDB, 5000);
    }
    throw error;
  }
};

mongoose.connection.on('disconnected', () => {
  console.warn('[Database] MongoDB disconnected.');
  if (!process.env.VERCEL) {
    console.log('[Database] Reconnecting in 5s...');
    setTimeout(connectDB, 5000);
  }
});

mongoose.connection.on('error', (err) => {
  console.error('[Database] MongoDB connection error:', err.message);
});

module.exports = connectDB;
