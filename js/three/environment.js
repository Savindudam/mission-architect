import * as THREE from 'three';

// ============================================================
// ENVIRONMENT
// Launch complex with volumetric sun, cloud layer, dust field.
// Every effect is procedural — no external assets.
// ============================================================

const SUN_DIRECTION = new THREE.Vector3(0.55, 0.42, 0.72).normalize();

const TEX_CACHE = {};

// ---------- helpers ----------

function cached(key, fn) {
  if (TEX_CACHE[key]) return TEX_CACHE[key];
  TEX_CACHE[key] = fn();
  return TEX_CACHE[key];
}

function canvas2d(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// ---------- noise ----------
// Cheap value noise used by every texture generator.

function valueNoise(x, y, seed) {
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
  const a = valueNoise(xi, yi, seed);
  const b = valueNoise(xi + 1, yi, seed);
  const c = valueNoise(xi, yi + 1, seed);
  const d = valueNoise(xi + 1, yi + 1, seed);
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}

function fbm(x, y, octaves, seed) {
  let total = 0;
  let amp = 1;
  let freq = 1;
  let max = 0;
  for (let i = 0; i < octaves; i++) {
    total += smoothNoise(x * freq, y * freq, seed + i) * amp;
    max += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return total / max;
}

// ============================================================
// TEXTURES
// ============================================================

// ---------- concrete color ----------

function makeConcreteColor() {
  return cached('concreteColor', () => {
    const size = 1024;
    const c = canvas2d(size, size);
    const ctx = c.getContext('2d');

    ctx.fillStyle = '#7a7a80';
    ctx.fillRect(0, 0, size, size);

    // base noise
    for (let y = 0; y < size; y += 2) {
      for (let x = 0; x < size; x += 2) {
        const n = fbm(x * 0.02, y * 0.02, 5, 1);
        const v = 100 + n * 60;
        ctx.fillStyle = `rgb(${v}, ${v}, ${v + 4})`;
        ctx.fillRect(x, y, 2, 2);
      }
    }

    // oil and rust patches
    for (let i = 0; i < 40; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const r = 30 + Math.random() * 140;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      const hue = Math.random();
      if (hue < 0.4) {
        g.addColorStop(0, `rgba(30, 26, 22, ${0.15 + Math.random() * 0.25})`);
        g.addColorStop(1, 'rgba(30, 26, 22, 0)');
      } else if (hue < 0.75) {
        g.addColorStop(0, `rgba(120, 90, 60, ${0.12 + Math.random() * 0.18})`);
        g.addColorStop(1, 'rgba(120, 90, 60, 0)');
      } else {
        g.addColorStop(0, `rgba(50, 55, 65, ${0.15 + Math.random() * 0.2})`);
        g.addColorStop(1, 'rgba(50, 55, 65, 0)');
      }
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }

    // panel seams every 128px
    ctx.strokeStyle = 'rgba(30, 30, 34, 0.85)';
    ctx.lineWidth = 3;
    for (let i = 128; i < size; i += 128) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, size); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(size, i); ctx.stroke();
    }

    // hairline cracks
    ctx.strokeStyle = 'rgba(20, 20, 22, 0.7)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 80; i++) {
      let x = Math.random() * size;
      let y = Math.random() * size;
      ctx.beginPath();
      ctx.moveTo(x, y);
      const segs = 3 + Math.floor(Math.random() * 6);
      for (let s = 0; s < segs; s++) {
        x += (Math.random() - 0.5) * 80;
        y += (Math.random() - 0.5) * 80;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // bolts at panel intersections
    for (let i = 128; i < size; i += 128) {
      for (let j = 128; j < size; j += 128) {
        ctx.fillStyle = 'rgba(50, 50, 55, 0.95)';
        ctx.beginPath(); ctx.arc(i, j, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(180, 180, 185, 0.9)';
        ctx.beginPath(); ctx.arc(i - 1.5, j - 1.5, 2.5, 0, Math.PI * 2); ctx.fill();
      }
    }

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 8;
    return tex;
  });
}

// ---------- concrete normal map ----------
// Encodes the panel seams, cracks and bolts as height. Gives real surface
// depth when lit from the side.

function makeConcreteNormal() {
  return cached('concreteNormal', () => {
    const size = 1024;
    const c = canvas2d(size, size);
    const ctx = c.getContext('2d');

    // flat grey = flat surface
    ctx.fillStyle = '#8080ff';
    ctx.fillRect(0, 0, size, size);

    // noise-driven bumps
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const n = fbm(x * 0.05, y * 0.05, 3, 7);
        const bump = Math.floor(n * 40) - 20;
        const px = x;
        const py = y;
        ctx.fillStyle = `rgb(${128 + bump}, ${128 + bump}, 255)`;
        ctx.fillRect(px, py, 1, 1);
      }
    }

    // panel seams pressed in
    ctx.fillStyle = 'rgb(80, 80, 255)';
    for (let i = 128; i < size; i += 128) {
      ctx.fillRect(i - 2, 0, 4, size);
      ctx.fillRect(0, i - 2, size, 4);
    }
    ctx.fillStyle = 'rgb(180, 180, 255)';
    for (let i = 128; i < size; i += 128) {
      ctx.fillRect(i - 4, 0, 2, size);
      ctx.fillRect(0, i - 4, size, 2);
    }

    // bolt heads raised
    for (let i = 128; i < size; i += 128) {
      for (let j = 128; j < size; j += 128) {
        const g = ctx.createRadialGradient(i, j, 0, i, j, 6);
        g.addColorStop(0, 'rgb(220, 220, 255)');
        g.addColorStop(0.7, 'rgb(180, 180, 255)');
        g.addColorStop(1, 'rgb(128, 128, 255)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(i, j, 6, 0, Math.PI * 2); ctx.fill();
      }
    }

    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 8;
    return tex;
  });
}

// ---------- ground color ----------

function makeGroundColor() {
  return cached('groundColor', () => {
    const size = 1024;
    const c = canvas2d(size, size);
    const ctx = c.getContext('2d');

    ctx.fillStyle = '#5c4536';
    ctx.fillRect(0, 0, size, size);

    // fractal terrain tint
    for (let y = 0; y < size; y += 2) {
      for (let x = 0; x < size; x += 2) {
        const n = fbm(x * 0.008, y * 0.008, 6, 12);
        const r = 70 + n * 60;
        const g = 55 + n * 45;
        const b = 40 + n * 30;
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.fillRect(x, y, 2, 2);
      }
    }

    // wind streaks
    ctx.strokeStyle = 'rgba(45, 32, 24, 0.55)';
    ctx.lineWidth = 1.6;
    for (let i = 0; i < 400; i++) {
      const y = Math.random() * size;
      const x = Math.random() * size;
      const len = 60 + Math.random() * 260;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + len * 0.5, y + (Math.random() - 0.5) * 12, x + len, y);
      ctx.stroke();
    }

    // dark basins
    for (let i = 0; i < 40; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const r = 30 + Math.random() * 120;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(30, 20, 14, ${0.25 + Math.random() * 0.25})`);
      g.addColorStop(1, 'rgba(30, 20, 14, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }

    // scattered rocks
    for (let i = 0; i < 500; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const s = 2 + Math.random() * 6;
      const v = 60 + Math.random() * 40;
      ctx.fillStyle = `rgba(${v}, ${v - 15}, ${v - 25}, 0.9)`;
      ctx.beginPath(); ctx.arc(x, y, s, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.beginPath(); ctx.arc(x + 1.5, y + 1.5, s * 0.6, 0, Math.PI * 2); ctx.fill();
    }

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 8;
    return tex;
  });
}

// ---------- ground normal ----------

function makeGroundNormal() {
  return cached('groundNormal', () => {
    const size = 512;
    const c = canvas2d(size, size);
    const ctx = c.getContext('2d');

    ctx.fillStyle = '#8080ff';
    ctx.fillRect(0, 0, size, size);

    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const n = fbm(x * 0.08, y * 0.08, 4, 22);
        const bump = Math.floor(n * 60) - 30;
        ctx.fillStyle = `rgb(${128 + bump}, ${128 + bump}, 255)`;
        ctx.fillRect(x, y, 1, 1);
      }
    }

    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 8;
    return tex;
  });
}

// ============================================================
// SKY DOME
// ============================================================

function makeSkyDome() {
  const geo = new THREE.SphereGeometry(800, 64, 32);

  const uniforms = {
    topColor:     { value: new THREE.Color(0x04060f) },
    midColor:     { value: new THREE.Color(0x0d1426) },
    horizonColor: { value: new THREE.Color(0x2e1f34) },
    groundColor:  { value: new THREE.Color(0x100a16) },
    sunDirection: { value: SUN_DIRECTION.clone() },
    sunDiskColor: { value: new THREE.Color(0xffe4b0) },
    sunHaloColor: { value: new THREE.Color(0xff8844) },
    time:         { value: 0 },
  };

  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms,
    vertexShader: `
      varying vec3 vWorldPos;
      varying vec3 vLocalPos;
      void main() {
        vLocalPos = position;
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
      uniform vec3 sunDiskColor;
      uniform vec3 sunHaloColor;
      uniform float time;

      varying vec3 vWorldPos;
      varying vec3 vLocalPos;

      float hash(vec3 p) {
        return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
      }

      float noise(vec3 p) {
        vec3 i = floor(p);
        vec3 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float n000 = hash(i);
        float n100 = hash(i + vec3(1.0, 0.0, 0.0));
        float n010 = hash(i + vec3(0.0, 1.0, 0.0));
        float n110 = hash(i + vec3(1.0, 1.0, 0.0));
        float n001 = hash(i + vec3(0.0, 0.0, 1.0));
        float n101 = hash(i + vec3(1.0, 0.0, 1.0));
        float n011 = hash(i + vec3(0.0, 1.0, 1.0));
        float n111 = hash(i + vec3(1.0, 1.0, 1.0));
        return mix(
          mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),
          mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y),
          f.z
        );
      }

      float fbm(vec3 p) {
        float total = 0.0;
        float amp = 0.5;
        for (int i = 0; i < 5; i++) {
          total += noise(p) * amp;
          p *= 2.03;
          amp *= 0.5;
        }
        return total;
      }

      void main() {
        vec3 dir = normalize(vWorldPos);
        float h = dir.y;

        // base gradient
        vec3 sky;
        if (h > 0.0) {
          sky = mix(horizonColor, midColor, smoothstep(0.0, 0.4, h));
          sky = mix(sky, topColor, smoothstep(0.4, 1.0, h));
        } else {
          sky = mix(horizonColor, groundColor, smoothstep(0.0, -0.5, h));
        }

        // stars near zenith
        if (h > 0.15) {
          vec3 sDir = dir * 200.0;
          float star = hash(floor(sDir));
          float starMask = step(0.998, star) * smoothstep(0.15, 0.5, h);
          float twinkle = 0.6 + 0.4 * sin(time * 3.0 + star * 100.0);
          sky += vec3(1.0, 0.95, 0.85) * starMask * twinkle * 1.4;
        }

        // distant cloud layer — very subtle wisps near the horizon
        vec3 cloudDir = dir / max(0.12, abs(h));
        float clouds = fbm(cloudDir * 0.6 + vec3(time * 0.005, 0.0, 0.0));
        clouds = smoothstep(0.55, 0.85, clouds);
        clouds *= smoothstep(-0.05, 0.35, h) * smoothstep(0.75, 0.35, h);
        sky = mix(sky, vec3(0.28, 0.22, 0.30), clouds * 0.55);

        // sun
        float sunDot = max(dot(dir, sunDirection), 0.0);
        float disk = pow(sunDot, 1400.0);
        float innerHalo = pow(sunDot, 30.0) * 0.9;
        float outerHalo = pow(sunDot, 6.0) * 0.32;
        float megaHalo = pow(sunDot, 1.5) * 0.06;

        sky += sunDiskColor * disk * 2.6;
        sky += sunDiskColor * innerHalo;
        sky += sunHaloColor * outerHalo;
        sky += sunHaloColor * megaHalo;

        gl_FragColor = vec4(sky, 1.0);
      }
    `,
  });

  const dome = new THREE.Mesh(geo, mat);
  dome.renderOrder = -1000;
  dome.userData.material = mat;
  dome.userData.uniforms = uniforms;
  return dome;
}

// ============================================================
// VOLUMETRIC SUN SHAFT
// A large transparent cone pointing away from the sun. Combined with
// additive blending it reads as god rays.
// ============================================================

function makeSunShaft() {
  const group = new THREE.Group();

  const shaftGeo = new THREE.CylinderGeometry(220, 8, 400, 32, 1, true);
  const shaftMat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    depthWrite: false,
    transparent: true,
    blending: THREE.AdditiveBlending,
    uniforms: {
      color: { value: new THREE.Color(0xff9955) },
      intensity: { value: 0.06 },
    },
    vertexShader: `
      varying vec3 vPos;
      void main() {
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 color;
      uniform float intensity;
      varying vec3 vPos;
      void main() {
        // fade along the length of the cone
        float t = (vPos.y + 200.0) / 400.0;
        float fade = pow(1.0 - t, 2.0);
        gl_FragColor = vec4(color, fade * intensity);
      }
    `,
  });

  const shaft = new THREE.Mesh(shaftGeo, shaftMat);
  shaft.rotation.z = Math.PI / 2;
  shaft.userData.material = shaftMat;

  // Position the shaft so its narrow end is near the sun direction
  const dist = 300;
  shaft.position.set(
    SUN_DIRECTION.x * dist,
    SUN_DIRECTION.y * dist,
    SUN_DIRECTION.z * dist
  );
  shaft.lookAt(0, 0, 0);
  shaft.rotateX(Math.PI / 2);

  group.add(shaft);
  group.userData.shaft = shaft;
  return group;
}

// ============================================================
// GROUND PLANE
// ============================================================

function makeGround() {
  const color = makeGroundColor();
  color.repeat.set(50, 50);

  const normal = makeGroundNormal();
  normal.repeat.set(50, 50);

  const mat = new THREE.MeshStandardMaterial({
    map: color,
    normalMap: normal,
    normalScale: new THREE.Vector2(1.2, 1.2),
    color: 0x9a8570,
    roughness: 0.97,
    metalness: 0.0,
  });

  const geo = new THREE.PlaneGeometry(1600, 1600, 4, 4);
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = -0.55;
  mesh.receiveShadow = true;
  return mesh;
}

// ============================================================
// CONCRETE PAD
// ============================================================

function makePad() {
  const g = new THREE.Group();

  const color = makeConcreteColor();
  color.repeat.set(4, 4);
  const normal = makeConcreteNormal();
  normal.repeat.set(4, 4);

  const padMat = new THREE.MeshStandardMaterial({
    map: color,
    normalMap: normal,
    normalScale: new THREE.Vector2(0.9, 0.9),
    color: 0xb0b0b4,
    roughness: 0.85,
    metalness: 0.06,
  });

  // main pad
  const pad = new THREE.Mesh(new THREE.BoxGeometry(90, 0.6, 90), padMat);
  pad.position.y = -0.1;
  pad.receiveShadow = true;
  g.add(pad);

  // pad lip — raised edge all the way around
  const lipMat = new THREE.MeshStandardMaterial({ color: 0x38383f, roughness: 0.9 });
  const L = 91;
  const lipH = 0.5;
  const lipT = 0.7;
  g.add(new THREE.Mesh(new THREE.BoxGeometry(L, lipH, lipT), lipMat).clone().translateZ( L / 2));
  g.add(new THREE.Mesh(new THREE.BoxGeometry(L, lipH, lipT), lipMat).clone().translateZ(-L / 2));
  g.add(new THREE.Mesh(new THREE.BoxGeometry(lipT, lipH, L), lipMat).clone().translateX( L / 2));
  g.add(new THREE.Mesh(new THREE.BoxGeometry(lipT, lipH, L), lipMat).clone().translateX(-L / 2));

  // blast trench
  const trench = new THREE.Mesh(
    new THREE.BoxGeometry(11, 0.5, 62),
    new THREE.MeshStandardMaterial({ color: 0x0e0e14, roughness: 0.98 })
  );
  trench.position.y = -0.5;
  g.add(trench);

  const trenchFloor = new THREE.Mesh(
    new THREE.BoxGeometry(10, 0.1, 60),
    new THREE.MeshStandardMaterial({ color: 0x2a2a32, roughness: 0.9 })
  );
  trenchFloor.position.y = -0.8;
  g.add(trenchFloor);

  // hazard ring — yellow with black stripes
  const ringSegments = 48;
  const ringR1 = 7.0;
  const ringR2 = 7.7;
  for (let i = 0; i < ringSegments; i++) {
    const a0 = (i / ringSegments) * Math.PI * 2;
    const a1 = ((i + 1) / ringSegments) * Math.PI * 2;
    const geo = new THREE.RingGeometry(ringR1, ringR2, 4, 1, a0, a1 - a0);
    const mat = i % 2 === 0 ? MAT_HAZARD_YELLOW : MAT_HAZARD_DARK;
    const seg = new THREE.Mesh(geo, mat);
    seg.rotation.x = -Math.PI / 2;
    seg.position.y = 0.21;
    g.add(seg);
  }

  // thin inner ring
  const ring2 = new THREE.Mesh(
    new THREE.RingGeometry(6.35, 6.5, 96),
    MAT_HAZARD_RED
  );
  ring2.rotation.x = -Math.PI / 2;
  ring2.position.y = 0.21;
  g.add(ring2);

  // corner chevrons
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const chev = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 0.06, 0.5),
      MAT_HAZARD_YELLOW
    );
    chev.position.set(Math.cos(a) * 28, 0.21, Math.sin(a) * 28);
    chev.rotation.y = -a;
    g.add(chev);
  }

  // tie-down blocks
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const x = Math.cos(a) * 34;
    const z = Math.sin(a) * 34;

    const block = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 0.9, 2.4),
      new THREE.MeshStandardMaterial({ color: 0x404048, roughness: 0.85 })
    );
    block.position.set(x, 0.45, z);
    g.add(block);

    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(2.5, 0.1, 2.5),
      MAT_HAZARD_YELLOW
    );
    cap.position.set(x, 0.92, z);
    g.add(cap);

    // vertical strut
    const strut = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.2, 1.2, 8),
      MAT_STEEL_DARK
    );
    strut.position.set(x, 1.5, z);
    g.add(strut);
  }

  return g;
}

// ============================================================
// CABLE TRAYS + PIPE NETWORKS
// ============================================================

function makeCableTray(length, x, z, rotY, height) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;

  // tray — a shallow U-shaped channel
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(length, 0.06, 0.6),
    MAT_STEEL_DARK
  );
  floor.position.y = height;
  g.add(floor);

  const wallL = new THREE.Mesh(
    new THREE.BoxGeometry(length, 0.35, 0.06),
    MAT_STEEL
  );
  wallL.position.set(0, height + 0.15, 0.3);
  g.add(wallL);

  const wallR = wallL.clone();
  wallR.position.z = -0.3;
  g.add(wallR);

  // support brackets every 4 units
  const count = Math.floor(length / 4);
  for (let i = 0; i <= count; i++) {
    const t = i / count;
    const px = -length / 2 + t * length;
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.1, height, 6),
      MAT_STEEL
    );
    post.position.set(px, height / 2, 0);
    g.add(post);

    const brace = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.08, 0.7),
      MAT_STEEL
    );
    brace.position.set(px, height - 0.04, 0);
    g.add(brace);
  }

  return g;
}

function makePipeRun(length, radius, x, z, rotY, height, color) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;

  const pipeMat = new THREE.MeshStandardMaterial({
    color: color || 0x8a8a90,
    metalness: 0.85,
    roughness: 0.35,
  });

  const pipe = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, 12, 1),
    pipeMat
  );
  pipe.rotation.z = Math.PI / 2;
  pipe.position.y = height;
  g.add(pipe);

  // support stands
  const count = Math.floor(length / 3);
  for (let i = 0; i <= count; i++) {
    const t = i / count;
    const px = -length / 2 + t * length;

    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.08, height - radius, 6),
      MAT_STEEL
    );
    post.position.set(px, (height - radius) / 2, 0);
    g.add(post);

    const cradle = new THREE.Mesh(
      new THREE.TorusGeometry(radius * 1.15, 0.04, 6, 12, Math.PI),
      MAT_STEEL
    );
    cradle.rotation.z = Math.PI / 2;
    cradle.position.set(px, height, 0);
    g.add(cradle);
  }

  // pipe flanges every 6 units
  const flanges = Math.floor(length / 6);
  for (let i = 1; i < flanges; i++) {
    const px = -length / 2 + (i / flanges) * length;
    const flange = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 1.4, radius * 1.4, 0.15, 12),
      MAT_STEEL_DARK
    );
    flange.rotation.z = Math.PI / 2;
    flange.position.set(px, height, 0);
    g.add(flange);
  }

  return g;
}

// ============================================================
// MOUNTAINS
// ============================================================

function makeMountains() {
  const g = new THREE.Group();

  const nearMat = new THREE.MeshStandardMaterial({
    color: 0x2a2233,
    roughness: 1.0,
    metalness: 0.0,
  });

  const farMat = new THREE.MeshStandardMaterial({
    color: 0x1a1626,
    roughness: 1.0,
    metalness: 0.0,
  });

  const ranges = [
    { radius: 380, count: 70, baseH: 22, mat: nearMat, w: 40 },
    { radius: 520, count: 50, baseH: 34, mat: farMat,  w: 55 },
    { radius: 680, count: 35, baseH: 48, mat: farMat,  w: 70 },
  ];

  for (const r of ranges) {
    for (let i = 0; i < r.count; i++) {
      const a = (i / r.count) * Math.PI * 2 + Math.random() * 0.15;
      const h = r.baseH + Math.random() * r.baseH * 1.2;
      const w = r.w + Math.random() * r.w * 0.6;
      const sides = 5 + Math.floor(Math.random() * 4);
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(w, h, sides, 1),
        r.mat
      );
      cone.position.set(Math.cos(a) * r.radius, h / 2, Math.sin(a) * r.radius);
      cone.rotation.y = Math.random() * Math.PI * 2;
      // squish some of them so the silhouette is not all cones
      cone.scale.z = 0.6 + Math.random() * 0.5;
      g.add(cone);
    }
  }

  return g;
}

// ============================================================
// DISTANT CITY SKYLINE
// Blocks with lit windows along one side of the horizon.
// ============================================================

function makeDistantCity() {
  const g = new THREE.Group();

  const blockMat = new THREE.MeshStandardMaterial({
    color: 0x12121c,
    roughness: 0.9,
    metalness: 0.2,
  });

  const windowMat = new THREE.MeshBasicMaterial({
    color: 0xffd28a,
    transparent: true,
    opacity: 0.85,
  });

  const count = 60;
  const arcStart = -Math.PI * 0.35;
  const arcEnd = Math.PI * 0.15;
  const radius = 240;

  for (let i = 0; i < count; i++) {
    const t = i / count;
    const a = arcStart + t * (arcEnd - arcStart);
    const x = Math.cos(a) * radius;
    const z = Math.sin(a) * radius;
    const w = 5 + Math.random() * 10;
    const d = 5 + Math.random() * 10;
    const h = 8 + Math.random() * 35;

    const block = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), blockMat);
    block.position.set(x, h / 2, z);
    block.rotation.y = -a;
    g.add(block);

    // window lights — thin strip on the facing side
    const facing = new THREE.Mesh(
      new THREE.PlaneGeometry(w * 0.85, h * 0.85),
      windowMat
    );
    facing.position.set(
      x - Math.cos(a) * d * 0.51,
      h / 2,
      z - Math.sin(a) * d * 0.51
    );
    facing.rotation.y = -a + Math.PI / 2;
    g.add(facing);
  }

  return g;
}

// ============================================================
// DUST PARTICLES
// Small drifting motes in the air near the pad.
// ============================================================

function makeDustField() {
  const count = 400;
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const speeds = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    positions[i * 3]     = (Math.random() - 0.5) * 120;
    positions[i * 3 + 1] = Math.random() * 30 + 0.5;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 120;
    speeds[i] = 0.3 + Math.random() * 0.8;
  }

  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const mat = new THREE.PointsMaterial({
    color: 0xffddaa,
    size: 0.35,
    transparent: true,
    opacity: 0.35,
    sizeAttenuation: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geo, mat);
  points.userData.speeds = speeds;
  points.userData.basePositions = positions.slice();
  return points;
}

// ============================================================
// TOWERS, WATER TOWER, TANKS, FLOODLIGHTS, HANGARS
// (unchanged from previous version, kept here for completeness)
// ============================================================

const MAT_STEEL = new THREE.MeshStandardMaterial({ color: 0x6a6a74, roughness: 0.42, metalness: 0.85 });
const MAT_STEEL_DARK = new THREE.MeshStandardMaterial({ color: 0x2a2a32, roughness: 0.38, metalness: 0.9 });
const MAT_WHITE = new THREE.MeshStandardMaterial({ color: 0xd8d8dc, roughness: 0.55, metalness: 0.1 });
const MAT_HAZARD_YELLOW = new THREE.MeshStandardMaterial({ color: 0xd9a520, roughness: 0.6, metalness: 0.3 });
const MAT_HAZARD_DARK = new THREE.MeshStandardMaterial({ color: 0x1a1a1e, roughness: 0.6, metalness: 0.3 });
const MAT_HAZARD_RED = new THREE.MeshStandardMaterial({ color: 0xb8332a, roughness: 0.6, metalness: 0.3 });
const MAT_HANGAR = new THREE.MeshStandardMaterial({ color: 0x3a4048, roughness: 0.7, metalness: 0.2 });
const MAT_HANGAR_DARK = new THREE.MeshStandardMaterial({ color: 0x22262e, roughness: 0.75, metalness: 0.15 });
const MAT_LIGHT_HOUSING = new THREE.MeshStandardMaterial({ color: 0x1a1a20, roughness: 0.5, metalness: 0.6 });
const MAT_GLOW = new THREE.MeshBasicMaterial({ color: 0xfff4c4, transparent: true, opacity: 0.95 });

function makeLightningTower(x, z) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const height = 42;
  const baseW = 1.2;

  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, height, 0.12), MAT_STEEL_DARK);
    leg.position.set(Math.cos(a) * baseW * 0.4, height / 2, Math.sin(a) * baseW * 0.4);
    leg.rotation.z = -Math.cos(a) * 0.03;
    leg.rotation.x = Math.sin(a) * 0.03;
    g.add(leg);
  }

  const braceCount = Math.floor(height / 4);
  for (let b = 0; b < braceCount; b++) {
    const y = 2 + b * 4;
    const t = y / height;
    const r = baseW * 0.4 * (1 - t * 0.5);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.05, 4, 12), MAT_STEEL_DARK);
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

function makeWaterTower() {
  const g = new THREE.Group();
  const height = 24;

  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, height, 8), MAT_WHITE);
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

function makeStorageSphere(x, z, radius) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const height = radius * 1.4;

  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, height, 6), MAT_WHITE);
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

function makeFloodlight(x, z, rotY) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  const height = 20;

  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, height, 8), MAT_STEEL_DARK);
  pole.position.y = height / 2;
  g.add(pole);

  const crossbar = new THREE.Mesh(new THREE.BoxGeometry(6, 0.4, 0.4), MAT_STEEL_DARK);
  crossbar.position.y = height;
  g.add(crossbar);

  for (const lx of [-2.5, -1.5, -0.5, 0.5, 1.5, 2.5]) {
    const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 0.5, 10), MAT_LIGHT_HOUSING);
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
  const band = new THREE.Mesh(new THREE.BoxGeometry(w * 0.95, 1.2, d * 1.02), MAT_HANGAR_DARK);
  band.position.y = h * 0.65;
  g.add(band);
  return g;
}

// ============================================================
// PUBLIC API
// ============================================================

export function createEnvironment(scene) {
  const group = new THREE.Group();
  scene.add(group);

  const sky = makeSkyDome();
  group.add(sky);

  group.add(makeSunShaft());
  group.add(makeGround());
  group.add(makeMountains());
  group.add(makeDistantCity());
  group.add(makePad());

  // cable trays running along the pad
  group.add(makeCableTray(84, 0, -38, 0, 0.8));
  group.add(makeCableTray(84, 0,  38, 0, 0.8));
  group.add(makeCableTray(84, -44, 0, Math.PI / 2, 0.8));

  // pipe runs
  group.add(makePipeRun(84, 0.35, 0, -42, 0, 0.7, 0xa0a0a8));
  group.add(makePipeRun(84, 0.25, 0, 42, 0, 1.1, 0x9a5a44));
  group.add(makePipeRun(84, 0.3, 44, 0, Math.PI / 2, 0.9, 0x8a8a94));

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
    const mast = makeFloodlight(Math.cos(a) * 32, Math.sin(a) * 32, -a + Math.PI);
    group.add(mast);
    floodlights.push(mast);
  }

  group.add(makeHangar(-90, -60, 40, 22, 30));
  group.add(makeHangar( 70, -80, 55, 28, 40));
  group.add(makeHangar(-70,  70, 35, 18, 26));
  group.add(makeHangar( 95,  40, 30, 15, 22));

  const dust = makeDustField();
  group.add(dust);

  return { group, towers, floodlights, waterTower, sky, dust };
}

export function updateEnvironment(env, elapsed, dt) {
  if (!env) return;

  for (const t of env.towers) {
    if (!t.userData.beacon) continue;
    const phase = (Math.sin(elapsed * 1.8 + t.userData.beaconPhase) + 1) * 0.5;
    t.userData.beacon.intensity = 0.3 + phase * 1.6;
  }

  if (env.sky && env.sky.userData.uniforms) {
    env.sky.userData.uniforms.time.value = elapsed;
  }

  if (env.dust) {
    const positions = env.dust.geometry.attributes.position.array;
    const speeds = env.dust.userData.speeds;
    const base = env.dust.userData.basePositions;
    const count = positions.length / 3;
    for (let i = 0; i < count; i++) {
      const t = elapsed * 0.3 * speeds[i] + i * 0.1;
      positions[i * 3]     = base[i * 3]     + Math.sin(t) * 1.5;
      positions[i * 3 + 1] = base[i * 3 + 1] + Math.sin(t * 0.5) * 0.5;
      positions[i * 3 + 2] = base[i * 3 + 2] + Math.cos(t * 0.8) * 1.5;
    }
    env.dust.geometry.attributes.position.needsUpdate = true;
  }
}