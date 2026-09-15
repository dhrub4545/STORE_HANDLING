const mongoose = require('mongoose');

const AddressSchema = new mongoose.Schema({
  name: { type: String, required: true },
  shortName: { type: String, required: true },
  type: { type: String, default: 'PRIMARY RECEIVING BAY' },
  street: { type: String, required: true },
  cityStateZip: { type: String, required: true },
  contact: { type: String, default: 'Receiving Supervisor • (909) 555-0144' },
  hours: { type: String, default: 'Mon - Fri: 06:00 - 22:00 PST' },
  notes: { type: String, default: '' },
  isPrimary: { type: Boolean, default: false },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Address', AddressSchema);
