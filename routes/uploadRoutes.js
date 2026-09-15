const express = require('express');
const router = express.Router();
const multer = require('multer');
const { uploadImage, uploadAvatar, uploadChatImage } = require('../controllers/uploadController');
const { protect, requireRole } = require('../middleware/auth');

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit matching Stitch UI
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are supported (PNG, JPG, WEBP)'), false);
    }
  },
});

// Middleware to safely run multer only when multipart/form-data
const optionalUpload = (field) => (req, res, next) => {
  const contentType = req.headers['content-type'] || '';
  if (contentType.includes('multipart/form-data')) {
    return upload.single(field)(req, res, next);
  }
  next();
};

// Product image upload (Admin/Lead)
router.post('/', protect, requireRole('admin', 'super_admin', 'inventory_lead'), optionalUpload('image'), uploadImage);

// Profile picture avatar upload (Any authenticated customer or admin)
router.post('/avatar', protect, optionalUpload('image'), uploadAvatar);

// Chat photo attachment upload (Any authenticated customer or admin/staff)
router.post('/chat', protect, optionalUpload('image'), uploadChatImage);

module.exports = router;
