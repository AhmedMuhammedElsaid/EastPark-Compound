/** A flat's identity: building + floor + flat number (strings, see the lead DTO). */
export interface FlatKey {
    building: string;
    floor: string;
    flatNumber: string;
}

/**
 * Canonical label of a flat everywhere (`User.unitNumber`, `ResidentUnitDto.label`,
 * order `deliveryUnit`): `${building}-${floor}-${flatNumber}`.
 */
export function formatUnitLabel(flat: FlatKey): string {
    return `${flat.building}-${flat.floor}-${flat.flatNumber}`;
}
