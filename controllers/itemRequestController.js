const ItemRequest = require('../models/ItemRequest');
const { getIO } = require('../sockets/chatSocket');
const cloudinary = require('../config/cloudinary');

/**
 * Extract Cloudinary public_id from a full Cloudinary URL
 * E.g. https://res.cloudinary.com/.../retail/products/item123.jpg -> retail/products/item123
 */
function extractCloudinaryPublicId(url) {
  if (!url || typeof url !== 'string' || !url.includes('cloudinary.com')) {
    return null;
  }
  try {
    const uploadIndex = url.indexOf('/upload/');
    if (uploadIndex === -1) return null;

    let afterUpload = url.substring(uploadIndex + '/upload/'.length);
    afterUpload = afterUpload.split('?')[0].split('#')[0];

    const parts = afterUpload.split('/');
    const filteredParts = [];
    let passedVersionOrFolder = false;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!passedVersionOrFolder) {
        if (/^v\d+$/.test(part)) {
          passedVersionOrFolder = true;
          continue;
        }
        if (part.includes(',') || /^[a-z]_[a-z0-9_]+$/i.test(part)) {
          continue;
        }
        passedVersionOrFolder = true;
        filteredParts.push(part);
      } else {
        filteredParts.push(part);
      }
    }

    if (filteredParts.length === 0) return null;

    const fullPath = filteredParts.join('/');
    const lastDotIndex = fullPath.lastIndexOf('.');
    if (lastDotIndex > 0) {
      return fullPath.substring(0, lastDotIndex);
    }
    return fullPath;
  } catch (e) {
    return null;
  }
}

/**
 * Delete a list of image URLs from Cloudinary concurrently
 */
async function deleteCloudinaryImages(urls = []) {
  if (!Array.isArray(urls) || urls.length === 0) return 0;

  const publicIds = [...new Set(urls.map(extractCloudinaryPublicId).filter(Boolean))];
  if (publicIds.length === 0) return 0;

  let deletedCount = 0;
  const deletePromises = publicIds.map(async (publicId) => {
    try {
      const res = await cloudinary.uploader.destroy(publicId, { resource_type: 'image', invalidate: true });
      if (res && (res.result === 'ok' || res.result === 'not found')) {
        deletedCount++;
      }
    } catch (err) {
      console.warn(`[Cloudinary Destroy Warning] Failed to delete ${publicId}:`, err.message);
    }
  });

  await Promise.allSettled(deletePromises);
  return deletedCount;
}

// @desc    Create a new customer item request (supports single or multi-item lists)
// @route   POST /api/requests
// @access  Private (Logged-in customer / user)
exports.createRequest = async (req, res, next) => {
  try {
    // Only verified members or admins can make requests
    const isAdmin = ['admin', 'super_admin', 'inventory_lead'].includes(req.user.role);
    if (!isAdmin && !req.user.isVerified) {
      return res.status(403).json({
        success: false,
        requiresVerification: true,
        message: 'Account Verification Required: Only verified members can submit custom item procurement requests. Please contact store admin to verify your account.',
      });
    }

    const {
      title,
      category,
      targetPrice,
      quantity,
      urgency,
      description,
      referenceImage,
      items,
    } = req.body;

    let normalizedItems = [];
    if (Array.isArray(items) && items.length > 0) {
      normalizedItems = items
        .filter((it) => it && (it.name || it.title))
        .map((it) => ({
          name: (it.name || it.title).trim(),
          quantity: it.quantity ? Math.max(1, parseInt(it.quantity, 10)) : 1,
          targetPrice: it.targetPrice ? Number(it.targetPrice) : null,
          specs: (it.specs || it.description || '').trim(),
          category: (it.category || category || 'Custom Sourcing').trim(),
          referenceImage: it.referenceImage || '',
          availabilityStatus: 'pending',
        }));
    }

    // Determine primary title
    let primaryTitle = (title || '').trim();
    if (!primaryTitle && normalizedItems.length > 0) {
      primaryTitle =
        normalizedItems.length === 1
          ? normalizedItems[0].name
          : `${normalizedItems[0].name} (+${normalizedItems.length - 1} more items)`;
    }

    if (!primaryTitle) {
      return res.status(400).json({ success: false, message: 'Request title or item name is required' });
    }

    // If items were not provided, synthesize single item
    if (normalizedItems.length === 0) {
      normalizedItems.push({
        name: primaryTitle,
        quantity: quantity ? Math.max(1, parseInt(quantity, 10)) : 1,
        targetPrice: targetPrice ? Number(targetPrice) : null,
        specs: (description || '').trim(),
        category: category || 'Custom Sourcing',
        referenceImage: referenceImage || '',
        availabilityStatus: 'pending',
      });
    }

    // Aggregate quantities & budgets
    const aggregateQty = normalizedItems.reduce((acc, it) => acc + (it.quantity || 1), 0);
    const aggregatePrice = normalizedItems.reduce((acc, it) => acc + (it.targetPrice ? it.targetPrice * (it.quantity || 1) : 0), 0);

    const primaryDescription =
      (description || '').trim() ||
      normalizedItems.map((it) => `• ${it.name} (Qty: ${it.quantity}${it.specs ? ` - ${it.specs}` : ''})`).join('\n');

    const itemRequest = await ItemRequest.create({
      user: req.user._id,
      userName: req.user.name || 'Customer',
      userEmail: req.user.email || '',
      title: primaryTitle,
      category: category || normalizedItems[0]?.category || 'Custom Sourcing',
      targetPrice: targetPrice ? Number(targetPrice) : (aggregatePrice > 0 ? aggregatePrice : null),
      quantity: quantity ? Math.max(1, parseInt(quantity, 10)) : aggregateQty,
      urgency: urgency || 'standard',
      description: primaryDescription,
      referenceImage: referenceImage || normalizedItems[0]?.referenceImage || '',
      items: normalizedItems,
      status: 'pending',
    });

    // Broadcast real-time notification to staff channel
    try {
      const io = getIO();
      if (io) {
        io.to('staff_channel').emit('request_notification', {
          type: 'new_request',
          requestId: itemRequest._id,
          title: itemRequest.title,
          userName: req.user.name || 'Customer',
          createdAt: itemRequest.createdAt,
        });
      }
    } catch (sockErr) {
      console.warn('[itemRequestController] Socket notification warning:', sockErr.message);
    }

    res.status(201).json({
      success: true,
      message: 'Item request submitted successfully',
      request: itemRequest,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get requests created by the current authenticated user
// @route   GET /api/requests/my
// @access  Private
exports.getMyRequests = async (req, res, next) => {
  try {
    const requests = await ItemRequest.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .populate('linkedProductId', 'name coverImage basePrice stockQty sku');

    res.json({
      success: true,
      count: requests.length,
      requests,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single request details by ID
// @route   GET /api/requests/:id
// @access  Private
exports.getRequestById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const itemRequest = await ItemRequest.findById(id)
      .populate('user', 'name email avatar role')
      .populate('linkedProductId', 'name coverImage basePrice stockQty sku');

    if (!itemRequest) {
      return res.status(404).json({ success: false, message: 'Item request not found' });
    }

    const isAdmin = ['admin', 'super_admin', 'inventory_lead', 'inventory_manager', 'store_clerk', 'warehouse_associate', 'staff'].includes(req.user.role);
    const isOwner = itemRequest.user && itemRequest.user._id.toString() === req.user._id.toString();

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ success: false, message: 'Not authorized to view this request' });
    }

    res.json({
      success: true,
      request: itemRequest,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all requests (Admin view) with filters & status metrics
// @route   GET /api/requests
// @access  Private (Admin / Lead)
exports.getAllRequests = async (req, res, next) => {
  try {
    const { status, search, urgency, category } = req.query;
    let query = {};

    if (status && status !== 'all') {
      query.status = status;
    }

    if (urgency && urgency !== 'all') {
      query.urgency = urgency;
    }

    if (category && category !== 'all') {
      query.category = { $regex: new RegExp(`^${category}$`, 'i') };
    }

    if (search && search.trim()) {
      const q = search.trim();
      query.$or = [
        { title: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { userName: { $regex: q, $options: 'i' } },
        { userEmail: { $regex: q, $options: 'i' } },
        { 'items.name': { $regex: q, $options: 'i' } },
      ];
    }

    const page = parseInt(req.query.page, 10);
    const limit = parseInt(req.query.limit, 10);

    let requestsQuery = ItemRequest.find(query)
      .sort({ createdAt: -1 })
      .populate('user', 'name email avatar role')
      .populate('linkedProductId', 'name coverImage basePrice stockQty sku');

    if (!isNaN(page) && page > 0 && !isNaN(limit) && limit > 0) {
      const skip = (page - 1) * limit;
      requestsQuery = requestsQuery.skip(skip).limit(limit);
    }

    const [requests, totalCount] = await Promise.all([
      requestsQuery,
      ItemRequest.countDocuments(query),
    ]);

    // Aggregate status counters for KPI pills
    const allCounts = await ItemRequest.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    const stats = {
      total: 0,
      pending: 0,
      in_sourcing: 0,
      approved: 0,
      fulfilled: 0,
      declined: 0,
    };

    allCounts.forEach((item) => {
      if (stats[item._id] !== undefined) {
        stats[item._id] = item.count;
      }
      stats.total += item.count;
    });

    res.json({
      success: true,
      count: requests.length,
      total: totalCount,
      stats,
      requests,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update request status and/or provide admin notes & availability
// @route   PUT /api/requests/:id
// @access  Private (Admin / Lead)
exports.updateRequestStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      status,
      adminNotes,
      linkedProductId,
      availabilityStatus,
      availableQty,
      availablePrice,
      availableLocation,
      availableDate,
      items,
    } = req.body;

    const itemRequest = await ItemRequest.findById(id);
    if (!itemRequest) {
      return res.status(404).json({ success: false, message: 'Item request not found' });
    }

    if (status) {
      itemRequest.status = status;
    }

    if (adminNotes !== undefined) {
      itemRequest.adminNotes = adminNotes.trim();
    }

    if (linkedProductId !== undefined) {
      itemRequest.linkedProductId = linkedProductId || null;
    }

    if (availabilityStatus !== undefined) {
      itemRequest.availabilityStatus = availabilityStatus;
    }

    if (availableQty !== undefined) {
      itemRequest.availableQty = availableQty ? Number(availableQty) : null;
    }

    if (availablePrice !== undefined) {
      itemRequest.availablePrice = availablePrice ? Number(availablePrice) : null;
    }

    if (availableLocation !== undefined) {
      itemRequest.availableLocation = availableLocation.trim();
    }

    if (availableDate !== undefined) {
      itemRequest.availableDate = availableDate.trim();
    }

    if (Array.isArray(items) && items.length > 0) {
      itemRequest.items = items;
    }

    itemRequest.adminUpdatedBy = req.user.name || 'Store Admin';
    itemRequest.adminUpdatedAt = new Date();

    await itemRequest.save();

    const updated = await ItemRequest.findById(id)
      .populate('user', 'name email avatar role')
      .populate('linkedProductId', 'name coverImage basePrice stockQty sku');

    // Broadcast status change notification to customer channel
    try {
      const io = getIO();
      if (io && updated.user) {
        const custId = updated.user._id ? updated.user._id.toString() : updated.user.toString();
        io.to(`user_${custId}`).emit('request_notification', {
          type: 'status_change',
          requestId: id,
          status: updated.status,
          title: updated.title,
        });
      }
    } catch (sockErr) {
      console.warn('[itemRequestController] Socket notification warning:', sockErr.message);
    }

    res.json({
      success: true,
      message: 'Item request updated successfully',
      request: updated,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete an item request (permanently removes request, chat history, and all Cloudinary images)
// @route   DELETE /api/requests/:id
// @access  Private (Admin or Request Owner if still pending)
exports.deleteRequest = async (req, res, next) => {
  try {
    const { id } = req.params;

    const itemRequest = await ItemRequest.findById(id);
    if (!itemRequest) {
      return res.status(404).json({ success: false, message: 'Item request not found' });
    }

    const isAdmin = ['admin', 'super_admin', 'inventory_lead', 'inventory_manager', 'store_clerk', 'warehouse_associate', 'staff'].includes(req.user.role);
    const isOwner = Boolean(itemRequest.user && itemRequest.user.toString() === req.user._id.toString());

    if (!isAdmin && (!isOwner || itemRequest.status !== 'pending')) {
      return res.status(403).json({
        success: false,
        message: 'You can only cancel pending requests created by your account',
      });
    }

    // 1. Collect all Cloudinary image URLs associated with this request
    const imageUrlsToDelete = [];

    // Main request reference image
    if (itemRequest.referenceImage) {
      imageUrlsToDelete.push(itemRequest.referenceImage);
    }

    // Itemized manifest reference images
    if (Array.isArray(itemRequest.items)) {
      for (const it of itemRequest.items) {
        if (it && it.referenceImage) {
          imageUrlsToDelete.push(it.referenceImage);
        }
      }
    }

    // In-chat attached photos
    if (Array.isArray(itemRequest.messages)) {
      for (const msg of itemRequest.messages) {
        if (msg && msg.image) {
          imageUrlsToDelete.push(msg.image);
        }
      }
    }

    // 2. Delete all associated Cloudinary images
    let deletedImagesCount = 0;
    try {
      deletedImagesCount = await deleteCloudinaryImages(imageUrlsToDelete);
    } catch (imgErr) {
      console.warn('[deleteRequest] Cloudinary deletion error:', imgErr.message);
    }

    // 3. Delete the request document from MongoDB (this permanently deletes the request and all embedded chat messages)
    await itemRequest.deleteOne();

    // 4. Notify connected socket clients in real time
    try {
      const io = getIO();
      if (io) {
        io.to(`request_${id}`).emit('request_deleted', {
          requestId: id,
          title: itemRequest.title,
        });
        io.to('staff_channel').emit('request_deleted', {
          requestId: id,
        });
        if (itemRequest.user) {
          const custId = itemRequest.user._id ? itemRequest.user._id.toString() : itemRequest.user.toString();
          io.to(`user_${custId}`).emit('request_notification', {
            type: 'request_deleted',
            requestId: id,
            title: itemRequest.title,
          });
        }
      }
    } catch (sockErr) {
      console.warn('[deleteRequest] Socket broadcast warning:', sockErr.message);
    }

    res.json({
      success: true,
      message: 'Item request, associated chat, and Cloudinary images successfully deleted',
      id,
      deletedImagesCount,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Send a chat message for an item request (between admin and member)
// @route   POST /api/requests/:id/messages
// @access  Private (Admin or Request Owner)
exports.addRequestMessage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { message = '', image = '', isEncrypted = true, encryptedMeta = null } = req.body;

    const trimmedMsg = (message || '').trim();
    const trimmedImg = (image || '').trim();

    if (!trimmedMsg && !trimmedImg) {
      return res.status(400).json({ success: false, message: 'Message content or photo is required' });
    }

    const itemRequest = await ItemRequest.findById(id);
    if (!itemRequest) {
      return res.status(404).json({ success: false, message: 'Item request not found' });
    }

    const isAdmin = ['admin', 'super_admin', 'inventory_lead', 'inventory_manager', 'store_clerk', 'warehouse_associate', 'staff'].includes(req.user.role);
    const isOwner = itemRequest.user && itemRequest.user.toString() === req.user._id.toString();

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ success: false, message: 'Not authorized to send messages on this request' });
    }

    const newMessage = {
      sender: req.user._id,
      senderName: req.user.name || (isAdmin ? 'Store Staff' : 'Customer'),
      senderRole: isAdmin ? (req.user.role || 'admin') : 'customer',
      message: trimmedMsg,
      image: trimmedImg,
      isEncrypted: Boolean(isEncrypted),
      encryptedMeta: encryptedMeta || null,
      createdAt: new Date(),
    };

    // Atomic $push preventing Mongoose VersionError concurrency collisions
    const updatedRequest = await ItemRequest.findByIdAndUpdate(
      id,
      { $push: { messages: newMessage } },
      { new: true }
    );

    const savedMessage = (updatedRequest && updatedRequest.messages)
      ? updatedRequest.messages[updatedRequest.messages.length - 1]
      : newMessage;

    // Broadcast in real-time via Socket.io
    try {
      const io = getIO();
      if (io) {
        io.to(`request_${id}`).emit('new_message', {
          requestId: id,
          message: savedMessage,
        });

        if (isAdmin) {
          if (itemRequest.user) {
            io.to(`user_${itemRequest.user.toString()}`).emit('request_notification', {
              type: 'new_chat',
              requestId: id,
              senderRole: 'admin',
              senderName: req.user.name || 'Concierge Staff',
              title: itemRequest.title,
            });
          }
        } else {
          io.to('staff_channel').emit('request_notification', {
            type: 'new_chat',
            requestId: id,
            senderRole: 'customer',
            senderName: req.user.name || 'Customer',
            title: itemRequest.title,
          });
        }
      }
    } catch (sockErr) {
      console.warn('[itemRequestController] Socket broadcast warning:', sockErr.message);
    }

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      newMessage: savedMessage,
      messages: itemRequest.messages,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all chat messages for an item request
// @route   GET /api/requests/:id/messages
// @access  Private (Admin or Request Owner)
exports.getRequestMessages = async (req, res, next) => {
  try {
    const { id } = req.params;
    const itemRequest = await ItemRequest.findById(id).select('messages user userName title status');
    if (!itemRequest) {
      return res.status(404).json({ success: false, message: 'Item request not found' });
    }

    const isAdmin = ['admin', 'super_admin', 'inventory_lead', 'inventory_manager', 'store_clerk', 'warehouse_associate', 'staff'].includes(req.user.role);
    const isOwner = itemRequest.user && itemRequest.user.toString() === req.user._id.toString();

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ success: false, message: 'Not authorized to view messages on this request' });
    }

    res.json({
      success: true,
      messages: itemRequest.messages || [],
    });
  } catch (error) {
    next(error);
  }
};

