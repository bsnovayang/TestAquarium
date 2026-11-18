'use strict';
// =====================================================================
// ui.js — 物件面板、拖曳擺放、選取、設定、存檔
// =====================================================================

const UI = { sel: null, drag: null, mode: 'edit', speed: 1 };
const PALETTE = [
  { cat: '造景', items: ['mound', 'boulder', 'rock', 'wood', 'plant'] },
  { cat: '生物', items: ['guppy', 'neon', 'redtail', 'turtle', 'frog', 'tadpole', 'gecko', 'mosquito', 'larva'] },
  { cat: '迷你版', items: ['whale'] },
  { cat: '工具', items: ['food'] },
];
const $ = id => document.getElementById(id);
const nameOf = t => SPECIES[t]?.name || DECOR_TYPES[t]?.name || (t === 'food' ? '飼料' : t);

// ---------------------------------------------------------------------
// 物件面板（縮圖直接用遊戲裡的繪圖函式畫）
// ---------------------------------------------------------------------
function drawThumb(cv, type) {
  const ctx = cv.getContext('2d'), dpr = Math.min(devicePixelRatio || 1, 2);
  cv.width = 64 * dpr; cv.height = 44 * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, 64, 44);
  G.begin(ctx);
  const keep = world.waterY; world.waterY = 9999;                 // 縮圖都畫成「水面上」的樣子
  if (DECOR_TYPES[type]) {
    const t = DECOR_TYPES[type];
    const d = { type, x: 0, y: 0, w: t.w, h: type === 'boulder' ? 220 : t.h, rot: type === 'wood' ? .2 : 0, seed: 3 };
    const sc = Math.min(54 / d.w, 34 / Math.max(d.h, 20));
    ctx.translate(32, type === 'wood' ? 22 : 40); ctx.scale(sc, sc);
    if (type === 'plant') { world.waterY = -9999; d.h = 160; }
    drawDecor(d);
  } else if (type === 'food') {
    for (const [x, y] of [[26, 18], [34, 22], [30, 28], [38, 15], [22, 26]]) drawFood({ x, y });
  } else {
    const e = makeEnt(type, 0, 0, false);
    e.size = 1; e.dir = 1; e.amp = .3; e.mode = type === 'turtle' ? 'walk' : 'sit';
    const conf = { guppy: [36, 22, .55], neon: [32, 22, .75], redtail: [37, 22, .17], turtle: [30, 38, .45], frog: [32, 38, .7], tadpole: [34, 22, 1.5],
                   gecko: [38, 34, .38], mosquito: [32, 22, 2], larva: [32, 24, 2], whale: [32, 22, .036] }[type];
    if (type === 'larva') e.phase = 1;
    if (type === 'tadpole') { e.size = 1; e.meta = .3; }
    if (type === 'whale') { e.amp = .4; e.wmode = 'cruise'; }
    ctx.translate(conf[0], conf[1]); ctx.scale(conf[2], conf[2]);
    if (type === 'gecko') e.surface = 'ground';
    if (type === 'mosquito') { e.id = 0; e.phase = .013; }        // 固定翅膀角度，縮圖才看得清楚
    DRAW[e.kind](e);
  }
  world.waterY = keep;
}
function buildPalette() {
  const root = $('palette'); root.innerHTML = '';
  for (const g of PALETTE) {
    const h = document.createElement('h3'); h.textContent = g.cat; root.appendChild(h);
    const box = document.createElement('div'); box.className = 'items'; root.appendChild(box);
    for (const type of g.items) {
      const it = document.createElement('div'); it.className = 'pitem'; it.dataset.type = type;
      const cv = document.createElement('canvas'); it.appendChild(cv);
      const sp = document.createElement('span'); sp.textContent = nameOf(type); it.appendChild(sp);
      box.appendChild(it);
      drawThumb(cv, type);
      it.addEventListener('pointerdown', ev => startPaletteDrag(ev, type, cv));
    }
  }
}
function startPaletteDrag(ev, type, cv) {
  ev.preventDefault();
  const ghost = document.createElement('img');
  ghost.src = cv.toDataURL(); ghost.className = 'ghost'; document.body.appendChild(ghost);
  const x0 = ev.clientX, y0 = ev.clientY;
  const move = e => { ghost.style.left = e.clientX + 'px'; ghost.style.top = e.clientY + 'px'; };
  move(ev);
  const up = e => {
    document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up);
    ghost.remove();
    const r = $('cv').getBoundingClientRect();
    const moved = Math.hypot(e.clientX - x0, e.clientY - y0) > 6;
    if (!moved) return placeObject(type, ...defaultSpot(type));      // 點一下：放到預設位置
    if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
      const p = toWorld(e);
      placeObject(type, p.x, p.y);
    }
  };
  document.addEventListener('pointermove', move); document.addEventListener('pointerup', up);
}
// 新放的東西出現在目前鏡頭看得到的地方
function viewCenterX() { return cam.x + VIEW_W / cam.z / 2; }
function viewRandX(spread = .35) { const half = Math.min(W, VIEW_W / cam.z) * spread; return clamp(viewCenterX() + rand(-half, half), TANK.left + 40, TANK.right - 40); }
function defaultSpot(type) {
  const wy = world.waterY, x = viewRandX();
  const k = SPECIES[type]?.kind;
  if (k === 'fish' || k === 'turtle') return [x, lerp(wy, TANK.floor, .5)];
  if (k === 'larva') return [x, wy + 8];
  if (k === 'tadpole') return [x, lerp(wy, TANK.floor, .7)];
  if (k === 'whale') return [clamp(viewCenterX(), TANK.left + SPECIES.whale.len / 2, TANK.right - SPECIES.whale.len / 2), lerp(wy, TANK.floor, .5)];
  if (k === 'mosquito' || k === 'gecko') return [x, rand(TANK.top + 40, Math.max(TANK.top + 50, wy - 40))];
  if (k === 'frog') {
    const spots = landSpots(), near = spots.filter(s => Math.abs(s.x - viewCenterX()) < VIEW_W / cam.z / 2);
    const s = pick(near.length ? near : spots) || P(x, wy); return [s.x, s.y - 40];
  }
  if (type === 'wood') return [x, wy - 10];
  return [x, TANK.top + 60];
}
function placeObject(type, x, y) {
  if (type === 'food') return dropFood(x);
  if (DECOR_TYPES[type]) { const d = makeDecor(type, x, y); settle(d); select(d); return; }
  const e = makeEnt(type, x, y);
  select(e);
  const L = SPECIES[type].len * e.size;
  if (L > (TANK.right - TANK.left) * .8) toast(`${SPECIES[type].name}約 ${Math.round(L / PX_PER_CM)} cm，這個缸太小了，建議換大缸或調小體型`);
}

// ---------------------------------------------------------------------
// 畫布：選取與拖曳
// ---------------------------------------------------------------------
function toView(ev) {
  const r = $('cv').getBoundingClientRect();
  return P((ev.clientX - r.left) / r.width * VIEW_W, (ev.clientY - r.top) / r.height * VIEW_H);
}
function toWorld(ev) { const v = toView(ev); return P(cam.x + v.x / cam.z, cam.y + v.y / cam.z); }
function hitTest(p) {
  for (let i = world.ents.length - 1; i >= 0; i--) {
    const e = world.ents[i];
    if (e.kind === 'gecko' && e.surface === 'glass' && e.chain) { if (e.chain.some(c => dist(c, p) < 14 * e.size)) return e; continue; }
    if (e.kind === 'whale') { const L = whaleL(e); if (Math.abs(p.x - e.x) < L * .5 && Math.abs(p.y - e.y) < L * .09) return e; continue; }
    if (dist(entCenter(e), p) < SPECIES[e.type].hit * e.size + 4) return e;
  }
  for (let i = world.decor.length - 1; i >= 0; i--) {
    const d = world.decor[i];
    if (d.type === 'plant') { if (Math.abs(p.x - d.x) < d.w / 2 && p.y <= d.y && p.y >= d.y - d.h) return d; continue; }
    const s = decorSpan(d, p.x);
    if (s && p.y >= s.top - 4 && p.y <= s.bottom + 4) return d;
  }
  return null;
}
function select(obj) { UI.sel = obj; updatePanels(true); }
// 畫布操作：
//   拖曳物件 → 移動（編輯模式）
//   拖曳空白處 → 移動鏡頭；點一下空白處 → 取消選取（觀賞模式：餵食）
//   滾輪 / 兩指縮放 → 縮放鏡頭（選取漂流木時滾輪改成旋轉）
const pointers = new Map();
let pinch = null;
function endObjectDrag() {
  if (!UI.drag) return;
  const o = UI.drag.obj; UI.drag = null;
  if (o.kind) { o.held = false; if (!o.dead) afterDrop(o); }
  else settle(o);
}
function bindCanvas() {
  const cv = $('cv');
  cv.addEventListener('pointerdown', ev => {
    cv.setPointerCapture(ev.pointerId);
    pointers.set(ev.pointerId, toView(ev));
    if (pointers.size === 2) {                                  // 兩指：縮放
      endObjectDrag(); UI.pan = null;
      const [a, b] = [...pointers.values()];
      pinch = { d: dist(a, b), c: P((a.x + b.x) / 2, (a.y + b.y) / 2) };
      return;
    }
    if (pointers.size > 2) return;
    const p = toWorld(ev);
    const hit = UI.mode === 'edit' ? hitTest(p) : null;
    if (hit) {
      select(hit);
      UI.drag = { obj: hit, dx: hit.x - p.x, dy: hit.y - p.y };
      if (hit.kind) hit.held = true;
    } else {
      const v = toView(ev);
      UI.pan = { vx: v.x, vy: v.y, cx: cam.x, cy: cam.y, moved: false };
    }
  });
  cv.addEventListener('pointermove', ev => {
    if (!pointers.has(ev.pointerId)) return;
    pointers.set(ev.pointerId, toView(ev));
    if (pinch && pointers.size === 2) {
      const [a, b] = [...pointers.values()], d = dist(a, b), c = P((a.x + b.x) / 2, (a.y + b.y) / 2);
      camZoomAt(d / (pinch.d || 1), c.x, c.y);
      cam.x -= (c.x - pinch.c.x) / cam.z; cam.y -= (c.y - pinch.c.y) / cam.z; camClamp();
      pinch = { d, c };
      return;
    }
    if (UI.drag) {
      const p = toWorld(ev), o = UI.drag.obj;
      o.x = clamp(p.x + UI.drag.dx, TANK.left + 10, TANK.right - 10);
      o.y = clamp(p.y + UI.drag.dy, TANK.top + 6, TANK.floor + (o.kind ? 0 : 20));
    } else if (UI.pan) {
      const v = toView(ev), dx = v.x - UI.pan.vx, dy = v.y - UI.pan.vy;
      if (Math.hypot(dx, dy) > 6) UI.pan.moved = true;
      if (UI.pan.moved) { cam.x = UI.pan.cx - dx / cam.z; cam.y = UI.pan.cy - dy / cam.z; camClamp(); }
    }
  });
  const end = ev => {
    pointers.delete(ev.pointerId);
    if (pinch) { if (pointers.size < 2) pinch = null; return; }
    endObjectDrag();
    if (UI.pan && !UI.pan.moved) {
      if (UI.mode === 'view') dropFood(toWorld(ev).x, 3);      // 觀賞模式：點一下就餵食
      else select(null);
    }
    UI.pan = null;
  };
  cv.addEventListener('pointerup', end);
  cv.addEventListener('pointercancel', end);
  cv.addEventListener('wheel', ev => {
    ev.preventDefault();
    if (UI.sel && UI.sel.type === 'wood' && !ev.ctrlKey) { UI.sel.rot = clamp(UI.sel.rot + Math.sign(ev.deltaY) * .05, -1.2, 1.2); return; }
    const v = toView(ev);
    camZoomAt(ev.deltaY < 0 ? 1.15 : 1 / 1.15, v.x, v.y);
  }, { passive: false });
  document.addEventListener('keydown', ev => {
    if (ev.target.tagName === 'INPUT') return;
    if ((ev.key === 'Delete' || ev.key === 'Backspace') && UI.sel) { deleteSel(); ev.preventDefault(); }
    if (ev.key === ' ') { setSpeed(UI.speed ? 0 : 1); ev.preventDefault(); }
  });
}
function deleteSel() {
  const o = UI.sel; if (!o) return;
  if (o.kind) o.removed = true; else world.decor = world.decor.filter(d => d !== o);
  world.ents = world.ents.filter(e => !e.removed);
  select(null);
}

// ---------------------------------------------------------------------
// 右側面板
// ---------------------------------------------------------------------
function bar(v, color) { return `<div class="bar"><i style="width:${clamp(v, 0, 100)}%;background:${color}"></i></div>`; }
let lastSelKey = '';
function updatePanels(force) {
  const o = UI.sel && (world.ents.includes(UI.sel) || world.decor.includes(UI.sel)) ? UI.sel : null;
  if (!o && UI.sel) UI.sel = null;
  const el = $('selPanel');
  if (!o) { el.innerHTML = '<p class="muted">點選缸內的物件查看狀態，或從左側拖曳物件進來。<br>拖曳空白處可移動畫面，滾輪可縮放。</p>'; }
  else if (o.kind) {
    // 面板只在換選取對象時建立一次，之後只更新數值（滑桿拖曳中才不會被重置）
    const sp = SPECIES[o.type], key = 'e' + o.id;
    if (force || key !== lastSelKey) {
      el.innerHTML = `<h4>${sp.name} <small>#${o.id}</small></h4>
        <div class="kv"><span>狀態</span><b data-f="state"></b></div>
        ${sp.hungerTime ? `<div class="kv"><span>飽食度</span><b data-f="hunger"></b></div><div class="bar"><i data-f="hungerBar"></i></div>` : ''}
        <div class="kv"><span>生命值</span><b data-f="hp"></b></div><div class="bar"><i data-f="hpBar" style="background:#e05a7a"></i></div>
        <div class="kv"><span>成體體型</span><b data-f="size"></b></div>
        <input type="range" class="sizeSlider" data-f="sizeSlider" min="0.3" max="3" step="0.05">
        <div class="kv"><span>實際長度</span><b data-f="len"></b></div>
        <div class="kv"><span>已捕食</span><b data-f="eaten"></b></div>
        <div class="kv"><span>年齡</span><b data-f="age"></b></div>
        <div class="btns"><button data-act="feedsel">餵牠</button><button data-act="size1">體型重設</button><button data-act="del">刪除</button></div>`;
      lastSelKey = key;
    }
    const f = n => el.querySelector(`[data-f="${n}"]`);
    const surf = o.kind === 'gecko' ? (o.surface === 'glass' ? '（背面玻璃）' : '（陸地）') : '';
    f('state').textContent = `${o.dead ? '💀 ' : ''}${o.state || '—'}${surf}`;
    if (f('hunger')) { f('hunger').textContent = Math.round(o.hunger) + '%'; f('hungerBar').style.width = clamp(o.hunger, 0, 100) + '%'; f('hungerBar').style.background = o.hunger < 25 ? '#e0603a' : '#4caf50'; }
    f('hp').textContent = Math.round(o.hp); f('hpBar').style.width = clamp(o.hp, 0, 100) + '%';
    const base = sp.scale || 1, grown = o.size / o.adult;
    f('size').textContent = (o.adult / base).toFixed(2) + 'x' + (grown < .97 && o.kind !== 'tadpole' ? `（成長 ${Math.round(grown * 100)}%）` : '');
    if (document.activeElement !== f('sizeSlider')) f('sizeSlider').value = o.adult / base;
    f('len').textContent = (sp.len * o.size / PX_PER_CM).toFixed(1) + ' cm';
    f('eaten').textContent = o.eaten;
    f('age').textContent = Math.floor(o.age) + ' 秒';
    return updatePop();
  } else {
    const key = 'd' + o.id;
    if (!force && key === lastSelKey) return updatePop();
    el.innerHTML = `<h4>${DECOR_TYPES[o.type].name} <small>#${o.id}</small></h4>
      <div class="btns">
        <button data-act="bigger">放大</button><button data-act="smaller">縮小</button>
        ${o.type === 'wood' ? '<button data-act="rotl">⟲</button><button data-act="rotr">⟳</button>' : ''}
        <button data-act="del">刪除</button></div>
      <p class="muted">拖曳可移動${o.type === 'wood' ? '；滑鼠滾輪可旋轉（Ctrl＋滾輪改為縮放）' : '；放開後會落到地面'}</p>`;
    lastSelKey = key;
    return updatePop();
  }
  lastSelKey = '';
  updatePop();
}
function updatePop() {
  const counts = {}, st = { egg: 0, larva: 0, pupa: 0 };
  for (const e of world.ents) if (!e.dead) {
    counts[e.type] = (counts[e.type] || 0) + 1;
    if (e.kind === 'larva') st[e.stage] += e.stage === 'egg' ? e.count : 1;
  }
  $('popPanel').innerHTML = Object.keys(SPECIES).filter(t => t !== 'larva' && t !== 'nest').map(t => `<div class="kv"><span>${SPECIES[t].name}</span><b>${counts[t] || 0}</b></div>`).join('')
    + `<div class="kv"><span>孑孓 / 蛹 / 卵</span><b>${st.larva} / ${st.pupa} / ${st.egg}</b></div>`
    + `<div class="kv"><span>青蛙卵 / 爬蟲蛋</span><b>${world.ents.filter(e => e.kind === 'nest' && !e.dead && e.medium === 'water').length} / ${world.ents.filter(e => e.kind === 'nest' && !e.dead && e.medium === 'land').length}</b></div>`
    + `<div class="kv"><span>飼料</span><b>${world.food.length}</b></div>`;
  const ev = world.events.slice(0, 8);
  $('eventPanel').innerHTML = ev.length ? ev.map(e => `<div class="ev"><time>${fmtTime(e.t)}</time>${e.text}</div>`).join('') : '<p class="muted">還沒有事件</p>';
  drawChart();
  const t = Math.floor(world.t);
  $('clock').textContent = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}
function bindSidePanel() {
  $('selPanel').addEventListener('input', ev => {             // 體型滑桿：即時變大變小
    const o = UI.sel;
    if (!o || !o.kind || ev.target.dataset.f !== 'sizeSlider') return;
    const ratio = o.size / o.adult;                           // 幼體保持成長比例
    o.adult = +ev.target.value * (SPECIES[o.type].scale || 1); o.size = o.adult * ratio;
    if (o.kind === 'gecko' && o.surface === 'glass') updChain(o);
    updatePanels(false);
  });
  $('selPanel').addEventListener('click', ev => {
    const act = ev.target.dataset.act, o = UI.sel; if (!act || !o) return;
    if (act === 'del') return deleteSel();
    if (act === 'feedsel') { o.hunger = 100; o.hp = Math.min(100, o.hp + 20); }
    if (act === 'size1') { const r = o.size / o.adult; o.adult = SPECIES[o.type].scale || 1; o.size = o.adult * r; if (o.kind === 'gecko' && o.surface === 'glass') initChain(o, o.ang); }
    if (act === 'bigger' || act === 'smaller') {
      const f = act === 'bigger' ? 1.15 : 1 / 1.15;
      o.w = clamp(o.w * f, 30, 900);
      if (o.type !== 'wood') o.h = clamp(o.h * f, 20, 600);
      settle(o);
    }
    if (act === 'rotl') o.rot = clamp(o.rot - .1, -1.2, 1.2);
    if (act === 'rotr') o.rot = clamp(o.rot + .1, -1.2, 1.2);
    updatePanels(true);
  });
  // 設定
  const s = world.settings, box = $('setPanel');
  box.innerHTML = `
    <label><input type="checkbox" data-set="death"> 生物會死亡</label>
    <div class="sub">捕食規則</div>
    ${RULES.map(r => `<label><input type="checkbox" data-rule="${r.id}"> ${r.label}</label>`).join('')}
    <div class="sub">缸外飛進來的蚊子</div>
    <select id="mosqRate"><option value="off">不出現</option><option value="low">少</option><option value="mid">中</option><option value="high">多</option></select>
    <div class="sub">行為</div>
    <label><input type="checkbox" data-set="breed"> 生物會繁殖</label>
    <label><input type="checkbox" data-set="sizeCheck"> 依體型判斷能不能吃</label>
    <label><input type="checkbox" data-set="sharkChase"> 紅尾黑鯊驅趕其他魚</label>
    <div class="sub">除錯</div>
    <label><input type="checkbox" data-set="debugSight"> 顯示所有視野</label>
    <label><input type="checkbox" data-set="debugBones"> 顯示骨架</label>`;
  syncSettings();
  box.addEventListener('change', ev => {
    const t = ev.target;
    if (t.dataset.set) s[t.dataset.set] = t.checked;
    if (t.dataset.rule) s.rules[t.dataset.rule] = t.checked;
    if (t.id === 'mosqRate') { s.mosqRate = t.value; world.spawnT = 1; }
  });
}
function syncSettings() {
  const s = world.settings;
  document.querySelectorAll('[data-set]').forEach(c => c.checked = !!s[c.dataset.set]);
  document.querySelectorAll('[data-rule]').forEach(c => c.checked = !!s.rules[c.dataset.rule]);
  $('mosqRate').value = s.mosqRate;
  syncTankUI();
  $('water').value = Math.round(world.level * 100); $('waterVal').textContent = $('water').value + '%';
}

// ---------------------------------------------------------------------
// 下方工具列
// ---------------------------------------------------------------------
function setSpeed(v) {
  UI.speed = v;
  document.querySelectorAll('[data-speed]').forEach(b => b.classList.toggle('on', +b.dataset.speed === v));
}
function setMode(m) {
  UI.mode = m;
  document.body.classList.toggle('view', m === 'view');
  if (m === 'view') select(null);
  requestAnimationFrame(resize);
}
function bindBar() {
  $('water').addEventListener('input', ev => { world.level = ev.target.value / 100; $('waterVal').textContent = ev.target.value + '%'; updateWaterY(); });
  document.querySelectorAll('[data-speed]').forEach(b => b.onclick = () => setSpeed(+b.dataset.speed));
  $('feed').onclick = () => { for (let i = 0; i < 4; i++) dropFood(viewRandX(.4), 3); };
  $('tank').innerHTML = Object.entries(TANK_PRESETS).map(([k, p]) => `<option value="${k}">${p.name}</option>`).join('');
  syncTankUI();
  $('tank').onchange = ev => {
    const from = TANK_PRESETS[world.tank], to = TANK_PRESETS[ev.target.value];
    setTankSize(ev.target.value);
    toast(to.w * to.h < from.w * from.h ? `${to.name}：缸變小了，造景可能會擠壓到生物的空間` : to.name);
  };
  $('zoomIn').onclick = () => camZoomAt(1.3);
  $('zoomOut').onclick = () => camZoomAt(1 / 1.3);
  $('zoomFit').onclick = () => camFit();
  $('save').onclick = () => { try { localStorage.setItem('aquarium.save', JSON.stringify(serialize())); toast('已存檔'); } catch { toast('存檔失敗（瀏覽器不允許）'); } };
  $('load').onclick = () => {
    let raw = null; try { raw = localStorage.getItem('aquarium.save'); } catch { }
    if (!raw) return toast('沒有存檔');
    deserialize(JSON.parse(raw)); syncSettings(); select(null); toast('已讀檔');
  };
  $('export').onclick = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(serialize(), null, 1)], { type: 'application/json' }));
    a.download = 'aquarium-scene.json'; a.click(); URL.revokeObjectURL(a.href);
  };
  $('import').onclick = () => $('file').click();
  $('file').onchange = async ev => {
    const f = ev.target.files[0]; if (!f) return;
    try { deserialize(JSON.parse(await f.text())); syncSettings(); select(null); toast('已匯入'); } catch { toast('檔案格式不正確'); }
    ev.target.value = '';
  };
  $('clear').onclick = () => { if (confirm('清空整個水族箱？')) { world.decor = []; world.ents = []; world.food = []; resetLogs(); select(null); } };
  $('sample').onclick = () => { loadSampleScene(); syncSettings(); select(null); };
  $('toView').onclick = () => setMode('view');
  $('toEdit').onclick = () => setMode('edit');
}
function syncTankUI() { const el = $('tank'); if (el) el.value = world.tank; }
let toastT = 0;
function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 1600);
}

// ---------------------------------------------------------------------
// 族群折線圖
// ---------------------------------------------------------------------
const SERIES = [
  { key: 'fish', label: '魚', css: '--series-1' },
  { key: 'mosq', label: '蚊子', css: '--series-2' },
  { key: 'larva', label: '孑孓', css: '--series-3' },
];
let chartHover = null;
const fmtTime = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
function drawChart() {
  const cv = $('chart'), box = cv.parentElement.getBoundingClientRect();
  const dpr = Math.min(devicePixelRatio || 1, 2), w = Math.max(120, box.width), h = 120;
  if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = h * dpr; cv.style.width = w + 'px'; cv.style.height = h + 'px'; }
  const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h);
  const css = getComputedStyle(document.documentElement), col = v => css.getPropertyValue(v).trim();
  const data = world.hist, padL = 24, padR = 34, padT = 6, padB = 16, pw = w - padL - padR, ph = h - padT - padB;
  let max = 5; for (const d of data) for (const s of SERIES) max = Math.max(max, d[s.key]);
  max = Math.ceil(max / 5) * 5;
  c.font = '11px system-ui, "Microsoft JhengHei", sans-serif'; c.fillStyle = col('--muted'); c.strokeStyle = col('--line'); c.lineWidth = 1;
  for (const v of [0, max / 2, max]) {
    const y = padT + ph - v / max * ph;
    c.beginPath(); c.moveTo(padL, y + .5); c.lineTo(padL + pw, y + .5); c.stroke();
    c.textAlign = 'right'; c.textBaseline = 'middle'; c.fillText(v, padL - 4, y);
  }
  if (data.length < 2) { c.textAlign = 'center'; c.fillText('收集資料中…', padL + pw / 2, padT + ph / 2); $('chartTip').style.display = 'none'; return; }
  const t0 = data[0].t, t1 = data[data.length - 1].t;
  const X = t => padL + (t - t0) / Math.max(1, t1 - t0) * pw, Y = v => padT + ph - v / max * ph;
  c.textAlign = 'left'; c.fillText(`近 ${Math.round((t1 - t0) / 6) / 10} 分鐘`, padL, h - 6);
  for (const s of SERIES) {
    c.strokeStyle = col(s.css); c.lineWidth = 2; c.lineJoin = 'round'; c.beginPath();
    data.forEach((d, i) => i ? c.lineTo(X(d.t), Y(d[s.key])) : c.moveTo(X(d.t), Y(d[s.key]))); c.stroke();
  }
  // 線尾標籤：依數值排序後推開，避免重疊（文字用一般字色）
  const ends = SERIES.map(s => ({ s, y: Y(data[data.length - 1][s.key]) })).sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) ends[i].y = Math.max(ends[i].y, ends[i - 1].y + 12);
  for (const e of ends) { c.fillStyle = col('--ink'); c.textBaseline = 'middle'; c.textAlign = 'left'; c.fillText(e.s.label, padL + pw + 4, e.y); }
  const tip = $('chartTip');
  if (chartHover === null) { tip.style.display = 'none'; return; }
  const t = t0 + (clamp(chartHover, padL, padL + pw) - padL) / pw * (t1 - t0);
  const d = data.reduce((a, b) => Math.abs(b.t - t) < Math.abs(a.t - t) ? b : a);
  c.strokeStyle = col('--muted'); c.lineWidth = 1; c.beginPath(); c.moveTo(X(d.t) + .5, padT); c.lineTo(X(d.t) + .5, padT + ph); c.stroke();
  for (const s of SERIES) { c.fillStyle = col(s.css); c.beginPath(); c.arc(X(d.t), Y(d[s.key]), 4, 0, 7); c.fill(); c.strokeStyle = col('--panel'); c.lineWidth = 2; c.stroke(); }
  tip.innerHTML = `<b>${fmtTime(d.t)}</b>` + SERIES.map(s => `<div><i style="background:var(${s.css})"></i>${s.label}<b>${d[s.key]}</b></div>`).join('');
  tip.style.display = 'block';
  tip.style.left = (X(d.t) > w / 2 ? X(d.t) - 102 : X(d.t) + 10) + 'px';
}
function bindChart() {
  const cv = $('chart');
  cv.addEventListener('pointermove', ev => { chartHover = ev.clientX - cv.getBoundingClientRect().left; drawChart(); });
  cv.addEventListener('pointerleave', () => { chartHover = null; drawChart(); });
}

function initUI() {
  bindChart();
  buildPalette(); bindCanvas(); bindSidePanel(); bindBar();
  setInterval(() => updatePanels(false), 250);
  updatePanels(true);
}
