/**
 * Dynamic Portfolio Engine v3.0 - Enhanced Edition
 * Implements Analytics, Newsletter, Automation, and Media Management.
 */

const SPREADSHEET_ID = "1j7JIKgA78OC6Z0MhylnhJfZwVwZ3JBfq13H2P1pXt9k";
const ALLOWED_ORIGIN = "*";

function initDatabase() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  const tables = {
    "Status": ["Location", "PhotoUrl"],
    "Journal": ["Title", "Body", "Date", "Scheduled"],
    "Experience": ["Role", "Company", "Period", "Bullets"],
    "Skills": ["Icon", "Name", "Desc"],
    "Certs": ["Cert", "Detail", "Color"],
    "Slideshow": ["ImageUrl", "Caption"],
    "Inquiries": ["Name", "Email", "Type", "Message", "Date"],
    "Appointments": ["Name", "Email", "Type", "DateStr", "TimeStr", "Notes", "EventId"],
    "Newsletter": ["Email", "Timestamp"],
    "Logs": ["EventName", "Metadata", "Timestamp"],
    "Downloads": ["FileName", "Url", "Description"],
    "Testimonials": ["Name", "Quote", "Source", "Date"],
    "Settings": ["Key", "Value"]
  };

  for (let tabName in tables) {
    let sheet = ss.getSheetByName(tabName);
    if (!sheet) {
      sheet = ss.insertSheet(tabName);
      sheet.appendRow(tables[tabName]);
      sheet.getRange(1, 1, 1, tables[tabName].length)
           .setFontWeight("bold")
           .setBackground("#FDE8EF")
           .setFontColor("#9E3D57");
    }
  }
}

function makeJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeaders({
      'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
}

function doGet(e) {
  initDatabase();
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const action = e.parameter.action;

  // 1. Analytics: Increment Visitor Counter
  const settingsSheet = ss.getSheetByName("Settings");
  let views = parseInt(getSettingsMap(ss).totalViews || 0) + 1;
  updateOrInsertSetting(settingsSheet, "totalViews", views);

  try {
    if (action === "getAllData") {
      // 2. Search/Filter Capability
      const query = e.parameter.search || "";
      const skills = getTableData(ss, "Skills");
      
      const filteredSkills = query ? skills.filter(s => 
        s.name.toLowerCase().includes(query.toLowerCase())
      ) : skills;

      return makeJsonResponse({
        status: getTableData(ss, "Status")[0],
        journal: getTableData(ss, "Journal").reverse(),
        experience: getTableData(ss, "Experience"),
        skills: filteredSkills,
        testimonials: getTableData(ss, "Testimonials"),
        downloads: getTableData(ss, "Downloads"),
        settings: getSettingsMap(ss),
        views: views
      });
    }
    return makeJsonResponse({ error: "Invalid action." });
  } catch (error) {
    return makeJsonResponse({ error: error.toString() });
  }
}

function doPost(e) {
  initDatabase();
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let payload = JSON.parse(e.postData.contents);
  const action = payload.action;

  try {
    // Analytics: Log Button Clicks
    if (action === "logEvent") {
      const sheet = ss.getSheetByName("Logs");
      sheet.appendRow([payload.event, payload.metadata, new Date()]);
      return makeJsonResponse({ success: true });
    }

    // Interaction: Newsletter
    if (action === "subscribe") {
      const sheet = ss.getSheetByName("Newsletter");
      sheet.appendRow([payload.email, new Date()]);
      return makeJsonResponse({ success: true });
    }

    // Automation: Inquiry + Auto-Responder
    if (action === "submitInquiry") {
      const sheet = ss.getSheetByName("Inquiries");
      const dateStr = new Date().toLocaleString();
      sheet.appendRow([payload.name, payload.email, payload.type, payload.message, dateStr]);
      
      // Auto-Responder Email
      MailApp.sendEmail({
        to: payload.email,
        subject: "Thanks for reaching out to La YaungShin Thant Elsa",
        body: `Hi ${payload.name},\n\nThank you for your interest! I have received your message regarding: ${payload.type}.\n\nI will review it and get back to you shortly.\n\nBest,\nLa YaungShin Thant Elsa`
      });

      sendGoogleChatNotification(ss, `🌸 *New Inquiry!*\n*From:* ${payload.name}\n*Message:* ${payload.message}`);
      return makeJsonResponse({ success: true });
    }

    // NEW: Journaling Automation
    if (action === "addJournalEntry") {
      const sheet = ss.getSheetByName("Journal");
      sheet.appendRow([payload.title, payload.body, new Date().toLocaleDateString(), payload.scheduled || "Draft"]);
      return makeJsonResponse({ success: true });
    }

    // Media: Testimonials
    if (action === "addTestimonial") {
      const sheet = ss.getSheetByName("Testimonials");
      sheet.appendRow([payload.name, payload.quote, payload.source, new Date()]);
      return makeJsonResponse({ success: true });
    }

    return makeJsonResponse({ error: "Invalid Action" });
  } catch (error) {
    return makeJsonResponse({ error: error.toString() });
  }
}

// --- Utilities ---

function getTableData(ss, tabName) {
  const sheet = ss.getSheetByName(tabName);
  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return [];
  const headers = rows[0].map(h => h.toString().toLowerCase().trim());
  return rows.slice(1).map(row => {
    let obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });
}

function getSettingsMap(ss) {
  const data = getTableData(ss, "Settings");
  let map = {};
  data.forEach(item => { if(item.key) map[item.key] = item.value; });
  return map;
}

function updateOrInsertSetting(sheet, key, value) {
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === key) {
      sheet.getRange(i + 1, 2).setValue(value);
      return;
    }
  }
  sheet.appendRow([key, value]);
}

function sendGoogleChatNotification(ss, textMessage) {
  const settings = getSettingsMap(ss);
  if (!settings.googleChatWebhook) return;
  
  UrlFetchApp.fetch(settings.googleChatWebhook, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({ text: textMessage }),
    muteHttpExceptions: true
  });
}
