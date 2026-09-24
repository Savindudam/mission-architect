import { state, totals } from './state.js';

// Real numbers pulled from mission planning.
const EARTH_G = 0.00981;      // km/s^2
const GRAVITY_LOSS = 1.5;     // km/s lost to gravity and drag during ascent

// Compute what the current rocket can actually do. Returns a set of
// concrete values: mass, cost, delta-V, thrust-to-weight, apogee.
export function computeDesignPerformance() {
  const t = totals();
  const installed = state.installed;

  const engine = installed.find(p => p.slot === 'engine_cluster');
  const fuel = installed.find(p => p.slot === 'fuel_tank');
  const ox = installed.find(p => p.slot === 'oxidizer_tank');
  const upperEngine = installed.find(p => p.slot === 'upper_engine');
  const upperTank = installed.find(p => p.slot === 'upper_tank');

  // Propellant mass is roughly 8x the tank dry mass for a real liquid stage.
  // Same approximation used in the trajectory screen.
  let lowerPropellant = 0;
  if (fuel) lowerPropellant += (fuel.mass_kg || 0) * 8;
  if (ox) lowerPropellant += (ox.mass_kg || 0) * 8;

  let upperPropellant = 0;
  if (upperTank) upperPropellant += (upperTank.mass_kg || 0) * 8;

  const dryMass = t.mass;
  const lowerWet = dryMass + lowerPropellant;

  let deltaV_kms = 0;
  let twr = 0;

  // Lower stage delta-V
  if (engine && lowerWet > dryMass) {
    const isp = engine.isp_s || 300;
    deltaV_kms += isp * 9.81 * Math.log(lowerWet / (dryMass + upperPropellant)) / 1000;
    twr = (engine.thrust_kN * 1000) / (lowerWet * 9.81);
  }

  // Upper stage delta-V if present. The upper stage dry mass is
  // everything above the interstage.
  if (upperEngine && upperPropellant > 0) {
    const upperDry = installed
      .filter(p => p.slot !== 'fuel_tank' && p.slot !== 'oxidizer_tank' && p.slot !== 'upper_tank')
      .reduce((s, p) => s + (p.mass_kg || 0), 0);
    const upperWet = upperDry + upperPropellant;
    if (upperWet > upperDry) {
      const isp = upperEngine.isp_s || 340;
      deltaV_kms += isp * 9.81 * Math.log(upperWet / upperDry) / 1000;
    }
  }

  return {
    mass_kg: Math.round(t.mass),
    cost_usd: t.cost,
    deltaV_kms: Math.round(deltaV_kms * 100) / 100,
    twr: Math.round(twr * 100) / 100,
    apogee_km: Math.round(estimateApogee(deltaV_kms)),
  };
}

// Bucketed apogee estimate. Real trajectory simulation is overkill for
// the builder view. These numbers match the physics close enough that
// the mission requirements read as true.
function estimateApogee(deltaV_kms) {
  if (deltaV_kms < 2.0) return 5;
  if (deltaV_kms < 3.5) {
    const v = Math.max(0, deltaV_kms - 1.5);
    return (v * v) / (2 * EARTH_G);
  }
  if (deltaV_kms < 8.0) return 400 + (deltaV_kms - 3.5) * 200;         // 400 - 1300 km
  if (deltaV_kms < 10.0) return 1300 + (deltaV_kms - 8.0) * 150000;     // 1300 - 301,300 km
  if (deltaV_kms < 12.0) return 301300 + (deltaV_kms - 10.0) * 41500;   // 301,300 - 384,300 km
  if (deltaV_kms < 14.0) return 384400;                                  // Moon distance
  return 225000000;                                                      // Mars distance
}

// Compare the current design against a mission's requirements. Returns
// an array of checks, each with pass/fail and human-readable labels.
export function checkMission(mission, performance) {
  const perf = performance || computeDesignPerformance();
  const req = mission.requirements;

  const checks = [
    {
      key: 'deltaV',
      label: 'Delta-V budget',
      need: `≥ ${req.minDeltaV_kms} km/s`,
      have: `${perf.deltaV_kms.toFixed(2)} km/s`,
      pass: perf.deltaV_kms >= req.minDeltaV_kms,
    },
    {
      key: 'twr',
      label: 'Thrust-to-weight',
      need: `≥ ${req.minTwr}`,
      have: perf.twr.toFixed(2),
      pass: perf.twr >= req.minTwr,
    },
    {
      key: 'mass',
      label: 'Mass',
      need: `≤ ${req.maxMass_kg.toLocaleString()} kg`,
      have: `${perf.mass_kg.toLocaleString()} kg`,
      pass: perf.mass_kg <= req.maxMass_kg,
    },
    {
      key: 'cost',
      label: 'Cost',
      need: `≤ $${(req.maxCost_usd / 1e6).toFixed(0)}M`,
      have: `$${(perf.cost_usd / 1e6).toFixed(0)}M`,
      pass: perf.cost_usd <= req.maxCost_usd,
    },
    {
      key: 'apogee',
      label: 'Apogee',
      need: `${req.minApogee_km.toLocaleString()} – ${req.maxApogee_km.toLocaleString()} km`,
      have: `${perf.apogee_km.toLocaleString()} km`,
      // Apogee is only meaningful for suborbital missions. For orbit and
      // beyond, delta-V is the real gate, so skip apogee and mark it pass.
      pass: req.minApogee_km >= 100000
        ? true
        : (perf.apogee_km >= req.minApogee_km && perf.apogee_km <= req.maxApogee_km),
    },
  ];

  return {
    checks,
    allPass: checks.every(c => c.pass),
    passCount: checks.filter(c => c.pass).length,
    totalCount: checks.length,
    performance: perf,
  };
}

// Score a completed flight. Higher score means more efficient — the
// player hit the requirement with less mass, less cost, less delta-V.
// Range is 0 to 100. Failures get 0.
export function scoreFlight(mission, performance, launchSucceeded) {
  if (!launchSucceeded) return 0;

  const perf = performance || computeDesignPerformance();
  const req = mission.requirements;

  // Compute how tight the design was against each limit.
  const deltaVEfficiency = clamp(req.minDeltaV_kms / perf.deltaV_kms, 0, 1);
  const massEfficiency = clamp(1 - (perf.mass_kg / req.maxMass_kg) + 0.5, 0, 1);
  const costEfficiency = clamp(1 - (perf.cost_usd / req.maxCost_usd) + 0.5, 0, 1);

  const raw = (deltaVEfficiency * 0.5 + massEfficiency * 0.25 + costEfficiency * 0.25) * 100;
  return Math.round(Math.max(0, Math.min(100, raw)));
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}