import { client } from "./client";

export type UploadPurpose = "avatar" | "feedback" | "candidate";

type UploadResponse = { data: { url: string; path: string } };

const IMAGE_EXT = /\.(?:jpe?g|png|webp)$/i;

function fileNameFor(uri: string, mime: string): string {
  const last = uri.split("?")[0].split("/").pop() ?? "";
  if (IMAGE_EXT.test(last))
    return last;
  const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
  return `upload-${Date.now()}.${ext}`;
}

export const uploadsApi = {
  /**
   * `POST /uploads/image?purpose=` (multipart field `file`, jpeg/png/webp, <= 5 MB,
   * magic bytes sniffed server-side). Resolves to the public URL.
   */
  async uploadImage(uri: string, mime: string, purpose: UploadPurpose): Promise<string> {
    const form = new FormData();
    // React Native's FormData accepts { uri, name, type } in place of a Blob.
    form.append("file", { uri, name: fileNameFor(uri, mime), type: mime } as unknown as Blob);
    const res = await client.post<UploadResponse>("/uploads/image", form, {
      params: { purpose },
      headers: { "Content-Type": "multipart/form-data" },
      transformRequest: (data: unknown) => data,
    });
    return res.data.data.url;
  },
};
