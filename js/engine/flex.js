// Beam-deflection model for the rocket stack.
//
// The stack is treated as a cantilever beam fixed at the base. Each part
// contributes a point load (its mass) at its position in the stack. The
// beam's resistance to bending comes from the sum of each part's
// stiffness value weighted by its cross-section.
//
// This is a simplification. Real rockets use finite-element analysis with
// distributed loads and variable cross-sections. But this model produces
// the right qualitative behaviour: heavier loads higher up cause more
// deflection, and stiffer wider sections resist it.

export function computeFlex(stack) {
  if (!stack || stack.length === 0) {
    return { deflection: 0, ratio: 0, warning: null, segments: [] };
  }

  // Total mass above each segment. Walks top-down.
  let massAbove = 0;
  const loads = [];

  for (let i = stack.length - 1; i >= 0; i--) {
    const p = stack[i];
    massAbove += p.mass_kg || 0;
    loads[i] = massAbove;
  }

  // EI (flexural rigidity) per segment = stiffness * cross_section_factor.
  // Cross-section factor is roughly (diameter)^3 for a hollow tube of constant wall.
  let cumulativeDeflection = 0;
  const segments = [];
  let totalMass = loads[0] || 0;
  let cumulativeStiffness = 0;

  for (let i = 0; i < stack.length; i++) {
    const p = stack[i];
    const h = (p.dimensions && p.dimensions.height_m) || 1;
    const d = (p.dimensions && p.dimensions.diameter_m) || 1;
    const ei = (p.stiffness || 1) * Math.pow(d, 3) * 0.6;
    cumulativeStiffness += ei;

    // Deflection of this segment from the load above it.
    // delta = F * L^3 / (3 * EI), with L approximated as distance from base.
    const distanceFromBase = i + 1;
    const load = loads[i] || 0;
    const segDeflection = (load * Math.pow(distanceFromBase, 3)) / (3 * Math.max(ei, 0.1) * 1000);

    cumulativeDeflection += segDeflection;
    segments.push({
      index: i,
      id: p.id,
      name: p.name,
      deflection: segDeflection,
    });
  }

  // Normalise to a 0-1 ratio by dividing by a reference value.
  const reference = 5.0;
  const ratio = Math.min(1, cumulativeDeflection / reference);

  // Warning levels.
  let warning = null;
  if (ratio > 0.7)      warning = { level: 'block',    text: 'Vehicle flex exceeds structural limits. Reduce top mass or add stiffness.' };
  else if (ratio > 0.45) warning = { level: 'critical', text: 'High flex detected. The stack will bend under thrust.' };
  else if (ratio > 0.25) warning = { level: 'caution',  text: 'Moderate flex. Consider lowering the centre of mass.' };

  return {
    deflection: cumulativeDeflection,
    ratio,
    totalMass,
    warning,
    segments,
  };
}