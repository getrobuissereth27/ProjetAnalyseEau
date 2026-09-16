require('dotenv').config();
const app = require('./app');
const connecterBDD = require('./config/db');

const PORT = process.env.PORT || 3000;

connecterBDD()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`✔ API démarrée sur http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('✘ Impossible de démarrer le serveur :', err.message);
    process.exit(1);
  });
