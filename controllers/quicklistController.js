const Quicklist = require('../models/Quicklist');
const Product = require('../models/Product');

// @desc    Get current user's quicklist with live stock data
// @route   GET /api/quicklist
// @access  Private
exports.getQuicklist = async (req, res, next) => {
  try {
    const items = await Quicklist.find({ user: req.user.id })
      .populate('product')
      .sort({ createdAt: -1 });

    // Filter out any orphaned items where product might have been deleted
    const validItems = items.filter(item => item.product != null);

    // Compute Quicklist Summary KPIs
    const bookmarkedCount = validItems.length;
    let inStockCount = 0;
    let lowStockCount = 0;

    validItems.forEach(item => {
      const p = item.product;
      if (p.stockQty > 0) {
        inStockCount += 1;
      }
      if (p.stockQty > 0 && p.stockQty <= (p.lowStockThreshold || 10)) {
        lowStockCount += 1;
      }
    });

    res.json({
      success: true,
      summary: {
        bookmarked: bookmarkedCount,
        inStock: inStockCount,
        lowStock: lowStockCount,
      },
      items: validItems,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add product to quicklist
// @route   POST /api/quicklist
// @access  Private
exports.addToQuicklist = async (req, res, next) => {
  try {
    const { productId, notifyOnRestock } = req.body;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    let item = await Quicklist.findOne({ user: req.user.id, product: productId });
    if (item) {
      return res.json({ success: true, message: 'Item already in quicklist', item });
    }

    item = await Quicklist.create({
      user: req.user.id,
      product: productId,
      notifyOnRestock: notifyOnRestock !== undefined ? notifyOnRestock : true,
    });

    const populatedItem = await item.populate('product');

    res.status(201).json({
      success: true,
      message: 'Added to Quicklist',
      item: populatedItem,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Remove product from quicklist
// @route   DELETE /api/quicklist/:productId
// @access  Private
exports.removeFromQuicklist = async (req, res, next) => {
  try {
    const item = await Quicklist.findOneAndDelete({
      user: req.user.id,
      $or: [
        { product: req.params.productId },
        { _id: req.params.productId },
      ],
    });

    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not in quicklist' });
    }

    res.json({
      success: true,
      message: 'Item removed from quicklist',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle restock notification preference for item
// @route   PATCH /api/quicklist/:id/notify
// @access  Private
exports.toggleRestockNotify = async (req, res, next) => {
  try {
    const item = await Quicklist.findOne({
      _id: req.params.id,
      user: req.user.id,
    });

    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found in quicklist' });
    }

    item.notifyOnRestock = !item.notifyOnRestock;
    await item.save();

    res.json({
      success: true,
      notifyOnRestock: item.notifyOnRestock,
    });
  } catch (error) {
    next(error);
  }
};
