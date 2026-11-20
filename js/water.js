'use strict';
// =====================================================================
// water.js — 水質與藻類（A3）
//   髒污：魚和烏龜的排泄、腐爛的飼料、屍體 → 水草、浮萍、過濾器、換水清除
//   藻類：光照 × 養分（髒污）× 水草競爭 → 斑馬螺、紅尾黑鯊、蝌蚪吃掉；刷藻清掉玻璃上的
//   水太髒：魚生病掉血（孑孓不受影響，蚊子幼蟲本來就喜歡髒水）
// =====================================================================

function tankLiters() {
  const wCm = (TANK.right - TANK.left) / PX_PER_CM, hCm = Math.max(0, TANK.floor - world.waterY) / PX_PER_CM, dCm = (TANK.floor - TANK.top) / PX_PER_CM;
  return Math.max(5, wCm * hCm * dCm / 1000);
}
const dilution = () => 80 / tankLiters();                  // 大缸比較不容易髒
function tickWater(dt) {
  const w = world.water, Wp = WATER;
  if (!world.settings.waterSim || world.waterY >= TANK.floor - 6) { w.dirt = Math.max(0, w.dirt - dt * 5); return; }
  const wy = world.waterY;
  // 髒污來源
  let waste = 0;
  for (const e of world.ents) {
    if (e.dead) { if (e.y > wy - 4 && e.kind !== 'mosquito' && e.kind !== 'fly') waste += Wp.bodyRot; continue; }
    if (e.y < wy) continue;
    const cm = SPECIES[e.type].len * e.size / PX_PER_CM;
    if (e.kind === 'fish' || e.kind === 'whale') waste += cm * Wp.wastePerCm;
    else if (e.kind === 'turtle') waste += cm * Wp.wastePerCm * Wp.turtleMess;
    else if (e.kind === 'frog' || e.kind === 'tadpole') waste += cm * Wp.wastePerCm * .5;
  }
  for (const f of world.food) if (f.t > 20 && f.y > wy) waste += Wp.foodRot;
  // 清除
  let plants = 0, floaters = 0, filters = 0;
  for (const d of world.decor) {
    if (d.type === 'plant' && d.y > wy) plants++;
    else if (d.type === 'carpet' && d.y > wy) plants += .6;
    else if (d.type === 'floater') floaters++;
    else if (d.type === 'filter') filters++;
  }
  const clean = plants * Wp.plantClean + floaters * Wp.floaterClean + filters * Wp.filterClean;
  const before = w.dirt;
  w.dirt = clamp(w.dirt + (waste * dilution() - clean) * dt, 0, 100);
  // 藻類：光照（浮萍遮光）× 養分 × 水草競爭
  const shade = clamp(floaters * 140 / (TANK.right - TANK.left), 0, .8);
  const light = daylight() * (1 - shade);
  const nutrients = .25 + w.dirt / 100;
  const compete = 1 / (1 + plants * .12 + floaters * .2);
  const algaeBefore = w.algae;
  w.algae = clamp(w.algae + Wp.algaeGrow * light * nutrients * compete * dt * (1 - w.algae / 120), 0, 100);
  // 事件
  if (before < Wp.harmAt && w.dirt >= Wp.harmAt) logEvent('⚠️ 水質變差了，考慮換水或加過濾器');
  if (before < Wp.deadlyAt && w.dirt >= Wp.deadlyAt) logEvent('☠️ 水質很差，魚開始生病');
  if (algaeBefore < 50 && w.algae >= 50) logEvent('🟢 藻類變多了（可以刷藻，或放斑馬螺）');
  // 水太髒：魚和蝌蚪掉血
  for (const e of world.ents) {                               // 水太髒：魚、蝌蚪生病；蝦更敏感（門檻低 15）
    if (e.dead) continue;
    const sens = (e.kind === 'shrimp' || e.kind === 'axolotl' ? Wp.harmAt - 15 : Wp.harmAt) - (SPECIES[e.type].sensitive || 0);   // 蝦、六角恐龍對水質比較敏感（水晶蝦更敏感）
    const ok = e.kind === 'fish' || e.kind === 'tadpole' || e.kind === 'whale' || e.kind === 'shrimp' || e.kind === 'axolotl';
    if (!ok || e.y < wy || w.dirt <= sens) { e.sick = false; continue; }
    const harm = (w.dirt - sens) / (w.dirt > Wp.deadlyAt ? 12 : 30);
    if (world.settings.death) { e.hp -= harm * dt; if (e.hp <= 0) kill(e, '水質太差死亡'); }
    e.sick = true;
  }
}
// 生物吃藻：回傳實際吃到多少
function eatAlgae(amount) {
  const w = world.water, got = Math.min(w.algae, amount * dilution());
  w.algae -= got;
  return got;
}
function waterChange() {
  const before = world.water.dirt;
  world.water.dirt *= .65; world.water.algae *= .92;
  emit('waterChange', { before, after: world.water.dirt });
  logEvent('🪣 換了 30% 的水');
}
function scrubAlgae() {
  world.water.algae *= .5;
  logEvent('🧽 刷掉玻璃上的藻類');
}
function waterLevelText(v, kind) {
  if (kind === 'dirt') return v < 30 ? '乾淨' : v < WATER.harmAt ? '普通' : v < WATER.deadlyAt ? '髒' : '很髒';
  return v < 15 ? '很少' : v < 40 ? '一些' : v < 70 ? '很多' : '滿缸都是';
}
