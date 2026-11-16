const { body, param, query, validationResult } = require('express-validator');
const { ROLES } = require('../models/utilisateur.model');

/*
 * Validation des entrées avec express-validator.
 *
 * Ces règles vérifient la FORME des données (présence, type, format d'un
 * identifiant MongoDB ou d'un email) avant d'arriver au contrôleur. Les
 * contrôleurs gardent leurs propres vérifications métier (droits d'accès,
 * cohérence des seuils, broche déjà utilisée...).
 *
 * Elles protègent aussi contre les injections NoSQL : sans elles, une requête
 * comme `?statut[$ne]=x` arriverait au contrôleur sous forme d'objet.
 *
 * En cas d'erreur : 400 { erreur: "<premier message>", details: [...] }, le
 * même format { erreur } que le reste de l'API (le frontend affiche `erreur`).
 */

// Exécute les règles puis renvoie 400 au premier problème trouvé.
function valider(regles) {
  return [
    ...regles,
    (req, res, next) => {
      const erreurs = validationResult(req);
      if (erreurs.isEmpty()) return next();
      const liste = erreurs.array({ onlyFirstError: true });
      return res.status(400).json({
        erreur: liste[0].msg,
        details: liste.map((e) => ({ champ: e.path, message: e.msg })),
      });
    },
  ];
}

// --- Briques réutilisables -------------------------------------------------

const idParam = (nom = 'id') => param(nom).isMongoId().withMessage('Identifiant invalide');
const siteQueryOptionnel = query('site').optional({ values: 'falsy' }).isMongoId().withMessage('Identifiant de site invalide');
const texteRequis = (champ, message) => body(champ).isString().withMessage(message).bail().trim().notEmpty().withMessage(message);
const texteOptionnel = (champ, message) => body(champ).optional({ values: 'null' }).isString().withMessage(message);
const emailOptionnel = body('email').optional({ values: 'null' }).isEmail().withMessage('Adresse email invalide');
const STATUTS_ALERTE = ['active', 'resolue'];
const CATEGORIES_ALERTE = ['seuil', 'capteur_defaillant'];

// --- Règles par route --------------------------------------------------------

const regles = {
  // Authentification
  connexion: valider([
    body('email').isString().withMessage('email et motDePasse sont requis').bail().notEmpty().withMessage('email et motDePasse sont requis'),
    body('motDePasse').isString().withMessage('email et motDePasse sont requis').bail().notEmpty().withMessage('email et motDePasse sont requis'),
  ]),

  // Mesures
  creerMesure: valider([
    body('capteur_id').exists({ values: 'null' }).withMessage('capteur_id et valeur sont requis').bail()
      .isMongoId().withMessage('capteur_id invalide'),
    body('valeur').exists({ values: 'null' }).withMessage('capteur_id et valeur sont requis').bail()
      .isFloat().withMessage('La valeur doit être un nombre'),
  ]),
  dernieresMesures: valider([siteQueryOptionnel]),
  historique: valider([
    query('capteur').exists().withMessage('paramètre capteur requis').bail()
      .isMongoId().withMessage('Identifiant de capteur invalide'),
    query('jours').optional({ values: 'null' }).isFloat({ gt: 0 }).withMessage('Le nombre de jours doit être positif'),
    query(['debut', 'fin']).optional({ values: 'null' }).isString().withMessage('Dates de début / fin invalides'),
  ]),
  supprimerMesures: valider([
    body('ids').isArray({ min: 1 }).withMessage('Un tableau ids non vide est requis'),
    body('ids.*').isMongoId().withMessage('Identifiant de mesure invalide'),
  ]),

  // Capteurs
  listerCapteurs: valider([siteQueryOptionnel]),
  creerCapteur: valider([
    body('site_id').exists().withMessage('site_id, type, modele et unite sont requis').bail()
      .isMongoId().withMessage('Identifiant de site invalide'),
    texteRequis('type', 'site_id, type, modele et unite sont requis'),
    texteRequis('modele', 'site_id, type, modele et unite sont requis'),
    texteRequis('unite', 'site_id, type, modele et unite sont requis'),
    body('broche').optional({ values: 'falsy' }).isString().withMessage('La broche doit être un texte'),
  ]),
  changerActivationCapteur: valider([
    idParam(),
    body('actif').isBoolean({ strict: true }).withMessage('Le champ actif (booléen) est requis'),
  ]),
  modifierCapteur: valider([
    idParam(),
    texteOptionnel('modele', 'Le modèle doit être un texte'),
    texteOptionnel('unite', "L'unité doit être un texte"),
    body('broche').optional({ values: 'falsy' }).isString().withMessage('La broche doit être un texte'),
  ]),

  // Seuils
  listerSeuils: valider([
    query('site').exists().withMessage('paramètre site requis').bail()
      .isMongoId().withMessage('Identifiant de site invalide'),
  ]),
  modifierSeuil: valider([idParam('capteurId')]),

  // Alertes
  listerAlertes: valider([
    siteQueryOptionnel,
    query('statut').optional({ values: 'falsy' }).isIn(STATUTS_ALERTE).withMessage('Statut invalide'),
    query('categorie').optional({ values: 'falsy' }).isIn(CATEGORIES_ALERTE).withMessage('Catégorie invalide'),
  ]),
  supprimerAlertes: valider([
    body('tout').optional({ values: 'null' }).isBoolean({ strict: true }).withMessage('Le champ tout doit être un booléen'),
    body('site').optional({ values: 'falsy' }).isMongoId().withMessage('Identifiant de site invalide'),
    body('statut').optional({ values: 'falsy' }).isIn(STATUTS_ALERTE).withMessage('Statut invalide'),
    body('categorie').optional({ values: 'falsy' }).isIn(CATEGORIES_ALERTE).withMessage('Catégorie invalide'),
    body('ids').optional({ values: 'null' }).isArray().withMessage('ids doit être un tableau'),
    body('ids.*').isMongoId().withMessage("Identifiant d'alerte invalide"),
  ]),

  // Vanne (route publique appelée par le Raspberry Pi)
  etatVanne: valider([siteQueryOptionnel]),

  // Sites
  creerSite: valider([
    texteRequis('nom', 'Le nom du site est requis'),
    texteOptionnel('localisation', 'La localisation doit être un texte'),
  ]),
  modifierSite: valider([
    idParam(),
    texteOptionnel('nom', 'Le nom du site doit être un texte'),
    texteOptionnel('localisation', 'La localisation doit être un texte'),
  ]),

  // Destinataires des emails
  listerDestinataires: valider([siteQueryOptionnel]),
  ajouterDestinataire: valider([
    body('site_id').exists().withMessage('site_id et email sont requis').bail()
      .isMongoId().withMessage('Identifiant de site invalide'),
    body('email').exists().withMessage('site_id et email sont requis').bail()
      .isEmail().withMessage('Adresse email invalide'),
    texteOptionnel('nom', 'Le nom doit être un texte'),
  ]),
  modifierDestinataire: valider([
    idParam(),
    emailOptionnel,
    texteOptionnel('nom', 'Le nom doit être un texte'),
    body('actif').optional({ values: 'null' }).isBoolean().withMessage('Le champ actif doit être un booléen'),
  ]),

  // Utilisateurs
  creerUtilisateur: valider([
    texteRequis('nom', 'nom, email et motDePasse sont requis'),
    body('email').exists().withMessage('nom, email et motDePasse sont requis').bail()
      .isEmail().withMessage('Adresse email invalide'),
    body('motDePasse').isString().withMessage('nom, email et motDePasse sont requis').bail()
      .isLength({ min: 8 }).withMessage('Le mot de passe doit contenir au moins 8 caractères'),
    body('role').optional({ values: 'null' }).isIn(ROLES).withMessage('Rôle invalide'),
    body('sites').optional({ values: 'null' }).isArray().withMessage('sites doit être un tableau'),
    body('sites.*').isMongoId().withMessage('Identifiant de site invalide'),
  ]),
  modifierMonProfil: valider([
    texteOptionnel('nom', 'Le nom doit être un texte'),
    emailOptionnel,
    texteOptionnel('motDePasseActuel', 'Le mot de passe actuel doit être un texte'),
  ]),
  changerMonMotDePasse: valider([
    body(['motDePasseActuel', 'nouveauMotDePasse']).isString().withMessage('motDePasseActuel et nouveauMotDePasse sont requis')
      .bail().notEmpty().withMessage('motDePasseActuel et nouveauMotDePasse sont requis'),
    body('nouveauMotDePasse').isLength({ min: 8 }).withMessage('Le nouveau mot de passe doit contenir au moins 8 caractères'),
  ]),
  changerRole: valider([idParam(), body('role').isIn(ROLES).withMessage('Rôle invalide')]),
  attribuerSites: valider([
    idParam(),
    body('sites').isArray().withMessage('sites doit être un tableau'),
    body('sites.*').isMongoId().withMessage('Identifiant de site invalide'),
  ]),
  modifierUtilisateur: valider([
    idParam(),
    texteOptionnel('nom', 'Le nom doit être un texte'),
    emailOptionnel,
  ]),

  // Routes qui ne prennent qu'un identifiant dans l'URL
  parId: valider([idParam()]),
};

module.exports = { valider, regles };
