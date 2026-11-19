const net = require('net');

const DELAI_MS = Number(process.env.RASPBERRY_TIMEOUT_MS || 3000);

/**
 * Essaie d'ouvrir une connexion TCP vers le Raspberry Pi (par défaut le port 22,
 * SSH, ouvert sur Raspberry Pi OS). Aucune donnée n'est envoyée : on vérifie
 * seulement que la machine répond à cette adresse.
 * @returns {Promise<{ joignable: boolean, latenceMs?: number, raison?: string }>}
 */
function testerConnexion(hote, port = 22, delaiMs = DELAI_MS) {
  return new Promise((resolve) => {
    const debut = Date.now();
    const socket = net.createConnection({ host: hote, port });
    let termine = false;

    const finir = (resultat) => {
      if (termine) return;
      termine = true;
      socket.destroy();
      resolve(resultat);
    };

    socket.setTimeout(delaiMs);
    socket.once('connect', () => finir({ joignable: true, latenceMs: Date.now() - debut }));
    socket.once('timeout', () => finir({ joignable: false, raison: `Pas de réponse en ${delaiMs / 1000} s` }));
    socket.once('error', (err) => {
      const raisons = {
        ECONNREFUSED: `Machine joignable mais port ${port} fermé`,
        EHOSTUNREACH: 'Hôte injoignable',
        ENETUNREACH: 'Réseau injoignable',
        ENOTFOUND: 'Nom d\'hôte introuvable',
        EAI_AGAIN: 'Nom d\'hôte introuvable',
      };
      finir({ joignable: false, raison: raisons[err.code] || err.message });
    });
  });
}

module.exports = { testerConnexion };
