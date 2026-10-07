/**
 * Pure helpers for multi-flat owners. A flat's value everywhere is the backend-formatted `label`
 * (`A1-3-2`); never rebuild it on the client, the backend compares it verbatim.
 */
import type { ResidentUnit } from '@/lib/api/contracts';

type UnitHolder = { id?: string; unitNumber: string | null; units?: ResidentUnit[] | null };

/** The owned flats, tolerating a user object that never went through the schema. */
export function unitsOf(user: Pick<UnitHolder, 'units'> | null | undefined): ResidentUnit[] {
  return Array.isArray(user?.units) ? user.units : [];
}

/**
 * The flats a user can pick from (labels). Legacy accounts have `unitNumber` but no unit rows, so
 * they fall back to that single value. Empty when the account has neither.
 */
export function unitChoices(user: UnitHolder | null | undefined): string[] {
  const units = unitsOf(user);
  if (units.length > 0) return units.map((unit) => unit.label);
  const legacy = user?.unitNumber?.trim();
  return legacy ? [legacy] : [];
}

/** The pre-selected flat: the primary (`unitNumber`) when it is one of the choices, else the first. */
export function defaultUnitChoice(user: UnitHolder | null | undefined): string {
  const choices = unitChoices(user);
  const primary = user?.unitNumber?.trim();
  if (primary && choices.includes(primary)) return primary;
  return choices[0] ?? '';
}

/**
 * Replaces a user object with one from a response that carries no `units` (login, accept-invitation,
 * `PUT /user`, role change): the previous flats are kept when it is the same account.
 */
export function keepUnits<T extends UnitHolder>(previous: UnitHolder | null | undefined, next: T): T {
  if (!previous || previous.id !== next.id || unitsOf(next).length > 0) return next;
  const units = unitsOf(previous);
  return units.length > 0 ? { ...next, units } : next;
}

/** The primary flat after a flat was added: it is only set when the account had none. */
export function primaryAfterAdd(unitNumber: string | null, added: ResidentUnit): string {
  return unitNumber ?? added.label;
}

/**
 * The flats and primary flat after one was removed. Mirrors the backend: when the removed flat was
 * the primary, the oldest remaining flat becomes primary (or none is left).
 */
export function afterUnitRemoved(
  units: ResidentUnit[],
  unitNumber: string | null,
  removedId: string,
): { units: ResidentUnit[]; unitNumber: string | null } {
  const removed = units.find((unit) => unit.id === removedId);
  const remaining = units.filter((unit) => unit.id !== removedId);
  if (!removed || removed.label !== unitNumber) return { units: remaining, unitNumber };
  return { units: remaining, unitNumber: remaining[0]?.label ?? null };
}
