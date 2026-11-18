'use strict';
// =====================================================================
// main.js — 畫布縮放、主迴圈
// =====================================================================

const canvas = document.getElementById('cv');
const ctx = canvas.getContext('2d');
let viewScale = 1;

// ---------------------------------------------------------------------
// 鏡頭：大魚缸可以縮放、移動
// ---------------------------------------------------------------------
const cam = { x: 0, y: 0, z: 1 };
const fitZoom = () => Math.min(VIEW_W / W, VIEW_H / H);
function camClamp() {
  const vw = VIEW_W / cam.z, vh = VIEW_H / cam.z;
  cam.x = vw >= W ? (W - vw) / 2 : clamp(cam.x, 0, W - vw);
  cam.y = vh >= H ? (H - vh) / 2 : clamp(cam.y, 0, H - vh);
}
function camFit() { cam.z = fitZoom(); camClamp(); }
function camZoomAt(f, vx = VIEW_W / 2, vy = VIEW_H / 2) {   // vx, vy：畫面座標
  const wx = cam.x + vx / cam.z, wy = cam.y + vy / cam.z;
  cam.z = clamp(cam.z * f, fitZoom(), Math.max(fitZoom(), 3));
  cam.x = wx - vx / cam.z; cam.y = wy - vy / cam.z;
  camClamp();
}
function onTankResize() { SAND = makeSand(); camFit(); if (typeof syncTankUI === 'function') syncTankUI(); }

function resize() {
  const wrap = document.getElementById('stageWrap');
  const r = wrap.getBoundingClientRect();
  let w = r.width, h = w * VIEW_H / VIEW_W;
  if (h > r.height) { h = r.height; w = h * VIEW_W / VIEW_H; }
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
  canvas.width = Math.max(1, Math.round(w * dpr)); canvas.height = Math.max(1, Math.round(h * dpr));
  viewScale = canvas.width / VIEW_W;
}

let acc = 0, last = performance.now();
function frame(now) {
  const real = Math.min(.1, (now - last) / 1000); last = now;
  // 分頁在背景時瀏覽器不會呼叫 frame；回來時 real 最多 0.1 秒 → 等同「離線暫停」
  if (!document.hidden && UI.speed > 0) {
    acc += real * UI.speed;
    let n = 0;
    while (acc >= STEP && n < 30) { step(STEP); acc -= STEP; n++; }   // 固定步長：加速時一幀跑多步
    if (n >= 30) acc = 0;
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#15181a'; ctx.fillRect(0, 0, canvas.width, canvas.height);   // 魚缸外面
  const k = viewScale * cam.z;
  ctx.setTransform(k, 0, 0, k, -cam.x * k, -cam.y * k);
  G.begin(ctx);
  render(UI.mode === 'edit' ? UI.sel : null);
  requestAnimationFrame(frame);
}

updateWaterY();
loadSampleScene();
initUI();
camFit();
resize();
window.addEventListener('resize', resize);
new ResizeObserver(resize).observe(document.getElementById('stageWrap'));
requestAnimationFrame(frame);

// 測試用網址參數：?speed=10
const QS = new URLSearchParams(location.search);
if (QS.get('speed')) setSpeed(+QS.get('speed'));
