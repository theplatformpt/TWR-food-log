// POST /api/start  { name, contact, start, company }  ->  { token }
// Creates the client's row in Airtable (1 API call) and returns their private link token.
import { json, airtable, table, CLIENTS, newToken, readJson, clean, failure } from "./_lib.js";

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await readJson(request); } catch { return json({ error: "Invalid request." }, 400); }

  // Honeypot: real people never see or fill this field.
  if (clean(body.company)) return json({ token: newToken() });

  const name = clean(body.name, 120);
  const contact = clean(body.contact, 160);
  const start = /^\d{4}-\d{2}-\d{2}$/.test(body.start) ? body.start : null;
  if (!name) return json({ error: "Enter your name to start." }, 400);
  if (!contact) return json({ error: "Enter a phone number or email so Renée can reach you." }, 400);

  const token = newToken();
  const origin = new URL(request.url).origin;
  const fields = {
    "Name": name,
    "Contact": contact,
    "Log Token": token,
    "Log Link": `${origin}/?t=${token}`,
  };
  if (start) fields["Day 1 Date"] = start;

  try {
    await airtable(env, "POST", table(env, CLIENTS), { records: [{ fields }], typecast: true });
  } catch (err) {
    return failure(err);
  }
  return json({ token });
}
