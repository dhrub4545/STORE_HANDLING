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
const { initChatSocket } = require('./sockets/chatSocket');


// Validate critical environment variables
if (!process.env.MONGO_URI) {
  console.error('[Fatal Error] MONGO_URI is not defined in environment variables.');
  process.exit(1);
}
if (!process.env.JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    console.error('[Fatal Error] JWT_SECRET must be defined in production.');
    process.exit(1);
  } else {
    console.warn('[Security Warning] JWT_SECRET is not set in .env. Using fallback secret for development only.');
  }
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

// Connect to MongoDB
connectDB();

// Security and utility middleware
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    service: 'Retail OS Backend',
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
const io = initChatSocket(httpServer);

const server = httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`[Backend] Server with WebSockets running on port ${PORT} (0.0.0.0)`);
});

process.on('unhandledRejection', (err) => {
  console.error(`[Backend Error] ${err.message}`);
});

module.exports = app;
