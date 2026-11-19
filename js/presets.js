'use strict';
// =====================================================================
// presets.js — 預設魚缸配置
// 每種配置：魚缸尺寸、水位、蚊子頻率、造景、生物（以標準缸座標設計，其他尺寸依比例放大）
// =====================================================================

const PRESETS = [
  {
    id: 'planted', name: '水草魚缸', desc: '高水位、水草和沉木，看魚群游、求偶和生小魚',
    tank: 'standard', level: .88, mosq: 'off', icons: ['guppy', 'neon', 'nerite'],
    build(B) {
      B.decor('rock', 300, B.floor + 8, { w: 120, h: 70 });
      B.decor('rock', 380, B.floor + 8, { w: 80, h: 45 });
      B.decor('wood', 640, B.floor - 22, { rot: -.12, w: 300 });
      for (const [x, h] of [[120, 260], [180, 200], [470, 170], [820, 240], [880, 300], [950, 210], [1100, 280], [1170, 220]]) B.decor('plant', x, B.floor, { h });
      B.decor('bubbler', 1020, B.floor);
      B.decor('filter', 1215, B.waterY + 40);
      B.decor('floater', 260, B.waterY); B.decor('floater', 760, B.waterY);
      B.ent('nerite', 330, B.floor - 70); B.ent('nerite', 700, B.floor - 30);
      for (let i = 0; i < 6; i++) B.ent('cherry', B.rx(560, 860), B.floor - 40, { sex: i < 2 ? 'm' : 'f' });   // 櫻花蝦 2 公 4 母
      for (let i = 0; i < 6; i++) B.ent('guppy', B.rx(500, 900), B.ry(.3, .8), { sex: i % 2 ? 'f' : 'm' });
      for (let i = 0; i < 8; i++) B.ent('neon', B.rx(600, 900), B.ry(.3, .6));
    },
  },
  {
    id: 'bombina', name: '鈴蟾半水陸缸', desc: '大片陸地加淺水，看鈴蟾跳水、浮水、鈴蟾反射和產卵',
    tank: 'standard', level: .38, mosq: 'off', icons: ['frog', 'neon', 'cricket'],
    build(B) {
      B.decor('mound', 260, B.floor, { w: 620, h: 360 });
      B.decor('rock', 760, B.floor + 8, { w: 160, h: 120 });
      B.decor('wood', 640, B.waterY - 30, { rot: .18, w: 240 });
      for (const [x, h] of [[900, 150], [980, 190], [1130, 160]]) B.decor('plant', x, B.floor, { h });
      B.decor('filter', 1215, B.waterY + 40);
      for (const x of [140, 260, 380]) B.onLand('frog', x);
      for (let i = 0; i < 5; i++) B.ent('neon', B.rx(880, 1180), B.ry(.4, .8));
      B.live('cricket', 260);
    },
  },
  {
    id: 'native', name: '台灣原生缸', desc: '金線蛙和壁虎，看蚊子、孑孓到被吃掉的食物鏈',
    tank: 'standard', level: .45, mosq: 'low', icons: ['goldfrog', 'gecko', 'mosquito'],
    build(B) {
      B.decor('mound', 180, B.floor, { w: 400, h: 400 });
      B.decor('boulder', 1150, B.floor, { h: 380 });
      B.decor('rock', 700, B.floor + 8);
      for (const [x, h] of [[520, 160], [640, 210], [860, 180], [940, 150]]) B.decor('plant', x, B.floor, { h });
      B.onLand('goldfrog', 160); B.onLand('goldfrog', 1130);
      B.ent('gecko', 640, B.top + 90);
      for (let i = 0; i < 3; i++) B.ent('mosquito', B.rx(300, 1000), B.rangeY(B.top + 40, B.waterY - 40));
      for (let i = 0; i < 4; i++) { const l = B.ent('larva', B.rx(500, 1000), B.waterY + 8); l.grow = rand(0, 40); }
    },
  },
  {
    id: 'turtle', name: '烏龜缸', desc: '寬缸和曬背平台，看烏龜曬背、散步、游泳',
    tank: 'wide', level: .55, mosq: 'off', icons: ['turtle', 'redtail', 'wood'],
    build(B) {
      B.decor('boulder', 1120, B.floor, { w: 260, h: 330 });
      B.decor('wood', 330, B.waterY - 6, { rot: .2, w: 320 });
      B.decor('mound', 120, B.floor, { w: 300, h: 340 });
      B.decor('rock', 700, B.floor + 8, { w: 180, h: 90 });
      for (const [x, h] of [[560, 150], [880, 190]]) B.decor('plant', x, B.floor, { h });
      B.decor('filter', 1220, B.waterY + 50);
      B.ent('turtle', 600, B.ry(.4, .7)); B.ent('turtle', 820, B.ry(.4, .7));
      B.ent('redtail', 760, B.floor - 60);
    },
  },
  {
    id: 'foodweb', name: '食物鏈觀察缸', desc: '每個環節各放一點，看完整的生態互動',
    tank: 'standard', level: .55, mosq: 'low', icons: ['frog', 'guppy', 'larva'],
    build(B) {
      B.decor('mound', 200, B.floor, { h: 400 });
      B.decor('boulder', 1140, B.floor, { h: 400 });
      B.decor('rock', 660, B.floor + 8);
      B.decor('wood', 345, B.waterY + 8, { rot: .24 });
      for (const [x, h] of [[560, 170], [740, 220], [960, 150], [1010, 200]]) B.decor('plant', x, B.floor, { h });
      B.decor('bubbler', 880, B.floor);
      B.decor('filter', 1000, B.waterY + 40); B.decor('floater', 840, B.waterY);
      B.ent('nerite', 660, B.floor - 70);
      for (let i = 0; i < 4; i++) B.ent('guppy', B.rx(500, 1000), B.ry(.3, .8), { sex: i % 2 ? 'f' : 'm' });
      for (let i = 0; i < 5; i++) B.ent('neon', B.rx(600, 900), B.ry(.3, .6));
      B.ent('turtle', 760, B.ry(.4, .7));
      B.onLand('frog', 130); B.onLand('frog', 260);
      B.ent('gecko', 640, B.top + 110);
      for (let i = 0; i < 3; i++) B.ent('mosquito', B.rx(300, 1000), B.rangeY(B.top + 40, B.waterY - 40));
      for (let i = 0; i < 4; i++) { const l = B.ent('larva', B.rx(700, 1030), B.waterY + 8); l.grow = rand(0, 40); }
    },
  },
  {
    id: 'fantasy', name: '夢幻展示缸', desc: '展示缸裡的迷你藍鯨和一大群紅蓮燈',
    tank: 'show', level: .82, mosq: 'off', icons: ['whale', 'neon', 'plant'],
    build(B) {
      for (const [x, h] of [[80, 300], [150, 240], [420, 200], [980, 280], [1060, 220], [1200, 260]]) B.decor('plant', x, B.floor, { h });
      B.decor('rock', 300, B.floor + 8, { w: 200, h: 110 }); B.decor('rock', 1130, B.floor + 8, { w: 160, h: 90 });
      B.decor('bubbler', 640, B.floor); B.decor('bubbler', 860, B.floor);
      B.decor('filter', 1215, B.waterY + 40); B.decor('filter', 60, B.waterY + 40);
      B.ent('whale', 640, B.ry(.35, .55));
      for (let i = 0; i < 16; i++) B.ent('neon', B.rx(450, 850), B.ry(.6, .85));
    },
  },
  {
    id: 'empty', name: '空缸', desc: '只有底沙，從零開始自由佈置',
    tank: 'standard', level: .6, mosq: 'off', icons: [],
    build() {},
  },
];

// 建立配置用的小工具（座標以標準缸 1280×720 設計，自動換算到目前的魚缸）
function presetBuilder() {
  const sx = (TANK.right - TANK.left) / 1248, sy = (TANK.floor - TANK.top) / 628;
  const X = x => TANK.left + (x - 16) * sx, Ysc = h => h * sy;
  const wy = world.waterY;
  const B = {
    floor: 668, top: 40, waterY: TANK.floor === 668 ? wy : 668 - (TANK.floor - wy) / sy,
    rx: (a, b) => rand(a, b),
    ry: (f0, f1) => 668 - (668 - B.waterY) * (1 - rand(f0, f1)),      // 水中的相對深度（0 = 水面、1 = 缸底）
    rangeY: (a, b) => rand(a, Math.max(a + 1, b)),
    decor(type, x, y, extra = {}) {
      const d = makeDecor(type, X(x), TANK.floor - (668 - y) * sy, { ...extra });
      const big = type === 'mound' || type === 'boulder' || type === 'plant';   // 大型造景跟著魚缸高度放大
      d.w = (extra.w ?? DECOR_TYPES[type].w) * (big || type === 'wood' ? Math.min(sx, 1.6) : 1);
      d.h = big ? Ysc(extra.h ?? DECOR_TYPES[type].h) : (extra.h ?? DECOR_TYPES[type].h);
      if (type !== 'wood') settle(d);
      return d;
    },
    ent(type, x, y, opt = {}) {
      const e = makeEnt(type, X(x), TANK.floor - (668 - y) * sy);
      if (opt.sex && SPECIES[type].sexed) setSex(e, opt.sex);
      return e;
    },
    onLand(type, x) { const e = makeEnt(type, X(x), TANK.top + 60); e.y = highestTop(X(x)) - 1; return e; },
    live(type, x) { dropLive(type, X(x)); },
  };
  return B;
}
function loadPreset(id) {
  const p = PRESETS.find(q => q.id === id) || PRESETS[0];
  world.decor = []; world.ents = []; world.food = []; resetLogs();
  world.water = { dirt: 5, algae: 3 };
  applyTankDims(p.tank);
  if (typeof onTankResize === 'function') onTankResize();
  world.level = p.level; updateWaterY();
  world.settings.mosqRate = p.mosq; world.spawnT = 3;
  p.build(presetBuilder());
  world.events = [];
  logEvent(`🐠 建立了「${p.name}」`);
  emit('preset', { id: p.id });
  return p;
}

// 飼養密度：水中生物的總身長（cm）÷ 水量（公升）；寬鬆／適中／擁擠
function stockingDensity() {
  const wCm = (TANK.right - TANK.left) / PX_PER_CM, hCm = (TANK.floor - world.waterY) / PX_PER_CM, dCm = (TANK.floor - TANK.top) / PX_PER_CM;
  const liters = Math.max(1, wCm * hCm * dCm / 1000);
  let cm = 0;
  for (const e of world.ents) {
    if (e.dead) continue;
    const len = SPECIES[e.type].len * e.size / PX_PER_CM;
    if (e.kind === 'fish' || e.kind === 'turtle' || e.kind === 'whale') cm += len;
    else if (e.kind === 'frog' || e.kind === 'tadpole') cm += len * .5;
  }
  const r = cm / liters;
  return { r, liters, cm, level: r < .8 ? '寬鬆' : r < 1.5 ? '適中' : '擁擠' };
}
// 混養提醒：新放進來的生物會不會吃別人、或被別人吃（不含昆蟲、孑孓這類本來就是食物的）
function compatibilityWarnings(e) {
  const out = new Set(), victimKinds = ['fish', 'tadpole', 'frog', 'gecko', 'turtle', 'whale'];
  for (const o of world.ents) {
    if (o === e || o.dead) continue;
    if (victimKinds.includes(e.kind) && canEat(o, e)) out.add(`${SPECIES[o.type].name}會吃${SPECIES[e.type].name}`);
    if (victimKinds.includes(o.kind) && canEat(e, o)) out.add(`${SPECIES[e.type].name}會吃${SPECIES[o.type].name}`);
  }
  return [...out];
}
