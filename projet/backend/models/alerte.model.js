const mongoose = require('mongoose');

const alerteSchema = new mongoose.Schema({
  mesure_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Mesure',
    required: true,
  },
  type_alerte: { type: String, required: true },
  statut: { type: String, enum: ['active', 'resolue'], default: 'active' },
  horodatage: { type: Date, default: Date.now },
  dateResolution: { type: Date, default: null },
});

alerteSchema.index({ statut: 1, horodatage: -1 });

module.exports = mongoose.model('Alerte', alerteSchema);
