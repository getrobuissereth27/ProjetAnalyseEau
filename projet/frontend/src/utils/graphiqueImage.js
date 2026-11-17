// Conversion d'un graphique Recharts (SVG) en image PNG, pour le téléchargement
// individuel et pour l'insertion dans l'export Excel.
//
// Le SVG est cloné, débarrassé de la barre de zoom (Brush), puis dessiné sur un
// canvas avec un fond blanc, un titre et, pour le graphique combiné, une légende
// (la légende Recharts est du HTML, elle ne fait pas partie du SVG).

const POLICE = '-apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const ECHELLE = 2; // image deux fois plus fine que l'écran, nette une fois imprimée ou zoomée
const MARGE = 16;
const HAUTEUR_TITRE = 34;
const HAUTEUR_LEGENDE = 26;

function chargerImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Impossible de convertir le graphique en image"));
    img.src = url;
  });
}

/**
 * @param {HTMLElement} conteneur  élément qui contient le graphique (ref de <Courbes>)
 * @param {object} options
 *   - titre   : texte affiché en haut de l'image
 *   - legende : [{ libelle, couleur }] (facultatif)
 * @returns {Promise<{ dataUrl: string, largeur: number, hauteur: number } | null>}
 *   largeur / hauteur en pixels « écran » (l'image réelle est ECHELLE fois plus grande)
 */
export async function graphiqueVersPng(conteneur, { titre, legende = [] } = {}) {
  const svg = conteneur?.querySelector('svg.recharts-surface');
  if (!svg) return null;

  const largeurSvg = svg.clientWidth || Number(svg.getAttribute('width'));
  let hauteurSvg = svg.clientHeight || Number(svg.getAttribute('height'));
  if (!largeurSvg || !hauteurSvg) return null;

  // On coupe le bas du graphique au niveau de la barre de zoom, inutile sur une image.
  const brush = svg.querySelector('.recharts-brush');
  if (brush) hauteurSvg = Math.max(60, Math.floor(brush.getBBox().y) - 6);

  const clone = svg.cloneNode(true);
  clone.querySelectorAll('.recharts-brush').forEach((el) => el.remove());
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', largeurSvg);
  clone.setAttribute('height', svg.clientHeight || svg.getAttribute('height'));
  clone.setAttribute('font-family', POLICE);

  const source = new XMLSerializer().serializeToString(clone);
  const url = URL.createObjectURL(new Blob([source], { type: 'image/svg+xml;charset=utf-8' }));

  try {
    const img = await chargerImage(url);
    const hautLegende = legende.length ? HAUTEUR_LEGENDE : 0;
    const largeur = largeurSvg + MARGE * 2;
    const hauteur = HAUTEUR_TITRE + hautLegende + hauteurSvg + MARGE;

    const canvas = document.createElement('canvas');
    canvas.width = largeur * ECHELLE;
    canvas.height = hauteur * ECHELLE;
    const ctx = canvas.getContext('2d');
    ctx.scale(ECHELLE, ECHELLE);

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, largeur, hauteur);

    if (titre) {
      ctx.fillStyle = '#0F172A';
      ctx.font = `700 15px ${POLICE}`;
      ctx.textBaseline = 'middle';
      ctx.fillText(titre, MARGE, HAUTEUR_TITRE / 2 + 4);
    }

    if (legende.length) {
      let x = MARGE;
      const y = HAUTEUR_TITRE + HAUTEUR_LEGENDE / 2;
      ctx.font = `12.5px ${POLICE}`;
      legende.forEach(({ libelle, couleur }) => {
        ctx.fillStyle = couleur;
        ctx.fillRect(x, y - 1.5, 16, 3);
        ctx.fillStyle = '#334155';
        ctx.fillText(libelle, x + 22, y);
        x += 22 + ctx.measureText(libelle).width + 20;
      });
    }

    // Seule la partie au-dessus de la barre de zoom est recopiée
    ctx.drawImage(img, 0, 0, largeurSvg, hauteurSvg, MARGE, HAUTEUR_TITRE + hautLegende, largeurSvg, hauteurSvg);

    return { dataUrl: canvas.toDataURL('image/png'), largeur, hauteur };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function telechargerDataUrl(dataUrl, nomFichier) {
  const lien = document.createElement('a');
  lien.href = dataUrl;
  lien.download = nomFichier;
  document.body.appendChild(lien);
  lien.click();
  document.body.removeChild(lien);
}
