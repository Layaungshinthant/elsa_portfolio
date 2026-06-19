/**
 * Dynamic Portfolio Engine v2.0
 * Fully integrated with Google Sheets, Google Calendar, and Google Chat.
 * Handles complete content management, scheduling, and notifications.
 */

const SPREADSHEET_ID = "1j7JIKgA78OC6Z0MhylnhJfZwVwZ3JBfq13H2P1pXt9k";
const ALLOWED_ORIGIN = "*";

/**
 * Automatically validates and builds the spreadsheet schema if tabs are missing.
 * Runs on every request so the user never has to manually configure table tabs.
 */
function initDatabase() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  const tables = {
    "Status": ["Location", "PhotoUrl"],
    "Journal": ["Title", "Body", "Date"],
    "Experience": ["Role", "Company", "Period", "Bullets"],
    "Skills": ["Icon", "Name", "Desc"],
    "Certs": ["Cert", "Detail", "Color"],
    "Slideshow": ["ImageUrl", "Caption"],
    "Inquiries": ["Name", "Email", "Type", "Message", "Date"],
    "Appointments": ["Name", "Email", "Type", "DateStr", "TimeStr", "Notes", "EventId"],
    "Settings": ["Key", "Value"]
  };

  for (let tabName in tables) {
    let sheet = ss.getSheetByName(tabName);
    if (!sheet) {
      sheet = ss.insertSheet(tabName);
      sheet.appendRow(tables[tabName]);
      // Format headers
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

/**
 * Handles incoming HTTP GET requests to fetch live portfolio contents.
 */
function doGet(e) {
  initDatabase();
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const action = e.parameter.action;

  try {
    if (action === "getAllData") {
      return makeJsonResponse({
        status: getTableData(ss, "Status")[0] || { location: "Yangon, Myanmar", photourl: "https://placehold.co/300x400/FDE8EF/C4637A?text=Elsa" },
        journal: getTableData(ss, "Journal").reverse(),
        experience: getTableData(ss, "Experience").reverse(),
        skills: getTableData(ss, "Skills"),
        certs: getTableData(ss, "Certs"),
        slideshow: getTableData(ss, "Slideshow"),
        settings: getSettingsMap(ss),
        inquiries: getTableData(ss, "Inquiries"),
        appointments: getTableData(ss, "Appointments")
      });
    }
    return makeJsonResponse({ error: "Invalid action request parameter." });
  } catch (error) {
    return makeJsonResponse({ error: error.toString() });
  }
}

function getTableData(ss, tabName) {
  const sheet = ss.getSheetByName(tabName);
  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return [];
  const headers = rows[0].map(h => h.toString().toLowerCase().trim());
  const data = [];
  
  for (let i = 1; i < rows.length; i++) {
    let obj = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = rows[i][j];
    }
    data.push(obj);
  }
  return data;
}

function getSettingsMap(ss) {
  const data = getTableData(ss, "Settings");
  let map = {};
  data.forEach(item => {
    if (item.key) map[item.key] = item.value;
  });
  return map;
}

function doPost(e) {
  initDatabase();
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let payload;
  
  try {
    payload = JSON.parse(e.postData.contents);
  } catch (err) {
    payload = e.parameter;
  }

  const action = payload.action;

  try {
    if (action === "updateStatus") {
      const sheet = ss.getSheetByName("Status");
      if (sheet.getLastRow() > 1) {
        sheet.deleteRows(2, sheet.getLastRow() - 1);
      }
      sheet.appendRow([payload.location, payload.photoUrl]);
      return makeJsonResponse({ success: true });
    }

    if (action === "addJournal") {
      const sheet = ss.getSheetByName("Journal");
      const formattedDate = Utilities.formatDate(new Date(), "GMT+7", "MMM dd, yyyy");
      sheet.appendRow([payload.title, payload.body, formattedDate]);
      return makeJsonResponse({ success: true });
    }

    if (action === "addExperience") {
      const sheet = ss.getSheetByName("Experience");
      sheet.appendRow([payload.role, payload.company, payload.period, payload.bullets]);
      return makeJsonResponse({ success: true });
    }

    if (action === "deleteExperience") {
      const sheet = ss.getSheetByName("Experience");
      deleteRowByValue(sheet, 0, payload.role);
      return makeJsonResponse({ success: true });
    }

    if (action === "addSlideshow") {
      const sheet = ss.getSheetByName("Slideshow");
      sheet.appendRow([payload.imageUrl, payload.caption]);
      return makeJsonResponse({ success: true });
    }

    if (action === "deleteSlideshow") {
      const sheet = ss.getSheetByName("Slideshow");
      deleteRowByValue(sheet, 0, payload.imageUrl);
      return makeJsonResponse({ success: true });
    }

    if (action === "updateSettings") {
      const sheet = ss.getSheetByName("Settings");
      updateOrInsertSetting(sheet, "googleChatWebhook", payload.googleChatWebhook);
      updateOrInsertSetting(sheet, "calendarId", payload.calendarId || "primary");
      return makeJsonResponse({ success: true });
    }

    if (action === "submitInquiry") {
      const sheet = ss.getSheetByName("Inquiries");
      const dateStr = Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd HH:mm:ss");
      sheet.appendRow([payload.name, payload.email, payload.type, payload.message, dateStr]);
      
      // Dispatch Webhook notification
      sendGoogleChatNotification(ss, `🌸 *New Dynamic Portfolio Inquiry!*\n\n*From:* ${payload.name} (${payload.email})\n*Category:* ${payload.type}\n*Message:* "${payload.message}"\n\n_Time: ${dateStr}_`);
      return makeJsonResponse({ success: true });
    }

    if (action === "bookAppointment") {
      const sheet = ss.getSheetByName("Appointments");
      const settings = getSettingsMap(ss);
      const calendarId = settings.calendarId || "primary";
      
      let eventId = "";
      try {
        const calendar = CalendarApp.getCalendarById(calendarId) || CalendarApp.getDefaultCalendar();
        
        // Parse date and times
        const startDateTime = new Date(`${payload.dateStr}T${payload.timeStr}:00`);
        const endDateTime = new Date(startDateTime.getTime() + (60 * 60 * 1000)); // Standard 1-hour slot
        
        const event = calendar.createEvent(
          ` Elsa Portfolio Appointment: ${payload.name} (${payload.type})`,
          startDateTime,
          endDateTime,
          {
            description: `Auto-scheduled from Portfolio.\nClient Contact: ${payload.email}\nNotes: ${payload.notes}`,
            guests: payload.email,
            sendInvites: true
          }
        );
        eventId = event.getId();
      } catch (calErr) {
        Logger.log("Calendar creation error, continuing to record in sheet: " + calErr);
      }

      sheet.appendRow([payload.name, payload.email, payload.type, payload.dateStr, payload.timeStr, payload.notes, eventId]);
      
      // Dispatch Webhook notification
      sendGoogleChatNotification(ss, `📅 *New Portfolio Appointment Scheduled!*\n\n*Name:* ${payload.name}\n*Email:* ${payload.email}\n*Type:* ${payload.type}\n*Date:* ${payload.dateStr} at ${payload.timeStr}\n*Notes:* "${payload.notes}"\n\n_Event ID: ${eventId || "Failed to create in Calendar"}_`);
      return makeJsonResponse({ success: true });
    }

    return makeJsonResponse({ error: "Invalid Action POST dispatch type." });
  } catch (error) {
    return makeJsonResponse({ error: error.toString() });
  }
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

function deleteRowByValue(sheet, columnIndex, matchValue) {
  const rows = sheet.getDataRange().getValues();
  for (let i = rows.length - 1; i >= 1; i--) {
    if (rows[i][columnIndex] === matchValue) {
      sheet.deleteRow(i + 1);
    }
  }
}

/**
 * Triggers an incoming message card to any connected Google Chat space.
 */
function sendGoogleChatNotification(ss, textMessage) {
  try {
    const settings = getSettingsMap(ss);
    const webhookUrl = settings.googleChatWebhook;
    
    if (!webhookUrl || !webhookUrl.startsWith("http")) {
      Logger.log("No valid Google Chat space webhook URL configured in settings.");
      return;
    }

    const payload = {
      text: textMessage
    };

    UrlFetchApp.fetch(webhookUrl, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
  } catch (err) {
    Logger.log("Failed to deliver Google Chat notification: " + err);
  }
}
