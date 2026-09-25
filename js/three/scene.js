import * as THREE from 'three';
import { createEnvironment, updateEnvironment } from './environment.js';
import { createActivity, updateActivity } from './activity.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { getPreset } from './quality.js';

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

export function createScene(wrap, qualityId) {
  const preset = getPreset(qualityId);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a18);
  // Lighter fog so the pad isn't a haze ball
  scene.fog = new THREE.FogExp2(0x1a1e2e, IS_MOBILE ? 0.0010 : 0.0015);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 5000);
  camera.position.set(20, 14, 30);
  camera.lookAt(0, 10, 0);

  const renderer = new THREE.WebGLRenderer({
    antialias: preset.antialias,
    alpha: false,
    powerPreference: 'high-performance',
  });

  const pixRatio = IS_MOBILE
    ? Math.min(preset.pixelRatio, 1.25)
    : preset.pixelRatio;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, pixRatio));

  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = IS_MOBILE ? preset.exposure * 0.85 : preset.exposure * 0.95;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  renderer.shadowMap.enabled = preset.shadows.enabled;
  renderer.shadowMap.type = preset.shadows.type === 'PCFSoft'
    ? THREE.PCFSoftShadowMap
    : preset.shadows.type === 'PCF'
      ? THREE.PCFShadowMap
      : THREE.BasicShadowMap;

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
  controls.minPolarAngle = 0.15;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.screenSpacePanning = false;
  controls.touches = {
    ONE: THREE.TOUCH.ROTATE,
    TWO: THREE.TOUCH.DOLLY_PAN,
  };
  controls.zoomSpeed = IS_MOBILE ? 0.8 : 1.0;
  controls.rotateSpeed = IS_MOBILE ? 0.55 : 1.0;
  controls.panSpeed = IS_MOBILE ? 0.6 : 1.0;
  controls.update();

  // ---- lighting ----
  // Higher ambient so shadows aren't pitch black.
  const ambient = new THREE.AmbientLight(0xc8d0e0, IS_MOBILE ? 0.34 : 0.30);
  scene.add(ambient);

  const hemi = new THREE.HemisphereLight(0xa8c0ff, 0x4a2818, IS_MOBILE ? 0.5 : 0.4);
  scene.add(hemi);

  // Sun raised to nearly overhead. Shadow shorter and softer.
  const key = new THREE.DirectionalLight(0xffffff, IS_MOBILE ? 1.4 : 1.6);
  key.position.set(30, 90, 30);
  key.castShadow = preset.shadows.enabled;
  key.shadow.mapSize.width = preset.shadows.mapSize;
  key.shadow.mapSize.height = preset.shadows.mapSize;
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 220;
  // Wide enough to cover the 70-wide pad plus surroundings.
  key.shadow.camera.left = -90;
  key.shadow.camera.right = 90;
  key.shadow.camera.top = 90;
  key.shadow.camera.bottom = -90;
  key.shadow.bias = -0.0008;
  key.shadow.normalBias = 0.03;
  key.shadow.radius = IS_MOBILE ? 4 : 8;
  scene.add(key);

  const rim = new THREE.DirectionalLight(0x22d3ee, IS_MOBILE ? 0.6 : 0.8);
  rim.position.set(0, 8, -30);
  scene.add(rim);

  if (!IS_MOBILE) {
    const fill = new THREE.DirectionalLight(0x88aaff, 0.5);
    fill.position.set(-20, 15, -20);
    scene.add(fill);
    const under = new THREE.DirectionalLight(0xff8855, 0.35);
    under.position.set(0, -20, 10);
    scene.add(under);
  }

  // NOTE: no shadowPlane, no contactShadow.
  // The pad's top surface catches the directional shadow directly.

  const rocketGroup = new THREE.Group();
  scene.add(rocketGroup);
  const environment = createEnvironment(scene, preset);

  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(Math.min(window.devicePixelRatio, IS_MOBILE ? 1.5 : 2));
  composer.addPass(new RenderPass(scene, camera));
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(wrap.clientWidth || 800, wrap.clientHeight || 600),
    preset.bloom.enabled ? (IS_MOBILE ? preset.bloom.strength * 0.5 : preset.bloom.strength * 0.75) : 0,
    preset.bloom.radius,
    preset.bloom.threshold + 0.05
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
        updateEnvironment(environment, now * 0.001, Math.min(0.05, delta / 1000));
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
    IS_MOBILE, composer, enableShadows, environment, preset,
  };
}