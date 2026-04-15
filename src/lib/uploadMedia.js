import { apiBaseURL, getAccessToken } from "./axios.js";

/**
 * Request presigned PUT, upload file directly to S3, return stable public URL.
 * @param {File} file
 * @param {"avatar" | "message"} purpose
 */
export async function uploadFileViaPresign(file, purpose) {
  const token = getAccessToken();
  if (!token) {
    throw new Error("Not authenticated");
  }

  const contentType = file.type || "application/octet-stream";

  const res = await fetch(`${apiBaseURL}/media/presigned-upload`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      purpose,
      fileName: file.name,
      contentType,
      contentLength: file.size,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const code = err.code;
    if (code === "UNSUPPORTED_CONTENT_TYPE") {
      throw new Error("Loại file không được hỗ trợ");
    }
    if (code === "FILE_TOO_LARGE") {
      const maxBytes = err.maxBytes;
      const maxMb =
        typeof maxBytes === "number" && maxBytes > 0
          ? Math.ceil(maxBytes / (1024 * 1024))
          : null;
      throw new Error(
        maxMb ? `Dung lượng file vượt giới hạn (tối đa ${maxMb} MB)` : "Dung lượng file vượt giới hạn"
      );
    }
    throw new Error(err.message || `Presign failed (${res.status})`);
  }

  const { uploadUrl, publicUrl, key } = await res.json();

  const put = await fetch(uploadUrl, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": contentType },
  });

  if (!put.ok) {
    throw new Error(`S3 upload failed (${put.status})`);
  }

  return { publicUrl, key };
}
