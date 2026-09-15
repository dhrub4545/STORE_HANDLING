const jwt = require('jsonwebtoken');
const User = require('../models/User');

const generateToken = (id, role) => {
  const secret = process.env.JWT_SECRET || (process.env.NODE_ENV !== 'production' ? 'retail_super_secret_jwt_key_2026' : null);
  if (!secret) {
    throw new Error('FATAL: JWT_SECRET environment variable is required in production');
  }
  return jwt.sign({ id, role }, secret, {
    expiresIn: '7d',
  });
};

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password' });
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const token = generateToken(user._id, user.role);

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role === 'customer' ? 'member' : user.role,
        isVerified: user.role === 'admin' ? true : Boolean(user.isVerified),
        verifiedAt: user.verifiedAt || null,
        verifiedBy: user.verifiedBy || '',
        avatar: user.avatar,
        storeLocation: user.storeLocation,
        accessScope: user.accessScope,
        mfaEnabled: user.mfaEnabled,
        preferences: user.preferences,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, and password are required' });
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'User already exists with this email' });
    }

    // New registrations default to member role and require admin verification for custom requests
    const user = await User.create({
      name,
      email,
      password,
      role: 'member',
      isVerified: false,
    });

    const token = generateToken(user._id, user.role);

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: 'member',
        isVerified: false,
        verifiedAt: null,
        verifiedBy: '',
        avatar: user.avatar,
        storeLocation: user.storeLocation,
        accessScope: user.accessScope,
        preferences: user.preferences,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    1-Tap Demo Login (Customer/Member vs Store Admin)
// @route   POST /api/auth/demo-login
// @access  Public
exports.demoLogin = async (req, res, next) => {
  try {
    const { role } = req.body; // 'customer'/'member' or 'admin'
    let user;
    if (role === 'admin') {
      user = await User.findOne({ 
        $or: [
          { role: 'admin' }, 
          { email: 'dhrub.pandit@draft.io' }, 
          { email: 'marcus.vance@draft.internal' }
        ] 
      });
    } else {
      user = await User.findOne({ email: 'sarah.jenkins@storefront.co' });
      if (user && user.isVerified === undefined) {
        user.isVerified = true;
        user.verifiedAt = new Date();
        user.verifiedBy = 'System Demo Auto-Verification';
        await user.save();
      }
    }

    if (!user) {
      // Auto-create demo user if not seeded yet
      user = await User.create({
        name: role === 'admin' ? 'Dhrub Pandit' : 'Sarah Jenkins',
        email: role === 'admin' ? 'dhrub.pandit@draft.io' : 'sarah.jenkins@storefront.co',
        password: 'password123',
        role: role === 'admin' ? 'admin' : 'member',
        isVerified: true, // Baseline demo account is verified so baseline demo flows work smoothly
        verifiedAt: new Date(),
        verifiedBy: 'System Baseline',
        storeLocation: '',
        avatar: role === 'admin' 
          ? 'https://lh3.googleusercontent.com/aida-public/AB6AXuArlDY-pODuQ0mKulKnyuEznz8zQ9LDIxteI9Xye8gOSSFKR0AdshbJ69KOfgHjSgg4ummwxchHFUNTtktaAwmujmF-lSLe2G2mCRQPP6BAbKozvZD7GGVp7uvcZxJ667NcyEI-tKYV5avxNTnIey7uKen6ujRCHy2pjzLuiFUbGVkqhNICMl0qkh-SmBh0e8cU3ToYq7fXGQL8iZ_gL6KAZZJaQT2cqDJRPUriuwYzAvZnDSXsYKoraw'
          : 'https://lh3.googleusercontent.com/aida-public/AB6AXuCkUXt2EeciLJFPeyOtGrTxT-pfq1McBv9BdwS_zmu1jgvpL-VXZFWpO_bxLZ7pRazgpEQL7lhJIBFHxScfTl7inPkk7IWbNPaLxxt6koViB5jF_7gxxwC48kxq0Qi7r9fTfVo_wbGADafHPKEyyAh2HZ5GKiuBFEgaRorcetuShGa7DM4nJLwbHPpXuDA6w1eNdqwm05L-tRnJeepP9-ut0xdzxVKicm-g68UD0pxXpoRokcRMGZzqsg',
        accessScope: role === 'admin' ? 'Full System Control • Audit Logs' : 'Retail Member Hub',
      });
    }

    const token = generateToken(user._id, user.role);

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role === 'customer' ? 'member' : user.role,
        isVerified: user.role === 'admin' ? true : Boolean(user.isVerified),
        verifiedAt: user.verifiedAt || null,
        verifiedBy: user.verifiedBy || '',
        avatar: user.avatar,
        storeLocation: user.storeLocation,
        accessScope: user.accessScope,
        mfaEnabled: user.mfaEnabled,
        preferences: user.preferences,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current logged in user profile
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const userObj = user.toObject();
    res.json({
      success: true,
      user: {
        ...userObj,
        role: userObj.role === 'customer' ? 'member' : userObj.role,
        isVerified: userObj.role === 'admin' ? true : Boolean(userObj.isVerified),
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user preferences
// @route   PATCH /api/auth/preferences
// @access  Private
exports.updatePreferences = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const current = user.preferences ? user.preferences.toObject() : {};
    const allowed = ['darkMode', 'biometricLogin', 'restockNotifications', 'displayUnits', 'lowStockThreshold', 'primaryAddress'];
    const sanitizedUpdates = {};

    allowed.forEach((key) => {
      if (req.body && req.body[key] !== undefined) {
        sanitizedUpdates[key] = req.body[key];
      }
    });

    user.preferences = { ...current, ...sanitizedUpdates };
    await user.save();

    res.json({
      success: true,
      preferences: user.preferences,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user profile (avatar, name)
// @route   PUT /api/auth/profile
// @access  Private
exports.updateProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const { name, avatar } = req.body;
    if (name) user.name = name.trim();
    if (avatar !== undefined) user.avatar = avatar;

    await user.save();

    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        storeLocation: user.storeLocation,
        accessScope: user.accessScope,
        mfaEnabled: user.mfaEnabled,
        preferences: user.preferences,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Change password (8+ characters minimum)
// @route   PUT /api/auth/change-password
// @access  Private
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide current and new password',
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 8 characters long',
      });
    }

    const user = await User.findById(req.user.id).select('+password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect',
      });
    }

    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Password updated successfully',
    });
  } catch (error) {
    next(error);
  }
};
