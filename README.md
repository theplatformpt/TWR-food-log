# Train With Renée — 3-Day Food Log

A mobile-first website where clients log three days of meals, snacks, water, other drinks and energy. Each day goes to Renée's Airtable when the client taps **Send to Renée**. No client accounts or logins.

Same setup as the Platform Performance Index: code in GitHub, hosted free on Cloudflare Pages, Airtable token stored only in Cloudflare.

## How it works

| Step | What happens | Airtable calls |
|---|---|---|
| Client opens the site and taps **Start my log** | A row is added to **Clients** with a private link | 1 |
| Client logs food all day | Saved on their phone only | 0 |
| Client taps **Send Day N** | A row is added (or updated) in **Day Logs** | 2 |
| Client opens their link on a new phone | Their sent days load | 2 |

A client who finishes all three days uses about 7 calls. Airtable's free plan allows 1,000 a month, which covers roughly 140 clients a month.

**Private links.** Each client's link (`…/?t=…`) is their key, like the family report links. It's saved in the **Log Link** field. To turn a link off, clear that client's **Log Token**.

**Drafts live on the phone.** If a client switches phones partway through a day, that day's unsent entries stay on the old phone. Days they've already sent load on any device.

---

## One-time setup (about 15 minutes)

All accounts should be Renée's, since these are her clients.

### 1. Airtable (Renée's account) — base already built

The base **Train with Renée website** (`appwZymle9tI8Cdn2`) already has the **Clients** and **Day Logs** tables. Delete the empty **Table 1**.

Renée creates the token (only she should do this):
1. Go to **airtable.com/create/tokens → Create token**.
   - Name: `Food log website`
   - Scopes: `data.records:read` and `data.records:write`
   - Access: only the **Train with Renée website** base
2. Copy the token (starts with `pat`). Airtable shows it once, so paste it straight into Cloudflare in step 3.

### 2. GitHub

1. Create a **private** repo, e.g. `twr-food-log`.
2. Upload everything in this folder to it, including `functions/` and `public/`.

### 3. Cloudflare Pages (Renée's account)

1. **Workers & Pages → Create → Pages → Connect to Git**, then pick the repo. When GitHub asks, give Cloudflare access to **only this repository**.
2. Build settings:
   - Framework preset: **None**
   - Build command: *(leave blank)*
   - Build output directory: `public`
3. Under **Environment variables (Production)**, add:

| Name | Value | Type |
|---|---|---|
| `AIRTABLE_TOKEN` | the `pat…` token | **Encrypt** (Secret) |
| `AIRTABLE_BASE_ID` | `appwZymle9tI8Cdn2` | Text |
| `STAFF_PASSWORD` | Renée's coach-view password, 12+ characters | **Encrypt** (Secret) |

4. Choose a project name like `trainwithrenee-log`. The site becomes `https://trainwithrenee-log.pages.dev`.
5. Click **Save and Deploy**.

(`functions/api/setup.js` creates the tables in a fresh base if you ever need to rebuild. It only runs when a `SETUP_KEY` variable is set; otherwise it's switched off.)

### 4. Test it

1. Open the site on your phone, start a log as **TEST — Tyler**, fill in a meal, and tap **Send Day 1**.
2. Check that the row shows up in **Day Logs**, linked to the client.
3. Delete both test rows.

### 5. Renée's coach view

Open **https://twr-food-log.pages.dev/coach/** and sign in with `STAFF_PASSWORD`. She stays signed in on that device for 30 days. On a phone, Share → Add to Home Screen makes it an app icon.

- The client list shows days sent, average water, average energy and status, with search and In progress / Complete filters.
- Tapping a client opens their averages (water, energy by time of day, eating pattern), all three days side by side, and their private link to re-send.
- Each load or Refresh uses about 2 Airtable calls per 100 clients. Checking 10 times a day comes to about 600 calls a month, so it fits the free 1,000 with normal client traffic. If it ever gets tight, check less often.
- To lock everyone out (for example, if the password got shared), change `STAFF_PASSWORD` in Cloudflare and retry the latest deployment.

Airtable is still the place to edit or delete records.

---

## What Renée sends clients

> Here's your 3-day food log: https://trainwithrenee-log.pages.dev
> Log as you go, and tap "Send to Renée" at the end of each day. Save the private link it gives you so you can get back to your log.

## Airtable fields

**Clients:** Name · Contact · Day 1 Date · Log Token · Log Link · Day Logs (linked)

**Day Logs:** Entry · Day · Date · Breakfast / Time / Portion / Hunger · Lunch (same) · Dinner (same) · Snacks · Water (oz) · Other Drinks · Energy Morning / Afternoon / Evening / Average · Notes · Submitted At · Client (linked) · Entry Key · Raw

Hunger is rated before eating: 1 starving, 2 hungry, 3 neutral, 4 satisfied, 5 stuffed. Energy is 1 drained to 10 fully charged.

**What breaks it:** renaming or deleting fields, or the token expiring or losing access. When that happens, clients see "Tell Renée" when they tap Send, and their entries stay on their phone. Rename the field back, or put a new token in Cloudflare and redeploy.

You can add new fields, views and formulas freely. **Entry Key** and **Raw** are used by the website, so hide them but don't edit them.

## Files

```
public/index.html          the client page (all UI)
public/logo.png, icons     branding, home-screen icon
functions/api/start.js     POST: create a client + private link
functions/api/submit.js    POST: send one day to Airtable
functions/api/log.js       GET: reload sent days on a new device
functions/api/setup.js     GET: one-time table creation (needs SETUP_KEY)
functions/api/coach/*      staff login + data for /coach/
public/coach/index.html    Renée's coach view
functions/api/_lib.js      shared Airtable helpers
```

**Local testing (optional):** copy `.dev.vars.example` to `.dev.vars`, fill it in, then run `npx wrangler pages dev public`.
