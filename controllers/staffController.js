const Staff = require('../models/Staff');
const User = require('../models/User');
const ItemRequest = require('../models/ItemRequest');

// Normalize all role strings into the two system roles: 'admin' and 'member'
const normalizeRole = (roleStr = '') => {
  const lower = roleStr.toLowerCase().trim();
  if (lower.includes('admin') || lower.includes('lead') || lower.includes('inventory')) {
    return 'admin';
  }
  return 'member';
};

// @desc    Get all members & staff with verification status and request counts
// @route   GET /api/staff
// @access  Private (Admin only)
exports.getStaff = async (req, res, next) => {
  try {
    const { role, status, search, verified } = req.query;
    let query = {};

    if (search && search.trim() !== '') {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { role: searchRegex },
      ];
    }

    if (verified === 'true') {
      query.isVerified = true;
    } else if (verified === 'false') {
      query.isVerified = { $ne: true };
      query.role = { $nin: ['admin', 'super_admin'] };
    }

    if (role && role !== 'All' && role !== 'all' && role !== 'All Staff' && role !== 'All Members') {
      const cleanFilter = role.toLowerCase().trim();
      if (cleanFilter.includes('admin')) {
        query.role = { $in: ['admin', 'super_admin', 'inventory_lead'] };
      } else if (cleanFilter.includes('member') || cleanFilter.includes('clerk') || cleanFilter.includes('associate')) {
        query.role = { $in: ['member', 'customer', 'store_clerk', 'warehouse_associate'] };
      }
    }

    // Ground truth: Users collection contains registered accounts
    const users = await User.find(query).sort({ createdAt: -1 }).lean();

    // Map and enrich each member with live verification status & request metrics
    const staffList = await Promise.all(
      users.map(async (u) => {
        const reqCount = await ItemRequest.countDocuments({ user: u._id });
        const cleanRole = normalizeRole(u.role);
        const isVerified = cleanRole === 'admin' ? true : Boolean(u.isVerified);

        return {
          _id: u._id,
          id: u._id,
          name: u.name,
          email: u.email,
          role: cleanRole === 'admin' ? 'Admin' : 'Member',
          roleKey: cleanRole,
          rawRole: u.role,
          avatar: u.avatar || `https://api.dicebear.com/7.x/avataaars/png?seed=${encodeURIComponent(u.name)}`,
          accessScope: u.accessScope || (cleanRole === 'admin' ? 'Full System Control • Audit Logs' : 'Member Procurement Portal'),
          status: isVerified ? 'Active' : 'Pending',
          isVerified,
          verifiedAt: u.verifiedAt || (cleanRole === 'admin' ? u.createdAt : null),
          verifiedBy: u.verifiedBy || (cleanRole === 'admin' ? 'System Administrator' : ''),
          createdAt: u.createdAt,
          lastActive: 'Active recently',
          mfaVerified: u.mfaEnabled !== false,
          requestsCount: reqCount,
          preferences: u.preferences || {},
        };
      })
    );

    res.json({
      success: true,
      count: staffList.length,
      staff: staffList,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get member and staff access & verification metrics
// @route   GET /api/staff/stats
// @access  Private (Admin only)
exports.getStaffStats = async (req, res, next) => {
  try {
    const totalUsers = await User.countDocuments({});
    const admins = await User.countDocuments({ role: { $in: ['admin', 'super_admin', 'inventory_lead'] } });
    const totalMembers = await User.countDocuments({ role: { $nin: ['admin', 'super_admin', 'inventory_lead'] } });
    const verifiedMembers = await User.countDocuments({
      role: { $nin: ['admin', 'super_admin', 'inventory_lead'] },
      isVerified: true,
    });
    const unverifiedMembers = totalMembers - verifiedMembers;

    res.json({
      success: true,
      stats: {
        totalStaff: totalUsers,
        totalMembers,
        verifiedMembers,
        unverifiedMembers,
        admins,
        inventory: admins,
        associate: totalMembers,
        pending: unverifiedMembers,
        mfaCompliance: '100% Policy',
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify or unverify a member
// @route   PATCH /api/staff/:id/verify
// @access  Private (Admin only)
exports.toggleVerifyMember = async (req, res, next) => {
  try {
    const { isVerified } = req.body;
    let user = await User.findById(req.params.id);
    if (!user) {
      // Check Staff collection fallback
      const staffFallback = await Staff.findById(req.params.id);
      if (staffFallback && staffFallback.email) {
        user = await User.findOne({ email: staffFallback.email.toLowerCase() });
      }
    }

    if (!user) {
      return res.status(404).json({ success: false, message: 'Member account not found' });
    }

    const shouldVerify = Boolean(isVerified);
    user.isVerified = shouldVerify;
    if (shouldVerify) {
      user.verifiedAt = new Date();
      user.verifiedBy = req.user.name || req.user.email || 'Store Admin';
    } else {
      user.verifiedAt = null;
      user.verifiedBy = '';
    }

    await user.save();

    // Also sync Staff model if present
    if (user.email) {
      await Staff.findOneAndUpdate(
        { email: user.email.toLowerCase() },
        { status: shouldVerify ? 'active' : 'pending' }
      );
    }

    res.json({
      success: true,
      message: shouldVerify ? `Member ${user.name} successfully verified` : `Member ${user.name} unverified`,
      user: {
        id: user._id,
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role === 'customer' ? 'member' : user.role,
        isVerified: user.isVerified,
        verifiedAt: user.verifiedAt,
        verifiedBy: user.verifiedBy,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get detailed member profile & requests history
// @route   GET /api/staff/:id
// @access  Private (Admin only)
exports.getMemberDetails = async (req, res, next) => {
  try {
    let user = await User.findById(req.params.id).lean();
    if (!user) {
      const staffFallback = await Staff.findById(req.params.id).lean();
      if (staffFallback && staffFallback.email) {
        user = await User.findOne({ email: staffFallback.email.toLowerCase() }).lean();
      }
    }

    if (!user) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    const requests = await ItemRequest.find({ user: user._id })
      .select('title status quantity targetPrice createdAt urgency items')
      .sort({ createdAt: -1 })
      .lean();

    const cleanRole = normalizeRole(user.role);
    const isVerified = cleanRole === 'admin' ? true : Boolean(user.isVerified);

    res.json({
      success: true,
      member: {
        ...user,
        role: cleanRole === 'admin' ? 'Admin' : 'Member',
        roleKey: cleanRole,
        isVerified,
        requests,
        requestsCount: requests.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Invite new member or admin
// @route   POST /api/staff
// @access  Private (Admin only)
exports.inviteStaff = async (req, res, next) => {
  try {
    const { name, email, role, accessScope } = req.body;

    if (!name || !email) {
      return res.status(400).json({ success: false, message: 'Name and email are required' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Account already registered with this email' });
    }

    const cleanRole = normalizeRole(role || 'member');
    const assignedRole = cleanRole === 'admin' ? 'Admin' : 'Member';

    // Create User record
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: 'password123',
      role: cleanRole,
      isVerified: true, // Invited by Admin -> Verified by default
      verifiedAt: new Date(),
      verifiedBy: req.user.name || req.user.email || 'Store Admin',
      accessScope: accessScope || (cleanRole === 'admin' ? 'Full System Control • Audit Logs' : 'Member Procurement Portal'),
      avatar: `https://api.dicebear.com/7.x/avataaars/png?seed=${encodeURIComponent(name.trim())}`,
    });

    // Also sync Staff model
    await Staff.create({
      name: name.trim(),
      email: normalizedEmail,
      role: assignedRole,
      roleKey: cleanRole,
      accessScope: user.accessScope,
      status: 'active',
      lastActive: 'Just invited',
      mfaVerified: true,
      avatar: user.avatar,
    });

    res.status(201).json({
      success: true,
      message: `${assignedRole} ${name} invited and registered successfully`,
      staff: {
        _id: user._id,
        id: user._id,
        name: user.name,
        email: user.email,
        role: assignedRole,
        roleKey: cleanRole,
        isVerified: true,
        accessScope: user.accessScope,
        avatar: user.avatar,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update staff/member role (Admin vs Member)
// @route   PATCH /api/staff/:id
// @access  Private (Admin only)
exports.updateStaffRole = async (req, res, next) => {
  try {
    let user = await User.findById(req.params.id);
    if (!user) {
      const staffFallback = await Staff.findById(req.params.id);
      if (staffFallback && staffFallback.email) {
        user = await User.findOne({ email: staffFallback.email.toLowerCase() });
      }
    }

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const { role, accessScope, status } = req.body;
    if (role) {
      const cleanRole = normalizeRole(role);
      user.role = cleanRole;
      if (cleanRole === 'admin') {
        user.isVerified = true;
      }
    }
    if (accessScope) user.accessScope = accessScope;

    await user.save();

    // Sync Staff model
    if (user.email) {
      await Staff.findOneAndUpdate(
        { email: user.email.toLowerCase() },
        {
          role: user.role === 'admin' ? 'Admin' : 'Member',
          roleKey: user.role,
          accessScope: user.accessScope,
          status: status || (user.isVerified ? 'active' : 'pending'),
        }
      );
    }

    res.json({
      success: true,
      message: 'Role updated successfully',
      staff: {
        _id: user._id,
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role === 'admin' ? 'Admin' : 'Member',
        roleKey: user.role,
        isVerified: user.isVerified,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete or deactivate staff/member account
// @route   DELETE /api/staff/:id
// @access  Private (Admin only)
exports.deleteStaff = async (req, res, next) => {
  try {
    let user = await User.findById(req.params.id);
    if (!user) {
      const staffFallback = await Staff.findById(req.params.id);
      if (staffFallback && staffFallback.email) {
        user = await User.findOne({ email: staffFallback.email.toLowerCase() });
        await staffFallback.deleteOne();
      }
    }

    if (user) {
      await User.findByIdAndDelete(user._id);
      await Staff.deleteOne({ email: user.email.toLowerCase() });
    }

    res.json({
      success: true,
      message: 'Account removed successfully',
    });
  } catch (error) {
    next(error);
  }
};
