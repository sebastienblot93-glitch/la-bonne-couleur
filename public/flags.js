/*
 * La bonne couleur — module partagé (navigateur + Node).
 * Contient les drapeaux, leur dessin SVG, les outils de couleur (ΔE 2000)
 * et le générateur de partie déterministe utilisé par le serveur et le client.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.Flags = api;
})(typeof self !== "undefined" ? self : this, function () {
"use strict";

/* ---------- Constructeur de dessins SVG ---------- */
let UID = 0;
const n4 = v => +(+v).toFixed(4);
function B(f, W, H) {
  const st = i => `style="fill:${f(i)}"`;
  const eps = 0.004 * Math.max(W, H);
  const g = {
    r: (x, y, w, h, i) => `<rect x="${n4(x)}" y="${n4(y)}" width="${n4(w)}" height="${n4(h)}" ${st(i)}/>`,
    bg: i => g.r(0, 0, W, H, i),
    h: (ix, wt) => { wt = wt || ix.map(() => 1); const s = wt.reduce((a, b) => a + b, 0); let y = 0, o = '';
      ix.forEach((i, k) => { const hh = wt[k] / s * H; o += g.r(0, y, W, hh + (k < ix.length - 1 ? eps : 0), i); y += hh; }); return o; },
    v: (ix, wt) => { wt = wt || ix.map(() => 1); const s = wt.reduce((a, b) => a + b, 0); let x = 0, o = '';
      ix.forEach((i, k) => { const ww = wt[k] / s * W; o += g.r(x, 0, ww + (k < ix.length - 1 ? eps : 0), H, i); x += ww; }); return o; },
    p: (pts, i) => `<polygon points="${pts.map(n4).join(' ')}" ${st(i)}/>`,
    c: (cx, cy, r, i) => `<circle cx="${n4(cx)}" cy="${n4(cy)}" r="${n4(r)}" ${st(i)}/>`,
    s: (cx, cy, R, i, rot = 0, n = 5, k = 0.381966) => { const pts = [];
      for (let j = 0; j < 2 * n; j++) { const a = (-90 + rot + j * 180 / n) * Math.PI / 180, rr = j % 2 ? R * k : R;
        pts.push(cx + rr * Math.cos(a), cy + rr * Math.sin(a)); } return g.p(pts, i); },
    l: (x1, y1, x2, y2, w, i) => { const dx = x2 - x1, dy = y2 - y1;
      return `<line x1="${n4(x1 - dx * .3)}" y1="${n4(y1 - dy * .3)}" x2="${n4(x2 + dx * .3)}" y2="${n4(y2 + dy * .3)}" style="stroke:${f(i)};stroke-width:${w}"/>`; },
    cr: (cx, cy, r, cx2, cy2, r2, i) => { const id = 'mk' + (++UID);
      return `<mask id="${id}" maskUnits="userSpaceOnUse" x="-1000" y="-1000" width="3000" height="3000"><rect x="-1000" y="-1000" width="3000" height="3000" fill="#fff"/><circle cx="${n4(cx2)}" cy="${n4(cy2)}" r="${n4(r2)}" fill="#000"/></mask><circle cx="${n4(cx)}" cy="${n4(cy)}" r="${n4(r)}" mask="url(#${id})" ${st(i)}/>`; },
    ring: (cx, cy, r, w, i) => `<circle cx="${cx}" cy="${cy}" r="${r}" style="fill:none;stroke:${f(i)};stroke-width:${w}"/>`,
    path: (d, i) => `<path d="${d}" ${st(i)}/>`,
    pentagram: (cx, cy, R, w, i) => { const P = [];
      for (let j = 0; j < 5; j++) { const a = (-90 + j * 72) * Math.PI / 180; P.push([cx + R * Math.cos(a), cy + R * Math.sin(a)]); }
      const o = [0, 2, 4, 1, 3].map(j => P[j].map(n4).join(','));
      return `<path d="M${o.join(' L')} Z" style="fill:none;stroke:${f(i)};stroke-width:${w};stroke-linejoin:miter;stroke-miterlimit:10"/>`; },
    zig: (x0, x1, n, i) => { const pts = [0, 0, x0, 0];
      for (let k = 0; k < n; k++) pts.push(x1, (k + .5) * H / n, x0, (k + 1) * H / n);
      pts.push(0, H); return g.p(pts, i); },
  };
  return g;
}


const FLAGS = [
 {id:'fr',n:'France',de:'de la',W:3,H:2,c:['#0055A4','#FFFFFF','#EF4135'],d:g=>g.v([0,1,2])},
 {id:'it',n:'Italie',de:"de l'",W:3,H:2,c:['#009246','#FFFFFF','#CE2B37'],d:g=>g.v([0,1,2])},
 {id:'de',n:'Allemagne',de:"de l'",W:5,H:3,c:['#000000','#DD0000','#FFCE00'],d:g=>g.h([0,1,2])},
 {id:'be',n:'Belgique',de:'de la',W:15,H:13,c:['#000000','#FDDA24','#EF3340'],d:g=>g.v([0,1,2])},
 {id:'ie',n:'Irlande',de:"de l'",W:2,H:1,c:['#169B62','#FFFFFF','#FF883E'],d:g=>g.v([0,1,2])},
 {id:'nl',n:'Pays-Bas',de:'des',W:3,H:2,c:['#AE1C28','#FFFFFF','#21468B'],d:g=>g.h([0,1,2])},
 {id:'lu',n:'Luxembourg',de:'du',W:5,H:3,c:['#EA141D','#FFFFFF','#00A2E1'],d:g=>g.h([0,1,2])},
 {id:'at',n:'Autriche',de:"de l'",W:3,H:2,c:['#C8102E','#FFFFFF'],d:g=>g.h([0,1,0])},
 {id:'pl',n:'Pologne',de:'de la',W:8,H:5,c:['#FFFFFF','#DC143C'],d:g=>g.h([0,1])},
 {id:'ua',n:'Ukraine',de:"de l'",W:3,H:2,c:['#0057B7','#FFD700'],d:g=>g.h([0,1])},
 {id:'ru',n:'Russie',de:'de la',W:3,H:2,c:['#FFFFFF','#0039A6','#D52B1E'],d:g=>g.h([0,1,2])},
 {id:'hu',n:'Hongrie',de:'de la',W:2,H:1,c:['#CD2A3E','#FFFFFF','#436F4D'],d:g=>g.h([0,1,2])},
 {id:'bg',n:'Bulgarie',de:'de la',W:5,H:3,c:['#FFFFFF','#00966E','#D62612'],d:g=>g.h([0,1,2])},
 {id:'lt',n:'Lituanie',de:'de la',W:5,H:3,c:['#FDB913','#006A44','#C1272D'],d:g=>g.h([0,1,2])},
 {id:'ee',n:'Estonie',de:"de l'",W:11,H:7,c:['#0072CE','#000000','#FFFFFF'],d:g=>g.h([0,1,2])},
 {id:'ro',n:'Roumanie',de:'de la',W:3,H:2,c:['#002B7F','#FCD116','#CE1126'],d:g=>g.v([0,1,2])},
 {id:'lv',n:'Lettonie',de:'de la',W:2,H:1,c:['#9E3039','#FFFFFF'],d:g=>g.h([0,1,0],[2,1,2])},
 {id:'td',n:'Tchad',de:'du',W:3,H:2,c:['#002664','#FECB00','#C60C30'],d:g=>g.v([0,1,2])},
 {id:'ml',n:'Mali',de:'du',W:3,H:2,c:['#14B53A','#FCD116','#CE1126'],d:g=>g.v([0,1,2])},
 {id:'gn',n:'Guinée',de:'de la',W:3,H:2,c:['#CE1126','#FCD116','#009460'],d:g=>g.v([0,1,2])},
 {id:'ng',n:'Nigeria',de:'du',W:2,H:1,c:['#008751','#FFFFFF'],d:g=>g.v([0,1,0])},
 {id:'ci',n:"Côte d'Ivoire",de:'de la',W:3,H:2,c:['#F77F00','#FFFFFF','#009E60'],d:g=>g.v([0,1,2])},
 {id:'pe',n:'Pérou',de:'du',W:3,H:2,c:['#D91023','#FFFFFF'],d:g=>g.v([0,1,0])},
 {id:'co',n:'Colombie',de:'de la',W:3,H:2,c:['#FCD116','#003893','#CE1126'],d:g=>g.h([0,1,2],[2,1,1])},
 {id:'am',n:'Arménie',de:"de l'",W:2,H:1,c:['#D90012','#0033A0','#F2A800'],d:g=>g.h([0,1,2])},
 {id:'bo',n:'Bolivie',de:'de la',W:3,H:2,c:['#D52B1E','#F9E300','#007934'],d:g=>g.h([0,1,2])},
 {id:'ga',n:'Gabon',de:'du',W:4,H:3,c:['#009E60','#FCD116','#3A75C4'],d:g=>g.h([0,1,2])},
 {id:'sl',n:'Sierra Leone',de:'de la',W:3,H:2,c:['#1EB53A','#FFFFFF','#0072C6'],d:g=>g.h([0,1,2])},
 {id:'ye',n:'Yémen',de:'du',W:3,H:2,c:['#CE1126','#FFFFFF','#000000'],d:g=>g.h([0,1,2])},
 {id:'id',n:'Indonésie',de:"de l'",W:3,H:2,c:['#FF0000','#FFFFFF'],d:g=>g.h([0,1])},
 {id:'th',n:'Thaïlande',de:'de la',W:3,H:2,c:['#A51931','#F4F5F8','#2D2A4A'],d:g=>g.h([0,1,2,1,0],[1,1,2,1,1])},
 {id:'cr',n:'Costa Rica',de:'du',W:5,H:3,c:['#002B7F','#FFFFFF','#CE1126'],d:g=>g.h([0,1,2,1,0],[1,1,2,1,1])},
 {id:'mu',n:'Maurice',de:'de',W:3,H:2,c:['#EA2839','#1A206D','#FFD500','#00A551'],d:g=>g.h([0,1,2,3])},
 {id:'gm',n:'Gambie',de:'de la',W:27,H:18,c:['#CE1126','#FFFFFF','#0C1C8C','#3A7728'],d:g=>g.h([0,1,2,1,3],[6,1,4,1,6])},
 {id:'bw',n:'Botswana',de:'du',W:36,H:24,c:['#75AADB','#FFFFFF','#000000'],d:g=>g.h([0,1,2,1,0],[9,1,4,1,9])},
 {id:'se',n:'Suède',de:'de la',W:16,H:10,c:['#006AA7','#FECC00'],d:g=>g.bg(0)+g.r(5,0,2,10,1)+g.r(0,4,16,2,1)},
 {id:'fi',n:'Finlande',de:'de la',W:18,H:11,c:['#FFFFFF','#002F6C'],d:g=>g.bg(0)+g.r(5,0,3,11,1)+g.r(0,4,18,3,1)},
 {id:'dk',n:'Danemark',de:'du',W:37,H:28,c:['#C8102E','#FFFFFF'],d:g=>g.bg(0)+g.r(12,0,4,28,1)+g.r(0,12,37,4,1)},
 {id:'no',n:'Norvège',de:'de la',W:22,H:16,c:['#BA0C2F','#FFFFFF','#00205B'],d:g=>g.bg(0)+g.r(6,0,4,16,1)+g.r(0,6,22,4,1)+g.r(7,0,2,16,2)+g.r(0,7,22,2,2)},
 {id:'is',n:'Islande',de:"de l'",W:25,H:18,c:['#02529C','#FFFFFF','#DC1E35'],d:g=>g.bg(0)+g.r(7,0,4,18,1)+g.r(0,7,25,4,1)+g.r(8,0,2,18,2)+g.r(0,8,25,2,2)},
 {id:'fo',n:'Îles Féroé',de:'des',W:22,H:16,c:['#FFFFFF','#0065BD','#EF303E'],d:g=>g.bg(0)+g.r(6,0,4,16,1)+g.r(0,6,22,4,1)+g.r(7,0,2,16,2)+g.r(0,7,22,2,2)},
 {id:'ax',n:'Îles Åland',de:'des',W:26,H:17,c:['#0053A5','#FFCE00','#D21034'],d:g=>g.bg(0)+g.r(8,0,5,17,1)+g.r(0,6,26,5,1)+g.r(9.5,0,2,17,2)+g.r(0,7.5,26,2,2)},
 {id:'gl',n:'Groenland',de:'du',W:18,H:12,c:['#FFFFFF','#D00C33'],d:g=>g.r(0,0,18,6.03,0)+g.r(0,6,18,6,1)+g.path('M3,6 A4,4 0 0 1 11,6 Z',1)+g.path('M3,5.98 A4,4 0 0 0 11,5.98 Z',0)},
 {id:'jp',n:'Japon',de:'du',W:3,H:2,c:['#FFFFFF','#BC002D'],d:g=>g.bg(0)+g.c(1.5,1,.6,1)},
 {id:'bd',n:'Bangladesh',de:'du',W:10,H:6,c:['#006A4E','#F42A41'],d:g=>g.bg(0)+g.c(4.5,3,2,1)},
 {id:'pw',n:'Palaos',de:'des',W:8,H:5,c:['#4AADD6','#FFDE00'],d:g=>g.bg(0)+g.c(3.5,2.5,1.5,1)},
 {id:'la',n:'Laos',de:'du',W:6,H:4,c:['#CE1126','#002868','#FFFFFF'],d:g=>g.h([0,1,0],[1,2,1])+g.c(3,2,.8,2)},
 {id:'ne',n:'Niger',de:'du',W:7,H:6,c:['#E05206','#FFFFFF','#0DB02B'],d:g=>g.h([0,1,2])+g.c(3.5,3,.75,0)},
 {id:'ch',n:'Suisse',de:'de la',W:32,H:32,c:['#DA291C','#FFFFFF'],d:g=>g.bg(0)+g.r(13,6,6,20,1)+g.r(6,13,20,6,1)},
 {id:'cz',n:'Tchéquie',de:'de la',W:6,H:4,c:['#FFFFFF','#D7141A','#11457E'],d:g=>g.h([0,1])+g.p([0,0,3,2,0,4],2)},
 {id:'bj',n:'Bénin',de:'du',W:15,H:10,c:['#008751','#FCD116','#E8112D'],d:g=>g.r(6,0,9,5.03,1)+g.r(6,5,9,5,2)+g.r(0,0,6.03,10,0)},
 {id:'mg',n:'Madagascar',de:'de',W:3,H:2,c:['#FFFFFF','#FC3D32','#007E3A'],d:g=>g.r(1,0,2,1.01,1)+g.r(1,1,2,1,2)+g.r(0,0,1.01,2,0)},
 {id:'kw',n:'Koweït',de:'du',W:12,H:6,c:['#007A3D','#FFFFFF','#CE1126','#000000'],d:g=>g.h([0,1,2])+g.p([0,0,3,2,3,4,0,6],3)},
 {id:'ae',n:'Émirats arabes unis',de:'des',W:12,H:6,c:['#00732F','#FFFFFF','#000000','#FF0000'],d:g=>g.h([0,1,2])+g.r(0,0,3,6,3)},
 {id:'bs',n:'Bahamas',de:'des',W:12,H:6,c:['#00778B','#FFC72C','#000000'],d:g=>g.h([0,1,0])+g.p([0,0,5.196,3,0,6],2)},
 {id:'jm',n:'Jamaïque',de:'de la',W:12,H:6,c:['#009B3A','#FED100','#000000'],d:g=>g.bg(0)+g.p([0,0,6,3,0,6],2)+g.p([12,0,6,3,12,6],2)+g.l(0,0,12,6,.9,1)+g.l(0,6,12,0,.9,1)},
 {id:'tz',n:'Tanzanie',de:'de la',W:72,H:48,c:['#1EB53A','#FCD116','#000000','#00A3DD'],d:g=>g.bg(0)+g.p([72,0,72,48,0,48],3)+g.l(0,48,72,0,15,1)+g.l(0,48,72,0,10,2)},
 {id:'cg',n:'Congo',de:'du',W:3,H:2,c:['#009543','#FBDE4A','#DC241F'],d:g=>g.p([0,0,2,0,0,2],0)+g.p([1.99,0,3,0,1.01,2,0,2,0,1.99],1)+g.p([3,0,3,2,1,2],2)},
 {id:'cd',n:'RD Congo',de:'de la',W:800,H:600,c:['#007FFF','#F7D618','#CE1021'],d:g=>g.bg(0)+g.l(0,600,800,0,150,1)+g.l(0,600,800,0,108,2)+g.s(136,132,100,1)},
 {id:'sc',n:'Seychelles',de:'des',W:12,H:6,c:['#003F87','#FCD856','#D62828','#FFFFFF','#007A3D'],d:g=>g.p([0,6,0,0,4,0],0)+g.p([0,6,4,0,8,0],1)+g.p([0,6,8,0,12,0,12,2],2)+g.p([0,6,12,2,12,4],3)+g.p([0,6,12,4,12,6],4)},
 {id:'tt',n:'Trinité-et-Tobago',de:'de',W:10,H:6,c:['#CE1126','#FFFFFF','#000000'],d:g=>g.bg(0)+g.l(0,0,10,6,2.2,1)+g.l(0,0,10,6,1.55,2)},
 {id:'gy',n:'Guyana',de:'du',W:10,H:6,c:['#009E49','#FFFFFF','#FCD116','#000000','#CE1126'],d:g=>g.bg(0)+g.p([0,0,10,3,0,6],1)+g.p([0,.35,9.4,3,0,5.65],2)+g.p([0,0,5,3,0,6],3)+g.p([0,.4,4.45,3,0,5.6],4)},
 {id:'cu',n:'Cuba',de:'de',W:20,H:10,c:['#002A8F','#FFFFFF','#CB1515'],d:g=>g.h([0,1,0,1,0])+g.p([0,0,8.66,5,0,10],2)+g.s(2.9,5.1,1.75,1)},
 {id:'cl',n:'Chili',de:'du',W:6,H:4,c:['#0039A6','#FFFFFF','#D52B1E'],d:g=>g.r(0,0,6,2.02,1)+g.r(0,2,6,2,2)+g.r(0,0,2,2,0)+g.s(1,1,.5,1)},
 {id:'pa',n:'Panama',de:'du',W:6,H:4,c:['#FFFFFF','#DA121A','#072357'],d:g=>g.bg(0)+g.r(3,0,3,2,1)+g.r(0,2,3,2,2)+g.s(1.5,1,.6,2)+g.s(4.5,3,.6,1)},
 {id:'tg',n:'Togo',de:'du',W:8.09,H:5,c:['#006A4E','#FFCE00','#D21034','#FFFFFF'],d:g=>g.h([0,1,0,1,0])+g.r(0,0,3,3,2)+g.s(1.5,1.55,1,3)},
 {id:'vn',n:'Viêt Nam',de:'du',W:3,H:2,c:['#DA251D','#FFFF00'],d:g=>g.bg(0)+g.s(1.5,1.04,.6,1)},
 {id:'cn',n:'Chine',de:'de la',W:30,H:20,c:['#EE1C25','#FFFF00'],d:g=>g.bg(0)+g.s(5,5,3,1)+[[10,2],[12,4],[12,7],[10,9]].map(([x,y])=>g.s(x,y,1,1,Math.atan2(5-y,5-x)*180/Math.PI+90)).join('')},
 {id:'cm',n:'Cameroun',de:'du',W:9,H:6,c:['#007A5E','#CE1126','#FCD116'],d:g=>g.v([0,1,2])+g.s(4.5,3.05,1,2)},
 {id:'sn',n:'Sénégal',de:'du',W:9,H:6,c:['#00853F','#FDEF42','#E31B23'],d:g=>g.v([0,1,2])+g.s(4.5,3.05,1,0)},
 {id:'gh',n:'Ghana',de:'du',W:9,H:6,c:['#CE1126','#FCD116','#006B3F','#000000'],d:g=>g.h([0,1,2])+g.s(4.5,3.05,1,3)},
 {id:'bf',n:'Burkina Faso',de:'du',W:9,H:6,c:['#EF2B2D','#009E49','#FCD116'],d:g=>g.h([0,1])+g.s(4.5,3.05,1,2)},
 {id:'gw',n:'Guinée-Bissau',de:'de la',W:12,H:6,c:['#CE1126','#FCD116','#009E49','#000000'],d:g=>g.r(4,0,8,3.02,1)+g.r(4,3,8,3,2)+g.r(0,0,4.02,6,0)+g.s(2,3.05,1,3)},
 {id:'so',n:'Somalie',de:'de la',W:9,H:6,c:['#4189DD','#FFFFFF'],d:g=>g.bg(0)+g.s(4.5,3.1,1.35,1)},
 {id:'ma',n:'Maroc',de:'du',W:9,H:6,c:['#C1272D','#006233'],d:g=>g.bg(0)+g.pentagram(4.5,3.15,1.6,.2,1)},
 {id:'tr',n:'Turquie',de:'de la',W:30,H:20,c:['#E30A17','#FFFFFF'],d:g=>g.bg(0)+g.cr(10,10,5,11.25,10,4,1)+g.s(19.1,10,2.5,1,-90)},
 {id:'tn',n:'Tunisie',de:'de la',W:30,H:20,c:['#E70013','#FFFFFF'],d:g=>g.bg(0)+g.c(15,10,5,1)+g.cr(14.6,10,3.75,15.6,10,3,0)+g.s(16.4,10,2.1,0,-90)},
 {id:'dz',n:'Algérie',de:"de l'",W:30,H:20,c:['#006233','#FFFFFF','#D21034'],d:g=>g.v([0,1])+g.cr(15,10,5,16.25,10,4,2)+g.s(17.4,10,2.4,2,-90)},
 {id:'ly',n:'Libye',de:'de la',W:48,H:24,c:['#E70013','#000000','#239E46','#FFFFFF'],d:g=>g.h([0,1,2],[1,2,1])+g.cr(22.5,12,4.5,23.7,12,3.65,3)+g.s(26.4,12,2.1,3,-90)},
 {id:'pk',n:'Pakistan',de:'du',W:30,H:20,c:['#01411C','#FFFFFF'],d:g=>g.r(7.5,0,22.5,20,0)+g.r(0,0,7.53,20,1)+g.cr(19.5,10.5,6,21,9,5.3,1)+g.s(23.2,6.8,1.9,1,45)},
 {id:'mr',n:'Mauritanie',de:'de la',W:30,H:20,c:['#D01C1F','#00A95C','#FFD700'],d:g=>g.h([0,1,0],[3,14,3])+g.cr(15,9,6,15,6.8,5.6,2)+g.s(15,6.2,1.9,2)},
 {id:'jo',n:'Jordanie',de:'de la',W:12,H:6,c:['#000000','#FFFFFF','#007A3D','#CE1126'],d:g=>g.h([0,1,2])+g.p([0,0,6,3,0,6],3)+g.s(2,3,.55,1,0,7,.5)},
 {id:'sd',n:'Soudan',de:'du',W:12,H:6,c:['#D21034','#FFFFFF','#000000','#007229'],d:g=>g.h([0,1,2])+g.p([0,0,4,3,0,6],3)},
 {id:'qa',n:'Qatar',de:'du',W:28,H:11,c:['#8A1538','#FFFFFF'],d:g=>g.bg(0)+g.zig(7.5,10.5,9,1)},
 {id:'bh',n:'Bahreïn',de:'de',W:10,H:6,c:['#CE1126','#FFFFFF'],d:g=>g.bg(0)+g.zig(2.5,4,5,1)},
 {id:'gr',n:'Grèce',de:'de la',W:27,H:18,c:['#0D5EAF','#FFFFFF'],d:g=>g.h([0,1,0,1,0,1,0,1,0])+g.r(0,0,10,10,0)+g.r(4,0,2,10,1)+g.r(0,4,10,2,1)},
 {id:'gb-sct',n:'Écosse',de:"de l'",W:10,H:6,c:['#005EB8','#FFFFFF'],d:g=>g.bg(0)+g.l(0,0,10,6,1.2,1)+g.l(0,6,10,0,1.2,1)},
 {id:'gb-eng',n:'Angleterre',de:"de l'",W:10,H:6,c:['#FFFFFF','#CE1124'],d:g=>g.bg(0)+g.r(4.4,0,1.2,6,1)+g.r(0,2.4,10,1.2,1)},
 {id:'in',n:'Inde',de:"de l'",W:9,H:6,c:['#FF9933','#FFFFFF','#138808','#000080'],minor:[3],d:g=>{let o=g.h([0,1,2])+g.ring(4.5,3,.7,.1,3)+g.c(4.5,3,.13,3);
   for(let k=0;k<24;k++){const a=k*15*Math.PI/180;o+=`<line x1="4.5" y1="3" x2="${n4(4.5+.68*Math.cos(a))}" y2="${n4(3+.68*Math.sin(a))}" style="stroke:${g._f(3)};stroke-width:.04"/>`;}return o;}},
 {id:'fm',n:'Micronésie',de:'de la',W:19,H:10,c:['#75B2DD','#FFFFFF'],d:g=>g.bg(0)+g.s(9.5,2.4,1,1)+g.s(9.5,7.6,1,1)+g.s(6.9,5,1,1)+g.s(12.1,5,1,1)},
 {id:'dj',n:'Djibouti',de:'de',W:9,H:6,c:['#6AB2E7','#12AD2B','#FFFFFF','#D7141A'],d:g=>g.h([0,1])+g.p([0,0,5.2,3,0,6],2)+g.s(1.85,3.05,.95,3)},
 {id:'mm',n:'Myanmar',de:'du',W:18,H:12,c:['#FECB00','#34B233','#EA2839','#FFFFFF'],d:g=>g.h([0,1,2])+g.s(9,6.6,4.6,3)},
 {id:'mv',n:'Maldives',de:'des',W:24,H:16,c:['#D21034','#007E3A','#FFFFFF'],d:g=>g.bg(0)+g.r(4,4,16,8,1)+g.cr(12.6,8,2.8,13.7,8,2.5,2)},
 {id:'az',n:'Azerbaïdjan',de:"de l'",W:12,H:6,c:['#00B5E2','#EF3340','#509E2F','#FFFFFF'],d:g=>g.h([0,1,2])+g.cr(5.75,3,.9,6,3,.75,3)+g.s(6.5,3,.4,3,0,8,.5)},
 {id:'sg',n:'Singapour',de:'de',W:54,H:36,c:['#EF3340','#FFFFFF'],d:g=>g.h([0,1])+g.cr(11.5,9,5.4,13.6,9,5,1)+[0,1,2,3,4].map(k=>{const a=(-90+k*72)*Math.PI/180;return g.s(15+2.7*Math.cos(a),9.4+2.7*Math.sin(a),1.2,1);}).join('')},
];

/* ---------- Couleurs ---------- */
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
function hsv2rgb(h, s, v) { const f = n => { const k = (n + h / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); };
  return [f(5), f(3), f(1)].map(x => Math.round(x * 255)); }
function rgb2hsv([r, g, b]) { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0; if (d) { if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h *= 60; if (h < 0) h += 360; }
  return [h, mx ? d / mx : 0, mx]; }
const toHex = rgb => '#' + rgb.map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase();
const fromHex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
function lab(hex) {
  const [r, g, b] = fromHex(hex).map(v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  const X = (r * .4124 + g * .3576 + b * .1805) / .95047, Y = r * .2126 + g * .7152 + b * .0722, Z = (r * .0193 + g * .1192 + b * .9505) / 1.08883;
  const f = t => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
}
function dE(h1, h2) { // CIEDE2000
  const [L1, a1, b1] = lab(h1), [L2, a2, b2] = lab(h2), rad = Math.PI / 180, deg = 180 / Math.PI;
  const Cb = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2, G = .5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)));
  const a1p = a1 * (1 + G), a2p = a2 * (1 + G), C1 = Math.hypot(a1p, b1), C2 = Math.hypot(a2p, b2);
  const hh = (a, b) => { if (!a && !b) return 0; const x = Math.atan2(b, a) * deg; return x < 0 ? x + 360 : x; };
  const hp1 = hh(a1p, b1), hp2 = hh(a2p, b2), dL = L2 - L1, dC = C2 - C1;
  let dh = 0; if (C1 * C2) { dh = hp2 - hp1; if (dh > 180) dh -= 360; else if (dh < -180) dh += 360; }
  const dH = 2 * Math.sqrt(C1 * C2) * Math.sin(dh * rad / 2), Lb = (L1 + L2) / 2, Cbp = (C1 + C2) / 2;
  let hb = hp1 + hp2; if (C1 * C2) hb = Math.abs(hp1 - hp2) > 180 ? (hp1 + hp2 < 360 ? (hp1 + hp2 + 360) / 2 : (hp1 + hp2 - 360) / 2) : (hp1 + hp2) / 2;
  const T = 1 - .17 * Math.cos((hb - 30) * rad) + .24 * Math.cos(2 * hb * rad) + .32 * Math.cos((3 * hb + 6) * rad) - .2 * Math.cos((4 * hb - 63) * rad);
  const dTh = 30 * Math.exp(-(((hb - 275) / 25) ** 2)), Rc = 2 * Math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7));
  const Sl = 1 + .015 * (Lb - 50) ** 2 / Math.sqrt(20 + (Lb - 50) ** 2), Sc = 1 + .045 * Cbp, Sh = 1 + .015 * Cbp * T, Rt = -Math.sin(2 * dTh * rad) * Rc;
  return Math.sqrt((dL / Sl) ** 2 + (dC / Sc) ** 2 + (dH / Sh) ** 2 + Rt * (dC / Sc) * (dH / Sh));
}

/* ---------- Partie : tirage déterministe ---------- */
const ROUNDS = 10;
const BY_ID = Object.fromEntries(FLAGS.map(f => [f.id, f]));

function hashStr(str) { // cyrb53 réduit à 32 bits
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) { const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  return h1 >>> 0;
}
function rng(seed) { let a = hashStr(String(seed));
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function wrongColor(flag, t, rnd) {
  const truth = flag.c[t];
  for (let k = 0; k < 600; k++) {
    const h = rnd() * 360, s = .2 + rnd() * .8, v = .25 + rnd() * .75, hex = toHex(hsv2rgb(h, s, v));
    if (dE(hex, truth) < 28) continue;
    if (flag.c.some((c, i) => i !== t && dE(hex, c) < 14)) continue;
    return [+h.toFixed(2), +s.toFixed(4), +v.toFixed(4)];
  }
  return [0, 0, .5];
}

/** Tire ROUNDS manches à partir d'une graine : [{id, t, start:[h,s,v]}] */
function generate(seed, n = ROUNDS) {
  const rnd = rng(seed), pool = FLAGS.map((_, i) => i), out = [];
  for (let k = 0; k < n; k++) {
    const j = k + Math.floor(rnd() * (pool.length - k)); [pool[k], pool[j]] = [pool[j], pool[k]];
    const flag = FLAGS[pool[k]];
    const cand = flag.c.map((_, i) => i).filter(i => !(flag.minor || []).includes(i));
    const t = cand[Math.floor(rnd() * cand.length)];
    out.push({ id: flag.id, t, start: wrongColor(flag, t, rnd) });
  }
  return out;
}

/** Points d'une manche selon l'écart ΔE2000 (100 = parfait) */
const points = d => Math.round(100 / (1 + Math.pow(d / 10, 2)));
const isHex = h => typeof h === "string" && /^#[0-9A-Fa-f]{6}$/.test(h);

function flagSVG(flag, f, w, h) {
  const g = B(f, flag.W, flag.H); g._f = f;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${flag.W} ${flag.H}" width="${w}" height="${h}" preserveAspectRatio="none">${flag.d(g)}</svg>`;
}

return { FLAGS, BY_ID, ROUNDS, generate, points, dE, lab, hsv2rgb, rgb2hsv, toHex, fromHex, isHex, flagSVG, rng };
});
