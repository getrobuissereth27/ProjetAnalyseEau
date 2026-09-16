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
app.get('/api/sante', (req, res) => res.json({ statut: 'ok' }));

const limiteurAuth = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });
app.use('/api/auth/login', limiteurAuth);
app.use('/api/auth', authRoutes);
app.use('/api/mesures', mesuresRoutes);
app.use('/api/capteurs', capteursRoutes);
app.use('/api/seuils', seuilsRoutes);
app.use('/api/alertes', alertesRoutes);
app.use('/api/vanne', vanneRoutes);
app.use('/api/sites', sitesRoutes);
app.use('/api/utilisateurs', utilisateursRoutes);
app.use('/api/destinataires', destinatairesRoutes);

// Gestion centralisee des erreurs non prevues
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ erreur: 'Erreur interne du serveur' });
});

module.exports = app;
