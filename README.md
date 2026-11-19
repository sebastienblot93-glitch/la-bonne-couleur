# La bonne couleur 🎨

Sur chaque drapeau, une couleur est fausse. Retrouve la bonne avec les curseurs
**Teinte / Saturation / Luminosité** : plus tu es proche, plus tu marques de points.

## Ce qu'il y a dedans

- **Défi du jour** : les mêmes 10 drapeaux pour tout le monde, une seule tentative, classement quotidien,
  série de jours consécutifs, résultat à partager (grille d'émojis).
- **Partie libre** : 10 drapeaux au hasard parmi 95, classement des records personnels.
- **Duel en direct** : une salle à code (lien `/?salle=CODE`), deux joueurs, les mêmes drapeaux,
  45 s par manche, révélation simultanée des deux couleurs, revanche, victoire par forfait si l'autre quitte.
- **Scores vérifiés côté serveur** : chaque partie est signée (HMAC) et le serveur recalcule les points
  à partir des réponses. Un jeton ne peut servir qu'une fois.
- **Interface « cabine de lumière »** : tout le décor est en gris neutres, seules les couleurs des drapeaux
  sont en couleur, comme dans une cabine d'évaluation des couleurs.
- Écart mesuré avec la formule **CIEDE2000** (proche de la perception humaine) ; le temps ne sert qu'à départager les ex æquo.
- Aucune dépendance npm.

## Lancer en local

```bash
node server.js            # http://localhost:10000, classement en mémoire (data/store.json)
REDIS_URL=redis://localhost:6379 node server.js   # avec un Redis local
```

Ouvrir directement `public/index.html` fonctionne aussi (mode hors ligne, sans classement).

## Déployer sur Render (Blueprint) — en Europe

`render.yaml` crée deux services dans la région **Francfort** :

| Service | Rôle | Offre |
|---|---|---|
| `la-bonne-couleur` | le jeu (Node) | gratuite |
| `la-bonne-couleur-classement` | base Key Value du classement, privée | gratuite |

1. Dashboard Render → **New → Blueprint** → choisis ce dépôt (branche `main`).
2. Vérifie que les deux services sont en **Frankfurt**, puis **Deploy Blueprint**.
   `GAME_SECRET` est généré automatiquement et `REDIS_URL` est relié tout seul à la base.

Si le Blueprint existe déjà : Render applique les changements de `render.yaml` à chaque push
(ou bouton **Manual Sync** sur la page du Blueprint).

### Limites de l'offre gratuite

- Le jeu se met en veille après ~15 min sans visite : le premier chargement suivant prend jusqu'à une minute.
- La base Key Value gratuite est en mémoire : **le classement est perdu si elle redémarre** (rare : maintenance, mise à jour).
  Pour un classement garanti, passe la base sur une offre payante avec persistance (`plan: starter`).
- La région d'un service ne peut pas être changée après sa création.
- Les salles de duel vivent dans la mémoire du serveur : un redéploiement ou une mise en veille
  les ferme (les joueurs sont prévenus et peuvent recréer une salle). Les duels supposent une seule instance du service.

## Structure

```
public/
  index.html   écrans (accueil, jeu, fin, classement)
  styles.css   design « cabine de lumière »
  app.js       logique de l'interface
  flags.js     drapeaux, couleurs, ΔE 2000, tirage des parties (partagé avec le serveur)
server.js      serveur HTTP + API (/api/game, /api/score, /api/leaderboard, /api/stats)
duel.js        salles de duel en mémoire, flux temps réel (Server-Sent Events)
store.js       classement : client Redis minimal, ou mémoire en local
render.yaml    Blueprint Render (Francfort)
```
