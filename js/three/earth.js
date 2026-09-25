import * as THREE from 'three';

// =========================================================
// EARTH BACKDROP
// A giant sphere under the launch site. Curves away as the
// rocket climbs. Atmosphere shell gives the classic blue rim.
// Sun disc sits in the sky at a fixed direction.
// =========================================================

const EARTH_RADIUS = 3000;
const EARTH_CENTER_Y = -EARTH_RADIUS;

function makeEarthTexture() {
  const c = document.createElement('canvas');
  c.width = 2048;
  c.height = 1024;
  const ctx = c.getContext('2d');

  // deep ocean base
  const g = ctx.createLinearGradient(0, 0, 0, 1024);
  g.addColorStop(0.00, '#dfeaf5');
  g.addColorStop(0.08, '#5aa0c8');
  g.addColorStop(0.25, '#1e4a7a');
  g.addColorStop(0.50, '#0a2a5a');
  g.addColorStop(0.75, '#1e4a7a');
  g.addColorStop(0.92, '#5aa0c8');
  g.addColorStop(1.00, '#dfeaf5');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 2048, 1024);

  // ocean depth variation
  for (let i = 0; i < 400; i++) {
    const x = Math.random() * 2048;
    const y = Math.random() * 1024;
    const r = 40 + Math.random() * 200;
    const gg = ctx.createRadialGradient(x, y, 0, x, y, r);
    gg.addColorStop(0, `rgba(10, 30, 70, ${0.15 + Math.random() * 0.25})`);
    gg.addColorStop(1, 'rgba(10, 30, 70, 0)');
    ctx.fillStyle = gg;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // continents — blobby noise clusters
  function continent(cx, cy, size, seed) {
    const points = 40;
    ctx.beginPath();
    let x = cx, y = cy;
    for (let i = 0; i <= points; i++) {
      const a = (i / points) * Math.PI * 2;
      const r = size * (0.6 + 0.4 * Math.sin(a * 3 + seed) * Math.cos(a * 5 - seed));
      x = cx + Math.cos(a) * r;
      y = cy + Math.sin(a) * r * 0.6;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = '#5a7a4a';
    ctx.fill();
    // coastline
    ctx.strokeStyle = 'rgba(180, 200, 150, 0.6)';
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  // spread continents
  continent(400, 320, 180, 1.7);
  continent(700, 480, 220, 3.1);
  continent(1250, 380, 200, 2.4);
  continent(1600, 520, 240, 5.6);
  continent(300, 720, 200, 7.2);
  continent(900, 780, 160, 4.9);
  continent(1400, 800, 180, 8.1);
  continent(1000, 200, 140, 9.3);

  // add green/brown mottling inside continents (rough via random blobs)
  for (let i = 0; i < 600; i++) {
    const x = Math.random() * 2048;
    const y = Math.random() * 1024;
    const dx = (x - 1024) / 1024;
    const dy = (y - 512) / 512;
    if (Math.abs(dx) + Math.abs(dy) < 0.9 && Math.random() < 0.35) {
      const r = 10 + Math.random() * 40;
      const gg = ctx.createRadialGradient(x, y, 0, x, y, r);
      const hue = Math.random();
      const col = hue < 0.5
        ? `rgba(90, 100, 60, ${0.3 + Math.random() * 0.3})`
        : `rgba(140, 110, 70, ${0.3 + Math.random() * 0.3})`;
      gg.addColorStop(0, col);
      gg.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = gg;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }

  // cloud wisps
  for (let i = 0; i < 300; i++) {
    const x = Math.random() * 2048;
    const y = Math.random() * 1024;
    const w = 40 + Math.random() * 200;
    const h = 6 + Math.random() * 30;
    const a = 0.15 + Math.random() * 0.4;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((Math.random() - 0.5) * 0.4);
    const gg = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
    gg.addColorStop(0, `rgba(255, 255, 255, 0)`);
    gg.addColorStop(0.5, `rgba(255, 255, 255, ${a})`);
    gg.addColorStop(1, `rgba(255, 255, 255, 0)`);
    ctx.fillStyle = gg;
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.restore();
  }

  // polar ice caps
  const northCap = ctx.createLinearGradient(0, 0, 0, 100);
  northCap.addColorStop(0, 'rgba(240, 248, 255, 0.95)');
  northCap.addColorStop(1, 'rgba(240, 248, 255, 0)');
  ctx.fillStyle = northCap;
  ctx.fillRect(0, 0, 2048, 100);

  const southCap = ctx.createLinearGradient(0, 924, 0, 1024);
  southCap.addColorStop(0, 'rgba(240, 248, 255, 0)');
  southCap.addColorStop(1, 'rgba(240, 248, 255, 0.95)');
  ctx.fillStyle = southCap;
  ctx.fillRect(0, 924, 2048, 100);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function makeEarthBump() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#606060';
  ctx.fillRect(0, 0, 1024, 512);
  for (let i = 0; i < 5000; i++) {
    const x = Math.random() * 1024;
    const y = Math.random() * 512;
    const r = 2 + Math.random() * 30;
    const v = Math.random() > 0.5 ? 130 : 40;
    ctx.fillStyle = `rgba(${v}, ${v}, ${v}, ${0.3 + Math.random() * 0.3})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  return tex;
}

export function createEarthBackdrop(scene) {
  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);

  // --- Earth sphere ---
  const earthMat = new THREE.MeshStandardMaterial({
    map: makeEarthTexture(),
    bumpMap: makeEarthBump(),
    bumpScale: 8,
    roughness: 0.88,
    metalness: 0.0,
    emissive: new THREE.Color(0x0a1830),
    emissiveIntensity: 0.22,
  });

  const earthSphere = new THREE.Mesh(
    new THREE.SphereGeometry(EARTH_RADIUS, 96, 64),
    earthMat
  );
  earthSphere.position.y = EARTH_CENTER_Y;
  earthSphere.castShadow = false;
  earthSphere.receiveShadow = false;
  group.add(earthSphere);

  // --- Atmosphere rim ---
  const atmoMat = new THREE.ShaderMaterial({
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      glowColor: { value: new THREE.Color(0x5ab8ff) },
      intensity: { value: 1.4 },
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vViewPos;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vec4 vp = viewMatrix * wp;
        vNormal = normalize(normalMatrix * normal);
        vViewPos = vp.xyz;
        gl_Position = projectionMatrix * vp;
      }
    `,
    fragmentShader: `
      uniform vec3 glowColor;
      uniform float intensity;
      varying vec3 vNormal;
      varying vec3 vViewPos;
      void main() {
        vec3 viewDir = normalize(-vViewPos);
        float rim = 1.0 - abs(dot(viewDir, normalize(vNormal)));
        rim = pow(rim, 2.8);
        gl_FragColor = vec4(glowColor, rim * intensity);
      }
    `,
  });

  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(EARTH_RADIUS * 1.035, 64, 48),
    atmoMat
  );
  atmosphere.position.y = EARTH_CENTER_Y;
  group.add(atmosphere);

  // --- Inner haze shell (adds a soft blue cast over the planet) ---
  const hazeMat = new THREE.ShaderMaterial({
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.FrontSide,
    depthWrite: false,
    uniforms: {
      glowColor: { value: new THREE.Color(0x3080d0) },
      intensity: { value: 0.25 },
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vViewPos;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vec4 vp = viewMatrix * wp;
        vNormal = normalize(normalMatrix * normal);
        vViewPos = vp.xyz;
        gl_Position = projectionMatrix * vp;
      }
    `,
    fragmentShader: `
      uniform vec3 glowColor;
      uniform float intensity;
      varying vec3 vNormal;
      varying vec3 vViewPos;
      void main() {
        vec3 viewDir = normalize(-vViewPos);
        float rim = 1.0 - abs(dot(viewDir, normalize(vNormal)));
        rim = pow(rim, 1.5);
        gl_FragColor = vec4(glowColor, rim * intensity);
      }
    `,
  });

  const haze = new THREE.Mesh(
    new THREE.SphereGeometry(EARTH_RADIUS * 1.012, 48, 32),
    hazeMat
  );
  haze.position.y = EARTH_CENTER_Y;
  group.add(haze);

  return { group, earthSphere, atmosphere, haze, radius: EARTH_RADIUS };
}

// how visible the backdrop should be at a given altitude
export function earthOpacityForAltitude(alt) {
  if (alt <= 300) return 0;
  if (alt >= 1200) return 1;
  return (alt - 300) / 900;
}