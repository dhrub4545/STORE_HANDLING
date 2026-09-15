const cloudinary = require('../config/cloudinary');

// @desc    Upload product image to Cloudinary
// @route   POST /api/upload
// @access  Private (Admin / Lead)
exports.uploadImage = async (req, res, next) => {
  try {
    // 1. Multer file stream upload
    if (req.file) {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'retail/products',
          resource_type: 'image',
          transformation: [{ quality: 'auto', fetch_format: 'auto' }],
        },
        (error, result) => {
          if (error) {
            console.error('[Cloudinary Upload Error]', error);
            return res.status(500).json({ success: false, message: error.message });
          }

          res.json({
            success: true,
            url: result.secure_url,
            public_id: result.public_id,
          });
        }
      );

      uploadStream.end(req.file.buffer);
      return;
    }

    // 2. Direct Base64 image upload (Native mobile & JSON payloads)
    const base64Data = req.body?.image || req.body?.base64;
    if (base64Data) {
      const dataUri = base64Data.startsWith('data:')
        ? base64Data
        : `data:image/jpeg;base64,${base64Data}`;

      const result = await cloudinary.uploader.upload(dataUri, {
        folder: 'retail/products',
        resource_type: 'image',
        transformation: [{ quality: 'auto', fetch_format: 'auto' }],
      });

      return res.json({
        success: true,
        url: result.secure_url,
        public_id: result.public_id,
      });
    }

    return res.status(400).json({ success: false, message: 'No image file or base64 data provided' });
  } catch (error) {
    console.error('[Upload Product Image Error]', error);
    next(error);
  }
};

// @desc    Upload user/admin profile avatar to Cloudinary
// @route   POST /api/upload/avatar
// @access  Private (Any authenticated user)
exports.uploadAvatar = async (req, res, next) => {
  try {
    // 1. Multer file stream upload
    if (req.file) {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'retail/avatars',
          resource_type: 'image',
          transformation: [
            { width: 400, height: 400, crop: 'fill', gravity: 'face' },
            { quality: 'auto', fetch_format: 'auto' },
          ],
        },
        (error, result) => {
          if (error) {
            console.error('[Cloudinary Avatar Upload Error]', error);
            return res.status(500).json({ success: false, message: error.message });
          }

          res.json({
            success: true,
            url: result.secure_url,
            public_id: result.public_id,
          });
        }
      );

      uploadStream.end(req.file.buffer);
      return;
    }

    // 2. Direct Base64 avatar upload (Native mobile & JSON payloads)
    const base64Data = req.body?.image || req.body?.base64;
    if (base64Data) {
      const dataUri = base64Data.startsWith('data:')
        ? base64Data
        : `data:image/jpeg;base64,${base64Data}`;

      const result = await cloudinary.uploader.upload(dataUri, {
        folder: 'retail/avatars',
        resource_type: 'image',
        transformation: [
          { width: 400, height: 400, crop: 'fill', gravity: 'face' },
          { quality: 'auto', fetch_format: 'auto' },
        ],
      });

      return res.json({
        success: true,
        url: result.secure_url,
        public_id: result.public_id,
      });
    }

    return res.status(400).json({ success: false, message: 'No image file or base64 data provided' });
  } catch (error) {
    console.error('[Upload Avatar Error]', error);
    next(error);
  }
};

// @desc    Upload chat photo attachment to Cloudinary
// @route   POST /api/upload/chat
// @access  Private (Any authenticated user)
exports.uploadChatImage = async (req, res, next) => {
  try {
    // 1. Multer file stream upload
    if (req.file) {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'retail/chat',
          resource_type: 'image',
          transformation: [{ quality: 'auto', fetch_format: 'auto' }],
        },
        (error, result) => {
          if (error) {
            console.error('[Cloudinary Chat Upload Error]', error);
            return res.status(500).json({ success: false, message: error.message });
          }

          res.json({
            success: true,
            url: result.secure_url,
            public_id: result.public_id,
          });
        }
      );

      uploadStream.end(req.file.buffer);
      return;
    }

    // 2. Direct Base64 image upload
    const base64Data = req.body?.image || req.body?.base64;
    if (base64Data) {
      const dataUri = base64Data.startsWith('data:')
        ? base64Data
        : `data:image/jpeg;base64,${base64Data}`;

      const result = await cloudinary.uploader.upload(dataUri, {
        folder: 'retail/chat',
        resource_type: 'image',
        transformation: [{ quality: 'auto', fetch_format: 'auto' }],
      });

      return res.json({
        success: true,
        url: result.secure_url,
        public_id: result.public_id,
      });
    }

    return res.status(400).json({ success: false, message: 'No image file or base64 data provided' });
  } catch (error) {
    console.error('[Upload Chat Image Error]', error);
    next(error);
  }
};
