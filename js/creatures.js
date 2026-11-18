'use strict';
// =====================================================================
// creatures.js — 各物種的行為（狀態機）與骨架計算
// 只輸出資料（座標、角度、狀態），不呼叫繪圖指令
// =====================================================================

const UPDATE = { fish: updFish, turtle: updTurtle, frog: updFrog, gecko: updGecko, mosquito: updMosquito, larva: updLarva,
                 tadpole: updTadpole, whale: updWhale, nest: updNest, cricket: updCricket, fly: updFly };

// 轉身：轉完後有 0.8 秒冷卻，避免目標在身邊晃動時原地連續翻轉
function startTurn(e) { if (!e.turning && !(e.turnCD > 0)) { e.turning = true; e.turnT = 0; } }
function tickTurn(e, dt, dur) {
  if (!e.turning) { if (e.turnCD > 0) e.turnCD -= dt; return false; }
  e.turnT += dt / dur;
  if (e.turnT >= 1) { e.turning = false; e.turnT = 0; e.dir *= -1; e.turnCD = 1; }
  return true;
}
const facing = e => e.dir * Math.cos(Math.PI * e.turnT);     // 轉身時 1 → 0 → -1（壓扁再翻面）

// =====================================================================
// 魚
// =====================================================================
function fishHead(e) { const sp = SPECIES[e.type]; return P(e.x + e.dir * sp.len * .5 * e.size, e.y); }
function fishAnim(e, dt, freq, amp) {
  e.freq = lerp(e.freq, freq, ease(dt, 5)); e.amp = lerp(e.amp, amp, ease(dt, 5));
  e.phase += Math.PI * 2 * e.freq * dt;
  e.pec += dt * (e.mode === 'hover' ? 14 : 7);
}
function schoolInfo(e) {
  let sx = 0, sy = 0, sd = 0, n = 0;
  for (const o of world.ents) if (o !== e && o.type === e.type && !o.dead && dist(o, e) < 300) { sx += o.x; sy += o.y; sd += o.dir; n++; }
  if (!n) return null;
  return { c: P(sx / n, sy / n), dir: sd === 0 ? e.dir : Math.sign(sd), n };
}
function schoolCenter(e) {
  let sx = 0, sy = 0, n = 0;
  for (const o of world.ents) if (o !== e && o.type === e.type && !o.dead && dist(o, e) < 300) { sx += o.x; sy += o.y; n++; }
  return n ? P(sx / n, sy / n) : null;
}
function fishWander(e) {
  const sp = SPECIES[e.type], wy = world.waterY;
  let tx, ty, tries = 0;
  do {
    tx = Math.random() < .65 ? e.x + e.dir * rand(120, 420) : rand(TANK.left + 40, TANK.right - 40);   // 比較常順著原本的方向游
    tx = clamp(tx, TANK.left + 40, TANK.right - 40);
    ty = rand(wy + 20, TANK.floor - 20);
    if (sp.bottom) ty = rand(Math.max(wy + 30, TANK.floor - 150), TANK.floor - 25);
    if (isNight() && !sp.territorial) ty = rand(Math.max(wy + 30, TANK.floor - 110), TANK.floor - 15);   // 夜裡到底層睡覺
    if (sp.territorial && e.home) tx = clamp(Math.random() < .65 ? e.x + e.dir * rand(150, 320) : e.home.x + rand(-320, 320), Math.max(TANK.left + 40, e.home.x - 340), Math.min(TANK.right - 40, e.home.x + 340));
    if (e.size < e.adult * .6 && Math.random() < .6) {        // 魚苗喜歡躲在水草附近
      const plants = world.decor.filter(d => d.type === 'plant');
      if (plants.length) { const p = pick(plants); tx = p.x + rand(-25, 25); ty = rand(Math.max(wy + 20, p.y - p.h), p.y - 10); }
    }
    if (sp.school) {                                          // 群游：往魚群中心、順著同伴的平均方向游
      const s = schoolInfo(e);
      if (s) { tx = s.c.x + s.dir * rand(80, 220); ty = s.c.y + rand(-25, 25); }
    }
  } while (solidAt(tx, ty) && ++tries < 10);
  e.tx = tx; e.ty = ty; e.think = sp.school ? rand(1.5, 3) : rand(3, 7);
  e.mode = Math.random() < (isNight() ? .75 : .2) ? 'hover' : 'cruise';
}
function updFish(e, dt) {
  const sp = SPECIES[e.type], wy = world.waterY, L = sp.len * e.size;
  const inWater = e.y > wy + 2 && wy < TANK.floor - 12;
  if (!inWater) {                                             // 離水：掉落或掙扎
    const g = groundY(e.x, e.y - 6, 6) - 5;
    if (e.y < g - 1) { e.vy = Math.min(e.vy + 700 * dt, 500); e.y = Math.min(e.y + e.vy * dt, g); e.state = '掉落'; }
    else {
      e.y = g; e.vy = 0; e.state = '離水掙扎';
      if (world.settings.death) { e.hp -= dt * 12; if (e.hp <= 0) kill(e, '缺水死亡'); }
    }
    fishAnim(e, dt, 5, 1);
    e.wasOut = true;
    return;
  }
  if (e.wasOut) { e.wasOut = false; if (e.vy > 60) splash(e.x, wy, .4 * e.size * sp.len / 64); }
  if (e.vy > 0) { e.vy = lerp(e.vy, 0, ease(dt, 4)); e.y += e.vy * dt; }   // 掉進水裡的減速

  e.think -= dt;
  const minY = wy + 8 + 6 * e.size, maxY = Math.max(minY, TANK.floor - 8);
  let threat = null, threatName = '';
  for (const o of world.ents)                                  // 會吃自己的掠食者靠近就逃
    if ((o.kind === 'turtle' && o.mode === 'swim' || o.kind === 'fish') && !o.dead && o !== e && dist(o, e) < 90 && canEat(o, e)) { threat = o; threatName = entName(o); }
  if (!threat && e.scaredT > 0) { e.scaredT -= dt; threat = e.scaredBy; threatName = '紅尾黑鯊'; }   // 被紅尾黑鯊驅趕
  e.fleeReal = !!threat;
  if (!threat && sp.school) {                                  // 魚群連鎖反應：旁邊的同伴真的在逃，自己也跟著逃
    if (e.alarmCD > 0) e.alarmCD -= dt;
    if (e.alarmT > 0) { e.alarmT -= dt; threat = e.alarmFrom; threatName = '（跟著魚群逃）'; }
    else if (!(e.alarmCD > 0)) {                               // 驚慌 0.8 秒，之後 4 秒內不會再被同伴嚇到
      const mate = world.ents.find(o => o !== e && o.type === e.type && o.fleeReal && !o.dead && dist(o, e) < 130);
      if (mate) { e.alarmT = .8; e.alarmCD = 4; e.alarmFrom = P(e.x - (mate.tx - mate.x) * .5, e.y - (mate.ty - mate.y) * .5); threat = e.alarmFrom; threatName = '（跟著魚群逃）'; }
    }
  }
  if (sp.territorial) territorialTick(e, dt);
  const head = fishHead(e);
  const prey = e.hunger < sp.huntBelow && !e.chasing ? findPrey(e, sp.sight, t => {
    if (t.kind === 'food') return t.y > wy;
    if (t.kind === 'mosquito') return t.y > wy - 24 && t.y < wy + 4;           // 停在水面的蚊子
    return !inPlant(t) || dist(head, t) < sp.sight * .3;                       // 躲在水草裡的孑孓、蝌蚪、魚苗比較難發現
  }, head) : null;
  let tgt;
  if (e.chasing) { e.tx = e.chasing.x; e.ty = e.chasing.y; e.mode = 'chase'; tgt = sp.dash; e.state = '驅趕入侵者'; }
  else if (threat) { e.tx = e.x + (e.x - threat.x) * 2; e.ty = e.y + (e.y - threat.y); e.mode = 'flee'; tgt = sp.dash; e.state = '逃離' + threatName; }
  else if (prey) { e.tx = prey.x; e.ty = prey.y; e.mode = 'chase'; tgt = sp.dash * .8; e.state = '追' + entName(prey); }
  else if (e.court) {                                          // 孔雀魚公魚求偶：游到母魚面前擺出 S 形姿勢
    const f = e.court.f;
    if (f.dead || f.removed) e.court = null;
    else {
      e.tx = f.x + f.dir * L * .8; e.ty = f.y - 4; e.mode = 'court';
      const near = dist(e, P(e.tx, e.ty)) < L * .7;
      tgt = near ? sp.speed * .15 : sp.dash * .6;
      e.court.t -= dt;
      e.state = near ? '求偶展示（S 形姿勢）' : '追求母魚';
      if (e.court.t <= 0) { e.court = null; e.mode = 'cruise'; fishWander(e); }
    }
  }
  else if (e.graze) {                                          // 啃食石頭、沉木、沙地上的藻類（嘴朝下）
    const g = e.graze, hd = fishHead(e);
    if (!g.side) g.side = Math.sign(e.x - g.x) || 1;           // 從哪一側靠近：開始時決定一次，不跟著朝向變
    e.tx = g.x + g.side * L * .42; e.ty = g.y - 3; e.mode = 'graze';
    if (Math.abs(e.x - e.tx) < L * .2 && e.dir !== -g.side) startTurn(e);   // 到定位後轉向藻類
    const near = Math.abs(hd.x - g.x) < 12 && Math.abs(hd.y - g.y) < 14;
    tgt = near ? 0 : sp.speed * .8;
    if (near) {
      g.t -= dt; e.state = '啃食藻類';
      if (g.t <= 0) { e.graze = null; e.mode = 'cruise'; e.hunger = Math.min(100, e.hunger + 4); addFx(g.x, g.y - 6, '+4', '#7fd067'); fishWander(e); }
    } else { e.state = '游向藻類'; if ((g.timeout -= dt) <= 0) e.graze = null; }
  }
  else {
    if (sp.grazer && !isNight() && Math.random() < dt / 5) { const g = findGrazeSpot(e); if (g) { e.graze = { ...g, t: rand(4, 8), timeout: 12 }; } }
    if (sp.sexed && e.sex === 'm' && isAdult(e) && !isNight() && Math.random() < dt / 7) {
      let best = null, bd = 320;
      for (const o of world.ents) if (o.type === e.type && o.sex === 'f' && !o.dead && isAdult(o) && dist(o, e) < bd) { bd = dist(o, e); best = o; }
      if (best) e.court = { f: best, t: rand(4, 7) };
    }
    if (e.think <= 0 || e.mode === 'chase' || e.mode === 'flee' || e.mode === 'graze' || (Math.abs(e.tx - e.x) < 15 && Math.abs(e.ty - e.y) < 15)) fishWander(e);
    tgt = e.mode === 'hover' ? 0 : sp.speed * (isNight() ? .5 : 1);
    e.state = e.mode === 'hover' ? (isNight() ? '睡覺' : '懸停') : '巡游';
  }
  const dx = e.tx - e.x;
  const turnAt = Math.max(18, L * (e.chasing ? .5 : e.mode === 'graze' ? .45 : .3));   // 目標偏離夠多才轉身（追趕、啃藻時更不容易轉）
  if (tgt > 0 && Math.abs(dx) > turnAt && Math.sign(dx) !== e.dir && !e.turning && !(e.turnCD > 0)) {   // 懸停、睡覺時不轉身
    if (e.chasing && e.chaseTurns >= 1) { e.chasing = null; e.rest = rand(3, 5); }   // 追趕中最多折返一次，之後就放棄回去休息
    else { if (e.chasing) e.chaseTurns++; startTurn(e); }
  }
  if (tickTurn(e, dt, .4)) tgt *= .25;
  e.vx = lerp(e.vx, tgt, ease(dt, tgt > e.vx ? 4 : 2));
  let nx = e.x + e.dir * e.vx * dt;
  const fast = e.mode === 'chase' || e.mode === 'flee';
  let ny = e.y + clamp((e.ty - e.y) * 1.5, -sp.speed, sp.speed) * (fast ? 2 : 1) * dt;
  ny = clamp(ny, minY, maxY);
  nx = clamp(nx, TANK.left + L * .5, TANK.right - L * .5);
  const hx = nx + e.dir * L * .5;
  if (solidAt(hx, ny)) {
    if (!solidAt(hx, ny - 20)) ny -= 40 * dt;
    else { nx = e.x; startTurn(e); fishWander(e); }
  }
  if (solidAt(nx, ny)) ny -= 60 * dt;
  e.x = nx; e.y = ny;
  if (prey && dist(fishHead(e), prey) < 10 + 6 * e.size) {
    if (prey.kind === 'larva' && prey.dive > 0 && Math.random() < SPECIES.larva.escape) {
      prey.dive = Math.max(prey.dive, .8); e.think = 0; e.mode = 'cruise'; fishWander(e);   // 撲空
      addFx(prey.x, prey.y, '躲開', '#cfe7ff');
    } else eat(e, prey);
  }
  if (e.chasing || threat || prey) { e.graze = null; e.court = null; }
  e.sigV = lerp(e.sigV || 0, e.state === '求偶展示（S 形姿勢）' ? 1 : 0, ease(dt, 5));
  const grazing = e.graze && e.state === '啃食藻類';
  e.pitch = lerp(e.pitch || 0, grazing ? .42 + Math.sin(world.t * 9) * .05 : 0, ease(dt, 4));   // 低頭啃，輕輕點頭
  const f = e.vx / sp.speed;
  fishAnim(e, dt, Math.min(7, 1.4 + f * 1.6), clamp(.15 + f * .45, .1, 1));
}
// 找可以啃藻類的地方：地盤內、水面下的石頭／沉木／土坡表面，或沙地
function findGrazeSpot(e) {
  const wy = world.waterY, home = e.home || e, out = [];
  for (const d of world.decor) {
    if (!DECOR_TYPES[d.type].solid) continue;
    const w = d.type === 'wood' ? d.w : d.w * .8;
    for (let x = d.x - w / 2; x <= d.x + w / 2; x += 18) {
      const s = decorSpan(d, x);
      if (s && s.top > wy + 30 && Math.abs(x - home.x) < 280 && !solidAt(x, s.top - 10)) out.push(P(x, s.top - 6));
    }
  }
  out.push(P(clamp(home.x + rand(-160, 160), TANK.left + 40, TANK.right - 40), TANK.floor - 8));
  return pick(out);
}

// 紅尾黑鯊：守一塊地盤，把游進來的其他魚趕走（不吃牠們）
function territorialTick(e, dt) {
  if (!e.home) e.home = P(e.x, TANK.floor - 60);
  e.chaseT = Math.max(0, (e.chaseT || 0) - dt * .4);
  if (!world.settings.sharkChase) { e.chasing = null; return; }
  if (e.chasing && (e.chasing.dead || e.chasing.removed || dist(e.chasing, e.home) > 280 || e.chaseT > 3)) { e.chasing = null; e.rest = 4; }
  if (e.rest > 0) { e.rest -= dt; return; }
  if (!e.chasing) {
    let best = null, bd = 170;
    for (const o of world.ents) if (o.kind === 'fish' && o.type !== e.type && !o.dead && dist(o, e.home) < bd) { bd = dist(o, e.home); best = o; }
    e.chasing = best;
    if (best) { best.scaredBy = e; best.scaredT = 1.2; e.chaseTurns = 0; }   // 被盯上的魚立刻逃
  }
  if (e.chasing) {
    e.chaseT += dt * 1.4;
    if (dist(fishHead(e), e.chasing) < 60) {                 // 頂到了：對方逃走，自己回去休息（不會一直黏著追）
      e.chasing.scaredBy = e; e.chasing.scaredT = 1.8; e.chasing = null; e.rest = rand(3, 5);
    }
  }
}

const FISH_N = 9;
function fishRig(e) {
  const sp = SPECIES[e.type], hs = sp.look.hScale, nodes = [];
  for (let i = 0; i < FISH_N; i++) {
    const s = i / (FISH_N - 1);
    const h = (2.5 + 13.5 * Math.pow(Math.max(0, Math.sin(Math.PI * Math.min(1, s * 1.05 + .1))), .75) * (1 - .6 * s)) * hs;
    nodes.push({ x: 34 - s * 64, y: Math.sin(e.phase - s * 2.2) * e.amp * 4 * s * s + (e.sigV || 0) * 4.5 * Math.sin(s * Math.PI * 2) + (e.sigV || 0) * Math.sin(world.t * 30) * .4 * s, h });
  }
  return {
    nodes,
    tailSx: lerp(1, .32, e.amp * Math.abs(Math.sin(e.phase))),   // 側面看：尾鰭寬度伸縮
    tailRot: .22 * e.amp * Math.cos(e.phase),
    pecRot: .35 + .5 * Math.sin(e.pec),
    sx: facing(e),
  };
}

// =====================================================================
// 烏龜
// =====================================================================
function turtleHead(e) { return P(e.x + e.dir * 50 * e.size, e.y - 16 * e.size); }

// 烏龜骨架（側面，局部座標：原點 = 殼下方地面，頭在 +x）
//   走路：對角線兩隻腳一起動（近側前腳＋遠側後腳），腳掌踩實地面
//   游泳：用有蹼的腳划水（麝香龜不是鰭狀肢）
//   曬背：脖子伸長、頭抬高、後腳往後伸直
//   縮殼：被拿起來或掉落時，頭和腳收進殼裡
const TT_STRIDE = 12, TT_STANCE = .7, TT_CYCLE = TT_STRIDE / TT_STANCE;
function turtleRig(e) {
  const wy = world.waterY, s = e.size;
  const swim = e.mode === 'swim' || (e.mode === 'fall' && e.y > wy);
  const tuckNow = !!e.held || (e.mode === 'fall' && !swim);
  e.tuckV = lerp(e.tuckV || 0, tuckNow ? 1 : 0, .12);          // 純視覺的平滑
  const k = e.tuckV, bask = e.mode === 'bask' && k < .5;
  const d = (e.dist || 0) / s, lim = e.limb || 0;
  const moving = e.mode === 'walk' && k < .5;
  const bob = moving ? Math.abs(Math.sin(d / TT_CYCLE * Math.PI * 2)) * .7 : 0;
  const pitch = swim ? clamp(((e.ty ?? e.y) - e.y) * .003, -.22, .22) : 0;
  const legs = [];
  for (const L of [{ front: true, near: true, ph: 0 }, { front: false, near: false, ph: 0 }, { front: true, near: false, ph: .5 }, { front: false, near: true, ph: .5 }]) {
    const hip = P(L.front ? 22 : -21, -13.5 - bob - (L.near ? 0 : 1.5));
    const a = 8, b = L.front ? 8 : 8.5;
    if (swim && k < .5) {
      const ph = lim + (L.near ? 0 : Math.PI) + (L.front ? 0 : Math.PI * .5);
      const ang = L.front ? .9 + Math.sin(ph) * 1.0 : Math.PI - .75 + Math.sin(ph) * .55;
      const knee = P(hip.x + Math.cos(ang) * a, hip.y + Math.sin(ang) * a);
      const ang2 = ang + (L.front ? .5 : -.45);
      legs.push({ ...L, hip, knee, foot: P(knee.x + Math.cos(ang2) * b, knee.y + Math.sin(ang2) * b), footAng: ang2, spread: Math.cos(ph) > 0 });
      continue;
    }
    let target, lift = 0;
    if (bask && !L.front) target = P(hip.x - 15, -1.5);
    else if (bask) target = P(hip.x + 4, 0);
    else {
      const frac = (((d / TT_CYCLE + L.ph) % 1) + 1) % 1;
      let rel = 0;
      if (moving) {
        if (frac < TT_STANCE) rel = TT_STRIDE * (.5 - frac / TT_STANCE);
        else { const t = (frac - TT_STANCE) / (1 - TT_STANCE); rel = TT_STRIDE * (-.5 + t); lift = Math.sin(Math.PI * t) * 4; }
      }
      target = P(hip.x + (L.front ? 3 : -2) + rel, -lift - (L.near ? 0 : 1.5));
    }
    target = P(lerp(target.x, hip.x + (L.front ? -3 : 3), k), lerp(target.y, -9, k));
    const r = ik2(hip, target, a, b, (p1, p2) => (L.front ? (p1.x < p2.x ? p1 : p2) : (p1.x > p2.x ? p1 : p2)));   // 前腳手肘朝後、後腳膝蓋朝前
    legs.push({ ...L, hip, knee: r.knee, foot: r.foot, footAng: bask && !L.front ? Math.PI : L.front ? .1 : Math.PI - .1, lift });
  }
  const ext = lerp(bask ? 1 : swim ? .75 : .55, 0, k);
  const up = swim && (e.ty ?? e.y) < e.y - 10;
  const headPitch = bask ? -.38 : up ? -.22 : Math.sin(world.t * .7 + e.id) * .05;
  return { swim, bask, tuck: k, legs, bob, pitch, ext, headPitch, sx: facing(e), juvenile: e.size < e.adult * .6 };
}

function updTurtle(e, dt) {
  const sp = SPECIES.turtle, wy = world.waterY, L = sp.len * e.size;
  e.modeT += dt; e.think -= dt;
  const deep = wy < TANK.floor - 16;
  if (e.mode === 'fall') {
    e.state = '掉落';
    e.vy = Math.min(e.vy + 600 * dt, 500);
    const prevY = e.y; e.y += e.vy * dt;
    if (e.y > wy + 4 && deep) { if (e.vy > 80) splash(e.x, wy, .5 * e.size); e.mode = 'swim'; e.vy *= .3; return; }
    const g = groundY(e.x, prevY - 2, 4);
    if (e.y >= g) { if (e.vy > 120) dust(e.x, g, .5 * e.size); e.y = g; e.vy = 0; e.mode = 'walk'; e.modeT = 0; }
    return;
  }
  if (e.mode === 'swim') {
    if (e.y <= wy + 2 || !deep) { e.mode = 'fall'; e.vy = 0; return; }
    const prey = e.hunger < sp.huntBelow ? findPrey(e, sp.sight, t => t.kind !== 'food' || t.y > wy, turtleHead(e)) : null;
    if (prey) { e.tx = prey.x; e.ty = prey.y; e.state = prey.kind === 'food' ? '吃飼料' : '獵捕小魚'; }
    else if (e.wantBask) {
      if (!e.baskSpot) { const spots = landSpots(45); e.baskSpot = spots.length ? spots.reduce((a, b) => Math.abs(a.x - e.x) < Math.abs(b.x - e.x) ? a : b) : null; }
      if (!e.baskSpot) e.wantBask = false;
      else {
        const s = e.baskSpot; e.tx = s.x; e.ty = wy + 14; e.state = '找地方上岸';
        if (Math.abs(e.x - s.x) < L * .5 && e.y < wy + 60) {
          e.x = s.x; e.y = s.y; e.mode = 'walk'; e.modeT = 0; e.wantBask = false; e.baskSpot = null; e.baskNext = true; return;
        }
      }
    } else {
      if (e.think <= 0 || Math.hypot(e.tx - e.x, e.ty - e.y) < 20 || e.tx === undefined) {
        e.tx = rand(TANK.left + 60, TANK.right - 60); e.ty = rand(wy + 30, TANK.floor - 30); e.think = rand(3, 7);
        if (isNight()) { e.ty = TANK.floor - 12; e.think = rand(8, 15); }   // 夜裡在水底休息
      }
      e.state = isNight() ? '在水底休息' : '游泳';
      if (daylight() > .6 && Math.random() < dt / 25) e.wantBask = true;   // 只在白天曬背
    }
    if (Math.abs(e.tx - e.x) > 25 && Math.sign(e.tx - e.x) !== e.dir) startTurn(e);
    let spd = prey ? sp.speed * 1.6 : sp.speed;
    if (tickTurn(e, dt, .6)) spd *= .3;
    e.vx = lerp(e.vx, spd, ease(dt, 2));
    let nx = clamp(e.x + e.dir * e.vx * dt, TANK.left + L * .5, TANK.right - L * .5);
    let ny = clamp(e.y + clamp((e.ty - e.y) * 1.2, -30, 30) * dt, wy + 18 * e.size, TANK.floor - 12);
    const hx = nx + e.dir * L * .5;
    if (solidAt(hx, ny - 10)) {
      const r = groundY(hx, ny - 70, 0);
      if (r < ny && r < wy + 4) { e.x = hx; e.y = r; e.mode = 'walk'; e.modeT = 0; return; }   // 爬上岸
      if (!solidAt(hx, ny - 35)) ny -= 30 * dt;
      else { nx = e.x; e.tx = e.x - e.dir * 200; }
    }
    e.x = nx; e.y = ny;
    if (prey && dist(turtleHead(e), prey) < 14 * e.size) eat(e, prey);
    e.limb += dt * (2 + e.vx / 10);
    return;
  }
  // 陸地：散步 / 曬背
  const g = groundY(e.x, e.y - 8, 10);
  if (g > e.y + 3) { e.mode = 'fall'; e.vy = 0; return; }
  e.y = g;
  if (e.y > wy + 4 && deep) { e.mode = 'swim'; e.wantWater = false; e.modeT = 0; return; }
  if (e.mode === 'bask') {
    e.state = '曬背';
    if (e.modeT > e.baskDur || isNight()) { e.mode = 'walk'; e.modeT = 0; e.wantWater = true; }
    return;
  }
  e.mode = 'walk';
  e.state = e.wantWater ? '走回水裡' : '散步';
  if (e.baskNext && e.modeT > .8) { e.mode = 'bask'; e.modeT = 0; e.baskDur = rand(8, 16); e.baskNext = false; return; }
  if (e.modeT > 10) e.wantWater = true;
  if (e.wantWater && e.think <= 0) {                           // 朝比較近的水邊走
    e.think = 3;
    let best = null;
    for (let x = TANK.left + 30; x < TANK.right - 30; x += 20) if (highestTop(x) > wy + 6 && (!best || Math.abs(x - e.x) < Math.abs(best - e.x))) best = x;
    if (best !== null) e.dir = Math.sign(best - e.x) || e.dir;
  }
  const nx = e.x + e.dir * sp.walk * dt, front = nx + e.dir * L * .45;
  if (front < TANK.left + 5 || front > TANK.right - 5 || solidAt(front, e.y - 10)) e.dir *= -1;
  else {
    const ng = groundY(nx, e.y - 4, 12);
    e.x = nx; e.dist += sp.walk * dt;
    if (ng - e.y > 20) { e.mode = 'fall'; e.vy = 0; } else e.y = ng;
  }
  e.limb += dt * 3;
}

// =====================================================================
// 青蛙
// =====================================================================
const FROG_G = 900;
function frogMouth(e) { return P(e.x + e.dir * 22 * e.size, e.y + (e.mode === 'float' ? -1 : -8) * e.size); }
// 青蛙骨架（東方鈴蟾，側面，原點 = 腳下地面）
//   後腳四段：大腿、小腿（脛腓骨）、拉長的跗骨、腳掌（有蹼）；前腳三段（無蹼）
//   姿勢以關鍵影格混合：坐、跳、浮水（划水）、鈴蟾反射
const FROG_HIND = {
  sit:   [P(-11, -7), P(4, -5.5), P(-9, -2), P(-2, -.4), P(6, 0)],
  jump:  [P(-11, -7), P(-21, -6.5), P(-31, -5), P(-38, -3.8), P(-47, -2.5)],
  fext:  [P(-11, -7), P(-20, -5), P(-28, -6), P(-34, -5.5), P(-42, -5)],
  ffold: [P(-11, -7), P(-3, -3), P(-12, -1), P(-8, 1), P(-2, 1.5)],
  unken: [P(-11, -7), P(-5, -14), P(-13, -17), P(-10, -20.5), P(-5, -23)],
};
const FROG_FRONT = {
  sit:   [P(10, -6), P(8, -2.5), P(12, 0), P(15.5, 0)],
  jump:  [P(10, -6), P(16, -5), P(22, -4.5), P(26, -4)],
  float: [P(10, -6), P(15, -3.5), P(19, -5), P(22, -5)],
  unken: [P(10, -6), P(13, -11), P(16, -14.5), P(18, -17)],
};
const lerpPts = (a, b, t) => a.map((p, i) => P(lerp(p.x, b[i].x, t), lerp(p.y, b[i].y, t)));
function frogRig(e) {
  let jump = 0;
  if (e.mode === 'jump') jump = e.vy < 0 ? 1 : clamp(1 - e.vy / 500, .25, 1);
  const flt = e.mode === 'float' ? 1 : 0;
  e.unkenV = lerp(e.unkenV || 0, ((e.held && SPECIES[e.type].unken) || e.unkenT > 0) && e.mode !== 'jump' ? 1 : 0, .15);   // 純視覺的平滑；只有鈴蟾會鈴蟾反射
  const u = e.unkenV;
  const kick = flt ? Math.pow(Math.sin(world.t * 3 + e.id) * .5 + .5, 2) : 0;   // 浮水時偶爾蹬一下
  let hind = lerpPts(FROG_HIND.sit, FROG_HIND.jump, jump);
  hind = lerpPts(hind, lerpPts(FROG_HIND.ffold, FROG_HIND.fext, kick), flt);
  hind = lerpPts(hind, FROG_HIND.unken, u);
  let front = lerpPts(FROG_FRONT.sit, FROG_FRONT.jump, jump);
  front = lerpPts(front, FROG_FRONT.float, flt);
  front = lerpPts(front, FROG_FRONT.unken, u);
  const warp = p => P(p.x, p.y - u * Math.pow(p.x / 18, 2) * 5);               // 鈴蟾反射：背部下凹、頭尾翹起
  const shift = (pts) => { const a = pts[0], w = warp(a), dx = w.x - a.x, dy = w.y - a.y; return pts.map(p => P(p.x + dx, p.y + dy)); };
  return {
    hind: shift(hind), front: shift(front), warp, u, jump, flt, kick,
    tilt: e.mode === 'jump' ? clamp(Math.atan2(e.vy, Math.abs(e.vx) + 1) * .5, -.6, .6) : 0,
    squash: e.landT > 0 ? 1 - e.landT * 1.1 : 1, sink: flt ? (SPECIES[e.type].sink || 7) : 0, croak: e.croakT > 0,
    juvenile: e.size < e.adult * .6,
  };
}

function updFrog(e, dt) {
  const sp = SPECIES[e.type], wy = world.waterY;
  e.modeT += dt; e.think -= dt;
  if (e.landT > 0) e.landT -= dt;
  if (e.tongue) {
    const tg = e.tongue; tg.t += dt;
    if (!tg.done && tg.t >= .1) {
      tg.done = true;
      if (canEat(e, tg.target) && dist(frogMouth(e), tg.target) < sp.tongue * e.size / sp.scale + 12) { tg.caught = true; tg.tx = tg.target.x; tg.ty = tg.target.y; eat(e, tg.target); }
    }
    if (!tg.done && tg.target) { tg.tx = tg.target.x; tg.ty = tg.target.y; }
    if (tg.t > .3) e.tongue = null;
  }
  if (e.mode === 'jump') {
    e.state = '跳躍';
    const prevY = e.y;
    e.vy += FROG_G * dt; e.x += e.vx * dt; e.y += e.vy * dt;
    if (e.x < TANK.left + 15 || e.x > TANK.right - 15) { e.x = clamp(e.x, TANK.left + 15, TANK.right - 15); e.vx *= -.3; }
    if (e.y < TANK.top + 10) { e.y = TANK.top + 10; e.vy = Math.max(0, e.vy); }
    if (solidAt(e.x, e.y - 3)) {                              // 碰到實心地形
      const top = groundY(e.x, e.y - 3, 30);
      if (e.vy > 0 && top < e.y && top <= wy + 2) { e.y = top; frogLand(e, 'sit'); return; }   // 從上方落到表面：站上去
      e.x -= e.vx * dt; e.vx *= -.3;                         // 從側面撞上：反彈
      if (solidAt(e.x, e.y - 3)) e.y = groundY(e.x, e.y, 120);   // 已經卡在裡面：推回表面
    }
    if (e.vy > 0) {
      const g = groundY(e.x, prevY - 1, 2);
      if (g <= wy + 2 && e.y >= g) { e.y = g; frogLand(e, 'sit'); }
      else if (e.y >= wy && g > wy + 2) { e.y = wy; frogLand(e, 'float'); }
      else if (e.y >= g) { e.y = g; frogLand(e, 'sit'); }
    }
    return;
  }
  if (e.mode === 'sit') {
    const g = groundY(e.x, e.y - 4, 6);
    if (g > e.y + 3) { e.mode = 'jump'; e.vx = 0; e.vy = 0; return; }
    e.y = g;
    if (g > wy + 2) e.mode = 'float';
  }
  if (e.mode === 'float' && solidAt(e.x, wy + 3)) {           // 浮水時卡在石頭裡：游到最近的開放水面，找不到就跳上岸
    let off = null;
    for (let d = 6; d <= 260; d += 6) { if (!solidAt(e.x - d, wy + 3)) { off = -d; break; } if (!solidAt(e.x + d, wy + 3)) { off = d; break; } }
    if (off !== null) { e.x += Math.sign(off) * Math.min(Math.abs(off), 90 * dt); e.dir = Math.sign(off); e.y = wy; }
    else { const t = frogJumpTarget(e); if (t) { frogLaunch(e, t); return; } }
    e.state = '游出石縫';
  } else if (e.mode === 'float') {
    if (groundY(e.x, wy - 2, 2) <= wy + 1) e.mode = 'sit';
    else {
      e.y = wy + Math.sin(world.t * 2 + e.id) * 1.2;
      if (!e.tongue) {
        e.x = clamp(e.x + e.dir * 8 * dt, TANK.left + 20, TANK.right - 20);
        if (solidAt(e.x + e.dir * 22, e.y + 4) || e.x <= TANK.left + 20 || e.x >= TANK.right - 20) e.dir *= -1;
      }
    }
  }
  if (!e.tongue && e.hunger < sp.huntBelow) {
    const m = findPrey(e, sp.tongue * e.size / sp.scale, null, frogMouth(e));
    if (m) { e.dir = Math.sign(m.x - e.x) || e.dir; e.tongue = { target: m, t: 0, tx: m.x, ty: m.y }; }
  }
  if (!e.tongue && e.think <= 0 && !(e.unkenT > 0)) {
    e.think = rand(2.5, 6);
    const t = frogJumpTarget(e);
    if (t) { frogLaunch(e, t); return; }
  }
  if (e.croakT > 0) e.croakT -= dt;
  else if (isNight() && !e.tongue && Math.random() < dt / 12) { e.croakT = sp.call === '啾' ? .6 : 2.2; addFx(e.x, e.y - 22 * e.size, sp.call, '#dff0ff'); }
  // 鈴蟾反射：烏龜靠近時背部下凹、露出紅色警告色
  const threatened = e.mode === 'sit' && world.ents.some(o => o.kind === 'turtle' && !o.dead && dist(o, e) < 45 * o.size);
  if (e.unkenT > 0) e.unkenT -= dt;
  else if (threatened && sp.unken) e.unkenT = 2.5;
  if (e.scareCD > 0) e.scareCD -= dt;
  else if (threatened && sp.wary && !e.tongue) {             // 金線蛙：機警，受威脅就跳進水裡（8 秒冷卻）
    const t = frogJumpTarget(e, true);
    if (t) { e.scareCD = 8; frogLaunch(e, t); logEvent(`💦 ${sp.name}受驚跳進水裡`); return; }
  }
  e.state = e.unkenT > 0 ? '鈴蟾反射（警告色）' : e.tongue ? '吐舌頭捕食' : e.croakT > 0 ? '鳴叫' : e.mode === 'float' ? '浮在水面' : '坐著';
}
function frogJumpTarget(e, wantWater = false) {
  const wy = world.waterY;
  for (let i = 0; i < 10; i++) {
    const tx = clamp(e.x + rand(-260, 260), TANK.left + 30, TANK.right - 30);
    if (Math.abs(tx - e.x) < 40) continue;
    const top = highestTop(tx), land = top < wy;
    const ly = land ? top : wy;
    if (ly < TANK.top + 60 || e.y - ly > 180) continue;
    if (wantWater) { if (land) continue; return P(tx, ly); }
    if (e.mode === 'float' && !land && Math.random() < .7) continue;   // 浮在水面時比較想上岸
    return P(tx, ly);
  }
  return null;
}
function frogLaunch(e, t) {
  if (e.mode === 'float') splash(e.x, world.waterY, .3 * e.size);
  const T = clamp(Math.abs(t.x - e.x) / 300, .45, .9);
  e.vx = (t.x - e.x) / T; e.vy = (t.y - e.y - .5 * FROG_G * T * T) / T;
  e.dir = Math.sign(e.vx) || e.dir; e.mode = 'jump'; e.modeT = 0;
}
function frogLand(e, m) {
  if (m === 'float') splash(e.x, world.waterY, .45 * e.size); else dust(e.x, e.y, .3 * e.size);
  e.mode = m; e.vx = 0; e.vy = 0; e.modeT = 0; e.landT = .18; e.think = Math.max(e.think, rand(1.5, 3)); }

// =====================================================================
// 壁虎：地面（側面圖）＋ 背面玻璃（俯視圖）
// =====================================================================
const GK_SEG = 6.5, GK_N = 14;
function updGecko(e, dt) {
  e.modeT += dt; e.think -= dt;
  if (e.surface === 'glass') updGeckoGlass(e, dt); else updGeckoGround(e, dt);
}
function initChain(e, ang) {
  e.surface = 'glass';
  e.ang = ang ?? (e.dir > 0 ? 0 : Math.PI);
  e.chain = [];
  for (let i = 0; i < GK_N; i++) e.chain.push(P(e.x - Math.cos(e.ang) * GK_SEG * e.size * i, e.y - Math.sin(e.ang) * GK_SEG * e.size * i));
  e.feet = null; e.goal = null; e.v = 0; e.lunge = null; e.pause = 0; e.goToGround = false;
}
function updChain(e) {
  const seg = GK_SEG * e.size, c = e.chain;
  c[0].x = e.x; c[0].y = e.y;
  for (let i = 1; i < c.length; i++) {
    const dx = c[i].x - c[i - 1].x, dy = c[i].y - c[i - 1].y, d = Math.hypot(dx, dy) || 1;
    c[i].x = c[i - 1].x + dx / d * seg; c[i].y = c[i - 1].y + dy / d * seg;
  }
}
function chainAngle(c, i) {
  const a = c[Math.max(0, i - 1)], b = c[Math.min(c.length - 1, i + 1)];
  return Math.atan2(a.y - b.y, a.x - b.x);                   // 指向頭部
}
const GLASS_LEGS = [{ j: 2, side: -1, front: true, grp: 0 }, { j: 2, side: 1, front: true, grp: 1 },
                    { j: 6, side: -1, front: false, grp: 1 }, { j: 6, side: 1, front: false, grp: 0 }];
function idealFoot(e, L) {
  const c = e.chain, j = c[L.j], a = chainAngle(c, L.j), s = e.size;
  const lat = 15 * s, fwd = (L.front ? 7 : -3) * s, sa = a + L.side * Math.PI / 2;
  return P(j.x + Math.cos(a) * fwd + Math.cos(sa) * lat, j.y + Math.sin(a) * fwd + Math.sin(sa) * lat);
}
function stepLegs(e, dt) {
  if (!e.feet) e.feet = GLASS_LEGS.map(L => ({ ...idealFoot(e, L), t: 1, sx: 0, sy: 0, tx: 0, ty: 0 }));
  const stepping = g => e.feet.some((f, i) => GLASS_LEGS[i].grp === g && f.t < 1);
  e.feet.forEach((f, i) => {
    const L = GLASS_LEGS[i];
    if (f.t < 1) { f.t = Math.min(1, f.t + dt / .13); f.x = lerp(f.sx, f.tx, f.t); f.y = lerp(f.sy, f.ty, f.t); return; }
    const id = idealFoot(e, L);
    if (dist(f, id) > 11 * e.size && !stepping(1 - L.grp)) {   // 對角線兩隻腳一組輪流
      const a = chainAngle(e.chain, L.j), lead = e.v > 2 ? 6 * e.size : 0;
      f.sx = f.x; f.sy = f.y; f.tx = id.x + Math.cos(a) * lead; f.ty = id.y + Math.sin(a) * lead; f.t = 0;
    }
  });
}
function glassHead(e) { return P(e.x + Math.cos(e.ang) * 9 * e.size, e.y + Math.sin(e.ang) * 9 * e.size); }
function chooseGlassGoal(e) {
  const wy = world.waterY;
  if (Math.random() < .25) {
    const spots = landSpots().filter(s => s.y > TANK.top + 80);
    if (spots.length) { const s = pick(spots); e.goal = P(s.x, s.y - 12); e.goToGround = true; e.groundSpot = s; e.think = 14; return; }
  }
  e.goal = P(rand(TANK.left + 30, TANK.right - 30), rand(TANK.top + 30, Math.max(TANK.top + 40, wy - 40)));
  e.goToGround = false; e.think = rand(3, 7);
  const night = isNight();                                    // 壁虎夜行：白天常常停著不動
  if (Math.random() < (night ? .2 : .6)) e.pause = night ? rand(1, 3) : rand(4, 10);
}
function updGeckoGlass(e, dt) {
  const sp = SPECIES.gecko, wy = world.waterY, airLimit = Math.max(TANK.top + 14, wy - 18);
  if (!e.chain) initChain(e);
  if (e.lunge) {
    const lt = e.lunge; lt.t += dt;
    const k = Math.min(1, lt.t / .12);
    e.x = lerp(lt.x0, lt.tx, k); e.y = lerp(lt.y0, lt.ty, k); e.mouth = lt.t < .3 ? 1 : 0;
    if (!lt.done && lt.t >= .12) { lt.done = true; if (canEat(e, lt.target) && dist(glassHead(e), lt.target) < 24 * e.size) eat(e, lt.target); }
    if (lt.t > .5) { e.lunge = null; e.mouth = 0; e.modeT = 0; }
    e.state = '撲咬'; updChain(e); stepLegs(e, dt);
    return;
  }
  let spd;
  const prey = e.hunger < sp.huntBelow ? findPrey(e, sp.sight * e.size / sp.scale, t => t.y < airLimit + 10) : null;
  if (prey) {
    const d = dist(glassHead(e), prey);
    e.goal = P(prey.x, prey.y); e.goToGround = false; e.pause = 0;
    if (d < 55 * e.size && e.modeT > .3) {
      const a = Math.atan2(prey.y - e.y, prey.x - e.x);
      e.lunge = { t: 0, x0: e.x, y0: e.y, tx: e.x + Math.cos(a) * (d - 4), ty: e.y + Math.sin(a) * (d - 4), target: prey };
      e.ang = a; return;
    }
    spd = d < 120 ? 14 : 30; e.state = '潛行接近獵物';
  } else {
    if (!e.goal || dist(e, e.goal) < 12 || e.think <= 0) chooseGlassGoal(e);
    if (e.pause > 0) e.pause -= dt;
    spd = e.pause > 0 ? 0 : sp.speed * (isNight() ? 1.2 : .7);
    e.state = spd ? (e.goToGround ? '爬向陸地' : '在玻璃上爬') : (isNight() ? '靜止埋伏' : '白天休息');
  }
  if (e.goToGround && e.groundSpot && dist(e, e.goal) < 14) {    // 下到陸地，改成側面圖
    e.surface = 'ground'; e.y = e.groundSpot.y; e.x = e.groundSpot.x;
    e.dir = Math.cos(e.ang) >= 0 ? 1 : -1; e.mode = 'walk'; e.modeT = 0; e.v = 0; e.dist = 0; e.turning = false; e.turnT = 0; e.think = rand(3, 6);
    e.goToGround = false; return;
  }
  const ga = Math.atan2(e.goal.y - e.y, e.goal.x - e.x);
  e.ang += clamp(angDiff(e.ang, ga), -3 * dt, 3 * dt);
  e.v = lerp(e.v, spd, ease(dt, 5));
  e.x = clamp(e.x + Math.cos(e.ang) * e.v * dt, TANK.left + 12, TANK.right - 12);
  e.y = clamp(e.y + Math.sin(e.ang) * e.v * dt, TANK.top + 12, airLimit);
  updChain(e); stepLegs(e, dt);
}
function geckoSideHead(e) { return P(e.x + e.dir * 54 * e.size, e.y - 10 * e.size); }
function updGeckoGround(e, dt) {
  const sp = SPECIES.gecko, wy = world.waterY, s = e.size;
  const g = groundY(e.x, e.y - 4, 8);
  if (g > e.y + 16 || e.y > wy - 2) { e.y = Math.min(e.y, wy - 24); initChain(e, -Math.PI / 2); return; }   // 失足就抓回玻璃
  e.y = g;
  let tv = 0, acc = 6;
  if (e.mode === 'lunge') {
    const t = e.modeT;
    tv = t < .14 ? 200 : 0; acc = 14;
    e.lungeK = t < .1 ? t / .1 : t < .45 ? 1 : t < .8 ? 1 - (t - .45) / .35 : 0;
    e.mouth = t > .05 && t < .4 ? 1 : 0;
    if (!e.lungeDone && t > .12) { e.lungeDone = true; if (canEat(e, e.lungeTarget) && dist(geckoSideHead(e), e.lungeTarget) < 30 * s) eat(e, e.lungeTarget); }
    if (t > 1) { e.mode = 'ambush'; e.modeT = 0; }
  } else {
    e.lungeK = lerp(e.lungeK || 0, 0, ease(dt, 8)); e.mouth = 0;
    const prey = e.hunger < sp.huntBelow ? findPrey(e, sp.sight * .6, t => Math.abs(t.y - (e.y - 12)) < 50 && (t.x - e.x) * e.dir > 0) : null;
    if (prey && Math.abs(prey.x - e.x) < 75 * s) { e.mode = 'lunge'; e.modeT = 0; e.lungeDone = false; e.lungeTarget = prey; }
    else if (prey) e.mode = 'walk';
    else if (e.think <= 0) {
      e.think = rand(2, 5);
      const r = Math.random();
      if (r < .3) e.mode = 'ambush';
      else if (r < .5) { e.y -= 10; initChain(e, -Math.PI / 2); return; }   // 爬回玻璃
      else e.mode = 'walk';
      e.modeT = 0;
    }
    if (e.mode === 'walk') tv = 30;
  }
  if (tickTurn(e, dt, .3)) tv = 0;
  e.v = lerp(e.v, tv, ease(dt, acc));
  const nx = e.x + e.dir * e.v * dt, front = nx + e.dir * 55 * s;
  const fg = groundY(front, e.y - 4, 10);
  if (front < TANK.left + 5 || front > TANK.right - 5 || solidAt(front, e.y - 10) || fg > wy - 2 || fg - e.y > 24) {
    if (e.mode === 'lunge') e.v = 0;
    else if (Math.random() < .5) { e.y -= 10; initChain(e, -Math.PI / 2 + (e.dir > 0 ? .5 : -.5)); return; }
    else startTurn(e);
  } else { e.x = nx; e.dist += e.v * dt; }
  e.state = { walk: '爬行', ambush: '埋伏', lunge: '撲咬' }[e.mode] || '爬行';
}

// =====================================================================
// 孑孓（卵塊 → 孑孓 → 蛹 → 羽化）
// =====================================================================
function inPlant(t) {
  for (const d of world.decor) if (d.type === 'plant' && Math.abs(t.x - d.x) < d.w * .7 && t.y <= d.y && t.y >= d.y - d.h) return true;
  return false;
}
function updLarva(e, dt) {
  const sp = SPECIES.larva, wy = world.waterY;
  const surfY = wy + (e.stage === 'egg' ? 1 : 7);
  if (wy >= TANK.floor - 6) {                                   // 水乾了
    e.state = '乾涸';
    if (world.settings.death) kill(e, '缺水死亡');
    else e.y = Math.min(TANK.floor - 2, groundY(e.x, e.y - 4, 6) - 2);
    return;
  }
  e.phase += dt * (e.dive > 0 ? 14 : 3);
  e.grow += dt;
  if (e.stage === 'egg') {
    e.y = surfY; e.x += Math.sin(world.t * .5 + e.id) * 3 * dt;
    e.state = `卵塊（${e.count} 顆，${Math.max(0, Math.ceil(sp.eggTime - e.grow))} 秒後孵化）`;
    if (e.grow >= sp.eggTime) {
      for (let i = 0; i < e.count; i++) { const l = makeEnt('larva', e.x + rand(-14, 14), surfY + 6); l.grow = rand(0, 4); }
      logEvent(`🐛 卵塊孵出 ${e.count} 隻孑孓`);
      e.removed = true;
    }
    return;
  }
  // 感覺到魚靠近 → 扭動身體下潛
  if (e.dive <= 0 && world.settings.rules.fish_larva)
    for (const f of world.ents) if (f.kind === 'fish' && !f.dead && dist(f, e) < sp.fear) { e.dive = rand(.8, 1.4); break; }
  if (e.dive <= 0 && e.stage === 'larva' && Math.random() < dt / 20) e.dive = rand(.5, 1);   // 偶爾下潛覓食
  if (e.dive > 0) {
    e.dive -= dt; e.y += (e.stage === 'pupa' ? 55 : 45) * dt;
    e.x += Math.sin(e.phase) * 10 * dt;
    e.state = e.stage === 'pupa' ? '蛹受驚翻滾下沉' : '受驚下潛';
  } else if (e.y > surfY + 1) {
    e.y -= (e.stage === 'pupa' ? 26 : 16) * dt;                 // 蛹比較輕，浮得比較快
    e.state = '浮回水面';
  } else {
    e.y = surfY; e.x += Math.sin(world.t * .4 + e.id * 1.7) * 4 * dt;
    e.state = e.stage === 'pupa' ? `蛹（${Math.max(0, Math.ceil(sp.pupaTime - e.grow))} 秒後羽化）` : '倒吊在水面呼吸';
  }
  e.y = Math.min(e.y, TANK.floor - 6);
  if (solidAt(e.x, e.y)) e.y -= 40 * dt;
  e.x = clamp(e.x, TANK.left + 6, TANK.right - 6);
  if (e.stage === 'larva' && e.grow >= sp.larvaTime) { e.stage = 'pupa'; e.grow = 0; }
  else if (e.stage === 'pupa' && e.grow >= sp.pupaTime && e.y <= surfY + 1) {
    if (world.ents.filter(m => m.kind === 'mosquito' && !m.dead).length < CAPS.mosquito) {
      makeEnt('mosquito', e.x, wy - 8);
      addFx(e.x, wy - 10, '羽化', '#2fd3ff');
      logEvent('🦟 一隻蚊子羽化了');
    }
    e.removed = true;
  }
}
function layEggs(m) {
  const sp = SPECIES.larva, room = CAPS.larva - larvaCount();
  if (room <= 0) return false;
  const raft = makeEnt('larva', m.x, world.waterY + 1);
  raft.stage = 'egg'; raft.count = Math.min(room, Math.round(rand(...sp.raft)));
  logEvent(`🥚 蚊子在水面產下卵塊（${raft.count} 顆）`);
  return true;
}

// 側面骨架（局部座標：原點 = 身體下方地面，頭在 +x）
const GK_BASE = [[54, -10], [42, -12], [26, -11], [12, -10], [-2, -10], [-14, -9], [-28, -6], [-42, -3], [-56, -2], [-68, -2], [-80, -3]];
const GK_THICK = [2.5, 5.5, 6.5, 7.5, 7.5, 7, 5, 3.8, 2.8, 1.8, .8];
const GK_STRIDE = 20, GK_STANCE = .65, GK_CYCLE = GK_STRIDE / GK_STANCE;
function ik2(h, f, a, b, pickFn) {
  const dx = f.x - h.x, dy = f.y - h.y;
  const d = clamp(Math.hypot(dx, dy), Math.abs(a - b) + .01, a + b - .01);
  const base = Math.atan2(dy, dx), off = Math.acos(clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1));
  const k1 = P(h.x + a * Math.cos(base + off), h.y + a * Math.sin(base + off));
  const k2 = P(h.x + a * Math.cos(base - off), h.y + a * Math.sin(base - off));
  const knee = pickFn(k1, k2);
  const ang = Math.atan2(f.y - knee.y, f.x - knee.x);
  return { knee, foot: P(knee.x + b * Math.cos(ang), knee.y + b * Math.sin(ang)) };
}
function geckoSideRig(e) {
  const s = e.size, d = e.dist / s, moving = e.v > 1;
  const bob = moving ? Math.sin(d / GK_CYCLE * Math.PI * 4) * .8 : Math.sin(world.t * 2) * .3;
  const L = e.lungeK || 0;
  const tw = (e.mode === 'ambush' && Math.sin(e.modeT * 1.7) > .5) ? Math.sin(e.modeT * 30) * 2.5 : 0;
  const nodes = GK_BASE.map(([x, y], i) => {
    let px = x, py = y;
    if (i <= 5) py -= bob;
    if (i <= 1) { px += L * 6; py -= L * 5; }
    if (i === 2) { px += L * 3; py -= L * 2; }
    if (i >= 6 && moving) py += Math.sin(d * .25 - i);
    if (i === 10) py += tw; if (i === 9) py += tw * .4;
    return { x: px, y: py, t: GK_THICK[i] };
  });
  const legs = [{ a: 2, front: true, near: true, ph: 0 }, { a: 2, front: true, near: false, ph: .5 },
                { a: 5, front: false, near: true, ph: .5 }, { a: 5, front: false, near: false, ph: 0 }].map(L0 => {
    const an = nodes[L0.a];
    const hip = P(an.x, an.y + 2 - (L0.near ? 0 : 1.5));
    const frac = (((d / GK_CYCLE + L0.ph) % 1) + 1) % 1;
    let rel, lift = 0;
    if (frac < GK_STANCE) rel = GK_STRIDE * (.5 - frac / GK_STANCE);
    else { const t = (frac - GK_STANCE) / (1 - GK_STANCE); rel = GK_STRIDE * (-.5 + t); lift = Math.sin(Math.PI * t) * 5; }
    const target = P(an.x + (L0.front ? 5 : -3) + rel, -lift - (L0.near ? 0 : 2.5));
    return { ...L0, hip, ...ik2(hip, target, 9, 10, (a, b) => (a.y < b.y ? a : b)), lift };
  });
  return { nodes, legs, mouth: e.mouth || 0, sx: facing(e) };
}

// =====================================================================
// 蚊子
// =====================================================================
function updMosquito(e, dt) {
  const sp = SPECIES.mosquito, wy = world.waterY;
  e.think -= dt; e.eggT -= dt;
  if (world.settings.death && e.age > e.life) { kill(e, '壽命到了'); return; }
  const top = TANK.top + 12, bot = Math.max(top + 10, wy - 6);
  if (!e.goal || e.think <= 0 || dist(e, e.goal) < 8) {
    if (Math.random() < (e.eggT <= 0 ? .85 : .2) && wy < TANK.floor - 5) { e.goal = P(rand(TANK.left + 30, TANK.right - 30), wy - 7); e.mode = 'surface'; e.think = rand(3, 5); }
    else {
      let g, tr = 0;
      do { g = P(rand(TANK.left + 20, TANK.right - 20), rand(top, bot)); } while (solidAt(g.x, g.y) && ++tr < 8);
      e.goal = g; e.mode = 'fly'; e.think = rand(1.5, 4);
    }
  }
  const a = Math.atan2(e.goal.y - e.y, e.goal.x - e.x), near = dist(e, e.goal);
  const landing = e.mode === 'surface' && near < 20;
  const spd = landing ? 8 : sp.speed, jit = landing ? 3 : 25;      // 停在水面時幾乎不飄
  e.vx = lerp(e.vx, Math.cos(a) * spd + Math.sin(world.t * 9 + e.id) * jit, ease(dt, 3));
  e.vy = lerp(e.vy, Math.sin(a) * spd + Math.cos(world.t * 11 + e.id * 2) * jit, ease(dt, 3));
  e.x = clamp(e.x + e.vx * dt, TANK.left + 6, TANK.right - 6);
  e.y = clamp(e.y + e.vy * dt, top - 6, bot + 2);
  if (solidAt(e.x, e.y)) e.y -= 60 * dt;
  if (Math.abs(e.vx) > 3) e.dir = Math.sign(e.vx);
  e.phase += dt;
  const onSurface = e.mode === 'surface' && near < 20;
  if (onSurface && !e.onSurf) ripple(e.x, wy, .3);
  e.onSurf = onSurface;
  if (onSurface && e.eggT <= 0) {
    e.surfT += dt;
    if (e.surfT > 1.5) { if (layEggs(e)) e.eggT = rand(...sp.eggCooldown); else e.eggT = 10; e.surfT = 0; e.think = 0; }
  } else e.surfT = 0;
  e.state = onSurface ? (e.eggT <= 0 ? '在水面產卵' : '停在水面') : (e.eggT <= 0 ? '飛行（準備產卵）' : '飛行');
}


// =====================================================================
// 繁殖（M3）
// =====================================================================
function tickBreed(e, dt) {
  const sp = SPECIES[e.type], b = sp.breed;
  if (!b || !world.settings.breed) return;
  if (sp.sexed) return tickPregnancy(e, dt, sp, b);
  if (e.breedT === undefined) e.breedT = rand(...b.cool);
  e.breedT -= dt;
  if (e.breedT > 0) return;
  e.breedT = rand(...b.cool);
  if (!isAdult(e) || e.hunger < 60) return;
  if (!world.ents.some(o => o !== e && o.type === e.type && !o.dead && isAdult(o))) return;   // 要有另一隻成年同類
  const wy = world.waterY;
  if (b.how === 'live') {                                     // 魚：直接生小魚
    const room = capFor('fish') - countKind('fish');
    if (room <= 0) return;
    const n = Math.min(room, Math.round(rand(...b.count)));
    for (let i = 0; i < n; i++) {
      const c = makeEnt(e.type, e.x + rand(-20, 20), clamp(e.y + rand(-15, 15), wy + 12, TANK.floor - 10));
      c.size = c.adult * sp.birth; c.hunger = 70;
    }
    e.hunger -= 15;
    logEvent(`🐟 ${sp.name}生了 ${n} 隻小魚`);
  } else if (b.how === 'spawn') {                             // 青蛙：浮在水面時在水中產卵
    if (e.mode !== 'float') { e.breedT = 12; return; }
    const room = capFor('tadpole') - countKind('tadpole');
    if (room <= 0 || countKind('frog') >= capFor('frog')) return;
    const nest = makeEnt('nest', e.x, wy + 20);
    Object.assign(nest, { of: e.type, medium: 'water', hatch: b.hatch, count: Math.min(room, Math.round(rand(...b.count))) });
    e.hunger -= 15;
    logEvent(`🥚 ${sp.name}在水中產下卵（${nest.count} 顆）`);
  } else if (b.how === 'eggs') {                              // 烏龜、壁虎：在陸地上產蛋
    const onLand = e.kind === 'turtle' ? (e.mode === 'walk' || e.mode === 'bask') : e.surface === 'ground';
    if (!onLand) { e.breedT = 15; return; }
    if (countKind(e.kind) >= capFor(e.kind)) return;
    const nest = makeEnt('nest', e.x - e.dir * 30 * e.size, e.y);
    nest.y = groundY(nest.x, e.y - 10, 14);
    Object.assign(nest, { of: e.type, medium: 'land', hatch: b.hatch, count: Math.round(rand(...b.count)) });
    e.hunger -= 15;
    logEvent(`🥚 ${sp.name}在陸地上產下 ${nest.count} 顆蛋`);
  }
}
// 孔雀魚：母魚附近有成年公魚就會懷孕；懷孕斑隨時間變大變深，時間到就生產
function tickPregnancy(e, dt, sp, b) {
  if (e.sex !== 'f' || !isAdult(e)) return;
  if (e.preg > 0) {
    e.preg += dt / sp.gestation * (e.hunger > 30 ? 1 : .3);   // 吃不飽懷孕進度變慢
    if (e.preg < 1) return;
    e.preg = 0; e.breedT = rand(...b.cool);
    const room = capFor('fish') - countKind('fish');
    if (room <= 0) { logEvent(`🐟 ${sp.name}母魚的魚苗沒能活下來（缸內太擠）`); return; }
    const n = Math.min(room, Math.round(rand(...b.count) * e.size / e.adult));
    const wy = world.waterY;
    for (let i = 0; i < n; i++) {
      const c = makeEnt(e.type, e.x - e.dir * 8 + rand(-10, 10), clamp(e.y + rand(-8, 12), wy + 12, TANK.floor - 10));
      c.size = c.adult * sp.birth; c.hunger = 70;
      c.morph = Math.random() < .5 ? e.morph : (e.mateMorph ?? e.morph);   // 遺傳父母其中一方的品系
    }
    e.hunger -= 15;
    logEvent(`🐟 ${sp.name}母魚生了 ${n} 隻魚苗`);
    return;
  }
  if (e.breedT === undefined) e.breedT = rand(...b.cool) * .5;
  if ((e.breedT -= dt) > 0 || e.hunger < 50) return;
  const male = world.ents.find(o => o.type === e.type && o.sex === 'm' && !o.dead && isAdult(o) && dist(o, e) < 300);
  if (!male) { e.breedT = 10; return; }
  e.preg = .001; e.mateMorph = male.morph;
  logEvent(`💕 ${sp.name}母魚懷孕了`);
}
function updNest(e, dt) {
  const wy = world.waterY;
  e.t += dt;
  if (e.medium === 'water') {
    if (wy >= TANK.floor - 10) { kill(e, '水乾了'); return; }
    e.y = lerp(e.y, wy + 20, ease(dt, 2));
  } else {
    e.y = groundY(e.x, e.y - 6, 8);
    if (e.y > wy + 4) { kill(e, '泡水了'); return; }
  }
  const left = Math.max(0, Math.ceil(e.hatch - e.t));
  e.state = `${e.count} 顆，${left} 秒後孵化`;
  if (e.t < e.hatch) return;
  const sp = SPECIES[e.of];
  const capKey = sp.kind === 'frog' ? 'tadpole' : sp.kind;               // 孵化時也檢查族群上限
  e.count = Math.min(e.count, capFor(capKey) - countKind(capKey));
  if (e.count <= 0) { logEvent(`🥚 ${entName(e)}沒有孵化（缸內太擠了）`); e.removed = true; return; }
  for (let i = 0; i < e.count; i++) {
    if (SPECIES[e.of].kind === 'frog') {
      const t = makeEnt('tadpole', e.x + rand(-16, 16), e.y + rand(-6, 10)); t.size = .4; t.hunger = 80; t.of = e.of;
    } else {
      const c = makeEnt(e.of, e.x + rand(-12, 12), e.y - 4);
      c.size = c.adult * sp.birth; c.hunger = 80;
      if (c.kind === 'gecko') { c.surface = 'ground'; c.y = e.y; c.mode = 'walk'; }
      if (c.kind === 'turtle') { c.mode = 'walk'; c.y = e.y; c.wantWater = true; }
    }
  }
  logEvent(sp.kind === 'frog' ? `🐸 ${sp.name}的卵孵出 ${e.count} 隻蝌蚪` : `🐣 ${sp.name}的蛋孵化了（${e.count} 隻）`);
  e.removed = true;
}

// =====================================================================
// 蝌蚪 → 小青蛙
// =====================================================================
function updTadpole(e, dt) {
  const sp = SPECIES.tadpole, wy = world.waterY;
  if (wy >= TANK.floor - 8) { if (world.settings.death) kill(e, '缺水死亡'); return; }
  e.think -= dt;
  e.phase += dt * (6 + e.v * .3);
  if (e.hunger > 30) { e.meta += dt / sp.metaTime; e.size = lerp(.4, 1.3, Math.min(1, e.meta)); }
  // 逃離會吃蝌蚪的魚和烏龜
  let threat = null;
  for (const o of world.ents) if ((o.kind === 'fish' || o.kind === 'turtle') && !o.dead && canEat(o, e) && dist(o, e) < 80) threat = o;
  const food = !threat && e.hunger < sp.huntBelow ? findPrey(e, sp.sight, t => t.y > wy) : null;
  if (threat) { e.tx = e.x + (e.x - threat.x) * 2; e.ty = e.y + (e.y - threat.y) + 20; e.state = '逃跑'; }
  else if (food) { e.tx = food.x; e.ty = food.y; e.state = '吃飼料'; }
  else if (e.think <= 0 || e.tx === undefined || dist(e, P(e.tx, e.ty)) < 8) {
    // 喜歡待在水草附近和底層
    const plants = world.decor.filter(d => d.type === 'plant');
    const p = plants.length && Math.random() < .6 ? pick(plants) : null;
    e.tx = p ? p.x + rand(-30, 30) : rand(TANK.left + 30, TANK.right - 30);
    e.ty = rand(Math.max(wy + 20, TANK.floor - 160), TANK.floor - 12);
    e.think = rand(2, 5);
    e.state = e.meta > .6 ? '長出後腳了' : '游來游去';
  }
  const spd = threat ? sp.speed * 2.2 : food ? sp.speed * 1.4 : sp.speed;
  e.v = lerp(e.v, spd, ease(dt, 4));
  const a = Math.atan2(e.ty - e.y, e.tx - e.x);
  let nx = e.x + Math.cos(a) * e.v * dt, ny = e.y + Math.sin(a) * e.v * dt;
  ny = clamp(ny, wy + 8, TANK.floor - 6); nx = clamp(nx, TANK.left + 8, TANK.right - 8);
  if (solidAt(nx, ny)) {                                      // 卡進地形：往左右找最近的開放水域
    e.think = 0; nx = e.x; ny = clamp(e.y, wy + 8, TANK.floor - 6);
    for (let d = 4; d <= 120; d += 4) {
      if (!solidAt(e.x - d, ny)) { nx = e.x - Math.min(d, 40 * dt + 1); break; }
      if (!solidAt(e.x + d, ny)) { nx = e.x + Math.min(d, 40 * dt + 1); break; }
    }
  }
  if (Math.abs(nx - e.x) > .05) e.dir = Math.sign(nx - e.x);
  e.x = nx; e.y = ny;
  if (food && dist(e, food) < 8) eat(e, food);
  if (e.meta >= 1) {                                          // 變態完成：變成小青蛙浮到水面
    if (countKind('frog') < capFor('frog')) {
      const of = e.of || 'frog', f = makeEnt(of, e.x, wy);
      f.size = f.adult * SPECIES[of].birth; f.mode = 'float'; f.y = wy; f.hunger = 80;
      logEvent(`🐸 蝌蚪變成小${SPECIES[of].name}了`);
      addFx(e.x, wy - 10, '變態', '#7fd067');
    }
    e.removed = true;
  }
}

// =====================================================================
// 迷你藍鯨：巡游 → 上浮 → 換氣噴水 → 下潛；濾食孑孓和飼料
// =====================================================================
const whaleL = e => SPECIES.whale.len * e.size;
function whaleMouth(e) { const L = whaleL(e); return P(e.x + e.dir * L * .47, e.y + L * .012); }
function updWhale(e, dt) {
  const sp = SPECIES.whale, wy = world.waterY, L = whaleL(e), hh = L * .09;
  if (wy >= TANK.floor - hh * 1.6) {                          // 水太淺
    e.state = '水太淺了！';
    e.y = Math.min(TANK.floor - hh, Math.max(e.y, wy + hh * .5));
    if (world.settings.death) { e.hp -= dt * 4; if (e.hp <= 0) kill(e, '擱淺死亡'); }
    e.phase += dt * 1.5; return;
  }
  e.breathT -= dt; e.think -= dt;
  const minY = wy + hh * 1.3, maxY = Math.max(minY, TANK.floor - hh * 1.1);
  if (e.wmode === 'cruise') {
    if (e.think <= 0 || e.tx === undefined || Math.abs(e.tx - e.x) < 40) {
      e.tx = rand(TANK.left + L * .5, Math.max(TANK.left + L * .5, TANK.right - L * .5)); e.ty = rand(minY, maxY); e.think = rand(6, 12);
    }
    e.state = '巡游';
    if (e.breathT <= 0) { e.wmode = 'ascend'; e.ty = wy + hh * .45; }
  } else if (e.wmode === 'ascend') {
    e.state = '上浮換氣';
    if (Math.abs(e.y - e.ty) < 3) { e.wmode = 'spout'; e.spoutT = 0; ripple(e.x, wy, 1.6); ripple(e.x + e.dir * whaleL(e) * .3, wy, 1.2); }
  } else if (e.wmode === 'spout') {
    e.state = '噴水換氣';
    e.spoutT += dt; e.ty = wy + hh * .45;
    if (e.spoutT > 2.4) { e.wmode = 'cruise'; e.breathT = rand(...sp.breath); e.ty = rand((minY + maxY) / 2, maxY); e.think = 6; }
  }
  if (Math.abs(e.tx - e.x) > 60 && Math.sign(e.tx - e.x) !== e.dir) startTurn(e);
  let spd = e.wmode === 'spout' ? sp.speed * .3 : sp.speed;
  if (tickTurn(e, dt, 1.6)) spd *= .3;
  e.vx = lerp(e.vx, spd, ease(dt, .8));
  const tooBig = L > (TANK.right - TANK.left) * .95;
  let nx = tooBig ? (TANK.left + TANK.right) / 2 : clamp(e.x + e.dir * e.vx * dt, TANK.left + L * .5, TANK.right - L * .5);
  if (!tooBig && (nx <= TANK.left + L * .5 + 1 || nx >= TANK.right - L * .5 - 1)) { e.tx = (TANK.left + TANK.right) / 2; }
  const ny = clamp(e.y + clamp((e.ty - e.y) * .8, -22, 22) * dt, e.wmode === 'cruise' ? minY : wy + hh * .4, maxY);
  e.x = nx; e.y = ny;
  // 濾食：嘴巴附近的孑孓和飼料直接吞掉
  const m = whaleMouth(e);
  for (const t of [...world.ents, ...world.food]) if ((t.kind === 'larva' || t.kind === 'food') && dist(t, m) < L * .05 && canEat(e, t)) eat(e, t);
  e.phase += Math.PI * 2 * (.3 + e.vx / sp.speed * .25) * dt;
  e.amp = lerp(e.amp, .4 + e.vx / sp.speed * .6, ease(dt, 2));
}
function whaleRig(e) {                                        // 局部座標：身長 100，頭在 +50
  const N = 13, nodes = [];
  for (let i = 0; i < N; i++) {
    const s = i / (N - 1);
    const h = 9.2 * Math.pow(Math.max(0, Math.sin(Math.PI * Math.min(1, s * 1.02 + .07))), .65) * (1 - .72 * s) + .9;
    nodes.push({ x: 50 - s * 100, y: Math.sin(e.phase - s * 2.6) * e.amp * 2.2 * s * s, h });   // 鯨魚是上下擺尾，側面看得到
  }
  const a = nodes[N - 2], b = nodes[N - 1];
  return { nodes, flukeRot: Math.atan2(b.y - a.y, b.x - a.x) - Math.PI + Math.sin(e.phase - 2.9) * .25 * e.amp, sx: facing(e) };
}


// =====================================================================
// 活餌：蟋蟀（陸地上爬、跳；落水會掙扎）、果蠅（在空中飛）
// =====================================================================
function cricketHop(e, dir) {
  const wy = world.waterY;
  const vx = rand(60, 120), vy = rand(160, 260), reach = vx * (2 * vy / 900) * 1.6;   // 估算跳多遠（含下坡多飛的距離）
  const wet = d => [.35, .7, 1].some(f => highestTop(e.x + d * reach * f) > wy - 15);    // 路徑上有水（或太靠近水邊）嗎
  if (wet(dir)) dir = -dir;
  if (wet(dir)) { e.mode = 'crawl'; e.dir = -e.dir; return; }  // 兩邊都是水就不跳
  e.mode = 'hop'; e.dir = dir; e.vx = dir * vx; e.vy = -vy;
}
function updCricket(e, dt) {
  const wy = world.waterY;
  if (world.settings.death && e.age > e.life) { kill(e, '壽命到了'); return; }
  e.phase += dt * 8;
  if (e.mode === 'fall' || e.mode === 'hop') {
    const prevY = e.y;
    e.vy += 900 * dt; e.x += e.vx * dt; e.y += e.vy * dt;
    if (e.x < TANK.left + 6 || e.x > TANK.right - 6) { e.x = clamp(e.x, TANK.left + 6, TANK.right - 6); e.vx *= -.4; }
    if (solidAt(e.x, e.y - 4) && solidAt(e.x, prevY - 4)) { e.x -= e.vx * dt; e.vx *= -.3; }
    if (e.vy > 0 && e.y < wy + 2 && solidAt(e.x, e.y - 1)) {         // 落在陡坡上卡進地形：推回地表
      e.y = groundY(e.x, e.y, 40); e.mode = 'idle'; e.vx = e.vy = 0; e.think = rand(.5, 2.5); e.state = '待著'; return;
    }
    if (e.vy > 0) {
      const g = groundY(e.x, prevY - 1, 2);
      if (e.y >= wy && g > wy + 1) { e.y = wy; e.mode = 'swim'; e.vx = e.vy = 0; e.swimT = 0; splash(e.x, wy, .35); }
      else if (e.y >= g) { e.y = g; e.mode = 'idle'; e.vx = e.vy = 0; e.think = rand(.5, 2.5); }
    }
    e.state = '跳躍';
    return;
  }
  if (e.mode === 'swim') {
    e.swimT += dt; e.y = wy + 1; e.x += Math.sin(e.phase) * 6 * dt;
    e.state = '落水掙扎';
    if (groundY(e.x, wy - 2, 2) <= wy + 1) { e.mode = 'idle'; e.y = groundY(e.x, wy - 2, 2); return; }
    if (Math.random() < dt * 1.5) ripple(e.x, wy, .2);
    if (world.settings.death && e.swimT > 25) kill(e, '溺水');
    return;
  }
  const g = groundY(e.x, e.y - 4, 8);
  if (g > e.y + 3) { e.mode = 'fall'; e.vx = e.vy = 0; return; }
  e.y = g;
  if (e.y > wy + 1) { e.mode = 'swim'; e.swimT = 0; return; }
  e.think -= dt;
  let threat = null;
  for (const o of world.ents) if ((o.kind === 'frog' || o.kind === 'gecko') && !o.dead && dist(o, e) < 70 && canEat(o, e)) threat = o;
  if (threat && Math.random() < dt * 2) { cricketHop(e, Math.sign(e.x - threat.x) || 1); return; }
  if (e.think <= 0) {
    e.think = rand(1, 3.5);
    if (Math.random() < .4) { cricketHop(e, Math.random() < .5 ? 1 : -1); return; }
    e.mode = Math.random() < .5 ? 'crawl' : 'idle'; e.dir = Math.random() < .5 ? 1 : -1;
  }
  if (e.mode === 'crawl') {
    const nx = e.x + e.dir * 12 * dt, ng = groundY(nx, e.y - 4, 6);
    if (solidAt(nx + e.dir * 6, e.y - 6) || nx < TANK.left + 6 || nx > TANK.right - 6 || ng > wy - 1 || ng - e.y > 10) e.dir *= -1;
    else { e.x = nx; e.y = ng; }
  }
  e.state = e.mode === 'crawl' ? '爬行' : (isNight() ? '鳴叫' : '待著');
}
function updFly(e, dt) {
  const sp = SPECIES.fly, wy = world.waterY;
  if (world.settings.death && e.age > e.life) { kill(e, '壽命到了'); return; }
  e.think -= dt;
  const top = TANK.top + 12, bot = Math.max(top + 10, wy - 6);
  if (!e.goal || e.think <= 0 || dist(e, e.goal) < 6) {
    if (Math.random() < .15 && wy < TANK.floor - 5) { e.goal = P(rand(TANK.left + 30, TANK.right - 30), wy - 5); e.think = rand(1.5, 3); }
    else {
      let g, tr = 0;
      do { g = P(rand(TANK.left + 20, TANK.right - 20), rand(top, bot)); } while (solidAt(g.x, g.y) && ++tr < 8);
      e.goal = g; e.think = rand(1, 3);
    }
  }
  const a = Math.atan2(e.goal.y - e.y, e.goal.x - e.x);
  e.vx = lerp(e.vx, Math.cos(a) * sp.speed + Math.sin(world.t * 13 + e.id) * 30, ease(dt, 4));
  e.vy = lerp(e.vy, Math.sin(a) * sp.speed + Math.cos(world.t * 15 + e.id * 2) * 30, ease(dt, 4));
  e.x = clamp(e.x + e.vx * dt, TANK.left + 6, TANK.right - 6);
  e.y = clamp(e.y + e.vy * dt, top - 6, bot + 2);
  if (solidAt(e.x, e.y)) e.y -= 60 * dt;
  if (Math.abs(e.vx) > 3) e.dir = Math.sign(e.vx);
  e.phase += dt;
  e.state = '飛行';
}
