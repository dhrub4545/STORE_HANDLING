const path = require('path');
const dotenv = require('dotenv');

// Load environment variables immediately before any other imports
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config();

const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoose = require('mongoose');
const { initChatSocket } = require('./sockets/chatSocket');

// Validate critical environment variables gracefully
if (!process.env.MONGO_URI) {
  console.warn('[Backend Warning] MONGO_URI is not set in environment variables. Add MONGO_URI in Vercel Project Settings > Environment Variables.');
}
if (!process.env.JWT_SECRET) {
  console.warn('[Backend Warning] JWT_SECRET is not set. Using fallback secret.');
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'retail_super_secret_jwt_key_2026';
}

const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

// Route files
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const quicklistRoutes = require('./routes/quicklistRoutes');
const staffRoutes = require('./routes/staffRoutes');
const statsRoutes = require('./routes/statsRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const orderRoutes = require('./routes/orderRoutes');
const addressRoutes = require('./routes/addressRoutes');
const itemRequestRoutes = require('./routes/itemRequestRoutes');

const app = express();

// Database auto-connection for serverless and long-running instances
connectDB().catch((err) => {
  console.error('[Database Initial Error]', err.message);
});

// Middleware to ensure DB is connected before processing requests
app.use(async (req, res, next) => {
  try {
    if (process.env.MONGO_URI && mongoose.connection.readyState !== 1) {
      await connectDB();
    }
    next();
  } catch (err) {
    console.error('[DB Request Middleware Error]', err.message);
    next();
  }
});

// Security and utility middleware
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.options('*', cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// Root endpoint for verifying deployment in browser
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    service: 'Retail OS Backend API',
    environment: process.env.NODE_ENV || 'development',
    serverless: Boolean(process.env.VERCEL),
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      products: '/api/products',
      requests: '/api/requests',
      orders: '/api/orders',
      staff: '/api/staff',
    },
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStatus = dbState === 1 ? 'connected' : dbState === 2 ? 'connecting' : 'disconnected';
  res.json({
    status: 'online',
    service: 'Retail OS Backend',
    database: dbStatus,
    serverless: Boolean(process.env.VERCEL),
    hasMongoUri: Boolean(process.env.MONGO_URI),
    hasCloudinary: Boolean(process.env.CLOUDINARY_CLOUD_NAME),
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/quicklist', quicklistRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/addresses', addressRoutes);
app.use('/api/requests', itemRequestRoutes);

// Global Error Handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
const httpServer = http.createServer(app);

try {
  initChatSocket(httpServer);
} catch (e) {
  console.warn('[Socket.IO] WebSockets notice:', e.message);
}

// Only listen to port in standalone Node.js environments (Vercel Serverless handles HTTP listening directly)
if (!process.env.VERCEL) {
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`[Backend] Server with WebSockets running on port ${PORT} (0.0.0.0)`);
  });
}

process.on('unhandledRejection', (err) => {
  console.error(`[Backend Error] ${err.message}`);
});

module.exports = app;
