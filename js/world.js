'use strict';
// =====================================================================
// world.js — 世界狀態、地形查詢、生物建立、食物、存檔
// （這一層只處理資料，不呼叫任何繪圖指令）
// =====================================================================

// 魚缸尺寸（寬×高，像素）；換算約 18 px = 1 cm
const TANK_PRESETS = {
  mini:     { name: '迷你缸 45×30 cm',  w: 840,  h: 540 },
  standard: { name: '標準缸 70×40 cm',  w: 1280, h: 720 },
  wide:     { name: '寬缸 105×40 cm',   w: 1920, h: 720 },
  large:    { name: '大型缸 140×50 cm', w: 2560, h: 900 },
  show:     { name: '展示缸 210×60 cm', w: 3840, h: 1080 },
};

const world = {
  tank: 'standard',
  level: .55, waterY: 0, t: 0, nextId: 1, spawnT: 3,
  decor: [], ents: [], food: [],
  events: [],          // 事件紀錄（誰吃了誰、產卵、羽化、死亡）
  fx: [],              // 純視覺效果（不影響模擬）
  hist: [], histT: 0,  // 族群數量歷史（折線圖用）
  particles: [],       // 水花、漣漪、氣泡（純視覺）
  water: { dirt: 5, algae: 3 },   // 水質：髒污、藻類（0～100）
  tailBits: [],        // 壁虎斷掉、還在扭動的尾巴（純視覺）
  molts: [],           // 蝦蛻下的空殼（純視覺）
  tod: .375,           // 一天中的時間（0 = 午夜；預設早上 9 點）
  settings: {
    death: true,
    rules: Object.fromEntries(RULES.map(r => [r.id, true])),
    mosqRate: 'low',
    debugSight: false,
    debugBones: false,
    sizeCheck: true,     // 依體型判斷能不能吃（獵物要小於掠食者的一半）
    breed: true,         // 生物會繁殖
    sharkChase: true,    // 紅尾黑鯊驅趕其他魚
    autotomy: true,      // 壁虎被抓時可能斷尾
    waterSim: true,      // 水質與藻類
    dayCycle: 'normal',  // 日夜循環：off / fast / normal / real
  },
};

function updateWaterY() { world.waterY = TANK.floor - world.level * (TANK.floor - TANK.top); }

function applyTankDims(key) {
  const p = TANK_PRESETS[key] || TANK_PRESETS.standard;
  world.tank = TANK_PRESETS[key] ? key : 'standard';
  W = p.w; H = p.h;
  TANK.left = 16; TANK.right = W - 16; TANK.top = 40; TANK.floor = H - 52;
  updateWaterY();
}
// 改變魚缸尺寸：保留缸內所有東西（以缸底對齊，超出右邊的往內推）
function setTankSize(key) {
  if (!TANK_PRESETS[key] || key === world.tank) return;
  const oldFloor = TANK.floor;
  applyTankDims(key);
  const dy = TANK.floor - oldFloor;
  const fix = o => { o.y += dy; o.x = clamp(o.x, TANK.left + 10, TANK.right - 10); };
  world.decor.forEach(d => { d.y += dy; d.x = clamp(d.x, TANK.left + d.w * .3, TANK.right - d.w * .3); });
  world.food.forEach(fix);
  world.ents.forEach(e => { fix(e); if (e.ty !== undefined) e.ty += dy; e.goal = null; e.feet = null; });
  world.decor.forEach(d => { if (d.type !== 'wood') settle(d); });
  world.ents.forEach(e => { if (!e.dead) afterDrop(e); });
  if (typeof onTankResize === 'function') onTankResize();
}

// ---------------------------------------------------------------------
// 地形：每個造景都能回答「在 x 這個位置，實心部分的上緣和下緣在哪」
// ---------------------------------------------------------------------
function rockNoise(d, u) { return .07 * Math.sin(u * 7 + d.seed) + .04 * Math.sin(u * 13 + d.seed * 2.3); }
function woodEnds(d) {
  const c = Math.cos(d.rot), s = Math.sin(d.rot);
  return [P(d.x - c * d.w / 2, d.y - s * d.w / 2), P(d.x + c * d.w / 2, d.y + s * d.w / 2)];
}
const isStick = d => d.type === 'wood' || d.type === 'branch';      // 長條形的造景（用兩端點計算）
function decorSpan(d, x) {
  if (d.type === 'plant') return null;
  if (isStick(d)) {
    const [a, b] = woodEnds(d);
    if (x < Math.min(a.x, b.x) || x > Math.max(a.x, b.x)) return null;
    const t = (x - a.x) / ((b.x - a.x) || 1), y = lerp(a.y, b.y, t), half = d.h / 2 / Math.cos(d.rot);
    return { top: y - half, bottom: y + half };
  }
  const u = (x - d.x) / (d.w / 2);
  if (u <= -1 || u >= 1) return null;
  let k;
  if (d.type === 'mound') k = Math.pow(.5 + .5 * Math.cos(Math.PI * u), .8);
  else k = Math.pow(1 - u * u, d.type === 'boulder' ? .35 : .55) * (1 + rockNoise(d, u) * (1 - u * u));
  return { top: d.y - d.h * k, bottom: d.y };
}
function solidAt(x, y, skip) {
  if (x < TANK.left || x > TANK.right || y >= TANK.floor) return true;
  for (const d of world.decor) {
    if (d === skip || !DECOR_TYPES[d.type].solid) continue;
    const s = decorSpan(d, x);
    if (s && y >= s.top && y <= s.bottom) return true;
  }
  return false;
}
// 腳下的地面：找 y 附近（最多往上 step）最近的一個上緣
// 已經卡在實心地形裡：回傳最近的邊緣（上緣或下緣）的 y；沒卡住回傳 null
function escapeSolid(x, y, skip) {
  for (const d of world.decor) {
    if (d === skip || !DECOR_TYPES[d.type].solid) continue;
    const s = decorSpan(d, x);
    if (s && y >= s.top && y <= s.bottom) return (y - s.top < s.bottom - y) ? s.top - 3 : s.bottom + 3;
  }
  return null;
}
function groundY(x, y, step = 10, skip) {
  let g = TANK.floor;
  for (const d of world.decor) {
    if (d === skip || !DECOR_TYPES[d.type].solid) continue;
    const s = decorSpan(d, x);
    if (s && s.top >= y - step && s.top < g) g = s.top;
  }
  return g;
}
function highestTop(x) {
  let g = TANK.floor;
  for (const d of world.decor) {
    if (!DECOR_TYPES[d.type].solid) continue;
    const s = decorSpan(d, x);
    if (s && s.top < g) g = s.top;
  }
  return g;
}
// 石頭、土坡放下後會落到下面的地面上；水草會長在地面上
function settle(d) {
  if (d.type === 'branch') {                                         // 樹枝：一端插在最近的側面玻璃，尖端稍微下垂；高度不變
    const side = d.x < (TANK.left + TANK.right) / 2 ? -1 : 1;
    d.w = Math.min(d.w, (TANK.right - TANK.left) * .7);
    d.rot = side < 0 ? .09 : -.09;
    d.x = side < 0 ? TANK.left - 14 + Math.cos(d.rot) * d.w / 2 : TANK.right + 14 - Math.cos(d.rot) * d.w / 2;
    d.y = clamp(d.y, TANK.top + 60, TANK.floor - 30);
    return;
  }
  if (d.type === 'wood' || d.type === 'filter') return;
  if (d.type === 'floater') { d.y = world.waterY; return; }
  if (d.type === 'plant' || d.type === 'fern' || d.type === 'carpet') { d.y = groundY(d.x, d.y - 10, 0, d); return; }
  let base = TANK.floor;
  for (let k = -2; k <= 2; k++) base = Math.min(base, groundY(d.x + d.w * .17 * k, d.y - 4, 0, d));
  d.y = base + (base >= TANK.floor ? 0 : 8);
}
// 找可以上岸的地點（陸地上緣高於水面）
function landSpots(maxAboveWater = Infinity) {
  const wy = world.waterY, out = [];
  for (let x = TANK.left + 30; x < TANK.right - 30; x += 16) {
    const top = highestTop(x);
    if (top < wy - 6 && wy - top < maxAboveWater && top > TANK.top + 50 && !solidAt(x, top - 24)) out.push(P(x, top));
  }
  return out;
}

// ---------------------------------------------------------------------
// 建立物件
// ---------------------------------------------------------------------
function makeDecor(type, x, y, extra = {}) {
  const t = DECOR_TYPES[type];
  const d = { id: world.nextId++, type, x, y, w: t.w, h: t.h, rot: type === 'wood' ? .22 : type === 'branch' ? .09 : 0, seed: Math.random() * 100, ...extra };
  world.decor.push(d);
  return d;
}
function makeEnt(type, x, y, push = true) {
  const sp = SPECIES[type];
  const e = {
    id: world.nextId++, type, kind: sp.kind, x, y, dir: Math.random() < .5 ? 1 : -1,
    vx: 0, vy: 0, v: 0, hunger: rand(70, 100), hp: 100, adult: rand(.88, 1.12) * (sp.scale || 1), size: 1, age: 0,
    state: '', mode: '', modeT: 0, think: rand(0, 2), turnT: 0, turning: false,
    phase: rand(0, 6), freq: 2, amp: .5, pec: 0, limb: 0, dist: 0, eaten: 0, dead: false,
  };
  if (sp.kind === 'mosquito') { e.life = rand(...sp.life); e.eggT = rand(...sp.firstEgg); e.surfT = 0; }
  e.size = e.adult;                                           // 玩家放進來的是成體；出生的幼體由繁殖程式改小
  if (sp.kind === 'larva') { e.stage = 'larva'; e.grow = 0; e.count = 0; e.dive = 0; }
  if (sp.kind === 'tadpole') { e.meta = 0; e.adult = 1; e.size = .4; }
  if (sp.kind === 'nest') { e.adult = e.size = 1; e.t = 0; e.hatch = 30; e.count = 1; e.of = 'frog'; e.medium = 'water'; }
  if (sp.kind === 'whale') { e.breathT = rand(...sp.breath) * .5; e.wmode = 'cruise'; }
  if (sp.kind === 'cricket' || sp.kind === 'fly') { e.life = rand(...sp.life); e.adult = e.size = rand(.9, 1.1); }
  if (sp.kind === 'gecko') { e.tailLen = 1; e.regrown = false; }
  if (sp.sexed) { e.morph = Math.floor(Math.random() * (sp.morphs === 'shrimp' ? SHRIMP_GRADES : GUPPY_MORPHS).length); setSex(e, Math.random() < .5 ? 'm' : 'f'); }
  if (sp.kind === 'shrimp') { e.moltT = rand(...sp.molt) * rand(.2, 1); e.mode = 'fall'; e.curl = 0; }
  if (sp.morphs === 'cory') { e.morph = Math.floor(Math.random() * CORY_MORPHS.length); e.cm = 'sink'; e.tilt = 0; }
  if (sp.morphs === 'axo') { e.morph = Math.floor(Math.random() * AXO_MORPHS.length); e.tilt = 0; e.gill = rand(0, 6); }
  if (push) { world.ents.push(e); afterDrop(e); }
  return e;
}
// 放下（或拖曳放開）後，依物種決定一開始的狀態
function afterDrop(e) {
  const wy = world.waterY;
  e.vx = e.vy = e.v = 0; e.turning = false; e.turnT = 0;
  if (e.kind === 'fish') { e.mode = 'cruise'; e.tx = e.x; e.ty = e.y; if (SPECIES[e.type].cory) { e.cm = 'sink'; e.vy = 0; } }
  if (e.kind === 'turtle') e.mode = e.y > wy + 4 ? 'swim' : 'fall';
  if (e.kind === 'frog') e.mode = 'jump';
  if (e.kind === 'gecko') { if (e.y > wy - 24) e.y = Math.max(TANK.top + 20, wy - 30); initChain(e, -Math.PI / 2); }
  if (e.kind === 'mosquito') e.goal = null;
  if (e.kind === 'axolotl') { e.mode = 'sink'; e.vy = 0; e.tilt = 0; }
  if (e.kind === 'bird') { e.mode = 'fly'; e.perch = null; e.carry = null; e.pitch = 0; e.cool = 3; }
  if (e.kind === 'larva') { e.dive = 0; if (e.y < wy + 6) e.y = wy + 6; }
}
// 活餌：蟋蟀放在陸地上，果蠅放在空中
function dropLive(type, x, y) {
  const sp = SPECIES[type], wy = world.waterY;
  let spots = landSpots().filter(s => s.y < wy - 30);          // 離水面遠一點，免得一跳就落水
  const near = spots.filter(s => Math.abs(s.x - x) < 300);
  if (near.length) spots = near;
  for (let i = 0; i < sp.drop; i++) {
    if (type === 'cricket') {
      const s = spots.length ? pick(spots) : P(x + rand(-40, 40), TANK.top + 20);
      const c = makeEnt('cricket', s.x + rand(-15, 15), TANK.top + 10);
      c.mode = 'fall'; c.vy = 0;
    } else makeEnt('fly', clamp(x + rand(-50, 50), TANK.left + 10, TANK.right - 10), clamp((y ?? TANK.top + 40) + rand(-30, 30), TANK.top + 12, Math.max(TANK.top + 14, wy - 10)));
  }
  logEvent(type === 'cricket' ? `🦗 投放了 ${sp.drop} 隻蟋蟀` : `🪰 投放了 ${sp.drop} 隻果蠅`);
}
// 設定性別：母魚體型較大（保持目前的成長比例）
function setSex(e, sex) {
  const sp = SPECIES[e.type], ratio = e.size / e.adult;
  if (e.sex === 'f') e.adult /= sp.femaleScale;
  e.sex = sex;
  if (sex === 'f') e.adult *= sp.femaleScale;
  e.size = e.adult * ratio; e.preg = 0;
}
// 壁虎斷尾：斷掉的尾巴會扭動一陣子；壁虎的尾巴之後慢慢長回來（再生的尾巴沒有疣鱗）
function dropTail(e) {
  if (e.kind !== 'gecko' || e.tailLen < .95) return false;
  const s = e.size;
  let x, y, ang;
  if (e.surface === 'glass' && e.chain) { const c = e.chain[9]; x = c.x; y = c.y; ang = chainAngle(e.chain, 9) + Math.PI; }
  else { x = e.x - e.dir * 50 * s; y = e.y - 3 * s; ang = e.dir > 0 ? Math.PI : 0; }
  world.tailBits.push({ x, y, ang, len: 40 * s, t: 0, seed: Math.random() * 10, onGlass: e.surface === 'glass' });
  e.tailLen = .25; e.regrown = true;
  logEvent('🦎 壁虎斷尾了（尾巴會慢慢長回來）');
  emit('autotomy', { e });
  return true;
}
// ---------------------------------------------------------------------
// 事件：模擬發生的事通知外部（成就、之後的 Steam、音效…）；模擬本身不依賴任何監聽者
// 移植時對應 Godot 的 signal、Unity 的 event
// ---------------------------------------------------------------------
const EVENT_HOOKS = [];
function onWorldEvent(fn) { EVENT_HOOKS.push(fn); }
function emit(type, data) { for (const h of EVENT_HOOKS) { try { h(type, data || {}); } catch (err) { console.warn('事件處理失敗', type, err); } } }

function dropFood(x, n = 5) {
  emit('feed');
  for (let i = 0; i < n; i++)
    world.food.push({ id: world.nextId++, kind: 'food', x: clamp(x + rand(-30, 30), TANK.left + 8, TANK.right - 8), y: TANK.top + rand(0, 10), vy: 0, t: 0 });
}
function kill(e, why) { e.dead = true; e.deadT = 0; e.state = why; e.held = false; logEvent(`💀 ${entName(e)} ${why}`); }

// ---------------------------------------------------------------------
// 事件紀錄與特效
// ---------------------------------------------------------------------
const LARVA_STAGE = { egg: '卵塊', larva: '孑孓', pupa: '蛹' };
function entName(t) {
  if (t.kind === 'food') return '飼料';
  if (t.kind === 'larva') return LARVA_STAGE[t.stage];
  if (t.kind === 'nest') return SPECIES[t.of].name + (t.medium === 'water' ? '的卵' : '的蛋');
  if (t.kind !== 'tadpole' && t.size !== undefined && t.adult && t.size < t.adult * .6) return SPECIES[t.type].name + (t.kind === 'fish' ? '魚苗' : '幼體');
  return SPECIES[t.type].name;
}
function logEvent(text) {
  world.events.unshift({ t: world.t, text });
  if (world.events.length > 40) world.events.length = 40;
}
function addFx(x, y, text, color) { world.fx.push({ x, y, text, color, t: 0 }); }
function larvaCount() {
  let n = 0;
  for (const e of world.ents) if (e.kind === 'larva' && !e.dead) n += e.stage === 'egg' ? e.count : 1;
  return n;
}

// ---------------------------------------------------------------------
// 捕食
// ---------------------------------------------------------------------
// ---------------------------------------------------------------------
// 效能：捕食規則查表、每一步的生物索引（依物種、依類別）
// 索引只在 step() 進行中有效；其他時候 entsOf* 直接回傳全部生物（呼叫端都還會自己檢查條件）
// ---------------------------------------------------------------------
const RULE_IDX = {}, PREY_KINDS = {}, PRED_KINDS = {};
for (const r of RULES) {
  (RULE_IDX[r.pred] = RULE_IDX[r.pred] || {})[r.prey] = r;
  (PREY_KINDS[r.pred] = PREY_KINDS[r.pred] || []).push(r.prey);
  (PRED_KINDS[r.prey] = PRED_KINDS[r.prey] || []).push(r.pred);
}
const NO_ENTS = [];
function buildIndex() {
  const ix = { type: {}, kind: {}, prey: {}, pred: {} };
  for (const e of world.ents) {
    if (e.dead || e.removed) continue;
    (ix.type[e.type] = ix.type[e.type] || []).push(e);
    (ix.kind[e.kind] = ix.kind[e.kind] || []).push(e);
  }
  world._ix = ix;
}
function entsOfType(type) { const ix = world._ix; return ix ? ix.type[type] || NO_ENTS : world.ents; }
function entsOfKind(kind) { const ix = world._ix; return ix ? ix.kind[kind] || NO_ENTS : world.ents; }
function kindsList(map, cacheKey, kind) {                     // 好幾個類別合併成一個清單（每一步算一次）
  const ix = world._ix; if (!ix) return world.ents;
  const c = ix[cacheKey]; if (c[kind]) return c[kind];
  const out = []; for (const k of map[kind] || NO_ENTS) for (const o of ix.kind[k] || NO_ENTS) out.push(o);
  return (c[kind] = out);
}
const preyCandidates = kind => kindsList(PREY_KINDS, 'prey', kind);   // 這個類別可能吃的生物
const predatorsOf = kind => kindsList(PRED_KINDS, 'pred', kind);      // 可能吃這個類別的生物
function threatsTo(e) {                                        // 現在真的可能吃掉 e 的生物（先排除規則關閉、只吃幼體等整類不可能的）
  const out = [];
  for (const pk of PRED_KINDS[e.kind] || NO_ENTS) {
    const r = RULE_IDX[pk][e.kind];
    if (!world.settings.rules[r.id] || (r.juvenileOnly && !(e.size < e.adult * .6))) continue;
    const list = entsOfKind(pk);
    if (list === world.ents) return world.ents;                // 不在 step 裡：直接全部（呼叫端會再檢查）
    for (const o of list) out.push(o);
  }
  return out;
}

function canEat(e, t) {
  if (!t || t === e || t.dead || t.removed || t.held) return false;
  if (t.stage === 'egg') return false;                        // 卵塊不會被吃
  if (t.kind === 'nest') return false;
  const r = RULE_IDX[e.kind] && RULE_IDX[e.kind][t.kind];
  if (!r || !world.settings.rules[r.id]) return false;
  if (r.juvenileOnly && !(t.size < t.adult * .6)) return false;
  if (r.pred === r.prey && t.type === e.type && t.size >= e.size * .6) return false;
  if (world.settings.sizeCheck && t.kind !== 'food' && SPECIES[t.type])          // 獵物要小於自己的一半
    if (SPECIES[t.type].len * t.size > SPECIES[e.type].len * e.size * .5) return false;
  return true;
}
function findPrey(e, range, ok, from = e) {
  let best = null, bd = range;
  const near = t => Math.abs(t.x - from.x) < bd && Math.abs(t.y - from.y) < bd;   // 先用方框粗篩，再做詳細檢查
  for (const t of preyCandidates(e.kind)) if (near(t) && canEat(e, t) && (!ok || ok(t))) { const d = dist(from, t); if (d < bd) { bd = d; best = t; } }
  for (const t of world.food) if (near(t) && canEat(e, t) && (!ok || ok(t))) { const d = dist(from, t); if (d < bd) { bd = d; best = t; } }
  return best;
}
function eat(e, t) {
  t.removed = true;
  const v = FOOD_VALUE[t.kind] || 10;
  e.hunger = Math.min(100, e.hunger + v);
  e.eaten++;
  addFx(t.x, t.y, '+' + v, t.kind === 'food' ? '#c08a4f' : '#ffb020');
  if (t.kind !== 'food') logEvent(`${entName(e)} 吃掉 ${entName(t)}`);
  emit('eat', { pred: e, prey: t });
  if (t.y > world.waterY + 6 && Math.random() < .6) bubbles(t.x, t.y, 2);      // 水中進食冒小氣泡
}

// ---------------------------------------------------------------------
// 模擬一步
// ---------------------------------------------------------------------
function step(dt) {
  world.t += dt;
  updateWaterY();
  tickDayNight(dt);
  spawnMosquitoes(dt);
  buildIndex();
  for (const e of world.ents) {
    if (e.held || e.removed) continue;
    if (e.dead) { updDead(e, dt); continue; }
    e.age += dt;
    UPDATE[e.kind](e, dt);
    hungerTick(e, dt);
    if (!e.removed && !e.dead) { growTick(e, dt); tickBreed(e, dt); }
  }
  for (const f of world.food) updFood(f, dt);
  world._ix = null;
  // 安全網：座標壞掉（NaN）就移除，超出魚缸就拉回來
  for (const e of world.ents) {
    if (!Number.isFinite(e.x) || !Number.isFinite(e.y)) { e.removed = true; console.warn('移除座標異常的生物', e.type, e.state); continue; }
    if (e.x < TANK.left || e.x > TANK.right || e.y < TANK.top - 30 || e.y > TANK.floor + 2) {
      if (!world.oobWarned) { console.warn('生物超出魚缸，已拉回', e.type, e.state, e.mode, Math.round(e.x), Math.round(e.y)); world.oobWarned = true; }
      e.x = clamp(e.x, TANK.left + 4, TANK.right - 4); e.y = clamp(e.y, TANK.top - 30, TANK.floor);
    }
  }
  world.ents = world.ents.filter(e => !e.removed);
  world.food = world.food.filter(f => !f.removed);
  tickParticles(dt);
  tickWater(dt);
  for (const b of world.tailBits) b.t += dt;
  for (const m of world.molts) m.t += dt;
  world.molts = world.molts.filter(m => m.t < 40);   // 真實的蝦也會吃掉空殼補鈣
  world.tailBits = world.tailBits.filter(b => b.t < 9);
  for (const f of world.fx) { f.t += dt; f.y -= 18 * dt; }
  world.fx = world.fx.filter(f => f.t < 1.2);
  world.histT -= dt;
  if (world.histT <= 0) { world.histT = 2; sampleHistory(); }
}
function sampleHistory() {
  let fish = 0, mosq = 0;
  for (const e of world.ents) if (!e.dead) { if (e.kind === 'fish') fish++; if (e.kind === 'mosquito') mosq++; }
  world.hist.push({ t: world.t, fish, mosq, larva: larvaCount() });
  if (world.hist.length > 300) world.hist.shift();         // 最多保留 10 分鐘
}
// 成長：吃得飽（飽食度 > 30）才會長大
function growTick(e, dt) {
  const sp = SPECIES[e.type];
  if (!sp.growTime || e.size >= e.adult || e.hunger < 30) return;
  e.size = Math.min(e.adult, e.size + e.adult * (1 - (sp.birth || .3)) / sp.growTime * dt);
}
const isAdult = e => e.size >= e.adult * .9;
// 族群上限：大缸依面積放大
function capFor(key) { return Math.round(CAPS[key] * Math.max(.5, (W * H) / (1280 * 720))); }
function countKind(kind) { return world.ents.filter(o => o.kind === kind && !o.dead).length; }

function hungerTick(e, dt) {
  const sp = SPECIES[e.type];
  if (!sp.hungerTime) return;
  e.hunger -= 100 / sp.hungerTime * dt;
  if (e.hunger <= 0) {
    if (world.settings.death) { e.hunger = 0; e.hp -= 100 / 40 * dt; if (e.hp <= 0) kill(e, '餓死'); }
    else e.hunger = 1;                          // 死亡關閉：飽食度停在 1%
  } else if (e.hunger > 20 && e.hp < 100) e.hp = Math.min(100, e.hp + dt * 2);
}
function updDead(e, dt) {
  e.deadT += dt;
  const wy = world.waterY;
  const floats = e.kind === 'fish' || e.kind === 'larva' || e.kind === 'tadpole' || e.kind === 'whale';
  if (floats && e.y > wy) e.y = Math.max(wy + 4, e.y - 20 * dt);          // 魚和孑孓會浮到水面
  else if (e.kind === 'mosquito' && e.y < wy) e.y = Math.min(wy, e.y + 120 * dt);  // 蚊子掉到水面或地面
  else if (!floats || e.y < wy) {
    const g = groundY(e.x, e.y - 4, 6);
    if (e.y < g) e.y = Math.min(g, e.y + 200 * dt);
  }
  if (e.deadT > 15) e.removed = true;
}
function updFood(f, dt) {
  f.t += dt;
  const wy = world.waterY, g = groundY(f.x, f.y - 2, 4) - 2;
  if (f.y < wy) { f.vy = Math.min(f.vy + 500 * dt, 300); if (f.y + f.vy * dt >= wy && wy < TANK.floor - 4) ripple(f.x, wy, .2); }
  else { f.vy = lerp(f.vy, 16, ease(dt, 6)); f.x += Math.sin(world.t * 2 + f.id) * 4 * dt; }
  f.y = Math.min(f.y + f.vy * dt, g);
  if (f.t > 90) f.removed = true;
}
function spawnMosquitoes(dt) {
  const [interval, max] = MOSQ_RATE[world.settings.mosqRate];
  if (!interval) return;
  world.spawnT -= dt;
  if (world.spawnT > 0) return;
  world.spawnT = interval * (isNight() ? .6 : 1.4);           // 蚊子傍晚和夜裡比較多
  if (world.ents.filter(e => e.kind === 'mosquito' && !e.dead).length < max) {
    makeEnt('mosquito', rand(TANK.left + 40, TANK.right - 40), TANK.top + 8);
    logEvent('🦟 一隻蚊子從缸外飛進來');
  }
}

// ---------------------------------------------------------------------
// 存檔 / 讀檔
// ---------------------------------------------------------------------
function serialize() {
  return {
    v: 1, tank: world.tank, level: world.level, tod: world.tod, water: { ...world.water }, settings: world.settings,
    decor: world.decor.map(({ type, x, y, w, h, rot, seed }) => ({ type, x, y, w, h, rot, seed })),
    ents: world.ents.filter(e => !e.dead).map(({ type, x, y, dir, hunger, hp, size, adult, stage, grow, count, meta, of, medium, t, hatch, sex, morph, preg, tailLen, regrown }) =>
      ({ type, x, y, dir, hunger, hp, size, adult, stage, grow, count, meta, of, medium, t, hatch, sex, morph, preg, tailLen, regrown })),
  };
}
function deserialize(data, keepLogs = false) {
  world.decor = []; world.ents = []; world.food = []; world.particles = [];
  if (!keepLogs) resetLogs();
  if (data.tod !== undefined) world.tod = data.tod;
  world.water = { dirt: 5, algae: 3, ...(data.water || {}) };
  applyTankDims(data.tank || 'standard');
  if (typeof onTankResize === 'function') onTankResize();
  world.level = data.level ?? .55;
  if (data.settings) Object.assign(world.settings, data.settings, { rules: { ...world.settings.rules, ...data.settings.rules } });
  updateWaterY();
  for (const d of data.decor || []) makeDecor(d.type, d.x, d.y, d);
  for (const s of data.ents || []) {
    if (!SPECIES[s.type]) continue;
    const e = makeEnt(s.type, s.x, s.y);
    Object.assign(e, { dir: s.dir || 1, hunger: s.hunger ?? 90, hp: s.hp ?? 100, size: s.size ?? e.size, adult: s.adult ?? s.size ?? e.adult });
    if (e.kind === 'larva') Object.assign(e, { stage: s.stage || 'larva', grow: s.grow || 0, count: s.count || 0 });
    if (e.kind === 'tadpole') e.meta = s.meta || 0;
    if (s.sex) Object.assign(e, { sex: s.sex, morph: s.morph ?? 0, preg: s.preg || 0 });
    if (e.kind === 'gecko' && s.tailLen !== undefined) Object.assign(e, { tailLen: s.tailLen, regrown: !!s.regrown });
    if (e.kind === 'nest') Object.assign(e, { of: s.of || 'frog', medium: s.medium || 'water', t: s.t || 0, hatch: s.hatch || 30, count: s.count || 1 });
    afterDrop(e);
  }
}
function resetLogs() { world.events = []; world.fx = []; world.hist = []; world.histT = 0; world.particles = []; }
function loadSampleScene() { loadPreset('foodweb'); }   // 舊名稱保留給測試用
