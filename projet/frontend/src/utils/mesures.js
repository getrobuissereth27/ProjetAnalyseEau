// Regroupe les mesures de plusieurs capteurs (chacune avec son propre horodatage,
// légèrement décalé puisque le Raspberry Pi les envoie l'une après l'autre) en une
// seule ligne par cycle de mesure — nécessaire pour afficher un tableau avec les
// 4 paramètres côte à côte plutôt qu'une liste séparée par capteur.
export function grouperParCycle(donneesParCle, toleranceMs = 30000) {
  const evenements = [];
  Object.entries(donneesParCle).forEach(([cle, points]) => {
    points.forEach((p) => evenements.push({ cle, valeur: p.valeur, id: p._id, t: new Date(p.horodatage).getTime() }));
  });
  evenements.sort((a, b) => a.t - b.t);

  const lignes = [];
  evenements.forEach((ev) => {
    let ligne = lignes.find((l) => Math.abs(l.t - ev.t) <= toleranceMs && l[ev.cle] === undefined);
    if (!ligne) {
      ligne = { t: ev.t };
      lignes.push(ligne);
    }
    ligne[ev.cle] = ev.valeur;
    ligne[`${ev.cle}_id`] = ev.id;
    ligne.t = Math.min(ligne.t, ev.t); // horodatage du premier élément du cycle
  });

  return lignes.sort((a, b) => b.t - a.t); // du plus récent au plus ancien
}
