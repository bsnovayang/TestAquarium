'use strict';
// =====================================================================
// achievements.js — 成就
// 只聽模擬發出的事件（emit）和定時檢查狀態，不改變任何玩法
// 記錄存在瀏覽器（跟存檔分開，像 Steam 成就一樣跟著玩家而不是跟著魚缸）
// id 之後直接對應 Steam 成就的 API 名稱（例如 first_place → ACH_FIRST_PLACE）
// =====================================================================

const ACH_KEY = 'aquarium.achievements';
const ACH_SPECIES = PALETTE.filter(p => p.cat !== '造景' && p.cat !== '餵食').flatMap(p => p.items).filter(t => SPECIES[t]);
const ACH_PRESETS = PRESETS.map(p => p.id);

const ACHIEVEMENTS = [
  // 入門
  { id: 'first_place',   cat: '入門',   icon: '🫳', name: '新居民',       desc: '第一次把生物放進魚缸' },
  { id: 'first_feed',    cat: '入門',   icon: '🍤', name: '開飯囉',       desc: '第一次餵食' },
  { id: 'all_presets',   cat: '入門',   icon: '🗂️', name: '魚缸巡禮',     desc: '試過每一種預設魚缸', goal: () => ACH_PRESETS.length, prog: s => s.presets.length },
  // 繁殖
  { id: 'fish_birth',    cat: '繁殖',   icon: '🐟', name: '添丁',         desc: '魚生下第一窩小魚' },
  { id: 'frog_meta',     cat: '繁殖',   icon: '🐸', name: '長出腳了',     desc: '蝌蚪變成小青蛙' },
  { id: 'shrimp_berried',cat: '繁殖',   icon: '🦐', name: '抱卵',         desc: '櫻花蝦母蝦蛻殼後抱卵' },
  { id: 'egg_hatch',     cat: '繁殖',   icon: '🐣', name: '破殼而出',     desc: '烏龜或壁虎的蛋孵化' },
  // 食物鏈
  { id: 'food_chain',    cat: '食物鏈', icon: '🔗', name: '生生不息',     desc: '蚊子在水面產卵之後，魚吃到孑孓' },
  { id: 'frog_mosquito', cat: '食物鏈', icon: '👅', name: '神準舌頭',     desc: '青蛙吃到蚊子' },
  { id: 'gecko_cricket', cat: '食物鏈', icon: '🦗', name: '夜行獵手',     desc: '壁虎吃到蟋蟀' },
  // 照顧
  { id: 'clean_30m',     cat: '照顧',   icon: '💧', name: '清澈見底',     desc: '水質維持「乾淨」30 分鐘（遊戲時間）', goal: () => 1800, prog: s => Math.floor(s.cleanT), unit: 'time' },
  { id: 'live_1h',       cat: '照顧',   icon: '⏳', name: '長壽',         desc: '一隻生物活過 1 小時（遊戲時間）' },
  { id: 'rescue_water',  cat: '照顧',   icon: '🪣', name: '及時換水',     desc: '水已經髒到生物會生病時，換水救回來' },
  { id: 'big_family',    cat: '照顧',   icon: '🏘️', name: '大家族',       desc: '缸裡同時有 30 隻以上的生物' },
  // 收藏
  { id: 'guppy_all',     cat: '收藏',   icon: '🌈', name: '孔雀魚圖鑑',   desc: '看過孔雀魚公魚的每一種品系', goal: () => GUPPY_MORPHS.length, prog: s => s.morphs.length },
  { id: 'shrimp_fire',   cat: '收藏',   icon: '🔥', name: '極火傳承',     desc: '極火等級的櫻花蝦母蝦孵出小蝦' },
  { id: 'all_species',   cat: '收藏',   icon: '📖', name: '生態學家',     desc: '養過每一種生物', goal: () => ACH_SPECIES.length, prog: s => s.species.length },
  // 趣味
  { id: 'whale_spout',   cat: '趣味',   icon: '🐋', name: '噴泉',         desc: '看到迷你藍鯨浮上來噴水' },
  { id: 'gecko_tail',    cat: '趣味',   icon: '🦎', name: '金蟬脫殼',     desc: '壁虎斷尾逃走' },
  { id: 'shark_chase',   cat: '趣味',   icon: '🦈', name: '地盤意識',     desc: '紅尾黑鯊趕走靠近的魚' },
];

// ---------------------------------------------------------------------
// 狀態與存取
// ---------------------------------------------------------------------
function achBlank() { return { unlocked: {}, presets: [], species: [], morphs: [], cleanT: 0, laid: false }; }
let ACH = achBlank();
try { ACH = Object.assign(achBlank(), JSON.parse(localStorage.getItem(ACH_KEY) || '{}')); } catch { }
let achDirty = false;
function achSave() { try { localStorage.setItem(ACH_KEY, JSON.stringify(ACH)); } catch { } achDirty = false; }
const addOnce = (arr, v) => { if (!arr.includes(v)) { arr.push(v); achDirty = true; return true; } return false; };

function unlock(id) {
  if (ACH.unlocked[id]) return;
  const a = ACHIEVEMENTS.find(x => x.id === id); if (!a) return;
  ACH.unlocked[id] = Date.now(); achSave();
  logEvent(`🏆 成就達成：${a.name}`);
  showAchPopup(a);
  renderAchPanel();
}
function checkGoals() {                                            // 有進度的成就：到達目標就解鎖
  for (const a of ACHIEVEMENTS) if (a.goal && !ACH.unlocked[a.id] && a.prog(ACH) >= a.goal()) unlock(a.id);
}

// ---------------------------------------------------------------------
// 事件
// ---------------------------------------------------------------------
onWorldEvent((type, d) => {
  switch (type) {
    case 'place': unlock('first_place'); break;
    case 'feed': unlock('first_feed'); break;
    case 'preset': if (addOnce(ACH.presets, d.id)) { achSave(); checkGoals(); renderAchPanel(); } break;
    case 'fishBirth': unlock('fish_birth'); break;
    case 'metamorph': unlock('frog_meta'); break;
    case 'shrimpBerried': unlock('shrimp_berried'); break;
    case 'shrimpHatch': if (d.morph === 2) unlock('shrimp_fire'); break;
    case 'hatch': if (d.kind === 'turtle' || d.kind === 'gecko') unlock('egg_hatch'); break;
    case 'mosquitoLay': if (!ACH.laid) { ACH.laid = true; achSave(); } break;
    case 'eat': {
      const p = d.pred.kind, q = d.prey.kind;
      if (p === 'fish' && q === 'larva' && ACH.laid) unlock('food_chain');
      if (p === 'frog' && q === 'mosquito') unlock('frog_mosquito');
      if (p === 'gecko' && q === 'cricket') unlock('gecko_cricket');
      break;
    }
    case 'waterChange': if (d.before >= WATER.harmAt && d.after < WATER.harmAt) unlock('rescue_water'); break;
    case 'whaleSpout': unlock('whale_spout'); break;
    case 'autotomy': unlock('gecko_tail'); break;
    case 'chase': unlock('shark_chase'); break;
  }
});

// ---------------------------------------------------------------------
// 定時檢查（每秒）：水質、壽命、數量、收藏
// ---------------------------------------------------------------------
let achLastT = world.t, achSaveT = 0;
function achTick() {
  const dt = world.t - achLastT; achLastT = world.t;
  if (dt > 0 && dt < 120) {                                         // 換魚缸時 world.t 會重來，不算
    if (world.settings.waterSim && world.water.dirt < 30) { ACH.cleanT += dt; achDirty = true; }
    else if (ACH.cleanT && !ACH.unlocked.clean_30m) { ACH.cleanT = 0; achDirty = true; }
  }
  let alive = 0;
  for (const e of world.ents) {
    if (e.dead || e.removed || e.kind === 'nest') continue;
    alive++;
    if (ACH_SPECIES.includes(e.type)) addOnce(ACH.species, e.type);
    if (e.age >= 3600) unlock('live_1h');
    if (e.type === 'guppy' && e.sex === 'm' && e.size >= e.adult * .6) addOnce(ACH.morphs, e.morph || 0);
  }
  if (alive >= 30) unlock('big_family');
  checkGoals();
  if (achDirty && (achSaveT += 1) >= 10) { achSaveT = 0; achSave(); renderAchPanel(); }   // 進度每 10 秒存一次
}
setInterval(achTick, 1000);
window.addEventListener('pagehide', () => { if (achDirty) achSave(); });

// ---------------------------------------------------------------------
// 介面：達成時的提示、右側「成就」清單
// ---------------------------------------------------------------------
const achQueue = []; let achShowing = false;
function showAchPopup(a) { achQueue.push(a); if (!achShowing) nextAchPopup(); }
function nextAchPopup() {
  const a = achQueue.shift(), el = document.getElementById('achPop');
  if (!a || !el) { achShowing = false; return; }
  achShowing = true;
  el.innerHTML = `<span class="achIcon">${a.icon}</span><span><small>成就達成</small><b>${a.name}</b><em>${a.desc}</em></span>`;
  el.classList.add('show');
  setTimeout(() => { el.classList.remove('show'); setTimeout(nextAchPopup, 350); }, 3200);
}
function achProgText(a) {
  if (!a.goal) return '';
  const v = Math.min(a.prog(ACH), a.goal()), g = a.goal();
  return a.unit === 'time' ? `${Math.floor(v / 60)} / ${g / 60} 分` : `${v} / ${g}`;
}
function renderAchPanel() {
  const el = document.getElementById('achPanel'); if (!el) return;
  const n = ACHIEVEMENTS.filter(a => ACH.unlocked[a.id]).length;
  document.getElementById('achCount').textContent = `${n} / ${ACHIEVEMENTS.length}`;
  let html = '', cat = '';
  for (const a of ACHIEVEMENTS) {
    if (a.cat !== cat) { cat = a.cat; html += `<div class="achCat">${cat}</div>`; }
    const done = !!ACH.unlocked[a.id], prog = done ? '' : achProgText(a);
    html += `<div class="ach${done ? ' done' : ''}" title="${a.desc}"><span class="achIcon">${a.icon}</span><span><b>${a.name}</b><em>${a.desc}${prog ? '（' + prog + '）' : ''}</em></span>${done ? '<i aria-label="已達成">✓</i>' : ''}</div>`;
  }
  html += '<div class="btns"><button id="achReset">重設成就</button></div>';
  el.innerHTML = html;
  document.getElementById('achReset').onclick = () => { if (confirm('清除所有成就紀錄？')) { ACH = achBlank(); achSave(); renderAchPanel(); } };
}
renderAchPanel();
