const nodemailer = require('nodemailer');

// Le SMTP est optionnel : en développement ou en démo, on journalise simplement
// l'email qui aurait été envoyé, plutôt que de faire échouer toute la chaîne
// d'analyse des seuils si aucune configuration n'est fournie.
let transporteur = null;
if (process.env.SMTP_HOST) {
  transporteur = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
} else {
  console.log("ℹ SMTP non configuré (SMTP_HOST absent) : les emails d'alerte seront journalisés, pas envoyés.");
}

async function envoyerAlerteEmail({ destinataires, type, valeur, unite, seuil, siteNom }) {
  if (!destinataires || destinataires.length === 0) return;

  const sujet = `⚠ Alerte qualité de l'eau — ${type} hors seuil (${siteNom})`;
  const texte = [
    `Le paramètre "${type}" a atteint ${valeur} ${unite}, en dehors de la plage autorisée`,
    `[${seuil.valeur_min} - ${seuil.valeur_max}] ${unite}.`,
    '',
    `Site concerné : ${siteNom}`,
    '',
    'Connectez-vous au tableau de bord pour plus de détails.',
  ].join('\n');

  if (!transporteur) {
    console.log(`[email simulé] À: ${destinataires.join(', ')} — ${sujet}`);
    return;
  }

  try {
    await transporteur.sendMail({
      from: process.env.SMTP_FROM || 'alertes@surveillance-eau.local',
      to: destinataires.join(', '),
      subject: sujet,
      text: texte,
    });
  } catch (err) {
    // Un échec d'envoi ne doit jamais empêcher la création de l'alerte elle-même.
    console.error("✘ Échec d'envoi de l'email d'alerte :", err.message);
  }
}

module.exports = { envoyerAlerteEmail };
