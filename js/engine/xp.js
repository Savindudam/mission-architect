// XP, ranks, and per-mission best scores. All persisted to localStorage
// so the player keeps progress between sessions.

const XP_KEY = 'ma_xp';
const BEST_KEY = 'ma_best_scores';

// Rank thresholds from the design doc.
const RANKS = [
  { id: 'cadet',           name: 'Cadet',             xp: 0 },
  { id: 'systems_officer', name: 'Systems Officer',   xp: 500 },
  { id: 'flight_director', name: 'Flight Director',   xp: 2000 },
  { id: 'architect',       name: 'Mission Architect', xp: 6000 },
  { id: 'chief_architect', name: 'Chief Architect',   xp: 15000 },
  { id: 'administrator',   name: 'Administrator',     xp: 30000 },
];

function safeGet(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
}

function safeSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {}
}

// ---- XP ----

export function getTotalXP() {
  const v = safeGet(XP_KEY, 0);
  return typeof v === 'number' ? v : 0;
}

export function addXP(amount) {
  const total = getTotalXP() + Math.max(0, Math.round(amount));
  safeSet(XP_KEY, total);
  return total;
}

export function resetXP() {
  safeSet(XP_KEY, 0);
}

// ---- Ranks ----

export function rankForXP(xp) {
  let current = RANKS[0];
  let next = null;
  for (let i = 0; i < RANKS.length; i++) {
    if (xp >= RANKS[i].xp) current = RANKS[i];
    else { next = RANKS[i]; break; }
  }
  return { current, next };
}

export function rankProgress(xp) {
  const { current, next } = rankForXP(xp);
  if (!next) {
    return {
      current,
      next: null,
      earned: xp - current.xp,
      needed: 0,
      pct: 100,
    };
  }
  const earned = xp - current.xp;
  const needed = next.xp - current.xp;
  return {
    current,
    next,
    earned,
    needed,
    pct: Math.max(0, Math.min(100, (earned / needed) * 100)),
  };
}

// ---- Per-mission best scores ----

export function getBestScores() {
  return safeGet(BEST_KEY, {});
}

export function recordMissionScore(missionId, score, xpEarned) {
  const best = getBestScores();
  const prev = best[missionId] || { score: 0, xp: 0, attempts: 0 };
  best[missionId] = {
    score: Math.max(prev.score, score),
    xp: Math.max(prev.xp, xpEarned),
    attempts: prev.attempts + 1,
    lastAt: Date.now(),
  };
  safeSet(BEST_KEY, best);
  return best[missionId];
}

// ---- Scoring ----

// Turn a 0-100 mission score into XP.
// Perfect run = full mission.reward. Failure = 20% participation credit.
export function computeMissionXP(mission, score, success) {
  const base = (mission && mission.reward) || 100;
  if (!success) return Math.round(base * 0.2);
  const multiplier = Math.max(0, Math.min(1, score / 100));
  return Math.round(base * multiplier);
}

// 0-100 score → 0-5 stars.
export function starsForScore(score, success) {
  if (!success) return 0;
  if (score >= 95) return 5;
  if (score >= 80) return 4;
  if (score >= 60) return 3;
  if (score >= 40) return 2;
  if (score >= 20) return 1;
  return 0;
}