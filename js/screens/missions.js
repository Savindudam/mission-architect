import { state, setMission, getCompletedMissions, setCompletedMissions } from '../engine/state.js';

let missionsData = null;

async function loadMissions() {
  if (missionsData) return missionsData;
  const res = await fetch('data/missions.json');
  if (!res.ok) throw new Error('Failed to load missions.json: ' + res.status);
  const json = await res.json();
  missionsData = json.missions;
  return missionsData;
}

export async function mountMissions(root) {
  const missions = await loadMissions();
  const completed = getCompletedMissions();

  root.innerHTML = `
    <div class="missions-screen">
      <div class="missions-panel">
        <div class="missions-kicker">2026 NASA SPACE APPS CHALLENGE</div>
        <h1 class="missions-title">MISSION ARCHITECT</h1>
        <p class="missions-sub">
          Design a rocket. Fly the mission. Five targets, from a suborbital
          hop to a Mars sample return. Each one requires a different vehicle
          and a different set of trade-offs.
        </p>

        <div class="missions-grid" id="missions-grid"></div>
      </div>
    </div>
  `;

  const grid = root.querySelector('#missions-grid');

  // First mission is always unlocked. Every other mission is unlocked
  // when its predecessor has been completed.
  const unlockedIds = new Set();
  if (missions.length > 0) unlockedIds.add(missions[0].id);
  for (const m of missions) {
    if (completed.includes(m.id)) {
      for (const next of m.unlocks || []) unlockedIds.add(next);
    }
  }

  for (const m of missions) {
    const isCompleted = completed.includes(m.id);
    const isUnlocked = unlockedIds.has(m.id);
    const req = m.requirements;

    const card = document.createElement('button');
    card.className = 'mission-card';
    if (!isUnlocked) card.classList.add('locked');
    if (isCompleted) card.classList.add('completed');
    card.dataset.id = m.id;

    const difficultyStars = '★'.repeat(m.difficulty) + '☆'.repeat(5 - m.difficulty);

    card.innerHTML = `
      <div class="mission-header">
        <div class="mission-name">${m.name.toUpperCase()}</div>
        <div class="mission-difficulty">${difficultyStars}</div>
      </div>
      <div class="mission-tagline">${m.tagline}</div>
      <div class="mission-target">TARGET · ${m.target}</div>
      <div class="mission-brief">${m.brief}</div>

      <div class="mission-requirements">
        <div class="mission-req">
          <span class="mission-req-key">Δv</span>
          <span class="mission-req-val">${req.minDeltaV_kms} km/s</span>
        </div>
        <div class="mission-req">
          <span class="mission-req-key">MASS</span>
          <span class="mission-req-val">${req.maxMass_kg.toLocaleString()} kg</span>
        </div>
        <div class="mission-req">
          <span class="mission-req-key">COST</span>
          <span class="mission-req-val">$${(req.maxCost_usd / 1e6).toFixed(0)}M</span>
        </div>
        <div class="mission-req">
          <span class="mission-req-key">TWR</span>
          <span class="mission-req-val">${req.minTwr}</span>
        </div>
      </div>

      <div class="mission-footer">
        ${isCompleted ? '<span class="mission-badge badge-completed">COMPLETED</span>' : ''}
        ${!isUnlocked ? '<span class="mission-badge badge-locked">LOCKED</span>' : ''}
        ${isUnlocked && !isCompleted ? '<span class="mission-badge badge-ready">READY</span>' : ''}
        <span class="mission-reward">+${m.reward} pts</span>
      </div>
    `;

    if (isUnlocked) {
      card.addEventListener('click', () => {
        setMission(m);
        window.dispatchEvent(new CustomEvent('navigate', { detail: 'rocketSelect' }));
      });
    } else {
      card.disabled = true;
    }

    grid.appendChild(card);
  }
}