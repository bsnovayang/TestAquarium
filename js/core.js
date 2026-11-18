'use strict';
// =====================================================================
// core.js — 常數、數學工具、繪圖層（Gfx）
// 繪圖層只提供最基本的指令：多邊形、圓、折線、線性漸層
// 之後移植到 Godot / Unity 時，只要重寫這個檔案的 G 物件
// =====================================================================

let W = 1280, H = 720;                         // 世界（魚缸）大小，會隨魚缸尺寸改變
const VIEW_W = 1280, VIEW_H = 720;             // 畫面（鏡頭）固定 16:9
const TANK = { left: 16, right: 1264, top: 40, floor: 668 };
const PX_PER_CM = 18;                          // 比例：孔雀魚 64px ≈ 3.5 cm
const STEP = 1 / 60;                           // 固定模擬步長

const rand = (a, b) => a + Math.random() * (b - a);
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (dt, rate) => 1 - Math.exp(-dt * rate);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
function angDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Chaikin 平滑：自己把折線切細，不依賴 Canvas 的貝茲曲線
function chaikin(pts, closed = true, iter = 2) {
  let p = pts;
  for (let k = 0; k < iter; k++) {
    const q = [], n = p.length, lim = closed ? n : n - 1;
    if (!closed) q.push(p[0]);
    for (let i = 0; i < lim; i++) {
      const a = p[i], b = p[(i + 1) % n];
      q.push({ x: a.x * .75 + b.x * .25, y: a.y * .75 + b.y * .25 },
             { x: a.x * .25 + b.x * .75, y: a.y * .25 + b.y * .75 });
    }
    if (!closed) q.push(p[n - 1]);
    p = q;
  }
  return p;
}
function ellipsePts(cx, cy, rx, ry, rot = 0, n = 22) {
  const out = [], c = Math.cos(rot), s = Math.sin(rot);
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2, x = Math.cos(a) * rx, y = Math.sin(a) * ry;
    out.push({ x: cx + x * c - y * s, y: cy + x * s + y * c });
  }
  return out;
}
function arcPts(cx, cy, r, a0, a1, n = 10) {
  const out = [];
  for (let i = 0; i <= n; i++) { const a = lerp(a0, a1, i / n); out.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r }); }
  return out;
}
const P = (x, y) => ({ x, y });

// ---------------------------------------------------------------------
// 繪圖層
// ---------------------------------------------------------------------
const G = {
  c: null,
  begin(ctx) { this.c = ctx; },
  save() { this.c.save(); },
  restore() { this.c.restore(); },
  tf(x, y, rot = 0, sx = 1, sy = 1) {
    const c = this.c; c.translate(x, y);
    if (rot) c.rotate(rot);
    if (sx !== 1 || sy !== 1) c.scale(sx, sy);
  },
  alpha(a) { this.c.globalAlpha *= a; },
  paint(f) {
    if (!f || typeof f === 'string') return f;
    if (f.lin) {
      const [x0, y0, x1, y1, stops] = f.lin;
      const g = this.c.createLinearGradient(x0, y0, x1, y1);
      for (const [o, col] of stops) g.addColorStop(o, col);
      return g;
    }
    return '#f0f';
  },
  poly(pts, fill, stroke, lw = 1) {
    if (!pts || pts.length < 2) return;
    const c = this.c;
    c.beginPath(); c.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) c.lineTo(pts[i].x, pts[i].y);
    c.closePath();
    if (fill) { c.fillStyle = this.paint(fill); c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.lineJoin = 'round'; c.stroke(); }
  },
  circle(x, y, r, fill, stroke, lw = 1) {
    const c = this.c;
    c.beginPath(); c.arc(x, y, Math.max(.01, r), 0, Math.PI * 2);
    if (fill) { c.fillStyle = this.paint(fill); c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(); }
  },
  line(pts, w, color) {
    if (!pts || pts.length < 2) return;
    const c = this.c;
    c.beginPath(); c.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) c.lineTo(pts[i].x, pts[i].y);
    c.strokeStyle = this.paint(color); c.lineWidth = w; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke();
  },
  text(str, x, y, size, color, align = 'center') {
    const c = this.c;
    c.font = `600 ${size}px system-ui, "Microsoft JhengHei", sans-serif`;
    c.textAlign = align; c.textBaseline = 'middle'; c.fillStyle = color; c.fillText(str, x, y);
  },
  rect(x, y, w, h, fill) { this.poly([P(x, y), P(x + w, y), P(x + w, y + h), P(x, y + h)], fill); },
};
