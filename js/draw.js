'use strict';
// =====================================================================
// draw.js — 外觀層：把骨架資料畫出來（只使用 core.js 的 G 指令）
// =====================================================================

const DRAW = { fish: drawFish, turtle: drawTurtle, frog: drawFrog, gecko: drawGecko, mosquito: drawMosquito, larva: drawLarva,
               tadpole: drawTadpole, whale: drawWhale, nest: drawNest };

// ---------------------------------------------------------------------
// 場景
// ---------------------------------------------------------------------
function makeSand() {
  return Array.from({ length: Math.round(W / 9) }, () => ({ x: rand(0, W), y: rand(TANK.floor + 4, H - 4), r: rand(1, 3.2), c: pick(['#b39b6e', '#8f7a52', '#cdb88c', '#a08660']) }));
}
let SAND = makeSand();

function drawBackground() {
  G.rect(0, 0, W, H, { lin: [0, 0, 0, H, [[0, '#dfe9e4'], [.55, '#c9dcd6'], [1, '#9fb8b2']]] });
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
  G.rect(TANK.left, wy, TANK.right - TANK.left, TANK.floor - wy, { lin: [0, wy, 0, TANK.floor, [[0, '#7cc2da'], [1, '#2f6f92']]] });
}
function drawSubstrate() {
  G.rect(0, TANK.floor, W, H - TANK.floor, { lin: [0, TANK.floor, 0, H, [[0, '#c8b285'], [1, '#937a50']]] });
  for (const s of SAND) G.circle(s.x, s.y, s.r, s.c);
}
function drawWaterFront() {
  const wy = world.waterY;
  if (wy >= TANK.floor) return;
  G.save(); G.alpha(.24);
  G.rect(TANK.left, wy, TANK.right - TANK.left, TANK.floor - wy, '#2a7fb0');
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
function drawDecor(d) {
  const wy = world.waterY;
  if (d.type === 'plant') return drawPlant(d);
  if (d.type === 'wood') {
    const [a, b] = woodEnds(d), c = Math.cos(d.rot), s = Math.sin(d.rot), nx = -s * d.h / 2, ny = c * d.h / 2;
    const body = chaikin([P(a.x + nx, a.y + ny), P(a.x - nx, a.y - ny), P(b.x - nx, b.y - ny), P(b.x + nx, b.y + ny)], true, 1);
    G.poly(body, { lin: [0, d.y - d.h, 0, d.y + d.h, [[0, '#9a7650'], [1, '#5c4128']]] }, '#4a3420', 1.5);
    for (let k = .15; k < .9; k += .18) G.line([P(lerp(a.x, b.x, k) + nx * .6, lerp(a.y, b.y, k) + ny * .6), P(lerp(a.x, b.x, k + .1) + nx * .2, lerp(a.y, b.y, k + .1) + ny * .2)], 1.4, 'rgba(60,40,20,.5)');
    G.circle(lerp(a.x, b.x, .62), lerp(a.y, b.y, .62), d.h * .22, '#5c4128');
    return;
  }
  const ol = decorOutline(d);
  if (d.type === 'mound') {
    G.poly(ol, { lin: [0, d.y - d.h, 0, d.y, [[0, '#7a5a38'], [1, '#4f3a24']]] });
    // 水面以上長草，水面以下長苔
    const top = ol.slice(0, -2);
    const above = top.filter(p => p.y < wy - 2), below = top.filter(p => p.y >= wy - 2);
    if (above.length > 1) G.line(above, 7, '#5f9a3c');
    if (below.length > 1) G.line(below, 5, '#3f6a3a');
    for (let i = 0; i < top.length; i += 2) { const p = top[i]; if (p.y < wy - 4) G.line([p, P(p.x + Math.sin(i + world.t) * 2, p.y - 9)], 2, '#78b04a'); }
    return;
  }
  G.poly(ol, { lin: [d.x - d.w / 2, d.y - d.h, d.x + d.w / 2, d.y, [[0, '#a3a7a8'], [.5, '#7d8487'], [1, '#4f5558']]] }, '#3f4446', 1.5);
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
function drawFish(e) {
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
// 烏龜（側面，原點 = 腳下地面）
// ---------------------------------------------------------------------
const TURTLE_SHELL = (() => {
  const top = [];
  for (let i = 0; i <= 20; i++) { const x = -40 + 80 * i / 20; top.push(P(x, -10 - 30 * Math.pow(Math.max(0, 1 - (x / 40) ** 2), .55))); }
  return top;
})();
function drawTurtle(e) {
  const s = e.size, sx = facing(e), wy = world.waterY;
  const swim = e.mode === 'swim' || (e.mode === 'fall' && e.y > wy), bask = e.mode === 'bask';
  const lim = e.limb || 0, skin = '#6e6c52', skinD = '#4d4b39';
  G.save(); G.tf(e.x, e.y, 0, sx * s, s);
  if (swim) G.tf(0, 0, -.04 * Math.sin(lim * .5));
  if (e.dead) G.alpha(.6);
  const leg = (px, py, ang, len, w, col) => {
    const ex = px + Math.cos(ang) * len, ey = py + Math.sin(ang) * len;
    G.line([P(px, py), P(ex, ey)], w, col);
    G.circle(ex, ey, w * .45, col);
  };
  const legs = (col, ph) => {
    if (swim) { leg(24, -14, .5 + Math.sin(lim + ph) * .9, 18, 7, col); leg(-22, -12, Math.PI - .5 + Math.sin(lim + ph + Math.PI) * .4, 13, 6, col); }
    else if (bask) { leg(26, -11, Math.PI / 2 - .5, 12, 6.5, col); leg(-24, -11, Math.PI / 2 + .6, 12, 6.5, col); }
    else { leg(24, -12, Math.PI / 2 + Math.sin(lim * 2 + ph) * .45, 12, 6.5, col); leg(-20, -12, Math.PI / 2 + Math.sin(lim * 2 + ph + Math.PI) * .45, 12, 6.5, col); }
  };
  legs(skinD, Math.PI);
  G.poly([P(-38, -13), P(-50, -9), P(-38, -8)], skin);
  // 頭和脖子
  const ext = bask ? 1 : swim ? .6 : .4;
  const hx = 40 + ext * 12, hy = (bask ? -26 : -17) + Math.sin(world.t * 1.3 + e.id) * 1;
  G.line([P(30, -15), P(hx - 6, hy)], 9, skin);
  G.poly(ellipsePts(hx, hy, 11, 7.5, bask ? -.2 : 0, 18), skin, skinD, 1);
  G.line([P(hx - 9, hy - 3), P(hx + 6, hy - 4.5)], 1.6, '#e8d27a');            // 麝香龜頭上的兩條淡色線
  G.line([P(hx - 9, hy + 2), P(hx + 8, hy + 1.5)], 1.6, '#e8d27a');
  G.circle(hx + 5, hy - 1.5, 1.9, e.dead ? '#666' : '#111');
  // 殼
  G.poly([...TURTLE_SHELL, P(40, -9), P(-40, -9)], { lin: [0, -40, 0, -9, [[0, '#5a5440'], [1, '#2f2b20']]] }, '#24211a', 1.5);
  for (const x of [-22, 0, 22]) { const t = TURTLE_SHELL[Math.round((x + 40) / 4)]; G.line([P(t.x, t.y + 1), P(x * 1.08, -14)], 1.2, 'rgba(20,18,12,.6)'); }
  G.line([P(-38, -14), P(38, -14)], 1.3, 'rgba(20,18,12,.55)');
  G.poly([P(-36, -9), P(36, -9), P(32, -5.5), P(-32, -5.5)], '#c9b06a');
  legs(skin, 0);
  G.restore();
}

// ---------------------------------------------------------------------
// 青蛙（側面，原點 = 腳下地面）
// ---------------------------------------------------------------------
const FROG_BODY = chaikin([P(-18, -6), P(-16, -15), P(-6, -21), P(6, -24), P(16, -22), P(23, -15), P(22, -10), P(14, -6), P(0, -3), P(-12, -3)], true, 2);
const FROG_BELLY = chaikin([P(-14, -4), P(0, -3), P(14, -6), P(21, -10), P(16, -8.5), P(2, -6), P(-12, -6.5)], true, 1);
function lp(a, b, t) { return P(lerp(a.x, b.x, t), lerp(a.y, b.y, t)); }
function drawFrog(e) {
  const s = e.size;
  let k = 0;
  if (e.mode === 'jump') k = e.vy < 0 ? 1 : clamp(1 - e.vy / 500, .25, 1);
  if (e.mode === 'float') k = .55;
  const tilt = e.mode === 'jump' ? clamp(Math.atan2(e.vy, Math.abs(e.vx) + 1) * .5, -.6, .6) : 0;
  const squash = e.landT > 0 ? 1 - e.landT * 1.1 : 1;
  G.save(); G.tf(e.x, e.y, 0, e.dir * s, s);
  if (e.dead) G.alpha(.6);
  G.tf(0, 0, tilt, 1 + (1 - squash) * .5, squash);
  const hind = (dx, dy, col) => {
    const hip = P(-12 + dx, -9 + dy);
    const knee = lp(P(4, -5), P(-24, -6), k), ankle = lp(P(-14, -1), P(-36, -2), k), toe = lp(P(0, 0), P(-48, 0), k);
    G.line([hip, P(knee.x + dx, knee.y + dy)], 7, col);
    G.line([P(knee.x + dx, knee.y + dy), P(ankle.x + dx, ankle.y + dy)], 5, col);
    G.line([P(ankle.x + dx, ankle.y + dy), P(toe.x + dx, toe.y + dy)], 3.2, col);
    G.poly([P(toe.x + dx, toe.y + dy), P(toe.x + dx + (k > .5 ? -5 : 5), toe.y + dy - 2), P(toe.x + dx + (k > .5 ? -5 : 5), toe.y + dy + 2)], col);
  };
  hind(3, -2, '#2f6a2a');
  G.poly(FROG_BODY, { lin: [0, -24, 0, -3, [[0, '#3c8a34'], [1, '#6cbf4c']]] }, '#24511f', 1);
  G.poly(FROG_BELLY, '#e8572a');
  for (const [x, y, r] of [[-8, -15, 2.2], [0, -19, 1.8], [8, -20, 1.6], [-2, -12, 1.6], [-12, -10, 2], [4, -14, 1.3]]) G.circle(x, y, r, '#1d2a14');
  const pulse = 1 + Math.max(0, Math.sin(world.t * 3 + e.id)) * .45;
  G.poly(ellipsePts(15, -8, 5 * pulse, 2.6 * pulse, 0, 14), '#f3b07a');
  G.line([P(23, -14), P(13, -12.5)], 1, '#24511f');
  G.circle(12, -23, 4.6, '#4fa040', '#24511f', 1);
  G.circle(12.5, -23.5, 3, '#c9a43a');
  G.poly(ellipsePts(12.8, -23.5, 1.8, 1.1, 0, 10), e.dead ? '#666' : '#111');
  const hand = lp(P(14, 0), P(24, -3), k);
  G.line([P(12, -9), hand], 3.6, '#4fa040');
  hind(0, 0, '#3f8a34');
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
// 壁虎
// ---------------------------------------------------------------------
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
function toes(foot, ang, lift, col) {
  const curl = lift > 1 ? .4 : 0;
  for (const k of [-1.5, -.5, .5, 1.5]) {
    const a = ang + k * .45, tip = P(foot.x + Math.cos(a) * (4.5 - curl * 2), foot.y + Math.sin(a) * (4.5 - curl * 2));
    G.line([foot, tip], 1.2, col); G.circle(tip.x, tip.y, 1.25, col);
  }
}
function drawGeckoSide(e) {
  const R = geckoSideRig(e), n = R.nodes, s = e.size;
  G.save(); G.tf(e.x, e.y, 0, R.sx * s, s);
  if (e.dead) G.alpha(.6);
  G.save(); G.alpha(.18); G.poly(ellipsePts(10, 1, 48, 3, 0, 16), '#000'); G.restore();
  const legDraw = (l, col, edge) => {
    G.line([l.hip, l.knee, l.foot], 4.6, edge); G.line([l.hip, l.knee, l.foot], 3, col);
    // 側面看腳趾沿地面張開
    for (const kx of [-1.5, -.5, .5, 1.5]) { const tx = l.foot.x + kx * 2.6, ty = Math.min(l.foot.y + .5, 0); G.line([l.foot, P(tx, ty)], 1.2, col); G.circle(tx, ty, 1.25, col); }
  };
  R.legs.filter(l => !l.near).forEach(l => legDraw(l, '#b0926e', '#7d6447'));
  const ol = chaikin(sideOutline(n), true, 2);
  G.poly(ol, { lin: [0, -20, 0, 0, [[0, '#c4a27a'], [.5, '#dfc6a2'], [1, '#f4e9d8']]] }, 'rgba(90,65,40,.45)', 1);
  for (let i = 2; i <= 6; i++) for (const t of [.3, .7]) G.circle(lerp(n[i].x, n[i + 1].x, t), lerp(n[i].y, n[i + 1].y, t) - lerp(n[i].t, n[i + 1].t, t) * .55, 1.1, 'rgba(140,105,70,.55)');
  for (let i = 6; i <= 9; i++) G.line([P(n[i].x, n[i].y - n[i].t * .9), P(n[i].x + 1, n[i].y + n[i].t * .6)], 1.2, 'rgba(140,105,70,.4)');
  const h0 = n[0], h1 = n[1];
  if (R.mouth) {
    G.poly([P(h0.x + 2, h0.y + .5), P(h1.x - 2, h1.y + 3), P(h0.x - 1, h0.y + 7)], '#9b3d43');
    G.line([P(h1.x - 2, h1.y + 3), P(h0.x - 1, h0.y + 7)], 1, 'rgba(90,65,40,.7)');
  } else G.line([P(h0.x + 1.5, h0.y + 1), P(h1.x + 2, h1.y + 3), P(h1.x - 3, h1.y + 2.5)], .9, 'rgba(90,65,40,.6)');
  G.circle(h1.x + 2, h1.y - 2.5, 3.3, '#c9a04e', 'rgba(90,65,40,.7)', .8);
  G.poly(ellipsePts(h1.x + 2, h1.y - 2.5, .8, 2.6, 0, 10), '#1a1208');   // 直立瞳孔
  R.legs.filter(l => l.near).forEach(l => legDraw(l, '#dcc29e', '#8a6d4c'));
  G.restore();
}
const GK_TOP_W = [5, 5.5, 5, 6, 7, 7.5, 7.5, 6.5, 5, 4, 3, 2.2, 1.4, .7];
function drawGeckoTop(e) {
  const c = e.chain, s = e.size;
  if (!c) return;
  G.save();
  if (e.dead) G.alpha(.6);
  // 腳（俯視）
  if (e.feet) e.feet.forEach((f, i) => {
    const L = GLASS_LEGS[i], j = c[L.j], a = chainAngle(c, L.j), sa = a + L.side * Math.PI / 2;
    const hip = P(j.x + Math.cos(sa) * 4 * s, j.y + Math.sin(sa) * 4 * s);
    const r = ik2(hip, f, 8 * s, 9 * s, (k1, k2) => {
      const out = p => (p.x - j.x) * Math.cos(sa) + (p.y - j.y) * Math.sin(sa);
      return out(k1) > out(k2) ? k1 : k2;                     // 膝蓋朝外
    });
    G.line([hip, r.knee, r.foot], 4.4 * s, '#8a6d4c'); G.line([hip, r.knee, r.foot], 3 * s, '#d8bf98');
    toes(r.foot, Math.atan2(r.foot.y - r.knee.y, r.foot.x - r.knee.x), f.t < 1 ? 2 : 0, '#d8bf98');
  });
  // 身體
  const left = [], right = [];
  c.forEach((p, i) => {
    const a = chainAngle(c, i), w = GK_TOP_W[i] * s;
    left.push(P(p.x + Math.cos(a - Math.PI / 2) * w, p.y + Math.sin(a - Math.PI / 2) * w));
    right.push(P(p.x + Math.cos(a + Math.PI / 2) * w, p.y + Math.sin(a + Math.PI / 2) * w));
  });
  const a0 = e.ang, snout = P(c[0].x + Math.cos(a0) * 10 * s, c[0].y + Math.sin(a0) * 10 * s);
  G.poly(chaikin([snout, ...right, ...left.reverse()], true, 2), '#dcc4a0', 'rgba(90,65,40,.55)', 1);
  for (let i = 3; i < 11; i++) G.circle(c[i].x, c[i].y, (i % 2 ? 1.6 : 1.1) * s, 'rgba(140,105,70,.6)');
  for (let i = 9; i < 13; i++) { const a = chainAngle(c, i), w = GK_TOP_W[i] * s; G.line([P(c[i].x + Math.cos(a - Math.PI / 2) * w, c[i].y + Math.sin(a - Math.PI / 2) * w), P(c[i].x + Math.cos(a + Math.PI / 2) * w, c[i].y + Math.sin(a + Math.PI / 2) * w)], 1.2, 'rgba(140,105,70,.45)'); }
  for (const sd of [-1, 1]) {
    const ea = a0 + sd * 1.1;
    G.circle(c[0].x + Math.cos(ea) * 4.6 * s, c[0].y + Math.sin(ea) * 4.6 * s, 2.4 * s, '#c9a04e', 'rgba(90,65,40,.7)', .8);
  }
  if (e.mouth) G.circle(snout.x, snout.y, 2.5 * s, '#9b3d43');
  G.restore();
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
// 編輯用疊加層（選取框、除錯）
// ---------------------------------------------------------------------
function entCenter(e) {
  const s = e.size;
  if (e.kind === 'turtle') return P(e.x, e.y - 22 * s);
  if (e.kind === 'frog') return P(e.x, e.y - 13 * s);
  if (e.kind === 'larva') return P(e.x, e.y + 2);
  if (e.kind === 'nest') return P(e.x, e.y - 3);
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
  drawBackground();
  drawWaterBack();
  for (const e of world.ents) if (e.kind === 'gecko' && e.surface === 'glass') drawGecko(e);   // 背面玻璃上的壁虎
  for (const d of world.decor) if (d.type === 'plant') drawDecor(d);
  for (const d of world.decor) if (d.type !== 'plant') drawDecor(d);
  for (const f of world.food) drawFood(f);
  const order = { nest: 0, larva: 0, tadpole: 1, whale: 1, fish: 2, turtle: 3, frog: 4, gecko: 5, mosquito: 6 };
  const list = world.ents.filter(e => !(e.kind === 'gecko' && e.surface === 'glass')).sort((a, b) => order[a.kind] - order[b.kind]);
  for (const e of list) DRAW[e.kind](e);
  drawSubstrate();
  drawWaterFront();
  drawFrame();
  drawFx();
  for (const e of world.ents) drawDebug(e, e === selected);
  if (selected && (world.ents.includes(selected) || world.decor.includes(selected))) drawSelection(selected);
}
