const Address = require('../models/Address');

// @desc    Get all addresses / hubs
// @route   GET /api/addresses
// @access  Public / Private
exports.getAddresses = async (req, res, next) => {
  try {
    const addresses = await Address.find().sort({ isPrimary: -1, createdAt: 1 });
    res.json({
      success: true,
      count: addresses.length,
      addresses,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Create new address / hub
// @route   POST /api/addresses
// @access  Public / Private
exports.createAddress = async (req, res, next) => {
  try {
    const { name, shortName, type, street, cityStateZip, contact, hours, notes } = req.body;
    const address = await Address.create({
      name,
      shortName: shortName || name,
      type: type || 'ADDITIONAL FULFILLMENT BAY',
      street,
      cityStateZip,
      contact: contact || 'Floor Manager',
      hours: hours || 'Mon - Fri: 08:00 - 18:00',
      notes: notes || 'Standard dock receiving procedures apply.',
      isPrimary: false,
    });
    res.status(201).json({ success: true, address });
  } catch (err) {
    next(err);
  }
};

// @desc    Set address as primary
// @route   PATCH /api/addresses/:id/primary
// @access  Public / Private
exports.setPrimaryAddress = async (req, res, next) => {
  try {
    const { id } = req.params;
    await Address.updateMany({}, { isPrimary: false });
    const updated = await Address.findByIdAndUpdate(id, { isPrimary: true }, { new: true });
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Address not found' });
    }
    res.json({ success: true, address: updated });
  } catch (err) {
    next(err);
  }
};
