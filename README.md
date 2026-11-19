# La bonne couleur 🎨

Petit jeu web : une couleur d'un drapeau est fausse, retrouve la bonne avec les curseurs
**Teinte / Saturation / Luminosité**. Plus tu es proche, plus tu marques de points.

- 95 drapeaux dessinés en SVG, 10 manches par partie
- Écart mesuré avec la formule CIEDE2000 (proche de la perception de l'œil)
- Record enregistré dans le navigateur
- Le jeu tient dans un seul fichier HTML ; un mini-serveur Node sans dépendance le sert

## Lancer en local

```bash
node server.js
# puis ouvrir http://localhost:10000
```

(ou ouvrir directement `public/index.html` dans le navigateur)

## Déployer sur Render (Blueprint) — hébergement en Europe

Le fichier `render.yaml` décrit un **service web Node** dans la région **Francfort (Allemagne)**,
sur l'offre gratuite. Un site statique Render n'aurait pas pu être placé en Europe :
il est servi par un CDN mondial, sans choix de région.

1. Sur [dashboard.render.com](https://dashboard.render.com), clique **New → Blueprint**.
2. Connecte ton compte GitHub si besoin, puis choisis ce dépôt et la branche `main`.
3. Vérifie que le service `la-bonne-couleur` apparaît avec la région **Frankfurt**,
   puis clique **Deploy Blueprint**.
4. Une fois le déploiement terminé, le jeu est en ligne sur `https://la-bonne-couleur.onrender.com`
   (ou une adresse proche si ce nom est déjà pris).

Chaque `git push` sur `main` redéploie automatiquement le site.

> ℹ️ Sur l'offre gratuite, le service se met en veille après une période sans visite :
> le premier chargement suivant peut prendre une cinquantaine de secondes.
> Passe sur une offre payante (`plan: starter`) pour l'éviter.
>
> ⚠️ La région d'un service ne peut pas être changée après sa création sur Render.

## Structure

```
.
├── public/
│   └── index.html   # le jeu complet (HTML + CSS + JS)
├── server.js        # serveur statique Node, sans dépendance
├── package.json
├── render.yaml      # Blueprint Render (Francfort)
└── README.md
```
