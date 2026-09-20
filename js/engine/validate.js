// Requirement graph validator.
//
// Each part declares:
//   requires       — slots or part-ids that must be present
//   supports       — parts this enables
//   conflicts_with — parts that cannot coexist with this one
//   slot           — where it goes
//
// The validator walks the installed set against a template and produces a
// list of faults. Faults have four severities: info, caution, critical,
// block. Criticals and blocks can be overridden by the player.
//
// KEY RULE: if a part requires a slot that the current template doesn't
// expose, we skip that requirement. The player cannot satisfy something the
// template never gave them.

const SEVERITY = { INFO: 'info', CAUTION: 'caution', CRITICAL: 'critical', BLOCK: 'block' };

const ALL_SLOT_NAMES = [
  'engine_cluster', 'thrust_structure', 'oxidizer_tank', 'fuel_tank',
  'intertank', 'pressurant', 'grid_fins', 'interstage', 'separation',
  'upper_engine', 'upper_tank', 'avionics', 'power', 'payload',
  'nose_cone', 'booster', 'rcs',
];

export function validate(installedParts, template, allParts) {
  const faults = [];

  const installedBySlot = {};
  const installedIds = new Set();
  for (const p of installedParts) {
    installedBySlot[p.slot] = p;
    installedIds.add(p.id);
  }

  const activeSlots = new Set(template.activeSlots || []);

  // 1. Mandatory slots per template.
  const MANDATORY = [
    'engine_cluster', 'thrust_structure', 'fuel_tank', 'oxidizer_tank',
    'avionics', 'power', 'payload', 'nose_cone',
  ];
  if (template.stages === 2) {
    MANDATORY.push('interstage', 'separation', 'upper_engine', 'upper_tank', 'intertank', 'pressurant');
  }

  for (const slot of MANDATORY) {
    if (!activeSlots.has(slot)) continue;
    if (!installedBySlot[slot]) {
      faults.push({
        severity: SEVERITY.BLOCK,
        slot,
        message: `No ${slotLabel(slot)} installed. The vehicle cannot launch without it.`,
        fix: slotFix(slot),
      });
    }
  }

  // 2. Per-part requirements.
  for (const p of installedParts) {
    for (const req of (p.requires || [])) {
      // If req is a slot name that this template doesn't offer, skip it.
      // The user cannot install a part in a slot that doesn't exist.
      const isSlotName = ALL_SLOT_NAMES.includes(req);
      if (isSlotName && !activeSlots.has(req)) {
        continue;
      }

      const satisfied = installedBySlot[req] || installedIds.has(req);
      if (!satisfied) {
        faults.push({
          severity: SEVERITY.CRITICAL,
          slot: p.slot,
          message: `${p.name} requires ${slotLabel(req)}. Not installed.`,
          fix: slotFix(req),
        });
      }
    }
    for (const conflict of (p.conflicts_with || [])) {
      if (installedIds.has(conflict)) {
        faults.push({
          severity: SEVERITY.CRITICAL,
          slot: p.slot,
          message: `${p.name} conflicts with ${conflict}. Remove one.`,
          fix: `Remove either ${p.name} or ${conflict}.`,
        });
      }
    }
  }

  // 3. Size-class compatibility with the template.
  for (const p of installedParts) {
    if (compareSize(p.size_class, template.sizeClassMax) > 0) {
      faults.push({
        severity: SEVERITY.BLOCK,
        slot: p.slot,
        message: `${p.name} is size ${p.size_class}. The ${template.name} template accepts up to ${template.sizeClassMax}.`,
        fix: `Choose a smaller part or switch to a larger rocket family.`,
      });
    }
  }

  // 4. Physical consistency checks.
  const totalMass = installedParts.reduce((s, p) => s + (p.mass_kg || 0), 0)
                  + (template.baseStructuralMassKg || 0);
  const engine = installedBySlot['engine_cluster'];
  const totalThrust = engine ? engine.thrust_kN * 1000 : 0;

  if (engine && totalMass > 0) {
    const twr = totalThrust / (totalMass * 9.81);
    if (twr < 1.0) {
      faults.push({
        severity: SEVERITY.BLOCK,
        slot: 'engine_cluster',
        message: `Thrust-to-weight ratio is ${twr.toFixed(2)}. It must be at least 1.0 to lift off the pad.`,
        fix: `Add a larger engine, add boosters, or reduce vehicle mass.`,
      });
    } else if (twr < 1.2) {
      faults.push({
        severity: SEVERITY.CAUTION,
        slot: 'engine_cluster',
        message: `Thrust-to-weight ratio is ${twr.toFixed(2)}. Recommended margin is 1.2 or higher.`,
        fix: `A larger engine or a booster would improve safety margins.`,
      });
    }
  }

  // 5. Solar-vs-distance informational note.
  const solar = installedParts.find(p => p.id === 'power_solar_small' || p.id === 'power_solar_large');
  if (solar) {
    faults.push({
      severity: SEVERITY.INFO,
      slot: 'power',
      message: `Solar arrays selected. Output scales with distance from the Sun. They will not work beyond Jupiter.`,
      fix: null,
    });
  }

  return {
    faults,
    counts: {
      info:     faults.filter(f => f.severity === 'info').length,
      caution:  faults.filter(f => f.severity === 'caution').length,
      critical: faults.filter(f => f.severity === 'critical').length,
      block:    faults.filter(f => f.severity === 'block').length,
    },
    canLaunch: faults.filter(f => f.severity === SEVERITY.BLOCK).length === 0,
    totalMass,
  };
}

function slotLabel(slot) {
  const labels = {
    engine_cluster: 'first-stage engine cluster',
    thrust_structure: 'thrust structure',
    fuel_tank: 'fuel tank',
    oxidizer_tank: 'oxidizer tank',
    intertank: 'intertank structure',
    pressurant: 'pressurant system',
    grid_fins: 'grid fins',
    interstage: 'interstage',
    separation: 'separation system',
    upper_engine: 'upper-stage engine',
    upper_tank: 'upper-stage tank',
    avionics: 'avionics bay',
    power: 'power system',
    payload: 'payload',
    nose_cone: 'nose cone',
    booster: 'booster',
    rcs: 'reaction control system',
  };
  return labels[slot] || slot;
}

function slotFix(slot) {
  const fixes = {
    engine_cluster: 'Install any engine in the engine cluster slot.',
    thrust_structure: 'Install a thrust structure to transfer engine force into the tank walls.',
    fuel_tank: 'Install a fuel tank.',
    oxidizer_tank: 'Install an oxidizer tank.',
    intertank: 'Install an intertank between the tanks.',
    pressurant: 'Install a pressurant system to keep the tanks pressurised.',
    interstage: 'Install an interstage to connect the two stages.',
    separation: 'Install a stage separation system.',
    upper_engine: 'Install a vacuum engine.',
    upper_tank: 'Install an upper-stage tank.',
    avionics: 'Install an avionics bay. The cheapest option is $8M.',
    power: 'Install a power source. Solar, RTG, or battery.',
    payload: 'Install at least one payload.',
    nose_cone: 'Install a nose cone or fairing.',
  };
  return fixes[slot] || null;
}

function compareSize(a, b) {
  const order = { S: 0, M: 1, L: 2, XL: 3 };
  return (order[a] || 0) - (order[b] || 0);
}