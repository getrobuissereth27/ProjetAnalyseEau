const Alerte = require('../models/alerte.model');

// GET /api/valve/state?site=<id>
// La vanne est OUVERTE par défaut. Elle est FERMÉE dès qu'au moins une alerte
// de SEUIL est active POUR CE SITE — chaque site a sa propre vanne physique, donc
// un problème sur le site 2 ne doit jamais fermer la vanne du site 1.
// Une alerte « capteur défaillant » ne ferme pas la vanne : elle signale une panne
// de mesure, pas une eau de mauvaise qualité (les responsables sont prévenus par email).
// Reste public : le client Raspberry Pi l'interroge pour piloter la vanne.
exports.etatVanne = async (req, res) => {
  try {
    const filtre = { statut: 'active', categorie: 'seuil' };
    if (req.query.site) filtre.site_id = req.query.site;

    const alertesDuSite = await Alerte.find(filtre)
      .populate('capteur_id')
      .populate('mesure_id')
      .sort({ horodatage: -1 });

    const parametresHorsLimite = alertesDuSite
      .filter((a) => a.mesure_id && a.capteur_id)
      .map((a) => ({
        type: a.capteur_id.type,
        valeur: a.mesure_id.valeur,
        unite: a.capteur_id.unite,
        niveau: a.niveau,
        depuis: a.horodatage,
      }));

    res.json({
      etat: parametresHorsLimite.length === 0 ? 'ouverte' : 'fermee',
      parametresHorsLimite,
      verifieLe: new Date(),
    });
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
};
