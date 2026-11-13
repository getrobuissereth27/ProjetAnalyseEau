require('dotenv').config();
const app = require('./app');
const connecterBDD = require('./config/db');
const { migrerDonnees } = require('./services/migration.service');
const { demarrerSurveillance } = require('./services/surveillance.service');

const PORT = process.env.PORT || 3000;

connecterBDD()
  .then(migrerDonnees)
  .then(() => {
    app.listen(PORT, () => {
      console.log(`✔ API démarrée sur http://localhost:${PORT}`);
    });
    demarrerSurveillance();
  })
  .catch((err) => {
    console.error('✘ Impossible de démarrer le serveur :', err.message);
    process.exit(1);
  });
