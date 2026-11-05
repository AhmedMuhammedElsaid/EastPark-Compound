export enum ENUM_FILE_ALLOWED_IMAGE {
    JPEG = 'image/jpeg',
    PNG = 'image/png',
    WEBP = 'image/webp',
}

export enum ENUM_FILE_ALLOWED_PDF {
    PDF = 'application/pdf',
}

export enum ENUM_FILE_STORE {
    SHOP_PHOTOS = 'shop-photos',
    PRODUCT_IMAGES = 'product-images',
    USER_AVATARS = 'user-avatars',
    FEEDBACK_ATTACHMENTS = 'feedback-attachments',
    CANDIDATE_PHOTOS = 'candidate-photos',
    LISTING_PHOTOS = 'listing-photos',
    REPORTS = 'reports',
    ANNOUNCEMENTS = 'announcements',
    // Finance folders: PRIVATE bucket only (PrivateFileService), never /uploads.
    FINANCE_STAGING = 'staging',
    FINANCE_RECEIPTS = 'receipts',
    FINANCE_EXPENSES = 'expenses',
    FINANCE_REVENUES = 'revenues',
}

/**
 * Top-level folders of the private finance bucket. `isStoragePublicUrl`
 * refuses any public URL whose object path starts with one of them, so a
 * finance path can never be saved as a "public" image anywhere else.
 */
export const FINANCE_STORE_FOLDERS: readonly string[] = [
    ENUM_FILE_STORE.FINANCE_STAGING,
    ENUM_FILE_STORE.FINANCE_RECEIPTS,
    ENUM_FILE_STORE.FINANCE_EXPENSES,
    ENUM_FILE_STORE.FINANCE_REVENUES,
];

export const FILE_MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB
export const FILE_MAX_PDF_SIZE = 20 * 1024 * 1024; // 20 MB
/** Finance attachments (plan 5.2): PDF up to 10 MB, images up to 5 MB. */
export const FINANCE_MAX_PDF_SIZE = 10 * 1024 * 1024; // 10 MB
