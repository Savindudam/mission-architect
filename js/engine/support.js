// A piece in the stack is only "supported" if every slot below it is
// filled and itself supported. The engine sits on the pad. Everything
// else stacks on top of the piece below it. Any gap orphans the tower
// above it.

const SLOT_ORDER = [
  'engine_cluster', 'thrust_structure', 'oxidizer_tank', 'fuel_tank',
  'intertank', 'pressurant', 'grid_fins', 'interstage', 'separation',
  'upper_engine', 'upper_tank', 'avionics', 'power', 'payload', 'nose_cone',
];

export function computeStackSupport(template, installed) {
  const bySlot = {};
  for (const p of installed) bySlot[p.slot] = p;

  const status = {};
  let chainIntact = true; // pad -> first slot is always "supported"

  for (const slot of SLOT_ORDER) {
    if (!template.activeSlots.includes(slot)) continue;

    const hasPart = !!bySlot[slot];
    const isSupported = chainIntact && hasPart;

    status[slot] = { hasPart, isSupported };

    // The next slot only stays in the chain if this one exists AND is supported
    chainIntact = isSupported;
  }

  // Every slot that has a part but fails the chain is orphaned.
  const orphans = SLOT_ORDER.filter(
    s => status[s] && status[s].hasPart && !status[s].isSupported
  );

  // The lowest orphan is what actually breaks the tower. Everything above
  // it (installed or not) is now floating.
  const firstOrphan = orphans[0] || null;

  return { status, orphans, firstOrphan };
}