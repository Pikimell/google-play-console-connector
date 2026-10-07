// Працює і в proxy, і в route handlers (Web Crypto).
export const SESSION_COOKIE = "gpc_session";

export function authEnabled() {
  return Boolean(process.env.ADMIN_PASSWORD);
}

export async function sessionToken(password: string) {
  const data = new TextEncoder().encode(`gpc:v1:${password}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function isValidSession(cookieValue: string | undefined) {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return true;
  if (!cookieValue) return false;
  return cookieValue === (await sessionToken(password));
}

export function readCookie(header: string | null, name: string) {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return undefined;
}
