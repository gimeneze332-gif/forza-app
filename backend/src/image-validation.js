export const MAX_IMAGE_BYTES = 750 * 1024;

export function validateImageHeaders(request) {
  const type = (request.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  const rawLength = request.headers.get("content-length");
  const length = rawLength == null ? null : Number(rawLength);
  if (type !== "image/jpeg") return { valid: false, error: "unsupported_content_type", status: 415 };
  if (length != null && (!Number.isFinite(length) || length <= 0 || length > MAX_IMAGE_BYTES)) return { valid: false, error: "image_too_large", status: 413 };
  return { valid: true };
}

export function validateJpeg(bytes) {
  return bytes instanceof Uint8Array && bytes.length >= 4 && bytes.length <= MAX_IMAGE_BYTES &&
    bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}
