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
    REPORTS = 'reports',
    ANNOUNCEMENTS = 'announcements',
}

export const FILE_MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB
export const FILE_MAX_PDF_SIZE = 20 * 1024 * 1024; // 20 MB
