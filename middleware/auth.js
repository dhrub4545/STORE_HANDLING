const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const jwtSecret = process.env.JWT_SECRET || (process.env.NODE_ENV !== 'production' ? 'retail_super_secret_jwt_key_2026' : null);
      if (!jwtSecret) {
        return res.status(500).json({ success: false, message: 'Server authentication configuration error' });
      }
      const decoded = jwt.verify(token, jwtSecret);

      // Stateless identification: fetch or attach decoded payload
      req.user = await User.findById(decoded.id).select('-password');
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'User not found' });
      }

      next();
    } catch (error) {
      console.error('[Auth Middleware] Invalid token:', error.message);
      return res.status(401).json({ success: false, message: 'Unauthorized: Invalid token' });
    }
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Unauthorized: No token provided' });
  }
};

const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const userRole = req.user.role || 'member';
    const isAdmin = ['admin', 'super_admin', 'inventory_lead'].includes(userRole);
    const isMember = ['member', 'customer'].includes(userRole);

    const isMatch = roles.some((r) => {
      if (r === userRole) return true;
      if (r === 'admin' && isAdmin) return true;
      if (r === 'member' && isMember) return true;
      return false;
    });

    if (!isMatch) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Action requires one of the following roles: [${roles.join(', ')}]`,
      });
    }

    next();
  };
};

const requireVerifiedMember = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const isAdmin = ['admin', 'super_admin', 'inventory_lead'].includes(req.user.role);
  if (isAdmin) {
    return next();
  }

  if (!req.user.isVerified) {
    return res.status(403).json({
      success: false,
      requiresVerification: true,
      message: 'Account Verification Required: Only verified members can submit custom item procurement requests. Please contact store admin to verify your account.',
    });
  }

  next();
};

module.exports = { protect, requireRole, requireVerifiedMember };
