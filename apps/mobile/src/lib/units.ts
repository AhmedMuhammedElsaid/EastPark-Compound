import type { AuthUser } from "@/store/slices/auth-slice";

type UnitSource = Pick<AuthUser, "unitNumber" | "units"> | null | undefined;

/**
 * Flat labels the user owns, oldest first. Legacy accounts (and an older
 * backend) have no `units`: fall back to `unitNumber` as a single flat.
 */
export function getUnitLabels(user: UnitSource): string[] {
  const labels = (user?.units ?? []).map(u => u.label.trim()).filter(Boolean);
  if (labels.length > 0)
    return labels;
  const legacy = user?.unitNumber?.trim();
  return legacy ? [legacy] : [];
}

/** The primary flat: `unitNumber` when set, otherwise the first flat. */
export function getPrimaryUnit(user: UnitSource): string {
  const primary = user?.unitNumber?.trim();
  return primary || getUnitLabels(user)[0] || "";
}

/** Checkout picker options; the primary flat is first and is the default. */
export function getDeliveryUnitOptions(user: UnitSource): string[] {
  const labels = getUnitLabels(user);
  const primary = getPrimaryUnit(user);
  if (primary && !labels.includes(primary))
    return [primary, ...labels];
  return primary ? [primary, ...labels.filter(l => l !== primary)] : labels;
}

/** The chosen flat when it is still an option, otherwise the default. */
export function resolveDeliveryUnit(user: UnitSource, chosen?: string | null): string {
  const options = getDeliveryUnitOptions(user);
  const wanted = chosen?.trim();
  if (wanted && options.includes(wanted))
    return wanted;
  return options[0] ?? "";
}

/**
 * Choosing the primary flat needs two or more real flats (`units`); a legacy
 * single `unitNumber` cannot be changed by the resident (same rule as web).
 */
export function canChoosePrimaryFlat(user: UnitSource): boolean {
  return (user?.units?.length ?? 0) > 1;
}

/** `PUT /user` 400 when the chosen primary flat is not one of the account's flats. */
export const UNIT_NOT_OWNED_CODE = "user.error.unitNotOwned";
