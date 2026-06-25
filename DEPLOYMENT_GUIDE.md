# 🌸 Elsa Portfolio — New Branch Deployment Guide

## Files in this package

| File | Where it goes |
|---|---|
| `index.html` | GitHub repo → new branch → replaces existing `index.html` |
| `Code.gs` | Google Sheets → Extensions → Apps Script (replaces everything) |

---

## STEP 1 — Create the new branch on GitHub

```bash
# In your local repo or GitHub web UI:
git checkout -b portfolio-v2

# Copy index.html into the repo root, then:
git add index.html
git commit -m "feat: portfolio v2 — live Sheet sync, media library, financial dashboard, gallery"
git push origin portfolio-v2
```

Or via GitHub web:
1. Go to `github.com/Layaungshinthant/elsa_portfolio`
2. Click the branch dropdown → **"View all branches"** → **"New branch"**
3. Name it `portfolio-v2`, source = `main`
4. Open `index.html` in the new branch → click ✏️ edit → paste the full new file → commit

---

## STEP 2 — Update Apps Script (Code.gs)

1. Open your Google Sheet (the one powering the portfolio)
2. **Extensions → Apps Script**
3. Select all existing code → delete → paste the full `Code.gs` content
4. Fill in the 3 placeholders at the top:

```js
const GOLDAPI_KEY = "YOUR_KEY_FROM_goldapi.io_DASHBOARD";
const ROOT_MEDIA_FOLDER_ID = "1-Hh7v9y2OqOhCkAP9uAKZh-hcFCnk3K4";
const GOOGLE_CHAT_WEBHOOK = "YOUR_WEBHOOK_URL"; // optional, leave placeholder to skip
```

Also find and set your admin key:
```js
if (data.secretKey !== "YOUR_SECURE_ADMIN_PASSKEY")
```
Replace `YOUR_SECURE_ADMIN_PASSKEY` with any long random string (e.g. `Elsa@2026!PortfolioAdmin#Rose`). Remember it — you'll enter it in the site's admin panel.

5. Click **Save** (💾)

---

## STEP 3 — Redeploy the Web App

1. **Deploy → Manage deployments**
2. Click ✏️ on your existing deployment
3. Version → **"New version"**
4. Click **Deploy**
5. The URL stays the same — no change needed in `index.html`

> ⚠️ If you see a NEW URL instead, copy it and update line ~940 in `index.html`:
> ```js
> google_sheet_script_url: 'PASTE_NEW_URL_HERE',
> ```

---

## STEP 4 — Run these 3 setup functions (once only)

In Apps Script editor, run each of these once by selecting from the function dropdown → ▶ Run:

### 4a. `setupMarketsTab`
Creates the "Markets" tab in your Sheet with the right headers.

### 4b. `setupMediaLibrary`
Creates the "Media" tab + 7 Drive subfolders inside your root media folder:
`Home / Journal / Vault / HR Suite / Compliance / Automation / Humanitarian Path`

### 4c. `refreshMarketsDaily`
Does the first live gold + FX data fetch from GoldAPI.io → writes to Markets tab.
After this, your financial dashboard will show real numbers.

---

## STEP 5 — Set up daily auto-refresh triggers

In Apps Script: **Triggers** (clock icon, left sidebar) → **+ Add Trigger**

### Trigger 1: Gold & FX rates (daily)
| Field | Value |
|---|---|
| Function | `refreshMarketsDaily` |
| Event source | Time-driven |
| Type | Day timer |
| Hour | 6am–7am (Yangon time) |

### Trigger 2: Media library scan (daily)
| Field | Value |
|---|---|
| Function | `refreshMediaLibrary` |
| Event source | Time-driven |
| Type | Day timer |
| Hour | 6am–7am (Yangon time) |

---

## STEP 6 — Add your Config Sheet rows

In the **Config** tab of your Google Sheet, add these rows (Key | Value):

| Key | Value | Effect |
|---|---|---|
| `cv_url` | Your Drive CV file link | Enables CV download button |
| `availability_status` | `open` / `employed` / `available-from` | Controls the pulsing badge on splash |
| `availability_label` | `Open to Opportunities` | Text shown on the badge |
| `visitor_count` | `1` | Shown on splash screen |
| `profile_picture` | Drive image URL (direct link) | Syncs your photo across all avatars |

---

## STEP 7 — Deploy on Vercel

1. Go to your Vercel dashboard
2. Connect it to the `portfolio-v2` branch (or set it as the production branch)
3. Deploy — done

---

## How the article pipeline works now

```
You edit a row in the Articles sheet
        ↓
Apps Script serves it via ?action=init
        ↓
Site fetches on every page load
        ↓
Visitor sees it automatically — no export, no paste
```

**Articles sheet column headers (exact, case-sensitive):**
```
ID | Title | Body | Date | Status
```
- `Date` format: `2026-06-21` or `2026-06-21T17:30:00.000Z`
- `Status`: must be exactly `Published` to appear (use `Draft` to hide)

---

## How to upload media (photos, PPTX, videos)

1. Open Google Drive → find the `Elsa Portfolio Media` root folder
2. Open the matching section subfolder (e.g. `Humanitarian Path`)
3. Drop your file in
4. It appears on the site within 24 hours (next daily trigger)
5. **Want it live immediately?** Go to Apps Script → run `refreshMediaLibrary` manually

**Optional custom caption:** rename the file like:
`Event Name — Your caption text here.jpg`
The part after `—` becomes the caption on the site.

---

## Admin panel (secret entry)

On the live site, go to the **Connect** tab → click the 🌸 icon **5 times** → admin panel opens.
Enter your admin key (the one you set in Step 2).

From the admin panel you can:
- Update your location/status
- Post a journal article (writes directly to the Sheet)
- Delete articles

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Articles not showing | Check Sheet tab is named exactly `Articles`, headers match `ID\|Title\|Body\|Date\|Status`, Status = `Published` |
| Financial dashboard shows old numbers | Run `refreshMarketsDaily` manually in Apps Script |
| Media not showing | Run `refreshMediaLibrary` manually |
| Admin panel says "Unauthorized" | Check your admin key matches exactly in Code.gs |
| Site shows stale content | Hard refresh: Ctrl+Shift+R (clears localStorage cache) |
| Gold API not working | Check your key at goldapi.io/dashboard, confirm it's pasted in Code.gs (not in index.html) |
| Vercel not picking up changes | Confirm the branch is set correctly in Vercel project settings |
