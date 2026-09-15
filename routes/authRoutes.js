const express = require('express');
const router = express.Router();
const {
  login,
  register,
  demoLogin,
  getMe,
  updatePreferences,
  updateProfile,
  changePassword,
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');

router.post('/login', login);
router.post('/register', register);
router.post('/demo-login', demoLogin);
router.get('/me', protect, getMe);
router.patch('/preferences', protect, updatePreferences);
router.put('/profile', protect, updateProfile);
router.put('/change-password', protect, changePassword);

module.exports = router;
