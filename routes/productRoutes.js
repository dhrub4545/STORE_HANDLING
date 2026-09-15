const express = require('express');
const router = express.Router();
const {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  updateStockQty,
  deleteProduct,
  exportCatalogCSV,
} = require('../controllers/productController');
const { protect, requireRole } = require('../middleware/auth');

router.get('/export/csv', protect, requireRole('admin', 'super_admin', 'inventory_lead'), exportCatalogCSV);
router.get('/', getProducts);
router.get('/:id', getProductById);
router.post('/', protect, requireRole('admin', 'super_admin', 'inventory_lead'), createProduct);
router.put('/:id', protect, requireRole('admin', 'super_admin', 'inventory_lead'), updateProduct);
router.patch('/:id/stock', protect, requireRole('admin', 'super_admin', 'inventory_lead', 'store_clerk'), updateStockQty);
router.delete('/:id', protect, requireRole('admin', 'super_admin', 'inventory_lead'), deleteProduct);

module.exports = router;
