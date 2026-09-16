const mongoose = require('mongoose');

const utilisateurSchema = new mongoose.Schema({
  nom: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  motDePasseHash: { type: String, required: true },
  role: { type: String, enum: ['communautaire', 'administrateur'], default: 'communautaire' },
}, { timestamps: true });

module.exports = mongoose.model('Utilisateur', utilisateurSchema);
