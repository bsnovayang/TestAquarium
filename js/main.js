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
// 畫風：一般（向量）／像素；記在這個瀏覽器（是顯示偏好，不跟著存檔）
const ART = { pixel: true, zacc: 1 };                                 // 預設像素版；玩家選過一般版才用一般版
try { ART.pixel = localStorage.getItem('aquarium.art') !== 'vector'; } catch { }
{ const a = new URLSearchParams(location.search).get('art'); if (a) ART.pixel = a === 'pixel'; }
const PX_ZOOMS = [1, 1.5, 2, 3, 4];                                   // 像素版只用幾個固定倍率（每換一次要重畫整缸的快取）
const pxZoomLevels = () => [fitZoom(), ...PX_ZOOMS.filter(z => z > fitZoom() + .01)];
function setArt(pixel) {
  ART.pixel = pixel;
  try { localStorage.setItem('aquarium.art', pixel ? 'pixel' : 'vector'); } catch { }
  if (pixel) { const lv = pxZoomLevels(); cam.z = lv.reduce((a, b) => Math.abs(b - cam.z) < Math.abs(a - cam.z) ? b : a); }
  else cam.z = clamp(cam.z, fitZoom(), Math.max(fitZoom(), 3));
  camClamp(); resize();
}
const fitZoom = () => Math.min(VIEW_W / W, VIEW_H / H);
function camClamp() {
  const vw = VIEW_W / cam.z, vh = VIEW_H / cam.z;
  cam.x = vw >= W ? (W - vw) / 2 : clamp(cam.x, 0, W - vw);
  cam.y = vh >= H ? (H - vh) / 2 : clamp(cam.y, 0, H - vh);
}
function camFit() { cam.z = fitZoom(); camClamp(); }
function camZoomAt(f, vx = VIEW_W / 2, vy = VIEW_H / 2) {   // vx, vy：畫面座標
  const wx = cam.x + vx / cam.z, wy = cam.y + vy / cam.z;
  if (ART.pixel) {                                                     // 像素版：累積到一定量才跳到下一個倍率
    ART.zacc *= f;
    if (ART.zacc < 1.2 && ART.zacc > 1 / 1.2) return;
    const up = ART.zacc > 1, lv = pxZoomLevels(); ART.zacc = 1;
    const z = up ? lv.find(v => v > cam.z + .01) : lv.slice().reverse().find(v => v < cam.z - .01);
    if (z === undefined) return;
    cam.z = z;
  } else cam.z = clamp(cam.z * f, fitZoom(), Math.max(fitZoom(), 3));
  cam.x = wx - vx / cam.z; cam.y = wy - vy / cam.z;
  camClamp();
}
function onTankResize() { SAND = makeSand(); ALGAE_SPOTS = makeAlgaeSpots(); SCENERY = makeScenery(); camFit(); if (typeof syncTankUI === 'function') syncTankUI(); }

function resize() {
  const wrap = document.getElementById('stageWrap');
  const r = wrap.getBoundingClientRect();
  let w = r.width, h = w * VIEW_H / VIEW_W;
  if (h > r.height) { h = r.height; w = h * VIEW_W / VIEW_H; }
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (ART.pixel) {                                                     // 像素版：盡量用整數倍放大（每格一樣大），縮小不超過 12%
    const s = Math.floor(w * dpr / PXW);
    if (s >= 1 && s * PXW >= w * dpr * .88) { w = s * PXW / dpr; h = s * PXH / dpr; }
  }
  canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
  canvas.width = Math.max(1, Math.round(w * dpr)); canvas.height = Math.max(1, Math.round(h * dpr));
  viewScale = canvas.width / VIEW_W;
}

let acc = 0, last = performance.now();
// 效能顯示（網址加 ?perf=1）：FPS、每幀模擬／繪圖時間、生物數
const PERF = { on: new URLSearchParams(location.search).has('perf'), fps: 0, sim: 0, draw: 0, n: 0, t0: 0, show: '量測中…' };
function frame(now) {
  const real = Math.min(.1, (now - last) / 1000); last = now;
  const tSim = performance.now();
  // 分頁在背景時瀏覽器不會呼叫 frame；回來時 real 最多 0.1 秒 → 等同「離線暫停」
  if (!document.hidden && UI.speed > 0) {
    acc += real * UI.speed;
    let n = 0;
    while (acc >= STEP && n < 30) { step(STEP); acc -= STEP; n++; }   // 固定步長：加速時一幀跑多步
    if (n >= 30) acc = 0;
  }
  const tDraw = performance.now();
  if (ART.pixel) { drawPixelFrame(); if (PERF.on) drawPerf(now, tSim, tDraw); requestAnimationFrame(frame); return; }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#15181a'; ctx.fillRect(0, 0, canvas.width, canvas.height);   // 魚缸外面
  const k = viewScale * cam.z;
  ctx.setTransform(k, 0, 0, k, -cam.x * k, -cam.y * k);
  G.begin(ctx);
  render(UI.mode === 'edit' ? UI.sel : null);
  if (PERF.on) drawPerf(now, tSim, tDraw);
  requestAnimationFrame(frame);
}

// 像素版的一幀：畫在 640×360 的格子上，放大到畫布；選取框、飄字等編輯用的東西照一般版疊在上面
function drawPixelFrame() {
  PXCAM.z = cam.z; PXCAM.x = cam.x; PXCAM.y = cam.y;
  renderPixel();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  presentPixel(ctx, canvas.width / PXW);
  const k = viewScale * cam.z, sel = UI.mode === 'edit' ? UI.sel : null;
  ctx.setTransform(k, 0, 0, k, -cam.x * k, -cam.y * k);
  G.begin(ctx);
  drawFx();
  for (const e of world.ents) drawDebug(e, e === sel);
  if (sel && (world.ents.includes(sel) || world.decor.includes(sel))) drawSelection(sel);
}
function drawPerf(now, tSim, tDraw) {
  const tEnd = performance.now();
  PERF.sim += tDraw - tSim; PERF.draw += tEnd - tDraw; PERF.n++;
  if (now - PERF.t0 >= 1000) {                                    // 每秒更新一次平均值
    PERF.show = `${Math.round(PERF.n * 1000 / (now - PERF.t0))} FPS　模擬 ${(PERF.sim / PERF.n).toFixed(1)} ms　繪圖 ${(PERF.draw / PERF.n).toFixed(1)} ms　生物 ${world.ents.length}　粒子 ${world.particles.length}`;
    PERF.sim = PERF.draw = PERF.n = 0; PERF.t0 = now;
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const dpr = Math.min(window.devicePixelRatio || 1, 2), fs = Math.max(11 * dpr, 12 * viewScale);   // 小螢幕也看得清楚
  ctx.font = `${Math.round(fs)}px system-ui, sans-serif`; ctx.textBaseline = 'top';
  const w = ctx.measureText(PERF.show).width;
  ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(4, 4, w + 12, fs * 1.6);
  ctx.fillStyle = '#fff'; ctx.fillText(PERF.show, 10, 4 + fs * .3);
}

if (ART.pixel) cam.z = 1;
updateWaterY();
loadPreset('planted');                   // 第一次打開：水草魚缸
initUI();
camFit();
resize();
window.addEventListener('resize', resize);
new ResizeObserver(resize).observe(document.getElementById('stageWrap'));
requestAnimationFrame(frame);

// 測試用網址參數：?speed=10
const QS = new URLSearchParams(location.search);
if (QS.get('speed')) setSpeed(+QS.get('speed'));
