'use strict';
// =====================================================================
// balance.js — 平衡調整面板：在遊戲裡直接改 species.js 的數值
// 改了就立刻生效，並記在瀏覽器（localStorage）；可匯出 / 匯入 JSON、重設預設值
// =====================================================================

const BALANCE_FIELDS = [
  ['speed', '移動速度'], ['dash', '衝刺速度'], ['walk', '陸地步行速度'], ['sight', '視野（px）'], ['tongue', '舌頭長度（px）'],
  ['hungerTime', '從飽到餓（秒）'], ['huntBelow', '飽食度低於多少才獵食（%）'],
  ['growTime', '長到成體（秒）'], ['birth', '出生體型比例（0～1）'],
  ['breed.cool', '繁殖間隔（秒）'], ['breed.count', '一次生幾隻'], ['breed.hatch', '卵孵化（秒）'],
  ['metaTime', '蝌蚪變青蛙（秒）'], ['breath', '換氣間隔（秒）'],
  ['life', '壽命（秒）'], ['firstEgg', '羽化後多久產卵（秒）'], ['eggCooldown', '產卵間隔（秒）'],
  ['eggTime', '卵塊孵化（秒）'], ['raft', '一個卵塊幾隻'], ['larvaTime', '孑孓化蛹（秒）'], ['pupaTime', '蛹羽化（秒）'],
  ['fear', '察覺魚的距離（px）'], ['escape', '下潛時躲開的機率（0～1）'], ['drop', '一次投放幾隻'],
];
const CAP_LABEL = { mosquito: '蚊子成蟲', larva: '孑孓（含蛹、卵）', fish: '魚', frog: '蛙類', tadpole: '蝌蚪', turtle: '烏龜', gecko: '壁虎' };
const WATER_LABEL = { wastePerCm: '每公分身長產生髒污', turtleMess: '烏龜髒污倍率', foodRot: '腐爛飼料髒污', bodyRot: '屍體髒污',
  plantClean: '水草清除量', floaterClean: '浮萍清除量', filterClean: '過濾器清除量', algaeGrow: '藻類生長速度', harmAt: '開始生病的髒污值', deadlyAt: '嚴重生病的髒污值' };
const FOOD_LABEL = { food: '飼料', mosquito: '蚊子', fish: '魚', larva: '孑孓', tadpole: '蝌蚪', cricket: '蟋蟀', fly: '果蠅' };

const getPath = (o, p) => p.split('.').reduce((a, k) => a?.[k], o);
function setPath(o, p, v) { const ks = p.split('.'), last = ks.pop(); ks.reduce((a, k) => a[k], o)[last] = v; }
function balanceData() {
  const species = {};
  for (const [k, sp] of Object.entries(SPECIES)) {
    const f = {};
    for (const [p] of BALANCE_FIELDS) { const v = getPath(sp, p); if (v !== undefined) f[p] = Array.isArray(v) ? [...v] : v; }
    if (Object.keys(f).length) species[k] = f;
  }
  return { species, caps: { ...CAPS }, food: { ...FOOD_VALUE }, water: { ...WATER } };
}
function applyBalance(d) {
  for (const [k, fields] of Object.entries(d.species || {})) if (SPECIES[k])
    for (const [p, v] of Object.entries(fields)) if (getPath(SPECIES[k], p) !== undefined) setPath(SPECIES[k], p, Array.isArray(v) ? v.map(Number) : Number(v));
  for (const [k, v] of Object.entries(d.caps || {})) if (k in CAPS) CAPS[k] = Number(v);
  for (const [k, v] of Object.entries(d.food || {})) if (k in FOOD_VALUE) FOOD_VALUE[k] = Number(v);
  for (const [k, v] of Object.entries(d.water || {})) if (k in WATER) WATER[k] = Number(v);
}
const BAL_DEFAULT = JSON.stringify(balanceData());           // 讀入存檔前先記住預設值
function saveBalance() { try { localStorage.setItem('aquarium.balance', JSON.stringify(balanceData())); } catch { } }
function loadBalance() { try { const r = localStorage.getItem('aquarium.balance'); if (r) applyBalance(JSON.parse(r)); } catch { } }
function resetBalance() { applyBalance(JSON.parse(BAL_DEFAULT)); try { localStorage.removeItem('aquarium.balance'); } catch { } }

// ---------------------------------------------------------------------
// 面板
// ---------------------------------------------------------------------
function numInput(path, v, def) {
  const changed = JSON.stringify(v) !== JSON.stringify(def);
  const one = (val, i) => `<input type="number" step="any" data-bal="${path}" ${i !== undefined ? `data-i="${i}"` : ''} value="${val}">`;
  return `<span class="balv${changed ? ' changed' : ''}">${Array.isArray(v) ? one(v[0], 0) + '～' + one(v[1], 1) : one(v)}</span>`;
}
function buildBalancePanel() {
  const def = JSON.parse(BAL_DEFAULT), cur = balanceData();
  let html = '';
  for (const [k, f] of Object.entries(cur.species)) {
    html += `<details><summary>${SPECIES[k].name}</summary><div class="balgrid">`;
    for (const [p, label] of BALANCE_FIELDS) if (p in f) html += `<label>${label}</label>${numInput(`species.${k}.${p}`, f[p], def.species[k]?.[p])}`;
    html += '</div></details>';
  }
  html += '<details><summary>族群上限（標準缸，大缸依面積放大）</summary><div class="balgrid">';
  for (const k in cur.caps) html += `<label>${CAP_LABEL[k] || k}</label>${numInput(`caps.${k}`, cur.caps[k], def.caps[k])}`;
  html += '</div></details><details><summary>吃到能恢復多少飽食度</summary><div class="balgrid">';
  for (const k in cur.food) html += `<label>${FOOD_LABEL[k] || k}</label>${numInput(`food.${k}`, cur.food[k], def.food[k])}`;
  html += '</div></details><details><summary>水質與藻類</summary><div class="balgrid">';
  for (const k in cur.water) html += `<label>${WATER_LABEL[k] || k}</label>${numInput(`water.${k}`, cur.water[k], def.water?.[k])}`;
  html += '</div></details>';
  const open = [...document.querySelectorAll('#balBody details')].map(d => d.open);
  $('balBody').innerHTML = html;
  document.querySelectorAll('#balBody details').forEach((d, i) => d.open = !!open[i]);
}
function bindBalance() {
  loadBalance();
  $('openBal').onclick = () => { buildBalancePanel(); $('balance').hidden = false; };
  $('balClose').onclick = () => { $('balance').hidden = true; };
  $('balBody').addEventListener('change', ev => {
    const t = ev.target; if (!t.dataset.bal) return;
    const [group, ...rest] = t.dataset.bal.split('.');
    const d = { species: {}, caps: {}, food: {}, water: {} };
    let v = Number(t.value); if (!Number.isFinite(v)) return;
    if (group === 'species') {
      const [k, ...pp] = rest, p = pp.join('.');
      if (t.dataset.i !== undefined) { const arr = [...getPath(SPECIES[k], p)]; arr[+t.dataset.i] = v; v = arr; }
      d.species[k] = { [p]: v };
    } else d[group][rest[0]] = v;
    applyBalance(d); saveBalance(); buildBalancePanel();
  });
  $('balReset').onclick = () => { if (confirm('所有數值重設回預設值？')) { resetBalance(); buildBalancePanel(); toast('已重設平衡數值'); } };
  $('balExport').onclick = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(balanceData(), null, 1)], { type: 'application/json' }));
    a.download = 'aquarium-balance.json'; a.click(); URL.revokeObjectURL(a.href);
  };
  $('balImport').onclick = () => $('balFile').click();
  $('balFile').onchange = async ev => {
    const f = ev.target.files[0]; if (!f) return;
    try { applyBalance(JSON.parse(await f.text())); saveBalance(); buildBalancePanel(); toast('已匯入平衡數值'); } catch { toast('檔案格式不正確'); }
    ev.target.value = '';
  };
}
