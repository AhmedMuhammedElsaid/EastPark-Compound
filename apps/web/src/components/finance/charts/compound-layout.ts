/*
 * The one place building positions live (accounting slice 9, section 8 Q2). v1 lays buildings out
 * in a grid ordered by code. When the owner sends the real site plan, put explicit `{ row, col }`
 * entries in OVERRIDES and nothing else changes; a building missing from OVERRIDES falls back to
 * the next free grid slot in code order.
 */
export const MAP_COLUMNS = 4;

export type MapPosition = { row: number; col: number };

/** Site-plan positions by building code. Empty until the plan exists. */
export const OVERRIDES: Readonly<Record<string, MapPosition>> = {};

export function compoundLayout(codes: readonly string[]): Map<string, MapPosition> {
  const sorted = [...codes].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
  const out = new Map<string, MapPosition>();
  const taken = new Set<string>();
  for (const code of sorted) {
    const o = OVERRIDES[code];
    if (o) {
      out.set(code, o);
      taken.add(`${o.row}:${o.col}`);
    }
  }
  let slot = 0;
  for (const code of sorted) {
    if (out.has(code)) continue;
    let pos: MapPosition;
    do {
      pos = { row: Math.floor(slot / MAP_COLUMNS), col: slot % MAP_COLUMNS };
      slot++;
    } while (taken.has(`${pos.row}:${pos.col}`));
    out.set(code, pos);
    taken.add(`${pos.row}:${pos.col}`);
  }
  return out;
}
