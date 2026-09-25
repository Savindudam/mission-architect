import { state, getCompletedMissions } from '../engine/state.js';
import {
  getTotalXP, addXP, rankProgress, computeMissionXP,
  starsForScore, recordMissionScore,
} from '../engine/xp.js';

// ---------------------------------------------------------------
// Reason codes from flight.js / launch sequence → human text.
// ---------------------------------------------------------------
const FAILURE_TITLES = {
  out_of_fuel: 'OUT OF FUEL',
  power_lost: 'POWER LOST',
  hull_lost: 'HULL BREACH',
  no_engine: 'NO ENGINE',
  dry: 'NO PROPELLANT',
  rip: 'STRUCTURAL FAILURE',
  stuck: 'INSUFFICIENT THRUST',
  aborted: 'MISSION ABORTED',
};

function titleForResult(result) {
  if (!result) return 'MISSION COMPLETE';
  if (result.reason === 'arrived') return 'MISSION COMPLETE';
  return FAILURE_TITLES[result.reason] || 'MISSION FAILED';
}

function outcomeClass(result) {
  if (!result) return 'good';
  if (result.reason === 'arrived') return 'good';
  if (result.reason === 'out_of_fuel' || result.reason === 'power_lost') return 'warn';
  return 'bad';
}

// ---------------------------------------------------------------
// Mission notes — a short "what went well" and "could improve"
// generated from the run data. No AI, just rules.
// ---------------------------------------------------------------
function buildNotes(mission, result, score, success) {
  const notes = { good: [], improve: [] };

  if (!result) {
    notes.good.push('Vehicle launched cleanly and reached orbit.');
    notes.improve.push('No flight data recorded for this run.');
    return notes;
  }

  const r = result.resources || {};
  const data = result.dataCollected ?? 0;

  if (success) {
    if ((r.fuel ?? 0) > 30) notes.good.push(`Conservative fuel use — ${Math.round(r.fuel)}% remaining on arrival.`);
    else if ((r.fuel ?? 0) > 0) notes.improve.push('Fuel margins were tight. A lighter upper stage would help.');

    if (data >= 40) notes.good.push(`Strong science return — ${data} data points collected.`);
    else if (data >= 15) notes.improve.push('Science output was modest. Long-range instruments would add more.');
    else notes.improve.push('Very little data collected. Consider a better instrument suite.');

    if ((r.hull ?? 0) >= 80) notes.good.push('Hull integrity held through the cruise.');
    else if ((r.hull ?? 0) >= 40) notes.improve.push('Hull took damage on the way out. Shielding would help.');
    else notes.improve.push('Hull nearly failed. Better shielding is required.');

    if (score >= 80) notes.good.push('Efficient design. Low mass, low cost per mission.');
    if (score < 50) notes.improve.push('The design was heavier or more expensive than needed.');
  } else {
    notes.good.push('Vehicle launched and cleared the pad.');
    if (result.reason === 'out_of_fuel') notes.improve.push('Fuel ran out mid-cruise. A bigger tank or a lighter payload.');
    else if (result.reason === 'power_lost') notes.improve.push('Power failed. Solar arrays would not scale at this distance — an RTG would.');
    else if (result.reason === 'hull_lost') notes.improve.push('Hull breached. The stack was too fragile for deep space.');
    else notes.improve.push(result.text || 'Mission did not complete.');
    notes.improve.push('Try Test Fire again with a smaller or stiffer stack.');
  }

  return notes;
}

// ---------------------------------------------------------------
// Score computation for the run. Falls back to whatever launch
// set on state.flight.result if no explicit score was passed in.
// ---------------------------------------------------------------
function computeScore() {
  if (state.lastScore != null) return state.lastScore;
  const r = state.flight?.result;
  if (!r) return 0;
  if (r.reason !== 'arrived') return 0;

  // Simple score from remaining resources and data
  const res = r.resources || {};
  const fuel = res.fuel ?? 0;
  const hull = res.hull ?? 0;
  const data = Math.min(100, r.dataCollected ?? 0);

  const raw = fuel * 0.3 + hull * 0.4 + data * 0.3;
  return Math.round(Math.max(0, Math.min(100, raw)));
}

// ---------------------------------------------------------------
// Main mount
// ---------------------------------------------------------------
export function mountDebrief(root) {
  const mission = state.mission || { name: 'Mission', reward: 100 };
  const result = state.flight?.result || null;
  const success = result ? result.reason === 'arrived' : true;
  const score = computeScore();

  const baseXP = (mission.reward || 100);
  const xpEarned = computeMissionXP(mission, score, success);

  // Record the run before adding XP so we know if it's a personal best.
  const beforeXP = getTotalXP();
  const bestRecord = recordMissionScore(mission.id || 'unknown', score, xpEarned);
  const isPersonalBest = score > 0 && score >= (bestRecord.score ?? 0);

  const totalXP = addXP(xpEarned);
  const rank = rankProgress(totalXP);
  const stars = starsForScore(score, success);
  const notes = buildNotes(mission, result, score, success);

  const outcomeTitle = titleForResult(result);
  const outcomeCls = outcomeClass(result);
  const elapsed = result?.solsFlown ?? 0;

  // --- shell ---
  root.innerHTML = `
    <div class="debrief-screen" id="debrief-screen">
      <div class="debrief-fade" id="debrief-fade"></div>
      <div class="debrief-card" id="debrief-card" style="opacity:0; transform:translateY(12px); transition: opacity 0.6s ease 0.3s, transform 0.6s ease 0.3s;">
        <div class="debrief-kicker">MISSION DEBRIEF</div>

        <div class="debrief-outcome ${outcomeCls}">${outcomeTitle}</div>
        <div class="debrief-sub">
          ${mission.name} · ${success ? 'Arrived at target' : 'Flight terminated'}
          ${elapsed ? ' · ' + Math.round(elapsed) + ' days elapsed' : ''}
        </div>

        <div class="debrief-stars">
          ${[0,1,2,3,4].map(i => `
            <span class="star ${i < stars ? 'filled' : 'empty'}">${i < stars ? '★' : '☆'}</span>
          `).join('')}
        </div>

        <div class="debrief-stats">
          <div class="dstat">
            <div class="dstat-key">SCORE</div>
            <div class="dstat-val">${score} / 100</div>
          </div>
          <div class="dstat">
            <div class="dstat-key">XP EARNED</div>
            <div class="dstat-val">+${xpEarned}</div>
          </div>
          <div class="dstat">
            <div class="dstat-key">DATA</div>
            <div class="dstat-val">${result?.dataCollected ?? 0}</div>
          </div>
          <div class="dstat">
            <div class="dstat-key">${isPersonalBest ? 'PERSONAL BEST' : 'BEST'}</div>
            <div class="dstat-val">${bestRecord.score}</div>
          </div>
        </div>

        <div class="debrief-meters">
          <div class="dmeter">
            <div class="dmeter-label">${rank.current.name.toUpperCase()}</div>
            <div class="dmeter-bar">
              <div class="dmeter-fill" style="width:${rank.pct}%; background: var(--accent);"></div>
            </div>
            <div class="dmeter-val">${rank.next
              ? `${rank.earned.toLocaleString()} / ${rank.needed.toLocaleString()}`
              : 'MAX'}</div>
          </div>
          <div class="dmeter">
            <div class="dmeter-label">TOTAL XP</div>
            <div class="dmeter-bar">
              <div class="dmeter-fill" style="width:100%; background: var(--warn);"></div>
            </div>
            <div class="dmeter-val">${totalXP.toLocaleString()}</div>
          </div>
        </div>

        <div class="facts-header">MISSION NOTES</div>
        <div class="debrief-facts">
          <div class="fact-card">
            <div class="fact-card-title">WHAT WENT WELL</div>
            <div class="fact-card-text">
              ${notes.good.length
                ? '· ' + notes.good.join('<br>· ')
                : 'Nothing of note. Better luck next attempt.'}
            </div>
          </div>
          <div class="fact-card">
            <div class="fact-card-title">COULD IMPROVE</div>
            <div class="fact-card-text">
              ${notes.improve.length
                ? '· ' + notes.improve.join('<br>· ')
                : 'Clean run. Nothing to improve.'}
            </div>
          </div>
        </div>

        <div class="debrief-actions">
          <button class="btn-secondary" id="btn-retry">RETRY MISSION</button>
          <button class="btn-primary" id="btn-continue">CONTINUE</button>
        </div>
      </div>
    </div>
  `;

  // --- fade in ---
  const fade = root.querySelector('#debrief-fade');
  const card = root.querySelector('#debrief-card');
  requestAnimationFrame(() => {
    fade.style.opacity = '0';
    card.style.opacity = '1';
    card.style.transform = 'translateY(0)';
  });

  // --- buttons ---
  root.querySelector('#btn-retry').addEventListener('click', () => {
    state.flight = null;
    window.dispatchEvent(new CustomEvent('navigate', { detail: 'builder' }));
  });

  root.querySelector('#btn-continue').addEventListener('click', () => {
    state.flight = null;
    window.dispatchEvent(new CustomEvent('navigate', { detail: 'missions' }));
  });
}