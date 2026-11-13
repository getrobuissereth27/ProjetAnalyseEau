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

async function envoyer(destinataires, sujet, texte) {
  if (!destinataires || destinataires.length === 0) return;

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

function plage(min, max, unite) {
  const bas = min ?? '−∞';
  const haut = max ?? '+∞';
  return `[${bas} - ${haut}] ${unite}`;
}

// Seuil critique dépassé (voir services/analyse.service.js)
async function envoyerAlerteEmail({ destinataires, type, valeur, unite, seuil, siteNom }) {
  const sujet = `Alerte CRITIQUE qualité de l'eau — ${type} (${siteNom})`;
  const critiqueMin = seuil.critique_min ?? seuil.valeur_min;
  const critiqueMax = seuil.critique_max ?? seuil.valeur_max;
  const texte = [
    `Le paramètre "${type}" a atteint ${valeur} ${unite}, au-delà du seuil critique`,
    `${plage(critiqueMin, critiqueMax, unite)}.`,
    `(plage normale : ${plage(seuil.valeur_min, seuil.valeur_max, unite)})`,
    '',
    `Site concerné : ${siteNom}`,
    '',
    'Connectez-vous au tableau de bord pour plus de détails.',
  ].join('\n');

  await envoyer(destinataires, sujet, texte);
}

// Capteur qui ne répond plus (voir services/surveillance.service.js)
async function envoyerAlerteCapteurDefaillant({ destinataires, type, modele, siteNom, dernierBattement, delaiSecondes }) {
  const sujet = `⚠ Capteur défectueux — ${type} ne répond plus (${siteNom})`;
  const texte = [
    `Le capteur "${type}"${modele ? ` (${modele})` : ''} n'a envoyé aucune mesure depuis plus de ${formaterDuree(delaiSecondes)}.`,
    `Dernière mesure reçue : ${dernierBattement ? new Date(dernierBattement).toLocaleString('fr-FR') : 'jamais'}.`,
    '',
    `Site concerné : ${siteNom}`,
    '',
    'Vérifiez l\'alimentation, le câblage du capteur et la connexion du Raspberry Pi.',
  ].join('\n');

  await envoyer(destinataires, sujet, texte);
}

function formaterDuree(secondes) {
  if (secondes < 60) return `${secondes} s`;
  const min = Math.floor(secondes / 60);
  const s = secondes % 60;
  return s ? `${min} min ${s} s` : `${min} min`;
}

module.exports = { envoyerAlerteEmail, envoyerAlerteCapteurDefaillant };
