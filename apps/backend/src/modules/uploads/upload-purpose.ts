import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Role } from '@prisma/client';

import { ENUM_FILE_STORE } from 'src/common/file/enums/files.enum';

interface PurposeRule {
    store: ENUM_FILE_STORE;
    roles: readonly Role[];
}

const ANY_USER: readonly Role[] = [
    Role.RESIDENT,
    Role.MERCHANT,
    Role.ADMIN,
    Role.SUPER_ADMIN,
];
const STAFF: readonly Role[] = [Role.MERCHANT, Role.ADMIN, Role.SUPER_ADMIN];
const ADMIN_ONLY: readonly Role[] = [Role.ADMIN, Role.SUPER_ADMIN];

/** `POST /uploads/image?purpose=` — default `avatar` keeps old clients working. */
export const IMAGE_UPLOAD_PURPOSES = {
    avatar: { store: ENUM_FILE_STORE.USER_AVATARS, roles: ANY_USER },
    feedback: { store: ENUM_FILE_STORE.FEEDBACK_ATTACHMENTS, roles: ANY_USER },
    shop: { store: ENUM_FILE_STORE.SHOP_PHOTOS, roles: STAFF },
    product: { store: ENUM_FILE_STORE.PRODUCT_IMAGES, roles: STAFF },
    candidate: { store: ENUM_FILE_STORE.CANDIDATE_PHOTOS, roles: ADMIN_ONLY },
    announcement: { store: ENUM_FILE_STORE.ANNOUNCEMENTS, roles: ADMIN_ONLY },
} as const satisfies Record<string, PurposeRule>;

/** `POST /uploads/pdf?purpose=` — the whole route is ADMIN-only. */
export const PDF_UPLOAD_PURPOSES = {
    report: { store: ENUM_FILE_STORE.REPORTS, roles: ADMIN_ONLY },
    announcement: { store: ENUM_FILE_STORE.ANNOUNCEMENTS, roles: ADMIN_ONLY },
} as const satisfies Record<string, PurposeRule>;

export const DEFAULT_IMAGE_PURPOSE = 'avatar';
export const DEFAULT_PDF_PURPOSE = 'report';

export function resolveUploadStore(
    rules: Record<string, PurposeRule>,
    purpose: string | undefined,
    fallback: string,
    role: Role
): ENUM_FILE_STORE {
    const key = purpose?.trim() || fallback;
    const rule = Object.prototype.hasOwnProperty.call(rules, key)
        ? rules[key]
        : undefined;
    if (!rule) {
        throw new BadRequestException('upload.error.invalidPurpose');
    }
    if (!rule.roles.includes(role)) {
        throw new ForbiddenException('upload.error.purposeForbidden');
    }
    return rule.store;
}
