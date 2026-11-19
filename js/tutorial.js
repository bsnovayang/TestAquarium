'use strict';
// =====================================================================
// tutorial.js — 新手提示（第一次打開時自動出現；工具列「？ 說明」可以再看一次）
// =====================================================================

const TUTORIAL_KEY = 'aquarium.tutorialSeen';
const TUTORIAL_STEPS = [
  { title: '歡迎來到半水陸生態缸', text: '這裡的生物會自己覓食、長大、繁殖，互相形成食物鏈。你可以自由佈置，看牠們怎麼生活。' },
  { target: '#palette', title: '放進生物和造景', text: '從左邊把東西拖進魚缸。上面的頁籤可以切換分類：造景、水中生物、兩棲爬蟲、昆蟲…' },
  { target: '#stageWrap', title: '查看與移動', text: '點一下缸裡的生物，右邊會顯示牠的狀態（飢餓、年齡、正在做什麼）。拖曳空白處可以移動畫面，滾輪或雙指可以縮放。', pad: -40 },
  { target: '#feed', title: '餵食', text: '按一下撒飼料。吃不完的飼料沉到底會讓水變髒。' },
  { target: '#waterPanel', up: 'section', title: '注意水質', text: '水太髒生物會生病。可以換水、刷藻，或放過濾器、水草、浮萍幫忙清潔。' },
  { target: '[data-speed="10"]', up: '.grp', title: '加快時間', text: '加速可以更快看到繁殖、蛻殼、族群起伏。' },
  { target: '#newTank', title: '換一個魚缸', text: '有好幾種預設配置（水草缸、烏龜缸、台灣原生缸…），也可以從空缸開始。' },
  { target: '#toView', title: '觀賞模式', text: '佈置好之後切到觀賞模式，隱藏面板好好欣賞。想再看一次這些說明，按工具列的「？ 說明」。' },
];

const TUT = { i: 0, el: null };
function tutorialTarget(s) {
  if (!s.target) return null;
  let el = document.querySelector(s.target);
  if (el && s.up) el = el.closest(s.up) || el;
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const onScreen = r.right > 0 && r.left < window.innerWidth && r.bottom > 0 && r.top < window.innerHeight;
  return r.width > 0 && r.height > 0 && onScreen ? r : null;      // 看不到（例如小螢幕收起來的抽屜）就當作沒有目標
}
function startTutorial() {
  if (typeof setMode === 'function' && UI.mode !== 'edit') setMode('edit');
  if (!TUT.el) {
    const el = document.createElement('div');
    el.id = 'tut';
    el.innerHTML = '<div class="tutHole"></div><div class="tutBox" role="dialog" aria-modal="true" aria-labelledby="tutTitle">' +
      '<div class="tutStep"></div><b id="tutTitle"></b><p></p>' +
      '<div class="tutBtns"><button class="tutSkip">略過</button><span></span><button class="tutPrev">上一步</button><button class="tutNext primary">下一步</button></div></div>';
    document.body.appendChild(el);
    el.querySelector('.tutSkip').onclick = endTutorial;
    el.querySelector('.tutPrev').onclick = () => showTutorialStep(TUT.i - 1);
    el.querySelector('.tutNext').onclick = () => TUT.i >= TUTORIAL_STEPS.length - 1 ? endTutorial() : showTutorialStep(TUT.i + 1);
    window.addEventListener('resize', () => { if (!TUT.el.hidden) placeTutorial(); });
    document.addEventListener('keydown', ev => {
      if (TUT.el.hidden) return;
      if (ev.key === 'Escape') endTutorial();
      else if (ev.key === 'ArrowRight' || ev.key === 'Enter') { ev.preventDefault(); TUT.el.querySelector('.tutNext').click(); }
      else if (ev.key === 'ArrowLeft' && TUT.i > 0) showTutorialStep(TUT.i - 1);
    });
    TUT.el = el;
  }
  TUT.el.hidden = false;
  showTutorialStep(0);
}
function showTutorialStep(i) {
  TUT.i = clamp(i, 0, TUTORIAL_STEPS.length - 1);
  const s = TUTORIAL_STEPS[TUT.i], el = TUT.el, last = TUT.i === TUTORIAL_STEPS.length - 1;
  el.querySelector('.tutStep').textContent = `${TUT.i + 1} / ${TUTORIAL_STEPS.length}`;
  el.querySelector('b').textContent = s.title;
  el.querySelector('p').textContent = s.text;
  el.querySelector('.tutPrev').hidden = TUT.i === 0;
  el.querySelector('.tutNext').textContent = last ? '開始玩' : '下一步';
  el.querySelector('.tutSkip').hidden = last;
  placeTutorial();
  el.querySelector('.tutNext').focus({ preventScroll: true });
}
function placeTutorial() {
  const s = TUTORIAL_STEPS[TUT.i], r = tutorialTarget(s), hole = TUT.el.querySelector('.tutHole'), box = TUT.el.querySelector('.tutBox');
  const vw = window.innerWidth, vh = window.innerHeight, gap = 12;
  if (!r) {                                                        // 沒有目標：置中
    hole.style.cssText = `left:${vw / 2}px;top:${vh / 2}px;width:0;height:0`;
    box.style.left = Math.max(8, (vw - box.offsetWidth) / 2) + 'px'; box.style.top = Math.max(8, (vh - box.offsetHeight) / 2) + 'px';
    return;
  }
  const pad = s.pad !== undefined ? s.pad : 4;                     // 大區塊（魚缸）往內縮一點，看起來不會滿版
  const L = r.left - pad, T = r.top - pad, W_ = r.width + pad * 2, H_ = r.height + pad * 2;
  hole.style.cssText = `left:${L}px;top:${T}px;width:${W_}px;height:${H_}px`;
  const bw = box.offsetWidth, bh = box.offsetHeight;
  // 依序試：右、左、下、上；都放不下就放在目標裡面的下方
  const cy = clamp(T, 8, vh - bh - 8), cx = clamp(L, 8, vw - bw - 8);   // 左右放時垂直方向可以挪；上下放時水平方向可以挪
  const tries = [
    [L + W_ + gap, cy], [L - bw - gap, cy], [cx, T + H_ + gap], [cx, T - bh - gap],
  ];
  let pos = tries.find(([x, y]) => x >= 8 && y >= 8 && x + bw <= vw - 8 && y + bh <= vh - 8);
  if (!pos) pos = [L + (W_ - bw) / 2, T + H_ - bh - 16];
  box.style.left = clamp(pos[0], 8, Math.max(8, vw - bw - 8)) + 'px';
  box.style.top = clamp(pos[1], 8, Math.max(8, vh - bh - 8)) + 'px';
}
function endTutorial() {
  TUT.el.hidden = true;
  try { localStorage.setItem(TUTORIAL_KEY, '1'); } catch { }
}

// 工具列的「？ 說明」按鈕；第一次打開自動出現（網址加 ?notut 可以關掉，方便測試截圖）
document.getElementById('help').onclick = startTutorial;
(function () {
  let seen = false;
  try { seen = !!localStorage.getItem(TUTORIAL_KEY); } catch { }
  if (!seen && !new URLSearchParams(location.search).has('notut')) setTimeout(startTutorial, 400);
})();
