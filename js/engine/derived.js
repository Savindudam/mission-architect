export const CONST = {
  MU_SUN: 1.32712440018e11,
  MU_EARTH: 398600.4418,
  AU: 1.495978707e8,
  R_LEO: 6378.137 + 200,
  SOLAR_1AU: 1361,
  LIGHT_MIN_PER_AU: 8.317,
  G0: 9.80665,
  YEAR_DAYS: 365.25,
};

export function vInfinityHohmann(aTargetAU) {
  const r1 = CONST.AU;
  const r2 = aTargetAU * CONST.AU;
  const vEarth = Math.sqrt(CONST.MU_SUN / r1);
  const factor = Math.sqrt(2 * r2 / (r1 + r2)) - 1;
  return Math.abs(vEarth * factor);
}

export function departureDeltaV(aTargetAU) {
  const vInf = vInfinityHohmann(aTargetAU);
  const vCirc = Math.sqrt(CONST.MU_EARTH / CONST.R_LEO);
  return Math.sqrt(vInf * vInf + 2 * vCirc * vCirc) - vCirc;
}

export function hohmannDays(aTargetAU) {
  const a = (CONST.AU + aTargetAU * CONST.AU) / 2;
  return Math.PI * Math.sqrt(Math.pow(a, 3) / CONST.MU_SUN) / 86400;
}

export function synodicDays(aTargetAU) {
  const tTarget = CONST.YEAR_DAYS * Math.pow(aTargetAU, 1.5);
  return 1 / Math.abs(1 / CONST.YEAR_DAYS - 1 / tTarget);
}

export function solarFlux(aTargetAU) {
  return CONST.SOLAR_1AU / (aTargetAU * aTargetAU);
}

export function lightMinutes(distanceAU) {
  return distanceAU * CONST.LIGHT_MIN_PER_AU;
}

export function solarClass(aTargetAU) {
  const flux = solarFlux(aTargetAU);
  if (flux >= 500) return 'solar_good';
  if (flux >= 100) return 'solar_marginal';
  if (flux >= 10) return 'solar_weak';
  return 'solar_infeasible';
}

export function deriveBody(body) {
  const a = body.aAU;
  if (body.parent === 'earth') {
    return {
      ...body,
      departureDeltaV: 3.1,
      transitDays: 3,
      windowDays: 27.3,
      solarFlux: CONST.SOLAR_1AU,
      lightDelayMin: 0.021,
      solarClass: 'solar_good',
    };
  }
  return {
    ...body,
    departureDeltaV: round(departureDeltaV(a), 2),
    transitDays: Math.round(hohmannDays(a)),
    windowDays: Math.round(synodicDays(a)),
    solarFlux: Math.round(solarFlux(a)),
    lightDelayMin: round(lightMinutes(a), 1),
    solarClass: solarClass(a),
  };
}

function round(n, places) {
  const f = Math.pow(10, places);
  return Math.round(n * f) / f;
}