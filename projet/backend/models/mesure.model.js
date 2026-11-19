const mongoose = require('mongoose');

const mesureSchema = new mongoose.Schema({
  capteur_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Capteur',
    required: true,
  },
  valeur: { type: Number, required: true },
  // Horodatage de la prise de mesure. Le Raspberry Pi l'envoie (heure d'origine,
  // y compris quand la mesure a été gardée dans le tampon pendant une coupure) ;
  // à défaut, c'est l'heure de réception par le serveur.
  horodatage: { type: Date, default: Date.now },
  // Identifiant unique généré par le client pour CETTE mesure : permet d'ignorer
  // un renvoi (idempotence) quand l'accusé de réception s'est perdu en route.
  mesure_uid: { type: String, trim: true },
});

// Unicité du mesure_uid, uniquement pour les mesures qui en ont un (anciennes
// mesures et envois de clients sans identifiant restent acceptés).
mesureSchema.index(
  { mesure_uid: 1 },
  { unique: true, partialFilterExpression: { mesure_uid: { $type: 'string' } } },
);

mesureSchema.index({ capteur_id: 1, horodatage: -1 });

module.exports = mongoose.model('Mesure', mesureSchema);
