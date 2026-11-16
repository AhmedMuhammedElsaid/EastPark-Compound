/**
 * The EastPark compound layout for the unit-registration form (phase / building / floor /
 * flat). Mirrors `apps/web/src/config/compound.ts`, the web source of truth; keep the two in
 * step. The backend only checks the flat key against the compound's 690 flats and the floor
 * against a loose pattern, so `isValidFloorForBuilding` is what stops an impossible unit
 * (for example a ground floor in a phase 1 building).
 */

export type Option = { value: string; labelEn: string; labelAr: string };

export const GROUND_FLOOR = "G";

type Phase = { id: string; labelEn: string; labelAr: string; hasGround: boolean; maxFloor: number };

export const PHASES: readonly Phase[] = [
  { id: "phase-1", labelEn: "Phase 1", labelAr: "المرحلة الأولى", hasGround: false, maxFloor: 11 },
  { id: "phase-2", labelEn: "Phase 2", labelAr: "المرحلة الثانية", hasGround: true, maxFloor: 11 },
  { id: "phase-3", labelEn: "Phase 3", labelAr: "المرحلة الثالثة", hasGround: true, maxFloor: 11 },
  { id: "phase-4", labelEn: "Phase 4", labelAr: "المرحلة الرابعة", hasGround: false, maxFloor: 11 },
];

type Building = { value: string; phase: string };

/** Building codes are unique across the compound, so the phase is derived from the building. */
export const BUILDINGS: readonly Building[] = [
  { value: "A1", phase: "phase-1" },
  { value: "B1", phase: "phase-1" },
  { value: "C1", phase: "phase-1" },
  { value: "A2", phase: "phase-2" },
  { value: "B2", phase: "phase-2" },
  { value: "C2", phase: "phase-2" },
  { value: "D1", phase: "phase-3" },
  { value: "E1", phase: "phase-3" },
  { value: "F1", phase: "phase-3" },
  { value: "C3", phase: "phase-4" },
  { value: "E2", phase: "phase-4" },
  { value: "F2", phase: "phase-4" },
];

const FLAT_MAX = 5;

function range(min: number, max: number): Option[] {
  const out: Option[] = [];
  for (let n = min; n <= max; n += 1)
    out.push({ value: String(n), labelEn: String(n), labelAr: String(n) });
  return out;
}

export function getBuildingsByPhase(): { phase: Phase; buildings: readonly Building[] }[] {
  return PHASES.map(phase => ({ phase, buildings: BUILDINGS.filter(b => b.phase === phase.id) }));
}

function phaseOf(building: string | undefined): Phase | undefined {
  const found = BUILDINGS.find(b => b.value === building);
  return found ? PHASES.find(p => p.id === found.phase) : undefined;
}

/** Floors for one building: the ground floor only where its phase has one; empty if unknown. */
export function getFloorOptions(building: string | undefined): Option[] {
  const phase = phaseOf(building);
  if (!phase)
    return [];
  const numbered = range(1, phase.maxFloor);
  return phase.hasGround
    ? [{ value: GROUND_FLOOR, labelEn: "Ground floor", labelAr: "الدور الأرضي" }, ...numbered]
    : numbered;
}

export const FLAT_OPTIONS: readonly Option[] = range(1, FLAT_MAX);

export function isValidBuilding(value: string): boolean {
  return BUILDINGS.some(b => b.value === value);
}

export function isValidFloorForBuilding(floor: string, building: string): boolean {
  return getFloorOptions(building).some(o => o.value === floor);
}

export function isValidFlat(value: string): boolean {
  return FLAT_OPTIONS.some(o => o.value === value);
}
