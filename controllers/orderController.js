const Order = require('../models/Order');

// @desc    Get all orders (admin views all; customer views personal orders)
// @route   GET /api/orders
// @access  Private
exports.getOrders = async (req, res, next) => {
  try {
    const isStaff = ['admin', 'super_admin', 'inventory_lead', 'inventory_manager', 'store_clerk', 'warehouse_associate', 'staff'].includes(req.user?.role);
    const filter = isStaff ? {} : { user: req.user?._id };

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Order.countDocuments(filter),
    ]);

    res.json({
      success: true,
      count: orders.length,
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
      orders,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get order by ID
// @route   GET /api/orders/:id
// @access  Private
exports.getOrderById = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id).lean();
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const isStaff = ['admin', 'super_admin', 'inventory_lead', 'inventory_manager', 'store_clerk', 'warehouse_associate', 'staff'].includes(req.user?.role);
    const isOwner = Boolean(order.user && req.user && order.user.toString() === req.user._id.toString());

    if (!isStaff && !isOwner) {
      return res.status(403).json({ success: false, message: 'Not authorized to view this order' });
    }

    res.json({ success: true, order });
  } catch (err) {
    next(err);
  }
};
