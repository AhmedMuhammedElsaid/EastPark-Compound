/**
 * The single source of building positions on the compound map. v1 is a grid ordered by building code
 * (row-major, 4 columns, so 8 buildings fill 2 rows). Replace `layoutCompound` with real site-plan
 * coordinates here and nothing else changes.
 */
export const COMPOUND_COLUMNS = 4;

export type CompoundSlot = { row: number; col: number };

function compareCodes(a: string, b: string): number {
  return a.localeCompare(b, "en", { numeric: true });
}

/** `code -> grid cell`, ordered by building code. */
export function layoutCompound(codes: readonly string[], columns: number = COMPOUND_COLUMNS): Map<string, CompoundSlot> {
  const slots = new Map<string, CompoundSlot>();
  [...codes].sort(compareCodes).forEach((code, index) => {
    slots.set(code, { row: Math.floor(index / columns), col: index % columns });
  });
  return slots;
}
