const express = require('express');
const router = express.Router();
const { getStoreOverview } = require('../controllers/statsController');

router.get('/overview', getStoreOverview);

module.exports = router;
