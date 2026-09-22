import * as THREE from 'three';

// Think twice before touching this one line could arise many problems
const TEX_CACHE = {};
const MATS = {};

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// ---------- NOISE HELPERS ----------
// Tiny value-noise for displacement and bump. Not fancy, works.
function noise2D(x, y, seed) {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed * 37.719) * 43758.5453;
  return n - Math.floor(n);
}

function smoothNoise(x, y, seed) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = noise2D(xi, yi, seed);
  const b = noise2D(xi + 1, yi, seed);
  const c = noise2D(xi, yi + 1, seed);
  const d = noise2D(xi + 1, yi + 1, seed);
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}

// ---------- GENERATED TEXTURES ----------

function getMLITexture() {
  if (TEX_CACHE.mli) return TEX_CACHE.mli;
  const c = makeCanvas(512, 512);
  const ctx = c.getContext('2d');

  // gold base
  const bg = ctx.createLinearGradient(0, 0, 512, 512);
  bg.addColorStop(0, '#d9a840');
  bg.addColorStop(0.5, '#c99a3a');
  bg.addColorStop(1, '#e8b84a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 512, 512);

  // wrinkles — random arcs and strokes
  for (let i = 0; i < 600; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const len = 20 + Math.random() * 100;
    const ang = Math.random() * Math.PI * 2;
    const bright = Math.random();
    const col = bright > 0.5
      ? `rgba(${230 + Math.random() * 25}, ${190 + Math.random() * 40}, ${90 + Math.random() * 60}, ${0.2 + Math.random() * 0.35})`
      : `rgba(${140 + Math.random() * 40}, ${100 + Math.random() * 40}, ${30 + Math.random() * 40}, ${0.15 + Math.random() * 0.35})`;
    ctx.strokeStyle = col;
    ctx.lineWidth = 0.8 + Math.random() * 2.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(
      x + Math.cos(ang) * len * 0.5 + (Math.random() - 0.5) * 20,
      y + Math.sin(ang) * len * 0.5 + (Math.random() - 0.5) * 20,
      x + Math.cos(ang) * len,
      y + Math.sin(ang) * len
    );
    ctx.stroke();
  }

  // bright glints — makes it sparkle
  for (let i = 0; i < 80; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const r = 8 + Math.random() * 50;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255, 250, 220, ${0.4 + Math.random() * 0.4})`);
    g.addColorStop(1, 'rgba(255, 250, 220, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  TEX_CACHE.mli = tex;
  return tex;
}

// Bump map for MLI wrinkles
function getMLIBump() {
  if (TEX_CACHE.mliBump) return TEX_CACHE.mliBump;
  const c = makeCanvas(512, 512);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 600; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const len = 20 + Math.random() * 100;
    const ang = Math.random() * Math.PI * 2;
    const shade = Math.random() > 0.5 ? 220 : 60;
    ctx.strokeStyle = `rgba(${shade}, ${shade}, ${shade}, ${0.3 + Math.random() * 0.5})`;
    ctx.lineWidth = 1 + Math.random() * 3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  TEX_CACHE.mliBump = tex;
  return tex;
}

function getCarbonTexture() {
  if (TEX_CACHE.carbon) return TEX_CACHE.carbon;
  const c = makeCanvas(512, 512);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#0e0e12';
  ctx.fillRect(0, 0, 512, 512);

  const size = 16;
  for (let y = 0; y < 512; y += size) {
    for (let x = 0; x < 512; x += size) {
      const offset = (y / size) % 2 === 0 ? 0 : size / 2;
      const shade = ((x + y) / size) % 2 === 0 ? '#1c1c22' : '#141418';
      ctx.fillStyle = shade;
      ctx.fillRect(x + offset, y, size / 2 - 1, size - 1);
      // highlight the top edge of each cell
      ctx.fillStyle = 'rgba(120, 120, 150, 0.25)';
      ctx.fillRect(x + offset, y, size / 2 - 1, 1);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(x + offset, y + size - 1, size / 2 - 1, 1);
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  TEX_CACHE.carbon = tex;
  return tex;
}

// Panel texture. Now with warning decals baked in.
function getPanelTexture() {
  if (TEX_CACHE.panel) return TEX_CACHE.panel;
  const c = makeCanvas(1024, 1024);
  const ctx = c.getContext('2d');

  // Base aluminum with subtle mottling
  const base = ctx.createLinearGradient(0, 0, 1024, 1024);
  base.addColorStop(0, '#b8b8c0');
  base.addColorStop(0.5, '#a0a0aa');
  base.addColorStop(1, '#c0c0c8');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 1024, 1024);

  // Random noise
  for (let i = 0; i < 20000; i++) {
    const v = Math.random();
    ctx.fillStyle = `rgba(${150 + v * 60}, ${150 + v * 60}, ${160 + v * 60}, 0.08)`;
    ctx.fillRect(Math.random() * 1024, Math.random() * 1024, 1.5, 1.5);
  }

  // Panel lines — 128px grid
  ctx.strokeStyle = 'rgba(50, 50, 60, 0.85)';
  ctx.lineWidth = 2.5;
  for (let i = 128; i < 1024; i += 128) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 1024); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(1024, i); ctx.stroke();
  }

  // Thin secondary lines
  ctx.strokeStyle = 'rgba(60, 60, 70, 0.4)';
  ctx.lineWidth = 1;
  for (let i = 64; i < 1024; i += 128) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 1024); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(1024, i); ctx.stroke();
  }

  // Bolts at panel line intersections
  for (let x = 128; x < 1024; x += 128) {
    for (let y = 128; y < 1024; y += 128) {
      // Bolt shadow
      ctx.fillStyle = '#3a3a42';
      ctx.beginPath(); ctx.arc(x + 1.5, y + 1.5, 3, 0, Math.PI * 2); ctx.fill();
      // Bolt head
      ctx.fillStyle = '#c8c8d0';
      ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
      // Highlight
      ctx.fillStyle = '#e8e8ec';
      ctx.beginPath(); ctx.arc(x - 0.8, y - 0.8, 1.2, 0, Math.PI * 2); ctx.fill();
    }
  }

  // Warning decals — rotated text
  ctx.save();
  ctx.translate(256, 384);
  ctx.rotate(-Math.PI / 2);
  ctx.font = 'bold 18px monospace';
  ctx.fillStyle = 'rgba(200, 60, 40, 0.9)';
  ctx.fillText('CAUTION — PRESSURIZED', 0, 0);
  ctx.restore();

  ctx.save();
  ctx.translate(768, 640);
  ctx.font = 'bold 14px monospace';
  ctx.fillStyle = 'rgba(40, 40, 40, 0.85)';
  ctx.fillText('S/N 0451-88-AA', 0, 0);
  ctx.fillText('MFG 2036-11', 0, 18);
  ctx.restore();

  // Small arrow decal
  ctx.save();
  ctx.translate(896, 128);
  ctx.fillStyle = 'rgba(220, 180, 40, 0.85)';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(20, 10);
  ctx.lineTo(12, 10);
  ctx.lineTo(12, 24);
  ctx.lineTo(-12, 24);
  ctx.lineTo(-12, 10);
  ctx.lineTo(-20, 10);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  TEX_CACHE.panel = tex;
  return tex;
}

// Bump map so bolts and panel lines actually catch light
function getPanelBump() {
  if (TEX_CACHE.panelBump) return TEX_CACHE.panelBump;
  const c = makeCanvas(1024, 1024);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 1024, 1024);

  // Panel lines are dark = recessed
  ctx.strokeStyle = '#303030';
  ctx.lineWidth = 3;
  for (let i = 128; i < 1024; i += 128) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 1024); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(1024, i); ctx.stroke();
  }

  // Bolts raised
  for (let x = 128; x < 1024; x += 128) {
    for (let y = 128; y < 1024; y += 128) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, 4);
      g.addColorStop(0, '#f0f0f0');
      g.addColorStop(0.5, '#c0c0c0');
      g.addColorStop(1, '#808080');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  TEX_CACHE.panelBump = tex;
  return tex;
}

// Foam insulation — bumpy, for tanks that use it
function getFoamTexture() {
  if (TEX_CACHE.foam) return TEX_CACHE.foam;
  const c = makeCanvas(512, 512);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#d9a35a';
  ctx.fillRect(0, 0, 512, 512);

  // Bumpy foam spray pattern
  for (let i = 0; i < 4000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const r = 2 + Math.random() * 8;
    const v = Math.random();
    ctx.fillStyle = `rgba(${200 + v * 55}, ${140 + v * 60}, ${60 + v * 40}, 0.3)`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  TEX_CACHE.foam = tex;
  return tex;
}

function getFoamBump() {
  if (TEX_CACHE.foamBump) return TEX_CACHE.foamBump;
  const c = makeCanvas(512, 512);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 5000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const r = 2 + Math.random() * 10;
    const v = Math.random();
    const shade = v > 0.5 ? 220 : 60;
    ctx.fillStyle = `rgba(${shade}, ${shade}, ${shade}, 0.4)`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  TEX_CACHE.foamBump = tex;
  return tex;
}

// Heat stain — vertical gradient from clean to scorched
function getHeatStainTexture() {
  if (TEX_CACHE.heat) return TEX_CACHE.heat;
  const c = makeCanvas(256, 512);
  const ctx = c.getContext('2d');

  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0.0, 'rgba(0, 0, 0, 0)');
  g.addColorStop(0.4, 'rgba(30, 20, 15, 0.2)');
  g.addColorStop(0.7, 'rgba(60, 35, 20, 0.5)');
  g.addColorStop(0.9, 'rgba(40, 30, 60, 0.6)'); // blue tint from extreme heat
  g.addColorStop(1.0, 'rgba(20, 15, 30, 0.7)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 512);

  // Random heat streaks
  for (let i = 0; i < 100; i++) {
    const x = Math.random() * 256;
    const y = 200 + Math.random() * 300;
    const w = 2 + Math.random() * 20;
    const h = 20 + Math.random() * 100;
    const gg = ctx.createLinearGradient(x, y, x, y + h);
    gg.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gg.addColorStop(0.5, `rgba(60, 40, 25, ${0.2 + Math.random() * 0.3})`);
    gg.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = gg;
    ctx.fillRect(x, y, w, h);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  TEX_CACHE.heat = tex;
  return tex;
}

function getDirtTexture() {
  if (TEX_CACHE.dirt) return TEX_CACHE.dirt;
  const c = makeCanvas(512, 512);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#00000000';
  ctx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 150; i++) {
    const x = Math.random() * 512;
    const w = 2 + Math.random() * 25;
    const h = 20 + Math.random() * 300;
    const y = Math.random() * 512;
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, 'rgba(40, 30, 20, 0)');
    g.addColorStop(0.4, `rgba(40, 30, 20, ${0.15 + Math.random() * 0.3})`);
    g.addColorStop(1, 'rgba(40, 30, 20, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
  }

  for (let i = 0; i < 1200; i++) {
    ctx.fillStyle = `rgba(30, 25, 20, ${Math.random() * 0.35})`;
    ctx.fillRect(Math.random() * 512, Math.random() * 512, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  TEX_CACHE.dirt = tex;
  return tex;
}

function getScorchTexture() {
  if (TEX_CACHE.scorch) return TEX_CACHE.scorch;
  const c = makeCanvas(256, 256);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 60; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const r = 10 + Math.random() * 80;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(0, 0, 0, ${0.5 + Math.random() * 0.5})`);
    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  TEX_CACHE.scorch = tex;
  return tex;
}

let SOLAR_TEX = null;
function getSolarTexture() {
  if (SOLAR_TEX) return SOLAR_TEX;
  const c = makeCanvas(1024, 1024);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#050a20';
  ctx.fillRect(0, 0, 1024, 1024);

  const cols = 32, rows = 32;
  const cw = 1024 / cols, ch = 1024 / rows;
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const shade = (r + col) % 2 === 0 ? '#0a1650' : '#071238';
      ctx.fillStyle = shade;
      ctx.fillRect(col * cw + 1, r * ch + 1, cw - 2, ch - 2);
      // Tiny highlight along the top of each cell
      ctx.fillStyle = 'rgba(80, 140, 220, 0.35)';
      ctx.fillRect(col * cw + 2, r * ch + 2, cw - 4, 1);
      // Busbar lines — thin bright strips
      ctx.fillStyle = 'rgba(160, 180, 210, 0.5)';
      ctx.fillRect(col * cw + cw * 0.45, r * ch + 2, cw * 0.1, ch - 4);
    }
  }

  // Grid lines between cells
  ctx.strokeStyle = '#1a2a5a';
  ctx.lineWidth = 1.2;
  for (let i = 0; i <= cols; i++) {
    ctx.beginPath(); ctx.moveTo(i * cw, 0); ctx.lineTo(i * cw, 1024); ctx.stroke();
  }
  for (let i = 0; i <= rows; i++) {
    ctx.beginPath(); ctx.moveTo(0, i * ch); ctx.lineTo(1024, i * ch); ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  SOLAR_TEX = tex;
  return tex;
}

// ---------- MATERIALS ----------

MATS.metalLight = new THREE.MeshStandardMaterial({
  color: 0xdedee6,
  metalness: 0.92,
  roughness: 0.28,
  map: getPanelTexture(),
  bumpMap: getPanelBump(),
  bumpScale: 0.008,
});

MATS.metalMid = new THREE.MeshStandardMaterial({
  color: 0x9a9aa4,
  metalness: 0.94,
  roughness: 0.32,
});

MATS.metalDark = new THREE.MeshStandardMaterial({
  color: 0x2c2c38,
  metalness: 0.94,
  roughness: 0.26,
});

MATS.metalBlack = new THREE.MeshStandardMaterial({
  color: 0x141418,
  metalness: 0.96,
  roughness: 0.18,
});

MATS.engineBell = new THREE.MeshStandardMaterial({
  color: 0x181820,
  metalness: 0.96,
  roughness: 0.18,
  side: THREE.DoubleSide,
  map: getHeatStainTexture(),
});

MATS.engineBellHot = new THREE.MeshStandardMaterial({
  color: 0x0e0e14,
  metalness: 0.98,
  roughness: 0.12,
  side: THREE.DoubleSide,
  emissive: 0x140804,
  emissiveIntensity: 0.5,
});

MATS.copper = new THREE.MeshStandardMaterial({
  color: 0xc77a33,
  metalness: 0.96,
  roughness: 0.22,
});

MATS.copperDark = new THREE.MeshStandardMaterial({
  color: 0x8a5522,
  metalness: 0.94,
  roughness: 0.34,
});

MATS.copperHot = new THREE.MeshStandardMaterial({
  color: 0xd88540,
  metalness: 0.96,
  roughness: 0.2,
  emissive: 0x2a0e04,
  emissiveIntensity: 0.4,
});

MATS.gold = new THREE.MeshStandardMaterial({
  color: 0xffc23a,
  metalness: 0.72,
  roughness: 0.28,
});

MATS.lox = new THREE.MeshStandardMaterial({
  color: 0x4dc4ff,
  metalness: 0.7,
  roughness: 0.32,
});

MATS.loxFrost = new THREE.MeshStandardMaterial({
  color: 0xd8ecf8,
  metalness: 0.5,
  roughness: 0.7,
  transparent: true,
  opacity: 0.45,
});

MATS.methane = new THREE.MeshStandardMaterial({
  color: 0xb0e0f5,
  metalness: 0.72,
  roughness: 0.3,
});

MATS.storable = new THREE.MeshStandardMaterial({
  color: 0xc0b09a,
  metalness: 0.78,
  roughness: 0.32,
});

MATS.silver = new THREE.MeshStandardMaterial({
  color: 0xd0d0dc,
  metalness: 0.96,
  roughness: 0.1,
});

MATS.solarFrame = new THREE.MeshStandardMaterial({
  color: 0x9a9aa4,
  metalness: 0.88,
  roughness: 0.26,
});

MATS.panelBlue = new THREE.MeshStandardMaterial({
  color: 0x2472ff,
  metalness: 0.72,
  roughness: 0.34,
});

MATS.payload = new THREE.MeshStandardMaterial({
  color: 0xff5522,
  metalness: 0.65,
  roughness: 0.4,
});

MATS.payloadHi = new THREE.MeshStandardMaterial({
  color: 0xff6633,
  metalness: 0.72,
  roughness: 0.32,
});

MATS.nose = new THREE.MeshStandardMaterial({
  color: 0xe8e4dc,
  metalness: 0.55,
  roughness: 0.5,
  emissive: 0x1a1408,
  emissiveIntensity: 0.08,
});

MATS.noseAblative = new THREE.MeshStandardMaterial({
  color: 0x3a2a24,
  metalness: 0.15,
  roughness: 0.94,
  bumpMap: getFoamBump(),
  bumpScale: 0.015,
});

MATS.yellow = new THREE.MeshStandardMaterial({
  color: 0xffd23a,
  metalness: 0.7,
  roughness: 0.35,
});

MATS.red = new THREE.MeshStandardMaterial({
  color: 0xd94435,
  metalness: 0.6,
  roughness: 0.45,
});

MATS.kapton = new THREE.MeshStandardMaterial({
  color: 0xffaa55,
  metalness: 0.86,
  roughness: 0.42,
  side: THREE.DoubleSide,
});

MATS.glass = new THREE.MeshStandardMaterial({
  color: 0x2244aa,
  metalness: 0.95,
  roughness: 0.03,
  emissive: 0x3355aa,
  emissiveIntensity: 1.8,
});

MATS.thermalPad = new THREE.MeshStandardMaterial({
  color: 0x101014,
  metalness: 0.2,
  roughness: 0.96,
});

MATS.mli = new THREE.MeshStandardMaterial({
  map: getMLITexture(),
  bumpMap: getMLIBump(),
  bumpScale: 0.012,
  color: 0xffffff,
  metalness: 0.88,
  roughness: 0.32,
});

MATS.carbon = new THREE.MeshStandardMaterial({
  map: getCarbonTexture(),
  color: 0xffffff,
  metalness: 0.6,
  roughness: 0.42,
});

MATS.panelAlum = new THREE.MeshStandardMaterial({
  map: getPanelTexture(),
  bumpMap: getPanelBump(),
  bumpScale: 0.008,
  color: 0xd8d4cc,
  metalness: 0.78,
  roughness: 0.4,
});

MATS.foam = new THREE.MeshStandardMaterial({
  map: getFoamTexture(),
  bumpMap: getFoamBump(),
  bumpScale: 0.015,
  metalness: 0.3,
  roughness: 0.85,
});

MATS.lensGlass = new THREE.MeshStandardMaterial({
  color: 0x0a0a2a,
  metalness: 1.0,
  roughness: 0.02,
  emissive: 0x3366cc,
  emissiveIntensity: 2.5,
});

MATS.lensFront = new THREE.MeshStandardMaterial({
  color: 0x4455aa,
  metalness: 1.0,
  roughness: 0.05,
  emissive: 0x6688ff,
  emissiveIntensity: 1.5,
});

MATS.dishWhite = new THREE.MeshStandardMaterial({
  color: 0xf0f0f4,
  metalness: 0.4,
  roughness: 0.55,
  side: THREE.DoubleSide,
});

MATS.dishGold = new THREE.MeshStandardMaterial({
  color: 0xffcc44,
  metalness: 0.92,
  roughness: 0.14,
  side: THREE.DoubleSide,
});

MATS.anodizedRed = new THREE.MeshStandardMaterial({
  color: 0x8a2a20,
  metalness: 0.75,
  roughness: 0.35,
});

MATS.anodizedBlue = new THREE.MeshStandardMaterial({
  color: 0x1a3a6a,
  metalness: 0.75,
  roughness: 0.35,
});

MATS.anodizedGreen = new THREE.MeshStandardMaterial({
  color: 0x2a5a3a,
  metalness: 0.7,
  roughness: 0.4,
});

// ---------- HELPERS ----------

function addMesh(g, geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  g.add(m);
  return m;
}

function addTube(g, pts, mat, r = 0.03) {
  const curve = new THREE.CatmullRomCurve3(pts);
  const geo = new THREE.TubeGeometry(curve, 32, r, 10, false);
  g.add(new THREE.Mesh(geo, mat));
}

function addBoltRing(g, count, radius, y, size = 0.03, mat = MATS.metalDark) {
  const geo = new THREE.CylinderGeometry(size, size * 0.85, size * 1.2, 8);
  const inst = new THREE.InstancedMesh(geo, mat, count);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    dummy.position.set(Math.cos(a) * radius, y, Math.sin(a) * radius);
    dummy.rotation.x = Math.PI / 2;
    dummy.updateMatrix();
    inst.setMatrixAt(i, dummy.matrix);
  }
  inst.instanceMatrix.needsUpdate = true;
  g.add(inst);
}

function addRivetRing(g, count, radius, y, size = 0.008, mat = MATS.metalMid) {
  const geo = new THREE.SphereGeometry(size, 6, 4);
  const inst = new THREE.InstancedMesh(geo, mat, count);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    dummy.position.set(Math.cos(a) * radius, y, Math.sin(a) * radius);
    dummy.updateMatrix();
    inst.setMatrixAt(i, dummy.matrix);
  }
  inst.instanceMatrix.needsUpdate = true;
  g.add(inst);
}

function addPanelLine(g, x1, y1, x2, y2, z, mat = MATS.metalBlack, t = 0.008) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  const line = new THREE.Mesh(new THREE.BoxGeometry(len, t, t), mat);
  line.position.set((x1 + x2) / 2, (y1 + y2) / 2, z);
  line.rotation.z = Math.atan2(dy, dx);
  g.add(line);
}
// Raceway — the black conduit that runs the length of every real rocket.
// Houses all the wiring and propellant lines between stages.
function makeRaceway(height, rocketDiameter, faceAngle) {
  const g = new THREE.Group();

  const raceW = 0.16;
  const raceD = 0.12;
  const tubeGeo = new THREE.BoxGeometry(raceW, height, raceD);
  const tube = new THREE.Mesh(tubeGeo, MATS.metalBlack);
  g.add(tube);

  // End caps
  const capGeo = new THREE.BoxGeometry(raceW + 0.03, 0.05, raceD + 0.03);
  const capTop = new THREE.Mesh(capGeo, MATS.metalDark);
  capTop.position.y = height / 2;
  g.add(capTop);
  const capBot = capTop.clone();
  capBot.position.y = -height / 2;
  g.add(capBot);

  // Cable ties every ~0.5m
  const ties = Math.floor(height / 0.5);
  for (let i = 1; i < ties; i++) {
    const y = -height / 2 + (i / ties) * height;
    const tie = new THREE.Mesh(new THREE.BoxGeometry(raceW + 0.025, 0.018, raceD + 0.025), MATS.metalMid);
    tie.position.y = y;
    g.add(tie);
  }

  // Small access panel halfway up
  const panel = new THREE.Mesh(new THREE.BoxGeometry(raceW + 0.01, 0.14, 0.02), MATS.metalMid);
  panel.position.set(0, height * 0.2, raceD / 2 + 0.01);
  g.add(panel);

  // Position on the rocket's circumference
  const radius = rocketDiameter / 2 + 0.06;
  g.position.x = Math.cos(faceAngle) * radius;
  g.position.z = Math.sin(faceAngle) * radius;
  g.rotation.y = -faceAngle;

  return g;
}

// Handrails — small U-shaped loops welded to the tank.
// Real rockets have these for technicians during assembly.
function makeHandrails(height, rocketDiameter, faceAngle) {
  const g = new THREE.Group();
  const radius = rocketDiameter / 2 + 0.04;
  const railRadius = 0.012;

  // Two vertical runs of handrails
  const startY = -height / 3;
  const endY = height / 3;
  const count = Math.floor((endY - startY) / 0.55);

  for (let i = 0; i <= count; i++) {
    const y = startY + (i / count) * (endY - startY);

    // Each handrail = 2 short standoff posts + 1 long horizontal bar
    const postGeo = new THREE.CylinderGeometry(railRadius, railRadius, 0.12, 8);

    const post1 = new THREE.Mesh(postGeo, MATS.metalMid);
    post1.rotation.z = Math.PI / 2;
    post1.position.set(radius, y, -0.15);

    const post2 = post1.clone();
    post2.position.z = 0.15;

    const barGeo = new THREE.CylinderGeometry(railRadius, railRadius, 0.34, 8);
    const bar = new THREE.Mesh(barGeo, MATS.metalMid);
    bar.rotation.x = Math.PI / 2;
    bar.position.set(radius + 0.06, y, 0);

    g.add(post1);
    g.add(post2);
    g.add(bar);
  }

  g.rotation.y = -faceAngle;
  const finalRadius = rocketDiameter / 2;
  g.position.x = Math.cos(faceAngle) * finalRadius;
  g.position.z = Math.sin(faceAngle) * finalRadius;

  return g;
}

// Hold-down clamps — 4 points at the base of the rocket that grip
// the launch mount until liftoff. Visible on every orbital rocket.
function makeHoldDownClamp(rocketDiameter) {
  const g = new THREE.Group();
  const radius = rocketDiameter / 2;

  // Clamp body — a thick block that curves around the engine base
  const bodyGeo = new THREE.BoxGeometry(0.22, 0.28, 0.16);
  const body = new THREE.Mesh(bodyGeo, MATS.metalDark);
  body.position.set(radius + 0.08, 0, 0);
  g.add(body);

  // Upper jaw — reaches over the thrust structure
  const jawGeo = new THREE.BoxGeometry(0.14, 0.08, 0.2);
  const jaw = new THREE.Mesh(jawGeo, MATS.metalMid);
  jaw.position.set(radius - 0.02, 0.16, 0);
  g.add(jaw);

  // Hydraulic cylinder — pushes the jaw down
  const cylGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.22, 12);
  const cyl = new THREE.Mesh(cylGeo, MATS.silver);
  cyl.position.set(radius + 0.14, -0.08, 0);
  g.add(cyl);

  // Cylinder rod
  const rodGeo = new THREE.CylinderGeometry(0.014, 0.014, 0.14, 8);
  const rod = new THREE.Mesh(rodGeo, MATS.copper);
  rod.position.set(radius + 0.14, 0.08, 0);
  g.add(rod);

  // Mounting bolts to the launch pad
  const boltGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.05, 6);
  for (const z of [-0.06, 0.06]) {
    const bolt = new THREE.Mesh(boltGeo, MATS.metalBlack);
    bolt.position.set(radius + 0.08, -0.16, z);
    g.add(bolt);
  }

  // Warning placard — yellow
  const placardGeo = new THREE.BoxGeometry(0.08, 0.05, 0.005);
  const placard = new THREE.Mesh(placardGeo, MATS.yellow);
  placard.position.set(radius + 0.19, 0.05, 0.08);
  g.add(placard);

  return g;
}

// Small RCS thruster cluster — 4 tiny thrusters on a plate.
// Every upper stage has these for attitude control.
function makeRCSThruster() {
  const g = new THREE.Group();

  // Mounting plate
  addMesh(g, new THREE.BoxGeometry(0.14, 0.03, 0.14), MATS.metalMid, 0, 0, 0);

  // 4 small thrusters
  const positions = [
    [0.04, 0.04],
    [-0.04, 0.04],
    [0.04, -0.04],
    [-0.04, -0.04],
  ];
  for (const [x, z] of positions) {
    // Thruster body
    addMesh(g, new THREE.CylinderGeometry(0.02, 0.02, 0.05, 8), MATS.metalDark, x, 0.04, z);
    // Tiny nozzle
    addMesh(g, new THREE.CylinderGeometry(0.015, 0.01, 0.02, 8), MATS.copper, x, 0.075, z);
  }

  return g;
}

// Antenna cluster — the small comms antennas on the side of every
// modern orbital rocket. Two blade antennas, one whip, one GPS patch.
function makeAntennaCluster() {
  const g = new THREE.Group();

  // Mounting plate
  addMesh(g, new THREE.BoxGeometry(0.16, 0.1, 0.02), MATS.metalBlack, 0, 0, 0);

  // Two blade antennas
  for (const x of [-0.05, 0.05]) {
    const bladeGeo = new THREE.BoxGeometry(0.02, 0.06, 0.008);
    const blade = new THREE.Mesh(bladeGeo, MATS.metalMid);
    blade.position.set(x, 0.01, 0.02);
    g.add(blade);
  }

  // Whip antenna — thin long rod
  const whipGeo = new THREE.CylinderGeometry(0.003, 0.003, 0.15, 6);
  const whip = new THREE.Mesh(whipGeo, MATS.silver);
  whip.position.set(0, 0.1, 0.02);
  g.add(whip);

  // GPS patch — small flat square on top
  const gpsGeo = new THREE.BoxGeometry(0.04, 0.006, 0.04);
  const gps = new THREE.Mesh(gpsGeo, MATS.copper);
  gps.position.set(0, -0.04, 0.02);
  g.add(gps);

  return g;
}

// Access hatch — a door with visible hinges and bolts.
// Looks mundane. Every real rocket has a dozen of these.
function makeAccessHatch(w, h) {
  const g = new THREE.Group();

  // Recessed panel
  const recess = new THREE.Mesh(new THREE.BoxGeometry(w + 0.02, h + 0.02, 0.005), MATS.metalDark);
  g.add(recess);

  // The actual hatch door
  const door = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.012), MATS.metalLight);
  door.position.z = 0.008;
  g.add(door);

  // Hinges on the left side
  for (let i = 0; i < 2; i++) {
    const y = -h / 3 + i * (2 * h / 3);
    const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.04, 8), MATS.copper);
    hinge.rotation.z = Math.PI / 2;
    hinge.position.set(-w / 2 - 0.01, y, 0.015);
    g.add(hinge);
  }

  // Latch handle on the right
  const handleGeo = new THREE.BoxGeometry(0.025, 0.04, 0.015);
  const handle = new THREE.Mesh(handleGeo, MATS.metalMid);
  handle.position.set(w / 2 - 0.02, 0, 0.02);
  g.add(handle);

  // Bolt ring around the edge
  const boltGeo = new THREE.SphereGeometry(0.004, 6, 4);
  const boltCount = 8;
  for (let i = 0; i < boltCount; i++) {
    const t = i / boltCount;
    let bx, by;
    if (i < 2) { bx = -w / 2 + 0.02; by = -h / 2 + 0.02 + i * (h - 0.04); }
    else if (i < 4) { bx = w / 2 - 0.02; by = -h / 2 + 0.02 + (i - 2) * (h - 0.04); }
    else if (i < 6) { bx = -w / 2 + 0.02 + (i - 4) * (w - 0.04); by = h / 2 - 0.02; }
    else { bx = -w / 2 + 0.02 + (i - 6) * (w - 0.04); by = -h / 2 + 0.02; }
    const bolt = new THREE.Mesh(boltGeo, MATS.metalBlack);
    bolt.position.set(bx, by, 0.015);
    g.add(bolt);
  }

  return g;
}

// LOX vent valve — the top of every liquid oxygen tank has one.
// The white vapor you see venting on Falcon 9 comes out of this.
function makeLOXVentValve() {
  const g = new THREE.Group();

  // Valve body
  addMesh(g, new THREE.CylinderGeometry(0.06, 0.06, 0.1, 16), MATS.copper, 0, 0, 0);

  // Top cap
  addMesh(g, new THREE.CylinderGeometry(0.07, 0.06, 0.03, 16), MATS.copperDark, 0, 0.06, 0);

  // Vent opening — small angled pipe
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.15, 10), MATS.metalMid);
  pipe.rotation.z = Math.PI / 3;
  pipe.position.set(0.07, 0.06, 0);
  g.add(pipe);

  // Pipe opening
  addMesh(g, new THREE.CylinderGeometry(0.028, 0.028, 0.015, 10), MATS.metalBlack, 0.135, 0.12, 0);

  // Small sensor on top
  addMesh(g, new THREE.BoxGeometry(0.03, 0.02, 0.03), MATS.metalDark, -0.04, 0.09, 0);

  return g;
}

// RCS thruster port — flat plate with 4 tiny nozzles on the avionics
// section for attitude control
function makeRCSPorts() {
  const g = new THREE.Group();
  for (let i = 0; i < 2; i++) {
    const port = new THREE.Group();
    port.position.set(0, i * 0.06 - 0.03, 0);
    addMesh(port, new THREE.BoxGeometry(0.06, 0.02, 0.06), MATS.metalDark);
    // 4 mini nozzles pointing outward
    for (let j = 0; j < 4; j++) {
      const a = (j / 4) * Math.PI * 2 + Math.PI / 4;
      const nozzle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.006, 0.008, 0.015, 8),
        MATS.copper
      );
      nozzle.position.set(Math.cos(a) * 0.035, 0.01, Math.sin(a) * 0.035);
      nozzle.rotation.z = Math.PI / 2;
      nozzle.rotation.y = -a;
      port.add(nozzle);
    }
    g.add(port);
  }
  return g;
}

// Build a curved rocket bell using a proper contour curve.
// Real bells have an inflection point around the throat, then flare out.
function makeBellGeometry(throatR, exitR, height) {
  const pts = [];
  const N = 24;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    // Bell contour: parabolic approximation of a Rao nozzle
    // Start radius = throat, end radius = exit
    // Radius grows slowly near the throat, then quickly near the exit
    const shape = Math.pow(t, 1.6); // exponent controls flare
    const r = throatR + (exitR - throatR) * shape;
    const y = -t * height;
    pts.push(new THREE.Vector2(r, y));
  }
  return new THREE.LatheGeometry(pts, 48);
}

// ---------- ENGINE CLUSTER ----------

export function makeEngineCluster(h, d, variant = 'nine') {
  const g = new THREE.Group();
  const baseY = h / 2 - 0.06;

  // Thrust plate
  addMesh(g, new THREE.CylinderGeometry(d / 2, d / 2, 0.1, 64), MATS.metalDark, 0, baseY, 0);

  // Upper structural ring with rivets
  addMesh(g, new THREE.TorusGeometry(d / 2 - 0.03, 0.04, 10, 64), MATS.metalMid, 0, baseY, 0).rotation.x = Math.PI / 2;
  addRivetRing(g, 32, d / 2 - 0.05, baseY + 0.05, 0.01);

  // Radial stiffener ribs on the plate
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const rib = new THREE.Mesh(new THREE.BoxGeometry(d * 0.42, 0.03, 0.04), MATS.metalMid);
    rib.position.set(Math.cos(a) * d * 0.25, baseY - 0.06, Math.sin(a) * d * 0.25);
    rib.rotation.y = -a;
    g.add(rib);
  }

  // configuration
  let count = 9, layout = 'octaweb';
  if (variant === 'one') { count = 1; layout = 'single'; }
  if (variant === 'two') { count = 2; layout = 'ring'; }
  if (variant === 'three') { count = 3; layout = 'ring'; }
  if (variant === 'four') { count = 4; layout = 'ring'; }
  if (variant === 'five') { count = 5; layout = 'ring'; }

  const positions = [];
  const rInner = d * 0.26;
  if (layout === 'single') positions.push([0, 0]);
  else if (layout === 'octaweb') {
    positions.push([0, 0]);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      positions.push([Math.cos(a) * rInner, Math.sin(a) * rInner]);
    }
  } else {
    const r = count === 2 ? d * 0.2 : d * 0.24;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + Math.PI / count;
      positions.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
  }

  const nozzleD = d * (count >= 9 ? 0.22 : count === 5 ? 0.28 : count === 4 ? 0.32 : count === 3 ? 0.36 : count === 2 ? 0.42 : 0.55);
  const throatR = nozzleD * 0.18;
  const exitR = nozzleD / 2;

  const chamberH = h * 0.16;
  const injectorH = h * 0.05;
  const bellTopY = baseY - chamberH - injectorH - 0.08;
  const bellBotY = -h / 2 + 0.08;
  const bellHeight = Math.max(0.35, bellTopY - bellBotY);

  // The bell geometry — shared across all instances of this cluster size
  const bellGeo = makeBellGeometry(throatR, exitR, bellHeight);

  for (const [nx, nz] of positions) {
    // Injector plate — with a distinctive domed top
    const injGeo = new THREE.CylinderGeometry(nozzleD * 0.45, nozzleD * 0.32, injectorH, 32);
    const inj = addMesh(g, injGeo, MATS.copper, nx, baseY - 0.1 - injectorH / 2, nz);

    // Injector bolts around the perimeter
    addBoltRing(g, 16, nozzleD * 0.38, baseY - 0.1 - injectorH, 0.012);

    // Combustion chamber
    const chamGeo = new THREE.CylinderGeometry(nozzleD * 0.32, throatR, chamberH, 32);
    addMesh(g, chamGeo, MATS.metalMid, nx, baseY - 0.1 - injectorH - chamberH / 2, nz);

    // Chamber cooling channels — small rings around the chamber
    for (let i = 0; i < 3; i++) {
      const t = (i + 1) / 4;
      const y = baseY - 0.1 - injectorH - chamberH * t;
      const r = throatR + (nozzleD * 0.32 - throatR) * t;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r + 0.006, 0.006, 6, 32), MATS.copperHot);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(nx, y, nz);
      g.add(ring);
    }

    // THE BELL — real lathe geometry now
    const bell = new THREE.Mesh(bellGeo, MATS.engineBell);
    bell.position.set(nx, bellTopY, nz);
    bell.userData.isNozzle = true;
    bell.userData.exitR = exitR;
    bell.userData.bellHeight = bellHeight;
    g.add(bell);

    // Cooling channel rings on the bell itself
    for (let i = 1; i <= 5; i++) {
      const t = i / 6;
      const shape = Math.pow(t, 1.6);
      const y = bellTopY - bellHeight * t;
      const r = throatR + (exitR - throatR) * shape;
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(r + 0.008, 0.005, 6, 40),
        i > 3 ? MATS.copperHot : MATS.copperDark
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.set(nx, y, nz);
      g.add(ring);
    }

    // Thick exit lip
    const lip = new THREE.Mesh(new THREE.TorusGeometry(exitR + 0.008, 0.018, 12, 48), MATS.copper);
    lip.rotation.x = Math.PI / 2;
    lip.position.set(nx, bellBotY, nz);
    g.add(lip);

    // Turbopump housing — offset like a real one
    const pumpGroup = new THREE.Group();
    pumpGroup.position.set(nx + nozzleD * 0.55, baseY - 0.18, nz);
    addMesh(pumpGroup, new THREE.CylinderGeometry(nozzleD * 0.16, nozzleD * 0.14, h * 0.12, 20), MATS.metalMid);
    addMesh(pumpGroup, new THREE.TorusGeometry(nozzleD * 0.17, 0.012, 6, 24), MATS.copper, 0, h * 0.06, 0).rotation.x = Math.PI / 2;
    addMesh(pumpGroup, new THREE.TorusGeometry(nozzleD * 0.15, 0.012, 6, 24), MATS.copper, 0, -h * 0.06, 0).rotation.x = Math.PI / 2;
    // Bolts on the pump
    addBoltRing(pumpGroup, 8, nozzleD * 0.16, 0, 0.008);
    g.add(pumpGroup);

    // Plumbing — feed line from pump to injector
    addTube(g, [
      new THREE.Vector3(nx + nozzleD * 0.55, baseY - 0.18 + h * 0.05, nz),
      new THREE.Vector3(nx + nozzleD * 0.45, baseY - 0.1, nz + 0.08),
      new THREE.Vector3(nx + nozzleD * 0.25, baseY - 0.08, nz + 0.1),
      new THREE.Vector3(nx + nozzleD * 0.1, baseY - 0.1, nz + 0.04),
      new THREE.Vector3(nx, baseY - 0.12, nz),
    ], MATS.copperDark, 0.018);

    // Second plumbing line — oxidizer feed
    addTube(g, [
      new THREE.Vector3(nx + nozzleD * 0.55, baseY - 0.18 - h * 0.04, nz),
      new THREE.Vector3(nx + nozzleD * 0.6, baseY - 0.14, nz - 0.08),
      new THREE.Vector3(nx + nozzleD * 0.4, baseY - 0.12, nz - 0.1),
      new THREE.Vector3(nx + nozzleD * 0.15, baseY - 0.12, nz - 0.06),
    ], MATS.copperDark, 0.016);

    // Gimbal actuator arms — two per engine, angled
    for (const ang of [0, Math.PI]) {
      const actGroup = new THREE.Group();
      const ax = nx + Math.cos(ang) * nozzleD * 0.62;
      const az = nz + Math.sin(ang) * nozzleD * 0.62;
      actGroup.position.set((nx + ax) / 2, baseY - 0.25, (nz + az) / 2);
      actGroup.lookAt(ax, baseY - 0.3, az);
      // Actuator body
      addMesh(actGroup, new THREE.CylinderGeometry(0.022, 0.022, 0.22, 10), MATS.silver, 0, 0.1, 0);
      // Piston shaft
      addMesh(actGroup, new THREE.CylinderGeometry(0.012, 0.012, 0.14, 8), MATS.copper, 0, -0.1, 0);
      // Ball joint at the base
      addMesh(actGroup, new THREE.SphereGeometry(0.03, 12, 10), MATS.metalDark, 0, -0.18, 0);
      actGroup.rotation.z = Math.PI / 2;
      g.add(actGroup);
    }

    // Gimbal ring
    const gimbal = new THREE.Mesh(new THREE.TorusGeometry(nozzleD * 0.44, 0.022, 10, 32), MATS.silver);
    gimbal.rotation.x = Math.PI / 2;
    gimbal.position.set(nx, baseY - 0.1 - injectorH - chamberH - 0.02, nz);
    g.add(gimbal);

    // Flame
    const flame = makeFlameGroup(exitR, bellHeight);
    flame.position.set(nx, bellBotY, nz);
    bell.userData.flame = flame;
    g.add(flame);
  }

  // Soot ring at the base of the engines
  const sootMat = new THREE.MeshBasicMaterial({
    map: getScorchTexture(),
    transparent: true,
    opacity: 0.4,
    depthWrite: false,
  });
  const sootGeo = new THREE.RingGeometry(d * 0.1, d * 0.48, 48);
  const soot = new THREE.Mesh(sootGeo, sootMat);
  soot.rotation.x = Math.PI / 2;
  soot.position.y = baseY - 0.16;
  g.add(soot);
    // === HOLD-DOWN CLAMPS ===
  // 4 clamps at the base, spaced 90° apart. Real rockets sit on these
  // until T-0 when they release.
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const clamp = makeHoldDownClamp(d);
    clamp.rotation.y = a;
    clamp.position.y = -h / 2 + 0.1;
    g.add(clamp);
  }

  // === HEAT SHIELD TILES above the engines ===
  // The base of the rocket has ablative tiles that protect against
  // engine plume radiation backwash.
  const tileRing = new THREE.Group();
  const tileCount = 32;
  for (let i = 0; i < tileCount; i++) {
    const a = (i / tileCount) * Math.PI * 2;
    const tile = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.015, 0.045),
      MATS.noseAblative
    );
    const r = d * 0.42;
    tile.position.set(Math.cos(a) * r, baseY - 0.2, Math.sin(a) * r);
    tile.rotation.y = -a;
    tile.rotation.x = 0.05;
    tileRing.add(tile);
  }
  g.add(tileRing);

  // === PURGE LINES ===
  // Small tubes that route purge gas to prevent backflow.
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 8;
    const px = Math.cos(a) * d * 0.4;
    const pz = Math.sin(a) * d * 0.4;
    addTube(g, [
      new THREE.Vector3(px, baseY - 0.05, pz),
      new THREE.Vector3(px * 1.1, baseY - 0.2, pz * 1.1),
      new THREE.Vector3(px * 1.2, -h / 2 + 0.2, pz * 1.2),
    ], MATS.copper, 0.012);
  }

  // === RANGE SAFETY ANTENNA BOX ===
  // Small black box with 2 antennas, standard since the 1960s.
  const safGroup = new THREE.Group();
  safGroup.position.set(d * 0.45, baseY - 0.3, 0);
  addMesh(safGroup, new THREE.BoxGeometry(0.14, 0.09, 0.1), MATS.metalBlack);
  // Two antenna stubs
  addMesh(safGroup, new THREE.CylinderGeometry(0.008, 0.008, 0.09, 6), MATS.silver, -0.04, 0.09, 0);
  addMesh(safGroup, new THREE.CylinderGeometry(0.008, 0.008, 0.09, 6), MATS.silver, 0.04, 0.09, 0);
  g.add(safGroup);

  return g;
}

// ---------- THRUST STRUCTURE ----------

export function makeThrustStructure(h, d) {
  const g = new THREE.Group();

  // Outer shell — translucent, you can see the trusses
  const shellMat = new THREE.MeshStandardMaterial({
    color: 0x6e6e7c,
    metalness: 0.88,
    roughness: 0.32,
    transparent: true,
    opacity: 0.42,
    side: THREE.DoubleSide,
  });
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(d / 2, d / 2, h, 64, 1, true), shellMat));

  // Top and bottom rings
  for (const y of [-h / 2 + 0.05, h / 2 - 0.05]) {
    const r = new THREE.Mesh(new THREE.TorusGeometry(d / 2, 0.055, 12, 64), MATS.metalMid);
    r.rotation.x = Math.PI / 2;
    r.position.y = y;
    g.add(r);
  }

  // Diagonal cross-bracing — Helix pattern
  for (let i = 0; i < 20; i++) {
    const a1 = (i / 20) * Math.PI * 2;
    const a2 = ((i + 1) / 20) * Math.PI * 2;
    const dir = i % 2 === 0 ? 1 : -1;

    const x1 = Math.cos(a1) * (d / 2 - 0.1);
    const z1 = Math.sin(a1) * (d / 2 - 0.1);
    const x2 = Math.cos(a2) * (d / 2 - 0.1);
    const z2 = Math.sin(a2) * (d / 2 - 0.1);

    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, h * 1.1, 8), MATS.metalDark);
    strut.position.set((x1 + x2) / 2, 0, (z1 + z2) / 2);
    strut.rotation.y = -(a1 + a2) / 2;
    strut.rotation.z = dir * 0.32;
    g.add(strut);
  }

  // Vertical struts
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + Math.PI / 20;
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, h * 0.95, 8), MATS.metalMid);
    strut.position.set(Math.cos(a) * (d / 2 - 0.05), 0, Math.sin(a) * (d / 2 - 0.05));
    g.add(strut);
  }

  // Heat shield disk
  const shield = new THREE.Mesh(new THREE.CylinderGeometry(d / 2 - 0.15, d / 2 - 0.15, 0.03, 64), MATS.thermalPad);
  shield.position.y = -h / 2 + 0.1;
  g.add(shield);

  return g;
}

// ---------- TANK ----------

export function makeTank(h, d, colorMat = MATS.metalLight, kind = 'standard') {
  const g = new THREE.Group();
  const domeH = d * 0.26;
  const bodyH = h - domeH * 2;
  const bodyR = d / 2;

  // Body with normal-mapped surface
  addMesh(g, new THREE.CylinderGeometry(bodyR, bodyR, bodyH, 96, 1, false), colorMat, 0, 0, 0);

  // Domes — high resolution
  const domeGeo = new THREE.SphereGeometry(bodyR, 96, 48, 0, Math.PI * 2, 0, Math.PI / 2);
  addMesh(g, domeGeo, colorMat, 0, bodyH / 2, 0);
  const botDome = addMesh(g, domeGeo, colorMat, 0, -bodyH / 2, 0);
  botDome.rotation.x = Math.PI;

  // Vertical weld seams (longitudinal)
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 8;
    const seam = new THREE.Mesh(
      new THREE.BoxGeometry(0.014, bodyH * 0.98, 0.014),
      MATS.metalDark
    );
    seam.position.set(Math.cos(a) * (bodyR + 0.005), 0, Math.sin(a) * (bodyR + 0.005));
    seam.rotation.y = -a;
    g.add(seam);
  }

  // Horizontal circumferential welds — every ~0.8m
  const weldCount = Math.max(6, Math.floor(bodyH / 0.8));
  for (let i = 0; i <= weldCount; i++) {
    const y = -bodyH / 2 + (i / weldCount) * bodyH;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(bodyR + 0.005, 0.014, 8, 96), MATS.metalDark);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y;
    g.add(ring);
  }

  // Dome-to-body transition welds
  for (const y of [bodyH / 2, -bodyH / 2]) {
    const r = new THREE.Mesh(new THREE.TorusGeometry(bodyR + 0.008, 0.018, 10, 96), MATS.metalDark);
    r.rotation.x = Math.PI / 2;
    r.position.y = y;
    g.add(r);
  }

  // Stringers — raised panels running the length
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.03, bodyH * 0.95, 0.02), MATS.metalMid);
    strip.position.set(Math.cos(a) * (bodyR + 0.008), 0, Math.sin(a) * (bodyR + 0.008));
    strip.rotation.y = -a;
    g.add(strip);
  }

  // Frost on cryo tanks
  if (kind === 'cryo' || kind === 'lox' || kind === 'methane') {
    const frostGeo = new THREE.CylinderGeometry(bodyR + 0.018, bodyR + 0.018, bodyH * 0.72, 96, 1, true);
    g.add(new THREE.Mesh(frostGeo, MATS.loxFrost));

    // Ice patches
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2;
      const y = (Math.random() - 0.5) * bodyH * 0.7;
      const r = 0.08 + Math.random() * 0.2;
      const ice = new THREE.Mesh(
        new THREE.CircleGeometry(r, 16),
        new THREE.MeshStandardMaterial({
          color: 0xd8ecf8,
          transparent: true,
          opacity: 0.6,
          metalness: 0.3,
          roughness: 0.7,
        })
      );
      ice.position.set(Math.cos(a) * (bodyR + 0.024), y, Math.sin(a) * (bodyR + 0.024));
      ice.lookAt(0, y, 0);
      g.add(ice);
    }
  }

  // Pressure relief valve assembly at the top
  const prvGroup = new THREE.Group();
  prvGroup.position.set(0, bodyH / 2 + domeH * 0.75, 0);
  addMesh(prvGroup, new THREE.CylinderGeometry(0.09, 0.09, 0.16, 24), MATS.copper);
  addMesh(prvGroup, new THREE.TorusGeometry(0.1, 0.014, 8, 24), MATS.copperDark, 0, 0.02, 0).rotation.x = Math.PI / 2;
  addMesh(prvGroup, new THREE.CylinderGeometry(0.04, 0.04, 0.06, 12), MATS.metalDark, 0, 0.11, 0);
  g.add(prvGroup);

  // Vent pipe from PRV
  addTube(g, [
    new THREE.Vector3(0, bodyH / 2 + domeH * 0.75, 0.06),
    new THREE.Vector3(bodyR * 0.3, bodyH / 2 + domeH * 0.6, 0.1),
    new THREE.Vector3(bodyR * 0.55, bodyH / 2 + domeH * 0.3, 0.08),
    new THREE.Vector3(bodyR * 0.6, bodyH / 2 - 0.2, 0.05),
  ], MATS.copperDark, 0.024);

  // Fill/drain port near the bottom
  const portGroup = new THREE.Group();
  portGroup.position.set(bodyR + 0.08, -bodyH / 2 + 0.25, 0);
  addMesh(portGroup, new THREE.CylinderGeometry(0.08, 0.08, 0.14, 20), MATS.silver, 0, 0, 0).rotation.z = Math.PI / 2;
  addMesh(portGroup, new THREE.TorusGeometry(0.08, 0.012, 6, 20), MATS.copper, 0.07, 0, 0).rotation.y = Math.PI / 2;
  g.add(portGroup);

  // Umbilical connector plate
  const umb = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.2, 0.12), MATS.metalBlack);
  umb.position.set(0, -bodyH / 2 + 0.4, bodyR + 0.05);
  g.add(umb);
  // Connector pins
  for (let i = 0; i < 6; i++) {
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.02, 6), MATS.copper);
    pin.rotation.x = Math.PI / 2;
    pin.position.set(-0.04 + (i % 3) * 0.04, -bodyH / 2 + 0.4 - 0.06 + Math.floor(i / 3) * 0.06, bodyR + 0.11);
    g.add(pin);
  }

  // Support brackets at the base
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const bracket = new THREE.Group();
    bracket.position.set(Math.cos(a) * (bodyR + 0.06), -bodyH / 2 - domeH + 0.15, Math.sin(a) * (bodyR + 0.06));
    bracket.rotation.y = -a;
    addMesh(bracket, new THREE.BoxGeometry(0.06, 0.18, 0.1), MATS.metalMid);
    addMesh(bracket, new THREE.BoxGeometry(0.12, 0.03, 0.06), MATS.metalDark, 0.06, 0.06, 0);
    g.add(bracket);
  }

  // External pipe running up the side
  addTube(g, [
    new THREE.Vector3(bodyR + 0.1, -bodyH / 2 + 0.3, 0.18),
    new THREE.Vector3(bodyR + 0.13, -bodyH / 4, 0.18),
    new THREE.Vector3(bodyR + 0.13, bodyH / 4, 0.18),
    new THREE.Vector3(bodyR + 0.1, bodyH / 2 + 0.1, 0.15),
  ], MATS.copperDark, 0.024);

  // Second smaller line
  addTube(g, [
    new THREE.Vector3(bodyR + 0.09, -bodyH / 2 + 0.4, -0.2),
    new THREE.Vector3(bodyR + 0.11, 0, -0.2),
    new THREE.Vector3(bodyR + 0.09, bodyH / 2, -0.15),
  ], MATS.copperDark, 0.014);

  // Top hatch access panel
  const hatch = new THREE.Group();
  hatch.position.set(bodyR * 0.4, bodyH / 2 + domeH * 0.65, 0);
  addMesh(hatch, new THREE.CylinderGeometry(0.16, 0.16, 0.04, 32), MATS.silver);
  addMesh(hatch, new THREE.TorusGeometry(0.16, 0.014, 8, 32), MATS.metalDark, 0, 0.02, 0).rotation.x = Math.PI / 2;
  // Bolt ring around the hatch
  addBoltRing(hatch, 8, 0.13, 0.02, 0.01);
  g.add(hatch);

  // Rivets along the seams
  for (let i = 0; i < weldCount; i++) {
    const y = -bodyH / 2 + (i + 0.5) / weldCount * bodyH;
    addRivetRing(g, 48, bodyR + 0.012, y, 0.006);
  }

  // Weathering — dirt streaks
  const dirtMat = new THREE.MeshBasicMaterial({
    map: getDirtTexture(),
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const dirtGeo = new THREE.CylinderGeometry(bodyR + 0.02, bodyR + 0.02, bodyH * 0.9, 96, 1, true);
  g.add(new THREE.Mesh(dirtGeo, dirtMat));
  // === RACE-WAY (cable conduit running the length of the tank) ===
  // This is the single most recognizable detail on real orbital rockets.
  const raceway = makeRaceway(bodyH * 1.05, d, Math.PI * 1.15);
  raceway.position.y = 0;
  g.add(raceway);

  // === HAND RAILS (for technicians) ===
  const handrails = makeHandrails(bodyH * 0.85, d, Math.PI * 0.2);
  g.add(handrails);

  // === ACCESS HATCHES ===
  // 2 hatches at different heights and angles
  const hatch1 = makeAccessHatch(0.2, 0.28);
  hatch1.position.set(Math.cos(Math.PI * 0.45) * (bodyR + 0.01), bodyH * 0.15, Math.sin(Math.PI * 0.45) * (bodyR + 0.01));
  hatch1.lookAt(0, bodyH * 0.15, 0);
  hatch1.rotateY(Math.PI);
  g.add(hatch1);

  const hatch2 = makeAccessHatch(0.16, 0.22);
  hatch2.position.set(Math.cos(Math.PI * 1.65) * (bodyR + 0.01), -bodyH * 0.25, Math.sin(Math.PI * 1.65) * (bodyR + 0.01));
  hatch2.lookAt(0, -bodyH * 0.25, 0);
  hatch2.rotateY(Math.PI);
  g.add(hatch2);

  // === LOX VENT VALVE (on cryo tanks) ===
  if (kind === 'cryo' || kind === 'lox') {
    const vent = makeLOXVentValve();
    vent.position.set(bodyR * 0.55, bodyH / 2 + domeH * 0.5, bodyR * 0.4);
    g.add(vent);
    // Additional vent line running down
    addTube(g, [
      new THREE.Vector3(bodyR * 0.55, bodyH / 2 + domeH * 0.5, bodyR * 0.4),
      new THREE.Vector3(bodyR * 0.7, bodyH * 0.3, bodyR * 0.4),
      new THREE.Vector3(bodyR * 0.75, -bodyH * 0.2, bodyR * 0.3),
    ], MATS.copper, 0.018);
  }

  // === GN2 THRUSTER PORTS (small attitude jets on the tank) ===
  // These are RCS thrusters mounted on the body for roll control
  const rcsPort = makeRCSPorts();
  rcsPort.position.set(0, bodyH * 0.4, bodyR + 0.02);
  g.add(rcsPort);

  // === PROPELLANT FILL LINES (thicker pipes running length) ===
  // These are the big lines that connect the tank to the engines
  for (let i = 0; i < 2; i++) {
    const angle = Math.PI * (0.7 + i * 0.55);
    const px = Math.cos(angle) * (bodyR + 0.08);
    const pz = Math.sin(angle) * (bodyR + 0.08);
    addTube(g, [
      new THREE.Vector3(px, -bodyH / 2 + 0.1, pz),
      new THREE.Vector3(px * 1.05, -bodyH / 4, pz * 1.05),
      new THREE.Vector3(px * 1.05, bodyH / 4, pz * 1.05),
      new THREE.Vector3(px, bodyH / 2 - 0.1, pz),
    ], MATS.copperDark, 0.028);
  }

  // === WARNING PLACARDS (small colored strips on the tank) ===
  for (let i = 0; i < 3; i++) {
    const angle = Math.PI * (0.3 + i * 0.9);
    const px = Math.cos(angle) * (bodyR + 0.012);
    const pz = Math.sin(angle) * (bodyR + 0.012);
    const placard = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.06, 0.005),
      i === 0 ? MATS.red : (i === 1 ? MATS.yellow : MATS.metalMid)
    );
    placard.position.set(px, bodyH * (0.05 - i * 0.1), pz);
    placard.lookAt(0, bodyH * (0.05 - i * 0.1), 0);
    g.add(placard);
  }
  // Scorch near the base
  const scorchMat = new THREE.MeshBasicMaterial({
    map: getScorchTexture(),
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
  });
  const scorchPlane = new THREE.Mesh(new THREE.PlaneGeometry(bodyR * 1.6, bodyR * 0.8), scorchMat);
  scorchPlane.position.set(bodyR * 0.6, -bodyH * 0.4, bodyR * 0.5);
  scorchPlane.lookAt(bodyR * 0.6, -bodyH * 0.4, bodyR * 1.8);
  g.add(scorchPlane);

  return g;
}

// ---------- INTERTANK ----------

export function makeIntertank(h, d) {
  const g = new THREE.Group();

  // Main cylinder
  addMesh(g, new THREE.CylinderGeometry(d / 2, d / 2, h, 64, 1, true), MATS.metalMid);

  // Vertical ribs — 16 of them for the corrugated look
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.08, h * 0.98, 0.04), MATS.metalDark);
    rib.position.set(Math.cos(a) * (d / 2 + 0.01), 0, Math.sin(a) * (d / 2 + 0.01));
    rib.rotation.y = -a;
    g.add(rib);
  }

  // Access panels
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 8;
    const panel = new THREE.Group();
    panel.position.set(Math.cos(a) * (d / 2 + 0.03), 0, Math.sin(a) * (d / 2 + 0.03));
    panel.rotation.y = -a;
    addMesh(panel, new THREE.BoxGeometry(0.3, 0.18, 0.02), MATS.metalBlack);
    addMesh(panel, new THREE.BoxGeometry(0.32, 0.2, 0.005), MATS.metalDark, 0, 0, -0.015);
    // Handle
    addMesh(panel, new THREE.BoxGeometry(0.06, 0.014, 0.02), MATS.silver, 0.1, 0, 0.02);
    g.add(panel);
  }

  // Top and bottom rings
  for (const y of [-h / 2 + 0.08, h / 2 - 0.08]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(d / 2 + 0.02, 0.04, 10, 64), MATS.metalDark);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y;
    g.add(ring);
    // Rivets along the ring
    addRivetRing(g, 40, d / 2 + 0.04, y, 0.008);
  }

  return g;
}

// ---------- PRESSURANT ----------

export function makePressurant(h, d, variant = 'standard') {
  const g = new THREE.Group();

  if (variant === 'autogenous' || variant === 'regenerative') {
    addMesh(g, new THREE.BoxGeometry(d * 0.65, h * 0.9, d * 0.55), MATS.copper);
    addPanelLine(g, -d * 0.3, h * 0.2, d * 0.3, h * 0.2, d * 0.28);
    addMesh(g, new THREE.TorusGeometry(d * 0.28, 0.05, 10, 28), MATS.copperDark, d * 0.35, 0, 0);
    addTube(g, [
      new THREE.Vector3(-d * 0.32, 0, 0),
      new THREE.Vector3(-d * 0.42, h * 0.3, 0),
      new THREE.Vector3(0, h * 0.4, 0),
    ], MATS.copperDark, 0.022);
    return g;
  }

  if (variant === 'nitrogen') {
    const sphereR = d * 0.28;
    for (const x of [-d * 0.3, d * 0.3]) {
      // Sphere with visible bands
      addMesh(g, new THREE.SphereGeometry(sphereR, 32, 24), MATS.metalLight, x, 0, 0);
      const r1 = new THREE.Mesh(new THREE.TorusGeometry(sphereR * 1.02, 0.014, 8, 32), MATS.metalDark);
      r1.rotation.x = Math.PI / 2;
      r1.position.set(x, 0, 0);
      g.add(r1);
      const r2 = new THREE.Mesh(new THREE.TorusGeometry(sphereR * 1.02, 0.014, 8, 32), MATS.metalDark);
      r2.rotation.z = Math.PI / 2;
      r2.position.set(x, 0, 0);
      g.add(r2);
      // Fitting at top
      addMesh(g, new THREE.CylinderGeometry(0.03, 0.03, 0.06, 12), MATS.copper, x, sphereR + 0.02, 0);
    }
    return g;
  }

  // Standard — COPV cluster with kapton wrap and straps
  const sphereR = d * 0.24;
  for (const [x, y, z] of [[0, 0, 0], [d * 0.32, 0, 0], [-d * 0.32, 0, 0]]) {
    addMesh(g, new THREE.SphereGeometry(sphereR, 32, 24), MATS.kapton, x, y, z);
    // Strap rings
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(sphereR * 1.03, 0.012, 6, 32), MATS.metalDark);
      ring.rotation.x = Math.PI / 2;
      ring.rotation.z = angle;
      ring.position.set(x, y, z);
      g.add(ring);
    }
    // Port fitting
    addMesh(g, new THREE.CylinderGeometry(0.025, 0.025, 0.05, 12), MATS.copper, x, y + sphereR + 0.02, 0);
  }

  // Manifold connecting them
  addTube(g, [
    new THREE.Vector3(-d * 0.32, sphereR, 0),
    new THREE.Vector3(0, sphereR + 0.04, 0),
    new THREE.Vector3(d * 0.32, sphereR, 0),
  ], MATS.copperDark, 0.018);

  return g;
}

// ---------- GRID FINS ----------

export function makeGridFins(h, d) {
  const g = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const fin = new THREE.Group();

    // Deep lattice — 6x6 with proper depth
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 6; c++) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.035, h * 0.88, 0.035), MATS.metalDark);
        bar.position.set((c - 2.5) * 0.11, 0, (r - 2.5) * 0.11);
        fin.add(bar);
      }
    }

    // Frame on both ends
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.7, h * 0.95, 0.04), MATS.metalMid);
    frame.position.z = -0.32;
    fin.add(frame);
    const frame2 = frame.clone();
    frame2.position.z = 0.32;
    fin.add(frame2);

    // Top and bottom rails
    const topRail = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.04, 0.65), MATS.metalMid);
    topRail.position.y = h * 0.47;
    fin.add(topRail);
    const botRail = topRail.clone();
    botRail.position.y = -h * 0.47;
    fin.add(botRail);

    // Hinge bracket where it attaches to the rocket
    const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.15, 16), MATS.metalDark);
    hinge.rotation.x = Math.PI / 2;
    hinge.position.set(-0.38, 0, 0);
    fin.add(hinge);

    // Rotary actuator
    const act = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.08, 16), MATS.copper);
    act.rotation.x = Math.PI / 2;
    act.position.set(-0.38, 0.1, 0);
    fin.add(act);

    fin.position.set(Math.cos(a) * d / 2, 0, Math.sin(a) * d / 2);
    fin.rotation.y = -a;
    g.add(fin);
  }
  return g;
}

// ---------- INTERSTAGE ----------

export function makeInterstage(h, d) {
  const g = new THREE.Group();
  addMesh(g, new THREE.CylinderGeometry(d / 2, d / 2, h, 64, 1, true), MATS.metalLight);

  // Rivet rings at top and bottom
  for (const y of [h / 2 - 0.1, -h / 2 + 0.1]) {
    const r = new THREE.Mesh(new THREE.TorusGeometry(d / 2 + 0.02, 0.03, 10, 64), MATS.metalDark);
    r.rotation.x = Math.PI / 2;
    r.position.y = y;
    g.add(r);
    addRivetRing(g, 48, d / 2 + 0.03, y, 0.007);
  }

  // Vent holes
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const vent = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 0.06, 12),
      MATS.metalBlack
    );
    vent.rotation.z = Math.PI / 2;
    vent.position.set(Math.cos(a) * (d / 2 + 0.03), h / 2 - 0.25, Math.sin(a) * (d / 2 + 0.03));
    vent.rotation.y = -a;
    g.add(vent);
    // Rim around each vent
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.008, 6, 16), MATS.metalMid);
    rim.rotation.y = -a + Math.PI / 2;
    rim.position.set(Math.cos(a) * (d / 2 + 0.04), h / 2 - 0.25, Math.sin(a) * (d / 2 + 0.04));
    g.add(rim);
  }

  // Longitudinal ribs inside (visible through the vents)
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 16;
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.02, h * 0.9, 0.06), MATS.metalMid);
    rib.position.set(Math.cos(a) * (d / 2 - 0.04), 0, Math.sin(a) * (d / 2 - 0.04));
    rib.rotation.y = -a;
    g.add(rib);
  }

  return g;
}

// ---------- SEPARATION ----------

export function makeSeparation(h, d) {
  const g = new THREE.Group();

  // Main ring
  const ring = new THREE.Mesh(new THREE.TorusGeometry(d / 2, 0.08, 12, 64), MATS.yellow);
  ring.rotation.x = Math.PI / 2;
  g.add(ring);

  // Inner ring (darker)
  const innerRing = new THREE.Mesh(new THREE.TorusGeometry(d / 2 - 0.1, 0.04, 10, 64), MATS.metalDark);
  innerRing.rotation.x = Math.PI / 2;
  g.add(innerRing);

  // Bolt ring
  addBoltRing(g, 24, d / 2 + 0.05, 0, 0.04);

  // Warning stripes
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.025, 0.04), MATS.red);
    stripe.position.set(Math.cos(a) * (d / 2 + 0.05), h / 2 + 0.02, Math.sin(a) * (d / 2 + 0.05));
    stripe.rotation.y = -a;
    g.add(stripe);
  }

  return g;
}

// ---------- UPPER ENGINE ----------

export function makeUpperEngine(h, d) {
  const g = new THREE.Group();
  const throatR = d * 0.14;
  const exitR = d / 2;
  const bellHeight = h * 0.82;

  // Injector head
  addMesh(g, new THREE.CylinderGeometry(d * 0.3, d * 0.26, h * 0.07, 32), MATS.copper, 0, h * 0.46, 0);
  addBoltRing(g, 16, d * 0.28, h * 0.5, 0.012);

  // Chamber
  addMesh(g, new THREE.CylinderGeometry(d * 0.26, throatR, h * 0.18, 32), MATS.metalMid, 0, h * 0.35, 0);

  // Chamber cooling rings
  for (let i = 0; i < 3; i++) {
    const t = (i + 1) / 4;
    const y = h * 0.44 - h * 0.18 * t;
    const r = throatR + (d * 0.26 - throatR) * t;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r + 0.008, 0.007, 6, 32), MATS.copperHot);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y;
    g.add(ring);
  }

  // THE BELL — real curve
  const bellGeo = makeBellGeometry(throatR, exitR, bellHeight);
  const bell = new THREE.Mesh(bellGeo, MATS.engineBell);
  bell.position.y = h * 0.26;
  bell.userData.isNozzle = true;
  bell.userData.exitR = exitR;
  bell.userData.bellHeight = bellHeight;
  g.add(bell);

  // Cooling channel rings on the bell
  for (let i = 1; i <= 6; i++) {
    const t = i / 7;
    const shape = Math.pow(t, 1.6);
    const y = h * 0.26 - bellHeight * t;
    const r = throatR + (exitR - throatR) * shape;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(r + 0.012, 0.006, 6, 48),
      i > 4 ? MATS.copperHot : MATS.copperDark
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y;
    g.add(ring);
  }

  // Exit lip
  const lip = new THREE.Mesh(new THREE.TorusGeometry(exitR + 0.01, 0.022, 12, 64), MATS.copper);
  lip.rotation.x = Math.PI / 2;
  lip.position.y = h * 0.26 - bellHeight;
  g.add(lip);

  // Gimbal ring
  const gimbal = new THREE.Mesh(new THREE.TorusGeometry(d * 0.34, 0.035, 12, 40), MATS.silver);
  gimbal.rotation.x = Math.PI / 2;
  gimbal.position.y = h * 0.5;
  g.add(gimbal);

  // Plumbing
  addTube(g, [
    new THREE.Vector3(d * 0.3, h * 0.48, 0),
    new THREE.Vector3(d * 0.42, h * 0.3, 0.06),
    new THREE.Vector3(d * 0.2, h * 0.44, 0.04),
    new THREE.Vector3(d * 0.05, h * 0.46, 0),
  ], MATS.copperDark, 0.018);

  // Flame
  const flame = makeFlameGroup(exitR, bellHeight);
  flame.position.set(0, h * 0.26 - bellHeight, 0);
  bell.userData.flame = flame;
  g.add(flame);

  return g;
}

// ---------- AVIONICS ----------

export function makeAvionics(h, d, partId) {
  const g = new THREE.Group();
  const boxW = d * 0.9;

  // Base mounting plate
  addMesh(g, new THREE.BoxGeometry(boxW * 1.08, 0.04, boxW * 1.08), MATS.metalDark, 0, -h / 2 + 0.02, 0);
  // Main box with panel-aluminum texture
  addMesh(g, new THREE.BoxGeometry(boxW, h, boxW), MATS.panelAlum);

  // Corner bolts
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, h * 1.02, 8), MATS.metalBlack);
    bolt.position.set(sx * (boxW / 2 - 0.04), 0, sz * (boxW / 2 - 0.04));
    g.add(bolt);
  }

  // Antenna assembly — 2
  for (const sign of [-1, 1]) {
    const antGroup = new THREE.Group();
    const x = sign * (boxW / 2 - 0.1);
    const z = sign * (boxW / 2 - 0.1);
    antGroup.position.set(x, h / 2, z);

    // Base mount
    addMesh(antGroup, new THREE.CylinderGeometry(0.03, 0.03, 0.04, 12), MATS.metalMid, 0, 0.02, 0);
    // Antenna rod
    addMesh(antGroup, new THREE.CylinderGeometry(0.012, 0.012, h * 1.1, 8), MATS.silver, 0, h * 0.55, 0);
    // Ball tip
    addMesh(antGroup, new THREE.SphereGeometry(0.028, 12, 10), MATS.copper, 0, h * 1.1, 0);
    g.add(antGroup);
  }

  // Comms dish on top
  const dishGroup = new THREE.Group();
  dishGroup.position.set(0, h / 2 + 0.02, 0);
  addMesh(dishGroup, new THREE.CylinderGeometry(0.02, 0.02, 0.06, 12), MATS.silver, 0, 0.03, 0);
  const dish = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.1, 24, 1, true), MATS.dishWhite);
  dish.rotation.x = Math.PI;
  dish.position.y = 0.12;
  dishGroup.add(dish);
  // Feed horn
  addMesh(dishGroup, new THREE.CylinderGeometry(0.008, 0.008, 0.08, 8), MATS.copper, 0, 0.05, 0);
  g.add(dishGroup);

  // Umbilical connector
  const umb = new THREE.Group();
  umb.position.set(boxW / 2 + 0.04, 0, 0);
  addMesh(umb, new THREE.BoxGeometry(0.08, 0.12, 0.08), MATS.copper);
  // Connector pins
  for (let i = 0; i < 6; i++) {
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.02, 6), MATS.metalDark);
    pin.rotation.z = Math.PI / 2;
    pin.position.set(0.05, -0.03 + (i % 3) * 0.03, -0.03 + Math.floor(i / 3) * 0.06);
    umb.add(pin);
  }
  g.add(umb);

  // Wire bundle running down the side
  addTube(g, [
    new THREE.Vector3(boxW / 2 + 0.02, h / 2 - 0.05, 0.1),
    new THREE.Vector3(boxW / 2 + 0.03, 0, 0.16),
    new THREE.Vector3(boxW / 2 + 0.02, -h / 2 + 0.1, 0.1),
  ], MATS.metalBlack, 0.014);
  // Second bundle
  addTube(g, [
    new THREE.Vector3(boxW / 2 + 0.02, h / 2 - 0.05, 0.05),
    new THREE.Vector3(boxW / 2 + 0.02, 0, 0.12),
    new THREE.Vector3(boxW / 2 + 0.01, -h / 2 + 0.1, 0.05),
  ], MATS.metalBlack, 0.01);

  // Star tracker variant
  if (partId && partId.includes('star_tracker')) {
    const lensGroup = new THREE.Group();
    lensGroup.position.set(0, 0, boxW * 0.4);
    // Lens barrel
    addMesh(lensGroup, new THREE.CylinderGeometry(0.1, 0.1, 0.18, 32), MATS.metalBlack).rotation.x = Math.PI / 2;
    // Outer ring
    addMesh(lensGroup, new THREE.TorusGeometry(0.1, 0.012, 8, 32), MATS.copper, 0, 0, 0.09).rotation.x = Math.PI / 2;
    // Front glass
    addMesh(lensGroup, new THREE.CircleGeometry(0.08, 32), MATS.lensFront, 0, 0, 0.1);
    // Inner glass
    addMesh(lensGroup, new THREE.CircleGeometry(0.05, 24), MATS.lensGlass, 0, 0, 0.05);
    g.add(lensGroup);
  }

  // Triple-redundant — stack 3 boxes
  if (partId && partId.includes('triple')) {
    for (let i = -1; i <= 1; i++) {
      addMesh(g, new THREE.BoxGeometry(boxW * 0.85, h * 0.24, boxW * 0.85), MATS.panelAlum, 0, i * h * 0.3, 0);
      // Small status LED on each
      const led = new THREE.Mesh(
        new THREE.SphereGeometry(0.015, 8, 6),
        new THREE.MeshStandardMaterial({ color: 0x44ff66, emissive: 0x44ff66, emissiveIntensity: 8 })
      );
      led.position.set(boxW * 0.42, i * h * 0.3, 0);
      g.add(led);
    }
  }
    // === RCS THRUSTER CLUSTERS ===
  // Small attitude control thrusters on opposite faces of the avionics.
  // Every upper stage has at least 2 clusters for roll and yaw control.
  for (const sign of [-1, 1]) {
    const rcs = makeRCSThruster();
    rcs.position.set(sign * (boxW / 2 + 0.08), 0, 0);
    rcs.rotation.y = sign > 0 ? 0 : Math.PI;
    g.add(rcs);
  }

  // Second pair — perpendicular orientation, top face
  for (const sign of [-1, 1]) {
    const rcs = makeRCSThruster();
    rcs.position.set(0, h / 2 + 0.06, sign * (boxW / 2 + 0.08));
    rcs.rotation.x = sign > 0 ? -Math.PI / 2 : Math.PI / 2;
    g.add(rcs);
  }

  // === ANTENNA CLUSTER ===
  // Comms antennas on the side of the avionics bay.
  const antCluster = makeAntennaCluster();
  antCluster.position.set(-boxW / 2 - 0.01, 0, 0);
  antCluster.rotation.y = -Math.PI / 2;
  g.add(antCluster);

  // Second antenna cluster — opposite side
  const antCluster2 = makeAntennaCluster();
  antCluster2.position.set(boxW / 2 + 0.01, 0, 0);
  antCluster2.rotation.y = Math.PI / 2;
  g.add(antCluster2);

  return g;
}

// ---------- POWER ----------

export function makePower(h, d, partId) {
  const g = new THREE.Group();

  if (partId && (partId.includes('solar') || partId.includes('array'))) {
    const hubH = Math.max(h * 1.5, 0.4);

    // Central hub
    addMesh(g, new THREE.BoxGeometry(d * 0.38, hubH, d * 0.38), MATS.panelAlum);

    // Rotating interface ring
    const ring = new THREE.Mesh(new THREE.TorusGeometry(d * 0.35, 0.04, 12, 40), MATS.silver);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = hubH / 2 - 0.05;
    g.add(ring);
    addRivetRing(g, 24, d * 0.35, hubH / 2 - 0.05, 0.008);

    // Small avionics box on top of hub
    addMesh(g, new THREE.BoxGeometry(d * 0.22, h * 0.4, d * 0.22), MATS.panelBlue, 0, hubH / 2 + h * 0.18, 0);

    const wingW = d * 2.4;
    const wingH = h * 1.7;
    const tex = getSolarTexture();

    for (const sign of [-1, 1]) {
      const wg = new THREE.Group();
      wg.position.set(sign * (d * 0.22), 0, 0);

      // Frame backing — carbon fiber
      const backing = new THREE.Mesh(new THREE.BoxGeometry(wingW, 0.04, wingH), MATS.carbon);
      backing.position.x = sign * wingW / 2;
      wg.add(backing);

      // Hinge point where wing connects to hub
      addMesh(wg, new THREE.CylinderGeometry(0.06, 0.06, 0.15, 16), MATS.silver, sign * 0.02, 0.04, 0).rotation.z = Math.PI / 2;
      addMesh(wg, new THREE.TorusGeometry(0.08, 0.015, 8, 20), MATS.metalDark, sign * 0.02, 0.04, 0).rotation.y = Math.PI / 2;

      // Solar panel front — the actual cells
      const frontMat = new THREE.MeshStandardMaterial({
        map: tex,
        metalness: 0.78,
        roughness: 0.22,
        emissive: 0x061030,
        emissiveIntensity: 0.5,
      });
      const front = new THREE.Mesh(new THREE.BoxGeometry(wingW * 0.98, 0.01, wingH * 0.96), frontMat);
      front.position.set(sign * wingW / 2, 0.025, 0);
      wg.add(front);

      // Glass cover sheen — very thin transparent layer
      const glassMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        metalness: 1.0,
        roughness: 0.05,
        transparent: true,
        opacity: 0.08,
      });
      const glass = new THREE.Mesh(new THREE.BoxGeometry(wingW * 0.98, 0.002, wingH * 0.96), glassMat);
      glass.position.set(sign * wingW / 2, 0.03, 0);
      wg.add(glass);

      // Gold trim frame
      for (const side of [-1, 1]) {
        const trim = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, wingH), MATS.solarFrame);
        trim.position.set(sign * (wingW / 2 + side * wingW / 2), 0.03, 0);
        wg.add(trim);
      }
      for (const side of [-1, 1]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(wingW, 0.05, 0.05), MATS.solarFrame);
        rail.position.set(sign * wingW / 2, 0.03, side * wingH / 2);
        wg.add(rail);
      }
      // Center spine
      const spine = new THREE.Mesh(new THREE.BoxGeometry(wingW * 1.02, 0.06, 0.07), MATS.solarFrame);
      spine.position.set(sign * wingW / 2, 0.04, 0);
      wg.add(spine);

      // Small support ribs across the back
      for (let i = 0; i < 4; i++) {
        const rib = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.06, wingH * 0.95), MATS.solarFrame);
        rib.position.set(sign * (wingW * 0.25 + i * wingW * 0.18), -0.025, 0);
        wg.add(rib);
      }

      g.add(wg);
    }
    return g;
  }

  if (partId && (partId.includes('rtg') || partId.includes('mmrtg'))) {
    // Central body
    addMesh(g, new THREE.CylinderGeometry(d / 2 * 0.75, d / 2 * 0.75, h, 40), MATS.metalDark);

    // Radial cooling fins — 12
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.03, h * 0.86, d * 1.5), MATS.metalMid);
      fin.rotation.y = a;
      fin.position.set(0, 0, 0);
      g.add(fin);
    }

    // Horizontal rib bands
    for (let i = 0; i < 6; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(d / 2 * 0.78, 0.018, 8, 40), MATS.metalDark);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = -h / 2 + (i / 5) * h;
      g.add(ring);
    }

    // Top and bottom caps
    addMesh(g, new THREE.CylinderGeometry(d / 2 * 0.9, d / 2 * 0.75, 0.1, 32), MATS.metalDark, 0, h / 2 + 0.05, 0);
    addMesh(g, new THREE.CylinderGeometry(d / 2 * 0.75, d / 2 * 0.9, 0.1, 32), MATS.metalDark, 0, -h / 2 - 0.05, 0);

    // Bolt rings on caps
    addBoltRing(g, 12, d / 2 * 0.8, h / 2 + 0.1, 0.015);
    addBoltRing(g, 12, d / 2 * 0.8, -h / 2 - 0.1, 0.015);

    return g;
  }

  if (partId && partId.includes('kilopower')) {
    // Reactor core — tall narrow cylinder
    addMesh(g, new THREE.CylinderGeometry(d * 0.3, d * 0.3, h * 1.4, 32), MATS.silver);

    // Core ribs
    for (let i = 0; i < 6; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(d * 0.32, 0.014, 8, 32), MATS.metalDark);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = -h * 0.6 + (i / 5) * h * 1.2;
      g.add(ring);
    }

    // Radiator disk
    const radiator = new THREE.Mesh(new THREE.CylinderGeometry(d / 2, d / 2, 0.06, 64), MATS.metalDark);
    g.add(radiator);

    // Radial radiator fins
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * Math.PI * 2;
      const fin = new THREE.Mesh(new THREE.BoxGeometry(d * 0.4, 0.025, 0.04), MATS.metalMid);
      fin.position.set(Math.cos(a) * d * 0.3, 0.04, Math.sin(a) * d * 0.3);
      fin.rotation.y = -a;
      g.add(fin);
    }

    // Control rod on top
    addMesh(g, new THREE.CylinderGeometry(0.05, 0.05, h * 0.5, 16), MATS.copper, 0, h * 0.85, 0);

    return g;
  }

  if (partId && partId.includes('reactor_large')) {
    addMesh(g, new THREE.CylinderGeometry(d * 0.44, d * 0.44, h, 40), MATS.silver);

    // Core rings
    for (let i = 0; i < 5; i++) {
      const r = new THREE.Mesh(new THREE.TorusGeometry(d * 0.46, 0.06, 10, 40), MATS.metalDark);
      r.rotation.x = Math.PI / 2;
      r.position.y = -h / 2 + (i / 4) * h;
      g.add(r);
    }

    // Radiator cone at the bottom
    const cone = new THREE.Mesh(new THREE.ConeGeometry(d * 1.2, 0.6, 64), MATS.metalBlack);
    cone.position.y = -h / 2 - 0.4;
    cone.rotation.x = Math.PI;
    g.add(cone);

    // Radiating fins
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * Math.PI * 2;
      const fin = new THREE.Mesh(new THREE.BoxGeometry(d * 0.7, 0.012, 0.05), MATS.metalMid);
      fin.position.set(Math.cos(a) * d * 0.6, -h / 2 - 0.18, Math.sin(a) * d * 0.6);
      fin.rotation.y = -a;
      g.add(fin);
    }

    return g;
  }

  if (partId && partId.includes('fuel_cell')) {
    addMesh(g, new THREE.BoxGeometry(d * 0.98, h, d * 0.78), MATS.panelAlum);
    addPanelLine(g, -d * 0.47, h * 0.22, d * 0.47, h * 0.22, d * 0.4);
    addPanelLine(g, -d * 0.47, -h * 0.22, d * 0.47, -h * 0.22, d * 0.4);
    // Small COPV tanks on top
    for (const sign of [-1, 1]) {
      addMesh(g, new THREE.CylinderGeometry(0.09, 0.09, 0.22, 16), MATS.copper, sign * d * 0.32, h * 0.68, 0);
      addMesh(g, new THREE.TorusGeometry(0.09, 0.012, 6, 16), MATS.copperDark, sign * d * 0.32, h * 0.68, 0).rotation.x = Math.PI / 2;
    }
    return g;
  }

  // Battery
  addMesh(g, new THREE.BoxGeometry(d * 0.95, h, d * 0.8), MATS.panelAlum);
  addPanelLine(g, -d * 0.45, h * 0.36, d * 0.45, h * 0.36, d * 0.41);
  addPanelLine(g, -d * 0.45, -h * 0.36, d * 0.45, -h * 0.36, d * 0.41);
  // Terminal posts
  addMesh(g, new THREE.CylinderGeometry(0.03, 0.03, 0.06, 12), MATS.copper, -d * 0.25, h / 2 + 0.03, 0);
  addMesh(g, new THREE.CylinderGeometry(0.03, 0.03, 0.06, 12), MATS.copper, d * 0.25, h / 2 + 0.03, 0);
  return g;
}

// ---------- PAYLOAD BUS ----------

function makePayloadBus(h, d) {
  const g = new THREE.Group();
  const w = d * 0.95;
  const baseY = -h / 2;
  const railH = h * 0.7;
  const busTopY = -h / 2 + railH;

  // Octagonal base plate
  const basePlate = new THREE.Mesh(new THREE.CylinderGeometry(w / 2, w / 2 * 0.96, 0.07, 8), MATS.panelAlum);
  basePlate.position.y = baseY + 0.04;
  g.add(basePlate);
  addBoltRing(g, 8, w * 0.4, baseY + 0.08, 0.024);

  // Corner rails — carbon fiber
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const x = Math.cos(a) * (w / 2 - 0.04);
    const z = Math.sin(a) * (w / 2 - 0.04);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.07, railH, 0.07), MATS.carbon);
    rail.position.set(x, baseY + railH / 2, z);
    g.add(rail);
  }

  // Side panels — 2 aluminum, 2 MLI
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const x = Math.cos(a) * (w / 2);
    const z = Math.sin(a) * (w / 2);
    const panelW = w * 0.72;
    const isMLI = i % 2 === 1;
    const panelMat = isMLI ? MATS.mli : MATS.panelAlum;

    const panel = new THREE.Mesh(new THREE.BoxGeometry(panelW, railH * 0.85, 0.025), panelMat);
    panel.position.set(x * 0.98, baseY + railH / 2, z * 0.98);
    panel.rotation.y = -a;
    g.add(panel);

    if (!isMLI) {
      // Rivets along the panel edges
      const rivetCount = 8;
      for (let r = 0; r < rivetCount; r++) {
        const t = (r + 0.5) / rivetCount;
        const px = (t - 0.5) * panelW;
        const rivet = new THREE.Mesh(new THREE.SphereGeometry(0.007, 6, 4), MATS.metalMid);
        rivet.position.set(
          x * 0.98 + Math.cos(-a) * px,
          baseY + railH * 0.08,
          z * 0.98 + Math.sin(-a) * px
        );
        g.add(rivet);
        const rivet2 = rivet.clone();
        rivet2.position.y = baseY + railH * 0.92;
        g.add(rivet2);
      }
    } else {
      // MLI blanket seam
      const seam = new THREE.Mesh(new THREE.BoxGeometry(0.025, railH * 0.78, 0.04), MATS.metalDark);
      seam.position.set(x * 1.01, baseY + railH / 2, z * 1.01);
      seam.rotation.y = -a;
      g.add(seam);
    }
  }

  // Top plate
  const topPlate = new THREE.Mesh(new THREE.CylinderGeometry(w / 2 * 0.92, w / 2, 0.06, 8), MATS.panelAlum);
  topPlate.position.y = busTopY;
  g.add(topPlate);
  addBoltRing(g, 8, w * 0.36, busTopY + 0.04, 0.022);

  // Umbilical connector with pins
  const umb = new THREE.Group();
  umb.position.set(w / 2 + 0.03, baseY + railH * 0.3, 0);
  addMesh(umb, new THREE.BoxGeometry(0.1, 0.16, 0.08), MATS.copper);
  for (let i = 0; i < 6; i++) {
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.03, 6), MATS.copperDark);
    pin.rotation.z = Math.PI / 2;
    pin.position.set(0.065, -0.05 + (i % 3) * 0.05, -0.03 + Math.floor(i / 3) * 0.06);
    umb.add(pin);
  }
  g.add(umb);

  // Wire bundles
  addTube(g, [
    new THREE.Vector3(w / 2 + 0.04, baseY + railH * 0.3, 0),
    new THREE.Vector3(w / 2 - 0.02, baseY + railH * 0.5, 0.06),
    new THREE.Vector3(w / 2 - 0.12, baseY + railH * 0.85, 0.1),
    new THREE.Vector3(w / 2 - 0.18, busTopY + 0.06, 0.12),
  ], MATS.metalBlack, 0.016);

  addTube(g, [
    new THREE.Vector3(-w / 2 + 0.02, baseY + railH * 0.15, 0.12),
    new THREE.Vector3(-w / 2 + 0.06, baseY + railH * 0.5, 0.1),
    new THREE.Vector3(-w / 2 + 0.12, baseY + railH * 0.9, 0.06),
  ], MATS.metalBlack, 0.012);

  // Status LED — very bright, blooms nicely
  const led = new THREE.Mesh(
    new THREE.SphereGeometry(0.028, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0x44ff66, emissive: 0x44ff66, emissiveIntensity: 15 })
  );
  led.position.set(0, baseY + railH * 0.6, w / 2 + 0.02);
  g.add(led);
  // LED housing
  const ledHousing = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.02, 12), MATS.metalDark);
  ledHousing.rotation.x = Math.PI / 2;
  ledHousing.position.set(0, baseY + railH * 0.6, w / 2 + 0.008);
  g.add(ledHousing);

  // Vent ports at the corners
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const x = Math.cos(a) * (w / 2 - 0.02);
    const z = Math.sin(a) * (w / 2 - 0.02);
    const vent = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.04), MATS.metalDark);
    vent.position.set(x, baseY + railH * 0.85, z);
    vent.rotation.y = -a;
    g.add(vent);
    // Louvers
    for (let l = 0; l < 3; l++) {
      const louver = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.008, 0.02), MATS.metalBlack);
      louver.position.set(x, baseY + railH * 0.85 - 0.018 + l * 0.018, z);
      louver.rotation.y = -a;
      g.add(louver);
    }
  }

  g.userData.busTopY = busTopY;
  return g;
}

// ---------- INSTRUMENTS ----------

function instCamera(h, d, hires) {
  const g = new THREE.Group();
  const y = h / 2 - 0.02;
  const barrel = d * 0.55;

  // Gimbal base
  addMesh(g, new THREE.CylinderGeometry(barrel * 0.72, barrel * 0.72, 0.07, 24), MATS.metalMid, 0, y - 0.05, 0);
  addMesh(g, new THREE.TorusGeometry(barrel * 0.62, 0.028, 10, 24), MATS.silver, 0, y + 0.02, 0).rotation.x = Math.PI / 2;
  // Bolts on gimbal
  addBoltRing(g, 12, barrel * 0.65, y + 0.03, 0.008);

  // Camera body — with panel texture
  const bodyH = barrel * 0.95;
  addMesh(g, new THREE.CylinderGeometry(barrel * 0.58, barrel * 0.58, bodyH, 32), MATS.panelAlum, 0, y + bodyH / 2 + 0.06, 0);

  // Panel seam around the body
  const pl = new THREE.Mesh(new THREE.TorusGeometry(barrel * 0.59, 0.008, 6, 32), MATS.metalBlack);
  pl.rotation.x = Math.PI / 2;
  pl.position.y = y + bodyH / 2 + 0.06;
  g.add(pl);

  const numLenses = hires ? 3 : 1;
  const spacing = numLenses === 1 ? 0 : barrel * 0.9;
  for (let i = 0; i < numLenses; i++) {
    const off = numLenses === 1 ? 0 : (i - (numLenses - 1) / 2) * spacing;

    const lensGroup = new THREE.Group();
    lensGroup.position.set(off, y + bodyH / 2 + 0.06, barrel * 0.55);
    lensGroup.rotation.x = Math.PI / 2;

    // Outer barrel
    addMesh(lensGroup, new THREE.CylinderGeometry(barrel * 0.3, barrel * 0.3, barrel * 1.1, 32), MATS.metalBlack, 0, barrel * 0.55, 0);
    // Mid barrel ring
    addMesh(lensGroup, new THREE.TorusGeometry(barrel * 0.31, 0.012, 8, 32), MATS.copper, 0, barrel * 0.5, 0).rotation.x = Math.PI / 2;
    // Inner ring detail
    const innerRing = new THREE.Mesh(new THREE.TorusGeometry(barrel * 0.24, 0.014, 8, 28), MATS.copper);
    innerRing.rotation.x = Math.PI / 2;
    innerRing.position.y = barrel * 1.08;
    lensGroup.add(innerRing);

    // Multi-layer lens stack
    addMesh(lensGroup, new THREE.CircleGeometry(barrel * 0.22, 32), MATS.lensFront, 0, barrel * 1.1, 0).rotation.x = -Math.PI / 2;
    addMesh(lensGroup, new THREE.CircleGeometry(barrel * 0.14, 24), MATS.lensGlass, 0, barrel * 0.85, 0).rotation.x = -Math.PI / 2;

    // Aperture ring
    addMesh(lensGroup, new THREE.TorusGeometry(barrel * 0.28, 0.01, 8, 28), MATS.copper, 0, barrel * 1.12, 0).rotation.x = Math.PI / 2;

    // Lens hood — flared outward
    const hood = new THREE.Mesh(
      new THREE.CylinderGeometry(barrel * 0.44, barrel * 0.32, barrel * 0.42, 32, 1, true),
      MATS.metalBlack
    );
    hood.rotation.x = Math.PI / 2;
    hood.position.y = barrel * 1.35;
    lensGroup.add(hood);
    // Hood edge trim
    addMesh(lensGroup, new THREE.TorusGeometry(barrel * 0.44, 0.008, 8, 32), MATS.copper, 0, barrel * 1.55, 0).rotation.x = Math.PI / 2;

    g.add(lensGroup);
  }

  // Data cable
  addTube(g, [
    new THREE.Vector3(0, y + 0.06, -barrel * 0.58),
    new THREE.Vector3(0, y - 0.4, -barrel * 0.52),
    new THREE.Vector3(0.05, y - 0.8, -barrel * 0.42),
  ], MATS.metalBlack, 0.016);

  return g;
}

function instSpectrometer(h, d) {
  const g = new THREE.Group();
  const y = h / 2 - 0.02;
  const base = d * 0.55;

  // Mount
  addMesh(g, new THREE.BoxGeometry(base, 0.07, base * 0.75), MATS.metalMid, 0, y - 0.05, 0);

  // Housing with panel texture
  addMesh(g, new THREE.BoxGeometry(base * 0.95, base * 0.75, base * 0.85), MATS.panelAlum, 0, y + base * 0.38, 0);
  addPanelLine(g, -base * 0.47, y + base * 0.38, base * 0.47, y + base * 0.38, base * 0.43);

  // Inlet horn — tapered with baffles
  const hornGeo = new THREE.CylinderGeometry(base * 0.38, base * 0.13, base * 0.6, 32, 1, true);
  const horn = new THREE.Mesh(hornGeo, MATS.copper);
  horn.position.y = y + base * 1.02;
  g.add(horn);

  // Baffle rings inside
  for (let i = 0; i < 4; i++) {
    const t = i / 4;
    const r = base * 0.13 + (base * 0.38 - base * 0.13) * t;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.008, 8, 28), MATS.copperDark);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y + base * 0.78 + i * base * 0.12;
    g.add(ring);
  }

  // Top lip
  const lip = new THREE.Mesh(new THREE.TorusGeometry(base * 0.38, 0.014, 8, 32), MATS.copperDark);
  lip.rotation.x = Math.PI / 2;
  lip.position.y = y + base * 1.32;
  g.add(lip);

  // Detector array on the side
  for (let i = 0; i < 4; i++) {
    const det = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.16, 16), MATS.metalBlack);
    det.rotation.z = Math.PI / 2;
    det.position.set(base * 0.55, y + base * 0.4 + i * 0.11, 0);
    g.add(det);
    // Connector at the end
    addMesh(g, new THREE.CylinderGeometry(0.025, 0.025, 0.03, 12), MATS.copper, base * 0.63, y + base * 0.4 + i * 0.11, 0).rotation.z = Math.PI / 2;
  }

  // Data cable from detector
  addTube(g, [
    new THREE.Vector3(base * 0.66, y + base * 0.4, 0),
    new THREE.Vector3(base * 0.6, y - 0.1, 0.1),
    new THREE.Vector3(base * 0.4, y - 0.5, 0.15),
  ], MATS.metalBlack, 0.012);

  return g;
}

function instRadar(h, d) {
  const g = new THREE.Group();
  const y = h / 2 - 0.02;
  const size = d * 0.55;

  // Gimbal mount
  addMesh(g, new THREE.BoxGeometry(size * 0.65, 0.1, size * 0.65), MATS.metalMid, 0, y - 0.05, 0);
  addMesh(g, new THREE.CylinderGeometry(0.06, 0.06, 0.18, 16), MATS.silver, 0, y + 0.09, 0);
  addMesh(g, new THREE.TorusGeometry(0.075, 0.015, 8, 20), MATS.metalDark, 0, y + 0.02, 0).rotation.x = Math.PI / 2;

  // Parabolic dish via lathe — real parabolic profile
  const pts = [];
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    pts.push(new THREE.Vector2(t * size * 0.55, -t * t * size * 0.4));
  }
  const dish = new THREE.Mesh(new THREE.LatheGeometry(pts, 64), MATS.dishGold);
  dish.position.y = y + size * 0.6;
  dish.rotation.x = Math.PI;
  g.add(dish);

  // Back rim
  const rim = new THREE.Mesh(new THREE.TorusGeometry(size * 0.55, 0.018, 10, 64), MATS.metalMid);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = y + size * 0.6 - size * 0.4;
  g.add(rim);

  // Feed horn on 3 struts
  const feedY = y + size * 0.6 + size * 0.2;
  addMesh(g, new THREE.ConeGeometry(0.05, 0.12, 16), MATS.copper, 0, feedY, 0);
  addMesh(g, new THREE.CylinderGeometry(0.02, 0.02, 0.06, 10), MATS.metalDark, 0, feedY + 0.08, 0);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, size * 0.55, 8), MATS.silver);
    strut.position.set(Math.cos(a) * size * 0.28, feedY - size * 0.17, Math.sin(a) * size * 0.28);
    strut.rotation.z = Math.atan2(size * 0.28, size * 0.34);
    strut.rotation.y = -a;
    g.add(strut);
  }

  // Waveguide tube
  addTube(g, [
    new THREE.Vector3(0, y + size * 0.22, 0),
    new THREE.Vector3(0.12, y - 0.12, 0.06),
    new THREE.Vector3(0.18, y - 0.4, 0.12),
  ], MATS.copper, 0.02);

  return g;
}

function instMagnetometer(h, d) {
  const g = new THREE.Group();
  const y = h / 2 - 0.02;
  const size = d * 0.55;

  // Deployment canister
  addMesh(g, new THREE.BoxGeometry(size * 0.55, 0.14, size * 0.45), MATS.metalMid, -size * 0.32, y, 0);

  // Boom — 3 telescoping segments
  const segs = [
    { x: -size * 0.05, r: 0.05, len: size * 0.7 },
    { x: size * 0.55, r: 0.035, len: size * 0.6 },
    { x: size * 1.05, r: 0.025, len: size * 0.5 },
  ];
  for (const s of segs) {
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(s.r, s.r, s.len, 16), MATS.silver);
    seg.rotation.z = Math.PI / 2;
    seg.position.set(s.x, y + 0.02, 0);
    g.add(seg);
  }

  // Connector rings between segments
  for (const x of [size * 0.3, size * 0.85]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 8, 20), MATS.metalDark);
    ring.rotation.y = Math.PI / 2;
    ring.position.set(x, y + 0.02, 0);
    g.add(ring);
  }

  // 3-axis fluxgate at the tip
  addMesh(g, new THREE.SphereGeometry(0.09, 20, 14), MATS.metalDark, size * 1.35, y + 0.02, 0);
  // Orthogonal sensor bars
  addMesh(g, new THREE.BoxGeometry(0.26, 0.025, 0.025), MATS.copper, size * 1.35, y + 0.02, 0);
  addMesh(g, new THREE.BoxGeometry(0.025, 0.26, 0.025), MATS.copper, size * 1.35, y + 0.02, 0);
  addMesh(g, new THREE.BoxGeometry(0.025, 0.025, 0.26), MATS.copper, size * 1.35, y + 0.02, 0);

  // Cable along the boom
  addTube(g, [
    new THREE.Vector3(-size * 0.22, y + 0.06, 0.04),
    new THREE.Vector3(size * 0.4, y + 0.06, 0.04),
    new THREE.Vector3(size * 1.2, y + 0.06, 0.04),
  ], MATS.metalBlack, 0.01);

  return g;
}

function instDrill(h, d) {
  const g = new THREE.Group();
  const y = h / 2 - 0.02;
  const size = d * 0.55;

  // Housing
  addMesh(g, new THREE.BoxGeometry(size * 0.75, size * 0.55, size * 0.65), MATS.metalMid, 0, y + size * 0.28, 0);
  addPanelLine(g, -size * 0.37, y + size * 0.28, size * 0.37, y + size * 0.28, size * 0.33);

  // Rotary head
  addMesh(g, new THREE.CylinderGeometry(0.07, 0.07, size * 0.45, 24), MATS.silver, 0, y + size * 0.75, 0);
  addMesh(g, new THREE.TorusGeometry(0.075, 0.014, 8, 24), MATS.copper, 0, y + size * 0.98, 0).rotation.x = Math.PI / 2;

  // Auger with helical flutes
  const bitLen = size * 1.0;
  const bitR = 0.045;
  const tipY = y + size * 1.0 + bitLen / 2;

  addMesh(g, new THREE.CylinderGeometry(bitR * 0.45, bitR * 0.45, bitLen, 12), MATS.silver, 0, tipY, 0);

  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const pts = [];
    for (let s = 0; s <= 10; s++) {
      const t = s / 10;
      const yp = y + size * 1.0 + t * bitLen;
      const ang = a + t * Math.PI * 3;
      pts.push(new THREE.Vector3(Math.cos(ang) * bitR, yp, Math.sin(ang) * bitR));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const flute = new THREE.Mesh(new THREE.TubeGeometry(curve, 32, 0.013, 8, false), MATS.metalMid);
    g.add(flute);
  }

  // Drill tip
  const tip = new THREE.Mesh(new THREE.ConeGeometry(bitR * 1.4, bitR * 2.5, 16), MATS.copper);
  tip.position.y = y + size * 1.0 + bitLen + bitR;
  g.add(tip);

  // Sample canister with glass viewport
  const canister = new THREE.Group();
  canister.position.set(size * 0.45, y + size * 0.28, 0);
  addMesh(canister, new THREE.CylinderGeometry(0.06, 0.06, 0.2, 20), MATS.panelAlum);
  addMesh(canister, new THREE.TorusGeometry(0.062, 0.008, 6, 20), MATS.copper, 0, 0.09, 0).rotation.x = Math.PI / 2;
  addMesh(canister, new THREE.TorusGeometry(0.062, 0.008, 6, 20), MATS.copper, 0, -0.09, 0).rotation.x = Math.PI / 2;
  // Glass window
  const win = new THREE.Mesh(new THREE.CircleGeometry(0.028, 16), MATS.glass);
  win.rotation.y = Math.PI / 2;
  win.position.x = 0.062;
  canister.add(win);
  g.add(canister);

  // Actuators
  for (const sx of [-1, 1]) {
    const act = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, size * 0.55, 12), MATS.copper);
    act.position.set(sx * size * 0.32, y + size * 0.65, 0);
    g.add(act);
  }

  return g;
}

function instRover(h, d) {
  const g = new THREE.Group();
  const y = h / 2 - 0.02;
  const size = d * 0.6;

  // Chassis plate
  addMesh(g, new THREE.BoxGeometry(size * 1.15, 0.08, size * 0.75), MATS.panelAlum, 0, y + 0.2, 0);

  // Equipment deck
  addMesh(g, new THREE.BoxGeometry(size * 0.62, 0.16, size * 0.55), MATS.panelAlum, 0, y + 0.32, 0);
  addPanelLine(g, -size * 0.31, y + 0.32, size * 0.31, y + 0.32, size * 0.28);

  // Solar deck
  const panelMat = new THREE.MeshStandardMaterial({
    map: getSolarTexture(),
    metalness: 0.75,
    roughness: 0.25,
    emissive: 0x061030,
    emissiveIntensity: 0.5,
  });
  addMesh(g, new THREE.BoxGeometry(size * 1.25, 0.012, size * 0.85), panelMat, 0, y + 0.42, 0);
  addMesh(g, new THREE.BoxGeometry(size * 1.3, 0.018, size * 0.9), MATS.solarFrame, 0, y + 0.4, 0);

  // Mast
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, size * 0.55, 12), MATS.silver);
  mast.position.set(size * 0.5, y + 0.75, 0);
  g.add(mast);
  // Mast head
  addMesh(g, new THREE.BoxGeometry(0.14, 0.09, 0.09), MATS.metalDark, size * 0.5, y + 1.02, 0);
  // Camera lens
  addMesh(g, new THREE.CylinderGeometry(0.025, 0.025, 0.07, 16), MATS.metalBlack, size * 0.5, y + 1.02, 0.07).rotation.x = Math.PI / 2;
  addMesh(g, new THREE.CircleGeometry(0.02, 16), MATS.lensFront, size * 0.5, y + 1.02, 0.1);

  // Wheels — 6, with visible suspension
  for (const side of [-1, 1]) {
    const z = side * size * 0.38;
    // Rocker arm
    const rocker = new THREE.Mesh(new THREE.BoxGeometry(size * 0.95, 0.04, 0.04), MATS.metalDark);
    rocker.position.set(0, y + 0.1, z);
    g.add(rocker);

    for (let i = 0; i < 3; i++) {
      const wx = (i - 1) * size * 0.4;
      // Suspension arm
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.12, 8), MATS.silver);
      arm.position.set(wx, y + 0.06, z);
      g.add(arm);

      // Wheel
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.05, 24), MATS.metalBlack);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(wx, y + 0.02, z);
      g.add(wheel);

      // Hub
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.055, 12), MATS.copper);
      hub.rotation.x = Math.PI / 2;
      hub.position.set(wx, y + 0.02, z);
      g.add(hub);

      // Tread pattern — small notches around the wheel
      for (let t = 0; t < 16; t++) {
        const ta = (t / 16) * Math.PI * 2;
        const tread = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.055, 0.01), MATS.metalDark);
        tread.position.set(wx + Math.cos(ta) * 0.068, y + 0.02, z + Math.sin(ta) * 0.068);
        tread.rotation.x = Math.PI / 2;
        g.add(tread);
      }
    }
  }

  // Sample arm — folded
  const arm1 = new THREE.Mesh(new THREE.BoxGeometry(size * 0.55, 0.035, 0.035), MATS.silver);
  arm1.position.set(-size * 0.6, y + 0.2, size * 0.22);
  g.add(arm1);
  const arm2 = new THREE.Mesh(new THREE.BoxGeometry(size * 0.35, 0.025, 0.025), MATS.silver);
  arm2.position.set(-size * 0.82, y + 0.4, size * 0.22);
  arm2.rotation.z = 0.55;
  g.add(arm2);

  // Sample scoop at end of arm
  addMesh(g, new THREE.BoxGeometry(0.06, 0.04, 0.08), MATS.copper, -size * 0.95, y + 0.6, size * 0.22);

  // Comms antenna
  addMesh(g, new THREE.CylinderGeometry(0.022, 0.022, 0.12, 10), MATS.silver, -size * 0.42, y + 0.55, -size * 0.16);
  const ad = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.05, 16, 1, true), MATS.dishWhite);
  ad.rotation.x = Math.PI;
  ad.position.set(-size * 0.42, y + 0.63, -size * 0.16);
  g.add(ad);

  return g;
}

function instSampleReturn(h, d) {
  const g = new THREE.Group();
  const y = h / 2 - 0.02;
  const size = d * 0.55;

  // Heat shield via lathe
  const pts = [];
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    const r = Math.sin(Math.PI * t * 0.5) * size * 0.55;
    const yy = -Math.cos(Math.PI * t * 0.5) * size * 0.45;
    pts.push(new THREE.Vector2(r, yy));
  }
  const hs = new THREE.Mesh(new THREE.LatheGeometry(pts, 48), MATS.noseAblative);
  hs.position.set(0, y + size * 0.22, 0);
  g.add(hs);

  // Tile lines radiating on the heat shield
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const line = new THREE.Mesh(new THREE.BoxGeometry(0.006, size * 0.4, 0.006), MATS.metalDark);
    line.position.set(Math.cos(a) * size * 0.22, y + size * 0.16, Math.sin(a) * size * 0.22);
    g.add(line);
  }

  // Backshell
  const back = new THREE.Mesh(
    new THREE.SphereGeometry(size * 0.55, 48, 32, 0, Math.PI * 2, 0, Math.PI * 0.72),
    MATS.nose
  );
  back.position.set(0, y + size * 0.22, 0);
  g.add(back);

  // Backshell seam
  const pl = new THREE.Mesh(new THREE.TorusGeometry(size * 0.38, 0.008, 8, 48), MATS.metalBlack);
  pl.rotation.x = Math.PI / 2;
  pl.position.y = y + size * 0.48;
  g.add(pl);

  // Parachute housing
  addMesh(g, new THREE.CylinderGeometry(size * 0.2, size * 0.2, size * 0.18, 24), MATS.metalMid, 0, y + size * 0.82, 0);
  addMesh(g, new THREE.CylinderGeometry(size * 0.11, size * 0.2, 0.035, 24), MATS.metalDark, 0, y + size * 0.93, 0);
  // Rivets around housing
  addRivetRing(g, 16, size * 0.2, y + size * 0.78, 0.006);

  // Sample window with viewport
  const winGroup = new THREE.Group();
  winGroup.position.set(size * 0.38, y + size * 0.36, size * 0.28);
  winGroup.lookAt(size * 0.38, y + size * 0.36, size * 0.55);
  addMesh(winGroup, new THREE.CircleGeometry(0.035, 20), MATS.glass, 0, 0, 0);
  addMesh(winGroup, new THREE.TorusGeometry(0.036, 0.006, 8, 20), MATS.copper, 0, 0, 0);
  g.add(winGroup);

  // Separation motors
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const motorGroup = new THREE.Group();
    motorGroup.position.set(Math.cos(a) * size * 0.6, y + size * 0.16, Math.sin(a) * size * 0.6);
    motorGroup.rotation.y = -a;
    // Motor body
    addMesh(motorGroup, new THREE.CylinderGeometry(0.045, 0.045, 0.12, 16), MATS.metalDark).rotation.z = Math.PI / 2;
    // Nozzle
    addMesh(motorGroup, new THREE.CylinderGeometry(0.03, 0.02, 0.04, 12), MATS.copper, -0.08, 0, 0).rotation.z = Math.PI / 2;
    g.add(motorGroup);
  }

  return g;
}

function instAstrobiology(h, d) {
  const g = new THREE.Group();
  const y = h / 2 - 0.02;
  const size = d * 0.55;

  // Processing unit
  addMesh(g, new THREE.BoxGeometry(size * 1.05, size * 0.55, size * 0.85), MATS.panelAlum, 0, y + size * 0.28, 0);
  addPanelLine(g, -size * 0.52, y + size * 0.28, size * 0.52, y + size * 0.28, size * 0.43);

  // Iris intake
  const intakeGroup = new THREE.Group();
  intakeGroup.position.set(size * 0.55, y + size * 0.15, 0);
  intakeGroup.rotation.z = Math.PI / 2;
  addMesh(intakeGroup, new THREE.CylinderGeometry(0.09, 0.09, 0.12, 24), MATS.copper);
  // Iris blades
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.01, 0.006), MATS.metalDark);
    blade.position.set(Math.cos(a) * 0.055, 0.065, Math.sin(a) * 0.055);
    intakeGroup.add(blade);
  }
  g.add(intakeGroup);

  // Glass chamber
  const chamberGroup = new THREE.Group();
  chamberGroup.position.set(0, y + size * 0.75, 0);
  addMesh(chamberGroup, new THREE.CylinderGeometry(0.13, 0.13, size * 0.45, 32), MATS.silver);
  const chamberGlass = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.11, size * 0.4, 32, 1, true),
    new THREE.MeshStandardMaterial({
      color: 0xaaccff,
      transparent: true,
      opacity: 0.4,
      metalness: 0.9,
      roughness: 0.05,
      side: THREE.DoubleSide,
      emissive: 0x334488,
      emissiveIntensity: 0.3,
    })
  );
  chamberGroup.add(chamberGlass);
  g.add(chamberGroup);

  // Microscope head
  addMesh(g, new THREE.CylinderGeometry(0.055, 0.055, size * 0.35, 20), MATS.metalDark, 0, y + size * 1.15, 0);
  // Eyepiece angled
  const eye = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.1, 14), MATS.metalMid);
  eye.position.set(size * 0.07, y + size * 1.28, 0);
  eye.rotation.z = 0.45;
  g.add(eye);
  // Objective lens
  addMesh(g, new THREE.CylinderGeometry(0.03, 0.03, 0.06, 14), MATS.copper, 0, y + size * 0.98, 0);
  addMesh(g, new THREE.CircleGeometry(0.025, 16), MATS.lensGlass, 0, y + size * 0.95, 0).rotation.x = -Math.PI / 2;

  // Fluid lines running around
  addTube(g, [
    new THREE.Vector3(-size * 0.55, y + size * 0.1, size * 0.32),
    new THREE.Vector3(-size * 0.35, y + size * 0.42, size * 0.38),
    new THREE.Vector3(size * 0.25, y + size * 0.52, size * 0.38),
    new THREE.Vector3(size * 0.45, y + size * 0.15, size * 0.32),
  ], MATS.copper, 0.01);

  // Waste vent
  const ventGroup = new THREE.Group();
  ventGroup.position.set(-size * 0.55, y + size * 0.22, -size * 0.32);
  ventGroup.rotation.z = Math.PI / 2;
  addMesh(ventGroup, new THREE.CylinderGeometry(0.035, 0.035, 0.1, 16), MATS.metalDark);
  addMesh(ventGroup, new THREE.TorusGeometry(0.036, 0.007, 6, 16), MATS.copper, 0.05, 0, 0);
  g.add(ventGroup);

  return g;
}

function instLidar(h, d) {
  const g = new THREE.Group();
  const y = h / 2 - 0.02;
  const size = d * 0.55;

  // Optical bench
  addMesh(g, new THREE.BoxGeometry(size * 1.15, 0.05, size * 0.85), MATS.metalMid, 0, y - 0.02, 0);

  // Housing
  addMesh(g, new THREE.BoxGeometry(size * 0.95, size * 0.55, size * 0.75), MATS.panelAlum, 0, y + size * 0.25, 0);

  // Receive telescope
  const scope = new THREE.Group();
  scope.position.set(-size * 0.58, y + size * 0.32, 0);
  addMesh(scope, new THREE.CylinderGeometry(0.11, 0.11, size * 0.55, 32), MATS.metalDark).rotation.z = Math.PI / 2;
  addMesh(scope, new THREE.TorusGeometry(0.11, 0.014, 10, 32), MATS.copper, -size * 0.275, 0, 0).rotation.z = Math.PI / 2;
  addMesh(scope, new THREE.TorusGeometry(0.11, 0.014, 10, 32), MATS.copper, size * 0.275, 0, 0).rotation.z = Math.PI / 2;
  // Lens at the end
  addMesh(scope, new THREE.CircleGeometry(0.09, 32), MATS.lensFront, -size * 0.28, 0, 0).rotation.y = -Math.PI / 2;
  addMesh(scope, new THREE.CircleGeometry(0.06, 20), MATS.lensGlass, -size * 0.2, 0, 0).rotation.y = -Math.PI / 2;
  g.add(scope);

  // Laser aperture
  const laser = new THREE.Group();
  laser.position.set(-size * 0.58, y + size * 0.12, 0);
  addMesh(laser, new THREE.CylinderGeometry(0.045, 0.045, 0.18, 20), MATS.metalBlack).rotation.z = Math.PI / 2;
  addMesh(laser, new THREE.TorusGeometry(0.045, 0.008, 6, 20), MATS.red, -size * 0.09, 0, 0).rotation.z = Math.PI / 2;
  g.add(laser);

  // Cooling fins on top
  for (let i = 0; i < 6; i++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(size * 0.95, size * 0.16, 0.018), MATS.metalMid);
    fin.position.set(0, y + size * 0.6, (i - 2.5) * 0.055);
    g.add(fin);
  }

  // Gimbal base
  addMesh(g, new THREE.CylinderGeometry(0.12, 0.14, 0.12, 20), MATS.metalDark, 0, y - 0.12, 0);
  addMesh(g, new THREE.TorusGeometry(0.13, 0.015, 8, 24), MATS.silver, 0, y - 0.18, 0).rotation.x = Math.PI / 2;

  return g;
}

function instIceMapper(h, d) {
  const g = new THREE.Group();
  const y = h / 2 - 0.02;
  const size = d * 0.55;

  // Combined radar + neutron stack
  addMesh(g, new THREE.BoxGeometry(size * 0.95, size * 0.45, size * 0.75), MATS.panelAlum, 0, y + size * 0.24, 0);

  // Radar dish
  const pts = [];
  for (let i = 0; i <= 18; i++) {
    const t = i / 18;
    pts.push(new THREE.Vector2(t * size * 0.5, -t * t * size * 0.32));
  }
  const dish = new THREE.Mesh(new THREE.LatheGeometry(pts, 48), MATS.dishWhite);
  dish.position.y = y + size * 0.6;
  dish.rotation.x = Math.PI;
  g.add(dish);

  // Rim
  const rim = new THREE.Mesh(new THREE.TorusGeometry(size * 0.5, 0.012, 8, 48), MATS.metalMid);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = y + size * 0.6 - size * 0.32;
  g.add(rim);

  // Feed horn
  addMesh(g, new THREE.ConeGeometry(0.045, 0.1, 16), MATS.copper, 0, y + size * 0.78, 0);
  addMesh(g, new THREE.CylinderGeometry(0.015, 0.015, 0.06, 10), MATS.metalDark, 0, y + size * 0.86, 0);

  // Neutron detector — MLI-wrapped
  const detGroup = new THREE.Group();
  detGroup.position.set(size * 0.55, y + size * 0.45, 0);
  detGroup.rotation.z = Math.PI / 2;
  addMesh(detGroup, new THREE.CylinderGeometry(0.09, 0.09, size * 0.35, 24), MATS.mli);
  // Straps
  for (let i = 0; i < 3; i++) {
    const strap = new THREE.Mesh(new THREE.TorusGeometry(0.092, 0.008, 6, 24), MATS.metalDark);
    strap.rotation.x = Math.PI / 2;
    strap.position.y = -size * 0.12 + i * size * 0.12;
    detGroup.add(strap);
  }
  g.add(detGroup);

  // PMT
  addMesh(g, new THREE.CylinderGeometry(0.055, 0.055, 0.14, 16), MATS.metalDark, size * 0.55 + size * 0.18, y + size * 0.45, 0).rotation.z = Math.PI / 2;

  return g;
}

function instMicroRover(h, d) {
  const g = new THREE.Group();
  const y = h / 2 - 0.02;
  const size = d * 0.6;

  // 4 tiny rovers
  for (let i = 0; i < 4; i++) {
    const row = Math.floor(i / 2);
    const col = i % 2;
    const ox = (col - 0.5) * size * 0.6;
    const oz = (row - 0.5) * size * 0.6;

    // Body
    addMesh(g, new THREE.BoxGeometry(size * 0.42, 0.07, size * 0.32), MATS.silver, ox, y + 0.16, oz);

    // Solar panel on top
    const panelMat = new THREE.MeshStandardMaterial({
      map: getSolarTexture(),
      metalness: 0.75,
      roughness: 0.25,
      emissive: 0x061030,
      emissiveIntensity: 0.5,
    });
    addMesh(g, new THREE.BoxGeometry(size * 0.48, 0.009, size * 0.38), panelMat, ox, y + 0.2, oz);

    // Wheels
    for (const [sx, sz] of [[-0.11, 0.09], [0.11, 0.09], [-0.11, -0.09], [0.11, -0.09]]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.027, 0.027, 0.017, 14), MATS.metalBlack);
      w.rotation.x = Math.PI / 2;
      w.position.set(ox + sx * size, y + 0.11, oz + sz * size);
      g.add(w);
    }

    // Mast
    addMesh(g, new THREE.CylinderGeometry(0.009, 0.009, 0.13, 6), MATS.silver, ox + size * 0.12, y + 0.29, oz);
    addMesh(g, new THREE.BoxGeometry(0.035, 0.022, 0.022), MATS.metalDark, ox + size * 0.12, y + 0.36, oz);
  }

  // Deployment base
  addMesh(g, new THREE.BoxGeometry(size * 1.4, 0.055, size * 1.4), MATS.metalMid, 0, y - 0.02, 0);

  return g;
}

function instWeather(h, d) {
  const g = new THREE.Group();
  const y = h / 2 - 0.02;
  const size = d * 0.55;

  // Base
  addMesh(g, new THREE.BoxGeometry(size * 0.85, 0.07, size * 0.85), MATS.panelAlum, 0, y - 0.02, 0);

  // Central mast
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, size * 1.7, 12), MATS.silver);
  mast.position.y = y + size * 0.85;
  g.add(mast);

  // Guy wires
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, size * 1.75, 4), MATS.metalDark);
    const tilt = Math.atan2(size * 0.5, size * 1.5);
    wire.position.set(Math.cos(a) * size * 0.25, y + size * 0.82, Math.sin(a) * size * 0.25);
    wire.rotation.z = tilt;
    wire.rotation.y = -a;
    g.add(wire);
  }

  // Anemometer — 3 cups
  const anemoGroup = new THREE.Group();
  anemoGroup.position.y = y + size * 1.75;
  addMesh(anemoGroup, new THREE.CylinderGeometry(0.022, 0.022, 0.055, 12), MATS.metalDark);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.01, 0.01), MATS.silver);
    arm.position.set(Math.cos(a) * 0.08, 0, Math.sin(a) * 0.08);
    arm.rotation.y = -a;
    anemoGroup.add(arm);
    const cup = new THREE.Mesh(new THREE.SphereGeometry(0.02, 10, 8, 0, Math.PI), MATS.silver);
    cup.position.set(Math.cos(a) * 0.16, 0, Math.sin(a) * 0.16);
    cup.rotation.y = -a + Math.PI / 2;
    anemoGroup.add(cup);
  }
  g.add(anemoGroup);

  // Wind vane
  const vaneGroup = new THREE.Group();
  vaneGroup.position.y = y + size * 1.6;
  addMesh(vaneGroup, new THREE.CylinderGeometry(0.018, 0.018, 0.045, 10), MATS.metalDark);
  const vane = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.022, 0.032), MATS.silver);
  vane.position.set(0.06, 0, 0);
  vaneGroup.add(vane);
  const vaneTail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.055, 0.001), MATS.silver);
  vaneTail.position.set(-0.11, 0, 0);
  vaneGroup.add(vaneTail);
  g.add(vaneGroup);

  // Thermometer shield — louvred
  const shieldGroup = new THREE.Group();
  shieldGroup.position.y = y + size * 1.28;
  addMesh(shieldGroup, new THREE.CylinderGeometry(0.045, 0.045, 0.09, 16), MATS.nose);
  for (let i = 0; i < 4; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.047, 0.005, 6, 16), MATS.metalMid);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -0.03 + i * 0.02;
    shieldGroup.add(ring);
  }
  g.add(shieldGroup);

  // Pressure port
  addMesh(g, new THREE.BoxGeometry(0.045, 0.035, 0.035), MATS.metalDark, 0, y + size * 1.08, 0.055);

  return g;
}

function instSeismometer(h, d) {
  const g = new THREE.Group();
  const y = h / 2 - 0.02;
  const size = d * 0.55;

  // Levelling base
  addMesh(g, new THREE.CylinderGeometry(size * 0.42, size * 0.44, 0.05, 24), MATS.metalDark, 0, y + 0.02, 0);
  // 3 levelling screws
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.07, 10), MATS.copper);
    screw.position.set(Math.cos(a) * size * 0.34, y - 0.02, Math.sin(a) * size * 0.34);
    g.add(screw);
    // Foot pad
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.012, 10), MATS.metalMid);
    foot.position.set(Math.cos(a) * size * 0.34, y - 0.06, Math.sin(a) * size * 0.34);
    g.add(foot);
  }

  // Main dome
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(size * 0.35, 40, 24, 0, Math.PI * 2, 0, Math.PI * 0.58),
    MATS.metalLight
  );
  dome.position.y = y + 0.05;
  g.add(dome);

  // Dome seam
  const seam = new THREE.Mesh(new THREE.TorusGeometry(size * 0.35, 0.008, 8, 40), MATS.metalBlack);
  seam.rotation.x = Math.PI / 2;
  seam.position.y = y + 0.05;
  g.add(seam);

  // MLI sunshade on top
  const cover = new THREE.Mesh(new THREE.ConeGeometry(size * 0.38, 0.08, 32), MATS.mli);
  cover.position.y = y + size * 0.24;
  g.add(cover);

  // Cable to bus
  addTube(g, [
    new THREE.Vector3(0, y + 0.05, -size * 0.32),
    new THREE.Vector3(size * 0.15, y - 0.3, -size * 0.38),
    new THREE.Vector3(size * 0.25, y - 0.6, -size * 0.32),
  ], MATS.metalBlack, 0.014);

  return g;
}

function instAtmospheric(h, d) {
  const g = new THREE.Group();
  const y = h / 2 - 0.02;
  const size = d * 0.55;

  // Inlet scoop
  const scoop = new THREE.Mesh(new THREE.BoxGeometry(size * 0.42, 0.09, size * 0.35), MATS.copper);
  scoop.position.set(0, y + 0.16, size * 0.38);
  g.add(scoop);
  // Opening
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(size * 0.38, 0.07, 0.025), MATS.metalBlack);
  mouth.position.set(0, y + 0.16, size * 0.54);
  g.add(mouth);
  // Louvres in the opening
  for (let i = 0; i < 3; i++) {
    const louver = new THREE.Mesh(new THREE.BoxGeometry(size * 0.36, 0.006, 0.02), MATS.metalMid);
    louver.position.set(0, y + 0.14 + i * 0.02, size * 0.53);
    g.add(louver);
  }

  // Filter housing
  const filterGroup = new THREE.Group();
  filterGroup.position.set(0, y + 0.16, size * 0.16);
  addMesh(filterGroup, new THREE.CylinderGeometry(0.07, 0.07, 0.11, 20), MATS.metalMid);
  addMesh(filterGroup, new THREE.TorusGeometry(0.072, 0.008, 6, 20), MATS.copper, 0, 0.055, 0).rotation.x = Math.PI / 2;
  g.add(filterGroup);

  // Pump
  addMesh(g, new THREE.BoxGeometry(0.13, 0.11, 0.09), MATS.metalDark, 0, y + 0.16, -size * 0.05);

  // Sample bottle rack
  const rack = new THREE.Group();
  rack.position.set(0, y + 0.1, -size * 0.28);
  addMesh(rack, new THREE.BoxGeometry(size * 0.65, 0.15, 0.12), MATS.panelAlum);
  // Bottles
  for (let i = 0; i < 4; i++) {
    const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.09, 14), MATS.silver);
    bottle.position.set((i - 1.5) * 0.065, y + 0.16, -size * 0.28);
    g.add(bottle);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.031, 0.031, 0.012, 14), MATS.copper);
    cap.position.set((i - 1.5) * 0.065, y + 0.21, -size * 0.28);
    g.add(cap);
  }
  g.add(rack);

  // Intake tube
  addTube(g, [
    new THREE.Vector3(0, y + 0.16, size * 0.38),
    new THREE.Vector3(0.06, y + 0.19, size * 0.15),
    new THREE.Vector3(0, y + 0.16, size * 0.02),
  ], MATS.copper, 0.014);

  return g;
}

function instXray(h, d) {
  const g = new THREE.Group();
  const y = h / 2 - 0.02;
  const size = d * 0.55;

  // Detector housing
  addMesh(g, new THREE.CylinderGeometry(size * 0.38, size * 0.38, size * 0.65, 32), MATS.metalMid, 0, y + size * 0.32, 0);

  // Top aperture
  addMesh(g, new THREE.CylinderGeometry(size * 0.3, size * 0.3, 0.045, 32), MATS.metalBlack, 0, y + size * 0.65, 0);
  const apGlass = new THREE.Mesh(new THREE.CircleGeometry(size * 0.16, 32), MATS.glass);
  apGlass.position.y = y + size * 0.68;
  apGlass.rotation.x = -Math.PI / 2;
  g.add(apGlass);

  // Filter wheel — visible slots
  const wheelGroup = new THREE.Group();
  wheelGroup.position.y = y + size * 0.48;
  addMesh(wheelGroup, new THREE.CylinderGeometry(size * 0.28, size * 0.28, 0.035, 20), MATS.copper);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const slot = new THREE.Mesh(new THREE.CircleGeometry(0.022, 12), MATS.metalBlack);
    slot.position.set(Math.cos(a) * size * 0.16, 0.02, Math.sin(a) * size * 0.16);
    slot.rotation.x = -Math.PI / 2;
    wheelGroup.add(slot);
  }
  g.add(wheelGroup);

  // Cooling strap
  const strap = new THREE.Mesh(new THREE.BoxGeometry(0.025, size * 0.65, size * 0.18), MATS.silver);
  strap.position.set(size * 0.4, y + size * 0.32, 0);
  g.add(strap);

  // Base plate
  addMesh(g, new THREE.BoxGeometry(size * 0.75, 0.06, size * 0.75), MATS.metalDark, 0, y - 0.03, 0);

  return g;
}

function instNeutron(h, d) {
  const g = new THREE.Group();
  const y = h / 2 - 0.02;
  const size = d * 0.55;

  // MLI-wrapped detector
  const detGroup = new THREE.Group();
  detGroup.position.set(-size * 0.18, y + size * 0.35, 0);
  detGroup.rotation.z = Math.PI / 2;
  addMesh(detGroup, new THREE.CylinderGeometry(0.11, 0.11, size * 0.65, 32), MATS.mli);
  // Straps
  for (let i = 0; i < 4; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.112, 0.008, 8, 32), MATS.metalDark);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -size * 0.22 + i * size * 0.15;
    detGroup.add(ring);
  }
  g.add(detGroup);

  // PMT at the end
  const pmtGroup = new THREE.Group();
  pmtGroup.position.set(-size * 0.18 - size * 0.42, y + size * 0.35, 0);
  pmtGroup.rotation.z = Math.PI / 2;
  addMesh(pmtGroup, new THREE.CylinderGeometry(0.065, 0.065, 0.16, 20), MATS.metalDark);
  addMesh(pmtGroup, new THREE.TorusGeometry(0.067, 0.008, 6, 20), MATS.copper, 0.08, 0, 0).rotation.x = Math.PI / 2;
  g.add(pmtGroup);

  // HV cable
  addTube(g, [
    new THREE.Vector3(-size * 0.18 - size * 0.5, y + size * 0.35, 0),
    new THREE.Vector3(-size * 0.42, y + size * 0.15, 0.06),
    new THREE.Vector3(-size * 0.42, y - 0.08, 0.06),
  ], MATS.metalBlack, 0.014);

  // Electronics box
  addMesh(g, new THREE.BoxGeometry(size * 0.55, 0.18, size * 0.35), MATS.panelAlum, size * 0.38, y + size * 0.1, 0);

  return g;
}

// ---------- PAYLOAD DISPATCHER ----------

export function makePayload(h, d, partId) {
  const outer = new THREE.Group();
  const content = new THREE.Group();
  outer.add(content);

  content.add(makePayloadBus(h, d));

  let inst = null;
  if (!partId) inst = new THREE.Group();
  else if (partId.includes('camera')) inst = instCamera(h, d, partId.includes('hires'));
  else if (partId.includes('spectrometer')) inst = instSpectrometer(h, d);
  else if (partId.includes('radar')) inst = instRadar(h, d);
  else if (partId.includes('magnetometer')) inst = instMagnetometer(h, d);
  else if (partId.includes('drill')) inst = instDrill(h, d);
  else if (partId.includes('swarm')) inst = instMicroRover(h, d);
  else if (partId.includes('rover')) inst = instRover(h, d);
  else if (partId.includes('sample_return')) inst = instSampleReturn(h, d);
  else if (partId.includes('astrobiology')) inst = instAstrobiology(h, d);
  else if (partId.includes('lidar')) inst = instLidar(h, d);
  else if (partId.includes('ice_mapper')) inst = instIceMapper(h, d);
  else if (partId.includes('weather')) inst = instWeather(h, d);
  else if (partId.includes('seismometer')) inst = instSeismometer(h, d);
  else if (partId.includes('atmospheric')) inst = instAtmospheric(h, d);
  else if (partId.includes('xray')) inst = instXray(h, d);
  else if (partId.includes('neutron')) inst = instNeutron(h, d);
  else {
    inst = new THREE.Group();
    addMesh(inst, new THREE.BoxGeometry(d * 0.55, h * 0.4, d * 0.55), MATS.metalMid, 0, h / 2 - 0.1, 0);
  }
  content.add(inst);

  // Fit inside slot
  content.updateMatrixWorld(true);
  let box = new THREE.Box3().setFromObject(content);
  let size = box.getSize(new THREE.Vector3());

  const maxH = h * 0.98;
  const maxW = d * 0.98;
  const scaleY = size.y > maxH ? maxH / size.y : 1;
  const scaleXZ = Math.max(size.x, size.z) > maxW ? maxW / Math.max(size.x, size.z) : 1;
  const s = Math.min(scaleY, scaleXZ, 1);

  content.scale.setScalar(s);
  content.updateMatrixWorld(true);

  box = new THREE.Box3().setFromObject(content);
  content.position.y = -h / 2 - box.min.y;
  const center = box.getCenter(new THREE.Vector3());
  content.position.x = -center.x;
  content.position.z = -center.z;

  return outer;
}

// ---------- NOSE CONE ----------

export function makeNoseCone(h, d, partId) {
  const g = new THREE.Group();
  const isBlunt = partId && partId.includes('blunt');
  const isAeroshell = partId && partId.includes('aeroshell');
  const mat = isAeroshell ? MATS.noseAblative : MATS.nose;

  const pts = [];
  const steps = 48;

  if (partId && partId.includes('biconic')) {
    const midT = 0.5;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const y = -h / 2 + t * h;
      let r;
      if (t < midT) r = (d / 2) * (1 - t / midT * 0.5);
      else r = (d / 2) * 0.5 * (1 - (t - midT) / (1 - midT));
      pts.push(new THREE.Vector2(Math.max(0.001, r), y));
    }
  } else if (partId && partId.includes('parabolic')) {
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const y = -h / 2 + t * h;
      pts.push(new THREE.Vector2(Math.max(0.001, (d / 2) * Math.sqrt(1 - t * t)), y));
    }
  } else if (partId && partId.includes('ogive')) {
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const y = -h / 2 + t * h;
      pts.push(new THREE.Vector2(Math.max(0.001, (d / 2) * Math.sqrt(1 - t * t * 0.95)), y));
    }
  } else if (isBlunt) {
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const y = -h / 2 + t * h;
      let r = (d / 2) * Math.pow(1 - t * t * 0.98, 0.5);
      if (t > 0.95) r = (d / 2) * 0.1;
      pts.push(new THREE.Vector2(Math.max(0.001, r), y));
    }
  } else if (isAeroshell) {
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const y = -h / 2 + t * h;
      pts.push(new THREE.Vector2(Math.max(0.001, (d / 2) * Math.sin(Math.PI * (1 - t) * 0.7)), y));
    }
  } else {
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const y = -h / 2 + t * h;
      const power = partId && partId.includes('von_karman') ? 0.5 : 0.6;
      pts.push(new THREE.Vector2(Math.max(0.001, (d / 2) * Math.pow(1 - t, power)), y));
    }
  }

  g.add(new THREE.Mesh(new THREE.LatheGeometry(pts, 96), mat));

  // Base ring
  const ring = new THREE.Mesh(new THREE.TorusGeometry(d / 2, 0.035, 12, 96), MATS.metalMid);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = -h / 2 + 0.025;
  g.add(ring);

  // Rivet ring around the base
  addRivetRing(g, 40, d / 2 + 0.01, -h / 2 + 0.06, 0.009);

  // Aeroshell extras
  if (isAeroshell) {
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(d / 2 * 1.02, d / 2 * 1.02, 0.06, 96), MATS.noseAblative);
    plate.position.y = -h / 2 + 0.08;
    g.add(plate);
    // Tile lines radiating on the plate
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const line = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.06, 0.005), MATS.metalDark);
      line.position.set(Math.cos(a) * (d / 2 - 0.15), -h / 2 + 0.11, Math.sin(a) * (d / 2 - 0.15));
      g.add(line);
    }
  }

  // Panel line running up one side
  const panelLine = new THREE.Mesh(new THREE.BoxGeometry(0.008, h * 0.7, 0.008), MATS.metalBlack);
  panelLine.position.set(d / 2 - 0.05, -h / 2 + h * 0.4, 0);
  panelLine.rotation.z = 0.15;
  g.add(panelLine);

  return g;
}

// ---------- FLAME ----------

function makeFlameGroup(exitR, bellHeight) {
  const g = new THREE.Group();

  const outer = new THREE.Mesh(
    new THREE.ConeGeometry(exitR * 1.08, bellHeight * 0.95, 24, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xff7a1a,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  outer.rotation.x = Math.PI;
  outer.position.y = -bellHeight * 0.47;
  g.add(outer);

  const mid = new THREE.Mesh(
    new THREE.ConeGeometry(exitR * 0.72, bellHeight * 0.75, 24, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xffcc44,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  mid.rotation.x = Math.PI;
  mid.position.y = -bellHeight * 0.37;
  g.add(mid);

  const core = new THREE.Mesh(
    new THREE.ConeGeometry(exitR * 0.42, bellHeight * 0.55, 24, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.95,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  core.rotation.x = Math.PI;
  core.position.y = -bellHeight * 0.27;
  g.add(core);

  g.visible = false;
  g.userData.meshes = [outer, mid, core];
  return g;
}

// ---------- DISPATCHER ----------

export function buildDetailedPart(part, slotShape) {
  const h = slotShape.h;
  const d = slotShape.d;
  const id = part ? part.id : null;
  const slot = part?.slot;

  switch (slot) {
    case 'engine_cluster':
      if (id && id.includes('_small')) return makeEngineCluster(h, d, 'three');
      if (id && id.includes('single')) return makeEngineCluster(h, d, 'one');
      if (id && id.includes('rs25')) return makeEngineCluster(h, d, 'four');
      if (id && id.includes('rd180')) return makeEngineCluster(h, d, 'two');
      if (id && id.includes('be4')) return makeEngineCluster(h, d, 'two');
      if (id && id.includes('raptor')) return makeEngineCluster(h, d, 'three');
      if (id && id.includes('methalox_5')) return makeEngineCluster(h, d, 'five');
      if (id && id.includes('hypergolic')) return makeEngineCluster(h, d, 'four');
      if (id && id.includes('aerospike')) return makeEngineCluster(h, d, 'two');
      if (id && id.includes('solid')) return makeEngineCluster(h, d, 'four');
      if (id && id.includes('nuclear')) return makeEngineCluster(h, d, 'three');
      return makeEngineCluster(h, d, 'nine');
    case 'thrust_structure': return makeThrustStructure(h, d);
    case 'oxidizer_tank':
      if (id && id.includes('n2o4')) return makeTank(h, d, MATS.storable, 'cryo');
      if (id && id.includes('h2o2')) return makeTank(h, d, MATS.metalLight, 'standard');
      if (id && id.includes('n2o')) return makeTank(h, d, MATS.metalLight, 'standard');
      if (id && id.includes('mixed')) return makeTank(h, d, MATS.storable, 'standard');
      return makeTank(h, d, MATS.lox, 'cryo');
    case 'fuel_tank':
      if (id && id.includes('ch4')) return makeTank(h, d, MATS.methane, 'cryo');
      if (id && id.includes('lh2')) return makeTank(h, d, MATS.metalLight, 'cryo');
      if (id && id.includes('storable')) return makeTank(h, d, MATS.storable, 'standard');
      if (id && id.includes('stainless')) return makeTank(h, d, MATS.silver, 'standard');
      if (id && id.includes('rp1')) return makeTank(h, d, MATS.gold, 'standard');
      return makeTank(h, d, MATS.gold, 'standard');
    case 'intertank': return makeIntertank(h, d);
    case 'pressurant':
      if (id && id.includes('auto')) return makePressurant(h, d, 'autogenous');
      if (id && id.includes('regenerative')) return makePressurant(h, d, 'regenerative');
      if (id && id.includes('nitrogen')) return makePressurant(h, d, 'nitrogen');
      return makePressurant(h, d, 'standard');
    case 'grid_fins': return makeGridFins(h, d);
    case 'interstage': return makeInterstage(h, d);
    case 'separation': return makeSeparation(h, d);
    case 'upper_engine': return makeUpperEngine(h, d);
    case 'upper_tank': return makeTank(h, d, MATS.metalLight, 'cryo');
    case 'avionics': return makeAvionics(h, d, id);
    case 'power': return makePower(h, d, id);
    case 'payload': return makePayload(h, d, id);
    case 'nose_cone': return makeNoseCone(h, d, id);
    default: return null;
  }
}