const express = require('express');
const router = express.Router();
const {
  getStaff,
  getStaffStats,
  getMemberDetails,
  toggleVerifyMember,
  inviteStaff,
  updateStaffRole,
  deleteStaff,
} = require('../controllers/staffController');
const { protect, requireRole } = require('../middleware/auth');

router.use(protect);
router.get('/stats', requireRole('admin', 'super_admin', 'inventory_lead'), getStaffStats);
router.get('/', requireRole('admin', 'super_admin', 'inventory_lead'), getStaff);
router.get('/:id', requireRole('admin', 'super_admin', 'inventory_lead'), getMemberDetails);
router.patch('/:id/verify', requireRole('admin', 'super_admin', 'inventory_lead'), toggleVerifyMember);
router.post('/', requireRole('admin', 'super_admin'), inviteStaff);
router.patch('/:id', requireRole('admin', 'super_admin'), updateStaffRole);
router.delete('/:id', requireRole('admin', 'super_admin'), deleteStaff);

module.exports = router;
