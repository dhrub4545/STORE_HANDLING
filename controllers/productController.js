const Product = require('../models/Product');

// Helper to escape special regex characters for ReDoS and syntax error prevention
const escapeRegex = (string = '') => {
  return String(string).replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
};

// @desc    Get all products with filters
// @route   GET /api/products
// @access  Public
exports.getProducts = async (req, res, next) => {
  try {
    const { search, category, filter, status } = req.query;
    let query = {};

    // Search by title or SKU with sanitized regex
    if (search && search.trim() !== '') {
      const escaped = escapeRegex(search.trim());
      query.$or = [
        { name: { $regex: escaped, $options: 'i' } },
        { sku: { $regex: escaped, $options: 'i' } },
        { description: { $regex: escaped, $options: 'i' } },
      ];
    }

    // Category filter with sanitized regex
    if (category && category !== 'All Items' && category !== 'all') {
      const escapedCat = escapeRegex(category.trim());
      query.category = { $regex: new RegExp(`^${escapedCat}$`, 'i') };
    }

    // Status filter
    if (status) {
      query.status = status;
    } else {
      // By default show published for non-admins unless explicitly querying
      if (!req.query.includeDrafts) {
        query.status = 'published';
      }
    }

    // Stock state filter tabs: 'low_stock', 'out_of_stock', 'drafts'
    if (filter === 'low_stock') {
      query.$expr = { $and: [{ $gt: ['$stockQty', 0] }, { $lte: ['$stockQty', { $ifNull: ['$lowStockThreshold', 10] }] }] };
      query.status = 'published';
    } else if (filter === 'out_of_stock') {
      query.stockQty = { $lte: 0 };
      query.status = 'published';
    } else if (filter === 'drafts') {
      query.status = 'draft';
    }

    const page = parseInt(req.query.page, 10);
    const limit = parseInt(req.query.limit, 10);

    let productsQuery = Product.find(query).sort({ createdAt: -1 });

    if (!isNaN(page) && page > 0 && !isNaN(limit) && limit > 0) {
      const skip = (page - 1) * limit;
      productsQuery = productsQuery.skip(skip).limit(limit);
    }

    const [products, total] = await Promise.all([
      productsQuery.lean(),
      Product.countDocuments(query),
    ]);

    res.json({
      success: true,
      count: products.length,
      total,
      products,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single product by ID
// @route   GET /api/products/:id
// @access  Public
exports.getProductById = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id).lean();
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    res.json({
      success: true,
      product,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a new product listing
// @route   POST /api/products
// @access  Private (Admin / Lead)
exports.createProduct = async (req, res, next) => {
  try {
    const {
      name,
      sku,
      category,
      basePrice,
      stockQty,
      images,
      coverImage,
      description,
      specs,
      status,
    } = req.body;

    if (!name || !basePrice) {
      return res.status(400).json({ success: false, message: 'Name and Base Price are required' });
    }

    // Generate unique SKU if not provided
    const productSku = sku 
      ? sku.trim().toUpperCase() 
      : `OMNI-${name.slice(0, 3).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;

    const existing = await Product.findOne({ sku: productSku });
    if (existing) {
      return res.status(400).json({ success: false, message: 'SKU already exists in catalog' });
    }

    const product = await Product.create({
      name,
      sku: productSku,
      category: category || 'Electronics',
      basePrice: parseFloat(basePrice),
      stockQty: parseInt(stockQty, 10) || 0,
      images: images || [],
      coverImage: coverImage || (images && images[0]) || '',
      description: description || '',
      specs: Array.isArray(specs) ? specs : [],
      status: status || 'published',
    });

    res.status(201).json({
      success: true,
      message: 'Product listed successfully',
      product,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Private (Admin / Lead)
exports.updateProduct = async (req, res, next) => {
  try {
    const existing = await Product.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // Field whitelisting to prevent mass assignment / prototype pollution
    const allowedFields = [
      'name', 'sku', 'category', 'basePrice', 'originalPrice', 'stockQty',
      'lowStockThreshold', 'images', 'coverImage', 'description', 'specs',
      'status', 'featured', 'location', 'bopisReady',
    ];
    const sanitizedUpdates = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        sanitizedUpdates[field] = req.body[field];
      }
    });

    const product = await Product.findByIdAndUpdate(req.params.id, sanitizedUpdates, {
      new: true,
      runValidators: true,
    });

    res.json({
      success: true,
      product,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Live Micro-Stepper Inventory Adjustment
// @route   PATCH /api/products/:id/stock
// @access  Private (Admin / Lead / Staff)
exports.updateStockQty = async (req, res, next) => {
  try {
    const { action, amount, quantity } = req.body; // action: 'increment' | 'decrement' | 'set'

    const existing = await Product.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    let updatedProduct;

    if (action === 'increment') {
      const delta = (amount !== undefined || req.body.delta !== undefined)
        ? Math.max(1, parseInt(amount !== undefined ? amount : req.body.delta, 10))
        : 1;
      updatedProduct = await Product.findByIdAndUpdate(
        req.params.id,
        { $inc: { stockQty: delta } },
        { new: true, runValidators: true }
      );
    } else if (action === 'decrement') {
      const delta = (amount !== undefined || req.body.delta !== undefined)
        ? Math.max(1, parseInt(amount !== undefined ? amount : req.body.delta, 10))
        : 1;
      // Atomic decrement preventing negative inventory
      updatedProduct = await Product.findOneAndUpdate(
        { _id: req.params.id, stockQty: { $gte: delta } },
        { $inc: { stockQty: -delta } },
        { new: true }
      );
      if (!updatedProduct) {
        // Clamp to 0 if decrement exceeded stock
        updatedProduct = await Product.findByIdAndUpdate(
          req.params.id,
          { $set: { stockQty: 0 } },
          { new: true }
        );
      }
    } else if (action === 'set' || quantity !== undefined) {
      const targetQty = Math.max(0, parseInt(quantity !== undefined ? quantity : amount, 10) || 0);
      updatedProduct = await Product.findByIdAndUpdate(
        req.params.id,
        { $set: { stockQty: targetQty } },
        { new: true, runValidators: true }
      );
    } else {
      updatedProduct = existing;
    }

    res.json({
      success: true,
      stockQty: updatedProduct.stockQty,
      isLowStock: updatedProduct.isLowStock,
      stockStatus: updatedProduct.stockStatus,
      product: updatedProduct,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete product
// @route   DELETE /api/products/:id
// @access  Private (Admin only)
exports.deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    await product.deleteOne();

    res.json({
      success: true,
      message: 'Product removed from catalog',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Export Catalog to CSV
// @route   GET /api/products/export/csv
// @access  Private (Admin, Inventory Lead)
exports.exportCatalogCSV = async (req, res, next) => {
  try {
    const products = await Product.find({}).sort({ createdAt: -1 });

    let csv = 'SKU,Product Name,Category,Unit Price ($),Stock On-Hand,Total Inventory Value ($),Stock Status,Created At\n';
    const sanitizeCsvCell = (val) => {
      if (val === null || val === undefined) return '';
      let str = String(val).replace(/"/g, '""');
      // Neutralize spreadsheet formula injection (=, +, -, @, tab, newline)
      if (/^[=+\-@\t\r]/.test(str)) {
        str = `'${str}`;
      }
      return str;
    };

    products.forEach(p => {
      const price = Number(p.basePrice) || 0;
      const qty = Number(p.stockQty) || 0;
      const stockVal = (price * qty).toFixed(2);
      const threshold = p.lowStockThreshold !== undefined ? p.lowStockThreshold : 10;
      const status = qty <= 0 ? 'Out of Stock' : qty <= threshold ? 'Low Stock' : 'In Stock';
      const created = p.createdAt ? new Date(p.createdAt).toISOString().slice(0, 10) : '2026-09-01';
      const safeSku = sanitizeCsvCell(p.sku);
      const safeName = sanitizeCsvCell(p.name);
      const safeCategory = sanitizeCsvCell(p.category || 'General');
      const safeStatus = sanitizeCsvCell(status);
      csv += `"${safeSku}","${safeName}","${safeCategory}",${price.toFixed(2)},${qty},${stockVal},"${safeStatus}","${created}"\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="draft_catalog_ledger_${Date.now()}.csv"`);
    return res.status(200).send(csv);
  } catch (error) {
    next(error);
  }
};

