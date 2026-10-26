// POST /api/coach/login { password } -> sets the staff cookie
// DELETE /api/coach/login            -> signs out
// GET  /api/coach/login              -> { signedIn }
import { json, readJson } from "../_lib.js";
import { configured, makeCookie, clearCookie, isStaff, passwordMatches } from "./_auth.js";

export async function onRequestGet({ request, env }) {
  return json({ signedIn: await isStaff(request, env), configured: configured(env) });
}

export async function onRequestPost({ request, env }) {
  if (!configured(env)) {
    return json({ error: "Staff login isn't set up yet. Add STAFF_PASSWORD in Cloudflare (8+ characters)." }, 503);
  }
  let body;
  try { body = await readJson(request); } catch { return json({ error: "Invalid request." }, 400); }
  if (!(await passwordMatches(env, body.password))) {
    await new Promise((r) => setTimeout(r, 1200)); // slow down guessing
    return json({ error: "That password isn't right." }, 401);
  }
  const res = json({ ok: true });
  res.headers.append("set-cookie", await makeCookie(env));
  return res;
}

export async function onRequestDelete() {
  const res = json({ ok: true });
  res.headers.append("set-cookie", clearCookie());
  return res;
}
