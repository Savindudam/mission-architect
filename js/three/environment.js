import * as THREE from 'three';

// -------------------- SHARED MATERIALS --------------------

const MAT_STEEL = new THREE.MeshStandardMaterial({
  color: 0x6a6a74, roughness: 0.42, metalness: 0.85,
});
const MAT_STEEL_DARK = new THREE.MeshStandardMaterial({
  color: 0x2a2a32, roughness: 0.38, metalness: 0.9,
});
const MAT_WHITE = new THREE.MeshStandardMaterial({
  color: 0xd8d8dc, roughness: 0.55, metalness: 0.1,
});
const MAT_HAZARD_YELLOW = new THREE.MeshStandardMaterial({
  color: 0xd9a520, roughness: 0.6, metalness: 0.3,
});
const MAT_HAZARD_RED = new THREE.MeshStandardMaterial({
  color: 0xb8332a, roughness: 0.6, metalness: 0.3,
});
const MAT_HANGAR = new THREE.MeshStandardMaterial({
  color: 0x3a4048, roughness: 0.7, metalness: 0.2,
});
const MAT_HANGAR_DARK = new THREE.MeshStandardMaterial({
  color: 0x22262e, roughness: 0.75, metalness: 0.15,
});
const MAT_LIGHT_HOUSING = new THREE.MeshStandardMaterial({
  color: 0x1a1a20, roughness: 0.5, metalness: 0.6,
});
const MAT_GLOW = new THREE.MeshBasicMaterial({
  color: 0xfff4c4, transparent: true, opacity: 0.95,
});

// Sun position — matches the key light direction in scene.js
const SUN_DIRECTION = new THREE.Vector3(20, 40, 20).normalize();

// -------------------- PROCEDURAL TEXTURES --------------------

const TEX_CACHE = {};

// Concrete — base grey with noise, cracks, panel seams, oil stains.
function makeConcreteTexture(size = 1024) {
  const key = 'concrete' + size;
  if (TEX_CACHE[key]) return TEX_CACHE[key];

  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');

  // base
  ctx.fillStyle = '#5a5a62';
  ctx.fillRect(0, 0, size, size);

  // fine noise
  for (let i = 0; i < size * size * 0.06; i++) {
    const v = Math.random();
    ctx.fillStyle = `rgba(${60 + v * 40}, ${60 + v * 40}, ${65 + v * 40}, ${0.15 + Math.random() * 0.25})`;
    ctx.fillRect(Math.random() * size, Math.random() * size, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }

  // large scale blotches — heat stains, oil
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 30 + Math.random() * 120;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const dark = Math.random() > 0.6;
    if (dark) {
      g.addColorStop(0, `rgba(20, 20, 24, ${0.15 + Math.random() * 0.25})`);
      g.addColorStop(1, 'rgba(20, 20, 24, 0)');
    } else {
      g.addColorStop(0, `rgba(120, 118, 112, ${0.1 + Math.random() * 0.15})`);
      g.addColorStop(1, 'rgba(120, 118, 112, 0)');
    }
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // panel seams — grid
  ctx.strokeStyle = 'rgba(30, 30, 34, 0.85)';
  ctx.lineWidth = 3;
  const grid = 8;
  for (let i = 1; i < grid; i++) {
    const t = i / grid;
    ctx.beginPath(); ctx.moveTo(t * size, 0); ctx.lineTo(t * size, size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, t * size); ctx.lineTo(size, t * size); ctx.stroke();
  }

  // fine cracks
  ctx.strokeStyle = 'rgba(20, 20, 22, 0.7)';
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 60; i++) {
    let x = Math.random() * size;
    let y = Math.random() * size;
    ctx.beginPath();
    ctx.moveTo(x, y);
    const segments = 3 + Math.floor(Math.random() * 5);
    for (let s = 0; s < segments; s++) {
      x += (Math.random() - 0.5) * 60;
      y += (Math.random() - 0.5) * 60;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // bolts at grid intersections
  for (let i = 1; i < grid; i++) {
    for (let j = 1; j < grid; j++) {
      const x = (i / grid) * size;
      const y = (j / grid) * size;
      ctx.fillStyle = 'rgba(90, 90, 96, 0.9)';
      ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(160, 160, 168, 0.9)';
      ctx.beginPath(); ctx.arc(x - 1, y - 1, 2, 0, Math.PI * 2); ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  TEX_CACHE[key] = tex;
  return tex;
}

// Desert ground — reddish sand with wind streaks.
function makeGroundTexture(size = 1024) {
  const key = 'ground' + size;
  if (TEX_CACHE[key]) return TEX_CACHE[key];

  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#4a3830';
  ctx.fillRect(0, 0, size, size);

  // fine grain
  for (let i = 0; i < size * size * 0.04; i++) {
    const v = Math.random();
    ctx.fillStyle = `rgba(${90 + v * 60}, ${70 + v * 40}, ${50 + v * 30}, ${0.2 + Math.random() * 0.2})`;
    ctx.fillRect(Math.random() * size, Math.random() * size, 1 + Math.random() * 3, 1 + Math.random() * 2);
  }

  // wind streaks — long horizontal arcs
  ctx.strokeStyle = 'rgba(60, 44, 36, 0.5)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 200; i++) {
    const y = Math.random() * size;
    const x = Math.random() * size;
    const len = 40 + Math.random() * 200;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + len * 0.5, y + (Math.random() - 0.5) * 10, x + len, y);
    ctx.stroke();
  }

  // darker patches
  for (let i = 0; i < 60; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 20 + Math.random() * 80;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(40, 26, 20, ${0.2 + Math.random() * 0.2})`);
    g.addColorStop(1, 'rgba(40, 26, 20, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // small rocks / speckles
  for (let i = 0; i < 400; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const s = 2 + Math.random() * 5;
    ctx.fillStyle = `rgba(${60 + Math.random() * 40}, ${45 + Math.random() * 25}, ${35 + Math.random() * 20}, 0.9)`;
    ctx.beginPath();
    ctx.arc(x, y, s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(20, 14, 12, 0.5)';
    ctx.beginPath();
    ctx.arc(x + 1, y + 1, s * 0.7, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  TEX_CACHE[key] = tex;
  return tex;
}

// -------------------- SKY DOME --------------------
// Gradient from deep blue at the zenith to warm horizon, with a visible
// sun disk and glow. Matches the key light direction.

function makeSkyDome() {
  const geo = new THREE.SphereGeometry(600, 48, 24);

  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor:    { value: new THREE.Color(0x060a20) },
      midColor:    { value: new THREE.Color(0x121a34) },
      horizonColor:{ value: new THREE.Color(0x2a2038) },
      groundColor: { value: new THREE.Color(0x140e18) },
      sunDirection:{ value: SUN_DIRECTION.clone() },
      sunColor:    { value: new THREE.Color(0xffddaa) },
      sunGlowColor:{ value: new THREE.Color(0xff8844) },
    },
    vertexShader: `
      varying vec3 vWorldPos;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 midColor;
      uniform vec3 horizonColor;
      uniform vec3 groundColor;
      uniform vec3 sunDirection;
      uniform vec3 sunColor;
      uniform vec3 sunGlowColor;
      varying vec3 vWorldPos;

      // cheap hash noise for very subtle atmosphere banding
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(41.7, 289.1))) * 43758.5);
      }

      void main() {
        vec3 dir = normalize(vWorldPos);
        float h = dir.y;

        // three-stop vertical gradient
        vec3 sky;
        if (h > 0.0) {
          sky = mix(horizonColor, midColor, smoothstep(0.0, 0.35, h));
          sky = mix(sky, topColor, smoothstep(0.35, 1.0, h));
        } else {
          sky = mix(horizonColor, groundColor, smoothstep(0.0, -0.4, h));
        }

        // sun disk and glow
        float sunDot = max(dot(dir, sunDirection), 0.0);
        float disk = pow(sunDot, 800.0);
        float innerGlow = pow(sunDot, 24.0) * 0.7;
        float outerGlow = pow(sunDot, 6.0) * 0.25;

        vec3 col = sky;
        col += sunColor * disk * 1.8;
        col += sunColor * innerGlow;
        col += sunGlowColor * outerGlow;

        // very faint atmospheric banding so the sky is not perfectly flat
        float band = hash(floor(dir.xz * 400.0));
        col += vec3(band * 0.008);

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });

  const dome = new THREE.Mesh(geo, mat);
  dome.renderOrder = -1000;
  return dome;
}

// -------------------- GROUND PLANE --------------------
// Very large plane with a desert texture. Sits below the concrete pad.

function makeGroundPlane() {
  const tex = makeGroundTexture();
  tex.repeat.set(40, 40);

  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    color: 0x8a8078,
    roughness: 0.98,
    metalness: 0.02,
  });

  const geo = new THREE.PlaneGeometry(800, 800, 4, 4);
  geo.rotateX(-Math.PI / 2);

  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = -0.5;
  mesh.receiveShadow = true;
  return mesh;
}

// -------------------- CONCRETE PAD --------------------

function makeConcretePad() {
  const g = new THREE.Group();

  // main concrete pad — 90 x 90
  const concreteTex = makeConcreteTexture();
  concreteTex.repeat.set(4, 4);

  const padMat = new THREE.MeshStandardMaterial({
    map: concreteTex,
    color: 0x9a9a9a,
    roughness: 0.88,
    metalness: 0.05,
  });

  const pad = new THREE.Mesh(new THREE.BoxGeometry(90, 0.6, 90), padMat);
  pad.position.y = -0.1;
  pad.receiveShadow = true;
  g.add(pad);

  // raised edge lip — thin border around the pad
  const lipMat = new THREE.MeshStandardMaterial({ color: 0x3a3a42, roughness: 0.9 });
  const lipSize = 91;
  for (const [x, z, w, d] of [
    [0,  lipSize / 2, lipSize, 0.6],
    [0, -lipSize / 2, lipSize, 0.6],
    [ lipSize / 2, 0, 0.6, lipSize],
    [-lipSize / 2, 0, 0.6, lipSize],
  ]) {
    const lip = new THREE.Mesh(new THREE.BoxGeometry(w, 0.5, d), lipMat);
    lip.position.set(x, -0.05, z);
    g.add(lip);
  }

  // blast trench — a deep rectangular recess in the middle
  const trench = new THREE.Mesh(
    new THREE.BoxGeometry(11, 0.5, 62),
    new THREE.MeshStandardMaterial({ color: 0x14141a, roughness: 0.95 })
  );
  trench.position.set(0, -0.5, 0);
  g.add(trench);

  // trench inner floor
  const trenchFloor = new THREE.Mesh(
    new THREE.BoxGeometry(10, 0.1, 60),
    new THREE.MeshStandardMaterial({ color: 0x2a2a32, roughness: 0.9 })
  );
  trenchFloor.position.set(0, -0.8, 0);
  g.add(trenchFloor);

  // hazard ring around the trench
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(7.0, 7.6, 96),
    MAT_HAZARD_YELLOW
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.21;
  g.add(ring);

  // second inner ring — thin
  const ring2 = new THREE.Mesh(
    new THREE.RingGeometry(6.4, 6.55, 96),
    MAT_HAZARD_RED
  );
  ring2.rotation.x = -Math.PI / 2;
  ring2.position.y = 0.21;
  g.add(ring2);

  // corner chevrons
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const chev = new THREE.Mesh(
      new THREE.BoxGeometry(3.5, 0.06, 0.5),
      MAT_HAZARD_YELLOW
    );
    chev.position.set(Math.cos(a) * 24, 0.21, Math.sin(a) * 24);
    chev.rotation.y = -a;
    g.add(chev);
  }

  // small tie-down blocks at the corners
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const block = new THREE.Mesh(
      new THREE.BoxGeometry(2, 0.6, 2),
      new THREE.MeshStandardMaterial({ color: 0x3a3a42, roughness: 0.85 })
    );
    block.position.set(Math.cos(a) * 32, 0.3, Math.sin(a) * 32);
    g.add(block);

    // yellow top
    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(2.1, 0.1, 2.1),
      MAT_HAZARD_YELLOW
    );
    cap.position.set(Math.cos(a) * 32, 0.62, Math.sin(a) * 32);
    g.add(cap);
  }

  return g;
}

// -------------------- MOUNTAIN RANGE --------------------
// Jagged peaks around the horizon. Uses cones with random rotation for
// the shape and a fog-matched material so they blend into the sky.

function makeMountainRange() {
  const g = new THREE.Group();

  const mountainMat = new THREE.MeshStandardMaterial({
    color: 0x2a2230,
    roughness: 1.0,
    metalness: 0.0,
  });

  const farMat = new THREE.MeshStandardMaterial({
    color: 0x1a1624,
    roughness: 1.0,
    metalness: 0.0,
  });

  // two rings — near and far — for depth
  for (let ring = 0; ring < 2; ring++) {
    const radius = 280 + ring * 80;
    const count = 60 - ring * 20;
    const mat = ring === 0 ? mountainMat : farMat;
    const baseH = ring === 0 ? 16 : 24;

    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.1;
      const h = baseH + Math.random() * baseH;
      const w = 30 + Math.random() * 30;
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(w, h, 5 + Math.floor(Math.random() * 3)),
        mat
      );
      cone.position.set(
        Math.cos(a) * radius,
        h / 2,
        Math.sin(a) * radius
      );
      cone.rotation.y = Math.random() * Math.PI * 2;
      g.add(cone);
    }
  }

  return g;
}

// -------------------- LIGHTNING TOWERS --------------------

function makeLightningTower(x, z) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);

  const height = 42;
  const baseW = 1.2;

  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const leg = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, height, 0.12),
      MAT_STEEL_DARK
    );
    leg.position.set(Math.cos(a) * baseW * 0.4, height / 2, Math.sin(a) * baseW * 0.4);
    leg.rotation.z = -Math.cos(a) * 0.03;
    leg.rotation.x =  Math.sin(a) * 0.03;
    g.add(leg);
  }

  const braceCount = Math.floor(height / 4);
  for (let b = 0; b < braceCount; b++) {
    const y = 2 + b * 4;
    const t = y / height;
    const r = baseW * 0.4 * (1 - t * 0.5);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(r, 0.05, 4, 12),
      MAT_STEEL_DARK
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y;
    g.add(ring);
  }

  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.5, 2.5, 8), MAT_STEEL_DARK);
  cap.position.y = height + 1.2;
  g.add(cap);

  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 3, 6), MAT_STEEL);
  rod.position.y = height + 4;
  g.add(rod);

  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), MAT_GLOW);
  tip.position.y = height + 5.6;
  g.add(tip);

  const beacon = new THREE.PointLight(0xff3322, 0.8, 12);
  beacon.position.y = height + 5.6;
  g.add(beacon);

  g.userData.beacon = beacon;
  g.userData.beaconPhase = Math.random() * Math.PI * 2;

  return g;
}

// -------------------- WATER TOWER --------------------

function makeWaterTower() {
  const g = new THREE.Group();
  const height = 24;

  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const leg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.3, height, 8),
      MAT_WHITE
    );
    leg.position.set(Math.cos(a) * 3.5, height / 2, Math.sin(a) * 3.5);
    g.add(leg);

    for (let b = 1; b < 6; b++) {
      const y = (b / 6) * height;
      const brace = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.15, 0.15), MAT_WHITE);
      brace.position.set(Math.cos(a + Math.PI / 4) * 2.5, y, Math.sin(a + Math.PI / 4) * 2.5);
      brace.rotation.y = -(a + Math.PI / 4);
      g.add(brace);
    }
  }

  const sphere = new THREE.Mesh(new THREE.SphereGeometry(5.5, 24, 16), MAT_WHITE);
  sphere.position.y = height + 4;
  g.add(sphere);

  for (let i = -2; i <= 2; i++) {
    const t = i / 3;
    const r = Math.sqrt(5.5 * 5.5 - (t * 5.5) * (t * 5.5));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.09, 4, 24), MAT_STEEL);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = height + 4 + t * 5.5;
    g.add(ring);
  }

  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(5.5, 0.07, 4, 24), MAT_STEEL);
    ring.rotation.y = a;
    ring.position.y = height + 4;
    g.add(ring);
  }

  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 8), MAT_HAZARD_RED);
  beacon.position.y = height + 10.5;
  g.add(beacon);

  return g;
}

// -------------------- LOX SPHERES --------------------

function makeStorageSphere(x, z, radius) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const height = radius * 1.4;

  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const leg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.2, height, 6),
      MAT_WHITE
    );
    leg.position.set(Math.cos(a) * radius * 0.7, height / 2, Math.sin(a) * radius * 0.7);
    g.add(leg);
  }

  const sphere = new THREE.Mesh(new THREE.SphereGeometry(radius, 24, 16), MAT_WHITE);
  sphere.position.y = height + radius;
  g.add(sphere);

  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.08, 4, 24), MAT_STEEL);
    ring.rotation.y = a;
    ring.position.y = height + radius;
    g.add(ring);
  }

  for (let i = -1; i <= 1; i++) {
    const t = i / 2;
    const r = Math.sqrt(radius * radius - (t * radius) * (t * radius));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.08, 4, 24), MAT_STEEL);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = height + radius + t * radius;
    g.add(ring);
  }

  return g;
}

// -------------------- FLOODLIGHT --------------------

function makeFloodlight(x, z, rotY) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;

  const height = 20;
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.5, height, 8),
    MAT_STEEL_DARK
  );
  pole.position.y = height / 2;
  g.add(pole);

  const crossbar = new THREE.Mesh(new THREE.BoxGeometry(6, 0.4, 0.4), MAT_STEEL_DARK);
  crossbar.position.y = height;
  g.add(crossbar);

  const lampPositions = [-2.5, -1.5, -0.5, 0.5, 1.5, 2.5];
  for (const lx of lampPositions) {
    const housing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.4, 0.5, 10),
      MAT_LIGHT_HOUSING
    );
    housing.rotation.x = Math.PI / 2;
    housing.position.set(lx, height + 0.2, 0.3);
    g.add(housing);

    const glow = new THREE.Mesh(new THREE.CircleGeometry(0.3, 12), MAT_GLOW);
    glow.position.set(lx, height + 0.2, 0.56);
    g.add(glow);
  }

  const light = new THREE.PointLight(0xfff4c4, 1.2, 60);
  light.position.set(0, height, 0);
  g.add(light);

  return g;
}

// -------------------- HANGAR --------------------

function makeHangar(x, z, w, h, d) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);

  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), MAT_HANGAR);
  body.position.y = h / 2;
  g.add(body);

  const roof = new THREE.Mesh(
    new THREE.CylinderGeometry(w * 0.5, w * 0.5, d, 16, 1, false, 0, Math.PI),
    MAT_HANGAR
  );
  roof.rotation.z = Math.PI / 2;
  roof.rotation.y = Math.PI / 2;
  roof.position.y = h;
  g.add(roof);

  const band = new THREE.Mesh(
    new THREE.BoxGeometry(w * 0.95, 1.2, d * 1.02),
    MAT_HANGAR_DARK
  );
  band.position.y = h * 0.65;
  g.add(band);

  return g;
}

// -------------------- PUBLIC API --------------------

export function createEnvironment(scene) {
  const group = new THREE.Group();
  scene.add(group);

  // ordering matters: sky first, ground, then everything on top
  group.add(makeSkyDome());
  group.add(makeGroundPlane());
  group.add(makeMountainRange());
  group.add(makeConcretePad());

  const towers = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const tower = makeLightningTower(Math.cos(a) * 40, Math.sin(a) * 40);
    group.add(tower);
    towers.push(tower);
  }

  const waterTower = makeWaterTower();
  waterTower.position.set(-46, 0, -22);
  group.add(waterTower);

  group.add(makeStorageSphere(44, -18, 5.5));
  group.add(makeStorageSphere(52, -10, 4.2));

  const floodlights = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const mast = makeFloodlight(
      Math.cos(a) * 32,
      Math.sin(a) * 32,
      -a + Math.PI
    );
    group.add(mast);
    floodlights.push(mast);
  }

  group.add(makeHangar(-90, -60, 40, 22, 30));
  group.add(makeHangar( 70, -80, 55, 28, 40));
  group.add(makeHangar(-70,  70, 35, 18, 26));
  group.add(makeHangar( 95,  40, 30, 15, 22));

  return { group, towers, floodlights, waterTower };
}

export function updateEnvironment(env, elapsed) {
  if (!env) return;
  for (const t of env.towers) {
    if (!t.userData.beacon) continue;
    const phase = (Math.sin(elapsed * 1.8 + t.userData.beaconPhase) + 1) * 0.5;
    t.userData.beacon.intensity = 0.3 + phase * 1.6;
  }
}