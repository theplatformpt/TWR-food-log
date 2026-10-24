// Shared helpers for the Train With Renée food log API.
// Airtable is only called when a client starts a log, opens it on a new device,
// or sends a finished day. Drafts live on the client's phone.

export const CLIENTS = "Clients";
export const DAYS = "Day Logs";
const MAX_BYTES = 60_000;

export const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

export function config(env) {
  if (!env.AIRTABLE_TOKEN || !env.AIRTABLE_BASE_ID) throw new Error("not_configured");
  return {
    token: env.AIRTABLE_TOKEN,
    base: env.AIRTABLE_BASE_ID,
    api: (env.AIRTABLE_API_URL || "https://api.airtable.com").replace(/\/$/, ""),
  };
}

export async function airtable(env, method, path, body) {
  const c = config(env);
  const res = await fetch(`${c.api}/v0/${path}`, {
    method,
    headers: { authorization: `Bearer ${c.token}`, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { /* keep {} */ }
  if (!res.ok) {
    const err = new Error(data?.error?.message || data?.error?.type || `airtable_${res.status}`);
    err.status = res.status;
    err.type = data?.error?.type;
    throw err;
  }
  return data;
}

export const table = (env, name) => `${config(env).base}/${encodeURIComponent(name)}`;

// 144-bit random token, URL-safe.
export function newToken() {
  const a = new Uint8Array(18);
  crypto.getRandomValues(a);
  return btoa(String.fromCharCode(...a)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export const validToken = (t) => typeof t === "string" && /^[A-Za-z0-9_-]{20,40}$/.test(t);

// Find the client whose Log Token matches. Token chars are [A-Za-z0-9_-], so the formula is safe.
export async function findClient(env, token) {
  if (!validToken(token)) return null;
  const q = new URLSearchParams({ filterByFormula: `{Log Token}='${token}'`, maxRecords: "1" });
  const data = await airtable(env, "GET", `${table(env, CLIENTS)}?${q}`);
  return data.records?.[0] || null;
}

export async function readJson(request) {
  const text = await request.text();
  if (text.length > MAX_BYTES) throw new Error("too_large");
  return JSON.parse(text || "{}");
}

export const clean = (v, max = 2000) => String(v ?? "").replace(/\u0000/g, "").slice(0, max).trim();
export const num = (v, lo, hi) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= lo && n <= hi ? n : null;
};

export function failure(err) {
  if (err.message === "not_configured") {
    return json({ error: "The log isn't connected to Airtable yet. Tell Renée." }, 503);
  }
  if (err.status === 429) return json({ error: "Too many people saving at once. Try again in a minute." }, 503);
  if (err.status === 401 || err.status === 403) {
    return json({ error: "The log can't reach Renée's records right now. Tell Renée." }, 503);
  }
  if (err.status === 422) return json({ error: "Renée's Airtable doesn't match this site. Tell Renée." }, 503);
  return json({ error: "Something went wrong. Try again in a minute." }, 502);
}
