// GET /api/coach/data -> every client and their sent days, for the coach view.
// Staff only. Uses 2 Airtable calls per 100 clients / 100 days (one per page of each table).
import { json, airtable, table, CLIENTS, DAYS, failure } from "../_lib.js";
import { isStaff } from "./_auth.js";

const DAY_FIELDS = [
  "Day", "Date", "Client", "Submitted At",
  "Breakfast", "Breakfast Time", "Breakfast Portion", "Breakfast Hunger",
  "Lunch", "Lunch Time", "Lunch Portion", "Lunch Hunger",
  "Dinner", "Dinner Time", "Dinner Portion", "Dinner Hunger",
  "Snacks", "Water (oz)", "Other Drinks",
  "Energy Morning", "Energy Afternoon", "Energy Evening", "Energy Average", "Notes",
];
const CLIENT_FIELDS = ["Name", "Contact", "Day 1 Date", "Log Link"];

async function all(env, name, fields) {
  const out = [];
  let offset;
  for (let page = 0; page < 20; page++) {
    const q = new URLSearchParams({ pageSize: "100" });
    fields.forEach((f) => q.append("fields[]", f));
    if (offset) q.set("offset", offset);
    const data = await airtable(env, "GET", `${table(env, name)}?${q}`);
    out.push(...(data.records || []));
    if (!data.offset) break;
    offset = data.offset;
  }
  return out;
}

export async function onRequestGet({ request, env }) {
  if (!(await isStaff(request, env))) return json({ error: "Sign in again." }, 401);
  try {
    const [clients, days] = await Promise.all([all(env, CLIENTS, CLIENT_FIELDS), all(env, DAYS, DAY_FIELDS)]);
    const byClient = {};
    for (const r of days) {
      const f = r.fields || {};
      const cid = f.Client?.[0];
      if (!cid || ![1, 2, 3].includes(f.Day)) continue;
      const meal = (m) => ({ food: f[m] || "", time: f[`${m} Time`] || "", portion: f[`${m} Portion`] || "", hunger: f[`${m} Hunger`] ?? null });
      (byClient[cid] ||= {})[f.Day] = {
        date: f.Date || "",
        submittedAt: f["Submitted At"] || "",
        breakfast: meal("Breakfast"), lunch: meal("Lunch"), dinner: meal("Dinner"),
        snacks: f.Snacks || "",
        water: f["Water (oz)"] ?? null,
        drinks: f["Other Drinks"] || "",
        energy: { am: f["Energy Morning"] ?? null, mid: f["Energy Afternoon"] ?? null, pm: f["Energy Evening"] ?? null, avg: f["Energy Average"] ?? null },
        notes: f.Notes || "",
      };
    }
    const out = clients.map((r) => ({
      id: r.id,
      created: r.createdTime,
      name: r.fields?.Name || "",
      contact: r.fields?.Contact || "",
      start: r.fields?.["Day 1 Date"] || "",
      link: r.fields?.["Log Link"] || "",
      days: byClient[r.id] || {},
    }));
    return json({ clients: out, fetchedAt: new Date().toISOString() });
  } catch (err) {
    return failure(err);
  }
}
