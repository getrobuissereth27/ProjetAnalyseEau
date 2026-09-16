const mongoose = require('mongoose');

const seuilSchema = new mongoose.Schema({
  capteur_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Capteur',
    required: true,
    unique: true,
  },
  valeur_min: { type: Number, required: true },
  valeur_max: { type: Number, required: true },
});

module.exports = mongoose.model('Seuil', seuilSchema);
