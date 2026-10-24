// GET /api/log?t=TOKEN  ->  { name, contact, start, days: { "1": {...}, ... } }
// Loads a client's details and the days they've already sent (2 API calls).
// The browser calls this only when it has no copy of the log on this device.
import { json, airtable, table, DAYS, findClient, validToken, failure } from "./_lib.js";

export async function onRequestGet({ request, env }) {
  const t = new URL(request.url).searchParams.get("t");
  if (!validToken(t)) return json({ error: "That link isn't valid. Ask Renée to send it again." }, 404);
  try {
    const client = await findClient(env, t);
    if (!client) return json({ error: "That link isn't valid. Ask Renée to send it again." }, 404);

    const q = new URLSearchParams({ filterByFormula: `FIND('${t}-d', {Entry Key})=1`, pageSize: "10" });
    q.append("fields[]", "Day");
    q.append("fields[]", "Raw");
    q.append("fields[]", "Submitted At");
    const data = await airtable(env, "GET", `${table(env, DAYS)}?${q}`);

    const days = {};
    for (const r of data.records || []) {
      const n = r.fields?.Day;
      if (![1, 2, 3].includes(n)) continue;
      let raw = null;
      try { raw = JSON.parse(r.fields?.Raw || "null"); } catch { raw = null; }
      if (raw) days[n] = { ...raw, submittedAt: r.fields?.["Submitted At"] || raw.submittedAt || null };
    }
    const f = client.fields || {};
    return json({ name: f.Name || "", contact: f.Contact || "", start: f["Day 1 Date"] || "", days });
  } catch (err) {
    return failure(err);
  }
}
