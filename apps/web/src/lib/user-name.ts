/**
 * Name the backend stores on legacy deleted-account tombstones (`DELETED_USER_NAME`, from before soft
 * delete). It is English-only data, so clients swap in their own bilingual label when showing it.
 */
const LEGACY_DELETED_USER_NAME = 'Deleted user';

export function isDeletedUserName(name: string | null | undefined): boolean {
  return name?.trim() === LEGACY_DELETED_USER_NAME;
}

/** The name to show: the bilingual "Deleted user" label for tombstone rows, the name otherwise. */
export function displayUserName(name: string, deletedLabel: string): string {
  return isDeletedUserName(name) ? deletedLabel : name;
}
