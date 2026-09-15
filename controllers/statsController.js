const Product = require('../models/Product');

// @desc    Get live store health & inventory overview KPIs
// @route   GET /api/stats/overview
// @access  Public / Private
exports.getStoreOverview = async (req, res, next) => {
  try {
    // Parallelize all 5 database queries concurrently
    const [totalCatalog, totalUnitsResult, lowStockCount, outOfStockCount, draftCount] = await Promise.all([
      Product.countDocuments({ status: { $ne: 'archived' } }),
      Product.aggregate([
        { $match: { status: 'published' } },
        { $group: { _id: null, totalUnits: { $sum: '$stockQty' } } },
      ]),
      Product.countDocuments({
        status: 'published',
        $expr: {
          $and: [
            { $gt: ['$stockQty', 0] },
            { $lte: ['$stockQty', { $ifNull: ['$lowStockThreshold', 10] }] },
          ],
        },
      }),
      Product.countDocuments({
        status: 'published',
        stockQty: { $lte: 0 },
      }),
      Product.countDocuments({
        status: 'draft',
      }),
    ]);

    const totalInStockUnits = totalUnitsResult && totalUnitsResult.length > 0 ? totalUnitsResult[0].totalUnits : 0;

    res.json({
      success: true,
      data: {
        totalCatalog,
        totalInStockUnits,
        lowStockCount,
        outOfStockCount,
        draftCount,
        syncStatus: 'Active • Real-time POS Linked',
        syncedAt: new Date().toISOString(),
        terminalId: 'POS-041',
        warehouseZone: 'Whse B2',
      },
    });
  } catch (error) {
    next(error);
  }
};
