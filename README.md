# La bonne couleur 🎨

Petit jeu web : une couleur d'un drapeau est fausse, retrouve la bonne avec les curseurs
**Teinte / Saturation / Luminosité**. Plus tu es proche, plus tu marques de points.

- 95 drapeaux dessinés en SVG, 10 manches par partie
- Écart mesuré avec la formule CIEDE2000 (proche de la perception de l'œil)
- Record enregistré dans le navigateur
- Un seul fichier HTML, aucune dépendance, aucun build

## Lancer en local

Ouvre simplement `public/index.html` dans ton navigateur.

## Déployer sur Render (Blueprint)

Le fichier `render.yaml` à la racine décrit un **site statique** qui publie le dossier `public/`.

1. Sur [dashboard.render.com](https://dashboard.render.com), clique **New → Blueprint**.
2. Connecte ton compte GitHub si ce n'est pas déjà fait, puis choisis ce dépôt.
3. Donne un nom au Blueprint, vérifie que Render a bien détecté le service `la-bonne-couleur`, puis clique **Deploy Blueprint**.
4. Une fois le déploiement terminé, le jeu est en ligne sur `https://la-bonne-couleur.onrender.com`
   (ou une adresse proche si ce nom est déjà pris).

Chaque `git push` sur la branche principale redéploie automatiquement le site.

## Structure

```
.
├── public/
│   └── index.html   # le jeu complet (HTML + CSS + JS)
├── render.yaml      # Blueprint Render (site statique)
└── README.md
```
