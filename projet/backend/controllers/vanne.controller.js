const Alerte = require('../models/alerte.model');

// GET /api/vanne/etat?site=<id>
// La vanne est OUVERTE par défaut. Elle est FERMÉE dès qu'au moins une alerte
// est active POUR CE SITE — chaque site a sa propre vanne physique, donc un
// problème sur le site 2 ne doit jamais fermer la vanne du site 1.
exports.etatVanne = async (req, res) => {
  try {
    const alertesActives = await Alerte.find({ statut: 'active' })
      .populate({ path: 'mesure_id', populate: { path: 'capteur_id' } })
      .sort({ horodatage: -1 });

    const alertesDuSite = req.query.site
      ? alertesActives.filter((a) => a.mesure_id?.capteur_id?.site_id?.toString() === req.query.site)
      : alertesActives;

    const parametresHorsLimite = alertesDuSite
      .filter((a) => a.mesure_id && a.mesure_id.capteur_id)
      .map((a) => ({
        type: a.mesure_id.capteur_id.type,
        valeur: a.mesure_id.valeur,
        unite: a.mesure_id.capteur_id.unite,
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
