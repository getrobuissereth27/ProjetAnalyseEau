const mongoose = require('mongoose');

// Trois niveaux de rôle :
// - superadmin     : voit et gère tous les sites, crée les sites et les attribue
//                    aux administrateurs (et aux responsables).
// - administrateur : gère uniquement les sites qui lui ont été attribués
//                    (capteurs, seuils, destinataires, responsables de ces sites).
// - communautaire  : (« Responsable CAEPA ») consulte uniquement ses sites.
const ROLES = ['communautaire', 'administrateur', 'superadmin'];

const utilisateurSchema = new mongoose.Schema({
  nom: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  motDePasseHash: { type: String, required: true },
  role: { type: String, enum: ROLES, default: 'communautaire' },
  // Relation plusieurs-à-plusieurs : un utilisateur appartient à un ou plusieurs
  // sites, un site a plusieurs utilisateurs. Ignoré pour le superadmin (accès à tout).
  sites: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Site' }],
}, { timestamps: true });

utilisateurSchema.index({ sites: 1 });

module.exports = mongoose.model('Utilisateur', utilisateurSchema);
module.exports.ROLES = ROLES;
