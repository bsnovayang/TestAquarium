'use strict';
// =====================================================================
// draw.js — 外觀層：把骨架資料畫出來（只使用 core.js 的 G 指令）
// =====================================================================

const DRAW = { shrimp: drawShrimp, snail: drawSnail, fish: drawFish, turtle: drawTurtle, frog: drawFrog, gecko: drawGecko, mosquito: drawMosquito, larva: drawLarva,
               tadpole: drawTadpole, whale: drawWhale, nest: drawNest, cricket: drawCricket, fly: drawFly };

// ---------------------------------------------------------------------
// 場景
// ---------------------------------------------------------------------
function makeSand() {
  return Array.from({ length: Math.round(W / 9) }, () => ({ x: rand(0, W), y: rand(TANK.floor + 4, H - 4), r: rand(1, 3.2), c: pick(['#b39b6e', '#8f7a52', '#cdb88c', '#a08660']) }));
}
let SAND = makeSand();

function drawBackground() {
  G.rect(0, 0, W, H, { lin: [0, 0, 0, H, [[0, '#dfe9e4'], [.55, '#c9dcd6'], [1, '#9fb8b2']]] });
  drawBackWall();
  // 背面玻璃的反光
  G.save(); G.alpha(.25);
  for (let x0 = 120; x0 < W; x0 += 1400) {
    G.poly([P(x0, TANK.top), P(x0 + 140, TANK.top), P(x0 - 40, TANK.floor), P(x0 - 180, TANK.floor)], '#ffffff');
    G.poly([P(x0 + 180, TANK.top), P(x0 + 220, TANK.top), P(x0 + 40, TANK.floor), P(x0, TANK.floor)], '#ffffff');
  }
  G.restore();
}
function drawWaterBack() {
  const wy = world.waterY;
  if (wy >= TANK.floor) return;
  G.save(); G.alpha(.78);                                           // 半透明：讓背景岩壁透出來
  G.rect(TANK.left, wy, TANK.right - TANK.left, TANK.floor - wy, { lin: [0, wy, 0, TANK.floor, [[0, '#7cc2da'], [1, '#2f6f92']]] });
  G.restore();
}
function drawSubstrate() {
  G.rect(0, TANK.floor, W, H - TANK.floor, { lin: [0, TANK.floor, 0, H, [[0, '#c8b285'], [1, '#937a50']]] });
  for (const s of SAND) G.circle(s.x, s.y, s.r, s.c);
  G.save(); G.alpha(.25);                                           // 底沙波紋
  for (let row = 0; row < 3; row++) {
    const pts = []; for (let x = 0; x <= W; x += 40) pts.push(P(x, TANK.floor + 10 + row * 13 + Math.sin(x * .02 + row * 2) * 3));
    G.line(chaikin(pts, false, 1), 1.2, row % 2 ? '#e0cc9c' : '#8a7550');
  }
  G.restore();
}
function drawWaterFront() {
  const wy = world.waterY;
  if (wy >= TANK.floor) return;
  const tint = waterTint();
  G.save(); G.alpha(tint.alpha);
  G.rect(TANK.left, wy, TANK.right - TANK.left, TANK.floor - wy, tint.color);
  G.restore();
  // 水面
  const pts = [];
  for (let x = TANK.left; x <= TANK.right; x += 16) pts.push(P(x, wy + Math.sin(x * .03 + world.t * 1.8) * 1.6 + Math.sin(x * .011 - world.t) * 1.2));
  G.line(pts, 2.5, 'rgba(255,255,255,.75)');
  G.save(); G.alpha(.35);
  G.poly([...pts, P(TANK.right, wy + 10), P(TANK.left, wy + 10)], '#e9f8ff');
  G.restore();
}
function drawFrame() {
  G.rect(0, 0, W, TANK.top, { lin: [0, 0, 0, TANK.top, [[0, '#3a4148'], [1, '#22272b']]] });   // 上蓋（網子）
  G.save(); G.alpha(.35);
  for (let x = 8; x < W; x += 12) G.line([P(x, 6), P(x, TANK.top - 6)], 1, '#9aa6ae');
  G.restore();
  G.rect(0, 0, TANK.left, H, '#2a3036'); G.rect(TANK.right, 0, W - TANK.right, H, '#2a3036');
  G.rect(0, H - 6, W, 6, '#2a3036');
}

// ---------------------------------------------------------------------
// 造景
// ---------------------------------------------------------------------
function decorOutline(d, n = 28) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const x = d.x - d.w / 2 + d.w * i / n, s = decorSpan(d, clamp(x, d.x - d.w / 2 + .5, d.x + d.w / 2 - .5));
    if (s) pts.push(P(x, s.top));
  }
  pts.push(P(d.x + d.w / 2, d.y), P(d.x - d.w / 2, d.y));
  return pts;
}
// 會動的部分：土坡水面上的小草
function drawMoundGrass(d) {
  const wy = world.waterY, top = decorOutline(d).slice(0, -2);
  for (let i = 0; i < top.length; i += 2) { const p = top[i]; if (p.y < wy - 4) G.line([p, P(p.x + Math.sin(i + world.t) * 2, p.y - 9)], 2, '#78b04a'); }
}
// 靜態造景（岩石、漂流木、土坡）用圖層快取；位置、水位、藻類量變了才重畫
const STATIC_DECOR = { rock: 1, boulder: 1, mound: 1, wood: 1 };
const decorLayerId = new WeakMap(); let decorLayerSeq = 0;
function drawDecorCached(d) {
  if (!STATIC_DECOR[d.type]) return drawDecor(d);
  let id = decorLayerId.get(d); if (!id) { id = 'decor' + (++decorLayerSeq); decorLayerId.set(d, id); }
  let x0, y0, x1, y1;
  if (d.type === 'wood') {
    const [a, b] = woodEnds(d), m = d.h + 10;
    x0 = Math.min(a.x, b.x) - m; x1 = Math.max(a.x, b.x) + m; y0 = Math.min(a.y, b.y) - m; y1 = Math.max(a.y, b.y) + m;
  } else {
    const ol = decorOutline(d); x0 = x1 = ol[0].x; y0 = y1 = ol[0].y;
    for (const p of ol) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
    x0 -= 10; x1 += 10; y0 -= 10; y1 += 6;
  }
  const key = [d.type, d.x, d.y, d.w, d.h, d.rot || 0, d.seed, Math.round(world.waterY), Math.round(world.water.algae / 3)].join(',');
  G.layer(id, key, x0, y0, x1 - x0, y1 - y0, () => drawDecor(d));
  if (d.type === 'mound') drawMoundGrass(d);
}

function drawDecor(d) {
  const wy = world.waterY;
  if (d.type === 'plant') return drawPlant(d);
  if (d.type === 'filter') return drawFilter(d);
  if (d.type === 'floater') return drawFloater(d);
  if (d.type === 'fern') return drawFern(d);
  if (d.type === 'carpet') return drawCarpet(d);
  if (d.type === 'bubbler') {                                  // 氣泡石
    G.poly(ellipsePts(d.x, d.y - 5, d.w / 2, d.h / 2, 0, 18), { lin: [0, d.y - 12, 0, d.y, [[0, '#b9c2c6'], [1, '#6f7a80']]] }, '#4f585c', 1);
    for (let i = -2; i <= 2; i++) G.circle(d.x + i * 5, d.y - 8, 1, '#4f585c');
    G.line([P(d.x + d.w / 2 - 2, d.y - 6), P(d.x + d.w / 2 + 30, d.y - 2), P(TANK.right - 4, d.y - 2)], 2, 'rgba(60,70,60,.5)');   // 打氣管
    return;
  }
  if (d.type === 'wood') {
    const [a, b] = woodEnds(d), c = Math.cos(d.rot), s = Math.sin(d.rot), nx = -s * d.h / 2, ny = c * d.h / 2;
    const body = chaikin([P(a.x + nx, a.y + ny), P(a.x - nx, a.y - ny), P(b.x - nx, b.y - ny), P(b.x + nx, b.y + ny)], true, 1);
    G.poly(body, { lin: [0, d.y - d.h, 0, d.y + d.h, [[0, '#9a7650'], [1, '#5c4128']]] }, '#4a3420', 1.5);
    for (const f of [-.55, -.15, .25, .6]) {                         // 沿著木頭的木紋
      const pts = []; for (let k = .04; k <= .96; k += .08) pts.push(P(lerp(a.x, b.x, k) + nx * f + Math.sin(k * 20 + d.seed + f * 5) * .8, lerp(a.y, b.y, k) + ny * f + Math.cos(k * 17 + f) * .8));
      G.line(pts, .8, 'rgba(50,32,16,.45)');
    }
    for (const k of [.3, .68]) {                                     // 樹瘤
      const p = P(lerp(a.x, b.x, k) + nx * .2, lerp(a.y, b.y, k) + ny * .2);
      G.poly(ellipsePts(p.x, p.y, d.h * .3, d.h * .2, d.rot, 12), '#5c4128', '#3a2814', .8);
      G.poly(ellipsePts(p.x, p.y, d.h * .14, d.h * .09, d.rot, 10), null, 'rgba(40,26,12,.7)', .6);
    }
    G.save(); G.alpha(.25); G.line([P(a.x - nx * .8, a.y - ny * .8), P(b.x - nx * .8, b.y - ny * .8)], 1.5, '#f0d8b0'); G.restore();   // 頂面受光
    const film = []; for (let k = 0; k <= 1; k += .1) film.push(P(lerp(a.x, b.x, k) - nx, lerp(a.y, b.y, k) - ny));
    const al = world.water.algae / 100, under = film.filter(p => p.y > wy + 4);
    if (al > .05 && under.length > 1) { G.save(); G.alpha(Math.min(.8, al * 1.1)); G.line(under, 2 + al * 4, '#4f7a32'); G.restore(); }
    return;
  }
  const ol = decorOutline(d);
  const algaeFilm = pts => {                                     // 水下表面的藻膜
    const a = world.water.algae / 100, under = pts.filter(p => p.y > world.waterY + 4);
    if (a > .05 && under.length > 1) { G.save(); G.alpha(Math.min(.8, a * 1.1)); G.line(under, 3 + a * 5, '#4f7a32'); G.restore(); }
  };
  if (d.type === 'mound') {
    G.poly(ol, { lin: [0, d.y - d.h, 0, d.y, [[0, '#7a5a38'], [1, '#4f3a24']]] });
    const topPts = ol.slice(0, -2), r = rng(d.seed);
    for (const [off, col] of [[18, 'rgba(140,105,65,.35)'], [42, 'rgba(60,42,24,.35)'], [75, 'rgba(150,115,75,.25)']]) {   // 土層
      const band = topPts.filter(p => p.y + off < d.y - 6).map((p, i) => P(p.x, p.y + off + Math.sin(i * .9 + d.seed) * 2.5));
      if (band.length > 2) G.line(chaikin(band, false, 1), 2.2, col);
    }
    for (let i = 0; i < d.w / 6; i++) {                              // 小石子
      const x = d.x - d.w / 2 + r() * d.w, s = decorSpan(d, clamp(x, d.x - d.w / 2 + 1, d.x + d.w / 2 - 1));
      if (!s) continue;
      const y = lerp(s.top + 10, d.y - 4, r());
      G.poly(ellipsePts(x, y, 1.5 + r() * 3, 1 + r() * 2, r() * 3, 8), r() < .5 ? '#8a7558' : '#5e4a34');
    }
    for (let i = 0; i < 5; i++) {                                    // 樹根
      const p = topPts[Math.floor(topPts.length * (.2 + r() * .6))];
      if (!p || p.y > wy) continue;
      G.line(chaikin([P(p.x, p.y + 4), P(p.x + (r() - .5) * 14, p.y + 16), P(p.x + (r() - .5) * 20, p.y + 30)], false, 1), 1, 'rgba(50,34,18,.55)');
    }
    // 水面以上長草，水面以下長苔
    const top = ol.slice(0, -2);
    const above = top.filter(p => p.y < wy - 2), below = top.filter(p => p.y >= wy - 2);
    if (above.length > 1) G.line(above, 7, '#5f9a3c');
    if (below.length > 1) G.line(below, 5, '#3f6a3a');
    algaeFilm(top);
    return;
  }
  G.poly(ol, { lin: [d.x - d.w / 2, d.y - d.h, d.x + d.w / 2, d.y, [[0, '#a3a7a8'], [.5, '#7d8487'], [1, '#4f5558']]] }, '#3f4446', 1.5);
  { const r = rng(d.seed);                                          // 岩石的裂紋與斑點
    for (let i = 0; i < 3 + d.w / 80; i++) {
      const x0 = d.x + (r() - .5) * d.w * .6, s = decorSpan(d, x0); if (!s) continue;
      const y0 = lerp(s.top + 8, d.y - 6, r() * .6), pts = [P(x0, y0)];
      for (let k = 0; k < 3; k++) { const q = pts[pts.length - 1]; pts.push(P(q.x + (r() - .5) * 16, q.y + 4 + r() * 10)); }
      G.line(pts, .9, 'rgba(40,44,46,.55)');
    }
    for (let i = 0; i < d.w / 5; i++) {
      const x = d.x + (r() - .5) * d.w * .9, s = decorSpan(d, x); if (!s) continue;
      G.circle(x, lerp(s.top + 4, d.y - 3, r()), .6 + r() * 1.2, r() < .5 ? 'rgba(210,214,214,.4)' : 'rgba(40,44,46,.35)');
    } }
  algaeFilm(ol.slice(0, -2));
  const hl = ol.slice(3, Math.floor(ol.length * .42)).map(p => P(p.x, p.y + 7));
  if (hl.length > 1) { G.save(); G.alpha(.3); G.line(chaikin(hl, false, 1), 3, '#ffffff'); G.restore(); }
}
function drawPlant(d) {
  const wy = world.waterY, strands = 4;
  for (let k = 0; k < strands; k++) {
    const pts = [], hk = d.h * (.7 + .3 * Math.sin(d.seed + k * 2.1));
    for (let i = 0; i <= 8; i++) {
      const t = i / 8, y = d.y - hk * t, under = y > wy;
      const sway = under ? Math.sin(world.t * 1.4 + k * 1.3 + t * 3 + d.seed) * 12 * t : 4 * t;
      pts.push(P(d.x + (k - 1.5) * 9 + sway + Math.sin(k + t * 4) * 4, y));
    }
    const sm = chaikin(pts, false, 2);
    G.line(sm, 4.5, k % 2 ? '#3f8f4a' : '#4fa356');
    for (let i = 2; i < pts.length; i++) {
      const p = pts[i], s = (i % 2 ? 1 : -1);
      G.poly(ellipsePts(p.x + s * 6, p.y, 7, 2.6, s * .5, 10), k % 2 ? '#4f9a4f' : '#62b35e');
    }
  }
}

// ---------------------------------------------------------------------
// 魚
// ---------------------------------------------------------------------
const FISH_TAILS = {
  fan: chaikin([P(2, -3.5), P(-12, -9), P(-28, -26), P(-41, -25), P(-47, -8), P(-47, 8), P(-41, 25), P(-28, 26), P(-12, 9), P(2, 3.5)], true, 2),
  fork: chaikin([P(2, -3), P(-10, -9), P(-18, -14), P(-14, -4), P(-9, 0), P(-14, 4), P(-18, 14), P(-10, 9), P(2, 3)], true, 1),
};
function fishFins(n, tall) {
  return {
    dorsal: tall
      ? chaikin([P(n[2].x + 2, n[2].y - n[2].h + 1), P(n[3].x + 2, n[3].y - n[3].h - 14), P(n[4].x - 2, n[4].y - n[4].h - 12), P(n[4].x + 1, n[4].y - n[4].h + 1)], true, 1)
      : chaikin([P(n[2].x, n[2].y - n[2].h + 1), P(n[4].x, n[4].y - n[4].h - 9), P(n[6].x - 8, n[6].y - n[6].h - 13), P(n[5].x, n[5].y - n[5].h + 1)], true, 2),
    anal: chaikin([P(n[4].x, n[4].y + n[4].h - 1), P(n[6].x - 2, n[6].y + n[6].h + 9), P(n[6].x, n[6].y + n[6].h - 1)], true, 2),
  };
}
function fishBand(n, i0, i1, f0, f1) {          // 身體內的一條色帶（用厚度比例算，不需要 clip）
  const top = [], bot = [];
  for (let i = i0; i <= i1; i++) { top.push(P(n[i].x, n[i].y + n[i].h * f0)); bot.push(P(n[i].x, n[i].y + n[i].h * f1)); }
  return chaikin([...top, ...bot.reverse()], true, 1);
}

// ---------------------------------------------------------------------
// 紅尾黑鯊（細畫）：細長流線、腹部平坦、絨黑色身體、深叉形紅尾鰭、
//   高聳的背鰭、下位口（嘴朝下）＋兩對觸鬚；沒有脂鰭（鯉科）
// ---------------------------------------------------------------------
function sharkProfile(s) {
  const top = 12.5 * Math.pow(Math.max(0, Math.sin(Math.PI * Math.min(1, s * 1.06 + .07))), .62) * (1 - .58 * s) + 1.6;
  const bot = 8 * Math.pow(Math.max(0, Math.sin(Math.PI * Math.min(1, s * 1.08 + .05))), .9) * (1 - .5 * s) + 1.4;   // 腹部比背部平
  return { top, bot };
}
const SHARK_TAIL = chaikin([P(1, -2.6), P(-8, -7), P(-17, -14.5), P(-22.5, -15.5), P(-16, -6), P(-11, 0), P(-16, 6), P(-22.5, 15.5), P(-17, 14.5), P(-8, 7), P(1, 2.6)], true, 1);
function drawSharkFish(e) {
  const sp = SPECIES[e.type], R = fishRig(e), n = R.nodes, tb = n[FISH_N - 1], k = e.size * sp.len / 64;
  const pr = n.map((q, i) => sharkProfile(i / (FISH_N - 1)));
  const T = i => P(n[i].x, n[i].y - pr[i].top), B = i => P(n[i].x, n[i].y + pr[i].bot);
  G.save(); G.tf(e.x, e.y, 0, R.sx * k, (e.dead ? -1 : 1) * k); G.tf(0, 0, e.pitch || 0);
  if (e.dead) G.alpha(.65);
  // 尾鰭：深叉形、鮮紅（尾柄是黑的）
  G.save(); G.tf(tb.x, tb.y, R.tailRot, R.tailSx, 1);
  G.poly(SHARK_TAIL, { lin: [0, 0, -22, 0, [[0, '#3a1410'], [.18, '#d8321f'], [.6, '#f2482a'], [1, '#ff6a3a']]] }, 'rgba(90,15,8,.5)', .5);
  for (let r = -3; r <= 3; r++) G.line([P(-2, r * .5), P(-15 - Math.abs(r) * 1.6, r * 4.4)], .35, 'rgba(120,20,10,.35)');
  G.restore();
  // 遠側胸鰭
  G.save(); G.tf(n[1].x - 1, n[1].y + pr[1].bot * .55, R.pecRot + .25);
  G.poly(chaikin([P(0, 0), P(-6, 2.2), P(-8.5, 3.6), P(-3, 1.2)], true, 1), '#0a0b0d'); G.restore();
  // 背鰭（高、尖、後緣內凹）
  const d0 = T(2), d1 = T(4);
  G.poly(chaikin([P(d0.x + 1.5, d0.y + 1), P(n[3].x + 4, d0.y - 15.5), P(n[3].x + .5, d0.y - 15.8), P(d1.x + 3, d1.y - 3.5), P(d1.x, d1.y + 1)], true, 1), '#0e1013', 'rgba(70,80,90,.5)', .4);
  G.line([P(n[3].x + 4, d0.y - 15.3), P(n[3].x + .8, d0.y - 15.5)], .6, 'rgba(230,235,240,.55)');   // 背鰭尖端淡色邊
  // 腹鰭、臀鰭
  const b4 = B(4), b6 = B(6);
  G.poly(chaikin([P(b4.x + 2.5, b4.y - 2.5), P(b4.x - 4.5, b4.y + 5), P(b4.x - 6.5, b4.y - 1.5)], true, 1), '#0e1013');   // 鰭的根部埋進身體裡，才不會看起來分開
  G.poly(chaikin([P(b6.x + 2.5, b6.y - 2.5), P(b6.x - 4.5, b6.y + 5.5), P(b6.x - 7.5, b6.y - 1.5)], true, 1), '#0e1013');
  // 身體：絨黑色、腹部平坦、吻端圓鈍
  const ol = chaikin([P(n[0].x + 4.2, n[0].y - .6), ...n.map((q, i) => T(i)), ...n.map((q, i) => B(i)).reverse(), P(n[0].x + 3, n[0].y + 2.6)], true, 2);
  G.poly(ol, { lin: [0, -13, 0, 9, [[0, '#1d2228'], [.45, '#0d0f12'], [1, '#16191c']]] }, 'rgba(80,90,100,.35)', .5);
  G.save(); G.alpha(.2);                                                         // 背上的絨光
  G.poly(chaikin([...n.slice(0, 7).map((q, i) => P(q.x, q.y - pr[i].top + 1.2)), ...n.slice(0, 7).map((q, i) => P(q.x, q.y - pr[i].top * .45)).reverse()], true, 1), '#7d8fa3');
  G.restore();
  G.line(n.slice(1, 8).map((q, i) => P(q.x, q.y - pr[i + 1].top * .12)), .45, 'rgba(160,170,180,.22)');   // 側線
  G.line(arcPts(n[1].x + 4, n[1].y + .5, 7.5, Math.PI * .62, Math.PI * 1.38), .7, 'rgba(110,120,130,.45)');   // 鰓蓋
  // 下位口＋兩對觸鬚
  const mx = n[0].x + 2.6, my = n[0].y + pr[0].bot - .3;
  G.line([P(mx - 1.8, my - .3), P(mx, my + .4), P(mx + 1.6, my - .2)], .6, '#3a2f2c');
  G.line([P(mx + 1.4, my - .1), P(mx + 3, my + 2.4)], .4, '#2c2c2e');
  G.line([P(mx - 1.4, my), P(mx - 1.6, my + 2.8)], .4, '#2c2c2e');
  // 眼
  const ex = n[0].x - .8, ey = n[0].y - 2.4;
  G.circle(ex, ey, 2.5, '#0a0a0a', 'rgba(170,150,90,.8)', .55);
  if (!e.dead) G.circle(ex + .7, ey - .7, .6, '#fff');
  // 近側胸鰭（會撥動）
  G.save(); G.tf(n[1].x - .5, n[1].y + pr[1].bot * .6, R.pecRot);
  G.poly(chaikin([P(1, -.5), P(-8, 2.6), P(-11, 5.4), P(-3, 2.2)], true, 1), '#262a30', 'rgba(150,160,170,.55)', .45); G.restore();   // 稍亮一點，黑身體上才看得到
  G.restore();
}


// ---------------------------------------------------------------------
// 孔雀魚（細畫）：公母差異大
//   公魚：細長、扇形大尾鰭（依品系配色、斑點）、長背鰭、臀鰭特化成交接器
//   母魚：較大、灰色系、網狀鱗紋明顯、小圓尾；懷孕時腹部鼓起、懷孕斑變大變深
//   共同：上位口（嘴朝上）、大眼睛；魚苗半透明
// ---------------------------------------------------------------------
function guppyTailPts(e, male) {
  const base = male
    ? [P(0, -3), P(-14, -10), P(-30, -22), P(-40, -25), P(-44, -12), P(-45.5, 0), P(-44, 12), P(-40, 25), P(-30, 22), P(-14, 10), P(0, 3)]
    : [P(0, -3), P(-8, -6.5), P(-15, -8.5), P(-18.5, -4.5), P(-19.5, 0), P(-18.5, 4.5), P(-15, 8.5), P(-8, 6.5), P(0, 3)];
  // 尾鰭後緣跟不上身體：沿著尾鰭傳遞的波（次級動作）
  return base.map(p => P(p.x, p.y + Math.sin(e.phase - 1.3 + p.x * .05) * e.amp * Math.abs(p.x) * .07));
}
function drawGuppy(e) {
  const sp = SPECIES[e.type], R = fishRig(e), n = R.nodes, tb = n[FISH_N - 1], k = e.size * sp.len / 64;
  const juv = e.size < e.adult * .6, male = e.sex === 'm' && !juv, preg = e.sex === 'f' ? (e.preg || 0) : 0;
  const M = GUPPY_MORPHS[e.morph || 0];
  const bulge = i => Math.max(0, Math.sin(Math.PI * (i - 1) / 5));
  const topH = i => n[i].h * (male ? .8 : .95), botH = i => n[i].h * (male ? .8 : 1 + bulge(i) * (.12 + preg * .4));
  const T = i => P(n[i].x, n[i].y - topH(i)), B = i => P(n[i].x, n[i].y + botH(i));
  G.save(); G.tf(e.x, e.y, 0, R.sx * k, (e.dead ? -1 : 1) * k);
  if (e.dead) G.alpha(.65);
  if (juv) G.alpha(.62);                                                            // 魚苗半透明
  // 尾鰭
  G.save(); G.tf(tb.x, tb.y, R.tailRot, R.tailSx, 1);
  const tail = chaikin(guppyTailPts(e, male), true, 2);
  if (male) {
    G.save(); G.alpha(.93);
    G.poly(tail, { lin: [0, 0, -45, 0, [[0, M.tail[0]], [.5, M.tail[1]], [1, M.tail[2]]]] }, 'rgba(40,20,20,.35)', .6);
    G.restore();
    for (let r = -5; r <= 5; r++) G.line([P(-1, r * .5), P(-42 + Math.abs(r) * .6, r * 4.6)], .45, 'rgba(60,20,10,.3)');   // 鰭條
    const rnd = i => ((Math.sin(e.id * 12.9898 + i * 78.233) * 43758.5453) % 1 + 1) % 1;
    for (let i = 0; i < (M.cobra ? 16 : 7); i++) {                                       // 尾鰭斑點（每隻不同）
      const x = -10 - rnd(i) * 30, y = (rnd(i + 50) - .5) * (Math.abs(x) * .9);
      G.circle(x, y, M.cobra ? 1.2 : 1.6 + rnd(i + 9) * 1.4, M.spot);
    }
    G.line(chaikin(guppyTailPts(e, true).slice(3, 8), false, 1), 1.4, 'rgba(255,255,255,.25)');   // 尾鰭邊緣反光
  } else {
    G.save(); G.alpha(juv ? .35 : .55);
    G.poly(tail, { lin: [0, 0, -20, 0, [[0, '#c8ccc4'], [1, mixColor(M.tail[1], '#c8ccc4', .55)]]] }, 'rgba(60,60,50,.3)', .5);
    G.restore();
    for (let r = -3; r <= 3; r++) G.line([P(-1, r * .4), P(-18, r * 2.6)], .35, 'rgba(60,60,50,.25)');
  }
  G.restore();
  // 背鰭
  if (male) {
    const dp = chaikin([P(n[2].x, T(2).y + 2.8), P(n[3].x - 1, T(3).y - 7), P(n[5].x - 4, T(5).y - 11 + Math.sin(e.phase - 2) * 1.5), P(n[6].x - 9, T(6).y - 6 + Math.sin(e.phase - 2.6) * 2), P(n[5].x, T(5).y + 2.8)], true, 2);   // 鰭根埋進身體
    G.save(); G.alpha(.85); G.poly(dp, { lin: [0, -20, 0, -10, [[0, M.tail[2]], [1, M.tail[0]]]] }, 'rgba(40,20,20,.3)', .5); G.restore();
    for (let i = 0; i < 3; i++) G.circle(n[4].x - i * 4, T(4).y - 4 - i, 1, M.spot);
  } else {
    G.save(); G.alpha(.5); G.poly(chaikin([P(n[2].x, T(2).y + 1), P(n[3].x, T(3).y - 5), P(n[4].x - 2, T(4).y - 3), P(n[4].x + 1, T(4).y + 1)], true, 1), '#b8bcb0'); G.restore();
  }
  // 臀鰭：公魚是尖細的交接器；母魚是小扇形
  if (male) {
    const g0 = B(5);
    G.line([P(g0.x + 3, g0.y - .5), P(g0.x - 6, g0.y + 3.5), P(g0.x - 10, g0.y + 4.5)], 1.3, 'rgba(120,130,140,.85)');
  } else {
    G.save(); G.alpha(.5); G.poly(chaikin([P(B(5).x + 2, B(5).y - 1), P(B(6).x, B(6).y + 6), P(B(6).x - 3, B(6).y)], true, 1), '#b8bcb0'); G.restore();
  }
  G.save(); G.alpha(.45); G.poly(chaikin([P(B(3).x + 1, B(3).y - .5), P(B(3).x - 4, B(3).y + 4.5), P(B(3).x - 5, B(3).y)], true, 1), '#c8ccc4'); G.restore();   // 腹鰭
  // 身體：上位口（嘴朝上）
  const snout = P(n[0].x + 5.2, n[0].y - 2.2);
  const ol = chaikin([snout, ...n.map((q, i) => T(i)), ...n.map((q, i) => B(i)).reverse(), P(n[0].x + 4, n[0].y + 1.5)], true, 2);
  const bodyCol = male ? ['#6a8296', '#c4d2dc', '#f2f4ef'] : juv ? ['#9aa69a', '#d4dad0', '#eef0ea'] : ['#7b8476', '#c4c8bc', '#ece8dc'];
  G.poly(ol, { lin: [0, -14, 0, 16, [[0, bodyCol[0]], [.45, bodyCol[1]], [1, bodyCol[2]]]] }, 'rgba(40,50,60,.35)', .5);
  // 網狀鱗紋（reticulata 的由來）
  G.save(); G.alpha(juv ? 0 : male ? .14 : .28);
  for (let i = 1; i < 7; i++) for (const f of [-.55, -.2, .15]) {
    const c = P(n[i].x, n[i].y + topH(i) * f);
    G.line(arcPts(c.x + 1.6, c.y, 2.2, Math.PI * .6, Math.PI * 1.4, 5), .5, '#2a3438');
  }
  G.restore();
  if (male) {                                                                            // 公魚：金屬色斑與黑斑
    G.save(); G.alpha(.7);
    G.poly(fishBand(n, 3, 6, -.7, -.15).map(p => P(p.x, p.y * .82)), M.patch[0]);
    G.poly(fishBand(n, 2, 4, .05, .55).map(p => P(p.x, p.y * .82)), M.patch[1]);
    G.restore();
    for (const [i, f, r] of [[4, -.1, 1.8], [6, .1, 1.5], [3, .35, 1.2]]) G.circle(n[i].x, n[i].y + topH(i) * f, r, 'rgba(20,20,25,.7)');
    if (M.cobra) for (let i = 1; i < 7; i++) G.line([P(n[i].x + 2, n[i].y - topH(i) * .6), P(n[i].x - 1, n[i].y - topH(i) * .2), P(n[i].x + 1.5, n[i].y + topH(i) * .2)], .7, 'rgba(40,30,15,.6)');   // 眼鏡蛇紋
  } else if (!juv) {                                                                     // 母魚：懷孕斑
    const g = P(n[5].x + 2, n[5].y + botH(5) * .55);
    G.save(); G.alpha(.25 + preg * .6); G.poly(ellipsePts(g.x, g.y, 2.6 + preg * 2.4, 1.6 + preg * 1.6, -.2, 14), '#2a2018'); G.restore();
  }
  // 鰓蓋、嘴、眼
  G.line(arcPts(n[1].x + 6, n[1].y, 8.5, Math.PI * .65, Math.PI * 1.35), .9, 'rgba(40,60,80,.35)');
  G.line([P(snout.x - .2, snout.y + .2), P(snout.x - 2.6, snout.y - 1)], .7, 'rgba(30,30,30,.7)');
  const ex = n[0].x - .5, ey = n[0].y - 2.2;
  G.circle(ex, ey, juv ? 5.6 : 4.2, '#eef2f2', 'rgba(60,70,80,.5)', .4);            // 魚苗眼睛特別大
  G.circle(ex + .5, ey, juv ? 3.8 : 2.6, e.dead ? '#777' : '#111');
  if (!e.dead) G.circle(ex + 1.3, ey - .9, .8, '#fff');
  // 胸鰭（半透明，會撥動）
  G.save(); G.tf(n[2].x + 4, n[2].y + 3, R.pecRot);
  G.poly(ellipsePts(-6, 0, 7, 2.8, 0, 12), 'rgba(255,240,225,.5)');
  G.restore();
  G.restore();
}


// ---------------------------------------------------------------------
// 紅蓮燈（cardinal tetra，細畫）：細長；藍綠色金屬條紋從眼睛到脂鰭附近；
//   紅色從眼睛下方延伸到尾柄（日光燈只有後半段紅）；鰭半透明；脂鯉科有脂鰭；
//   夜裡休息時紅色變淡、條紋變暗
// ---------------------------------------------------------------------
function drawTetra(e) {
  const sp = SPECIES[e.type], lk = sp.look, R = fishRig(e), n = R.nodes, tb = n[FISH_N - 1], k = e.size * sp.len / 64;
  const juv = e.size < e.adult * .6;
  e.fadeV = lerp(e.fadeV || 0, isNight() && e.mode === 'hover' ? 1 : 0, .03);   // 夜間褪色（純視覺）
  const fade = e.fadeV;
  const red = mixColor('#ff2a3c', '#8a6a6a', fade * .65), red2 = mixColor('#d8182c', '#6a5050', fade * .65);
  const shimmer = .75 + Math.sin(e.phase * .5 + e.id) * .15 + Math.cos(e.phase * .23) * .1;   // 金屬光澤隨角度變化
  const T = i => P(n[i].x, n[i].y - n[i].h), B = i => P(n[i].x, n[i].y + n[i].h);
  G.save(); G.tf(e.x, e.y, 0, R.sx * k, (e.dead ? -1 : 1) * k);
  if (e.dead) G.alpha(.65);
  if (juv) G.alpha(.7);
  const finCol = 'rgba(225,235,240,.32)';
  // 尾鰭（叉形、半透明）
  G.save(); G.tf(tb.x, tb.y, R.tailRot, R.tailSx, 1);
  G.poly(chaikin([P(1, -2.2), P(-7, -6), P(-15, -11), P(-17.5, -10.5), P(-11, -2.5), P(-8, 0), P(-11, 2.5), P(-17.5, 10.5), P(-15, 11), P(-7, 6), P(1, 2.2)], true, 1), finCol, 'rgba(200,215,225,.35)', .4);
  G.poly([P(1, -1.1), P(-2.2, -1.2), P(-2.2, 1.2), P(1, 1.1)], red);   // 尾柄的紅色延伸到尾鰭基部
  G.restore();
  // 背鰭、脂鰭、臀鰭（長基部）、腹鰭
  G.poly(chaikin([P(n[3].x + 2, T(3).y + 1.5), P(n[4].x + 1, T(4).y - 7), P(n[4].x - 3, T(4).y - 6), P(n[5].x + 2, T(5).y + 1.5)], true, 1), finCol, 'rgba(200,215,225,.4)', .4);
  G.poly(ellipsePts(n[7].x + 1, T(7).y - .6, 2.2, 1.1, -.2, 10), 'rgba(225,235,240,.45)');   // 脂鰭
  G.poly(chaikin([P(n[4].x + 2, B(4).y - 1), P(n[5].x, B(5).y + 5), P(n[7].x + 1, B(7).y + 3), P(n[7].x - 1, B(7).y - .5)], true, 1), finCol);
  G.poly(chaikin([P(n[3].x + 1, B(3).y - 1), P(n[3].x - 3, B(3).y + 4), P(n[3].x - 4, B(3).y - .5)], true, 1), finCol);
  // 身體
  const ol = chaikin([P(n[0].x + 5, n[0].y), ...n.map((q, i) => T(i)), ...n.map((q, i) => B(i)).reverse()], true, 2);
  G.poly(ol, { lin: [0, -12, 0, 12, [[0, '#6b6a55'], [.4, '#9ea296'], [1, '#e8ecee']]] }, 'rgba(40,50,60,.3)', .4);
  // 紅色：紅蓮燈從眼睛下方延伸到尾柄（日光燈只有後半段）
  const r0 = lk.redFull ? 1 : 4;
  G.poly(fishBand(n, r0, FISH_N - 1, .08, .9), { lin: [n[r0].x, 0, tb.x, 0, [[0, red], [1, red2]]] });
  if (lk.redFull) G.poly(fishBand(n, 1, 3, .72, .97), '#e9eef0');            // 胸口一小塊銀白
  // 藍綠色金屬條紋（眼睛上方延伸到脂鰭附近）
  G.save(); G.alpha(shimmer * (1 - fade * .55));
  G.poly(fishBand(n, 0, 7, -.42, .02), { lin: [n[0].x, 0, n[7].x, 0, [[0, '#5ff0ff'], [.5, '#2ad4ff'], [1, '#2fe0c0']]] });
  G.restore();
  G.save(); G.alpha(.35 * shimmer); G.line(n.slice(0, 7).map(q => P(q.x, q.y - q.h * .3)), .6, '#ffffff'); G.restore();   // 條紋上的亮線
  // 眼（大、銀色虹膜）、鰓蓋
  G.line(arcPts(n[1].x + 5, n[1].y, 7 * lk.hScale + 1, Math.PI * .65, Math.PI * 1.35), .7, 'rgba(40,60,80,.35)');
  const ex = n[0].x - .2, ey = n[0].y - .8;
  G.circle(ex, ey, juv ? 4.6 : 3.8, '#dfe6ea', 'rgba(60,70,80,.5)', .4);
  G.circle(ex + .4, ey, juv ? 3 : 2.3, e.dead ? '#777' : '#111');
  if (!e.dead) G.circle(ex + 1.1, ey - .8, .7, '#fff');
  // 胸鰭
  G.save(); G.tf(n[2].x + 3, n[2].y + 3, R.pecRot);
  G.poly(ellipsePts(-5, 0, 6, 2.2, 0, 12), 'rgba(235,240,245,.45)');
  G.restore();
  G.restore();
}

// 畫面上很小的魚（大缸全景）改畫簡化版：外形、顏色、擺尾一樣，省掉細節
const FISH_LOD_PX = 26;                                            // 魚在螢幕上短於這個長度（像素）就用簡化版
let fishLodOn = true;
function screenScale() { const m = G.c.getTransform ? G.c.getTransform() : null; return m ? Math.hypot(m.a, m.b) : 1; }
function drawFishLOD(e) {
  const sp = SPECIES[e.type], lk = sp.look, R = fishRig(e), n = R.nodes, tb = n[FISH_N - 1], k = e.size * sp.len / 64;
  const juv = e.size < e.adult * .6, male = e.sex === 'm' && !juv;
  G.save(); G.tf(e.x, e.y, 0, R.sx * k, (e.dead ? -1 : 1) * k);
  if (e.dead) G.alpha(.65); else if (juv && lk.shape === 'guppy') G.alpha(.62);
  let tailCol = lk.tail[1], tailLen = lk.shape === 'guppy' && male ? 40 : 22, tailH = lk.shape === 'guppy' && male ? 20 : 12;
  if (lk.shape === 'guppy' && male) tailCol = GUPPY_MORPHS[e.morph || 0].tail[1];
  G.save(); G.tf(tb.x, tb.y, R.tailRot, R.tailSx, 1);
  G.poly([P(2, 0), P(-tailLen, -tailH), P(-tailLen * .8, 0), P(-tailLen, tailH)], tailCol);
  G.restore();
  const body = [P(n[0].x + 5, n[0].y + 1)];
  for (const q of n) body.push(P(q.x, q.y - q.h));
  for (let i = n.length - 1; i >= 0; i--) body.push(P(n[i].x, n[i].y + n[i].h));
  G.poly(body, e.dead ? '#9aa' : lk.body[1]);
  if (lk.shape === 'tetra') {                                      // 紅蓮燈／日光燈：藍條紋＋紅色
    G.poly(fishBand(n, lk.redFull ? 1 : 4, 7, .05, .8), '#e0322a');
    G.poly(fishBand(n, 1, 7, -.45, -.1), '#2fd0e8');
  } else if (lk.shape === 'shark') G.poly(fishBand(n, 1, 7, -.9, .9), lk.body[0]);
  G.circle(n[0].x - 1, n[0].y - 2.5 * (lk.hScale || 1), 4, '#111');
  G.restore();
}
function drawFish(e) {
  if (fishLodOn && SPECIES[e.type].len * e.size * screenScale() < FISH_LOD_PX) return drawFishLOD(e);
  const shape = (SPECIES[e.type].look || {}).shape;
  if (shape === 'shark') return drawSharkFish(e);
  if (shape === 'guppy') return drawGuppy(e);
  if (shape === 'tetra') return drawTetra(e);
  drawFishGeneric(e);
}
function drawFishGeneric(e) {
  const sp = SPECIES[e.type], lk = sp.look, R = fishRig(e), n = R.nodes, tb = n[FISH_N - 1];
  const k = e.size * sp.len / 64;
  G.save(); G.tf(e.x, e.y, 0, R.sx * k, (e.dead ? -1 : 1) * k);
  if (e.dead) G.alpha(.65);
  G.save(); G.tf(tb.x, tb.y, R.tailRot, R.tailSx, 1); G.alpha(.92);
  G.poly(FISH_TAILS[lk.tailType], { lin: [0, 0, -44, 0, [[0, lk.tail[0]], [.55, lk.tail[1]], [1, lk.tail[2]]]] });
  if (lk.tailType === 'fan') {
    for (let r = -4; r <= 4; r++) G.line([P(0, 0), P(-40, r * 5.6)], .7, 'rgba(140,30,10,.35)');
    for (const [x, y, r] of [[-22, -9, 2.6], [-30, 6, 3], [-16, 4, 2], [-34, -16, 2.2], [-28, 17, 2]]) G.circle(x, y, r, 'rgba(30,30,90,.55)');
  }
  G.restore();
  const F = fishFins(n, lk.dorsalTall);
  G.poly(F.dorsal, lk.fin); G.poly(F.anal, lk.fin);
  const ol = chaikin([P(n[0].x + 5, n[0].y + 1), ...n.map(q => P(q.x, q.y - q.h)), ...n.map(q => P(q.x, q.y + q.h)).reverse()], true, 2);
  G.poly(ol, { lin: [0, -16 * lk.hScale, 0, 16 * lk.hScale, [[0, e.dead ? '#9aa' : lk.body[0]], [.45, lk.body[1]], [1, lk.body[2]]]] }, 'rgba(40,60,80,.35)', 1);
  if (lk.spots) {
    for (const [i, f, r] of [[3, -.15, 5], [5, .25, 4], [6, -.05, 3]]) G.circle(n[i].x, n[i].y + n[i].h * f, r, 'rgba(255,120,40,.8)');
    for (const [i, f, r] of [[4, -.35, 3.5], [2, .3, 2.6]]) G.circle(n[i].x, n[i].y + n[i].h * f, r, 'rgba(60,160,230,.75)');
  }
  if (lk.belly) G.poly(fishBand(n, 3, 7, .2, .85), lk.belly);
  if (lk.stripe) G.poly(fishBand(n, 1, 6, -.32, .02), lk.stripe);
  G.line(arcPts(n[1].x + 6, n[1].y, 9 * lk.hScale + 1, Math.PI * .65, Math.PI * 1.35), 1.1, 'rgba(40,60,80,.4)');
  G.circle(n[0].x - 1, n[0].y - 2.5 * lk.hScale, 4.3, '#fff');
  G.circle(n[0].x, n[0].y - 2.5 * lk.hScale, 2.5, e.dead ? '#777' : '#111');
  G.save(); G.tf(n[2].x + 4, n[2].y + 4 * lk.hScale, R.pecRot);
  G.poly(ellipsePts(-6, 0, 7, 3, 0, 12), 'rgba(255,230,200,.6)');
  G.restore();
  G.restore();
}

// ---------------------------------------------------------------------
// 烏龜（麝香龜，側面，原點 = 腳下地面）
//   參考特徵：高圓頂背甲、5 片椎盾＋4 對肋盾＋11 對緣盾、極小的淡黃色腹甲、
//   頭側兩條淡色條紋、下巴與喉嚨的觸鬚、有蹼帶爪的腳；幼體背甲有縱稜
// ---------------------------------------------------------------------
const shellBase = x => { const u = x / 38; return x > 0 ? -10 - 3 * u * u : -10 + 1.2 * u * u; };
const shellTop = x => { const a = x + 3 > 0 ? 41 : 35, u = (x + 3) / a; return shellBase(x) - 31 * Math.pow(Math.max(0, 1 - u * u), .55); };
const shellVert = x => shellTop(x) + 6;                                     // 椎盾下緣
const shellMarg = x => shellBase(x) - Math.min(5.5, (shellBase(x) - shellTop(x)) * .45);   // 緣盾上緣
const TURTLE_GEO = (() => {
  const span = (f, x0, x1, n = 8) => Array.from({ length: n + 1 }, (_, i) => { const x = lerp(x0, x1, i / n); return P(x, f(x)); });
  const outline = [...span(shellTop, -38, 38, 30), ...span(shellBase, 38, -38, 30)];
  const vSeams = [33, 19, 6, -7, -20, -33];                                  // 椎盾分界（前→後）
  const vertebrals = [];
  for (let i = 0; i < 5; i++) vertebrals.push([...span(shellTop, vSeams[i + 1], vSeams[i], 6), ...span(shellVert, vSeams[i], vSeams[i + 1], 6)]);
  const cTop = [30, 6, -7, -20, -30], cBot = [35, 9, -6, -23, -35];         // 肋盾分界：上端接在椎盾分界上
  const costals = [];
  for (let i = 0; i < 4; i++) costals.push([...span(shellVert, cTop[i + 1], cTop[i], 6), ...span(shellMarg, cBot[i], cBot[i + 1], 6)]);
  const seams = cTop.slice(1, 4).map((t, i) => { const b = cBot[i + 1]; return chaikin([P(t, shellVert(t)), P((t + b) / 2 + 1.2, (shellVert(t) + shellMarg(b)) / 2), P(b, shellMarg(b))], false, 1); });
  const marg = Array.from({ length: 12 }, (_, i) => lerp(-37, 37, i / 11));  // 11 片緣盾
  const center = pts => P(pts.reduce((a, p) => a + p.x, 0) / pts.length, pts.reduce((a, p) => a + p.y, 0) / pts.length);
  return { outline, vertebrals, costals, seams, marg, center, vSeams, span };
})();
const inset = (pts, c, f) => pts.map(p => P(c.x + (p.x - c.x) * f, c.y + (p.y - c.y) * f));
const TURTLE_HEAD = chaikin([P(-1, -4), P(4, -5.6), P(9, -5), P(13.5, -3.4), P(16.6, -1.5), P(16.2, .5), P(13, 1.7), P(7, 3.4), P(1, 4.6), P(-1.5, 2)], true, 2);

function drawTurtleLeg(L, skin, dark, swim) {
  const wU = L.front ? 5 : 6.2, wL = L.front ? 4.2 : 4.8;
  G.line([L.hip, L.knee], wU + 1.6, dark); G.line([L.knee, L.foot], wL + 1.6, dark);
  G.line([L.hip, L.knee], wU, skin); G.line([L.knee, L.foot], wL, skin);
  if (L.front) for (let t = .25; t < 1; t += .25) {                          // 前腳的大鱗片
    const p = P(lerp(L.knee.x, L.foot.x, t), lerp(L.knee.y, L.foot.y, t));
    G.line(arcPts(p.x, p.y, 2, -2.2, -.9, 4), .6, 'rgba(30,28,20,.55)');
  }
  // 腳掌（有蹼）＋爪
  const a = L.footAng, c = Math.cos(a), s = Math.sin(a), nx = -s, ny = c, len = L.front ? 5 : 6;
  const wide = swim && L.spread ? 3.2 : 2;
  const f = L.foot, tip = P(f.x + c * len, f.y + s * len);
  G.poly([P(f.x + nx * 1.6, f.y + ny * 1.6), P(tip.x + nx * wide, tip.y + ny * wide), P(tip.x - nx * wide, tip.y - ny * wide), P(f.x - nx * 1.6, f.y - ny * 1.6)], skin, dark, .6);
  for (let i = -1.5; i <= 1.5; i += 1) {
    const b = P(tip.x + nx * wide * i / 1.6, tip.y + ny * wide * i / 1.6);
    G.line([b, P(b.x + c * 2.2 + (swim ? 0 : .4), b.y + s * 2.2 + (swim ? 0 : 1))], .7, '#262219');
  }
}
function drawTurtle(e) {
  const R = turtleRig(e), s = e.size, juv = R.juvenile;
  const skin = juv ? '#4f4d40' : '#5d5b4a', dark = '#34322a', far = '#46443a';
  const shellA = juv ? '#3a3628' : '#4a4431', shellB = juv ? '#4c4634' : '#625a41', shellC = juv ? '#5a5240' : '#7a6f4f';
  G.save(); G.tf(e.x, e.y, 0, R.sx * s, s);
  if (e.dead) G.alpha(.6);
  if (!R.swim) { G.save(); G.alpha(.2); G.poly(ellipsePts(0, .6, 34, 2.6, 0, 18), '#000'); G.restore(); }   // 接觸陰影
  G.tf(0, 0, R.pitch);
  // 遠側的腳
  R.legs.filter(l => !l.near).forEach(l => drawTurtleLeg(l, far, dark, R.swim));
  // 尾巴
  const tw = Math.sin(world.t * 2 + e.id) * .8;
  G.poly([P(-34, -12.5 - R.bob), P(-45 + R.tuck * 6, -9 + tw), P(-34, -8.5 - R.bob)], skin, dark, .6);
  // 脖子和頭（畫在殼後面，讓殼蓋住脖子根部）
  const base = P(31, -15.5 - R.bob), L = 4 + R.ext * 13;
  const joint = P(base.x + L, base.y - 1 - R.ext * 2 + Math.sin(world.t * 1.3 + e.id) * .5 * R.ext);
  const mid = P((base.x + joint.x) / 2, (base.y + joint.y) / 2 + 1.5);
  G.line([base, mid, joint], 11, dark); G.line([base, mid, joint], 9, skin);
  for (const t of [.3, .55, .8]) { const p = P(lerp(base.x, joint.x, t), lerp(base.y, joint.y, t)); G.line(arcPts(p.x - 1, p.y, 4, -1.1, 1.1, 5), .6, 'rgba(30,28,20,.5)'); }   // 頸部皺褶
  G.save(); G.tf(joint.x, joint.y, R.headPitch);
  G.poly(TURTLE_HEAD, { lin: [0, -6, 0, 5, [[0, '#4e4c3e'], [1, '#77745c']]] }, dark, .8);
  G.line([P(15.6, -2.4), P(12, -3.7), P(8, -4), P(3, -3.5), P(-1, -2.9), P(-5, -2.4)], 1.25, '#e0cd70');   // 上條紋
  G.line([P(15.4, .2), P(12, .7), P(8, 1.3), P(4, 2), P(0, 2.7), P(-5, 3.1)], 1.25, '#e0cd70');            // 下條紋
  G.line([P(16, .3), P(12, 1.2), P(7.5, 1.8)], .7, '#1e1c16');                                              // 嘴（角質喙）
  G.circle(15.5, -1.6, .35, '#1e1c16');                                                                      // 鼻孔
  G.circle(8.6, -1.6, 1.8, e.dead ? '#666' : '#2a2016', '#c9b56a', .4);
  if (!e.dead) G.circle(9.1, -2.1, .5, '#fff');
  for (const [x, y] of [[11.5, 2.3], [8.4, 3.2]]) G.poly([P(x - .6, y), P(x - .2, y + 1.7), P(x + .5, y)], '#8a8566');   // 下巴觸鬚
  G.restore();
  // 甲橋（麝香龜的腹甲很小，側面只看得到中間一小段）
  const bridge = [...TURTLE_GEO.span(x => shellBase(x) - .5, -12, 14, 6), ...TURTLE_GEO.span(x => shellBase(x) + 3.2, 14, -12, 6)];
  G.poly(bridge, '#b39a5c', dark, .6);
  // 背甲
  G.save(); G.tf(0, -R.bob);
  G.poly(TURTLE_GEO.outline, shellA, '#221f16', 1.4);
  for (const sc of TURTLE_GEO.vertebrals) {                                 // 椎盾很窄：只畫中央亮塊
    const c = TURTLE_GEO.center(sc);
    G.poly(sc, shellA, 'rgba(25,22,15,.85)', .9);
    G.poly(inset(sc, c, .6), shellB);
  }
  for (const sc of TURTLE_GEO.costals) {
    const c = TURTLE_GEO.center(sc);
    G.poly(sc, shellA, 'rgba(25,22,15,.85)', .9);
    G.poly(inset(sc, c, .78), shellB);                                       // 每片鱗甲中央較亮（盾心）
    G.poly(inset(sc, c, .45), shellC);
    for (const f of [.9, .64]) G.poly(inset(sc, c, f), null, 'rgba(25,22,15,.35)', .5);   // 生長紋
    if (!juv) for (let i = 0; i < 3; i++) {                                  // 深色放射斑紋
      const a = i * 2.1 + c.x * .3, r = 4;
      G.line([P(c.x + Math.cos(a) * 1.5, c.y + Math.sin(a) * 1.5), P(c.x + Math.cos(a) * r, c.y + Math.sin(a) * r * .7)], .7, 'rgba(25,20,12,.45)');
    }
  }
  // 緣盾
  const mBand = [...TURTLE_GEO.span(shellMarg, -37, 37, 24), ...TURTLE_GEO.span(shellBase, 37, -37, 24)];
  G.poly(mBand, { lin: [0, -16, 0, -8, [[0, shellB], [1, '#2e2a1f']]] }, 'rgba(25,22,15,.85)', .8);
  for (const x of TURTLE_GEO.marg.slice(1, -1)) G.line([P(x, shellMarg(x)), P(x + (x < 0 ? -.6 : .6), shellBase(x))], .7, 'rgba(25,22,15,.8)');
  for (const sm of TURTLE_GEO.seams) G.line(sm, .9, 'rgba(25,22,15,.9)');
  if (juv) {                                                                 // 幼體：背甲上的縱稜
    G.line(TURTLE_GEO.span(x => shellTop(x) + 1.5, -28, 28, 16), 1.6, '#2a2619');
    G.line(TURTLE_GEO.span(x => lerp(shellVert(x), shellMarg(x), .35), -26, 26, 16), 1.2, '#2a2619');
    for (let i = 0; i < 14; i++) G.circle(-26 + i * 4, lerp(shellVert(-26 + i * 4), shellMarg(-26 + i * 4), .6), .5, 'rgba(220,210,170,.35)');
  } else {                                                                   // 成體：背上一點藻類
    G.save(); G.alpha(.28);
    for (const [x, r] of [[-12, 3.5], [-2, 2.6], [8, 3], [-20, 2]]) G.poly(ellipsePts(x, shellTop(x) + 2.5, r, r * .5, 0, 10), '#6f8a3a');
    G.restore();
  }
  G.save(); G.alpha(.13);                                                   // 左上方來的光：背甲頂部高光
  G.poly([...TURTLE_GEO.span(x => shellTop(x) + .8, -16, 26, 10), ...TURTLE_GEO.span(x => shellTop(x) + 5, 26, -16, 10)], '#ffffff');
  G.restore();
  G.restore();
  // 近側的腳
  R.legs.filter(l => l.near).forEach(l => drawTurtleLeg(l, skin, dark, R.swim));
  G.restore();
}

// ---------------------------------------------------------------------
// 青蛙（東方鈴蟾，側面，原點 = 腳下地面）
//   參考特徵：身體扁平；背部鮮綠帶黑斑、佈滿尖刺疣粒；腹部紅橘帶黑斑；
//   三角形瞳孔、沒有外耳鼓膜、沒有鳴囊（吸氣發聲）；後腳有蹼、前腳無蹼；
//   受威脅時「鈴蟾反射」：背部下凹、抬起四肢露出紅色警告色
// ---------------------------------------------------------------------
const FROG_BODY = chaikin([P(-15, -7.5), P(-14, -11.5), P(-8, -13.6), P(0, -14.2), P(8, -13.6), P(11, -14.8), P(14, -14), P(19, -11.5), P(22.5, -8.5),
                           P(21.5, -6.6), P(16, -5), P(8, -3.6), P(-2, -3.2), P(-10, -4)], true, 2);
// 赤蛙類（金線蛙）：身形稍高、吻端較尖
const FROG_BODY_RANID = chaikin([P(-15, -8), P(-13, -12.5), P(-6, -15), P(2, -15.8), P(9, -15.2), P(12, -16.2), P(15, -15), P(20, -12.2), P(24.5, -8.6),
                                 P(23, -6.8), P(16, -5), P(8, -3.6), P(-2, -3.2), P(-10, -4.2)], true, 2);
const FROG_BELLY = chaikin([P(-13, -4.6), P(-2, -3.4), P(8, -3.8), P(16, -5.2), P(20, -7), P(15, -6.6), P(8, -6), P(-2, -5.8), P(-12, -7.2)], true, 1);
const FROG_BLOTCH = [[-9, -11, 3, 1.8], [-1, -12.6, 2.4, 1.3], [6, -12, 2.8, 1.5], [-5, -8.2, 2, 1.2], [2, -7.6, 1.6, 1], [13, -12.4, 1.5, .9], [-12, -8.4, 1.6, 1.1], [17, -10, 1.2, .8]]
  .map(([x, y, rx, ry], i) => chaikin(ellipsePts(x, y, rx, ry, i * .7, 8).map((p, j) => P(p.x + Math.sin(j * 2.3 + i) * .3, p.y + Math.cos(j * 1.7 + i) * .25)), true, 2));
const FROG_TUB = []; for (let x = -12; x <= 16; x += 2.6) for (const f of [.15, .5]) FROG_TUB.push(P(x + f * 3, -13.2 + f * 5 + Math.abs(x - 2) * .03 + (x > 9 ? 1 : 0)));
function lp(a, b, t) { return P(lerp(a.x, b.x, t), lerp(a.y, b.y, t)); }
function mixColor(a, b, t) {
  const pa = [1, 3, 5].map(i => parseInt(a.slice(i, i + 2), 16)), pb = [1, 3, 5].map(i => parseInt(b.slice(i, i + 2), 16));
  return '#' + pa.map((v, i) => Math.round(lerp(v, pb[i], t)).toString(16).padStart(2, '0')).join('');
}
function drawFrogHind(pts, col, dark, webbed, u, bands = true) {
  const [hip, knee, ankle, heel, toe] = pts;
  G.line([hip, knee], 6, dark); G.line([knee, ankle], 4.6, dark); G.line([ankle, heel], 3.4, dark);
  G.line([hip, knee], 4.8, col); G.line([knee, ankle], 3.5, col); G.line([ankle, heel], 2.4, col);
  if (bands !== false) for (const [a, b] of [[hip, knee], [knee, ankle]]) for (const t of [.35, .7]) {        // 腿上的黑色橫紋
    const p = lp(a, b, t), ang = Math.atan2(b.y - a.y, b.x - a.x) + Math.PI / 2;
    G.line([P(p.x - Math.cos(ang) * 1.8, p.y - Math.sin(ang) * 1.8), P(p.x + Math.cos(ang) * 1.8, p.y + Math.sin(ang) * 1.8)], 1, '#1d2a14');
  }
  // 腳掌：四根長腳趾，浮水、跳躍時蹼張開
  const a = Math.atan2(toe.y - heel.y, toe.x - heel.x), len = Math.hypot(toe.x - heel.x, toe.y - heel.y);
  const tips = [-.32, -.1, .12, .34].map(o => P(heel.x + Math.cos(a + o) * len, heel.y + Math.sin(a + o) * len));
  if (webbed) { G.save(); G.alpha(.55); G.poly([heel, ...tips], u > .3 ? '#e8572a' : col); G.restore(); }
  for (const t of tips) { G.line([heel, t], 1.1, dark); G.circle(t.x, t.y, .7, dark); }
}
function drawFrogFront(pts, col, dark) {
  const [sh, el, wr, tip] = pts;
  G.line([sh, el, wr], 4.4, dark); G.line([sh, el, wr], 3.3, col);
  const a = Math.atan2(tip.y - wr.y, tip.x - wr.x);
  for (const o of [-.5, -.15, .2, .55]) G.line([wr, P(wr.x + Math.cos(a + o) * 3.4, wr.y + Math.sin(a + o) * 3.4)], .9, dark);   // 四根手指（無蹼）
}
function drawFrog(e) {
  const R = frogRig(e), s = e.size, u = R.u, juv = R.juvenile, lk = SPECIES[e.type].look || {};
  const green = juv ? '#6f7d3c' : lk.green[0], green2 = juv ? '#8e9a52' : lk.green[1], dark = '#1f3a17';
  const orange = juv ? (lk.bellySpots ? '#e0a03a' : '#e6e0bc') : lk.belly;
  const limbBase = juv ? '#647236' : mixColor(lk.green[0], '#000000', .12), limbFarBase = juv ? '#4c5828' : mixColor(lk.green[0], '#000000', .35);
  const limb = lk.unkenColor === false ? limbBase : mixColor(limbBase, orange, u * .55), limbFar = mixColor(limbFarBase, '#b8441f', u * .55);
  G.save(); G.tf(e.x, e.y, 0, e.dir * s, s);
  if (e.dead) G.alpha(.6);
  G.tf(0, R.sink, R.tilt, 1 + (1 - R.squash) * .5, R.squash);
  if (!R.flt && e.mode !== 'jump') { G.save(); G.alpha(.18); G.poly(ellipsePts(2, .5, 20, 2, 0, 14), '#000'); G.restore(); }
  // 遠側四肢
  const off = pts => pts.map(p => P(p.x + 2.5, p.y - 1.8));
  drawFrogHind(off(R.hind), limbFar, dark, R.flt || R.jump > .5, u, lk.legBands);
  drawFrogFront(off(R.front), limbFar, dark);
  // 身體（鳴叫時身體起伏，沒有鳴囊）
  const breathe = R.croak ? 1 + Math.abs(Math.sin(world.t * 12)) * .07 : 1 + Math.sin(world.t * 2.2 + e.id) * .015;
  G.save(); G.tf(0, -4, 0, 1, breathe); G.tf(0, 4);
  const body = (lk.ranid ? FROG_BODY_RANID : FROG_BODY).map(R.warp);
  G.poly(body, { lin: [0, -15, 0, -4, [[0, green], [1, green2]]] }, dark, .8);
  const belly = FROG_BELLY.map(p => R.warp(P(p.x, p.y - (p.y < -5.5 ? u * 2.2 : 0))));            // 鈴蟾反射時腹側露出更多紅色
  G.poly(belly, orange);
  if (lk.bellySpots) for (const [x, y, r] of [[-8, -4.8, .9], [0, -4.4, .7], [6, -4.9, .8], [12, -5.8, .6], [-4, -5.6, .5]]) { const p = R.warp(P(x, y)); G.circle(p.x, p.y, r, '#1d1410'); }
  if (lk.warty) {
    for (const bl of FROG_BLOTCH) G.poly(bl.map(R.warp), '#18261a');
    for (const t of FROG_TUB) { const p = R.warp(t); G.circle(p.x, p.y, .75, 'rgba(30,70,25,.55)'); G.circle(p.x - .25, p.y - .3, .3, 'rgba(220,255,200,.5)'); }   // 尖刺疣粒
  }
  if (lk.goldBands) {                                                                                // 金線蛙：背中線＋金褐色背側褶
    for (const [x, y, r] of [[-9, -7.5, .8], [-3, -6.6, .6], [3, -7, .7], [-12, -9, .6]]) G.circle(x, y, r, 'rgba(30,40,20,.6)');
    const fold = [P(15.5, -12.8), P(9, -13.4), P(2, -13.8), P(-6, -12.8), P(-13, -10.8)];
    G.line(fold, 2.8, '#a8823a'); G.line(fold.map(p => P(p.x, p.y - .6)), .9, '#e6c86a');
    G.line([P(-13, -12.2), P(-6, -14.5), P(2, -15.1), P(9, -14.6), P(13, -14.6), P(19, -12.1)], 1.3, '#a6dc6a');
  }
  G.save(); G.alpha(lk.warty ? .45 : .6);                                                         // 濕潤的反光（光滑皮膚更亮）
  for (const [x, y, rx] of lk.warty ? [[-4, -13, 2.2], [5, -13.2, 1.6], [16, -12.4, 1.2]] : [[-6, -12.6, 3.6], [5, -14, 2.6], [17, -12.6, 1.6]]) { const p = R.warp(P(x, y)); G.poly(ellipsePts(p.x, p.y, rx, .55, -.1, 10), '#ffffff'); }
  G.restore();
  // 頭：嘴、鼻孔、眼睛（三角形瞳孔；沒有鼓膜）
  if (lk.tympanum) G.circle(7.6, -10.6, 2.3, '#b8954a', '#6a5424', .6);                         // 鼓膜（鈴蟾沒有）
  const m0 = R.warp(P(lk.ranid ? 24 : 22, -8)), m1 = R.warp(P(13, -7.4));
  G.line([m0, P((m0.x + m1.x) / 2, (m0.y + m1.y) / 2 + .4), m1], .8, dark);
  const n = R.warp(P(20.4, -10.3)); G.circle(n.x, n.y, .4, dark);
  const ec = R.warp(P(lk.ranid ? 13 : 12.2, lk.ranid ? -15.2 : -14.2));
  G.circle(ec.x, ec.y, 3.5, green, dark, .7);
  G.circle(ec.x + .3, ec.y - .3, 2.4, '#b8913a', '#4a3a14', .4);
  if (!e.dead) {
    if (lk.pupil === 'h') G.poly(ellipsePts(ec.x + .3, ec.y - .3, 1.5, .75, 0, 12), '#0e0e0a');     // 橫的瞳孔
    else G.poly([P(ec.x - .9, ec.y - 1.1), P(ec.x + 1.5, ec.y - 1.1), P(ec.x + .3, ec.y + .8)], '#0e0e0a');   // 三角形瞳孔
    G.circle(ec.x + 1, ec.y - 1.3, .45, '#fff');
  } else G.line([P(ec.x - 2, ec.y), P(ec.x + 2, ec.y)], .8, '#333');
  G.restore();
  // 近側四肢
  drawFrogHind(R.hind, limb, dark, R.flt || R.jump > .5, u, lk.legBands);
  drawFrogFront(R.front, limb, dark);
  G.restore();
  if (e.tongue) {                                              // 舌頭用世界座標畫
    const tg = e.tongue, m = frogMouth(e);
    const ext = tg.t < .1 ? tg.t / .1 : Math.max(0, 1 - (tg.t - .1) / .2);
    const tip = P(lerp(m.x, tg.tx, ext), lerp(m.y, tg.ty, ext));
    G.line([m, tip], 3, '#e0607e'); G.circle(tip.x, tip.y, 3.2, '#e0607e');
    if (tg.caught && ext > .05) drawMosquitoAt(tip.x, tip.y, e.dir, 0, 1);
  }
}

// ---------------------------------------------------------------------
// 壁虎（疣尾蝎虎，細畫）
//   參考特徵：灰褐到米色、腹部白；白天體色較深、夜裡較淡；眼睛到鼻孔有深色條紋（frenatus＝戴韁繩）；
//   大眼睛、直立瞳孔（夜裡放大）、沒有眼瞼（會舔眼睛）；耳孔；尾巴有一圈圈刺狀疣鱗（再生尾沒有）；
//   腳趾末端膨大的趾下瓣＋小爪
// ---------------------------------------------------------------------
function geckoColors(e) {
  const L = daylight(), juv = e.size < e.adult * .6;
  const base = mixColor('#ece0c8', '#a68e6a', L), dark = mixColor('#b9a585', '#6e5a40', L), belly = mixColor('#f7f1e4', '#e6dcc8', L);
  return { base: juv ? mixColor(base, '#8a7a60', .25) : base, dark, belly, edge: mixColor('#9a8462', '#5a4630', L), pupil: lerp(1.6, .55, L) };
}
function drawGecko(e) { if (e.surface === 'glass') drawGeckoTop(e); else drawGeckoSide(e); }
function sideOutline(nodes) {
  const top = [], bot = [];
  nodes.forEach((p, i) => {
    const a = nodes[Math.max(0, i - 1)], b = nodes[Math.min(nodes.length - 1, i + 1)];
    let tx = b.x - a.x, ty = b.y - a.y; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
    top.push(P(p.x - ty * p.t, p.y + tx * p.t)); bot.push(P(p.x + ty * p.t, p.y - tx * p.t));
  });
  return [P(nodes[0].x + 2, nodes[0].y + .5), ...top, ...bot.reverse()];
}
// 腳趾：末端膨大的趾下瓣＋小爪（5 趾）
function toes(foot, ang, lift, col, edge, s = 1) {
  const curl = lift > 1 ? .4 : 0;
  for (const k of [-2, -1, 0, 1, 2]) {
    const a = ang + k * .38, len = (4.6 - curl * 2) * s, tip = P(foot.x + Math.cos(a) * len, foot.y + Math.sin(a) * len);
    G.line([foot, tip], 1 * s, col);
    G.poly(ellipsePts(tip.x, tip.y, 1.5 * s, 1 * s, a, 8), col, edge, .4);
    G.line([tip, P(tip.x + Math.cos(a) * .9 * s, tip.y + Math.sin(a) * .9 * s)], .4, '#3a2e22');
  }
}
function drawGeckoSide(e) {
  const R = geckoSideRig(e), n = R.nodes, s = e.size, C = geckoColors(e);
  const tl = e.tailLen ?? 1, origFrac = e.regrown ? Math.min(1, .25 / tl) : 1;           // 原本的尾巴佔多少（其餘是再生的）
  G.save(); G.tf(e.x, e.y, 0, R.sx * s, s);
  if (e.dead) G.alpha(.6);
  G.save(); G.alpha(.18); G.poly(ellipsePts(10, 1, 48 * (.6 + .4 * tl), 3, 0, 16), '#000'); G.restore();
  const legDraw = (l, col, edge) => {
    G.line([l.hip, l.knee, l.foot], 4.4, edge); G.line([l.hip, l.knee, l.foot], 3, col);
    for (const kx of [-2, -1, 0, 1, 2]) {                     // 側面：腳趾沿地面張開、趾下瓣
      const tx = l.foot.x + kx * 2.3, ty = Math.min(l.foot.y + .5, 0);
      G.line([l.foot, P(tx, ty)], 1, col); G.poly(ellipsePts(tx, ty - .2, 1.3, .8, 0, 8), col, edge, .4);
    }
  };
  R.legs.filter(l => !l.near).forEach(l => legDraw(l, C.dark, C.edge));
  const ol = chaikin(sideOutline(n), true, 2);
  G.poly(ol, { lin: [0, -20, 0, 0, [[0, C.dark], [.45, C.base], [1, C.belly]]] }, C.edge, .9);
  // 深色斑駁
  G.save(); G.alpha(.35);
  for (const [i, f, r] of [[2, .4, 2.6], [3, .2, 2.2], [4, .45, 2.8], [5, .25, 2], [3, .6, 1.4]]) G.poly(ellipsePts(lerp(n[i].x, n[i + 1].x, f), n[i].y - n[i].t * .5, r, r * .55, 0, 10), C.edge);
  G.restore();
  // 背上的小疣粒
  for (let i = 2; i <= 5; i++) for (const t of [.3, .7]) G.circle(lerp(n[i].x, n[i + 1].x, t), lerp(n[i].y, n[i + 1].y, t) - lerp(n[i].t, n[i + 1].t, t) * .62, .9, mixColor(C.edge, '#000000', .1));
  // 尾巴：一圈圈刺狀疣鱗（再生的部分沒有，顏色也比較素）
  for (let i = 6; i <= 9; i++) {
    const frac = (i - 5) / 5, p = n[i], up = p.y - p.t;
    if (frac <= origFrac + .01) {
      G.poly([P(p.x + 1.2, up + .3), P(p.x - 1.4, up - 1.7), P(p.x - 2, up + .4)], C.edge);
      G.poly([P(p.x + 1, p.y + p.t * .6), P(p.x - 1, p.y + p.t + 1.1), P(p.x - 1.6, p.y + p.t * .6)], C.edge);
      G.line([P(p.x, p.y - p.t * .9), P(p.x + 1, p.y + p.t * .6)], 1, 'rgba(90,70,45,.35)');
    } else { G.save(); G.alpha(.25); G.circle(p.x, p.y, p.t * .9, '#d6c8a8'); G.restore(); }
  }
  // 頭
  const h0 = n[0], h1 = n[1], ex = h1.x + 2, ey = h1.y - 2.5;
  G.line([P(ex + 2.6, ey + .3), P(h0.x + .8, h0.y - 1.2)], 1.3, mixColor(C.edge, '#000000', .25));   // 眼睛到鼻孔的深色條紋
  G.circle(h1.x - 4.5, h1.y - .5, .9, '#2a2016');                                                     // 耳孔
  G.circle(h0.x + 1, h0.y - 1.4, .35, '#2a2016');                                                     // 鼻孔
  if (R.mouth) {
    G.poly([P(h0.x + 2, h0.y + .5), P(h1.x - 2, h1.y + 3), P(h0.x - 1, h0.y + 7)], '#9b3d43');
    G.line([P(h1.x - 2, h1.y + 3), P(h0.x - 1, h0.y + 7)], 1, C.edge);
  } else G.line([P(h0.x + 1.5, h0.y + 1), P(h1.x + 2, h1.y + 3), P(h1.x - 3, h1.y + 2.5)], .9, C.edge);
  G.circle(ex, ey, 3.5, '#b8a27a', C.edge, .7);                                                       // 大眼睛（沒有眼瞼）
  G.poly(ellipsePts(ex, ey, C.pupil * .7, 2.8, 0, 12), '#140e06');                                     // 直立瞳孔：夜裡放大
  if (!e.dead) G.circle(ex + 1.1, ey - 1.2, .55, '#fff');
  if (e.lickT > 0) {                                                                                  // 舔眼睛
    const k = Math.sin(Math.min(1, (.7 - e.lickT) / .7) * Math.PI);
    G.line([P(h0.x + 1, h0.y + 1.5), P(lerp(h0.x + 1, ex + 2.5, k), lerp(h0.y + 1.5, ey + .5, k))], 1.6, '#e07a8a');
  }
  R.legs.filter(l => l.near).forEach(l => legDraw(l, C.base, C.edge));
  G.restore();
}
const GK_TOP_W = [5, 5.5, 5, 6, 7, 7.5, 7.5, 6.5, 5, 4, 3, 2.2, 1.4, .7];
function drawGeckoTop(e) {
  const c0 = e.chain, s = e.size, C = geckoColors(e);
  if (!c0) return;
  const tl = e.tailLen ?? 1, nVis = 7 + Math.max(1, Math.round(7 * tl)), c = c0.slice(0, nVis);
  const origN = e.regrown ? 7 + Math.round(7 * .25) : 99;                                   // 再生前的尾巴節數
  G.save();
  if (e.dead) G.alpha(.6);
  // 腳（俯視）
  if (e.feet) e.feet.forEach((f, i) => {
    const L = GLASS_LEGS[i], j = c0[L.j], a = chainAngle(c0, L.j), sa = a + L.side * Math.PI / 2;
    const hip = P(j.x + Math.cos(sa) * 4 * s, j.y + Math.sin(sa) * 4 * s);
    const r = ik2(hip, f, 8 * s, 9 * s, (k1, k2) => {
      const out = p => (p.x - j.x) * Math.cos(sa) + (p.y - j.y) * Math.sin(sa);
      return out(k1) > out(k2) ? k1 : k2;                     // 膝蓋朝外
    });
    G.line([hip, r.knee, r.foot], 4.2 * s, C.edge); G.line([hip, r.knee, r.foot], 2.9 * s, C.base);
    toes(r.foot, Math.atan2(r.foot.y - r.knee.y, r.foot.x - r.knee.x), f.t < 1 ? 2 : 0, C.base, C.edge, s);
  });
  // 身體
  const left = [], right = [], wAt = i => GK_TOP_W[i] * s * (i >= nVis - 2 ? .7 : 1);
  c.forEach((p, i) => {
    const a = chainAngle(c0, i), w = wAt(i);
    left.push(P(p.x + Math.cos(a - Math.PI / 2) * w, p.y + Math.sin(a - Math.PI / 2) * w));
    right.push(P(p.x + Math.cos(a + Math.PI / 2) * w, p.y + Math.sin(a + Math.PI / 2) * w));
  });
  const a0 = e.ang, tip = c[c.length - 1], tipA = chainAngle(c0, c.length - 1);
  const snout = P(c[0].x + Math.cos(a0) * 10 * s, c[0].y + Math.sin(a0) * 10 * s), tailTip = P(tip.x - Math.cos(tipA) * 4 * s, tip.y - Math.sin(tipA) * 4 * s);
  G.poly(chaikin([snout, ...right, tailTip, ...left.reverse()], true, 2), C.base, C.edge, .9);
  // 背部斑紋：深色波浪橫帶＋兩排疣粒
  G.save(); G.alpha(.4);
  for (let i = 3; i < Math.min(10, nVis); i += 2) {
    const a = chainAngle(c0, i), w = wAt(i) * .75;
    G.line(chaikin([P(c[i].x + Math.cos(a - Math.PI / 2) * w, c[i].y + Math.sin(a - Math.PI / 2) * w), P(c[i].x - Math.cos(a) * 1.5 * s, c[i].y - Math.sin(a) * 1.5 * s), P(c[i].x + Math.cos(a + Math.PI / 2) * w, c[i].y + Math.sin(a + Math.PI / 2) * w)], false, 1), 1.3 * s, C.edge);
  }
  G.restore();
  for (let i = 3; i < Math.min(8, nVis); i++) for (const sd of [-1, 1]) { const a = chainAngle(c0, i) + sd * Math.PI / 2, w = wAt(i) * .45; G.circle(c[i].x + Math.cos(a) * w, c[i].y + Math.sin(a) * w, .8 * s, mixColor(C.edge, '#000000', .1)); }
  // 尾巴兩側的刺狀疣鱗（再生的部分沒有）
  for (let i = 7; i < nVis - 1; i++) {
    if (i >= origN) continue;
    const a = chainAngle(c0, i), w = wAt(i);
    for (const sd of [-1, 1]) {
      const sa = a + sd * Math.PI / 2, b = P(c[i].x + Math.cos(sa) * w, c[i].y + Math.sin(sa) * w);
      G.poly([P(b.x + Math.cos(a) * 1.2 * s, b.y + Math.sin(a) * 1.2 * s), P(b.x + Math.cos(sa) * 1.6 * s - Math.cos(a) * 1 * s, b.y + Math.sin(sa) * 1.6 * s - Math.sin(a) * 1 * s), P(b.x - Math.cos(a) * 1.4 * s, b.y - Math.sin(a) * 1.4 * s)], C.edge);
    }
  }
  // 頭：眼睛凸在兩側、眼鼻之間的深色條紋
  for (const sd of [-1, 1]) {
    const ea = a0 + sd * 1.1, epos = P(c[0].x + Math.cos(ea) * 4.6 * s, c[0].y + Math.sin(ea) * 4.6 * s);
    G.line([epos, P(snout.x + Math.cos(a0 + sd * 1.6) * 1.6 * s, snout.y + Math.sin(a0 + sd * 1.6) * 1.6 * s)], 1.1 * s, mixColor(C.edge, '#000000', .25));
    G.circle(epos.x, epos.y, 2.5 * s, '#b8a27a', C.edge, .7);
    G.poly(ellipsePts(epos.x, epos.y, C.pupil * .45 * s, 1.9 * s, a0, 10), '#140e06');
  }
  if (e.mouth) G.circle(snout.x, snout.y, 2.5 * s, '#9b3d43');
  G.restore();
}
// 斷掉的尾巴：在原地扭動，慢慢停下來、淡出
function drawTailBits() {
  for (const b of world.tailBits) {
    const wig = Math.max(0, 1 - b.t / 7), pts = [];
    for (let i = 0; i <= 8; i++) {
      const f = i / 8, a = b.ang + Math.sin(b.t * 14 * wig + b.seed - f * 4) * .6 * wig * f;
      pts.push(P(b.x + Math.cos(b.ang) * b.len * f + Math.cos(a + Math.PI / 2) * Math.sin(b.t * 12 + f * 5) * 4 * wig,
                 b.y + Math.sin(b.ang) * b.len * f + Math.sin(a + Math.PI / 2) * Math.sin(b.t * 12 + f * 5) * 4 * wig));
    }
    G.save(); G.alpha(Math.min(1, (9 - b.t) / 2));
    for (let i = 0; i < 8; i++) G.line([pts[i], pts[i + 1]], 5 - i * .5, '#b8a27a');
    G.restore();
  }
}

// ---------------------------------------------------------------------
// 蚊子、飼料
// ---------------------------------------------------------------------
function drawMosquitoAt(x, y, dir, phase, sc = 1) {
  G.save(); G.tf(x, y, 0, dir * sc, sc);
  for (const [a, b] of [[-5, -10], [0, -4], [3, 7]]) G.line([P(a, 1), P(b, 11)], .7, '#333');
  const flap = Math.abs(Math.sin(phase * 60));
  G.save(); G.alpha(.55); G.poly(ellipsePts(-2, -4 - 4 * flap, 2.6, 6 * flap + 1.5, -.3, 10), '#cfe7ff'); G.restore();
  G.line([P(-11, 2.5), P(0, 0)], 2.6, '#333');
  G.circle(3, -.5, 2.4, '#333'); G.circle(5.5, 0, 1.3, '#333');
  G.line([P(6.5, .5), P(11, 3)], .7, '#333');
  G.restore();
}
function drawMosquito(e) { drawMosquitoAt(e.x, e.y, e.dir, e.phase + e.id, e.dead ? .9 : 1); }
// 孑孓：頭朝下倒吊，尾端的呼吸管貼著水面；蛹：逗號形
function drawLarva(e) {
  const s = e.size;
  G.save(); G.tf(e.x, e.y, 0, s, s);
  if (e.dead) G.alpha(.5);
  if (e.stage === 'egg') {
    G.poly(ellipsePts(0, 0, 7, 2.6, 0, 14), '#3b3226');
    for (let i = -2; i <= 2; i++) G.circle(i * 2.6, -.6, 1.1, '#5a4a36');
  } else if (e.stage === 'pupa') {
    const tumble = e.dive > 0 ? e.phase : 0;
    G.tf(0, 2, tumble);
    G.poly(chaikin([P(-4, -4), P(4, -5), P(6, 1), P(2, 6), P(-1, 9), P(-2, 5), P(-5, 1)], true, 2), '#4a3b2a');
    G.line([P(-2, -4), P(-3, -7)], 1, '#4a3b2a'); G.line([P(2, -4), P(3, -7)], 1, '#4a3b2a');   // 呼吸角
    G.line([P(-1, 9), P(-3, 12), P(1, 12)], 1.4, '#4a3b2a');
  } else {
    const pts = [P(0, -7)];
    for (let i = 1; i <= 6; i++) pts.push(P(Math.sin(e.phase - i * .7) * (e.dive > 0 ? 3 : 1.2) * (i / 6), -7 + i * 2.6));
    G.line([P(0, -7), P(0, -10)], 1.1, '#4a3b2a');               // 呼吸管
    G.line(pts.slice(0, 4), 2.6, '#5a4a36');
    G.line(pts.slice(3), 3.6, '#5a4a36');                         // 胸部較寬
    G.circle(pts[6].x, pts[6].y + 1.6, 2.2, '#3b3226');
  }
  G.restore();
}
function drawFx() {
  for (const f of world.fx) {
    G.save(); G.alpha(clamp(1.2 - f.t, 0, 1));
    G.text(f.text, f.x, f.y - 10, 14, 'rgba(0,0,0,.45)'); G.text(f.text, f.x - 1, f.y - 11, 14, f.color);
    G.restore();
  }
}
function drawFood(f) { G.circle(f.x, f.y, 2.6, '#8a5a2b'); G.circle(f.x - .8, f.y - .8, 1, '#c08a4f'); }


// ---------------------------------------------------------------------
// 蝌蚪（依變態進度長出後腳、前腳）
// ---------------------------------------------------------------------
function drawTadpole(e) {
  const s = e.size, m = e.meta || 0;
  G.save(); G.tf(e.x, e.y, 0, e.dir * s, s);
  if (e.dead) G.alpha(.5);
  const tail = [];
  for (let i = 0; i <= 6; i++) tail.push(P(-4 - i * 3.2, Math.sin(e.phase - i * .8) * i * .7));
  const tailLen = 1 - Math.max(0, m - .85) * 4;               // 快變成青蛙時尾巴縮短
  const tl = tail.slice(0, Math.max(2, Math.round(7 * tailLen)));
  G.save(); G.alpha(.55);
  G.poly(chaikin([...tl.map(p => P(p.x, p.y - 2.6 + Math.abs(p.x) * .03)), ...tl.slice().reverse().map(p => P(p.x, p.y + 2.6 - Math.abs(p.x) * .03))], true, 1), '#8a9a6a');
  G.restore();
  G.line(tl, 1.4, '#3d4a2c');
  if (m > .6) {                                                // 後腳
    const k = Math.min(1, (m - .6) / .3);
    G.line([P(-4, 2.5), P(-7, 5 * k + 2), P(-4, 6 * k + 2)], 1.3, '#4a5a34');
  }
  if (m > .9) G.line([P(3, 3), P(5, 5.5)], 1.2, '#4a5a34');    // 前腳
  G.poly(ellipsePts(0, 0, 6.5, 4.6, 0, 16), { lin: [0, -5, 0, 5, [[0, m > .8 ? '#4f8f3a' : '#3a3a2a'], [1, m > .8 ? '#9ac46a' : '#6a6650']]] });
  G.circle(3.6, -1.4, 1.3, '#111');
  G.restore();
}

// ---------------------------------------------------------------------
// 卵：青蛙卵（水中的果凍團）、烏龜蛋、壁虎蛋（陸地上）
// ---------------------------------------------------------------------
function drawNest(e) {
  G.save(); G.tf(e.x, e.y, 0, 1, 1);
  if (e.dead) G.alpha(.4);
  const n = Math.max(1, e.count);
  if (e.medium === 'water') {
    for (let i = 0; i < n; i++) {
      const a = i * 2.4, r = 3 + Math.sqrt(i) * 4.2, x = Math.cos(a) * r, y = Math.sin(a) * r * .7;
      G.save(); G.alpha(.5); G.circle(x, y, 4.2, '#d8ecd8'); G.restore();
      G.circle(x, y, 1.6, '#1d2414');
    }
  } else {
    const big = e.of === 'turtle', rx = big ? 6.5 : 3.6, ry = big ? 5 : 3;
    for (let i = 0; i < n; i++) G.poly(ellipsePts((i - (n - 1) / 2) * rx * 1.8, -ry * .6, rx, ry, 0, 14), '#f4efe2', '#b8ad94', 1);
  }
  G.restore();
}

// ---------------------------------------------------------------------
// 迷你藍鯨（局部座標身長 100，頭在 +50）
// ---------------------------------------------------------------------
function drawWhale(e) {
  const R = whaleRig(e), n = R.nodes, k = whaleL(e) / 100, tb = n[n.length - 1];
  G.save(); G.tf(e.x, e.y, 0, R.sx * k, k);
  if (e.dead) G.alpha(.6);
  // 尾鰭（水平的，側面看是一片薄薄的）
  G.save(); G.tf(tb.x, tb.y, R.flukeRot);
  G.poly(chaikin([P(0, -.8), P(5, -1.6), P(10, -1.2), P(12, 0), P(10, 1.2), P(5, 1.6), P(0, .8)], true, 1), '#3f5f7d');
  G.restore();
  // 胸鰭（遠側）
  G.save(); G.tf(n[3].x, n[3].y + n[3].h * .5, .55 + Math.sin(e.phase * .5) * .08);
  G.poly(chaikin([P(0, -1), P(-14, 1.5), P(-15, 3), P(-2, 1.5)], true, 1), '#36536f');
  G.restore();
  // 身體：頭頂比較平
  const top = n.map((q, i) => P(q.x, q.y - q.h * (i < 3 ? .8 : 1))), bot = n.map(q => P(q.x, q.y + q.h));
  const ol = chaikin([P(n[0].x + 3, n[0].y + .5), ...top, P(tb.x - 1, tb.y), ...bot.reverse()], true, 2);
  G.poly(ol, { lin: [0, -10, 0, 10, [[0, '#3e5f80'], [.5, '#6f90ad'], [1, '#c3d3df']]] }, 'rgba(30,50,70,.4)', .3);
  // 斑紋
  for (let i = 0; i < 18; i++) {
    const q = n[1 + (i * 7) % 10], f = ((i * 37) % 10) / 10 - .6;
    G.save(); G.alpha(.22); G.circle(q.x + (i % 3) * 2, q.y + q.h * f, .7 + (i % 3) * .3, '#d8e4ee'); G.restore();
  }
  // 喉腹摺
  for (let j = 0; j < 4; j++) {
    const pts = [];
    for (let i = 0; i <= 5; i++) { const q = n[i]; pts.push(P(q.x, q.y + q.h * (.92 - j * .14))); }
    G.line(pts, .25, 'rgba(60,80,100,.5)');
  }
  // 背鰭（很小，靠近尾巴）
  const d = n[9]; G.poly([P(d.x + 2, d.y - d.h + .2), P(d.x - 1.5, d.y - d.h - 1.6), P(d.x - 2.5, d.y - d.h + .3)], '#3e5f80');
  // 嘴、眼、噴氣孔
  G.line(chaikin([P(n[0].x + 3, n[0].y + .8), P(n[1].x, n[1].y + 2), P(n[1].x - 4, n[1].y + 2.6)], false, 1), .35, 'rgba(20,30,45,.7)');
  G.circle(n[1].x - 4.6, n[1].y + 1.2, .6, '#0e1620');
  G.poly(ellipsePts(n[1].x - 2, n[1].y - n[1].h * .8 - .1, 1.2, .35, 0, 8), '#2a4058');
  // 胸鰭（近側）
  G.save(); G.tf(n[3].x + 1, n[3].y + n[3].h * .55, .45 + Math.sin(e.phase * .5 + 1) * .08);
  G.poly(chaikin([P(0, -1), P(-15, 1.5), P(-16, 3), P(-2, 1.6)], true, 1), '#5a7a98', 'rgba(30,50,70,.4)', .25);
  G.restore();
  G.restore();
  // 噴水柱（世界座標）
  if (e.wmode === 'spout' && e.spoutT !== undefined) {
    const bh = P(e.x + R.sx * k * (n[1].x - 2), e.y + k * (n[1].y - n[1].h * .8)), H0 = k * 14;
    const fade = Math.min(1, e.spoutT * 3) * Math.min(1, (2.4 - e.spoutT) * 2);
    for (let i = 0; i < 26; i++) {
      const t = ((e.spoutT * .9 + i / 26) % 1);
      const x = bh.x + Math.sin(i * 1.7) * t * k * 3.2, y = bh.y - t * H0 + t * t * H0 * .25;
      G.save(); G.alpha(fade * (1 - t) * .7); G.circle(x, y, k * (.5 + t * 1.6), '#ffffff'); G.restore();
    }
  }
}


// ---------------------------------------------------------------------
// 活餌：蟋蟀（側面，原點 = 腳下地面）、果蠅
// ---------------------------------------------------------------------
function drawCricket(e) {
  const s = e.size * 1.2, air = e.mode === 'hop' || e.mode === 'fall', swim = e.mode === 'swim';
  G.save(); G.tf(e.x, e.y, 0, e.dir * s, s);
  if (e.dead) G.alpha(.5);
  if (swim) G.tf(0, 2, Math.sin(e.phase) * .15);
  const leg = '#5a3b1e';
  // 後腳（跳躍用的大腿）：空中時伸直
  const knee = air ? P(-12, -6) : P(-8, -10), foot = air ? P(-18, 1) : P(-13, 0);
  G.line([P(-2, -4), knee, foot], 1.6, leg);
  G.line([P(3, -3), P(5, 0)], 1, leg); G.line([P(6, -3), P(9, 0)], 1, leg);
  G.poly(ellipsePts(-4, -4, 7.5, 3.4, -.08, 14), '#6b4423');
  G.poly(ellipsePts(4, -4.6, 3.6, 3, 0, 12), '#4f311a');
  G.circle(8.2, -4.4, 2.6, '#3e2614');
  G.line([P(-11, -4), P(-15, -6)], .8, leg); G.line([P(-11, -3.5), P(-15, -2.5)], .8, leg);   // 尾毛
  const tw = Math.sin(e.phase * .6) * 1.5;
  G.line([P(9.5, -5.5), P(14, -10 + tw), P(19, -9 + tw)], .6, '#3e2614');                   // 觸角
  G.line([P(9.5, -5), P(15, -8 - tw), P(20, -5 - tw)], .6, '#3e2614');
  G.restore();
}
function drawFly(e) {
  G.save(); G.tf(e.x, e.y, 0, e.dir, 1);
  if (e.dead) G.alpha(.5);
  const flap = Math.abs(Math.sin((e.phase + e.id) * 70));
  G.save(); G.alpha(.5); G.poly(ellipsePts(-1, -2 - 2 * flap, 1.6, 3 * flap + .8, -.3, 8), '#e8f2ff'); G.restore();
  G.poly(ellipsePts(-1, 0, 2.6, 1.4, 0, 8), '#b08a4a');
  G.circle(1.8, -.2, 1.1, '#c0392b');
  G.restore();
}


// ---------------------------------------------------------------------
// 水質相關的外觀：過濾器、浮萍、斑馬螺、藻類、水色
// ---------------------------------------------------------------------
function drawFilter(d) {
  const wy = world.waterY, x0 = d.x - d.w / 2, y0 = Math.min(wy - 24, d.y - d.h / 2);
  G.rect(x0 + 4, y0 - 8, d.w - 8, 10, '#2c3236');                                       // 掛勾
  G.poly([P(x0, y0), P(x0 + d.w, y0), P(x0 + d.w, y0 + d.h), P(x0, y0 + d.h)], { lin: [x0, 0, x0 + d.w, 0, [[0, '#3c4448'], [.5, '#59646a'], [1, '#353c40']]] }, '#22282b', 1);
  for (let i = 0; i < 5; i++) G.line([P(x0 + 8, y0 + 20 + i * 9), P(x0 + d.w - 8, y0 + 20 + i * 9)], 1.4, 'rgba(20,24,26,.6)');   // 進水格柵
  G.line([P(d.x, y0 + d.h), P(d.x, y0 + d.h + 70)], 6, '#3c4448');                     // 進水管
  G.rect(d.x - 6, y0 + d.h + 70, 12, 16, '#2c3236');
  if (wy < TANK.floor - 10) for (let i = 0; i < 6; i++) {                                 // 出水口的細泡
    const t = (world.t * 1.6 + i / 6) % 1;
    G.save(); G.alpha(.6 * (1 - t)); G.circle(x0 - 6 - t * 18, wy + 6 + t * 26 + Math.sin(i * 3 + world.t * 5) * 2, 1.4 + t * 1.2, '#f2fbff'); G.restore();
  }
}
function drawFloater(d) {
  const wy = world.waterY, r = rng(d.seed);
  if (wy >= TANK.floor - 4) return;
  const n = Math.round(d.w / 16);
  for (let i = 0; i < n; i++) {                                                            // 垂在水裡的根
    const x = d.x - d.w / 2 + r() * d.w, len = 10 + r() * 22, sw = Math.sin(world.t * 1.2 + i) * 3;
    G.line([P(x, wy + 2), P(x + sw * .5, wy + len * .5), P(x + sw, wy + len)], .8, 'rgba(230,240,220,.55)');
  }
  const r2 = rng(d.seed + 1);
  for (let i = 0; i < n * 1.6; i++) {
    const x = d.x - d.w / 2 + r2() * d.w, rr = 4 + r2() * 4, bob = Math.sin(world.t * 1.5 + x * .05) * .8;
    G.poly(ellipsePts(x, wy + bob, rr, rr * .38, 0, 12), r2() < .5 ? '#5aa83c' : '#6fbf4a', '#3a7a2a', .5);
    G.circle(x - rr * .3, wy + bob - .5, rr * .25, 'rgba(220,255,200,.5)');
  }
}
function rng(seed) { let s = Math.floor(seed * 9973) % 2147483647 || 7; return () => (s = s * 16807 % 2147483647) / 2147483647; }
// 斑馬螺（側面）：金黃色螺殼帶黑色條紋、灰色肉足、兩根觸角
function drawSnail(e) {
  const s = e.size;
  G.save(); G.tf(e.x, e.y, 0, e.dir * s, s);
  if (e.dead) G.alpha(.5);
  const und = Math.sin(e.phase * 3) * .8;
  G.poly(chaikin([P(-11, 0), P(-12, -2.5), P(4, -3.5), P(12 + und, -2.5), P(14 + und, 0)], true, 2), '#8a8578', '#5e5a50', .6);   // 肉足
  G.line([P(11 + und, -2.5), P(16 + und, -7)], .9, '#6e6a60'); G.line([P(10 + und, -2.5), P(13.5 + und, -8)], .9, '#6e6a60');   // 觸角
  G.circle(11.5 + und, -3.2, .7, '#111');
  const shell = ellipsePts(-1, -8, 11, 8, -.15, 24);
  G.poly(shell, { lin: [0, -16, 0, 0, [[0, '#e8c45a'], [1, '#b08a2a']]] }, '#4a3a14', .8);
  for (let i = -3; i <= 3; i++) G.line(chaikin([P(-1 + i * 3, -15.5 + Math.abs(i) * .8), P(-3 + i * 3.4, -8), P(-1.5 + i * 3, -1)], false, 1), 1.4, 'rgba(30,22,10,.85)');   // 斑馬紋
  G.line(arcPts(-4, -9, 3.5, 0, Math.PI * 1.6, 8), .8, 'rgba(60,40,10,.6)');                // 螺旋
  G.circle(3, -12, 1.6, 'rgba(255,255,230,.5)');
  G.restore();
}
// 背面玻璃上的藻斑（依魚缸大小產生一次）
function makeAlgaeSpots() {
  const r = rng(W * 7 + H), out = [];
  for (let i = 0; i < Math.round(W / 22); i++) {                // 小而不規則的藻斑
    const pts = []; const n = 7, rx = 6 + r() * 20, ry = 4 + r() * 12;
    for (let j = 0; j < n; j++) { const a = j / n * Math.PI * 2, k = .6 + r() * .6; pts.push(P(Math.cos(a) * rx * k, Math.sin(a) * ry * k)); }
    out.push({ fx: r(), fy: r(), pts: chaikin(pts, true, 2), k: r() });
  }
  return out;
}
let ALGAE_SPOTS = makeAlgaeSpots();
function drawGlassAlgae() {
  const a = world.water.algae / 100, wy = world.waterY;
  if (a < .02 || wy >= TANK.floor) return;
  G.save();
  for (const sp of ALGAE_SPOTS) {
    if (sp.k > a * 1.6) continue;                                                           // 藻越多，斑點越多
    const x = TANK.left + sp.fx * (TANK.right - TANK.left), y = wy + 10 + sp.fy * (TANK.floor - wy - 20);
    const sc = .6 + a * .8;
    G.save(); G.alpha(Math.min(.42, a * .7)); G.poly(sp.pts.map(p => P(x + p.x * sc, y + p.y * sc)), '#566f35'); G.restore();
  }
  G.restore();
}
function drawFrontAlgae() {
  const a = world.water.algae / 100, wy = world.waterY;
  if (a < .3 || wy >= TANK.floor) return;
  const k = (a - .3) / .7;
  G.save(); G.alpha(k * .5);
  const r = rng(13);
  for (let i = 0; i < 26; i++) {
    const side = i % 3, x = side === 0 ? TANK.left + r() * 60 : side === 1 ? TANK.right - r() * 60 : TANK.left + r() * (TANK.right - TANK.left);
    const y = side === 2 ? TANK.floor - r() * 40 : wy + r() * (TANK.floor - wy);
    G.poly(ellipsePts(x, y, 14 + r() * 30 * k, 8 + r() * 14 * k, r() * 3, 12), '#4a7a2e');
  }
  G.restore();
}
// 水色：藻多偏綠、髒污多偏黃褐並變混濁
function waterTint() {
  const w = world.water, c1 = mixColor('#2a7fb0', '#4f7a3a', w.algae / 100 * .55);
  return { color: mixColor(c1, '#6a6040', w.dirt / 100 * .45), alpha: .24 + w.dirt / 100 * .2 };
}
function drawMurk() {
  const d = world.water.dirt / 100, wy = world.waterY;
  if (d < .35 || wy >= TANK.floor) return;
  const r = rng(77), n = Math.round((d - .35) * 120 * W / 1280);
  G.save(); G.alpha(Math.min(.6, (d - .35) * 1.2));
  for (let i = 0; i < n; i++) {
    const x = TANK.left + ((r() * (TANK.right - TANK.left) + world.t * (4 + r() * 6)) % (TANK.right - TANK.left));
    const y = wy + 10 + ((r() * (TANK.floor - wy - 20) + Math.sin(world.t * .5 + i) * 6));
    G.circle(x, y, .8 + r() * 1.4, '#c8b890');
  }
  G.restore();
}


// ---------------------------------------------------------------------
// 美術：景深（背景岩壁、遠景水草、前景植物）、日夜色調、魚的影子、暗角
// ---------------------------------------------------------------------
function makeScenery() {
  const r = rng(W * 3 + H * 5), back = [], far = [], front = [];
  for (let x = TANK.left - 40; x < TANK.right + 40; x += 70 + r() * 90) back.push({ x, w: 120 + r() * 160, h: (TANK.floor - TANK.top) * (.35 + r() * .5), k: r() });
  for (let x = TANK.left + 20; x < TANK.right; x += 40 + r() * 70) far.push({ x, h: 80 + r() * 200, k: r(), n: 2 + Math.floor(r() * 3) });
  front.push({ x: TANK.left + 30, h: 150, side: 1 }, { x: TANK.left + 90, h: 100, side: 1 }, { x: TANK.right - 40, h: 170, side: -1 }, { x: TANK.right - 110, h: 110, side: -1 });
  return { back, far, front };
}
let SCENERY = makeScenery();
function drawBackWall() {                                          // 背景：深色岩壁（像生態缸的背板）
  for (const b of SCENERY.back) {
    const pts = [], n = 10;
    for (let i = 0; i <= n; i++) {
      const u = i / n, x = b.x - b.w / 2 + b.w * u;
      pts.push(P(x, TANK.floor - b.h * Math.pow(Math.sin(Math.PI * u), .7) * (1 + Math.sin(u * 9 + b.k * 7) * .06)));
    }
    pts.push(P(b.x + b.w / 2, TANK.floor), P(b.x - b.w / 2, TANK.floor));
    G.poly(pts, mixColor('#7d8a84', '#5c6862', b.k));
    G.save(); G.alpha(.25); G.line(pts.slice(1, 6).map(p => P(p.x, p.y + 4)), 3, '#c8d4ce'); G.restore();   // 岩壁頂端受光
  }
}
function drawFarPlants() {                                         // 遠景水草：顏色淡、輕輕擺動
  const wy = world.waterY;
  if (wy >= TANK.floor) return;
  G.save(); G.alpha(.32);
  for (const p of SCENERY.far) for (let k = 0; k < p.n; k++) {
    const pts = [], h = Math.min(p.h, TANK.floor - wy - 10) * (.7 + .3 * Math.sin(p.k * 9 + k));
    for (let i = 0; i <= 6; i++) { const t = i / 6; pts.push(P(p.x + k * 8 + Math.sin(world.t * .7 + p.k * 5 + t * 2) * 10 * t, TANK.floor - h * t)); }
    G.line(chaikin(pts, false, 1), 5, '#4a7a5a');
  }
  G.restore();
}
function drawFrontPlants() {                                       // 前景：畫面左右下角的植物剪影（在玻璃前面）
  G.save(); G.alpha(.5);
  for (const f of SCENERY.front) for (let k = 0; k < 5; k++) {
    const a = -Math.PI / 2 + f.side * (.15 + k * .16) + Math.sin(world.t * .8 + k + f.x) * .04, len = f.h * (.6 + (k % 3) * .2);
    const base = P(f.x + k * 6 * f.side, H), tip = P(base.x + Math.cos(a) * len, base.y + Math.sin(a) * len), mid = P(lerp(base.x, tip.x, .5) - f.side * 10, lerp(base.y, tip.y, .5));
    const nx = Math.cos(a + Math.PI / 2) * 9, ny = Math.sin(a + Math.PI / 2) * 9;
    G.poly(chaikin([base, P(mid.x + nx, mid.y + ny), tip, P(mid.x - nx, mid.y - ny)], true, 2), '#1f3a24');
  }
  G.restore();
}
// 日夜色調：日出偏橘粉、白天自然、黃昏金黃轉粉紫、夜晚藍紫
const GRADE_KEYS = [[0, '#0c1030', .6], [5, '#0c1030', .6], [6, '#ff8a5a', .2], [7.5, '#fff4e0', 0], [16.5, '#fff4e0', 0], [17.8, '#ffb040', .16], [19, '#c0507a', .24], [20.2, '#0c1030', .6], [24, '#0c1030', .6]];
function drawGrading() {
  const h = world.tod * 24;
  let i = 0; while (i < GRADE_KEYS.length - 2 && h > GRADE_KEYS[i + 1][0]) i++;
  const [h0, c0, a0] = GRADE_KEYS[i], [h1, c1, a1] = GRADE_KEYS[i + 1], t = clamp((h - h0) / (h1 - h0), 0, 1);
  const alpha = lerp(a0, a1, t);
  if (alpha > .005) { G.save(); G.alpha(alpha); G.rect(0, 0, W, H, mixColor(c0, c1, t)); G.restore(); }
  const L = daylight();
  if (L < .5) {                                                    // 月光
    G.save(); G.alpha((.5 - L) * .14);
    const mx = TANK.left + (TANK.right - TANK.left) * .7;
    G.poly([P(mx - 40, TANK.top), P(mx + 60, TANK.top), P(mx + 260, TANK.floor), P(mx - 10, TANK.floor)], '#cfe0ff');
    G.restore();
  }
}
function drawShadows(list) {                                       // 水中生物投在缸底的軟影（光從左上方來）
  const L = daylight(), wy = world.waterY;
  if (L < .2 || wy >= TANK.floor) return;
  for (const e of list) {
    const swim = e.kind === 'fish' || e.kind === 'whale' || e.kind === 'tadpole' || (e.kind === 'turtle' && e.mode === 'swim');
    if (!swim || e.dead || e.y < wy) continue;
    const g = groundY(e.x, e.y + 4, 0), h = g - e.y;
    if (h < 0 || h > 420) continue;
    const len = SPECIES[e.type].len * e.size * (e.kind === 'turtle' ? .5 : .5);
    G.save(); G.alpha(L * .22 * (1 - h / 420));
    G.poly(ellipsePts(e.x + h * .12, g - 1, len * (1 + h / 500), 2.5 + h / 80, 0, 14), '#10202a');
    G.restore();
  }
}
function drawVignette() {                                          // 暗角
  const e = 90;
  G.save(); G.alpha(.22);
  G.rect(0, 0, W, e, { lin: [0, 0, 0, e, [[0, '#000'], [1, 'rgba(0,0,0,0)']]] });
  G.rect(0, H - e, W, e, { lin: [0, H, 0, H - e, [[0, '#000'], [1, 'rgba(0,0,0,0)']]] });
  G.rect(0, 0, e, H, { lin: [0, 0, e, 0, [[0, '#000'], [1, 'rgba(0,0,0,0)']]] });
  G.rect(W - e, 0, e, H, { lin: [W, 0, W - e, 0, [[0, '#000'], [1, 'rgba(0,0,0,0)']]] });
  G.restore();
}
// 新植物：蕨類（陸地）、前景草（缸底）
function drawFern(d) {
  const r = rng(d.seed);
  for (let k = 0; k < 6; k++) {
    const a = -Math.PI / 2 + (k - 2.5) * .32 + Math.sin(world.t * .6 + k) * .03, len = d.h * (.65 + r() * .45);
    const pts = []; for (let i = 0; i <= 6; i++) { const t = i / 6; pts.push(P(d.x + Math.cos(a) * len * t + (k - 2.5) * 3 * t * t * 4, d.y + Math.sin(a) * len * t + len * .35 * t * t)); }
    G.line(chaikin(pts, false, 1), 1.6, '#3f7a2c');
    for (let i = 1; i < pts.length; i++) for (const sd of [-1, 1]) {        // 小羽片
      const p = pts[i], q = pts[i - 1], ang = Math.atan2(p.y - q.y, p.x - q.x) + sd * 1.1, l = 7 * (1 - i / 8);
      G.poly(ellipsePts(p.x + Math.cos(ang) * l * .5, p.y + Math.sin(ang) * l * .5, l * .55, 1.8, ang, 8), i % 2 ? '#4f9a3a' : '#5fae44');
    }
  }
}
function drawCarpet(d) {
  const wy = world.waterY, r = rng(d.seed), n = Math.round(d.w / 4);
  for (let i = 0; i < n; i++) {
    const x = d.x - d.w / 2 + r() * d.w, base = d.thumb ? d.y : groundY(x, d.y - 20, 30), h = d.h * (.5 + r() * .6), under = base > wy;
    const sway = under ? Math.sin(world.t * 1.6 + x * .1) * 2.5 : .5;
    G.line([P(x, base), P(x + sway, base - h)], 1.6, r() < .5 ? '#4f9a3a' : '#6ab04a');
    if (r() < .3) G.circle(x + sway, base - h, 1.3, '#7fc45a');
  }
}


// ---------------------------------------------------------------------
// 櫻花蝦（側面細畫，原點 = 腳下地面，頭在 +x）
//   額角（帶鋸齒）、有眼柄的複眼、第一觸角（短、分叉）、第二觸角（長鞭）、頭胸甲、
//   腹部 6 節＋尾扇（尾節＋尾肢）、步足 5 對（前 2 對有小螯）、游泳足 5 對；
//   母蝦：卵鞍、抱卵；色級：普通（半透明帶紅斑）／櫻花／極火
// ---------------------------------------------------------------------
const SHRIMP_CARAPACE = chaikin([P(4, -6), P(4.5, -10.5), P(10, -12.2), P(15.5, -10.8), P(18, -8.2), P(17, -6), P(10, -5)], true, 2);
function shrimpAbdomen(curl) {                                   // 腹部 6 節：從頭胸甲後方往後、往下彎
  const segs = []; let p = P(4.5, -8.4), a = Math.PI + .18;
  const H = [3.4, 3.2, 3, 2.7, 2.3, 1.9];
  for (let i = 0; i < 6; i++) {
    a -= .085 + curl * .42;                                          // 角度遞減 = 往下彎（腹部往下拱，平常尾巴離地；彈尾時用力捲起）
    const q = P(p.x + Math.cos(a) * 3.3, p.y + Math.sin(a) * 3.3);
    segs.push({ a: p, b: q, h: H[i], ang: a }); p = q;
  }
  return segs;
}
function drawShrimpBody(e, ghost) {
  const juv = e.size < e.adult * .6, male = e.sex === 'm';
  const G0 = SHRIMP_GRADES[e.morph || 0];
  const stress = (e.paleT > 0 ? .5 : 0) + (world.water.dirt > 40 ? .4 : 0);
  e.paleV = lerp(e.paleV || 0, Math.min(1, stress), .03);
  const op = ghost ? .22 : (juv ? .35 : G0.opacity * (male ? .55 : 1)) * (1 - e.paleV * .45);
  const col = ghost ? '#f0eee4' : mixColor(G0.color, '#f2e2d8', (male ? .25 : 0) + e.paleV * .4);
  const edge = ghost ? 'rgba(255,255,255,.6)' : 'rgba(120,20,15,.45)';
  const segs = shrimpAbdomen(e.curl || 0), last = segs[5];
  const walk = (e.dist || 0) * .5, picking = e.state === '用小螯夾食';
  if (!ghost) for (let i = 0; i < 5; i++) {                       // 遠側步足
    const x = 6 + i * 2.5 + .8, sw = Math.sin(walk + i * 1.3 + Math.PI) * 1.4;
    G.line([P(x, -6), P(x + 1.6, -3.2), P(x + 1 + sw, -.2)], .5, 'rgba(150,40,30,.45)');
  }
  G.save(); G.alpha(op);
  { // 腹部：一個連續平滑的輪廓，再畫分節線
    const up = s0 => P(Math.cos(s0.ang + Math.PI / 2), Math.sin(s0.ang + Math.PI / 2));
    const top = [], bot = [];
    segs.forEach((s0, i) => { const n = up(s0); top.push(P(s0.a.x + n.x * s0.h, s0.a.y + n.y * s0.h)); bot.push(P(s0.a.x - n.x * s0.h * .85, s0.a.y - n.y * s0.h * .85)); });
    const nl = up(last); top.push(P(last.b.x + nl.x * 1.4, last.b.y + nl.y * 1.4)); bot.push(P(last.b.x - nl.x * 1.2, last.b.y - nl.y * 1.2));
    G.poly(chaikin([...top, ...bot.reverse()], true, 2), col, edge, .35);
    for (let i = 1; i < 6; i++) { const s0 = segs[i], n = up(s0); G.line(chaikin([P(s0.a.x + n.x * s0.h, s0.a.y + n.y * s0.h), P(s0.a.x - .8, s0.a.y), P(s0.a.x - n.x * s0.h * .8, s0.a.y - n.y * s0.h * .8)], false, 1), .35, edge); }
  }
  const ta = last.ang, tb = last.b;                               // 尾扇：尾節＋兩片尾肢
  const fan = (o, l, w) => {
    const a = ta + o, tip = P(tb.x + Math.cos(a) * l, tb.y + Math.sin(a) * l), nx = Math.cos(a + Math.PI / 2) * w, ny = Math.sin(a + Math.PI / 2) * w;
    G.poly([tb, P(tip.x + nx, tip.y + ny), tip, P(tip.x - nx, tip.y - ny)], col, edge, .3);
  };
  fan(-.45, 5.5, 1.3); fan(.45, 5.5, 1.3); fan(0, 6, .9);
  G.poly(SHRIMP_CARAPACE, col, edge, .4);                         // 頭胸甲
  G.restore();
  if (op < .85) G.line([P(16, -8), P(10, -8.6), ...segs.map(s0 => s0.b)], .5, 'rgba(70,40,20,.5)');   // 體內腸道
  if (!ghost) {
    if (G0.speckle || juv) {                                      // 紅色斑點（色素細胞）
      const r = rng(e.id + .5);
      G.save(); G.alpha(.55 * (1 - e.paleV * .5));
      for (let i = 0; i < 26; i++) {
        let p0;
        if (r() < .45) p0 = P(5 + r() * 12, -10 + r() * 4.5);
        else { const s0 = segs[Math.floor(r() * 6)]; p0 = P(s0.a.x + (r() - .5) * 2, s0.a.y + (r() - .5) * 4); }
        G.circle(p0.x, p0.y, .35 + r() * .35, '#c8141a');
      }
      G.restore();
    }
    if (e.sex === 'f' && !juv && !(e.preg > 0)) { G.save(); G.alpha(.75); G.poly(ellipsePts(6.5, -10.2, 2.8, 1.4, -.1, 12), '#e8d060'); G.restore(); }   // 卵鞍
    G.save(); G.alpha(.35); G.line([P(6, -11.6), P(11, -12), P(15, -10.8)], .6, '#ffffff'); G.restore();   // 背上的高光
    const beat = e.mode === 'swim' || e.mode === 'swarm' || e.preg > 0 ? 1 : .25;   // 游泳足
    for (let i = 0; i < 5; i++) {
      const s0 = segs[i], n = P(Math.cos(s0.ang - Math.PI / 2), Math.sin(s0.ang - Math.PI / 2)), b = P(s0.b.x + n.x * s0.h * .8, s0.b.y + n.y * s0.h * .8);   // 腹部下方
      const sw = Math.sin(e.phase * 2 + i * .8) * beat * .5;
      G.line([b, P(b.x + n.x * 2.4 + Math.cos(s0.ang) * sw * 2, b.y + n.y * 2.4 + Math.sin(s0.ang) * sw * 2)], .45, 'rgba(200,80,60,.6)');
    }
    if (e.preg > 0) {                                             // 抱卵：越接近孵化越深、看得到眼點
      const r = rng(e.id), ec = mixColor('#d8cc58', '#6a5a3a', e.preg);
      for (let i = 0; i < 12; i++) {
        const s0 = segs[Math.floor(r() * 4)], n = P(Math.cos(s0.ang - Math.PI / 2), Math.sin(s0.ang - Math.PI / 2));
        const p0 = P(s0.a.x + n.x * (s0.h + .8 + r()), s0.a.y + n.y * (s0.h + .8 + r()) + (r() - .5));
        G.circle(p0.x, p0.y, .8, ec);
        if (e.preg > .6) G.circle(p0.x + .2, p0.y, .25, '#1a1a1a');
      }
    }
  }
  G.poly([P(15.5, -9.6), P(24.5, -11.2), P(16, -8.6)], ghost ? 'rgba(240,238,228,.3)' : col, edge, .3);   // 額角
  if (ghost) return;
  for (let i = 0; i < 4; i++) G.line([P(17.5 + i * 1.7, -10 - i * .28), P(17.9 + i * 1.7, -10.9 - i * .28)], .3, edge);   // 額角鋸齒
  G.line([P(16.5, -8.4), P(18.4, -8.9)], .9, col); G.circle(18.9, -9, 1.5, '#141010'); G.circle(19.3, -9.4, .45, '#ffffff');   // 有眼柄的複眼
  const sw = Math.sin(world.t * 1.6 + e.id) * 1.2;              // 觸角
  G.line([P(18, -9.5), P(22, -13), P(26, -14.5 + sw * .3)], .35, 'rgba(160,40,30,.7)');
  G.line([P(18, -9.5), P(22.5, -12), P(26.5, -11.5 + sw * .3)], .35, 'rgba(160,40,30,.7)');
  G.line(chaikin([P(17.5, -8.6), P(25, -12.5), P(33, -12 + sw), P(39, -6 + sw * 1.5), P(42, 1 + sw)], false, 1), .3, 'rgba(160,40,30,.6)');
  G.line(chaikin([P(17.5, -8.4), P(24, -10), P(32, -7 + sw * .6), P(37, -1 + sw)], false, 1), .3, 'rgba(160,40,30,.5)');
  for (let i = 0; i < 5; i++) {                                   // 近側步足：前 2 對有小螯，夾食時輪流送到嘴邊
    const x = 6 + i * 2.5, cheli = i >= 3;
    let foot;
    if (cheli && picking) { const k = (Math.sin(e.phase * 3 + i * Math.PI) + 1) / 2; foot = P(lerp(x + 2.5, 18, k), lerp(-.3, -6.5, k)); }
    else foot = P(x + 1 + Math.sin(walk + i * 1.3) * 1.4, -.2);
    const knee = P((x + foot.x) / 2 + .9, Math.min(-3, (foot.y - 6) / 2));
    G.line([P(x, -5.8), knee, foot], .6, 'rgba(200,60,45,.75)');
    if (cheli) { G.line([foot, P(foot.x + 1, foot.y - .5)], .4, 'rgba(200,60,45,.9)'); G.line([foot, P(foot.x + 1, foot.y + .4)], .4, 'rgba(200,60,45,.9)'); }
  }
}
function drawShrimp(e) {
  const k = e.size * SPECIES[e.type].len / 40;
  G.save(); G.tf(e.x, e.y, 0, e.dir * k, k);
  if (e.dead) G.alpha(.5);
  if (fishLodOn && 40 * k * screenScale() < FISH_LOD_PX) {          // 畫面上很小：簡化版（身體＋尾扇＋眼睛）
    const gr = SHRIMP_GRADES[e.morph || 0];
    G.alpha(e.sex === 'm' ? gr.opacity * .8 : gr.opacity);
    G.poly(ellipsePts(2, -8 + (e.curl || 0) * 2, 17, 4.5, -.05, 12), gr.color);
    G.poly([P(-13, -6), P(-22, -10), P(-21, -1)], gr.color);
    G.circle(18, -9, 1.8, '#111');
  } else drawShrimpBody(e);
  G.restore();
}
function drawMolts() {                                             // 蛻下的空殼：半透明、慢慢淡掉
  for (const m of world.molts) {
    G.save(); G.tf(m.x, m.y, 0, m.dir * m.size, m.size); G.alpha(Math.min(1, (40 - m.t) / 10));
    drawShrimpBody({ type: 'cherry', size: 1, adult: 1, curl: .1, id: 1, morph: 0 }, true);
    G.restore();
  }
}

// ---------------------------------------------------------------------
// 編輯用疊加層（選取框、除錯）
// ---------------------------------------------------------------------
function entCenter(e) {
  const s = e.size;
  if (e.kind === 'turtle') return P(e.x, e.y - 22 * s);
  if (e.kind === 'frog') return P(e.x, e.y - 13 * s);
  if (e.kind === 'larva') return P(e.x, e.y + 2);
  if (e.kind === 'nest') return P(e.x, e.y - 3);
  if (e.kind === 'cricket') return P(e.x, e.y - 5);
  if (e.kind === 'gecko' && e.surface !== 'glass') return P(e.x, e.y - 10 * s);
  return P(e.x, e.y);
}
function drawSelection(obj) {
  const c = G.c;
  c.save(); c.setLineDash([6, 5]); c.lineDashOffset = -world.t * 20;
  if (obj.kind) {
    const p = entCenter(obj), r = SPECIES[obj.type].hit * obj.size + 8;
    G.circle(p.x, p.y, r, null, '#ffb020', 2);
  } else {
    const b = decorBounds(obj);
    G.poly([P(b.x0, b.y0), P(b.x1, b.y0), P(b.x1, b.y1), P(b.x0, b.y1)], null, '#ffb020', 2);
  }
  c.restore();
}
function decorBounds(d) {
  if (d.type === 'wood') { const [a, b] = woodEnds(d); return { x0: Math.min(a.x, b.x) - 6, x1: Math.max(a.x, b.x) + 6, y0: Math.min(a.y, b.y) - d.h, y1: Math.max(a.y, b.y) + d.h }; }
  if (d.type === 'plant') return { x0: d.x - d.w / 2 - 10, x1: d.x + d.w / 2 + 10, y0: d.y - d.h, y1: d.y };
  return { x0: d.x - d.w / 2, x1: d.x + d.w / 2, y0: d.y - d.h - 4, y1: d.y };
}
function drawDebug(e, sel) {
  const sp = SPECIES[e.type];
  if ((world.settings.debugSight || sel) && sp.sight) {
    const r = e.kind === 'frog' ? sp.tongue * e.size : sp.sight * (e.kind === 'gecko' ? e.size : 1);
    const p = entCenter(e);
    G.save(); G.alpha(.5); G.circle(p.x, p.y, r, null, '#ff2fb0', 1.2); G.restore();
    if (e.tx !== undefined && e.kind === 'fish') G.line([P(e.x, e.y), P(e.tx, e.ty)], 1, 'rgba(255,47,176,.6)');
    if (e.goal) G.line([P(e.x, e.y), e.goal], 1, 'rgba(255,47,176,.6)');
  }
  if (world.settings.debugBones) {
    if (e.kind === 'gecko' && e.surface === 'glass' && e.chain) { G.line(e.chain, 1.2, '#ff2fb0'); for (const p of e.chain) G.circle(p.x, p.y, 1.8, '#ff2fb0'); }
    if (e.kind === 'fish') {
      const R = fishRig(e), k = e.size * SPECIES[e.type].len / 64;
      G.save(); G.tf(e.x, e.y, 0, R.sx * k, k); G.line(R.nodes, 1.5 / k, '#ff2fb0'); for (const p of R.nodes) G.circle(p.x, p.y, 1.8 / k, '#ff2fb0'); G.restore();
    }
    if (e.kind === 'gecko' && e.surface !== 'glass') {
      const R = geckoSideRig(e);
      G.save(); G.tf(e.x, e.y, 0, R.sx * e.size, e.size); G.line(R.nodes, 1.2, '#ff2fb0');
      for (const l of R.legs) { G.line([l.hip, l.knee, l.foot], 1.2, '#b02fff'); G.circle(l.foot.x, l.foot.y, 2, l.lift > .5 ? '#ffd400' : '#00d2a0'); }
      G.restore();
    }
  }
}

// ---------------------------------------------------------------------
// 整個畫面
// ---------------------------------------------------------------------
function render(selected) {
  G.layer('bg', [W, H, Math.round(world.waterY)].join(','), 0, 0, W, H, () => { drawBackground(); drawWaterBack(); });   // 靜態：背景＋水的底色
  drawLightShafts();
  drawGlassAlgae();
  drawFarPlants();
  for (const e of world.ents) if (e.kind === 'gecko' && e.surface === 'glass') drawGecko(e);   // 背面玻璃上的壁虎
  for (const d of world.decor) if (d.type === 'plant') drawDecor(d);
  for (const d of world.decor) if (d.type !== 'plant') drawDecorCached(d);
  drawTailBits();
  drawMolts();
  for (const f of world.food) drawFood(f);
  const order = { shrimp: 0, snail: 0, nest: 0, larva: 0, tadpole: 1, whale: 1, fish: 2, cricket: 3, turtle: 3, frog: 4, gecko: 5, mosquito: 6, fly: 6 };
  const list = world.ents.filter(e => !(e.kind === 'gecko' && e.surface === 'glass')).sort((a, b) => order[a.kind] - order[b.kind]);
  drawShadows(list);
  for (const e of list) DRAW[e.kind](e);
  G.layer('substrate', W + ',' + H + ',' + SAND.length + ',' + (SAND[0] ? SAND[0].x : 0), 0, TANK.floor - 4, W, H - TANK.floor + 4, drawSubstrate);
  drawCaustics();
  drawWaterFront();
  drawMurk();
  drawFrontAlgae();
  drawParticles();
  drawFrontPlants();
  drawGrading();
  G.layer('over', W + ',' + H, 0, 0, W, H, () => { drawVignette(); drawFrame(); });   // 靜態：暗角＋缸框
  drawFx();
  for (const e of world.ents) drawDebug(e, e === selected);
  if (selected && (world.ents.includes(selected) || world.decor.includes(selected))) drawSelection(selected);
}
