const mongoose = require('mongoose');

const siteSchema = new mongoose.Schema({
  nom: { type: String, required: true, trim: true },
  localisation: { type: String, trim: true, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Site', siteSchema);
