export function validateImageRequest(request) {
  const type = request.headers.get("content-type") || "";
  const length = Number(request.headers.get("content-length") || 0);
  return type === "image/jpeg" && length > 0 && length <= 750 * 1024;
}
