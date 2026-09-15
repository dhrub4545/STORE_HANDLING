const express = require('express');
const router = express.Router();
const {
  getQuicklist,
  addToQuicklist,
  removeFromQuicklist,
  toggleRestockNotify,
} = require('../controllers/quicklistController');
const { protect } = require('../middleware/auth');

router.use(protect);
router.get('/', getQuicklist);
router.post('/', addToQuicklist);
router.delete('/:productId', removeFromQuicklist);
router.patch('/:id/notify', toggleRestockNotify);

module.exports = router;
