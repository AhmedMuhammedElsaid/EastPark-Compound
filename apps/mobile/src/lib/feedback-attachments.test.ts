import { MAX_ATTACHMENT_BYTES, resolveImageMime, uploadErrorKey, validateAsset } from "./feedback-attachments";

describe("feedback attachments", () => {
  it("resolves mime from picker or extension", () => {
    expect(resolveImageMime({ uri: "file:///a.jpg", mimeType: "image/jpg" })).toBe("image/jpeg");
    expect(resolveImageMime({ uri: "file:///a.PNG" })).toBe("image/png");
    expect(resolveImageMime({ uri: "file:///a.webp?x=1" })).toBe("image/webp");
    expect(resolveImageMime({ uri: "file:///a.gif", mimeType: "image/gif" })).toBeNull();
    expect(resolveImageMime({ uri: "file:///a" })).toBeNull();
  });

  it("rejects oversize and unsupported files", () => {
    expect(validateAsset({ uri: "x.jpg", fileSize: MAX_ATTACHMENT_BYTES + 1 })).toEqual({ ok: false, errorKey: "feedback.upload_too_large" });
    expect(validateAsset({ uri: "x.heic", mimeType: "image/heic" })).toEqual({ ok: false, errorKey: "feedback.upload_bad_type" });
    expect(validateAsset({ uri: "x.jpg", fileSize: 1000 })).toEqual({ ok: true, mime: "image/jpeg" });
    expect(validateAsset({ uri: "x.jpg" })).toEqual({ ok: true, mime: "image/jpeg" });
  });

  it("maps upload errors", () => {
    const err = (status?: number) => ({ response: status ? { status } : undefined });
    expect(uploadErrorKey(err(413))).toBe("feedback.upload_too_large");
    expect(uploadErrorKey(err(415))).toBe("feedback.upload_bad_type");
    expect(uploadErrorKey(err(502))).toBe("feedback.upload_unavailable");
    expect(uploadErrorKey(err())).toBe("feedback.upload_failed");
  });
});
