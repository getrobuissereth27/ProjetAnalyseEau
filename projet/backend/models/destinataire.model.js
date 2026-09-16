const mongoose = require('mongoose');

const destinataireSchema = new mongoose.Schema({
  site_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Site', required: true },
  email: { type: String, required: true, trim: true, lowercase: true },
}, { timestamps: true });

destinataireSchema.index({ site_id: 1, email: 1 }, { unique: true });

module.exports = mongoose.model('Destinataire', destinataireSchema);
