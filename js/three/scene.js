import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Detect mobile once at module load.
const IS_MOBILE = /Android|iPhone|iPad|iPod|Mobile|webOS|BlackBerry/i.test(navigator.userAgent)
  || (navigator.maxTouchPoints && navigator.maxTouchPoints > 1 && window.innerWidth < 1024);

function makeEnvMap(renderer) {
  const canvas = document.createElement('canvas');
  // Lower resolution on mobile — env map doesn't need to be that detailed
  canvas.width = IS_MOBILE ? 512 : 1024;
  canvas.height = IS_MOBILE ? 256 : 512;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0.0, '#10101c');
  grad.addColorStop(0.35, '#0a0a14');
  grad.addColorStop(0.5, '#1a1a2a');
  grad.addColorStop(0.65, '#0a0a14');
  grad.addColorStop(1.0, '#050508');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const cw = canvas.width;
  const ch = canvas.height;

  const spot1 = ctx.createRadialGradient(cw * 0.27, ch * 0.2, 0, cw * 0.27, ch * 0.2, ch * 0.35);
  spot1.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
  spot1.addColorStop(0.4, 'rgba(200, 220, 255, 0.35)');
  spot1.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = spot1;
  ctx.fillRect(0, 0, cw, ch);

  const spot2 = ctx.createRadialGradient(cw * 0.83, ch * 0.4, 0, cw * 0.83, ch * 0.4, ch * 0.43);
  spot2.addColorStop(0, 'rgba(80, 220, 255, 0.55)');
  spot2.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = spot2;
  ctx.fillRect(0, 0, cw, ch);

  const spot3 = ctx.createRadialGradient(cw * 0.5, ch * 0.94, 0, cw * 0.5, ch * 0.94, ch * 0.4);
  spot3.addColorStop(0, 'rgba(255, 140, 60, 0.35)');
  spot3.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = spot3;
  ctx.fillRect(0, 0, cw, ch);

  const tex = new THREE.CanvasTexture(canvas);
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

export function createScene(wrap) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x080810);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 5000);
  camera.position.set(18, 12, 28);
  camera.lookAt(0, 10, 0);

  const renderer = new THREE.WebGLRenderer({
    antialias: !IS_MOBILE,           // MSAA off on mobile — big performance win
    alpha: false,
    powerPreference: 'high-performance',
    // Use the device pixel ratio cap below
  });
  // Cap pixel ratio much lower on mobile. 2.0 on a phone means rendering 4x
  // the pixels for a barely-noticeable sharpness gain.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, IS_MOBILE ? 1.5 : 2));
  renderer.shadowMap.enabled = false;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  // Critical for mobile: hand every touch to OrbitControls, never let
  // the browser scroll or zoom the page while touching the canvas.
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
  controls.maxDistance = 120;

  // ---- Touch mapping for mobile ----
  // One finger = rotate the rocket.
  // Two fingers = pinch to zoom and drag to pan.
  controls.touches = {
    ONE: THREE.TOUCH.ROTATE,
    TWO: THREE.TOUCH.DOLLY_PAN,
  };

  // Better mobile behavior
  controls.enableZoom = true;
  controls.zoomSpeed = IS_MOBILE ? 0.8 : 1.0;
  controls.rotateSpeed = IS_MOBILE ? 0.6 : 1.0;
  controls.panSpeed = IS_MOBILE ? 0.6 : 1.0;

  // Smoother rotation on touch — the default is 1.0 which feels floaty on phones
  if (IS_MOBILE) {
    controls.rotateSpeed = 0.55;
    controls.zoomToCursor = false;
  }

  controls.update();

  // ---- Lighting ----
  // Trim light count on mobile — 6 lights is fine on desktop, but each light
  // adds shader cost on a phone GPU. We keep the important ones and drop fill.
  const ambient = new THREE.AmbientLight(0xffffff, IS_MOBILE ? 0.45 : 0.35);
  scene.add(ambient);

  const hemi = new THREE.HemisphereLight(0x88aaff, 0x221a10, IS_MOBILE ? 0.45 : 0.35);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xffffff, IS_MOBILE ? 1.6 : 1.8);
  key.position.set(20, 40, 20);
  scene.add(key);

  const rim = new THREE.DirectionalLight(0x22d3ee, IS_MOBILE ? 1.0 : 1.2);
  rim.position.set(0, 8, -30);
  scene.add(rim);

  // Fill and under lights — desktop only. Env map + hemi compensate on mobile.
  if (!IS_MOBILE) {
    const fill = new THREE.DirectionalLight(0x88aaff, 0.6);
    fill.position.set(-20, 15, -20);
    scene.add(fill);

    const under = new THREE.DirectionalLight(0xff8855, 0.4);
    under.position.set(0, -20, 10);
    scene.add(under);
  }

  // ---- Ground grid ----
  // Fewer divisions on mobile — helps fill-rate.
  const gridDiv = IS_MOBILE ? 20 : 30;
  const grid = new THREE.GridHelper(60, gridDiv, 0x1e1e2a, 0x12121a);
  grid.position.y = -0.05;
  scene.add(grid);

  const rocketGroup = new THREE.Group();
  scene.add(rocketGroup);

  // ---- Resize ----
  function resize() {
    const rect = wrap.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    renderer.setSize(rect.width, rect.height, false);
    camera.aspect = rect.width / rect.height;
    camera.updateProjectionMatrix();
  }
  resize();

  const ro = new ResizeObserver(resize);
  ro.observe(wrap);

  // Also listen for orientation changes — some mobile browsers fire
  // this without triggering a ResizeObserver.
  window.addEventListener('orientationchange', () => {
    setTimeout(resize, 200);
  });

  // ---- Render loop ----
  let running = true;
  let paused = false;
  let lastFrame = 0;
  // Cap at 60fps on desktop, 45fps on mobile to save battery. No visible difference.
  const frameBudget = 1000 / (IS_MOBILE ? 45 : 60);

  function tick(now) {
    if (!running) return;
    const delta = now - lastFrame;
    if (delta >= frameBudget) {
      lastFrame = now - (delta % frameBudget);
      if (!paused) {
        controls.update();
        renderer.render(scene, camera);
      }
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  // Pause rendering when the tab is hidden or the canvas is offscreen.
  function handleVisibility() {
    paused = document.hidden;
  }
  document.addEventListener('visibilitychange', handleVisibility);

  function dispose() {
    running = false;
    ro.disconnect();
    document.removeEventListener('visibilitychange', handleVisibility);
    window.removeEventListener('orientationchange', resize);
    controls.dispose();
    renderer.dispose();
    if (renderer.domElement.parentElement) {
      renderer.domElement.parentElement.removeChild(renderer.domElement);
    }
  }

  return { scene, camera, renderer, controls, rocketGroup, dispose, IS_MOBILE };
}