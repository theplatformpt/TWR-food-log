// GET /api/setup?key=SETUP_KEY
// One-time: creates the Clients and Day Logs tables in Renée's empty Airtable base.
// Safe to run twice (it skips tables that already exist). Remove SETUP_KEY afterwards.
import { json, airtable, config, CLIENTS, DAYS } from "./_lib.js";

const text = (name, description) => ({ name, type: "singleLineText", ...(description && { description }) });
const long = (name, description) => ({ name, type: "multilineText", ...(description && { description }) });
const int = (name, description) => ({ name, type: "number", options: { precision: 0 }, ...(description && { description }) });
const date = (name) => ({ name, type: "date", options: { dateFormat: { name: "us" } } });

const CLIENT_FIELDS = [
  text("Name"),
  text("Contact", "Phone or email the client entered."),
  date("Day 1 Date"),
  text("Log Token", "Private key in the client's log link. Filled in automatically. Clear it to turn the link off."),
  { name: "Log Link", type: "url", description: "The client's private log link. Text it to them if they lose it." },
];

const mealFields = (m) => [
  long(m),
  text(`${m} Time`),
  text(`${m} Portion`),
  int(`${m} Hunger`, "Hunger before eating: 1 starving, 2 hungry, 3 neutral, 4 satisfied, 5 stuffed."),
];

const dayFields = (clientsTableId) => [
  text("Entry"),
  int("Day"),
  date("Date"),
  ...mealFields("Breakfast"),
  ...mealFields("Lunch"),
  ...mealFields("Dinner"),
  long("Snacks", "One snack per line: time · food · (portion) · hunger."),
  int("Water (oz)"),
  long("Other Drinks"),
  int("Energy Morning", "1 drained – 10 fully charged."),
  int("Energy Afternoon"),
  int("Energy Evening"),
  { name: "Energy Average", type: "number", options: { precision: 1 } },
  long("Notes", "Sleep, workout, stress, cravings — whatever the client added."),
  { name: "Submitted At", type: "dateTime", options: { dateFormat: { name: "us" }, timeFormat: { name: "12hour" }, timeZone: "America/Phoenix" } },
  { name: "Client", type: "multipleRecordLinks", options: { linkedTableId: clientsTableId } },
  text("Entry Key", "Used by the website to update a day instead of duplicating it. Don't edit."),
  long("Raw", "Copy of the day for the website to reload. Don't edit."),
];

export async function onRequestGet({ request, env }) {
  const key = new URL(request.url).searchParams.get("key");
  if (!env.SETUP_KEY || key !== env.SETUP_KEY) return json({ error: "Not found." }, 404);

  try {
    const base = config(env).base;
    const meta = `meta/bases/${base}/tables`;
    const { tables = [] } = await airtable(env, "GET", meta);
    const byName = Object.fromEntries(tables.map((t) => [t.name, t]));
    const done = [];

    let clients = byName[CLIENTS];
    if (!clients) {
      clients = await airtable(env, "POST", meta, {
        name: CLIENTS,
        description: "One row per client. Created when they start their food log.",
        fields: CLIENT_FIELDS,
      });
      done.push(`Created ${CLIENTS}`);
    } else done.push(`${CLIENTS} already exists`);

    if (!byName[DAYS]) {
      await airtable(env, "POST", meta, {
        name: DAYS,
        description: "One row per client per day. Created when the client taps Send.",
        fields: dayFields(clients.id),
      });
      done.push(`Created ${DAYS}`);
    } else done.push(`${DAYS} already exists`);

    return json({ ok: true, done, next: "Remove SETUP_KEY from the Cloudflare settings now." });
  } catch (err) {
    return json({ ok: false, error: err.message, status: err.status || null }, 500);
  }
}
