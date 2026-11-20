'use strict';
// =====================================================================
// species.js — 物種與造景參數（純資料，格式等同 JSON）
// 調平衡只改這裡；移植到其他引擎時可以直接轉成 .json 共用
//
// 欄位說明
//   len        身長（px，1x 時；18 px ≈ 1 cm）
//   scale      繪圖骨架的放大倍率（讓烏龜、青蛙、壁虎符合真實大小）
//   hungerTime 從飽到餓的秒數；huntBelow 飽食度低於這個值才主動獵食
//   growTime   幼體長到成體的秒數；birth 出生時的體型比例
//   breed      繁殖：how = live（直接生）/ spawn（水中產卵）/ eggs（陸地產蛋）
//              cool = 間隔秒數，count = 一次幾隻，hatch = 卵幾秒孵化
// =====================================================================

const SPECIES = {
  guppy: {
    name: '孔雀魚', kind: 'fish', len: 64, speed: 34, dash: 140, sight: 170, hungerTime: 900, huntBelow: 80, hit: 30,
    growTime: 180, birth: .3, breed: { how: 'live', cool: [90, 150], count: [3, 6] },
    sexed: true, femaleScale: 1.35, gestation: 90,   // 分公母；母魚較大；懷孕 90 秒後生產（真實約 21～35 天）
    look: { shape: 'guppy', body: ['#5f7f99', '#b4c9d8', '#f2f6f8'], tail: ['#ffc04d', '#f2702e', '#d93a36'], tailType: 'fan',
            fin: 'rgba(245,140,60,.85)', hScale: 1, spots: true },
  },
  neon: {
    name: '紅蓮燈', kind: 'fish', len: 60, speed: 40, dash: 150, sight: 150, hungerTime: 800, huntBelow: 80, hit: 24, school: true,
    growTime: 160, birth: .3, breed: { how: 'live', cool: [150, 240], count: [2, 5] },   // 實際是撒卵，這裡簡化
    // cardinal tetra（約 3.3 cm）：紅色從眼睛下方延伸到尾柄；藍綠色金屬條紋；脂鯉科有脂鰭
    look: { shape: 'tetra', redFull: true, body: ['#4a5560', '#b9c6cf', '#eef2f4'], tail: ['#d7e1e7', '#c4d0d8', '#aebcc6'], tailType: 'fork',
            fin: 'rgba(220,230,236,.55)', hScale: .72, stripe: '#2fd3ff', belly: '#ff3348' },
  },
  neontetra: {
    name: '日光燈', kind: 'fish', len: 50, speed: 40, dash: 150, sight: 140, hungerTime: 750, huntBelow: 80, hit: 21, school: true,
    growTime: 150, birth: .3, breed: { how: 'live', cool: [150, 240], count: [2, 5] },   // 實際是撒卵，這裡簡化
    // neon tetra（約 2.8 cm）：紅色只有後半段，前半腹部銀白；和紅蓮燈各自成群
    look: { shape: 'tetra', redFull: false, body: ['#4a5560', '#b9c6cf', '#eef2f4'], tail: ['#d7e1e7', '#c4d0d8', '#aebcc6'], tailType: 'fork',
            fin: 'rgba(220,230,236,.55)', hScale: .72, stripe: '#2fd3ff', belly: '#ff3348' },
  },
  cory: {
    // 鼠魚（Corydoras，約 5 cm）：身體兩側兩排骨板、口鬚 3 對、背鰭和胸鰭有硬棘；在缸底成群翻沙找食物，
    // 偶爾衝上水面吸一口空氣（腸呼吸），會「眨眼」（眼球往下轉）；把卵黏在玻璃或水草上
    name: '鼠魚', kind: 'fish', len: 95, speed: 22, dash: 110, sight: 160, hungerTime: 1400, huntBelow: 80, hit: 30,
    cory: true, school: true, morphs: 'cory',
    growTime: 200, birth: .3, breed: { how: 'stick', cool: [200, 320], count: [6, 12], hatch: 40 },
    look: { shape: 'cory', hScale: 1 },
  },
  redtail: {
    name: '紅尾黑鯊', kind: 'fish', len: 216, speed: 30, dash: 120, sight: 180, hungerTime: 1000, huntBelow: 75, hit: 34,
    growTime: 300, birth: .3, territorial: true, bottom: true, grazer: true,   // 地盤性、待在底層、會啃食藻類；水族缸內幾乎不繁殖
    look: { shape: 'shark', body: ['#121416', '#25282c', '#3b3f44'], tail: ['#f04a30', '#d8321f', '#b0261a'], tailType: 'fork',
            fin: '#1a1c1f', hScale: .82, dorsalTall: true },
  },
  // 翠鳥（普通翠鳥，約 16 cm）：停在水邊的石頭或樹枝上盯著水面，看準了頭朝下俯衝入水抓小魚，
  // 叼回原處把魚往石頭上甩幾下再整條吞下。公鳥嘴全黑、母鳥下嘴喙橘紅色
  kingfisher: { name: '翠鳥', kind: 'bird', len: 290, speed: 300, sight: 560, hungerTime: 1500, huntBelow: 88, hit: 30,
                dive: { depth: 160, success: .5, cool: [6, 14] }, sexed: true, femaleScale: 1 },
  // 六角恐龍（墨西哥鈍口螈，約 20 cm）：一輩子保持幼體的樣子（幼態延續），完全住在水裡；
  // 頭兩側各 3 根羽毛狀外鰓、寬扁的頭和「微笑」的嘴、從頭後到尾尖的鰭；伏擊型，張嘴把獵物吸進去
  axolotl: { name: '六角恐龍', kind: 'axolotl', len: 360, speed: 16, swim: 60, sight: 220, hungerTime: 2400, huntBelow: 80, hit: 26,
             morphs: 'axo', growTime: 600, birth: .12, breed: { how: 'stick', cool: [360, 520], count: [8, 16], hatch: 60 } },
  turtle: { name: '麝香龜', kind: 'turtle', len: 90, scale: 2, speed: 26, walk: 14, sight: 190, hungerTime: 1200, huntBelow: 60, hit: 22,
            growTime: 400, birth: .35, breed: { how: 'eggs', cool: [300, 420], count: [2, 3], hatch: 60 } },
  frog:   { name: '東方鈴蟾', kind: 'frog', len: 50, scale: 1.6, tongue: 150, sight: 150, hungerTime: 900, huntBelow: 80, hit: 17,
            growTime: 220, birth: .45, breed: { how: 'spawn', cool: [180, 280], count: [6, 10], hatch: 20 },
            unken: true, sink: 7, call: '咕～',                  // 有疣、受威脅時鈴蟾反射；沒有鳴囊，叫聲輕柔
            look: { warty: true, green: ['#4caa38', '#86c95a'], belly: '#e8572a', bellySpots: true, pupil: 'tri', legBands: true } },
  goldfrog: { name: '金線蛙', kind: 'frog', len: 50, scale: 2, tongue: 150, sight: 150, hungerTime: 900, huntBelow: 80, hit: 17,
            growTime: 240, birth: .4, breed: { how: 'spawn', cool: [200, 300], count: [8, 14], hatch: 20 },
            wary: true, sink: 10, call: '啾',                     // 皮膚光滑、機警，受威脅就跳進水裡；泡水時只露出頭；叫聲短促
            look: { warty: false, green: ['#4e9e36', '#8cc860'], belly: '#eee8cc', pupil: 'h', tympanum: true, goldBands: true, ranid: true } },
  tadpole: { name: '蝌蚪', kind: 'tadpole', len: 30, speed: 26, sight: 110, hungerTime: 600, huntBelow: 85, hit: 14,
             metaTime: 100 },                                       // 幾秒變成小青蛙
  gecko:  { name: '疣尾蝎虎', kind: 'gecko', len: 110, scale: 1.6, speed: 34, sight: 230, hungerTime: 900, huntBelow: 80, hit: 19,
            growTime: 260, birth: .4, breed: { how: 'eggs', cool: [240, 360], count: [2, 2], hatch: 50 } },
  whale:  { name: '迷你藍鯨', kind: 'whale', len: 1620, speed: 28, hungerTime: 1500, huntBelow: 95, hit: 0, mini: true,
            growTime: 600, birth: .3, breath: [40, 70] },          // 迷你版：約 90 cm，展示缸才放得下
  mosquito: { name: '蚊子', kind: 'mosquito', len: 14, speed: 70, hit: 14,
              life: [120, 180],        // 成蟲壽命（秒，死亡開啟時才會老死）
              firstEgg: [15, 30],      // 羽化後多久可以產卵
              eggCooldown: [40, 60] }, // 每次產卵的間隔
  larva: { name: '孑孓', kind: 'larva', len: 12, hit: 10,
           eggTime: 12,                // 卵塊幾秒後孵化
           raft: [4, 8],               // 一個卵塊孵出幾隻
           larvaTime: 45,              // 孑孓幾秒後化蛹
           pupaTime: 15,               // 蛹幾秒後羽化
           fear: 70,                   // 魚靠近多少距離會下潛逃跑
           escape: .55 },              // 正在下潛時，魚撲空的機率
  nest: { name: '卵', kind: 'nest', len: 12, hit: 14 },
  // 櫻花蝦（Neocaridina davidi）：母蝦較大、顏色較深、有卵鞍；母蝦蛻殼後公蝦狂游，交配後抱卵，孵出的直接是小蝦
  cherry: { name: '櫻花蝦', kind: 'shrimp', len: 40, speed: 12, hungerTime: 1800, huntBelow: 85, hit: 12,
            sexed: true, femaleScale: 1.2, morphs: 'shrimp', growTime: 240, birth: .25,
            gestation: 120, clutch: [6, 12], molt: [220, 360] },   // 抱卵 120 秒（真實約 3～4 週）
  // 斑馬螺（蜑螺）：在水中的地面、石頭上慢慢爬，吃藻類；淡水中產的卵不會孵化，所以不會繁殖失控
  nerite: { name: '斑馬螺', kind: 'snail', len: 36, speed: 5, hungerTime: 3000, huntBelow: 90, hit: 14 },             // 青蛙卵、烏龜蛋、壁虎蛋（共用）
  // 活餌：玩家投放，不繁殖；給青蛙、壁虎吃
  cricket: { name: '蟋蟀', kind: 'cricket', len: 30, hit: 12, life: [240, 360], drop: 5 },
  fly:     { name: '果蠅', kind: 'fly', len: 6, speed: 45, hit: 8, life: [90, 140], drop: 8 },
};

// 孔雀魚公魚的品系（尾鰭與身上金屬色斑）；小魚遺傳父母其中一方
const GUPPY_MORPHS = [
  { name: '火紅',   tail: ['#ffd36a', '#ff6a2a', '#d42a2a'], spot: 'rgba(70,10,10,.55)', patch: ['#ff8a3a', '#5ab8f5'] },
  { name: '藍草尾', tail: ['#b8ecff', '#4a9ae8', '#1f4fb8'], spot: 'rgba(10,15,40,.75)', patch: ['#5ab8f5', '#9fe8ff'] },
  { name: '黃金',   tail: ['#fff3b0', '#ffcf40', '#e8a020'], spot: 'rgba(90,60,10,.45)', patch: ['#ffe070', '#ffffff'] },
  { name: '眼鏡蛇', tail: ['#ffe08a', '#e8a03a', '#8a5a20'], spot: 'rgba(30,20,10,.8)',  patch: ['#c8a050', '#7fd0a0'], cobra: true },
  { name: '馬賽克', tail: ['#a8e0ff', '#3a6ad0', '#d8303e'], spot: 'rgba(20,20,60,.5)',  patch: ['#4a8ae8', '#ff7a3a'] },
];

// 櫻花蝦色級：普通（半透明帶紅斑）→ 櫻花 → 極火（全身鮮紅不透明）
// 鼠魚品系（熊貓鼠其實是另一個種，遊戲裡當成品系處理）
const CORY_MORPHS = [
  { name: '青銅鼠', body: ['#5e5236', '#9a8760', '#e6d2ae'], sheen: 'rgba(60,175,140,.5)', cheek: 'rgba(235,130,60,.4)', fin: 'rgba(225,205,170,.5)', eye: '#151515', ring: '#c9a860' },
  { name: '白子鼠', body: ['#d4ad98', '#efd2c0', '#fff3eb'], sheen: 'rgba(255,185,165,.4)', cheek: 'rgba(255,150,140,.3)', fin: 'rgba(255,238,228,.6)', eye: '#d42a3a', ring: '#f6c4bc' },
  { name: '熊貓鼠', body: ['#c9bba8', '#ece2d4', '#fffaf3'], sheen: 'rgba(255,220,195,.3)', cheek: 'rgba(255,170,150,.25)', fin: 'rgba(250,246,238,.6)', eye: '#151515', ring: '#ddd0b4', panda: true },
];
// 六角恐龍品系：身體色階（亮 → 暗）、外鰓、眼睛、斑點
const AXO_MORPHS = [
  { name: '粉紅（白化）', body: ['#fff2ee', '#f6dcd6', '#e6bab4', '#c99690'], gill: ['#ff8a9a', '#e04a64', '#a82a44'], eye: '#141418', ring: '#3a2a30' },
  { name: '野生型',       body: ['#a8a070', '#7a7448', '#5a5634', '#3c3a22'], gill: ['#a86a7a', '#7a3e52', '#4e2234'], eye: '#141414', ring: '#c8a848', spots: true },
  { name: '金色',         body: ['#fff0b8', '#f6d47a', '#e2b04c', '#b88a30'], gill: ['#ffb0a0', '#f07a6a', '#c04a44'], eye: '#d8506a', ring: '#f8c0b0' },
  { name: '黑色',         body: ['#5a5a66', '#3a3a44', '#26262e', '#16161c'], gill: ['#7a4a62', '#54304a', '#36203a'], eye: '#0a0a0e', ring: '#2a2a32' },
];
const SHRIMP_GRADES = [
  { name: '普通', color: '#e04a3a', opacity: .55, speckle: true },
  { name: '櫻花', color: '#e8302a', opacity: .8,  speckle: true },
  { name: '極火', color: '#d81e1e', opacity: .97, speckle: false },
];

// 族群上限（以標準缸為準，大缸依面積放大）
const CAPS = { axolotl: 4, bird: 2, mosquito: 30, larva: 80, fish: 20, frog: 6, tadpole: 30, turtle: 3, gecko: 4, shrimp: 20 };

const DECOR_TYPES = {
  rock:    { name: '石頭',   w: 150, h: 80,  solid: true },
  boulder: { name: '大岩石', w: 230, h: 400, solid: true },
  mound:   { name: '土坡',   w: 440, h: 400, solid: true },
  wood:    { name: '漂流木', w: 250, h: 20,  solid: true },
  branch:  { name: '樹枝',   w: 380, h: 11,  solid: true },     // 從側面伸進缸內的樹枝（給翠鳥停）；放在哪個高度就停在那裡
  plant:   { name: '水草',   w: 60,  h: 180, solid: false },
  bubbler: { name: '氣泡石', w: 36,  h: 14,  solid: false },
  filter:  { name: '過濾器', w: 46,  h: 90,  solid: false },   // 掛在水面附近，持續清除髒污
  floater: { name: '浮萍',   w: 140, h: 10,  solid: false },   // 浮在水面：吸收養分、遮光，抑制藻類
  fern:    { name: '蕨類',   w: 90,  h: 90,  solid: false },   // 陸生植物，種在土坡或岩石上
  carpet:  { name: '前景草', w: 220, h: 26,  solid: false },   // 沿著缸底長成一片草地，也會吸收髒污
};

// 吃到能恢復多少飽食度
// 水質與藻類（髒污、藻類都是 0～100）
const WATER = {
  wastePerCm: .0003,   // 每公分水中生物身長，每秒產生的髒污（以 80 公升為準，大缸會稀釋）
  turtleMess: 2.5,     // 烏龜特別髒
  foodRot: .006,        // 每顆落底超過 20 秒的飼料，每秒產生的髒污
  bodyRot: .05,        // 每具屍體每秒產生的髒污
  plantClean: .002,    // 每株水草每秒清除
  floaterClean: .005,   // 每片浮萍每秒清除
  filterClean: .02,    // 每台過濾器每秒清除
  algaeGrow: .05,      // 藻類生長速度（再乘上光照、養分、水草競爭）
  harmAt: 60,          // 髒污超過這個值，魚開始生病
  deadlyAt: 85,        // 超過這個值，生病得更快
};

const FOOD_VALUE = { shrimp: 8, food: 10, mosquito: 15, fish: 40, larva: 6, tadpole: 12, cricket: 25, fly: 6 };

// 捕食規則：每一條都可以在設定面板單獨開關
//   juvenileOnly：只吃幼體（大魚吃魚苗）
const RULES = [
  { id: 'frog_mosquito',  pred: 'frog',    prey: 'mosquito', label: '蛙類吃蚊子' },
  { id: 'gecko_mosquito', pred: 'gecko',   prey: 'mosquito', label: '壁虎吃蚊子' },
  { id: 'fish_mosquito',  pred: 'fish',    prey: 'mosquito', label: '魚吃水面的蚊子' },
  { id: 'fish_larva',     pred: 'fish',    prey: 'larva',    label: '魚吃孑孓和蛹' },
  { id: 'fish_tadpole',   pred: 'fish',    prey: 'tadpole',  label: '魚吃小蝌蚪' },
  { id: 'fish_fry',       pred: 'fish',    prey: 'fish',     label: '大魚吃魚苗', juvenileOnly: true },
  { id: 'turtle_fish',    pred: 'turtle',  prey: 'fish',     label: '烏龜吃小魚' },
  { id: 'turtle_tadpole', pred: 'turtle',  prey: 'tadpole',  label: '烏龜吃蝌蚪' },
  { id: 'axo_fish',       pred: 'axolotl', prey: 'fish',     label: '六角恐龍吸食小魚' },
  { id: 'axo_shrimp',     pred: 'axolotl', prey: 'shrimp',   label: '六角恐龍吃蝦' },
  { id: 'axo_larva',      pred: 'axolotl', prey: 'larva',    label: '六角恐龍吃孑孓' },
  { id: 'axo_tadpole',    pred: 'axolotl', prey: 'tadpole',  label: '六角恐龍吃蝌蚪' },
  { id: 'axo_food',       pred: 'axolotl', prey: 'food',     label: '六角恐龍吃飼料' },
  { id: 'axo_young',      pred: 'axolotl', prey: 'axolotl',  label: '六角恐龍吃自己的幼體', juvenileOnly: true },
  { id: 'bird_fish',      pred: 'bird',    prey: 'fish',     label: '翠鳥俯衝抓小魚' },
  { id: 'bird_shrimp',    pred: 'bird',    prey: 'shrimp',   label: '翠鳥抓蝦' },
  { id: 'bird_tadpole',   pred: 'bird',    prey: 'tadpole',  label: '翠鳥抓蝌蚪' },
  { id: 'whale_larva',    pred: 'whale',   prey: 'larva',    label: '藍鯨濾食孑孓' },
  { id: 'whale_food',     pred: 'whale',   prey: 'food',     label: '藍鯨濾食飼料' },
  { id: 'frog_cricket',   pred: 'frog',    prey: 'cricket',  label: '蛙類吃蟋蟀' },
  { id: 'gecko_cricket',  pred: 'gecko',   prey: 'cricket',  label: '壁虎吃蟋蟀' },
  { id: 'frog_fly',       pred: 'frog',    prey: 'fly',      label: '蛙類吃果蠅' },
  { id: 'gecko_fly',      pred: 'gecko',   prey: 'fly',      label: '壁虎吃果蠅' },
  { id: 'fish_cricket',   pred: 'fish',    prey: 'cricket',  label: '魚吃落水的蟋蟀' },
  { id: 'turtle_cricket', pred: 'turtle',  prey: 'cricket',  label: '烏龜吃落水的蟋蟀' },
  { id: 'fish_food',      pred: 'fish',    prey: 'food',     label: '魚吃飼料' },
  { id: 'turtle_food',    pred: 'turtle',  prey: 'food',     label: '烏龜吃飼料' },
  { id: 'tadpole_food',   pred: 'tadpole', prey: 'food',     label: '蝌蚪吃飼料' },
  { id: 'snail_food',     pred: 'snail',   prey: 'food',     label: '螺吃落底的飼料' },
  { id: 'shrimp_food',    pred: 'shrimp',  prey: 'food',     label: '蝦吃飼料' },
  { id: 'fish_shrimp',    pred: 'fish',    prey: 'shrimp',   label: '魚吃小蝦', juvenileOnly: true },
  { id: 'turtle_shrimp',  pred: 'turtle',  prey: 'shrimp',   label: '烏龜吃蝦' },
];

// 從缸外飛進來的蚊子：[每隻間隔秒數, 缸內成蟲少於幾隻才會飛進來]
// （M2 起蚊子會自己繁殖，這只是補充來源）
const MOSQ_RATE = { off: [0, 0], low: [20, 4], mid: [10, 8], high: [4, 16] };
