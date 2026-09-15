const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ItemRequest = require('../models/ItemRequest');

let io = null;

// Track active users in request rooms: Map<roomName, Map<userId, userInfo>>
const roomPresence = new Map();

const Staff = require('../models/Staff');

const getJwtSecret = () =>
  process.env.JWT_SECRET ||
  (process.env.NODE_ENV !== 'production' ? 'retail_super_secret_jwt_key_2026' : null);

const isStaffRole = (role) =>
  ['admin', 'super_admin', 'inventory_lead', 'inventory_manager', 'store_clerk', 'staff', 'warehouse_associate'].includes(role);

const authenticateSocketUser = async (token) => {
  if (!token) return null;
  try {
    const cleanToken = token.startsWith('Bearer ') ? token.slice(7) : token;
    const secret = getJwtSecret();
    if (!secret) {
      console.error('[ChatSocket] JWT_SECRET is not configured');
      return null;
    }
    const decoded = jwt.verify(cleanToken, secret);
    if (!decoded || !decoded.id) return null;

    let user = await User.findById(decoded.id).select('-password');
    if (!user) {
      // Fallback: check Staff collection or token claims
      const staffMember = await Staff.findById(decoded.id);
      if (staffMember) {
        user = {
          _id: staffMember._id,
          name: staffMember.name,
          email: staffMember.email,
          role: staffMember.roleKey || 'staff',
        };
      } else if (decoded.id && decoded.role) {
        user = {
          _id: decoded.id,
          name: decoded.name || 'User',
          role: decoded.role,
        };
      }
    }
    return user;
  } catch (err) {
    console.error('[ChatSocket] Token verification error:', err.message);
    return null;
  }
};

const initChatSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: true,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['polling', 'websocket'],
    pingTimeout: 30000,
    pingInterval: 25000,
  });

  // Global socket authentication middleware
  io.use(async (socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization ||
      socket.handshake.query?.token;

    if (token) {
      const user = await authenticateSocketUser(token);
      if (user) {
        socket.user = user;
      }
    }
    next();
  });

  io.on('connection', (socket) => {
    console.log(`[ChatSocket] Client connected: ${socket.id} (User: ${socket.user?.name || 'Guest'})`);

    const joinUserChannels = (u) => {
      if (!u || !u._id) return;
      socket.join(`user_${u._id.toString()}`);
      if (isStaffRole(u.role)) {
        socket.join('staff_channel');
      }
    };

    if (socket.user) {
      joinUserChannels(socket.user);
    }

    // Explicit registration event if token is set after connection
    socket.on('register_user', async ({ token }, callback) => {
      if (token) {
        const u = await authenticateSocketUser(token);
        if (u) {
          socket.user = u;
          joinUserChannels(u);
          if (callback) callback({ success: true, userId: u._id, role: u.role });
        }
      }
    });

    // Handle joining a specific Item Request chat room
    socket.on('join_request_room', async ({ requestId, token }, callback) => {
      try {
        if (!requestId) {
          return callback && callback({ success: false, message: 'Request ID is required' });
        }

        if (!socket.user) {
          const candidateToken =
            token ||
            socket.handshake.auth?.token ||
            socket.handshake.headers?.authorization ||
            socket.handshake.query?.token;
          if (candidateToken) {
            socket.user = await authenticateSocketUser(candidateToken);
            if (socket.user) {
              joinUserChannels(socket.user);
            }
          }
        }

        if (!socket.user) {
          return callback && callback({ success: false, message: 'Unauthorized: Valid token required to join chat' });
        }

        const itemRequest = await ItemRequest.findById(requestId).select('user title status');
        if (!itemRequest) {
          return callback && callback({ success: false, message: 'Item request not found' });
        }

        const isAdmin = isStaffRole(socket.user.role);
        const isOwner = itemRequest.user && itemRequest.user.toString() === socket.user._id.toString();

        if (!isAdmin && !isOwner) {
          return callback && callback({ success: false, message: 'Forbidden: You do not have access to this chat room' });
        }

        const roomName = `request_${requestId}`;
        socket.join(roomName);

        // Update presence
        if (!roomPresence.has(roomName)) {
          roomPresence.set(roomName, new Map());
        }
        const roomUsers = roomPresence.get(roomName);
        roomUsers.set(socket.user._id.toString(), {
          userId: socket.user._id,
          name: socket.user.name,
          role: socket.user.role,
          isAdmin,
        });

        console.log(`[ChatSocket] User ${socket.user.name} (${socket.user.role}) joined ${roomName}`);

        // Broadcast presence update to room
        io.to(roomName).emit('room_presence', {
          requestId,
          users: Array.from(roomUsers.values()),
        });

        if (callback) {
          callback({
            success: true,
            room: roomName,
            requestId,
            users: Array.from(roomUsers.values()),
          });
        }
      } catch (err) {
        console.error('[ChatSocket] join_request_room error:', err);
        if (callback) callback({ success: false, message: err.message });
      }
    });

    // Handle leaving a room
    socket.on('leave_request_room', ({ requestId }) => {
      if (!requestId) return;
      const roomName = `request_${requestId}`;
      socket.leave(roomName);

      if (socket.user && roomPresence.has(roomName)) {
        const roomUsers = roomPresence.get(roomName);
        roomUsers.delete(socket.user._id.toString());

        // Broadcast typing stopped
        socket.to(roomName).emit('user_typing', {
          requestId,
          userId: socket.user._id,
          userName: socket.user.name,
          userRole: socket.user.role,
          isTyping: false,
        });

        // Broadcast presence
        io.to(roomName).emit('room_presence', {
          requestId,
          users: Array.from(roomUsers.values()),
        });
      }
    });

    // Handle typing events
    socket.on('typing', ({ requestId, isTyping }) => {
      if (!requestId || !socket.user) return;
      const roomName = `request_${requestId}`;

      const isAdmin = isStaffRole(socket.user.role);
      const displayName = isAdmin ? 'Concierge Desk' : (socket.user.name || 'Customer');

      socket.to(roomName).emit('user_typing', {
        requestId,
        userId: socket.user._id,
        userName: displayName,
        userRole: isAdmin ? 'admin' : 'customer',
        isTyping: Boolean(isTyping),
      });
    });

    // Handle sending a real-time message
    socket.on('send_message', async ({ requestId, message = '', image = '', isEncrypted = true, encryptedMeta = null }, callback) => {
      try {
        const trimmedMsg = String(message || '').trim();
        const trimmedImg = String(image || '').trim();

        if (!requestId || (!trimmedMsg && !trimmedImg)) {
          return callback && callback({ success: false, message: 'Missing message or request parameters' });
        }

        if (!socket.user) {
          const candidateToken =
            socket.handshake.auth?.token ||
            socket.handshake.headers?.authorization ||
            socket.handshake.query?.token;
          if (candidateToken) {
            socket.user = await authenticateSocketUser(candidateToken);
            if (socket.user) {
              joinUserChannels(socket.user);
            }
          }
        }

        if (!socket.user) {
          return callback && callback({ success: false, message: 'Unauthenticated' });
        }

        const itemRequest = await ItemRequest.findById(requestId);
        if (!itemRequest) {
          return callback && callback({ success: false, message: 'Item request not found' });
        }

        const isAdmin = isStaffRole(socket.user.role);
        const isOwner = itemRequest.user && itemRequest.user.toString() === socket.user._id.toString();

        if (!isAdmin && !isOwner) {
          return callback && callback({ success: false, message: 'Unauthorized to send message' });
        }

        const newMessage = {
          sender: socket.user._id,
          senderName: socket.user.name || (isAdmin ? 'Store Staff' : 'Customer'),
          senderRole: isAdmin ? (socket.user.role || 'admin') : 'customer',
          message: trimmedMsg,
          image: trimmedImg,
          isEncrypted: Boolean(isEncrypted),
          encryptedMeta: encryptedMeta || {},
          createdAt: new Date(),
        };

        // Atomic $push preventing Mongoose VersionError concurrency collisions
        const updatedRequest = await ItemRequest.findByIdAndUpdate(
          requestId,
          { $push: { messages: newMessage } },
          { new: true }
        );

        const savedMessage = (updatedRequest && updatedRequest.messages)
          ? updatedRequest.messages[updatedRequest.messages.length - 1]
          : newMessage;
        const roomName = `request_${requestId}`;

        // Clear typing indicator
        socket.to(roomName).emit('user_typing', {
          requestId,
          userId: socket.user._id,
          userName: socket.user.name,
          userRole: socket.user.role,
          isTyping: false,
        });

        // Broadcast to everyone in the room (including other devices/tabs of sender)
        io.to(roomName).emit('new_message', {
          requestId,
          message: savedMessage,
        });

        // Broadcast red-dot notification to appropriate channel
        if (isAdmin) {
          if (itemRequest.user) {
            io.to(`user_${itemRequest.user.toString()}`).emit('request_notification', {
              type: 'new_chat',
              requestId,
              senderRole: 'admin',
              senderName: socket.user.name || 'Concierge Staff',
              title: itemRequest.title,
            });
          }
        } else {
          io.to('staff_channel').emit('request_notification', {
            type: 'new_chat',
            requestId,
            senderRole: 'customer',
            senderName: socket.user.name || 'Customer',
            title: itemRequest.title,
          });
        }

        if (callback) {
          callback({
            success: true,
            message: savedMessage,
          });
        }
      } catch (err) {
        console.error('[ChatSocket] send_message error:', err);
        if (callback) callback({ success: false, message: err.message });
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`[ChatSocket] Client disconnected: ${socket.id}`);
      if (socket.user) {
        for (const [roomName, users] of roomPresence.entries()) {
          if (users.has(socket.user._id.toString())) {
            users.delete(socket.user._id.toString());
            io.to(roomName).emit('room_presence', {
              requestId: roomName.replace('request_', ''),
              users: Array.from(users.values()),
            });
            socket.to(roomName).emit('user_typing', {
              requestId: roomName.replace('request_', ''),
              userId: socket.user._id,
              isTyping: false,
            });
            // Clean up empty room maps to prevent memory leaks
            if (users.size === 0) {
              roomPresence.delete(roomName);
            }
          }
        }
      }
    });
  });

  return io;
};

const getIO = () => io;

module.exports = {
  initChatSocket,
  getIO,
  authenticateSocketUser,
};
