import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { assertStoragePublicUrls } from 'src/common/file/storage-url';

import { LISTING_LIMITS } from './listing.constants';

/**
 * 1-8 photos, each a file uploaded through `/uploads` (our bucket).
 *
 * `existing` are the URLs already stored on the listing: an edit that keeps
 * them is accepted without re-validating (stored values are never re-checked,
 * same rule as avatars), only NEW URLs must pass the storage URL policy.
 */
export function assertListingPhotos(
    config: ConfigService,
    photos: readonly string[],
    existing: readonly string[] = []
): void {
    if (
        photos.length < LISTING_LIMITS.photosMin ||
        photos.length > LISTING_LIMITS.photosMax
    ) {
        throw new BadRequestException('listing.error.photosRequired');
    }
    const known = new Set(existing);
    assertStoragePublicUrls(
        config,
        photos.filter(url => !known.has(url)),
        'file.error.urlNotStored'
    );
}
