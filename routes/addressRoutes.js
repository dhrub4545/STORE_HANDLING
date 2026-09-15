const express = require('express');
const {
  getAddresses,
  createAddress,
  setPrimaryAddress,
} = require('../controllers/addressController');
const { protect, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.get('/', getAddresses);
router.post('/', requireRole('admin', 'super_admin', 'inventory_lead'), createAddress);
router.patch('/:id/primary', requireRole('admin', 'super_admin', 'inventory_lead'), setPrimaryAddress);

module.exports = router;
