const mongoose = require('mongoose');

const siteSchema = new mongoose.Schema({
  nom: { type: String, required: true, trim: true },
  localisation: { type: String, trim: true, default: '' },
  // Adresse du Raspberry Pi de ce site sur le réseau, configurée par le
  // super administrateur depuis l'interface (page Paramètres). Vide = non renseignée.
  // Le port sert au test de connexion (22 = SSH, ouvert par défaut sur Raspberry Pi OS).
  ipRaspberry: { type: String, trim: true, default: '' },
  portRaspberry: { type: Number, default: 22, min: 1, max: 65535 },
  // Empreinte SHA-256 de la clé d'API du Raspberry Pi de ce site (la clé en clair
  // n'est jamais stockée, ni renvoyée par l'API : voir scripts/cle-api-site.js).
  cleApiHash: { type: String, select: false },
}, { timestamps: true });

module.exports = mongoose.model('Site', siteSchema);
