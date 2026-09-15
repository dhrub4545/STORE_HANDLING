const express = require('express');
const {
  createRequest,
  getMyRequests,
  getAllRequests,
  getRequestById,
  updateRequestStatus,
  deleteRequest,
  addRequestMessage,
  getRequestMessages,
} = require('../controllers/itemRequestController');
const { protect, requireRole, requireVerifiedMember } = require('../middleware/auth');

const router = express.Router();

// All request operations require logged-in session
router.use(protect);

// Customer & Admin Chat messaging on item requests
router.post('/:id/messages', addRequestMessage);
router.get('/:id/messages', getRequestMessages);

// Customer endpoints (creation strictly requires verified membership or admin)
router.post('/', requireVerifiedMember, createRequest);
router.get('/my', getMyRequests);
router.get('/:id', getRequestById);

// Admin endpoints
router.get('/', requireRole('admin', 'super_admin', 'inventory_lead'), getAllRequests);
router.put('/:id', requireRole('admin', 'super_admin', 'inventory_lead'), updateRequestStatus);
router.put('/:id/status', requireRole('admin', 'super_admin', 'inventory_lead'), updateRequestStatus);
router.delete('/:id', deleteRequest);

module.exports = router;
