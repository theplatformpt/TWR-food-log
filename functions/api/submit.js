// POST /api/submit  { t, day: 1|2|3, date, data }  ->  { submittedAt }
// Sends one finished day to Airtable (2 API calls: check the link, then create or update the day).
// Sending the same day again updates that day's row instead of adding a new one.
import { json, airtable, table, DAYS, findClient, validToken, readJson, clean, num, failure } from "./_lib.js";

function meal(m) {
  return {
    food: clean(m?.food, 2000),
    time: /^\d{2}:\d{2}$/.test(m?.time || "") ? m.time : "",
    portion: clean(m?.portion, 300),
    hunger: num(m?.hunger, 1, 5),
  };
}
const time12 = (t) => {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};
const mealLine = (m) =>
  [m.time && time12(m.time), m.food, m.portion && `(${m.portion})`, m.hunger && `hunger ${m.hunger}/5`]
    .filter(Boolean).join(" · ");

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await readJson(request); } catch { return json({ error: "That day is too long to send. Shorten a few entries and try again." }, 413); }

  const t = body?.t;
  const n = num(body?.day, 1, 3);
  if (!validToken(t) || !n || !Number.isInteger(n)) return json({ error: "Invalid request." }, 400);

  const src = body.data || {};
  const d = {
    meals: {
      breakfast: meal(src.meals?.breakfast),
      lunch: meal(src.meals?.lunch),
      dinner: meal(src.meals?.dinner),
    },
    snacks: (Array.isArray(src.snacks) ? src.snacks : []).slice(0, 12).map(meal),
    water: num(src.water, 0, 1000) ?? 0,
    drinks: (Array.isArray(src.drinks) ? src.drinks : []).slice(0, 15).map((x) => ({
      what: clean(x?.what, 200),
      oz: num(x?.oz, 0, 200),
    })),
    energy: {
      am: num(src.energy?.am, 1, 10),
      mid: num(src.energy?.mid, 1, 10),
      pm: num(src.energy?.pm, 1, 10),
    },
    notes: clean(src.notes, 3000),
  };
  const date = /^\d{4}-\d{2}-\d{2}$/.test(body.date || "") ? body.date : null;

  try {
    const client = await findClient(env, t);
    if (!client) return json({ error: "That link isn't valid. Ask Renée to send it again." }, 404);

    const submittedAt = new Date().toISOString();
    const e = [d.energy.am, d.energy.mid, d.energy.pm].filter((x) => x != null);
    const M = d.meals;
    const fields = {
      "Entry": `${client.fields?.Name || "Client"} – Day ${n}`,
      "Entry Key": `${t}-d${n}`,
      "Client": [client.id],
      "Day": n,
      "Breakfast": M.breakfast.food, "Breakfast Time": time12(M.breakfast.time), "Breakfast Portion": M.breakfast.portion, "Breakfast Hunger": M.breakfast.hunger,
      "Lunch": M.lunch.food, "Lunch Time": time12(M.lunch.time), "Lunch Portion": M.lunch.portion, "Lunch Hunger": M.lunch.hunger,
      "Dinner": M.dinner.food, "Dinner Time": time12(M.dinner.time), "Dinner Portion": M.dinner.portion, "Dinner Hunger": M.dinner.hunger,
      "Snacks": d.snacks.filter((s) => s.food || s.time).map(mealLine).join("\n"),
      "Water (oz)": d.water,
      "Other Drinks": d.drinks.filter((x) => x.what).map((x) => x.what + (x.oz != null ? ` (${x.oz} oz)` : "")).join("\n"),
      "Energy Morning": d.energy.am,
      "Energy Afternoon": d.energy.mid,
      "Energy Evening": d.energy.pm,
      "Energy Average": e.length ? Math.round((e.reduce((a, b) => a + b, 0) / e.length) * 10) / 10 : null,
      "Notes": d.notes,
      "Submitted At": submittedAt,
      "Raw": JSON.stringify(d),
    };
    if (date) fields["Date"] = date;

    await airtable(env, "PATCH", table(env, DAYS), {
      performUpsert: { fieldsToMergeOn: ["Entry Key"] },
      records: [{ fields }],
      typecast: true,
    });
    return json({ submittedAt });
  } catch (err) {
    return failure(err);
  }
}
