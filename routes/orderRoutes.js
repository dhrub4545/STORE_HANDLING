const express = require('express');
const { getOrders, getOrderById } = require('../controllers/orderController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.get('/', getOrders);
router.get('/:id', getOrderById);

module.exports = router;
