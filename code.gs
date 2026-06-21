/**
 * Elsa's Portfolio Core Engine - Google Workspace Integration Hub
 */
const SPREADSHEET_ID = "1j7JIKgA78OC6Z0MhylnhJfZwVwZ3JBfq13H2P1pXt9k";
const GOOGLE_CHAT_WEBHOOK = "YOUR_GOOGLE_CHAT_WEBHOOK_URL_HERE";

function getDb() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function doGet(e) {
  const action = e.parameter.action;
  const db = getDb();
  if (action === "init") {
    trackVisitor(e);
    return renderJson({
      config: getSheetDataAsObj(db.getSheetByName("Config"), "Key", "Value"),
      experience: getSheetRows(db.getSheetByName("Experience")),
      articles: getActiveArticles(db.getSheetByName("Articles")),
      testimonials: getActiveTestimonials(db.getSheetByName("Testimonials")),
      downloads: getSheetRows(db.getSheetByName("Downloads")),
      markets: getSheetDataAsObj(db.getSheetByName("Markets"), "Key", "Value"),
      media: getSheetRows(db.getSheetByName("Media"))
    });
  }
  if (action === "search") {
    const query = (e.parameter.q || "").toLowerCase();
    const articles = getActiveArticles(db.getSheetByName("Articles")).filter(a => 
      a.Title.toLowerCase().includes(query) || a.Body.toLowerCase().includes(query)
    );
    return renderJson({ articles });
  }
  if (action === "markets") {
    return getMarketsAction();
  }
  if (action === "media") {
    return renderJson({ media: getSheetRows(db.getSheetByName("Media")) });
  }
  return renderJson({ status: "connected", engine: "v1.0.0" });
}

function doPost(e) {
  try {
    const postData = JSON.parse(e.postData.contents);
    const action = postData.action;
    const db = getDb();
    if (action === "inquiry") {
      return handleInquiry(db, postData);
    } else if (action === "subscribe") {
      db.getSheetByName("Subscribers").appendRow([new Date(), postData.email]);
      return renderJson({ success: true, message: "Subscription added." });
    } else if (action === "log_click") {
      db.getSheetByName("Clicks").appendRow([new Date(), postData.buttonName, postData.section]);
      return renderJson({ success: true });
    } else if (action === "admin_update") {
      return handleAdminUpdate(db, postData);
    } else if (action === "refresh_media") {
      if (postData.secretKey !== "YOUR_SECURE_ADMIN_PASSKEY") {
        return renderJson({ success: false, error: "Unauthorized access" });
      }
      refreshMediaLibrary();
      return renderJson({ success: true, message: "Media library rescanned." });
    }
    return renderJson({ success: false, error: "Action route unrecognized" });
  } catch(err) {
    return renderJson({ success: false, error: err.toString() });
  }
}

function trackVisitor(e) {
  try {
    const sheet = getDb().getSheetByName("Analytics");
    sheet.appendRow([new Date(), "Unique_Visitor_Token", "Client_Interface_Ping"]);
  } catch(err) { Logger.log("Analytics write fault: " + err); }
}

function handleInquiry(db, data) {
  const sheet = db.getSheetByName("Inquiries");
  const timestamp = new Date();
  sheet.appendRow([timestamp, data.name, data.type, data.message, data.appointmentDate || ""]);
  sendGoogleChatNotification(data);
  if (data.appointmentDate) {
    createCalendarAppointment(data);
  }
  sendGmailAutoReply(data);
  return renderJson({ success: true, message: "Inquiry successfully synchronized to Google Suite." });
}

function handleAdminUpdate(db, data) {
  if (data.secretKey !== "YOUR_SECURE_ADMIN_PASSKEY") {
    return renderJson({ success: false, error: "Unauthorized access" });
  }
  const sheet = db.getSheetByName("Config");
  const rows = sheet.getDataRange().getValues();
  if (data.target === "status") {
    updateConfigValue(sheet, rows, "location_status", data.value);
  } else if (data.target === "profile_picture") {
    updateConfigValue(sheet, rows, "profile_picture", data.value);
  } else if (data.target === "article") {
    db.getSheetByName("Articles").appendRow([Utilities.getUuid(), data.title, data.body, data.date || new Date(), "Published"]);
  }
  return renderJson({ success: true });
}

function sendGoogleChatNotification(data) {
  if (!GOOGLE_CHAT_WEBHOOK || GOOGLE_CHAT_WEBHOOK.startsWith("YOUR")) return;
  const payload = {
    "cardsV2": [{
      "cardId": "portfolioInquiry",
      "card": {
        "header": { "title": "🌸 New Portfolio Engagement", "subtitle": "From: " + data.name },
        "sections": [{
          "header": "Submission Metadata",
          "widgets": [
            { "textParagraph": { "text": "<b>Classification:</b> " + data.type } },
            { "textParagraph": { "text": "<b>Communication:</b><br>" + data.message } },
            { "textParagraph": { "text": data.appointmentDate ? "📆 <b>Requested Slot:</b> " + data.appointmentDate : "☕ No calendar slot booked." } }
          ]
        }]
      }
    }]
  };
  UrlFetchApp.fetch(GOOGLE_CHAT_WEBHOOK, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload)
  });
}

function createCalendarAppointment(data) {
  try {
    const calendar = CalendarApp.getDefaultCalendar();
    const startTime = new Date(data.appointmentDate);
    const endTime = new Date(startTime.getTime() + (45 * 60 * 1000));
    calendar.createEvent(
      "💼 Portfolio Session: " + data.name + " (" + data.type + ")",
      startTime,
      endTime,
      { description: "Automated event entry via digital portfolio contact panel.\nMessage: " + data.message }
    );
  } catch(e) { Logger.log("Calendar slot allocation anomaly: " + e); }
}

function sendGmailAutoReply(data) {
  try {
    if (!data.email) return;
    const body = `Hello ${data.name},\n\nThank you for reaching out via my digital portfolio connection matrix. This notification confirms that your text regarding "${data.type}" has successfully cleared my ingestion queue.\n\nI review all items daily and will reach back out here if additional clarity is needed.\n\nWarm regards,\nElsa`;
    GmailApp.sendEmail(data.email, "✨ Re: Portfolio Consultation / Connection Acknowledgement", body, {
      name: "La YaungShin Thant Elsa"
    });
  } catch(e) { Logger.log("Gmail notification exception generated: " + e); }
}

function updateConfigValue(sheet, rows, key, value) {
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === key) {
      sheet.getRange(i + 1, 2).setValue(value);
      return;
    }
  }
  sheet.appendRow([key, value]);
}

function getSheetDataAsObj(sheet, keyColName, valueColName) {
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const kIdx = headers.indexOf(keyColName);
  const vIdx = headers.indexOf(valueColName);
  const obj = {};
  for(let i=1; i<data.length; i++) {
    if(data[i][kIdx]) obj[data[i][kIdx]] = data[i][vIdx];
  }
  return obj;
}

function getSheetRows(sheet) {
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const list = [];
  for(let i=1; i<data.length; i++) {
    const item = {};
    headers.forEach((h, idx) => { item[h] = data[i][idx]; });
    list.push(item);
  }
  return list;
}

function getActiveArticles(sheet) {
  const now = new Date().getTime();
  return getSheetRows(sheet).filter(a => {
    const publishDate = new Date(a.Date).getTime();
    return a.Status === "Published" && publishDate <= now;
  });
}

function getActiveTestimonials(sheet) {
  return getSheetRows(sheet).filter(t => t.Approved === true || t.Approved === "TRUE" || t.Approved === 1);
}

function renderJson(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

/* ═══════════════════════════════════════════════════════
   GLOBAL GOLD & FX MARKETS MODULE
   ─────────────────────────────────────────────────────
   Runs once a day on a time-driven trigger (see
   setupDailyMarketsTrigger / SETUP instructions). Writes
   live rates into the "Markets" tab. The site never calls
   any external API directly — it only ever reads this tab
   via doGet?action=init (or action=markets).

   Primary source : GoldAPI.io   (your paid/free-tier key)
   Fallback source: gold-api.com (free, no key, used only
                    if GoldAPI.io fails on a given run)
═══════════════════════════════════════════════════════ */
const GOLDAPI_KEY = "goldapi-44fdc10033143d349dfffdc247c4837c-io"; // from https://www.goldapi.io/dashboard
const MARKET_CURRENCIES = ["USD", "MMK", "SGD", "THB", "EUR"]; // one GoldAPI.io call per currency

/**
 * Public read action: GET ?action=markets
 * Lets the site (or you, for testing) fetch just the Markets tab.
 */
function getMarketsAction() {
  return renderJson({ markets: getSheetDataAsObj(getDb().getSheetByName("Markets"), "Key", "Value") });
}

/**
 * Entry point for the daily time-driven trigger.
 * Set this up once: Apps Script editor → Triggers (clock icon) →
 * Add Trigger → function: refreshMarketsDaily → Time-driven →
 * Day timer → pick an hour. See SETUP_GUIDE.md for click-by-click steps.
 */
function refreshMarketsDaily() {
  const db = getDb();
  const sheet = db.getSheetByName("Markets");
  if (!sheet) {
    Logger.log('No "Markets" tab found — create it first (see SETUP_GUIDE.md).');
    return;
  }

  const rates = {};
  let source = "none";

  // 1. Try GoldAPI.io first (your key)
  try {
    const goldapiRates = fetchFromGoldApiIo();
    if (goldapiRates) {
      Object.assign(rates, goldapiRates);
      source = "goldapi.io";
    }
  } catch (err) {
    Logger.log("GoldAPI.io fetch failed: " + err.message);
  }

  // 2. Fall back to the free no-key API only if GoldAPI.io gave us nothing
  if (Object.keys(rates).length === 0) {
    try {
      const fallbackRates = fetchFromFreeGoldApi();
      if (fallbackRates) {
        Object.assign(rates, fallbackRates);
        source = "gold-api.com (fallback)";
      }
    } catch (err) {
      Logger.log("Fallback gold-api.com fetch also failed: " + err.message);
    }
  }

  // 3. If both failed, leave the Sheet untouched — never overwrite good data with nothing.
  if (Object.keys(rates).length === 0) {
    Logger.log("Both gold sources failed today — Markets tab left unchanged.");
    return;
  }

  // 4. Also refresh FX cross-rates (USD/MMK, USD/SGD, etc.) — independent of gold.
  try {
    const fx = fetchFxRates();
    if (fx) Object.assign(rates, fx);
  } catch (err) {
    Logger.log("FX fetch failed: " + err.message);
  }

  rates["last_updated"] = new Date().toISOString();
  rates["source"] = source;

  writeMarketsToSheet(sheet, rates);
  Logger.log("Markets tab refreshed from: " + source);
}

/**
 * GoldAPI.io — one call per currency (XAU/USD, XAU/MMK, etc.)
 * Docs: https://www.goldapi.io/dashboard
 */
function fetchFromGoldApiIo() {
  if (!GOLDAPI_KEY || GOLDAPI_KEY.indexOf("PASTE_YOUR") === 0) {
    throw new Error("GOLDAPI_KEY not set");
  }
  const rates = {};
  let gotAny = false;

  MARKET_CURRENCIES.forEach(currency => {
    try {
      const res = UrlFetchApp.fetch("https://www.goldapi.io/api/XAU/" + currency, {
        method: "get",
        headers: {
          "x-access-token": GOLDAPI_KEY,
          "Content-Type": "application/json"
        },
        muteHttpExceptions: true
      });
      if (res.getResponseCode() !== 200) {
        Logger.log("GoldAPI.io " + currency + " returned HTTP " + res.getResponseCode());
        return;
      }
      const data = JSON.parse(res.getContentText());
      if (typeof data.price === "number") {
        rates["gold_spot_" + currency.toLowerCase()] = data.price;
        if (currency === "USD") {
          rates["gold_diff"] = (typeof data.chp === "number" ? (data.chp >= 0 ? "+" : "") + data.chp.toFixed(2) + "%" : "");
          rates["gold_prev_close_usd"] = data.prev_close_price || "";
        }
        gotAny = true;
      }
    } catch (err) {
      Logger.log("GoldAPI.io call for " + currency + " failed: " + err.message);
    }
  });

  return gotAny ? rates : null;
}

/**
 * Free fallback, no key required: https://gold-api.com
 * Only gives USD — other currencies get derived via FX rates separately.
 */
function fetchFromFreeGoldApi() {
  const res = UrlFetchApp.fetch("https://api.gold-api.com/price/XAU", { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) return null;
  const data = JSON.parse(res.getContentText());
  if (typeof data.price !== "number") return null;
  return { gold_spot_usd: data.price };
}

/**
 * FX cross-rates, free no-key API: https://open.er-api.com
 */
function fetchFxRates() {
  const res = UrlFetchApp.fetch("https://open.er-api.com/v6/latest/USD", { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) return null;
  const data = JSON.parse(res.getContentText());
  const r = data && data.rates;
  if (!r) return null;
  const fx = {};
  if (r.MMK) fx.usd_mmk = r.MMK;
  if (r.SGD) fx.usd_sgd = r.SGD;
  if (r.THB) fx.usd_thb = r.THB;
  if (r.EUR) fx.usd_eur = r.EUR;
  if (r.SGD && r.MMK) fx.sgd_mmk = r.MMK / r.SGD;
  return fx;
}

/**
 * Writes a flat {key: value} object into the Markets tab, updating
 * existing keys in place and appending any new ones.
 */
function writeMarketsToSheet(sheet, rates) {
  const existing = sheet.getDataRange().getValues();
  const keyToRow = {};
  for (let i = 1; i < existing.length; i++) {
    if (existing[i][0]) keyToRow[existing[i][0]] = i + 1; // 1-indexed sheet row
  }

  Object.keys(rates).forEach(key => {
    const value = rates[key];
    if (keyToRow[key]) {
      sheet.getRange(keyToRow[key], 2).setValue(value);
    } else {
      sheet.appendRow([key, value]);
    }
  });
}

/**
 * One-time helper: run this manually once from the Apps Script editor
 * (Run ▶ with this function selected) to create the Markets tab with
 * the right headers if it doesn't exist yet. Safe to re-run; it won't
 * duplicate the tab.
 */
function setupMarketsTab() {
  const db = getDb();
  let sheet = db.getSheetByName("Markets");
  if (!sheet) {
    sheet = db.insertSheet("Markets");
    sheet.appendRow(["Key", "Value"]);
    sheet.getRange(1, 1, 1, 2).setFontWeight("bold");
  }
  Logger.log('Markets tab ready. Now run "refreshMarketsDaily" once to populate it, ' +
    'then set up the daily trigger (see SETUP_GUIDE.md).');
}

/* ═══════════════════════════════════════════════════════
   MEDIA LIBRARY MODULE
   ─────────────────────────────────────────────────────
   Drop a PowerPoint, photo, slideshow, or video into the
   matching Drive subfolder and it appears on the site —
   no manual cataloguing needed. A daily trigger (same
   pattern as Markets) rescans all 7 section folders and
   caches the results into a "Media" tab. The site only
   ever reads that tab — it never talks to the Drive API
   directly from the browser.

   Folder structure expected inside ROOT_MEDIA_FOLDER_ID:
     Home / Journal / Vault / HR Suite / Compliance /
     Automation / Humanitarian Path

   Optional custom caption: rename the file in Drive to
   "Short Title — your caption here.ext" and the part after
   the em-dash (—) or double-hyphen (--) becomes the caption.
   Otherwise the caption is just the cleaned-up filename.
═══════════════════════════════════════════════════════ */
const ROOT_MEDIA_FOLDER_ID = "1-Hh7v9y2OqOhCkAP9uAKZh-hcFCnk3K4";
const MEDIA_SECTIONS = ["Home", "Journal", "Vault", "HR Suite", "Compliance", "Automation", "Humanitarian Path"];

/**
 * One-time helper: run this once from the Apps Script editor to create
 * the "Media" tab (if missing) and the 7 section subfolders inside your
 * chosen Drive root folder (if missing). Safe to re-run.
 */
function setupMediaLibrary() {
  // 1. Ensure the Media tab exists with the right headers
  const db = getDb();
  let sheet = db.getSheetByName("Media");
  if (!sheet) {
    sheet = db.insertSheet("Media");
    sheet.appendRow(["FileId", "Name", "Caption", "Section", "Type", "MimeType", "ViewUrl", "EmbedUrl", "ThumbnailUrl", "Modified"]);
    sheet.getRange(1, 1, 1, 10).setFontWeight("bold");
  }

  // 2. Ensure the root + 7 section subfolders exist
  if (!ROOT_MEDIA_FOLDER_ID || ROOT_MEDIA_FOLDER_ID.indexOf("PASTE_YOUR") === 0) {
    Logger.log('Set ROOT_MEDIA_FOLDER_ID first: create a folder in Drive, open it, ' +
      'copy the ID from the URL (the part after /folders/), paste it in, then re-run this.');
    return;
  }
  const root = DriveApp.getFolderById(ROOT_MEDIA_FOLDER_ID);
  MEDIA_SECTIONS.forEach(name => {
    const existing = root.getFoldersByName(name);
    if (!existing.hasNext()) {
      root.createFolder(name);
      Logger.log('Created subfolder: ' + name);
    }
  });

  Logger.log('Media library ready. Drop files into the section subfolders, then run ' +
    '"refreshMediaLibrary" once to scan them, and set up its daily trigger.');
}

/**
 * Entry point for the daily time-driven trigger (and the manual
 * "refresh_media" admin action). Scans all 7 section folders and
 * rewrites the Media tab from scratch — Drive is always the source
 * of truth, so a full rebuild each run keeps things simple and correct
 * (deleted files in Drive disappear from the site automatically too).
 */
function refreshMediaLibrary() {
  if (!ROOT_MEDIA_FOLDER_ID || ROOT_MEDIA_FOLDER_ID.indexOf("PASTE_YOUR") === 0) {
    Logger.log("ROOT_MEDIA_FOLDER_ID not set — run setupMediaLibrary() first.");
    return;
  }
  const db = getDb();
  const sheet = db.getSheetByName("Media");
  if (!sheet) {
    Logger.log('No "Media" tab found — run setupMediaLibrary() first.');
    return;
  }

  const root = DriveApp.getFolderById(ROOT_MEDIA_FOLDER_ID);
  const rows = [];

  MEDIA_SECTIONS.forEach(sectionName => {
    const folders = root.getFoldersByName(sectionName);
    if (!folders.hasNext()) return;
    const folder = folders.next();
    const files = folder.getFiles();

    while (files.hasNext()) {
      const file = files.next();
      try {
        rows.push(buildMediaRow(file, sectionName));
      } catch (err) {
        Logger.log("Skipped file '" + file.getName() + "': " + err.message);
      }
    }
  });

  // Wipe and rewrite (keeping the header row)
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clearContent();
  }
  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
  }

  Logger.log("Media library refreshed: " + rows.length + " files across " + MEDIA_SECTIONS.length + " sections.");
}

/**
 * Builds one row [FileId, Name, Caption, Section, Type, MimeType,
 * ViewUrl, EmbedUrl, ThumbnailUrl, Modified] for a single Drive file.
 */
function buildMediaRow(file, sectionName) {
  const id = file.getId();
  const rawName = file.getName();
  const mimeType = file.getMimeType();
  const modified = file.getLastUpdated().toISOString();

  // Custom caption support: "Short Title — caption text.ext" or "Title -- caption.ext"
  let displayName = rawName.replace(/\.[^/.]+$/, ""); // strip extension
  let caption = displayName;
  const splitMatch = displayName.split(/—|--/);
  if (splitMatch.length > 1) {
    displayName = splitMatch[0].trim();
    caption = splitMatch.slice(1).join("—").trim();
  }

  const type = classifyMediaType(mimeType);
  const viewUrl = "https://drive.google.com/file/d/" + id + "/view";
  const embedUrl = buildEmbedUrl(id, type, mimeType);
  const thumbnailUrl = "https://drive.google.com/thumbnail?id=" + id + "&sz=w800";

  return [id, displayName, caption, sectionName, type, mimeType, viewUrl, embedUrl, thumbnailUrl, modified];
}

function classifyMediaType(mimeType) {
  if (mimeType === "application/vnd.google-apps.presentation" ||
      mimeType === "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
      mimeType === "application/vnd.ms-powerpoint") {
    return "presentation";
  }
  if (mimeType.indexOf("video/") === 0 || mimeType === "application/vnd.google-apps.video") return "video";
  if (mimeType.indexOf("image/") === 0) return "image";
  if (mimeType === "application/pdf") return "pdf";
  return "other";
}

/**
 * Drive's embeddable preview URL works for PPTX, PDF, video, and images —
 * same /preview pattern regardless of type, which keeps the iframe logic
 * on the site simple.
 */
function buildEmbedUrl(id, type, mimeType) {
  if (type === "other") return null; // no good inline preview; site falls back to a download link
  return "https://drive.google.com/file/d/" + id + "/preview";
}
