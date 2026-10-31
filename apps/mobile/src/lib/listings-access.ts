import { isAdminRole } from "@/lib/roles";

/**
 * Who can browse flat listings (`GET /listings` allows RESIDENT, ADMIN, SUPER_ADMIN).
 * Merchants get 403 there, so the Flats tab is hidden for them.
 */
export function canBrowseListings(role: string | null | undefined): boolean {
  return role === "RESIDENT" || isAdminRole(role);
}

/** Only residents create, edit and close their own listings. */
export function canOwnListings(role: string | null | undefined): boolean {
  return role === "RESIDENT";
}
