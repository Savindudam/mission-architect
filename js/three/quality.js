// Quality presets. Every tunable knob in the renderer, scene, and
// environment pulls from one of these. Changing the preset requires
// a builder remount — the scene does not hot-swap.

export const QUALITY_PRESETS = {
  low: {
    id: 'low',
    name: 'LOW',
    tagline: 'Battery saver',
    description: 'For weaker machines or smooth framerate over looks. Fast load.',
    pixelRatio: 0.75,
    antialias: false,
    bloom: { enabled: false, strength: 0, radius: 0, threshold: 1 },
    shadows: { enabled: false, mapSize: 512, type: 'Basic' },
    exposure: 1.0,
    dustCount: 40,
    mountainRanges: 1,
    cityBuildings: 15,
    cableTrays: 0,
    pipeRuns: 1,
  },
  medium: {
    id: 'medium',
    name: 'MEDIUM',
    tagline: 'Balanced',
    description: 'Good visuals without heavy GPU load. Default for most players.',
    pixelRatio: 1.0,
    antialias: true,
    bloom: { enabled: true, strength: 0.4, radius: 0.5, threshold: 0.9 },
    shadows: { enabled: true, mapSize: 1024, type: 'PCF' },
    exposure: 1.2,
    dustCount: 150,
    mountainRanges: 2,
    cityBuildings: 40,
    cableTrays: 1,
    pipeRuns: 2,
  },
  high: {
    id: 'high',
    name: 'HIGH',
    tagline: 'Full detail',
    description: 'Everything on. Requires a decent GPU. Slower first load.',
    pixelRatio: 1.5,
    antialias: true,
    bloom: { enabled: true, strength: 0.65, radius: 0.65, threshold: 0.78 },
    shadows: { enabled: true, mapSize: 2048, type: 'PCFSoft' },
    exposure: 1.35,
    dustCount: 300,
    mountainRanges: 3,
    cityBuildings: 60,
    cableTrays: 3,
    pipeRuns: 3,
  },
  ultra: {
    id: 'ultra',
    name: 'ULTRA',
    tagline: 'Showcase',
    description: 'Maximum quality. Only for a strong desktop GPU. Longest load time.',
    pixelRatio: 2.0,
    antialias: true,
    bloom: { enabled: true, strength: 0.85, radius: 0.75, threshold: 0.68 },
    shadows: { enabled: true, mapSize: 4096, type: 'PCFSoft' },
    exposure: 1.5,
    dustCount: 600,
    mountainRanges: 4,
    cityBuildings: 80,
    cableTrays: 3,
    pipeRuns: 3,
  },
};

const STORAGE_KEY = 'ma_quality';

export function loadQuality() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v && QUALITY_PRESETS[v]) return v;
  } catch (e) {
    // storage can be disabled in private mode
  }
  return null;
}

export function saveQuality(id) {
  if (!QUALITY_PRESETS[id]) return;
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch (e) {}
}

export function getPreset(id) {
  return QUALITY_PRESETS[id] || QUALITY_PRESETS.medium;
}