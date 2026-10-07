import { getErrorStatus } from "./api-error";
import { formatNumber } from "./format-number";

/** Same limits as the web feedback form (apps/web FeedbackViews). */
export const MAX_ATTACHMENTS = 3;
export const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024;
export const ALLOWED_IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp"] as const;

export type PickedAsset = { uri: string; mimeType?: string | null; fileSize?: number | null };

/** Prefer the picker's mime type; fall back to the file extension. */
export function resolveImageMime(asset: Pick<PickedAsset, "uri" | "mimeType">): string | null {
  const declared = asset.mimeType?.toLowerCase();
  if (declared === "image/jpg")
    return "image/jpeg";
  if (declared && (ALLOWED_IMAGE_MIMES as readonly string[]).includes(declared))
    return declared;
  if (declared)
    return null;
  const ext = asset.uri.split("?")[0].split(".").pop()?.toLowerCase();
  if (ext === "jpg" || ext === "jpeg")
    return "image/jpeg";
  if (ext === "png")
    return "image/png";
  if (ext === "webp")
    return "image/webp";
  return null;
}

export type AssetCheck = { ok: true; mime: string } | { ok: false; errorKey: string };

/** Translation keys under `feedback.*`. An unknown size passes (the server still enforces 5 MB). */
export function validateAsset(asset: PickedAsset): AssetCheck {
  const mime = resolveImageMime(asset);
  if (!mime)
    return { ok: false, errorKey: "feedback.upload_bad_type" };
  if (asset.fileSize != null && asset.fileSize > MAX_ATTACHMENT_BYTES)
    return { ok: false, errorKey: "feedback.upload_too_large" };
  return { ok: true, mime };
}

/** Toast copy for a failed `/uploads/image` request. */
export function uploadErrorKey(error: unknown): string {
  switch (getErrorStatus(error)) {
    case 413: return "feedback.upload_too_large";
    case 400:
    case 415: return "feedback.upload_bad_type";
    case 502:
    case 503: return "feedback.upload_unavailable";
    default: return "feedback.upload_failed";
  }
}

/** Interpolation values for the upload copy: limits shown with locale digits. */
export function uploadLimitParams(language: string) {
  return {
    maxPhotos: formatNumber(MAX_ATTACHMENTS, language),
    maxSize: formatNumber(MAX_ATTACHMENT_BYTES / (1024 * 1024), language),
  };
}
