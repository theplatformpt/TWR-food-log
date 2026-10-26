// Staff login for the coach view.
// One shared password (STAFF_PASSWORD, a Cloudflare secret). A correct password sets a signed,
// HttpOnly cookie good for 30 days. Changing STAFF_PASSWORD logs everyone out.

const COOKIE = "twr_staff";
const DAYS = 30;
const enc = new TextEncoder();

async function key(env) {
  return crypto.subtle.importKey(
    "raw",
    enc.encode("twr-coach-session:" + env.STAFF_PASSWORD),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}
const b64 = (buf) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64 = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

export const configured = (env) => typeof env.STAFF_PASSWORD === "string" && env.STAFF_PASSWORD.length >= 8;

export async function makeCookie(env) {
  const exp = Date.now() + DAYS * 864e5;
  const sig = await crypto.subtle.sign("HMAC", await key(env), enc.encode(String(exp)));
  return `${COOKIE}=${exp}.${b64(sig)}; Path=/; Max-Age=${DAYS * 86400}; HttpOnly; Secure; SameSite=Strict`;
}
export const clearCookie = () => `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;

export async function isStaff(request, env) {
  if (!configured(env)) return false;
  const m = (request.headers.get("cookie") || "").match(new RegExp(`(?:^|;\\s*)${COOKIE}=(\\d+)\\.([A-Za-z0-9_-]+)`));
  if (!m) return false;
  const exp = Number(m[1]);
  if (!(exp > Date.now())) return false;
  try {
    return await crypto.subtle.verify("HMAC", await key(env), unb64(m[2]), enc.encode(m[1]));
  } catch {
    return false;
  }
}

// Constant-time password check (compares HMACs, so length and content don't leak through timing).
export async function passwordMatches(env, attempt) {
  const k = await crypto.subtle.importKey("raw", enc.encode("twr-pw-check"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const [a, b] = await Promise.all([
    crypto.subtle.sign("HMAC", k, enc.encode(String(attempt ?? ""))),
    crypto.subtle.sign("HMAC", k, enc.encode(env.STAFF_PASSWORD)),
  ]);
  const x = new Uint8Array(a), y = new Uint8Array(b);
  let d = 0;
  for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i];
  return d === 0;
}
