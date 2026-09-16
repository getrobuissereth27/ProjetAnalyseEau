const mongoose = require('mongoose');

const capteurSchema = new mongoose.Schema({
  site_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Site', required: true },
  type: { type: String, required: true, trim: true },       // ex: 'pH', 'turbidite', 'temperature', 'tds'
  modele: { type: String, required: true, trim: true },
  unite: { type: String, required: true, trim: true },
  canal_adc: { type: Number, default: null },                // null pour les capteurs numeriques (ex: DS18B20)
}, { timestamps: true });

module.exports = mongoose.model('Capteur', capteurSchema);
