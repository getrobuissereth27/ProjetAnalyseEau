const mongoose = require('mongoose');

const destinataireSchema = new mongoose.Schema({
  site_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Site', required: true },
  nom: { type: String, trim: true, default: '' },
  email: { type: String, required: true, trim: true, lowercase: true },
  actif: { type: Boolean, default: true }, // permet de mettre en pause sans supprimer
}, { timestamps: true });

// Un même email ne peut être ajouté deux fois pour le même site.
destinataireSchema.index({ site_id: 1, email: 1 }, { unique: true });

module.exports = mongoose.model('Destinataire', destinataireSchema);
