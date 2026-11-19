'use strict';
// =====================================================================
// pixel.js — 像素畫風（測試版）
// 畫面固定畫在 640×360 的格子上（只用調色盤的顏色、不做平滑），再整數倍放大到螢幕
// 鏡頭 1／2／4 倍：螢幕上每格大小不變，改成用更多格來畫（全景時 1 cm = 9 格）
// 模擬完全共用（world.js、creatures.js…），這裡只負責畫
// =====================================================================

const PXW = 640, PXH = 360;
// 畫面選項（像素版上的切換開關）
const PXOPT = {
  cscale: 1,          // 生物比例：1／1.5／2（只影響畫面，模擬不變）
  mute: false,        // 背景淡化：背景、造景、水草往水色靠、降低對比
  bright: false,      // 亮色細線：觸角、腳、口鬚改用亮色
  light: 'day',       // 燈光：day 明亮（跟著日夜）／aqua 水族館藍光／glow 夜光
  hybrid: false,      // 混合光影：放大後再疊平滑的半透明光束、暗角、水面光暈
  detail: true,       // 依格子數加細節＋自動清理雜點（關掉 = 改善前，給比較頁用）
};
const CREATURE = 9;   // 生物的格子在 PXB.tag 標成 9（燈光模式下保持明亮）
const PXCAM = { z: 1, x: 0, y: 0 };                                   // x, y：畫面左上角的世界座標
const ppu = () => .5 * PXCAM.z;                                       // 每個世界單位幾格
const AX = wx => (wx - PXCAM.x) * ppu(), AY = wy => (wy - PXCAM.y) * ppu();

// 顏色：'#rrggbb' → Uint32（ImageData 的 RGBA 位元組順序）
const _pc = {};
function C(h) {
  let v = _pc[h]; if (v !== undefined) return v;
  const r = parseInt(h.slice(1, 3), 16), g = parseInt(h.slice(3, 5), 16), b = parseInt(h.slice(5, 7), 16);
  return (_pc[h] = ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0);
}
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + .5) / 16);   // 4×4 抖色門檻
const bayer = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];
// 色帶之間只在交界處抖色（v 是連續的色階位置；edge = 每條色帶靠近下一條的多少比例要抖色）
const band = (v, x, y, edge = .25) => { const b = Math.floor(v), f = v - b; return f > 1 - edge && bayer(x, y) < (f - (1 - edge)) / edge ? b + 1 : b; };
function mixU(a, b, t) {                                              // 兩個 Uint32 顏色混合
  const r = (a & 255) + ((b & 255) - (a & 255)) * t, g = ((a >> 8) & 255) + (((b >> 8) & 255) - ((a >> 8) & 255)) * t, bl = ((a >> 16) & 255) + (((b >> 16) & 255) - ((a >> 16) & 255)) * t;
  return ((255 << 24) | (Math.round(bl) << 16) | (Math.round(g) << 8) | Math.round(r)) >>> 0;
}
const hash2 = (x, y, s = 0) => { const n = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453; return n - Math.floor(n); };

// ---------------------------------------------------------------------
// 像素緩衝區
// ---------------------------------------------------------------------
class PixBuf {
  constructor(w, h) { this.w = w; this.h = h; this.d = new Uint32Array(w * h); this.tag = new Uint8Array(w * h); this.resetBox(); }
  resetBox() { this.x0 = this.w; this.y0 = this.h; this.x1 = -1; this.y1 = -1; }
  set(x, y, c, tag = 0) {
    x = Math.floor(x + .5); y = Math.floor(y + .5);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = y * this.w + x; this.d[i] = c; this.tag[i] = tag;
    if (x < this.x0) this.x0 = x; if (x > this.x1) this.x1 = x; if (y < this.y0) this.y0 = y; if (y > this.y1) this.y1 = y;
  }
  // 掃描線填色；c 可以是顏色或 (x, y) => 顏色
  poly(pts, c, tag = 1) {
    if (!pts || pts.length < 3) return;
    let ya = Infinity, yb = -Infinity; for (const p of pts) { if (p.y < ya) ya = p.y; if (p.y > yb) yb = p.y; }
    const fn = typeof c === 'function', col = fn ? 0 : (typeof c === 'string' ? C(c) : c);
    for (let y = Math.max(0, Math.floor(ya)); y <= Math.min(this.h - 1, Math.ceil(yb)); y++) {
      const xs = [], yc = y + .5;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const a = pts[i], b = pts[j];
        if ((a.y <= yc && b.y > yc) || (b.y <= yc && a.y > yc)) xs.push(a.x + (yc - a.y) / (b.y - a.y) * (b.x - a.x));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const xa = Math.max(0, Math.ceil(xs[k] - .5)), xb = Math.min(this.w - 1, Math.floor(xs[k + 1] - .5));
        for (let x = xa; x <= xb; x++) { const v = fn ? c(x, y) : col; if (v) this.set(x, y, typeof v === 'string' ? C(v) : v, tag); }
      }
    }
  }
  line(x0, y0, x1, y1, c, tag = 0) {                                   // Bresenham
    x0 = Math.floor(x0 + .5); y0 = Math.floor(y0 + .5); x1 = Math.floor(x1 + .5); y1 = Math.floor(y1 + .5);
    const fn = typeof c === 'function', col = fn ? 0 : (typeof c === 'string' ? C(c) : c);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let err = dx + dy, n = 0;
    for (;;) {
      const v = fn ? c(x0, y0, n++) : col; if (v) this.set(x0, y0, typeof v === 'string' ? C(v) : v, tag);
      if (x0 === x1 && y0 === y1) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; }
      if (n > 4000) break;
    }
  }
  path(pts, c, tag = 0) { for (let i = 0; i + 1 < pts.length; i++) this.line(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y, c, tag); }
  disc(cx, cy, r, c, tag = 1) {
    const col = typeof c === 'string' ? C(c) : c;
    if (r < .75) { this.set(cx - .5, cy - .5, col, tag); return; }
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++)
      if ((x + .5 - cx) ** 2 + (y + .5 - cy) ** 2 <= r * r) this.set(x, y, col, tag);
  }
  // 選擇性外框：有 tag = 1（殼／身體）的區塊外圍加一圈；上緣用 top（受光面較淡），其他用 other
  outline(top, other) {
    const ct = C(top), co = C(other), w = this.w;
    const xa = Math.max(0, this.x0 - 1), xb = Math.min(w - 1, this.x1 + 1), ya = Math.max(0, this.y0 - 1), yb = Math.min(this.h - 1, this.y1 + 1);
    const marks = [];
    for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) {
      const i = y * w + x; if (this.d[i]) continue;
      const body = (xx, yy) => { if (xx < 0 || yy < 0 || xx >= w || yy >= this.h) return false; const t = this.tag[yy * w + xx]; return t === 1 || t === 4; };
      if (body(x, y + 1)) marks.push(i, ct); else if (body(x, y - 1) || body(x - 1, y) || body(x + 1, y)) marks.push(i, co);
    }
    for (let k = 0; k < marks.length; k += 2) { this.d[marks[k]] = marks[k + 1]; this.tag[marks[k]] = 2; }
    this.x0 = xa; this.x1 = xb; this.y0 = ya; this.y1 = yb;
  }
  // 自動清理（像素畫師手動做的事）：去掉孤立的雜點、補單格破洞、把夾在同色中間的單格雜色換掉
  // 只看身體（tag 1）和鰭（tag 4）；之後才畫的亮點、細線不受影響
  cleanup() {
    if (this.x1 < 0) return;
    const w = this.w, xa = Math.max(1, this.x0 - 1), xb = Math.min(w - 2, this.x1 + 1), ya = Math.max(1, this.y0 - 1), yb = Math.min(this.h - 2, this.y1 + 1);
    const bw = xb - xa + 1, bh = yb - ya + 1, cd = new Uint32Array(bw * bh), ct = new Uint8Array(bw * bh);
    for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) { const i = (y + ya) * w + x + xa; cd[y * bw + x] = this.d[i]; ct[y * bw + x] = this.tag[i]; }
    const isB = (x, y) => x >= 0 && y >= 0 && x < bw && y < bh && (ct[y * bw + x] === 1 || ct[y * bw + x] === 4);
    for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
      const j = y * bw + x, i = (y + ya) * w + x + xa, nb = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]].filter(([a, b]) => isB(a, b));
      if (isB(x, y)) {
        if (!nb.length) { this.d[i] = 0; this.tag[i] = 0; continue; }                    // 孤立的一格
        if (nb.length === 4) {                                                            // 四周同一個顏色、只有自己不同 → 換掉
          const c0 = cd[nb[0][1] * bw + nb[0][0]];
          if (c0 !== cd[j] && nb.every(([a, b]) => cd[b * bw + a] === c0)) this.d[i] = c0;
        }
      } else if (!cd[j] && nb.length >= 3) {                                              // 單格破洞 → 補上
        const [a, b] = nb[0]; this.d[i] = cd[b * bw + a]; this.tag[i] = ct[b * bw + a];
        if (xa + x < this.x0) this.x0 = xa + x; if (xa + x > this.x1) this.x1 = xa + x; if (ya + y < this.y0) this.y0 = ya + y; if (ya + y > this.y1) this.y1 = ya + y;
      }
    }
  }
  // 內側受光邊：身體上緣往內一格變亮、下緣往內一格變暗（像素畫最常用的立體感手法）
  rim(lightK = .3, darkK = .22, tags = [1]) {
    if (this.x1 < 0) return;
    const w = this.w, ch = [];
    const isIn = (x, y) => x >= 0 && y >= 0 && x < w && y < this.h && tags.includes(this.tag[y * w + x]);
    for (let y = this.y0; y <= this.y1; y++) for (let x = this.x0; x <= this.x1; x++) {
      if (!isIn(x, y)) continue; const i = y * w + x;
      if (!isIn(x, y - 1)) ch.push(i, mixU(this.d[i], 0xffffffff, lightK));
      else if (!isIn(x, y + 1)) ch.push(i, mixU(this.d[i], 0xff201018, darkK));
    }
    for (let k = 0; k < ch.length; k += 2) this.d[ch[k]] = ch[k + 1];
  }
  // 只畫在某種 tag 的格子上（例如鰭條只畫在鰭上）
  lineOn(x0, y0, x1, y1, c, onTag) { const col = typeof c === 'string' ? C(c) : c, w = this.w; this.line(x0, y0, x1, y1, (x, y) => (x >= 0 && y >= 0 && x < w && y < this.h && this.tag[y * w + x] === onTag) ? col : 0, onTag); }
  // 只畫在已經有身體的格子上（例如鱗片亮點不會跑出輪廓）
  setOn(x, y, c, onTags = [1]) { x = Math.floor(x + .5); y = Math.floor(y + .5); if (x < 0 || y < 0 || x >= this.w || y >= this.h) return; const i = y * this.w + x; if (onTags.includes(this.tag[i])) this.d[i] = typeof c === 'string' ? C(c) : c; }
  // 把有畫的格子貼到另一張緩衝區，並清掉自己（給精靈用的暫存區）
  blitTo(dst) {
    if (this.x1 < 0) return;
    const w = this.w;
    for (let y = this.y0; y <= this.y1; y++) for (let x = this.x0, i = y * w + this.x0; x <= this.x1; x++, i++)
      if (this.d[i]) { dst.d[i] = this.d[i]; dst.tag[i] = this.blitTag; this.d[i] = 0; this.tag[i] = 0; }
    this.resetBox();
  }
}
const PXB = new PixBuf(PXW, PXH);                                     // 主畫面
const SPR = new PixBuf(PXW, PXH);                                     // 精靈暫存（每隻生物先畫在這裡、加外框，再貼上主畫面）
SPR.blitTag = 0;
const LAYER = { back: { key: '', d: new Uint32Array(PXW * PXH) }, decor: { key: '', d: new Uint32Array(PXW * PXH) }, front: { key: '', d: new Uint32Array(PXW * PXH) } };
function sprite(draw, top, other, tag = 0) { draw(SPR); if (top) SPR.outline(top, other); SPR.blitTag = tag; SPR.blitTo(PXB); }
const live = (draw, top, other) => sprite(draw, top, other, CREATURE);   // 生物用（標記成 CREATURE）
// 背景淡化：顏色往水的中間色靠、降低對比
const _mute = new Map();
function muteColor(v, k = .38) {
  let m = _mute.get(v); if (m !== undefined) return m;
  const r = v & 255, g = (v >> 8) & 255, b = (v >> 16) & 255, wr = 0x7c, wg = 0xb4, wb = 0xc8;
  m = ((255 << 24) | (Math.round(lerp(b, wb, k)) << 16) | (Math.round(lerp(g, wg, k)) << 8) | Math.round(lerp(r, wr, k))) >>> 0;
  _mute.set(v, m); return m;
}
const muteHex = h => PXOPT.mute ? mixColor(h, '#7cb4c8', .38) : h;
function layerFill(L, key, draw, opaque) {                            // 靜態圖層：內容沒變就直接用上次的結果
  key += '|' + PXOPT.mute;
  if (L.key !== key) {
    const tmp = new PixBuf(PXW, PXH); draw(tmp);
    if (PXOPT.mute) for (let i = 0; i < tmp.d.length; i++) if (tmp.d[i]) tmp.d[i] = muteColor(tmp.d[i]);
    L.d.set(tmp.d); L.key = key;
  }
  if (opaque) PXB.d.set(L.d);
  else { const s = L.d, d = PXB.d; for (let i = 0; i < s.length; i++) if (s[i]) d[i] = s[i]; }
}
// 局部座標 → 畫面格子：原點 (wx, wy)、縮放 s（每單位幾格）、sx 左右（±1）、可選旋轉（繞局部 pivot）
function mapper(wx, wy, s, sx = 1, sy = 1, rot = 0, pvx = 0, pvy = 0) {
  const ox = AX(wx), oy = AY(wy), c = Math.cos(rot), si = Math.sin(rot);
  return p => { let x = p.x - pvx, y = p.y - pvy; const rx = x * c - y * si + pvx, ry = x * si + y * c + pvy; return P(ox + rx * s * sx, oy + ry * s * sy); };
}

// ---------------------------------------------------------------------
// 調色盤
// ---------------------------------------------------------------------
const PXPAL = {
  air: ['#eef3ee', '#e2eae4'], water: ['#9fd0de', '#86c0d2', '#6eafc6', '#5a9dba', '#4a8aa8'], wall: ['#87968f', '#74837c', '#63716b', '#55625c'],
  sand: ['#d6c194', '#c8b285', '#b39b6e', '#9a8158', '#7e6744'], stone: ['#cfd4d5', '#a9afb1', '#868d90', '#666d70', '#4a5053'], stoneOl: '#2f3436',
  wood: ['#c29c6c', '#9e7a52', '#7e5e3c', '#5e432a', '#40301c'], woodOl: '#2c1e10', leaf: ['#8fd06a', '#66b356', '#4a9a48', '#357a3c', '#24592e'],
  metal: ['#7a868c', '#5c676d', '#454f54', '#30373b'], frame: ['#4a535a', '#3a4148', '#2a3036', '#1e2226'], food: ['#d7a05a', '#a8763e', '#7a5226'],
  white: '#ffffff', black: '#101014', bubble: '#eefbff', algae: '#4f7a32',
};
const PX_SHRIMP = [                                                   // 櫻花蝦三個色級（亮 → 暗，暗部偏紫紅、亮部偏橘）
  { hi: '#ffe9dc', li: '#ffc8b6', base: '#f4a090', sh: '#d6727c', dk: '#a04c66', ol: '#64304a', spot: '#d8283a', spot2: '#f0505a', fan: '#ffd2c4', leg: '#f0a09a', clear: true },
  { hi: '#ffc49c', li: '#ff8466', base: '#ee4c40', sh: '#c22c40', dk: '#801838', ol: '#4c0e2a', spot: '#b0122c', spot2: '#ff6a52', fan: '#ff9a80', leg: '#e85a50' },
  { hi: '#ffa070', li: '#ff5c3e', base: '#e0262a', sh: '#aa1230', dk: '#6c0a2c', ol: '#3e0620', spot: '#9c0a28', spot2: '#ff4a36', fan: '#f04a3a', leg: '#d8302e' },
];
const PX_MOLT = { hi: '#fbf4ee', li: '#f4e8e0', base: '#eadcd2', sh: '#d8c6bc', dk: '#c0aca2', ol: '#a89488', spot: '#eadcd2', spot2: '#eadcd2', fan: '#f4e8e0', leg: '#d8c6bc', clear: true, molt: true };
const PX_CORY = [
  { ramp: ['#ecdcbc', '#bea878', '#9c8862', '#706244', '#4a4028'], sheen: '#5f9a80', cheek: '#c98a58', fin: '#dccfb4', finDk: '#a8946e', eye: '#151515', ring: '#c9a860' },
  { ramp: ['#fff4ec', '#f6dccc', '#ecc8b6', '#d4ad98', '#a8806e'], sheen: '#f8c8b8', cheek: '#f0a8a0', fin: '#fbefe8', finDk: '#e0c4b8', eye: '#d42a3a', ring: '#f6c4bc' },
  { ramp: ['#fffaf3', '#f2eadf', '#e6dccc', '#c9bba8', '#9a8c78'], sheen: '#f6e4d6', cheek: '#f4c4b4', fin: '#f6f2ea', finDk: '#d8d0c2', eye: '#151515', ring: '#ddd0b4', panda: '#1c1c1c' },
];

// ---------------------------------------------------------------------
// 背景（靜態）：空氣、岩壁、水、遠景水草
// ---------------------------------------------------------------------
function waterRamp() {                                                // 水色：藻類多偏綠、髒偏黃褐
  const al = world.water.algae / 100, dt = world.water.dirt / 100;
  return PXPAL.water.map(c => mixColor(mixColor(c, '#7fae6a', Math.min(.5, al * .6)), '#a89a6a', Math.min(.5, Math.max(0, dt - .3))));
}
function drawPxBack(B) {
  const wyA = AY(world.waterY), floorA = AY(TANK.floor), wr = waterRamp().map(C), air = PXPAL.air.map(C);
  for (let y = 0; y < PXH; y++) {
    const inW = y >= wyA;
    for (let x = 0; x < PXW; x++) {
      let c;
      if (!inW) c = air[clamp(band((y - AY(TANK.top)) / Math.max(1, wyA - AY(TANK.top)) * 1.2, x, y), 0, 1)];
      else { const t = (y - wyA) / Math.max(1, floorA - wyA); c = wr[clamp(band(t * 4, x, y), 0, 4)]; }   // 上淺下深，只在色帶交界抖色
      B.d[y * PXW + x] = c;
    }
  }
  // 背面岩壁：兩種深淺，頂端一條受光
  const wall = PXPAL.wall;
  for (const b of SCENERY.back) {
    const pts = [], n = 12;
    for (let i = 0; i <= n; i++) { const u = i / n, x = b.x - b.w / 2 + b.w * u; pts.push(P(AX(x), AY(TANK.floor - b.h * Math.pow(Math.sin(Math.PI * u), .7) * (1 + Math.sin(u * 9 + b.k * 7) * .06)))); }
    pts.push(P(AX(b.x + b.w / 2), AY(TANK.floor)), P(AX(b.x - b.w / 2), AY(TANK.floor)));
    const under = y => y >= wyA;
    const k = b.k;
    B.poly(pts, (x, y) => under(y) ? (k < .5 ? wr[2] : wr[3]) : (k < .5 ? wall[1] : wall[2]), 0);   // 前後兩種深淺（平塗）
    for (let i = 1; i < 6; i++) B.line(pts[i].x, pts[i].y + 1, pts[i + 1].x, pts[i + 1].y + 1, (x, y) => under(y) ? wr[1] : wall[0]);
  }
  // 遠景水草（淡、不動）
  const r = rng(W * 7 + 3);
  for (const f of SCENERY.far) for (let k = 0; k < f.n; k++) {
    const x0 = f.x + k * 9 - f.n * 4, h = f.h * (.7 + r() * .4), pts = [];
    for (let i = 0; i <= 6; i++) { const t = i / 6; pts.push(P(AX(x0 + Math.sin(t * 3 + f.k * 5 + k) * 6 * t), AY(TANK.floor - h * t))); }
    B.path(pts, (x, y) => y > wyA ? wr[3] : 0);
  }
}

// 光束：每幀畫（會慢慢擺動），用稀疏的抖色表現半透明
function drawPxShafts() {
  const L = daylight(), wy = world.waterY; if (L <= 0 || wy >= TANK.floor) return;
  const lite = C(mixColor(waterRamp()[0], '#ffffff', .35)), thr = .14 * L;
  for (let x0 = TANK.left + 80; x0 < TANK.right; x0 += 260) {
    const sway = Math.sin(world.t * .3 + x0 * .01) * 30, w = 50 + Math.sin(x0) * 20;
    const pts = [P(x0 + sway, wy), P(x0 + sway + w, wy), P(x0 + sway * 2 + w * 2.2 + 60, TANK.floor), P(x0 + sway * 2 - 30, TANK.floor)].map(p => P(AX(p.x), AY(p.y)));
    PXB.poly(pts, (x, y) => bayer(x, y) < thr ? lite : 0, 0);
  }
}

// ---------------------------------------------------------------------
// 造景
// ---------------------------------------------------------------------
function drawPxRock(B, d) {
  const ol = decorOutline(d, 36), pts = ol.map(p => P(AX(p.x), AY(p.y))), S = PXPAL.stone.map(C), r = rng(d.seed), s = ppu();
  const top = x => { const sp = decorSpan(d, clamp(PXCAM.x + x / s, d.x - d.w / 2 + .5, d.x + d.w / 2 - .5)); return sp ? AY(sp.top) : AY(d.y); };
  const bot = AY(d.y), lx = AX(d.x - d.w * .2);
  B.poly(pts, (x, y) => {                                               // 光從左上：越上面、越左邊越亮，抖色過渡
    const t = (y - top(x)) / Math.max(1, bot - top(x)), side = (x - lx) / Math.max(1, d.w * s);
    return S[clamp(band(t * 3 + side * 1.4 + .3, x, y, .35), 0, 4)];
  });
  for (let i = 0; i < 3 + d.w / 80; i++) {                               // 裂紋
    const x0 = d.x + (r() - .5) * d.w * .6, sp = decorSpan(d, x0); if (!sp) continue;
    let p = P(x0, lerp(sp.top + 8, d.y - 6, r() * .6));
    for (let k = 0; k < 3; k++) { const q = P(p.x + (r() - .5) * 16, p.y + 4 + r() * 10); B.line(AX(p.x), AY(p.y), AX(q.x), AY(q.y), S[4]); p = q; }
  }
  for (let i = 0; i < d.w / 6; i++) { const x = d.x + (r() - .5) * d.w * .9, sp = decorSpan(d, x); if (sp) B.set(AX(x), AY(lerp(sp.top + 4, d.y - 3, r())), r() < .5 ? S[0] : S[4]); }
  const al = world.water.algae / 100;                                    // 水下表面的藻膜
  if (al > .05) for (let i = 0; i + 1 < ol.length - 2; i++) if (ol[i].y > world.waterY + 4) B.line(AX(ol[i].x), AY(ol[i].y), AX(ol[i + 1].x), AY(ol[i + 1].y), C(PXPAL.algae));
}
function drawPxWood(B, d) {
  const [a, b] = woodEnds(d), c = Math.cos(d.rot), si = Math.sin(d.rot), nx = -si * d.h / 2, ny = c * d.h / 2, Wd = PXPAL.wood.map(C);
  const body = chaikin([P(a.x + nx, a.y + ny), P(a.x - nx, a.y - ny), P(b.x - nx, b.y - ny), P(b.x + nx, b.y + ny)], true, 1).map(p => P(AX(p.x), AY(p.y)));
  const s = ppu();
  B.poly(body, (x, y) => {                                               // 依離中心線的距離上色：上緣亮、下緣暗
    const wx = PXCAM.x + (x + .5) / s, wy = PXCAM.y + (y + .5) / s, v = ((wx - d.x) * -si + (wy - d.y) * c) / (d.h / 2);   // -1 上 … 1 下
    const along = (wx - d.x) * c + (wy - d.y) * si, grain = Math.sin(along * .12 + Math.sin(along * .03 + d.seed) * 2 + v * 3) > .82;
    return Wd[clamp(band((v + 1) * 1.8 + .4, x, y, .3) + (grain ? 1 : 0), 0, 4)];
  });
  for (const k of [.3, .68]) { const p = P(lerp(a.x, b.x, k) + nx * .2, lerp(a.y, b.y, k) + ny * .2); B.disc(AX(p.x), AY(p.y), Math.max(1, d.h * .22 * s), Wd[4]); B.disc(AX(p.x) - .5, AY(p.y) - .5, Math.max(.6, d.h * .1 * s), Wd[2]); }   // 樹瘤
  const al = world.water.algae / 100;
  if (al > .05) for (let k = 0; k < 1; k += .05) { const p = P(lerp(a.x, b.x, k) - nx, lerp(a.y, b.y, k) - ny), q = P(lerp(a.x, b.x, k + .05) - nx, lerp(a.y, b.y, k + .05) - ny); if (p.y > world.waterY + 4) B.line(AX(p.x), AY(p.y), AX(q.x), AY(q.y), C(PXPAL.algae)); }
}
function drawPxBubbler(B, d) {
  const M = PXPAL.metal.map(C);
  B.poly(ellipsePts(d.x, d.y - 5, d.w / 2, d.h / 2, 0, 14).map(p => P(AX(p.x), AY(p.y))), (x, y) => M[clamp(Math.floor((y - AY(d.y - 10)) / Math.max(1, 10 * ppu()) * 2.5 + bayer(x, y) * .8), 0, 3)]);
  B.path([P(d.x + d.w / 2 - 2, d.y - 6), P(d.x + d.w / 2 + 30, d.y - 2), P(TANK.right - 4, d.y - 2)].map(p => P(AX(p.x), AY(p.y))), M[3]);
}
function drawPxFilterBody(B, d) {
  const wy = world.waterY, x0 = d.x - d.w / 2, y0 = Math.min(wy - 24, d.y - d.h / 2), M = PXPAL.metal.map(C);
  const R = (x, y, w, h, f) => B.poly([P(AX(x), AY(y)), P(AX(x + w), AY(y)), P(AX(x + w), AY(y + h)), P(AX(x), AY(y + h))], f);
  R(x0 + 4, y0 - 8, d.w - 8, 10, M[3]);
  R(x0, y0, d.w, d.h, (x, y) => M[clamp(Math.floor(Math.abs((x - AX(d.x)) / Math.max(1, d.w * ppu() / 2)) * 2.4 + bayer(x, y) * .7), 0, 3)]);
  for (let i = 0; i < 5; i++) B.line(AX(x0 + 8), AY(y0 + 20 + i * 9), AX(x0 + d.w - 8), AY(y0 + 20 + i * 9), M[3]);
  R(d.x - 3, y0 + d.h, 6, 70, M[1]); R(d.x - 6, y0 + d.h + 70, 12, 16, M[3]);
}
function drawPxPlant(d) {                                              // 水草：會擺動，每幀畫
  const wy = world.waterY, L = PXPAL.leaf.map(muteHex), s = ppu();
  sprite(B => {
    for (let k = 0; k < 4; k++) {
      const pts = [], hk = d.h * (.7 + .3 * Math.sin(d.seed + k * 2.1));
      for (let i = 0; i <= 8; i++) {
        const t = i / 8, y = d.y - hk * t, under = y > wy;
        const sway = under ? Math.sin(world.t * 1.4 + k * 1.3 + t * 3 + d.seed) * 12 * t : 4 * t;
        pts.push(P(d.x + (k - 1.5) * 9 + sway + Math.sin(k + t * 4) * 4, y));
      }
      const stem = k % 2 ? L[3] : L[2], A = pts.map(p => P(AX(p.x), AY(p.y)));
      for (let w = 0; w < Math.max(1, Math.round(4.5 * s * .5)); w++) B.path(A.map(p => P(p.x + w, p.y)), stem, 1);
      for (let i = 2; i < pts.length; i++) {                             // 葉子：一片片小橢圓，上緣亮一點
        const p = pts[i], sd = i % 2 ? 1 : -1, cx = p.x + sd * 6, leaf = ellipsePts(cx, p.y, 7, 2.6, sd * .5, 10).map(q => P(AX(q.x), AY(q.y)));
        B.poly(leaf, (x, y) => y < AY(p.y) - .3 * s ? L[k % 2 ? 1 : 0] : L[k % 2 ? 2 : 1]);
      }
    }
  }, L[3], L[4]);
}
function drawPxFloater(d) {
  const wy = world.waterY; if (wy >= TANK.floor - 4) return;
  const r = rng(d.seed), n = Math.round(d.w / 16), L = PXPAL.leaf.map(muteHex);
  for (let i = 0; i < n; i++) {                                          // 根
    const x = d.x - d.w / 2 + r() * d.w, len = 10 + r() * 22, sw = Math.sin(world.t * 1.2 + i) * 3;
    PXB.path([P(x, wy + 2), P(x + sw * .5, wy + len * .5), P(x + sw, wy + len)].map(p => P(AX(p.x), AY(p.y))), (x2, y2) => (x2 + y2) & 1 ? C('#dfe8d4') : 0);
  }
  const r2 = rng(d.seed + 1);
  sprite(B => {
    for (let i = 0; i < n * 1.6; i++) {
      const x = d.x - d.w / 2 + r2() * d.w, rr = 4 + r2() * 4, bob = Math.sin(world.t * 1.5 + x * .05) * .8, light = r2() < .5;
      B.poly(ellipsePts(x, wy + bob, rr, rr * .38, 0, 10).map(p => P(AX(p.x), AY(p.y))), (xx, yy) => yy < AY(wy + bob) ? L[0] : L[light ? 1 : 2]);
    }
  }, L[3], L[4]);
}
function drawPxFilterBubbles(d) {
  const wy = world.waterY, x0 = d.x - d.w / 2; if (wy >= TANK.floor - 10) return;
  for (let i = 0; i < 6; i++) { const t = (world.t * 1.6 + i / 6) % 1; if (t > .8) continue; PXB.set(AX(x0 - 6 - t * 18), AY(wy + 6 + t * 26 + Math.sin(i * 3 + world.t * 5) * 2), C(PXPAL.bubble)); }
}
// 前景：底沙、缸框（靜態）
function drawPxFront(B) {
  const Sd = PXPAL.sand.map(C), fl = AY(TANK.floor);
  for (let y = Math.max(0, Math.floor(fl)); y < PXH; y++) for (let x = 0; x < PXW; x++) {
    const wx = Math.floor(PXCAM.x * ppu()) + x, wy = Math.floor(PXCAM.y * ppu()) + y, r = hash2(wx, wy, 5);
    const depth = (y - fl) / Math.max(1, AY(H) - fl);
    B.d[y * PXW + x] = y === Math.floor(fl) ? Sd[0] : Sd[clamp(Math.floor(1 + depth * 2.2 + (r < .1 ? 1.2 : r > .92 ? -1 : 0) + bayer(x, y) * .5), 0, 4)];
  }
  for (const s of SAND) if (s.r > 2.4) B.disc(AX(s.x), AY(s.y), Math.max(.6, s.r * ppu() * .8), C(s.c), 0);   // 小石子
  const F = PXPAL.frame.map(C);
  const R = (x, y, w, h, c) => B.poly([P(AX(x), AY(y)), P(AX(x + w), AY(y)), P(AX(x + w), AY(y + h)), P(AX(x), AY(y + h))], c, 0);
  R(0, 0, W, TANK.top, (x, y) => (x & 3) === 0 && y > AY(4) && y < AY(TANK.top - 4) ? F[0] : (y < AY(TANK.top) - 2 ? F[1] : F[2]));   // 上蓋（網子）
  R(0, 0, TANK.left, H, F[2]); R(TANK.right, 0, W - TANK.right, H, F[2]); R(0, H - 6, W, 6, F[3]);
}

// ---------------------------------------------------------------------
// 魚（孔雀魚、紅蓮燈／日光燈、通用）：直接用遊戲裡的骨架點，點陣化
// ---------------------------------------------------------------------
const PX_FISH = {
  guppy: { ramp: ['#eef4f8', '#c4d4e0', '#9cb2c4', '#6e8aa2', '#465e74'], fin: '#d6e2ea', ol: '#2c3c4c' },
  tetra: { ramp: ['#f2f6f8', '#cfd8de', '#a2b0ba', '#728290', '#465460'], fin: '#e2eaef', ol: '#2e3a44', red: ['#ff7484', '#ff3348', '#c41e36'], blue: ['#b8f8ff', '#40d8ff', '#1a90c8'] },
};
function drawPxFish(e) {
  const sp = SPECIES[e.type]; if (sp.cory) return drawPxCory(e);
  const lk = sp.look, R = fishRig(e), n = R.nodes, tb = n[FISH_N - 1], k = e.size * sp.len / 64, s = ppu() * k * PXOPT.cscale;
  const shape = lk.shape, pal = PX_FISH[shape === 'tetra' ? 'tetra' : 'guppy'], Rm = pal.ramp;
  const juv = e.size < e.adult * .6, male = e.sex === 'm' && !juv, M = GUPPY_MORPHS[e.morph || 0];
  const T = mapper(e.x, e.y, s, R.sx, e.dead ? -1 : 1);
  const ct = Math.cos(R.tailRot), st = Math.sin(R.tailRot);
  const TT = q => T(P(tb.x + q.x * R.tailSx * ct - q.y * st, tb.y + q.x * R.tailSx * st + q.y * ct));
  const Lpx = 64 * s, D = PXOPT.detail;                                  // Lpx：這隻魚在畫面上有幾格長（決定畫多少細節）
  const FIN = 4;
  live(B => {
    // 尾鰭
    let tail;
    if (shape === 'guppy') {
      tail = guppyTailPts(e, male);
      if (male) {
        B.poly(tail.map(TT), M.tail[2], FIN);                             // 外圈深
        B.poly(tail.map(q => TT(P(q.x * .72, q.y * .72))), M.tail[1], FIN);
        B.poly(tail.map(q => TT(P(q.x * .4, q.y * .45))), M.tail[0], FIN);   // 靠近尾柄淡
      } else B.poly(tail.map(TT), pal.fin, FIN);
    } else {
      tail = FISH_TAILS[lk.tailType || 'fork'];
      B.poly(tail.map(TT), pal.fin, FIN);
    }
    // 背鰭、臀鰭
    const F = fishFins(n, lk.dorsalTall);
    const finCol = shape === 'guppy' && male ? M.tail[1] : pal.fin;
    B.poly(F.dorsal.map(T), finCol, FIN); B.poly(F.anal.map(T), finCol, FIN);
    // 身體：底色 → 背部暗 → 腹部亮
    const ol = [P(n[0].x + 5, n[0].y + 1), ...n.map(q => P(q.x, q.y - q.h)), ...n.map(q => P(q.x, q.y + q.h)).reverse()];
    B.poly(ol.map(T), Rm[1]);
    B.poly(fishBand(n, 0, FISH_N - 1, -1.1, -.3).map(T), Rm[2]);
    B.poly(fishBand(n, 0, FISH_N - 1, -1.1, -.72).map(T), Rm[3]);
    B.poly(fishBand(n, 1, FISH_N - 2, .4, 1.1).map(T), Rm[0]);
    if (shape === 'tetra') {                                              // 紅蓮燈：下半部紅色＋藍綠色金屬條紋
      B.poly(fishBand(n, lk.redFull ? 1 : 4, 7, .08, .92).map(T), pal.red[1]);
      B.poly(fishBand(n, lk.redFull ? 1 : 4, 7, .55, .92).map(T), pal.red[2]);
      B.poly(fishBand(n, 1, 7, -.5, -.08).map(T), pal.blue[1]);
    }
    if (shape === 'guppy' && male) B.poly(fishBand(n, 4, 7, -.3, .5).map(T), M.patch[0]);   // 孔雀魚公魚：身上的彩斑
    if (D) B.cleanup();                                                    // ↑ 色塊　↓ 刻意放的細節
    if (D && Lpx >= 28) B.rim(.32, .2);
    // ---- 細節（格子夠多才畫）----
    const fin2 = C(mixColor(finCol, '#000000', .28));
    if (!D) {                                                              // 改善前的舊細節
      if (shape === 'guppy' && male && s > .45) for (let i = 0; i < (M.cobra ? 14 : 6); i++) { const a2 = hash2(e.id, i) * 1.6 - .8, rr = .35 + hash2(i, e.id) * .5; const q = TT(P(-44 * rr, Math.sin(a2) * 22 * rr)); B.set(q.x, q.y, C(mixColor(M.tail[2], '#000000', .45)), FIN); }
      if (shape === 'tetra' && s > .45) B.path(fishBand(n, 1, 6, -.38, -.36).slice(0, 7).map(T), pal.blue[0]);
      if (shape === 'guppy' && male && n[3]) B.disc(T(n[3]).x, T(P(n[3].x, n[3].y + n[3].h * .1)).y, Math.max(.6, 3 * s), M.patch[1]);
    } else {
      if (Lpx >= 30) {                                                     // 鰭條：從鰭的根部放射出去，只畫在鰭上
        const base = TT(P(-2, 0)), rays = shape === 'guppy' && male ? 7 : 4;
        for (let r = 0; r < tail.length; r += Math.max(1, Math.floor(tail.length / rays))) { const q = TT(P(tail[r].x * .92, tail[r].y * .92)); B.lineOn(base.x, base.y, q.x, q.y, fin2, FIN); }
        for (const fn of [F.dorsal, F.anal]) { const f0 = T(fn[0]), m = Math.floor(fn.length / 2); for (let r = 1; r < fn.length - 1; r += Math.max(1, Math.floor(fn.length / 4))) { const q = T(fn[r]); B.lineOn(f0.x, f0.y, q.x, q.y, fin2, FIN); } }
      }
      if (shape === 'guppy' && male && Lpx >= 24) for (let i = 0; i < (M.cobra ? 18 : 8); i++) {   // 尾鰭斑點（每隻不同）
        const a2 = hash2(e.id, i) * 1.6 - .8, rr = .35 + hash2(i, e.id) * .5, q = TT(P(-44 * rr, Math.sin(a2) * 22 * rr));
        B.setOn(q.x, q.y, C(mixColor(M.tail[2], '#000000', .5)), [FIN]); if (Lpx >= 48) B.setOn(q.x + 1, q.y, C(mixColor(M.tail[2], '#000000', .5)), [FIN]);
      }
      if (Lpx >= 26 && shape !== 'tetra') B.path([2, 3, 4, 5].map(i => T(P(n[i].x, n[i].y - n[i].h * .5))), C(Rm[0]));   // 背上的光澤線
      if (shape === 'tetra') {
        if (Lpx >= 22) B.path(fishBand(n, 1, 7, -.5, -.48).slice(0, 7).map(T), C(pal.blue[0]));   // 金屬條紋上緣的亮線
        if (Lpx >= 40) B.path([2, 3, 4, 5, 6].map(i => T(P(n[i].x, n[i].y + n[i].h * .1))), C(pal.red[0]));   // 紅色的亮邊
      }
      if (Lpx >= 44) for (let x = n[2].x; x > n[6].x; x -= 4.2) for (const [fy, off] of [[-.18, 0], [.12, 2.1], [.4, 0]]) {   // 鱗片反光（交錯的亮點）
        const xi = Math.round((x + off) * 10) / 10, i0 = n.findIndex(q => q.x < xi); if (i0 < 1) continue;
        const q = n[i0], p = T(P(xi, q.y + q.h * fy)), cur = B.d[Math.floor(p.y + .5) * B.w + Math.floor(p.x + .5)];
        if (hash2(Math.round(xi * 3), Math.round(fy * 10), e.id) < .55) continue;   // 稀疏、錯落
        if (cur === C(Rm[1]) || cur === C(Rm[2]) || cur === C(Rm[0])) B.setOn(p.x, p.y, C(cur === C(Rm[0]) ? '#ffffff' : Rm[0]));
      }
      if (Lpx >= 24) B.path(arcPts(n[1].x + 6, n[1].y, 8 * (lk.hScale || 1) + 1, Math.PI * .65, Math.PI * 1.35, 6).map(T), C(Rm[3]));   // 鰓蓋線
      if (Lpx >= 30) {                                                     // 胸鰭（半透明、會擺動）
        const pf = Math.sin(e.pec || 0) * 2, b0 = P(n[1].x + 2, n[1].y + 2);
        B.poly([b0, P(n[1].x - 7, n[1].y + 6 + pf), P(n[1].x - 5, n[1].y + 2.5)].map(T), mixColor(pal.fin, '#ffffff', .35));
      }
      if (shape === 'guppy' && male && Lpx >= 40) for (let i = 0; i < 5; i++) { const q = n[3 + (i % 4)]; B.setOn(T(q).x + hash2(i, e.id) * 3 - 1, T(P(q.x, q.y + q.h * (hash2(e.id, i) - .5) * .8)).y, C(M.patch[1])); }   // 公魚身上的亮彩點
      if (shape === 'guppy' && e.sex === 'f' && (e.preg || 0) > .3 && Lpx >= 22) B.disc(T(n[4]).x, T(P(n[4].x, n[4].y + n[4].h * .4)).y, Math.max(.6, 2.6 * s), '#3a3a46');   // 懷孕的黑斑
    }
  }, Rm[3], pal.ol);
  // 眼睛：虹膜＋瞳孔＋反光；嘴
  const eye = T(P(n[0].x - 1, n[0].y - 2.5 * (lk.hScale || 1)));
  if (D && Lpx >= 30) { PXB.disc(eye.x, eye.y, 3.8 * s, C(shape === 'tetra' ? '#c8e8f0' : '#d8d0b0'), CREATURE); PXB.disc(eye.x, eye.y, 2.5 * s, C(PXPAL.black), CREATURE); }
  else PXB.disc(eye.x, eye.y, Math.max(.7, 3.6 * s), C(PXPAL.black), CREATURE);
  if (D ? Lpx >= 22 : s > .5) PXB.set(eye.x - Math.max(.6, s), eye.y - Math.max(.6, s * 1.2), C('#ffffff'), CREATURE);
  if (D && Lpx >= 36) { const m = T(P(n[0].x + 5, n[0].y + 1.6)); PXB.set(m.x, m.y, C(Rm[4]), CREATURE); }
}

// 鼠魚
function drawPxCory(e) {
  const sp = SPECIES[e.type], M = PX_CORY[e.morph || 0], Rm = M.ramp, k = e.size * sp.len / 64 * PXOPT.cscale, s = ppu() * k;
  const sx = Math.abs(e.sx === undefined ? e.dir : e.sx) < .2 ? .2 * Math.sign(e.sx || e.dir) : (e.sx === undefined ? e.dir : e.sx);
  const T = mapper(e.x, e.y + (e.dead ? 12 * k : 0), s, sx, e.dead ? -1 : 1, e.tilt || 0, 30, -4);
  const swing = Math.sin(e.phase) * (e.amp || .5) * .22, ct = Math.cos(swing), st = Math.sin(swing);
  const TT = q => T(P(-26.5 + q.x * ct - q.y * st, -7 + q.x * st + q.y * ct));
  live(B => {
    const Lpx = 64 * s, D = PXOPT.detail, FIN = 4;
    const tailPts = [P(1, -2.6), P(-6, -6), P(-14, -11.5), P(-11, -6), P(-9.5, -.2), P(-11, 6), P(-14, 10.5), P(-6, 5), P(1, 2.4)];
    const dorsal = [P(12, -21), P(7, -37), P(3.5, -35), P(-1, -27), P(-3, -20.6)];
    B.poly(tailPts.map(TT), M.fin, FIN);                                  // 尾鰭
    B.poly(dorsal.map(T), M.panda || M.fin, FIN);                         // 背鰭
    B.line(T(P(12, -21)).x, T(P(12, -21)).y, T(P(7.3, -36.6)).x, T(P(7.3, -36.6)).y, M.panda ? M.panda : M.finDk);
    B.poly([P(-17, -13.4), P(-19.5, -17.6), P(-23.5, -11)].map(T), M.fin, FIN);                     // 脂鰭
    B.poly([P(-12, -2.6), P(-19, .6), P(-20, -3.6)].map(T), M.fin, FIN);                             // 臀鰭
    const body = [...CORY_TOP, ...CORY_BOT].map(([x, y]) => P(x, y));
    B.poly(body.map(T), (x, y) => Rm[1]);
    B.poly([...CORY_TOP.map(([x, y]) => P(x, y)), ...CORY_TOP.slice().reverse().map(([x, y]) => P(x, y * .78 + 1.2))].map(T), Rm[2]);   // 背部較暗
    B.poly([...CORY_BOT.map(([x, y]) => P(x, y)), ...CORY_BOT.slice().reverse().map(([x, y]) => P(x, y - 2.4))].map(T), Rm[0]);       // 腹部亮
    B.poly(ellipsePts(-1, -11.5, 19, 3.4, .1, 14).map(T), M.sheen);     // 側面光澤
    B.poly(ellipsePts(22, -8.5, 5.5, 3.6, -.3, 10).map(T), M.cheek);    // 鰓蓋
    if (D) B.cleanup();
    if (D && Lpx >= 28) B.rim(.3, .22);
    if (D && Lpx >= 30) {                                                 // 鰭條、尾鰭斑點
      const fd = C(M.panda ? '#3a3a3a' : M.finDk), b0 = TT(P(-1, 0));
      for (const q of [tailPts[2], tailPts[3], tailPts[5], tailPts[6]]) { const p = TT(q); B.lineOn(b0.x, b0.y, p.x, p.y, fd, FIN); }
      const d0 = T(P(10, -21)); for (const q of [P(5, -33), P(1.5, -29)]) { const p = T(q); B.lineOn(d0.x, d0.y, p.x, p.y, fd, FIN); }
      if (!M.panda && M.ring !== '#f6c4bc') for (const [x, y] of [[-7, -5], [-10, -8], [-6, 3], [-10, 6], [-4, -1]]) { const p = TT(P(x, y)); B.setOn(p.x, p.y, C(M.finDk), [FIN]); }
    }
    if (D && Lpx >= 24) B.path(arcPts(20.5, -9, 8.5, Math.PI * .62, Math.PI * 1.25, 6).map(T), C(Rm[3]));   // 鰓蓋線
    if (D ? Lpx >= 34 : s > .6) {                                         // 骨板的接縫
      const midY = x => lerp(-12.2, -7, (24 - x) / 50);
      for (let i = 0; i < 9; i++) { const x = 15 - i * 4.8; B.line(T(P(x + 1, coryBodyY(x + 1, true) + 1)).x, T(P(x + 1, coryBodyY(x + 1, true) + 1)).y, T(P(x, midY(x))).x, T(P(x, midY(x))).y, Rm[3]); }
      const mid = []; for (let x = 24; x >= -26; x -= 4) mid.push(T(P(x, lerp(-12.2, -7, (24 - x) / 50))));
      B.path(mid, Rm[3]);
      if (D && Lpx >= 48) for (let i = 0; i < 9; i++) { const x = 13.6 - i * 4.8; B.path([T(P(x, coryBodyY(x, true) + 1.6)), T(P(x - .6, (coryBodyY(x, true) + midY(x)) / 2))], C(Rm[0])); }   // 每片骨板的受光邊
    }
    if (M.panda) {
      B.poly([P(24.5, -18.6), P(19.5, -19), P(19, -12), P(20.5, -6.5), P(25, -6), P(26, -12)].map(T), M.panda);
      B.poly([P(11, -20.8), P(-1, -20.3), P(1, -15), P(9, -15.5)].map(T), M.panda);
      B.poly(ellipsePts(-24, -7.2, 3, 2.6, 0, 8).map(T), M.panda);
    }
  }, Rm[3], Rm[4]);
  // 眼睛、口鬚、胸鰭（外框之後）
  const wink = e.winkT > 0 ? Math.sin(Math.PI * e.winkT / .4) : 0, ec = T(P(22.3, -13));
  PXB.disc(ec.x, ec.y, Math.max(.8, 3.7 * s), C(M.ring), CREATURE);
  PXB.disc(ec.x, ec.y + wink * 1.5 * s, Math.max(.6, (2.6 - wink * .4) * s), C(M.eye), CREATURE);
  if (s > .5 && wink < .5) PXB.set(ec.x - .8 * s, ec.y - 1 * s, C('#ffffff'), CREATURE);
  const barbel = C(PXOPT.bright ? '#fff4dc' : M.finDk);
  if (s > .45) for (const [dx, len, ang] of [[0, 3.6, 1.15], [-1.8, 2.6, 1.75]]) { const a = T(P(31 + dx, -4.4)), b = T(P(31 + dx + Math.cos(ang) * len, -4.4 + Math.sin(ang) * len)); PXB.line(a.x, a.y, b.x, b.y, barbel, CREATURE); }
  const pc = T(P(18.5, -4.6)), pt = T(P(9, 0));
  PXB.line(pc.x, pc.y, pt.x, pt.y, C(PXOPT.bright ? M.fin : M.finDk), CREATURE);
}

// ---------------------------------------------------------------------
// 櫻花蝦（和比較頁同一套）
// ---------------------------------------------------------------------
function pxShrimpRig(st) {
  const c = st.curl || 0, R = {};
  R.ab = []; let p = P(4.5, -8.4), a = Math.PI + .18; const Hh = [3.4, 3.2, 3, 2.7, 2.3, 1.9];
  for (let i = 0; i < 6; i++) { a -= .085 + c * .42 + Math.sin(st.t * 3 - i * .7) * .01; const q = P(p.x + Math.cos(a) * 3.3, p.y + Math.sin(a) * 3.3); R.ab.push({ a: p, b: q, h: Hh[i], ang: a }); p = q; }
  const last = R.ab[5]; R.tail = { at: last.b, ang: last.ang, spread: .45 + c * .35 };
  R.legs = [];
  const roots = [18, 15.8, 13.4, 11, 8.6];
  for (let i = 0; i < 5; i++) {
    const root = P(roots[i], -6.4), L1 = i < 2 ? 4.2 : 5, L2 = i < 2 ? 4 : 5.2;
    let foot;
    if (st.act === 'pick' && i < 2) { const kk = (Math.sin(st.t * 6 + i * Math.PI) + 1) / 2; foot = P(lerp(root.x + 4.5, 22, kk), lerp(-.3, -6.5, kk)); }
    else if (st.act === 'swim') foot = P(root.x + 1.5 + i * .3, -2.5 + i * .2);
    else { const ph = st.walk + i * 2.2, lift = Math.max(0, Math.sin(ph)) * 1.4; foot = P(root.x + 2.2 - i * .5 + Math.cos(ph) * (st.act === 'walk' ? 1.6 : 0), st.act === 'walk' ? -lift : 0); }
    const dx = foot.x - root.x, dy = foot.y - root.y, d = Math.min(Math.hypot(dx, dy), L1 + L2 - .01);
    const base = Math.atan2(dy, dx), A = Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
    R.legs.push({ root, knee: P(root.x + Math.cos(base - A) * L1, root.y + Math.sin(base - A) * L1), foot, chela: i < 2 });
  }
  R.pleo = R.ab.slice(0, 5).map((sg, i) => {
    const m = P((sg.a.x + sg.b.x) / 2, (sg.a.y + sg.b.y) / 2), n = P(Math.cos(sg.ang - Math.PI / 2), Math.sin(sg.ang - Math.PI / 2));
    const root = P(m.x + n.x * sg.h * .85, m.y + n.y * sg.h * .85), sw = Math.sin(st.t * (st.berried || st.act === 'swim' ? 12 : 7) + i * .9) * .5, ang = sg.ang - Math.PI / 2 - .35 + sw;
    return { root, tip: P(root.x + Math.cos(ang) * 2.6, root.y + Math.sin(ang) * 2.6) };
  });
  const w = Math.sin(st.t * 2.2) * .12;
  R.antennule = [0, 1].map(kk => { const pts = []; for (let i = 0; i <= 5; i++) { const f = i / 5; pts.push(P(21 + f * (kk ? 8 : 9.5), -8.6 - f * (kk ? 2.5 : 5) + Math.sin(st.t * 4 - f * 3 + kk) * f * .8)); } return pts; });
  R.antenna = [0, 1].map(kk => {
    const pts = [P(20.5, -7.6)]; let ang = kk ? .1 : -.15, q = pts[0];
    for (let i = 1; i <= 16; i++) {
      if (kk) ang += (i < 6 ? .02 : -.06) + Math.sin(st.t * 1.8 + i * .5) * .03;
      else ang -= (i <= 3 ? .05 : i <= 9 ? .42 : -.03) + w * .3 + Math.sin(st.t * 1.6 + i * .4) * .02;
      q = P(q.x + Math.cos(ang) * 3, q.y + Math.sin(ang) * 3); pts.push(q);
    }
    return pts;
  });
  return R;
}
function pxShrimpSprite(B, st, T, S, g) {
  const R = pxShrimpRig(st), thick = S >= 2.6 ? 2 : 1;
  const stroke = (pts, c, w = thick) => { for (let k = 0; k < w; k++) B.path(pts.map(T).map(p => P(p.x, p.y + k)), c); };
  if (S >= .8) for (const L of R.legs) stroke([P(L.root.x - .8, L.root.y), P(L.knee.x - .8, L.knee.y), P(L.foot.x - .8, L.foot.y)], g.dk, 1);   // 遠側的腳
  if (S >= .6 && !g.molt) stroke(R.antenna[1], g.dk, 1);
  const t0 = R.tail.at, ta = R.tail.ang;
  for (const [da, len, col] of [[-R.tail.spread, 5.6, g.fan], [R.tail.spread, 5.6, g.fan], [0, 6.2, g.li]]) {   // 尾扇
    const tip = P(t0.x + Math.cos(ta + da) * len, t0.y + Math.sin(ta + da) * len), n = P(-Math.sin(ta + da), Math.cos(ta + da));
    B.poly([P(t0.x + n.x * .9, t0.y + n.y * .9), P(tip.x + n.x * 1.1, tip.y + n.y * 1.1), P(tip.x - n.x * 1.1, tip.y - n.y * 1.1), P(t0.x - n.x * .9, t0.y - n.y * .9)].map(T), col);
    if (S >= (PXOPT.detail ? .85 : 1.2)) { const a = T(t0), b = T(tip); B.line(a.x, a.y, b.x, b.y, C(g.sh), 1); }
  }
  for (let i = 5; i >= 0; i--) {                                         // 腹部：從後往前
    const sg = R.ab[i], up = P(Math.cos(sg.ang + Math.PI / 2), Math.sin(sg.ang + Math.PI / 2)), nx = R.ab[i + 1] || { h: sg.h * .8 };
    const A = sg.a, Bq = sg.b, h0 = sg.h, h1 = nx.h;
    const quad = (f0, f1, col) => B.poly([P(A.x + up.x * h0 * f0, A.y + up.y * h0 * f0), P(Bq.x + up.x * h1 * f0, Bq.y + up.y * h1 * f0), P(Bq.x + up.x * h1 * f1, Bq.y + up.y * h1 * f1), P(A.x + up.x * h0 * f1, A.y + up.y * h0 * f1)].map(T), col);
    const DS = PXOPT.detail ? .85 : 1.2;                                  // 細節門檻（改善後在比較小的尺寸就出現）
    quad(1.02, -.95, g.base); quad(-.35, -.95, g.sh); quad(1.02, .45, g.li); if (S >= DS) quad(1.02, .8, g.hi);
    const big = i === 1 ? 1.35 : 1, mid = P((A.x + Bq.x) / 2, (A.y + Bq.y) / 2), dn = P(-up.x, -up.y);
    if (i < 5 && S >= .8) B.poly([-1.25, -.6, 0, .6, 1.25].map((f, kk) => T(P(mid.x + (Bq.x - A.x) / 3.3 * f * 1.9 * big + dn.x * sg.h * (kk === 0 || kk === 4 ? .7 : 1.15 * big), mid.y + (Bq.y - A.y) / 3.3 * f * 1.9 * big + dn.y * sg.h * (kk === 0 || kk === 4 ? .7 : 1.15 * big)))), g.sh);
    if (S >= DS) { const a = T(P(A.x + up.x * h0, A.y + up.y * h0)), b = T(P(A.x - up.x * h0 * .8, A.y - up.y * h0 * .8)); B.line(a.x, a.y, b.x, b.y, C(g.dk), 1); }
  }
  B.poly([P(4.2, -11.4), P(8, -12.6), P(13, -12.8), P(17, -12), P(19.6, -10.6), P(19.8, -7.8), P(16, -6.2), P(10, -5.6), P(4.4, -5.8)].map(T), g.base);   // 頭胸甲
  B.poly([P(4.4, -8), P(19.8, -8.6), P(19.8, -7.8), P(16, -6.2), P(10, -5.6), P(4.4, -5.8)].map(T), g.sh);
  B.poly([P(4.2, -11.4), P(8, -12.6), P(13, -12.8), P(17, -12), P(19.4, -10.8), P(17, -11), P(12, -11.6), P(6, -11)].map(T), g.li);
  if (S >= (PXOPT.detail ? .6 : 1.2)) B.poly([P(7, -12.2), P(12.5, -12.6), P(16, -11.9), P(12, -12)].map(T), g.hi);
  B.poly([P(18.8, -11.4), P(25.6, -12), P(24.8, -11.1), P(19.2, -9.8)].map(T), g.li);   // 額角
  return R;
}
function pxShrimpDetails(B, st, T, S, g, R) {                         // 外框之後：腸道、卵鞍、斑點、眼睛、腳、觸角
  if (!g.molt && (g.clear || st.grade === 1) && S >= 1) {
    const gut = [P(17, -10.2), P(10, -10.6), P(5, -10.2), ...R.ab.map(sg => { const up = P(Math.cos(sg.ang + Math.PI / 2), Math.sin(sg.ang + Math.PI / 2)); return P(sg.b.x + up.x * sg.h * .35, sg.b.y + up.y * sg.h * .35); })];
    B.path(gut.map(T), g.clear ? '#7c4a32' : g.dk);
  }
  if (!g.molt && st.sex === 'f' && st.adult) { B.poly([P(5.5, -11.3), P(10.5, -11.8), P(12, -10.4), P(6, -9.6)].map(T), '#f4cc4c', 3); }
  if (!g.molt && st.grade < 2 && S >= .8) {                             // 紅色素斑點（固定雜訊，跟著身體移動）
    const dens = st.grade === 0 ? .07 : .1, o = T(P(0, 0)), fl = o.x > T(P(1, 0)).x ? -1 : 1;
    for (let y = B.y0; y <= B.y1; y++) for (let x = B.x0; x <= B.x1; x++) {
      const i = y * B.w + x; if (B.tag[i] !== 1) continue;
      const hx = Math.floor((x - o.x) * fl / S * 1.2), hy = Math.floor((y - o.y) / S * 1.2);
      if (hash2(hx, hy, 3) < dens) B.d[i] = C(hash2(hx, hy, 9) < .5 ? g.spot : g.spot2);
    }
  }
  if (g.molt) return;
  const eye = T(P(20.6, -9.6)), stalk = T(P(18.6, -9.4));
  B.line(stalk.x, stalk.y, eye.x, eye.y, C(g.sh));
  B.disc(eye.x, eye.y, Math.max(.7, S * 1.3), C('#140a10'), 2);
  if (S >= (PXOPT.detail ? .8 : 1.5)) B.set(eye.x - Math.max(.5, S * .5), eye.y - Math.max(.6, S * .6), C('#ffffff'), 2);
  if (PXOPT.detail && S >= .9) { const sh = T(P(12, -12.4)); B.set(sh.x, sh.y, C('#ffffff'), 2); }   // 背甲的反光點
  const thick = S >= 2.6 ? 2 : 1, stroke = (pts, c, w = thick) => { for (let k = 0; k < w; k++) B.path(pts.map(T).map(p => P(p.x, p.y + k)), c); };
  const legC = PXOPT.bright && !g.molt ? g.hi : g.leg, legC2 = PXOPT.bright && !g.molt ? g.li : g.sh;
  for (const pl of R.pleo) if (S >= .8) stroke([pl.root, pl.tip], legC, 1);
  if (st.berried) for (let k = 0; k < 14; k++) {
    const sg = R.ab[k % 4], f = hash2(k, 1), m = P(lerp(sg.a.x, sg.b.x, f), lerp(sg.a.y, sg.b.y, f)), n = P(Math.cos(sg.ang - Math.PI / 2), Math.sin(sg.ang - Math.PI / 2));
    const c = T(P(m.x + n.x * (sg.h + .5 + hash2(k, 2) * 1.3), m.y + n.y * (sg.h + .5 + hash2(k, 2) * 1.3)));
    B.disc(c.x, c.y, Math.max(.6, S * .55), C(hash2(k, 3) < .3 ? '#bf7a16' : '#f2b232'), 2);
  }
  for (const L of R.legs) { stroke([L.root, L.knee], legC); stroke([L.knee, L.foot], legC2); }
  if (S >= .6) for (const a of R.antennule) stroke(a, legC, 1);
  B.path(R.antenna[0].map(T), (x, y) => C((Math.floor((x + y) / Math.max(2, S * 1.5)) % 2) ? legC : legC2));
}
function drawPxShrimp(e) {
  const k = e.size * SPECIES[e.type].len / 40 * PXOPT.cscale, S = ppu() * k;
  const moving = e.mode === 'walk' && e.state === '走動' || e.state === '走向飼料';
  const st = { t: world.t + e.id * .7, act: e.state === '用小螯夾食' ? 'pick' : (e.mode === 'swim' || e.mode === 'swarm' || e.mode === 'flip' || e.mode === 'fall') ? 'swim' : moving ? 'walk' : 'still',
               walk: (e.dist || 0) * .55, curl: e.curl || 0, grade: e.sex === 'm' ? Math.max(0, (e.morph || 0) - 1) : (e.morph || 0), sex: e.sex, berried: (e.preg || 0) > 0, adult: e.size >= e.adult * .6 };
  const g = PX_SHRIMP[st.grade], T = mapper(e.x, e.y, S, e.dir, 1);
  let R;
  live(B => { R = pxShrimpSprite(B, st, T, S, g); if (PXOPT.detail) { B.cleanup(); if (S >= .7) B.rim(.25, .18); } B.outline(g.dk, g.ol); pxShrimpDetails(B, st, T, S, g, R); }, null);
}
function drawPxMolts() {
  for (const m of world.molts) {
    if (m.t > 34 && ((m.t * 6) | 0) % 2) continue;                       // 快消失時閃一下
    const S = ppu() * m.size * PXOPT.cscale, T = mapper(m.x, m.y, S, m.dir, 1), st = { t: 1, act: 'still', walk: 0, curl: .1, grade: 0 };
    live(B => { pxShrimpSprite(B, st, T, S, PX_MOLT); B.outline(PX_MOLT.sh, PX_MOLT.ol); }, null);
  }
}

// 斑馬螺
function drawPxSnail(e) {
  const s = ppu() * e.size * PXOPT.cscale, T = mapper(e.x, e.y, s, e.dir, 1), und = Math.sin(e.phase * 3) * .8;
  live(B => {
    B.poly([P(-11, 0), P(-12, -2.5), P(4, -3.5), P(12 + und, -2.5), P(14 + und, 0)].map(T), (x, y) => y < T(P(0, -1.5)).y ? '#a09a8c' : '#7a7468');   // 肉足
    const shell = ellipsePts(-1, -8, 11, 8, -.15, 18).map(T), cx = T(P(-1, -8));
    B.poly(shell, (x, y) => {                                            // 金黃色殼＋黑色斑馬紋（依殼上的位置算）
      const lx = (x - cx.x) / s * e.dir, ly = (y - cx.y) / s, stripe = Math.sin((lx + ly * .25) * 1.05) > .55;
      return stripe ? '#2a1e0c' : (ly < -2.5 ? '#f0cc62' : ly < 3 ? '#d8b04a' : '#b08a2a');
    });
    if (PXOPT.detail && 25 * s >= 14) { const h = T(P(3, -12.5)); B.setOn(h.x, h.y, C('#fff4c0')); }   // 殼的反光
    if (PXOPT.detail && 25 * s >= 26) B.path(arcPts(-4, -9, 3.5, 0, Math.PI * 1.6, 8).map(T), C('#7a5a18'));   // 螺旋
  }, '#6a5420', '#3a2c0e');
  const a = T(P(11 + und, -2.5)), b = T(P(16 + und, -7)); PXB.line(a.x, a.y, b.x, b.y, C(PXOPT.bright ? '#d8d2c4' : '#6e6a60'), CREATURE);
  const ey = T(P(11.5 + und, -3.2)); PXB.set(ey.x, ey.y, C('#111111'), CREATURE);
}

// 飼料、卵、粒子
function drawPxFood(f) { const r = Math.max(.6, 2.4 * ppu()); PXB.disc(AX(f.x), AY(f.y), r, C(PXPAL.food[1]), CREATURE); if (r > 1.2) PXB.set(AX(f.x) - r * .3, AY(f.y) - r * .3, C(PXPAL.food[0]), CREATURE); }
function drawPxNest(e) {
  const n = Math.max(1, e.count), s = ppu();
  for (let i = 0; i < n; i++) {
    const a = i * 2.39996, r = Math.sqrt(i) * 5.5, x = AX(e.x + Math.cos(a) * r), y = AY(e.y + Math.sin(a) * r);
    if (e.medium === 'glass') { PXB.disc(x, y, Math.max(.6, 2.4 * s), C('#f2e6c8')); if (s >= 1 && e.t > e.hatch * .6) PXB.set(x, y, C('#3a3020')); }
    else PXB.disc(x, y, Math.max(.6, 3 * s), C('#d8ecd8'));
  }
}
function drawPxParticles() {
  const s = ppu(), bub = C(PXPAL.bubble), wht = C('#ffffff'), dust = C('#c9b48a');
  for (const p of world.particles) {
    const x = AX(p.x), y = AY(p.y), k = 1 - p.t / p.life;
    if (p.type === 'bubble') {
      const r = p.r * s;
      if (r < 1.1) PXB.set(x, y, bub, CREATURE);
      else { for (let a = 0; a < 6.28; a += 1 / r) PXB.set(x + Math.cos(a) * r, y + Math.sin(a) * r, bub, CREATURE); PXB.set(x - r * .4, y - r * .4, wht, CREATURE); }
    } else if (p.type === 'dust') { if (bayer(x | 0, y | 0) < k * .7) PXB.disc(x, y, Math.max(.6, p.r * s * .7), dust, 0); }
    else if (p.type === 'ripple') { if (k > .2) { const r = p.r * s; PXB.set(x - r, y, wht); PXB.set(x + r, y, wht); if (r > 3) { PXB.set(x - r + 1, y, wht); PXB.set(x + r - 1, y, wht); } } }
    else if (p.type === 'drop') PXB.set(x, y, C('#e8f6ff'));
  }
}
function drawPxSurface() {                                            // 水面：一條亮線＋波動的亮點
  const wy = world.waterY; if (wy >= TANK.floor) return;
  const c1 = C('#ffffff'), c2 = C('#d8f2fa');
  for (let x = AX(TANK.left); x <= AX(TANK.right); x++) {
    const wx = PXCAM.x + x / ppu(), yy = AY(wy + Math.sin(wx * .03 + world.t * 1.8) * 1.6 + Math.sin(wx * .011 - world.t) * 1.2);
    PXB.set(x, yy, (x + Math.floor(world.t * 6)) % 7 === 0 ? c2 : c1); PXB.set(x, yy + 1, c2);
  }
}

// ---------------------------------------------------------------------
// 一幀
// ---------------------------------------------------------------------
const PX_ORDER = { shrimp: 0, snail: 0, nest: 0, larva: 0, tadpole: 1, fish: 2 };
function renderPixel() {
  const z = PXCAM.z, cx = Math.round(PXCAM.x * ppu()), cy = Math.round(PXCAM.y * ppu());
  PXCAM.x = cx / ppu(); PXCAM.y = cy / ppu();                            // 鏡頭對齊格子，畫面才不會抖
  const view = [z, cx, cy, W, H].join(','), wkey = Math.round(world.waterY) + ',' + Math.round(world.water.algae / 5) + ',' + Math.round(world.water.dirt / 8);
  layerFill(LAYER.back, view + '|' + wkey, drawPxBack, true);
  PXB.tag.fill(0);
  if (!PXOPT.hybrid && PXOPT.light === 'day') drawPxShafts();          // 混合模式改用平滑的光束（畫在放大之後）
  for (const d of world.decor) if (d.type === 'plant') drawPxPlant(d);
  layerFill(LAYER.decor, view + '|' + wkey + '|' + world.decor.map(d => [d.type, d.x | 0, d.y | 0, d.w | 0, d.h | 0, (d.rot || 0).toFixed(2)].join(':')).join(';'), B => {
    for (const d of world.decor) {
      if (d.type === 'rock' || d.type === 'boulder') { drawPxRock(B, d); }
      else if (d.type === 'wood') drawPxWood(B, d);
      else if (d.type === 'bubbler') drawPxBubbler(B, d);
      else if (d.type === 'filter') drawPxFilterBody(B, d);
    }
    // 造景的外框：一圈深色（用 tag 1 標記的區塊）
    B.outline(PXPAL.stoneOl, PXPAL.stoneOl);
  });
  for (const d of world.decor) if (d.type === 'filter') drawPxFilterBubbles(d);
  drawPxMolts();
  for (const f of world.food) drawPxFood(f);
  const list = world.ents.slice().sort((a, b) => (PX_ORDER[a.kind] || 0) - (PX_ORDER[b.kind] || 0));
  for (const e of list) {
    if (e.kind === 'fish') drawPxFish(e);
    else if (e.kind === 'shrimp') drawPxShrimp(e);
    else if (e.kind === 'snail') drawPxSnail(e);
    else if (e.kind === 'nest') drawPxNest(e);
  }
  layerFill(LAYER.front, view, drawPxFront);
  for (const d of world.decor) if (d.type === 'floater') drawPxFloater(d);
  drawPxParticles();
  drawPxSurface();
  if (PXOPT.light === 'glow') drawPxPlankton();
}
// 夜光：發光的浮游生物（慢慢漂、一閃一閃）
function drawPxPlankton() {
  const wy = world.waterY, c1 = C('#8ff8ff'), c2 = C('#3fb8e8'), r = rng(42);
  for (let i = 0; i < 70; i++) {
    const bx = r() * W, by = wy + 10 + r() * (TANK.floor - wy - 20), sp = 3 + r() * 6, ph = r() * 6;
    const x = AX(((bx + world.t * sp) % (TANK.right - TANK.left)) + TANK.left), y = AY(by + Math.sin(world.t * .7 + ph) * 8);
    const tw = Math.sin(world.t * 2 + ph * 3);
    if (tw > -.3) PXB.set(x, y, tw > .6 ? c1 : c2, CREATURE);
  }
}
// 輸出到畫布（夜晚整體偏藍變暗）
// 燈光：背景和生物各乘一組顏色（生物像被燈照亮）；明亮模式跟著日夜
function lightMul() {
  if (PXOPT.light === 'aqua') return { bg: [.34, .52, .92], fg: [.95, .98, 1.06], add: [0, 6, 22] };
  if (PXOPT.light === 'glow') return { bg: [.16, .24, .46], fg: [.8, .86, 1], add: [0, 2, 10] };
  const L = daylight(), m = [lerp(.42, 1, L), lerp(.5, 1, L), lerp(.78, 1, L)];
  return { bg: m, fg: m, add: [0, 0, 0] };
}
let PX_IMG = null, PX_OUT = null, PX_SMALL = null;
function presentPixel(ctx, scale = 1) {
  if (!PX_IMG) { PX_SMALL = document.createElement('canvas'); PX_SMALL.width = PXW; PX_SMALL.height = PXH; PX_IMG = PX_SMALL.getContext('2d').createImageData(PXW, PXH); PX_OUT = new Uint32Array(PX_IMG.data.buffer); }
  const { bg, fg, add } = lightMul(), d = PXB.d, tg = PXB.tag;
  if (bg[0] === 1 && bg[1] === 1 && bg[2] === 1 && fg[0] === 1) PX_OUT.set(d);
  else for (let i = 0; i < d.length; i++) {
    const v = d[i], m = tg[i] === CREATURE ? fg : bg;
    const r = Math.min(255, (v & 255) * m[0] + add[0]), g = Math.min(255, ((v >> 8) & 255) * m[1] + add[1]), b = Math.min(255, ((v >> 16) & 255) * m[2] + add[2]);
    PX_OUT[i] = (255 << 24 | (b << 16) | (g << 8) | r) >>> 0;
  }
  PX_SMALL.getContext('2d').putImageData(PX_IMG, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(PX_SMALL, 0, 0, PXW * scale, PXH * scale);              // 整數倍放大（不平滑）
  if (PXOPT.hybrid) drawHybrid(ctx, scale);
}
// 混合光影：在放大後的畫面上疊平滑、半透明的光（不是像素）
function drawHybrid(ctx, k) {
  const wy = world.waterY, L = PXOPT.light === 'day' ? daylight() : PXOPT.light === 'aqua' ? .6 : .25;
  const X = wx => AX(wx) * k, Y = wy2 => AY(wy2) * k;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  if (wy < TANK.floor && L > 0) for (let x0 = TANK.left + 80; x0 < TANK.right; x0 += 260) {   // 光束：上亮下淡
    const sway = Math.sin(world.t * .3 + x0 * .01) * 30, w = 50 + Math.sin(x0) * 20;
    const g = ctx.createLinearGradient(0, Y(wy), 0, Y(TANK.floor));
    const tint = PXOPT.light === 'glow' ? '120,220,255' : PXOPT.light === 'aqua' ? '140,200,255' : '255,250,230';
    g.addColorStop(0, `rgba(${tint},${.22 * L})`); g.addColorStop(1, `rgba(${tint},0)`);
    ctx.fillStyle = g; ctx.beginPath();
    ctx.moveTo(X(x0 + sway), Y(wy)); ctx.lineTo(X(x0 + sway + w), Y(wy)); ctx.lineTo(X(x0 + sway * 2 + w * 2.2 + 60), Y(TANK.floor)); ctx.lineTo(X(x0 + sway * 2 - 30), Y(TANK.floor)); ctx.closePath(); ctx.fill();
  }
  if (wy < TANK.floor) {                                                 // 水面下的光暈
    const g = ctx.createLinearGradient(0, Y(wy), 0, Y(wy + 120));
    g.addColorStop(0, `rgba(220,245,255,${.25 * Math.max(.3, L)})`); g.addColorStop(1, 'rgba(220,245,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, Y(wy), PXW * k, Y(wy + 120) - Y(wy));
  }
  ctx.globalCompositeOperation = 'source-over';
  const vg = ctx.createRadialGradient(PXW * k / 2, PXH * k * .45, PXH * k * .35, PXW * k / 2, PXH * k / 2, PXW * k * .62);   // 暗角
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, `rgba(0,8,20,${PXOPT.light === 'day' ? .28 : .5})`);
  ctx.fillStyle = vg; ctx.fillRect(0, 0, PXW * k, PXH * k);
  ctx.restore();
}
