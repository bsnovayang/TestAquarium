'use strict';
// =====================================================================
// effects.js — 日夜循環、粒子特效（水花、漣漪、氣泡、揚塵）、水中光影
// 粒子是純視覺效果，不存檔；以模擬時間更新，所以暫停時也會停住
// =====================================================================

// ---------------------------------------------------------------------
// 日夜循環
//   world.tod：一天中的時間（0 = 午夜、0.5 = 中午）
//   設定：off（固定白天）/ fast（4 分鐘一天）/ normal（12 分鐘一天）/ real（跟現實時間）
// ---------------------------------------------------------------------
const DAY_LENGTH = { fast: 240, normal: 720 };
function tickDayNight(dt) {
  const mode = world.settings.dayCycle;
  if (mode === 'off') world.tod = .5;
  else if (mode === 'real') { const d = new Date(); world.tod = (d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds()) / 86400; }
  else world.tod = (world.tod + dt / DAY_LENGTH[mode]) % 1;
}
// 亮度 0～1：05:30～07:00 日出、18:00～19:30 日落
function daylight() {
  const h = world.tod * 24;
  if (h < 5.5 || h > 19.5) return 0;
  if (h < 7) return (h - 5.5) / 1.5;
  if (h > 18) return (19.5 - h) / 1.5;
  return 1;
}
const isNight = () => daylight() < .3;
function todText() {
  const m = Math.floor(world.tod * 1440), h = Math.floor(m / 60);
  const icon = h >= 7 && h < 18 ? '☀' : h >= 5 && h < 20 ? '🌅' : '🌙';
  return `${icon} ${String(h).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------
// 粒子
// ---------------------------------------------------------------------
function addParticle(p) { if (world.particles.length < 500) world.particles.push({ t: 0, vx: 0, vy: 0, ...p }); }
function splash(x, y, power = 1) {
  const n = Math.round(6 + power * 6);
  for (let i = 0; i < n; i++) addParticle({ type: 'drop', x: x + rand(-6, 6) * power, y: y - 2, vx: rand(-60, 60) * power, vy: -rand(80, 180) * Math.sqrt(power), r: rand(1.2, 2.6) * Math.sqrt(power), life: 1.2 });
  ripple(x, y, power);
}
function ripple(x, y, power = .6) { addParticle({ type: 'ripple', x, y, r: 2, life: 1.1 + power * .4, power }); }
function bubbles(x, y, n = 3) { for (let i = 0; i < n; i++) addParticle({ type: 'bubble', x: x + rand(-4, 4), y: y + rand(-3, 3), r: rand(1.2, 2.6), vy: -rand(25, 45), life: 12, seed: rand(0, 6) }); }
function dust(x, y, power = 1) { for (let i = 0; i < 5 + power * 3; i++) addParticle({ type: 'dust', x: x + rand(-8, 8) * power, y: y - 1, vx: rand(-25, 25) * power, vy: -rand(5, 25), r: rand(2, 4) * power, life: .7 }); }

function tickParticles(dt) {
  const wy = world.waterY;
  for (const p of world.particles) {
    p.t += dt;
    if (p.type === 'drop') {
      p.vy += 600 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.vy > 0 && p.y > wy) p.t = p.life;                  // 掉回水面就消失
    } else if (p.type === 'bubble') {
      p.y += p.vy * dt; p.x += Math.sin(p.t * 5 + p.seed) * 12 * dt;
      p.vy = Math.max(p.vy - 10 * dt, -70);
      if (p.y <= wy + 2) { p.t = p.life; if (Math.random() < .3) ripple(p.x, wy, .25); }   // 浮到水面破掉
      if (solidAt(p.x, p.y)) p.t = p.life;
    } else if (p.type === 'dust') {
      p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .9;
    } else if (p.type === 'ripple') {
      p.y = wy; p.r += (24 + p.power * 20) * dt;
    }
  }
  world.particles = world.particles.filter(p => p.t < p.life);
  // 氣泡石冒泡
  for (const d of world.decor) if (d.type === 'bubbler' && d.y > wy + 10) {
    d.bubT = (d.bubT || 0) - dt;
    if (d.bubT <= 0) { d.bubT = rand(.05, .18); addParticle({ type: 'bubble', x: d.x + rand(-6, 6), y: d.y - 8, r: rand(1, 3.2), vy: -rand(40, 70), life: 20, seed: rand(0, 6) }); }
  }
}
function drawParticles() {
  for (const p of world.particles) {
    const k = 1 - p.t / p.life;
    G.save();
    if (p.type === 'drop') { G.alpha(.8); G.circle(p.x, p.y, p.r, '#e8f6ff'); }
    else if (p.type === 'bubble') { G.alpha(.75); G.circle(p.x, p.y, p.r, null, '#f2fbff', 1); G.circle(p.x - p.r * .35, p.y - p.r * .35, p.r * .3, '#ffffff'); }
    else if (p.type === 'dust') { G.alpha(.35 * k); G.circle(p.x, p.y, p.r * (1.5 - k * .5), '#c9b48a'); }
    else if (p.type === 'ripple') { G.alpha(.7 * k); G.poly(ellipsePts(p.x, p.y + 1, p.r, p.r * .22, 0, 20), null, '#ffffff', 1.3); }
    G.restore();
  }
}

// ---------------------------------------------------------------------
// 水中光影（光束、水底光斑）：亮度跟著日夜變化
// ---------------------------------------------------------------------
function drawLightShafts() {
  const wy = world.waterY, L = daylight();
  if (wy >= TANK.floor || L <= 0) return;
  G.save(); G.alpha(.07 * L);
  for (let x0 = TANK.left + 80; x0 < TANK.right; x0 += 260) {
    const sway = Math.sin(world.t * .3 + x0 * .01) * 30, w = 50 + Math.sin(x0) * 20;
    G.poly([P(x0 + sway, wy), P(x0 + sway + w, wy), P(x0 + sway * 2 + w * 2.2 + 60, TANK.floor), P(x0 + sway * 2 - 30, TANK.floor)], '#ffffff');
  }
  G.restore();
}
function drawCaustics() {
  const wy = world.waterY, L = daylight();
  if (wy >= TANK.floor - 4 || L <= 0) return;
  G.save(); G.alpha(.16 * L);
  const t = world.t;
  for (let x = TANK.left; x < TANK.right; x += 34) {
    for (const row of [0, 1]) {
      const cx = x + Math.sin(t * .8 + x * .05 + row * 2) * 10, cy = TANK.floor + 4 + row * 9 + Math.sin(t * 1.1 + x) * 2;
      const pts = [];
      for (let i = 0; i < 7; i++) {
        const a = i / 7 * Math.PI * 2, r = 9 + Math.sin(t * 2 + i * 1.9 + x) * 4;
        pts.push(P(cx + Math.cos(a) * r, cy + Math.sin(a) * r * .32));
      }
      G.poly(chaikin(pts, true, 1), null, '#fffbe0', 1.6);
    }
  }
  G.restore();
}
// 夜晚：整個缸蓋上一層藍黑色，再加一道淡淡的月光
function drawNightOverlay() {
  const L = daylight();
  if (L >= 1) return;
  G.save(); G.alpha((1 - L) * .62);
  G.rect(0, 0, W, H, '#0a1430');
  G.restore();
  if (L < .5) {
    G.save(); G.alpha((.5 - L) * .14);
    const mx = TANK.left + (TANK.right - TANK.left) * .7;
    G.poly([P(mx - 40, TANK.top), P(mx + 60, TANK.top), P(mx + 260, TANK.floor), P(mx - 10, TANK.floor)], '#cfe0ff');
    G.restore();
  }
}
