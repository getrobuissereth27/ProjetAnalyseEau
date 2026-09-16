const mongoose = require('mongoose');

const mesureSchema = new mongoose.Schema({
  capteur_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Capteur',
    required: true,
  },
  valeur: { type: Number, required: true },
  horodatage: { type: Date, default: Date.now },
});

mesureSchema.index({ capteur_id: 1, horodatage: -1 });

module.exports = mongoose.model('Mesure', mesureSchema);
