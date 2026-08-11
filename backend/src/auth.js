export function authorize(request, env) {
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  return Boolean(token && env.DEVICE_TOKEN && token === env.DEVICE_TOKEN);
}
