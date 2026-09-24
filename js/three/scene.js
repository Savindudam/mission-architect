import * as THREE from 'three';
import { createEnvironment, updateEnvironment } from './environment.js';
import { createActivity, updateActivity } from './activity.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const IS_MOBILE = /Android|iPhone|iPad|iPod|Mobile|webOS|BlackBerry/i.test(navigator.userAgent)
  || (navigator.maxTouchPoints && navigator.maxTouchPoints > 1 && window.innerWidth < 1024);

function makeEnvMap(renderer) {
  const cw = IS_MOBILE ? 512 : 1024;
  const ch = IS_MOBILE ? 256 : 512;
  const c = document.createElement('canvas');
  c.width = cw; c.height = ch;
  const ctx = c.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, 0, ch);
  grad.addColorStop(0.0, '#18182a');
  grad.addColorStop(0.3, '#0e0e18');
  grad.addColorStop(0.5, '#1a1a2c');
  grad.addColorStop(0.7, '#0a0a12');
  grad.addColorStop(1.0, '#060610');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, cw, ch);

  const spot1 = ctx.createRadialGradient(cw*0.25, ch*0.18, 0, cw*0.25, ch*0.18, ch*0.45);
  spot1.addColorStop(0, 'rgba(255,255,255,1.0)');
  spot1.addColorStop(0.3, 'rgba(240,245,255,0.55)');
  spot1.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = spot1; ctx.fillRect(0, 0, cw, ch);

  const spot2 = ctx.createRadialGradient(cw*0.85, ch*0.35, 0, cw*0.85, ch*0.35, ch*0.55);
  spot2.addColorStop(0, 'rgba(80,200,255,0.7)');
  spot2.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = spot2; ctx.fillRect(0, 0, cw, ch);

  const spot3 = ctx.createRadialGradient(cw*0.6, ch*0.6, 0, cw*0.6, ch*0.6, ch*0.4);
  spot3.addColorStop(0, 'rgba(60,120,255,0.4)');
  spot3.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = spot3; ctx.fillRect(0, 0, cw, ch);

  const spot4 = ctx.createRadialGradient(cw*0.5, ch*0.98, 0, cw*0.5, ch*0.98, ch*0.5);
  spot4.addColorStop(0, 'rgba(255,130,50,0.5)');
  spot4.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = spot4; ctx.fillRect(0, 0, cw, ch);

  for (let i = 0; i < 8; i++) {
    const x = Math.random() * cw;
    const y = Math.random() * ch * 0.7;
    const r = 20 + Math.random() * 40;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255,255,255,${0.3 + Math.random()*0.4})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const envRT = pmrem.fromEquirectangular(tex);
  const envMap = envRT.texture;
  pmrem.dispose();
  tex.dispose();
  return envMap;
}

function makeGrid() {
  const g = new THREE.Group();

  const ringMat = new THREE.MeshBasicMaterial({ color: 0x1e2e4a, transparent: true, opacity: 0.7, side: THREE.DoubleSide });
  const ringMatBright = new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.25, side: THREE.DoubleSide });

  for (let i = 1; i <= 8; i++) {
    const r = i * 3.5;
    const isMajor = i % 2 === 0;
    const ringGeo = new THREE.RingGeometry(r - 0.03, r, 96);
    const ring = new THREE.Mesh(ringGeo, isMajor ? ringMatBright : ringMat);
    ring.rotation.x = -Math.PI / 2;
    g.add(ring);
  }

  const spokeMat = new THREE.LineBasicMaterial({ color: 0x1e2e4a, transparent: true, opacity: 0.5 });
  const outerR = 28;
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const pts = [
      new THREE.Vector3(Math.cos(a) * 2.5, 0, Math.sin(a) * 2.5),
      new THREE.Vector3(Math.cos(a) * outerR, 0, Math.sin(a) * outerR),
    ];
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    g.add(new THREE.Line(geo, spokeMat));
  }

  const outerGeo = new THREE.RingGeometry(outerR - 0.06, outerR, 128);
  const outerRing = new THREE.Mesh(outerGeo, new THREE.MeshBasicMaterial({
    color: 0x22d3ee, transparent: true, opacity: 0.5, side: THREE.DoubleSide,
  }));
  outerRing.rotation.x = -Math.PI / 2;
  g.add(outerRing);

  const padGeo = new THREE.CircleGeometry(2.4, 64);
  const pad = new THREE.Mesh(padGeo, new THREE.MeshBasicMaterial({ color: 0x0a0a14, transparent: true, opacity: 0.9 }));
  pad.rotation.x = -Math.PI / 2;
  pad.position.y = 0.01;
  g.add(pad);

  const hazardRing = new THREE.Mesh(
    new THREE.RingGeometry(2.5, 2.65, 64),
    new THREE.MeshBasicMaterial({ color: 0xffcc22, transparent: true, opacity: 0.6, side: THREE.DoubleSide })
  );
  hazardRing.rotation.x = -Math.PI / 2;
  hazardRing.position.y = 0.02;
  g.add(hazardRing);

  return g;
}

function makeContactShadowTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, 'rgba(0,0,0,0.85)');
  grad.addColorStop(0.4, 'rgba(0,0,0,0.45)');
  grad.addColorStop(0.7, 'rgba(0,0,0,0.15)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createScene(wrap) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a18);
  scene.fog = new THREE.FogExp2(0x1a1e2e, IS_MOBILE ? 0.0025 : 0.0032);


  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 5000);
  camera.position.set(20, 14, 30);
  camera.lookAt(0, 10, 0);

  const renderer = new THREE.WebGLRenderer({
    antialias: false,
    alpha: false,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, IS_MOBILE ? 1.5 : 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = IS_MOBILE ? 1.0 : 1.1;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = IS_MOBILE ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;

  renderer.domElement.style.touchAction = 'none';
  renderer.domElement.style.webkitUserSelect = 'none';
  renderer.domElement.style.userSelect = 'none';
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.outline = 'none';
  wrap.appendChild(renderer.domElement);

  scene.environment = makeEnvMap(renderer);

    const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(0, 10, 0);
  controls.minDistance = 6;
  controls.maxDistance = 180;
  controls.minPolarAngle = 0.15;              // never look straight down
  controls.maxPolarAngle = Math.PI * 0.49;    // never go below the horizon
  controls.screenSpacePanning = false;        // pan along the ground plane
  controls.touches = {
    ONE: THREE.TOUCH.ROTATE,
    TWO: THREE.TOUCH.DOLLY_PAN,
  };
  controls.zoomSpeed = IS_MOBILE ? 0.8 : 1.0;
  controls.rotateSpeed = IS_MOBILE ? 0.55 : 1.0;
  controls.panSpeed = IS_MOBILE ? 0.6 : 1.0;
  controls.update();

  const ambient = new THREE.AmbientLight(0xffffff, IS_MOBILE ? 0.32 : 0.24);
  scene.add(ambient);

  const hemi = new THREE.HemisphereLight(0x88aaff, 0x221a10, IS_MOBILE ? 0.35 : 0.3);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xffffff, IS_MOBILE ? 1.8 : 2.0);
  key.position.set(20, 40, 20);
  key.castShadow = true;
  key.shadow.mapSize.width = IS_MOBILE ? 1024 : 2048;
  key.shadow.mapSize.height = IS_MOBILE ? 1024 : 2048;
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 120;
  key.shadow.camera.left = -40;
  key.shadow.camera.right = 40;
  key.shadow.camera.top = 40;
  key.shadow.camera.bottom = -40;
  key.shadow.bias = -0.0003;
  key.shadow.normalBias = 0.025;
  key.shadow.radius = IS_MOBILE ? 2 : 4;
  scene.add(key);

  const rim = new THREE.DirectionalLight(0x22d3ee, IS_MOBILE ? 1.2 : 1.5);
  rim.position.set(0, 8, -30);
  scene.add(rim);

  if (!IS_MOBILE) {
    const fill = new THREE.DirectionalLight(0x88aaff, 0.7);
    fill.position.set(-20, 15, -20);
    scene.add(fill);
    const under = new THREE.DirectionalLight(0xff8855, 0.5);
    under.position.set(0, -20, 10);
    scene.add(under);
  }

  

  const shadowPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 120),
    new THREE.ShadowMaterial({ opacity: 0.6 })
  );
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = -0.04;
  shadowPlane.receiveShadow = true;
  scene.add(shadowPlane);

  const contactShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(9, 9),
    new THREE.MeshBasicMaterial({
      map: makeContactShadowTexture(),
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
    })
  );
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.y = 0.02;
  scene.add(contactShadow);

  const rocketGroup = new THREE.Group();
  scene.add(rocketGroup);
  const environment = createEnvironment(scene);

  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(Math.min(window.devicePixelRatio, IS_MOBILE ? 1.5 : 2));
  composer.addPass(new RenderPass(scene, camera));
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(wrap.clientWidth || 800, wrap.clientHeight || 600),
    IS_MOBILE ? 0.4 : 0.65,
    IS_MOBILE ? 0.35 : 0.5,
    IS_MOBILE ? 0.9 : 0.85
  );
  composer.addPass(bloomPass);
  composer.addPass(new OutputPass());

  function resize() {
    const rect = wrap.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    renderer.setSize(rect.width, rect.height, false);
    composer.setSize(rect.width, rect.height);
    camera.aspect = rect.width / rect.height;
    camera.updateProjectionMatrix();
  }
  resize();

  const ro = new ResizeObserver(resize);
  ro.observe(wrap);
  window.addEventListener('orientationchange', () => setTimeout(resize, 200));

  let running = true;
  let paused = false;
  let lastFrame = 0;
  const frameBudget = 1000 / (IS_MOBILE ? 45 : 60);

  function tick(now) {
    if (!running) return;
    const delta = now - lastFrame;
    if (delta >= frameBudget) {
      lastFrame = now - (delta % frameBudget);
      if (!paused) {
        controls.update();
        if (controls.target.y < 1) controls.target.y = 1;
        if (camera.position.y < 1) camera.position.y = 1;
        updateEnvironment(environment, now * 0.001);
        const y = rocketGroup.position.y;
        contactShadow.position.x = rocketGroup.position.x;
        contactShadow.position.z = rocketGroup.position.z;
        const s = 1 + y * 0.12;
        contactShadow.scale.set(s, s, s);
        contactShadow.material.opacity = 0.75 * Math.max(0, 1 - y * 0.1);
        composer.render();
      }
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  function handleVisibility() { paused = document.hidden; }
  document.addEventListener('visibilitychange', handleVisibility);

  function dispose() {
    running = false;
    ro.disconnect();
    document.removeEventListener('visibilitychange', handleVisibility);
    window.removeEventListener('orientationchange', resize);
    controls.dispose();
    composer.dispose();
    renderer.dispose();
    if (renderer.domElement.parentElement) {
      renderer.domElement.parentElement.removeChild(renderer.domElement);
    }
  }

  function enableShadows(group) {
    group.traverse(obj => {
      if (obj.isMesh) { obj.castShadow = true; obj.receiveShadow = true; }
    });
  }

  return {
    scene, camera, renderer, controls, rocketGroup, dispose,
    IS_MOBILE, composer, enableShadows, contactShadow, environment,
  };
}