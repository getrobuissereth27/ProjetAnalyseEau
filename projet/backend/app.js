const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const mesuresRoutes = require('./routes/mesures.routes');
const capteursRoutes = require('./routes/capteurs.routes');
const seuilsRoutes = require('./routes/seuils.routes');
const alertesRoutes = require('./routes/alertes.routes');
const authRoutes = require('./routes/auth.routes');
const vanneRoutes = require('./routes/vanne.routes');
const sitesRoutes = require('./routes/sites.routes');
const utilisateursRoutes = require('./routes/utilisateurs.routes');
const destinatairesRoutes = require('./routes/destinataires.routes');

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());

// Point de controle simple, utile pour verifier que l'API repond
app.get('/api/health', (req, res) => res.json({ statut: 'ok' }));

// Limite anti-force brute sur la connexion — désactivée pendant les tests
// automatisés (Jest définit NODE_ENV=test), qui se connectent très souvent.
const limiteurAuth = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  skip: () => process.env.NODE_ENV === 'test',
});
app.use('/api/auth/login', limiteurAuth);
app.use('/api/auth', authRoutes);
app.use('/api/measurements', mesuresRoutes);
app.use('/api/sensors', capteursRoutes);
app.use('/api/thresholds', seuilsRoutes);
app.use('/api/alerts', alertesRoutes);
app.use('/api/valve', vanneRoutes);
app.use('/api/sites', sitesRoutes);
app.use('/api/users', utilisateursRoutes);
app.use('/api/recipients', destinatairesRoutes);

// Gestion centralisee des erreurs non prevues
app.use((err, req, res, next) => {
  // Corps de requête trop volumineux (ex : suppression de milliers de mesures d'un coup)
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ erreur: 'Requête trop volumineuse : sélectionne moins de lignes à la fois' });
  }
  // JSON mal formé envoyé par un client
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ erreur: 'Corps de requête JSON invalide' });
  }
  console.error(err);
  res.status(500).json({ erreur: 'Erreur interne du serveur' });
});

module.exports = app;
