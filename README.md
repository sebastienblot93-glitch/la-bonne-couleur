# La bonne couleur 🎨

Sur chaque drapeau, une couleur est fausse. Retrouve la bonne avec les curseurs
**Teinte / Saturation / Luminosité** : plus tu es proche, plus tu marques de points.

## Ce qu'il y a dedans

- **Défi du jour** : les mêmes 10 drapeaux pour tout le monde, **du plus simple au plus corsé**
  (sans aller jusqu'aux nuances les plus extrêmes), une seule tentative, classement quotidien,
  série de jours consécutifs, résultat à partager (grille d'émojis).
- **Partie libre en 3 niveaux**, chacun avec son classement :
  - *Facile* : drapeaux connus, couleurs franches, indice sur la nuance (« un bleu foncé »…) ;
  - *Moyen* : mélange équilibré, sans indice ;
  - *Difficile* : drapeaux rares et nuances subtiles, curseurs seulement (pas de code couleur).
- **Difficulté de chaque manche** (1 à 5) calculée à partir de la notoriété du pays et de la nuance à retrouver
  (blanc et noir faciles, couleurs « classiques » de drapeaux plus faciles que les nuances rares).
- **Duel en direct** : une salle à code (lien `/?salle=CODE`), deux joueurs, les mêmes drapeaux,
  45 s par manche, niveau et nombre de manches choisis par le créateur, révélation simultanée des deux couleurs,
  revanche, victoire par forfait si l'autre quitte.
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

`render.yaml` crée le service web `la-bonne-couleur` dans la région **Francfort** (offre gratuite).
Le classement est stocké dans une base **Upstash Redis** (offre gratuite, données conservées).

1. Sur [console.upstash.com](https://console.upstash.com), crée une base Redis **régionale** en Europe
   (Francfort de préférence), éviction désactivée, puis copie son adresse `rediss://…` (onglet de connexion, format TCP).
2. Dashboard Render → **New → Blueprint** → choisis ce dépôt (branche `main`).
3. Colle l'adresse Upstash dans `REDIS_URL` quand Render la demande (ou plus tard : service → **Environment**).
   `GAME_SECRET` est généré automatiquement.

### Limites des offres gratuites

- Le jeu se met en veille après ~15 min sans visite : le premier chargement suivant prend jusqu'à une minute.
- Upstash gratuit : 256 Mo et 500 000 commandes par mois (≈ 20 000 parties). Une base sans aucune activité
  pendant 14 jours est archivée (avec sauvegarde restaurable depuis la console Upstash).
- Sans `REDIS_URL`, le serveur garde le classement en mémoire : il est perdu à chaque redémarrage.
- La région d'un service Render ne peut pas être changée après sa création.
- Les salles de duel vivent dans la mémoire du serveur : un redéploiement ou une mise en veille
  les ferme (les joueurs sont prévenus et peuvent recréer une salle). Les duels supposent une seule instance du service.

## Structure

```
public/
  index.html   écrans (accueil, jeu, fin, classement)
  styles.css   design « cabine de lumière »
  app.js       logique de l'interface
  flags.js     drapeaux, couleurs, ΔE 2000, difficultés, tirage des parties (partagé avec le serveur)
server.js      serveur HTTP + API (/api/game, /api/score, /api/leaderboard, /api/stats)
duel.js        salles de duel en mémoire, flux temps réel (Server-Sent Events)
store.js       classement : client Redis minimal (Upstash, TLS), ou mémoire en local
render.yaml    Blueprint Render (Francfort)
```
