'use strict';
// =====================================================================
// voxfish.js — 立體（體素）魚：每一幀依姿勢產生一隻有厚度的魚（x 頭尾、y 上下、z 左右）
// 給「像素堆疊測試」「立體魚缸 DEMO」共用；需要 core.js（clamp）、species.js（GUPPY_MORPHS）
// =====================================================================
const VOXFISH = { light: true };
const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const RAMPS = [];                                                    // 每種材質一組色階（亮 → 暗）
const ramp = cols => { RAMPS.push(cols.map(hex)); return RAMPS.length - 1; };
const MAT = {
  guppyBody: ramp(['#f2f8fb', '#c8d8e4', '#9cb2c4', '#6e8aa2', '#465e74']),
  fin: ramp(['#eef4f8', '#d6e2ea', '#b8c8d4', '#94a8b8', '#708898']),
  pec: ramp(['#e6f6ff', '#bfe2f4', '#94c4e0', '#6c9ec0', '#4c7ca0']),   // 胸鰭（淡藍、半透明感）
  eye: ramp(['#3a3a40', '#141418', '#0c0c10', '#060608', '#000000']),
  eyeHi: ramp(['#ffffff', '#ffffff', '#ffffff', '#f0f0f0', '#e0e0e0']),
  silver: ramp(['#f6fafc', '#d4dde3', '#a8b6c0', '#788894', '#4a5864']),
  red: ramp(['#ff96a4', '#ff4a5e', '#e02a40', '#b01c30', '#7a1222']),
  blue: ramp(['#d6fcff', '#58e2ff', '#22a8dc', '#1474a8', '#0c4a74']),
};
let TAIL = [], PATCH = [];
function setMorph(m) {                                               // 孔雀魚品系的尾巴顏色
  RAMPS.length = 7;
  const M = GUPPY_MORPHS[m];
  TAIL = [ramp([mixHex(M.tail[0], '#ffffff', .3), M.tail[0], M.tail[1], M.tail[2], mixHex(M.tail[2], '#000000', .4)]),
          ramp([M.tail[0], M.tail[1], M.tail[2], mixHex(M.tail[2], '#000000', .3), mixHex(M.tail[2], '#000000', .55)])];
  PATCH = [ramp([mixHex(M.patch[0], '#ffffff', .3), M.patch[0], mixHex(M.patch[0], '#000000', .2), mixHex(M.patch[0], '#000000', .4), mixHex(M.patch[0], '#000000', .6)]),
           ramp([mixHex(M.patch[1], '#ffffff', .3), M.patch[1], mixHex(M.patch[1], '#000000', .2), mixHex(M.patch[1], '#000000', .4), mixHex(M.patch[1], '#000000', .6)])];
}
function mixHex(a, b, t) { const A = hex(a), B = hex(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); }
setMorph(0);

const GUPPY_TAIL = [[0, -3], [-14, -10], [-30, -22], [-40, -25], [-44, -12], [-45.5, 0], [-44, 12], [-40, 25], [-30, 22], [-14, 10], [0, 3]];
const FORK_TAIL = [[2, -3], [-10, -9], [-18, -14], [-14, -4], [-9, 0], [-14, 4], [-18, 14], [-10, 9], [2, 3]];
function inPoly(px, py, poly) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if (((yi > py) !== (yj > py)) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) c = !c; } return c; }

// 局部座標（和遊戲的魚一樣，身長約 64，頭在 +x）；y 往上為正
function fishShape(kind, phase, amp) {
  const guppy = kind === 'guppy', hs = guppy ? 1 : .72;
  const h = s => (2.5 + 13.5 * Math.pow(Math.max(0, Math.sin(Math.PI * Math.min(1, s * 1.05 + .1))), .75) * (1 - .6 * s)) * hs;   // 身體高（半）
  const w = s => h(s) * (guppy ? .42 : .48) + .6;                     // 身體寬（半）：魚是側扁的
  const zc = s => amp * 5 * s * s * Math.sin(phase - s * 2.2);        // 左右擺動（真實的魚是左右擺）
  const sOf = x => (32 - x) / 60;                                     // x → 身體位置（0 頭、1 尾柄）
  const tailYaw = amp * .55 * Math.cos(phase - 2.2);
  // 胸鰭：左右各一片，從鰓後方往後、往外伸出，左右交替划水
  const pecS = .2, pecLen = guppy ? 12 : 9, pecW = guppy ? 4 : 3.2;
  const pecs = [1, -1].map(side => {
    const flap = .7 + Math.sin(phase * .9 + (side > 0 ? 0 : Math.PI)) * .55;        // 張開的角度（左右交替）
    const base = [32 - pecS * 60, -h(pecS) * .05, zc(pecS) + side * w(pecS) * .9];   // 身體側面中間（從上面也看得到）
    const dir = [-Math.cos(flap), -.08, side * Math.sin(flap)], dl = Math.hypot(...dir), D = dir.map(v => v / dl);   // 鰭的方向（往後、往外）
    const up = [0, 1, 0], N = [D[1] * up[2] - D[2] * up[1], D[2] * up[0] - D[0] * up[2], D[0] * up[1] - D[1] * up[0]], nl = Math.hypot(...N) || 1;
    const Nn = N.map(v => v / nl), E = [Nn[1] * D[2] - Nn[2] * D[1], Nn[2] * D[0] - Nn[0] * D[2], Nn[0] * D[1] - Nn[1] * D[0]];   // E：鰭的寬度方向
    return { base, D, N: Nn, E };
  });
  const tail = guppy ? GUPPY_TAIL : FORK_TAIL;
  return {
    bounds: { x0: guppy ? -76 : -48, x1: 34, y0: -26, y1: 26, z0: -12, z1: 12 },
    // 這個點是什麼材質？回傳 [材質, 色階偏移, 法線]（或 null）
    sample(x, y, z, half) {
      const s = sOf(x);
      if (s >= 0 && s <= 1) {                                          // 身體：橢圓截面
        const H = h(s), Wd = w(s), dz = z - zc(s), e = (y / H) ** 2 + (dz / Wd) ** 2;
        if (e <= 1) {
          const n = [x > 26 ? (x - 26) / 6 : 0, y / (H * H), dz / (Wd * Wd)], nl = Math.hypot(...n) || 1;
          const N = n.map(v => v / nl);
          // 眼睛：頭部兩側
          const ex = x - 24.5, ey = y - 2.6 * hs, ez = Math.abs(dz) - (Wd - .6);
          if (ex * ex + ey * ey < (3.3 * hs + .6) ** 2 && ez > -1.2) return [ex * ex + ey * ey < 1.1 && ey > 0 ? MAT.eyeHi : MAT.eye, 0, N];
          if (guppy) {
            if (s > .48 && s < .82 && y > -.35 * H && y < .45 * H && Math.abs(dz) > Wd * .5) return [PATCH[0], 0, N];   // 公魚身上的彩斑
            if (Math.abs(s - .4) < .05 && Math.abs(y - .1 * H) < 2 && Math.abs(dz) > Wd * .5) return [PATCH[1], 0, N];
          } else {
            if (y < -.08 * H && y > -.92 * H && s > (kind === 'neon' ? .08 : .45) && s < .95) return [MAT.red, y < -.55 * H ? 1 : 0, N];   // 紅色（下半）
            if (y > .08 * H && y < .5 * H && s > .08 && s < .95 && Math.abs(dz) > Wd * .3) return [MAT.blue, 0, N];        // 金屬藍條紋
          }
          return [guppy ? MAT.guppyBody : MAT.silver, y > .45 * H ? 1 : y < -.4 * H ? -1 : 0, N];   // 背部暗、腹部亮
        }
        // 背鰭、臀鰭：薄片
        const fz = Math.abs(z - zc(s)) <= half;
        if (fz) {
          const top = h(s), dH = guppy ? 9 : 7;
          if (s > .3 && s < .6 && y > top && y < top + dH * (1 - Math.abs(s - .42) / .2)) return [guppy ? TAIL[0] : MAT.fin, 1, [0, 0, 1], true];
          if (s > .55 && s < .78 && y < -top && y > -top - 6 * (1 - Math.abs(s - .65) / .14)) return [guppy ? TAIL[0] : MAT.fin, 1, [0, 0, 1], true];
        }
      }
      for (const f of pecs) {                                           // 胸鰭：薄的半透明扇形
        const r = [x - f.base[0], y - f.base[1], z - f.base[2]];
        const u = r[0] * f.D[0] + r[1] * f.D[1] + r[2] * f.D[2], dn = r[0] * f.N[0] + r[1] * f.N[1] + r[2] * f.N[2], v = r[0] * f.E[0] + r[1] * f.E[1] + r[2] * f.E[2];
        if (u >= 0 && u <= pecLen && Math.abs(dn) <= half * 1.3 && Math.abs(v) <= pecW * Math.sqrt(Math.max(0, 1 - (u / pecLen) ** 2)) * (u < 1.5 ? .6 : 1))
          return [MAT.pec, u > pecLen * .75 || Math.abs(v) > pecW * .75 ? 2 : 0, f.N, true];   // 邊緣較深
      }
      if (s > 1) {                                                      // 尾鰭：薄片，跟著尾柄擺動
        const tx = x - (32 - 60), base = zc(1), tz = base + tailYaw * (-tx) * .7;
        if (Math.abs(z - tz) <= half * 1.2 && inPoly(tx, y, tail)) {
          const r = Math.hypot(tx, y) / (guppy ? 46 : 18);
          return [guppy ? (r > .72 ? TAIL[1] : TAIL[0]) : MAT.fin, guppy ? (r > .72 ? 1 : r < .4 ? -1 : 0) : 0, [0, 0, 1], true];
        }
      }
      return null;
    },
  };
}
// 產生體素：dens = 每單位幾格
function buildVoxels(kind, phase, amp, dens) {
  const sh = fishShape(kind, phase, amp), b = sh.bounds, half = .8 / dens;   // 鰭厚約 1.5 格（太薄轉起來會斷掉）
  const nx = Math.ceil((b.x1 - b.x0) * dens), ny = Math.ceil((b.y1 - b.y0) * dens), nz = Math.ceil((b.z1 - b.z0) * dens);
  const vox = [];
  for (let iy = 0; iy < ny; iy++) for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) {
    const x = b.x0 + (ix + .5) / dens, y = b.y0 + (iy + .5) / dens, z = b.z0 + (iz + .5) / dens;
    const r = sh.sample(x, y, z, half);
    if (r) vox.push({ ix: ix - (nx >> 1), iy: iy - (ny >> 1), iz: iz - (nz >> 1), m: r[0], off: r[1], n: r[2], two: !!r[3] });   // 整數格（查表才對得上）
  }
  return { vox, nx, ny, nz };
}

// =====================================================================
// 2. 上色：依表面朝向算亮暗（燈從左上前方來）
// =====================================================================
const LIGHT = (() => { const v = [-.45, .75, .5], l = Math.hypot(...v); return v.map(c => c / l); })();
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + .5) / 16);
function shadeColor(v, nWorld, px, py) {
  const R = RAMPS[v.m];
  if (!VOXFISH.light) return R[clamp(1 + v.off, 0, 4)];               // 平塗
  let d = nWorld[0] * LIGHT[0] + nWorld[1] * LIGHT[1] + nWorld[2] * LIGHT[2];
  if (v.two) d = Math.abs(d) * .8 + .15;                              // 薄的鰭：兩面一樣亮（不然轉的時候會出現條紋）
  const t = (1 - d) * 1.6 + .4 + v.off + (v.two ? 0 : (BAYER[(py & 3) * 4 + (px & 3)] - .5) * .5);   // 鰭不抖色
  return R[clamp(Math.floor(t), 0, 4)];
}
// 外框：整隻畫完再加一次（文章提到：每片各自加外框會有雜點）
function outline(img, w, h) {
  const src = img.slice();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x; if (src[i]) continue;
    let nb = 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < w && yy < h && src[yy * w + xx]) { nb = src[yy * w + xx]; break; } }
    if (nb) img[i] = ((255 << 24) | ((((nb >> 16) & 255) * .35) << 16) | ((((nb >> 8) & 255) * .35) << 8) | ((nb & 255) * .35)) >>> 0;
  }
}
const pack = c => ((255 << 24) | (c[2] << 16) | (c[1] << 8) | c[0]) >>> 0;

