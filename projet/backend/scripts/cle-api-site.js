// Génère (ou remplace) la clé d'API du Raspberry Pi d'un site.
// La clé en clair est affichée UNE SEULE FOIS : seule son empreinte SHA-256 est stockée.
// Usage : npm run cle:site -- <id_du_site>
//         (sans id : le premier site trouvé, pratique avec un seul site)
// Ensuite, sur le Raspberry Pi : CLE_API=<la clé> python3 main.py

require('dotenv').config();
const mongoose = require('mongoose');
const Site = require('../models/site.model');
const { genererCle } = require('../middleware/cleapi.middleware');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const id = process.argv[2];
  const site = id ? await Site.findById(id) : await Site.findOne().sort({ createdAt: 1 });
  if (!site) {
    console.error('Site introuvable');
    process.exitCode = 1;
    return;
  }
  const { cle, hash } = genererCle();
  await Site.updateOne({ _id: site._id }, { cleApiHash: hash });
  console.log(`Clé d'API générée pour le site « ${site.nom} » (${site._id}).`);
  console.log('Copie-la maintenant, elle ne sera plus affichée :\n');
  console.log(`  CLE_API=${cle}\n`);
}

run()
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
