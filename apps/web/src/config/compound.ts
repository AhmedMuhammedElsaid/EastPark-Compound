/**
 * Compound configuration — the single source of truth for the "register your
 * unit" form (phase / building / floor / flat). Nothing about buildings,
 * floors, or flats may be hardcoded in form or validation code — import from
 * here instead, so the UI and the Zod schema can never drift apart.
 */

/** Shared shape for every select option in the form — lets one <Select> render all three fields. */
export interface Option<T extends string> {
  readonly value: T;
  readonly labelEn: string;
  readonly labelAr: string;
}

/**
 * Floors are strings, not numbers, for two reasons:
 *  - the backend column is `String` (leading zeros, non-numeric floors),
 *  - some phases have a ground floor "G" with no numeric equivalent.
 * Ranges are still enforced — see isValidFloorForBuilding.
 */
export const GROUND_FLOOR = 'G';

/** Every building in the compound sits in one of four phases. */
export interface PhaseConfig {
  readonly id: string;
  readonly labelEn: string;
  readonly labelAr: string;
  /**
   * Ground floors genuinely vary: phases 2 and 3 have one, phases 1 and 4 do
   * not. Do not collapse this back into one shared floor range.
   */
  readonly hasGround: boolean;
  readonly maxFloor: number;
}

/**
 * >>> EDIT PHASES AND BUILDINGS HERE <<<
 * The authoritative EastPark layout: four phases, three buildings each,
 * 11 floors throughout. The backend stores `building` as a plain String with
 * no enum, so changing this list needs no migration.
 */
export const PHASES = [
  { id: 'phase-1', labelEn: 'Phase 1', labelAr: 'المرحلة الأولى', hasGround: false, maxFloor: 11 },
  { id: 'phase-2', labelEn: 'Phase 2', labelAr: 'المرحلة الثانية', hasGround: true, maxFloor: 11 },
  { id: 'phase-3', labelEn: 'Phase 3', labelAr: 'المرحلة الثالثة', hasGround: true, maxFloor: 11 },
  { id: 'phase-4', labelEn: 'Phase 4', labelAr: 'المرحلة الرابعة', hasGround: false, maxFloor: 11 },
] as const satisfies readonly PhaseConfig[];

export type PhaseId = (typeof PHASES)[number]['id'];

export interface BuildingConfig {
  readonly value: string;
  readonly labelEn: string;
  readonly labelAr: string;
  readonly phase: PhaseId;
}

/**
 * Building codes are already unique across the compound (the trailing digit is
 * the phase), so the form asks only for the building — the phase is derived.
 * That keeps the form at the seven specified fields instead of eight.
 */
export const BUILDINGS = [
  // Phase 1 — no ground floor
  { value: 'A1', labelEn: 'A1', labelAr: 'A1', phase: 'phase-1' },
  { value: 'B1', labelEn: 'B1', labelAr: 'B1', phase: 'phase-1' },
  { value: 'C1', labelEn: 'C1', labelAr: 'C1', phase: 'phase-1' },
  // Phase 2 — has ground floor
  { value: 'A2', labelEn: 'A2', labelAr: 'A2', phase: 'phase-2' },
  { value: 'B2', labelEn: 'B2', labelAr: 'B2', phase: 'phase-2' },
  { value: 'C2', labelEn: 'C2', labelAr: 'C2', phase: 'phase-2' },
  // Phase 3 — has ground floor
  { value: 'D1', labelEn: 'D1', labelAr: 'D1', phase: 'phase-3' },
  { value: 'E1', labelEn: 'E1', labelAr: 'E1', phase: 'phase-3' },
  { value: 'F1', labelEn: 'F1', labelAr: 'F1', phase: 'phase-3' },
  // Phase 4 — no ground floor
  { value: 'C3', labelEn: 'C3', labelAr: 'C3', phase: 'phase-4' },
  { value: 'E2', labelEn: 'E2', labelAr: 'E2', phase: 'phase-4' },
  { value: 'F2', labelEn: 'F2', labelAr: 'F2', phase: 'phase-4' },
] as const satisfies readonly BuildingConfig[];

/** Union of valid building values, derived from the data above (never hand-written). */
export type BuildingValue = (typeof BUILDINGS)[number]['value'];

/** Widest floor span across the compound. */
export const FLOOR_RANGE = { min: 1, max: 11 } as const;
export const FLAT_RANGE = { min: 1, max: 5 } as const;

export interface NumericRange {
  readonly min: number;
  readonly max: number;
}

/**
 * Expands an inclusive range into options so selects never reimplement this
 * loop. Labels use Western numerals in both languages by design — this project
 * never renders Arabic-Indic digits, even in Arabic UI.
 */
function expandRange(range: NumericRange): Option<string>[] {
  const options: Option<string>[] = [];
  for (let n = range.min; n <= range.max; n += 1) {
    const label = String(n);
    options.push({ value: label, labelEn: label, labelAr: label });
  }
  return options;
}

export function findBuilding(value: string): BuildingConfig | undefined {
  return BUILDINGS.find((b) => b.value === value);
}

export function findPhase(id: string): PhaseConfig | undefined {
  return PHASES.find((p) => p.id === id);
}

/** The phase a building belongs to, or undefined for an unknown building. */
export function getPhaseForBuilding(building: string): PhaseConfig | undefined {
  const config = findBuilding(building);
  return config === undefined ? undefined : findPhase(config.phase);
}

/** Buildings grouped by phase — lets the select render <optgroup> per phase. */
export function getBuildingsByPhase(): readonly {
  phase: PhaseConfig;
  buildings: readonly BuildingConfig[];
}[] {
  return PHASES.map((phase) => ({
    phase,
    buildings: BUILDINGS.filter((b) => b.phase === phase.id),
  }));
}

/**
 * The floor options for one building, ground floor included only where its
 * phase has one. Returns an empty list for an unknown building so the form
 * renders a disabled, empty dropdown rather than offering the wrong floors.
 */
export function getFloorOptions(building: string | undefined): Option<string>[] {
  if (building === undefined) return [];
  const phase = getPhaseForBuilding(building);
  if (phase === undefined) return [];

  const numbered = expandRange({ min: FLOOR_RANGE.min, max: phase.maxFloor });
  if (!phase.hasGround) return numbered;

  return [{ value: GROUND_FLOOR, labelEn: 'Ground floor', labelAr: 'الدور الأرضي' }, ...numbered];
}

export const FLAT_OPTIONS: readonly Option<string>[] = expandRange(FLAT_RANGE);

/** Type guard the Zod schema reuses instead of re-listing building codes. */
export function isValidBuilding(value: string): value is BuildingValue {
  return BUILDINGS.some((b) => b.value === value);
}

/**
 * Floor validity depends on the building's phase, so this takes both. "G" is
 * valid in a phase-2 building and invalid in a phase-1 one — that is the whole
 * point of the per-building list.
 *
 * ⚠️ THIS CHECK IS LOAD-BEARING, NOT COSMETIC. The API does not know the
 * compound layout: `building` has no enum or whitelist server-side, and `floor`
 * is validated only against /^(G|[1-9]|1[01])$/. So the backend would happily
 * accept "G" for A1 — a phase-1 building with no ground floor. This function is
 * the ONLY thing preventing an impossible unit from being stored. Do not
 * "simplify" it into a plain range check.
 */
export function isValidFloorForBuilding(floor: string, building: string): boolean {
  return getFloorOptions(building).some((option) => option.value === floor);
}

export function isValidFlat(value: string): boolean {
  return FLAT_OPTIONS.some((option) => option.value === value);
}
