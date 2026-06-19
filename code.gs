/**
 * Google Apps Script Backend for La YaungShin Thant Elsa's Portfolio
 * File: code.gs
 * 
 * This script runs serverless inside Google Sheets and serves as a custom API
 * to dynamically read and write site data (Journal and Location Status) directly from the web.
 */

// Allow cross-origin requests from any website domain
const ALLOWED_ORIGIN = "*"; 

/**
 * doGet handles incoming HTTP GET requests.
 * Used by the website to read data securely from the spreadsheet database.
 * 
 * Parameters expected in URL query:
 *   - action: "getJournal" (returns all posts sorted newest first)
 *   - action: "getStatus"  (returns the most recent location status string)
 */
function doGet(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet();
  const action = e.parameter.action;
  
  let resultData = {};
  
  try {
    if (action === "getJournal") {
      const journalSheet = sheet.getSheetByName("Journal");
      if (!journalSheet) {
        throw new Error("Journal sheet tab not found. Make sure you created a tab named 'Journal'.");
      }
      
      const rows = journalSheet.getDataRange().getValues();
      const headers = rows[0]; // First row contains headers: Title, Body, Date
      const posts = [];
      
      // Map rows skipping header line
      for (let i = 1; i < rows.length; i++) {
        let post = {};
        for (let j = 0; j < headers.length; j++) {
          const key = headers[j].toString().toLowerCase().trim();
          post[key] = rows[i][j];
        }
        posts.push(post);
      }
      
      // Reverse to deliver newest posts first to the portfolio UI
      resultData = posts.reverse();
      
    } else if (action === "getStatus") {
      const statusSheet = sheet.getSheetByName("Status");
      if (!statusSheet) {
        throw new Error("Status sheet tab not found. Make sure you created a tab named 'Status'.");
      }
      
      const lastRow = statusSheet.getLastRow();
      if (lastRow > 1) {
        resultData = { location: statusSheet.getRange(lastRow, 1).getValue().toString() };
      } else {
        resultData = { location: "Yangon, Myanmar · Open to Opportunities" };
      }
    } else {
      resultData = { error: "Unknown action parameter specified." };
    }
  } catch (error) {
    resultData = { error: error.toString() };
  }

  // Pack the response securely into standard JSON format with explicit CORS headers
  return ContentService.createTextOutput(JSON.stringify(resultData))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeaders({
      'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
      'Access-Control-Allow-Methods': 'GET'
    });
}

/**
 * doPost handles incoming HTTP POST requests.
 * Triggered securely by the portfolio's Admin dashboard to update data.
 * 
 * Expects a raw JSON payload with:
 *   - action: "addJournal" (requires "title" and "body" fields)
 *   - action: "updateStatus" (requires "location" field)
 */
function doPost(e) {
  let response = { success: false };
  
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet();
    let payload;
    
    // Safety check to parse incoming string payloads correctly
    if (e.postData && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    } else {
      payload = e.parameter;
    }
    
    const action = payload.action;
    
    if (action === "addJournal") {
      const journalSheet = sheet.getSheetByName("Journal");
      if (!journalSheet) {
        throw new Error("Journal sheet tab not found.");
      }
      
      // Format current timestamp elegantly for your daily feed
      const formattedDate = Utilities.formatDate(new Date(), "GMT+7", "MMM dd, yyyy");
      
      // Append row to the bottom of the Sheet
      journalSheet.appendRow([payload.title, payload.body, formattedDate]);
      response.success = true;
      
    } else if (action === "updateStatus") {
      const statusSheet = sheet.getSheetByName("Status");
      if (!statusSheet) {
        throw new Error("Status sheet tab not found.");
      }
      
      // Clear old rows under headers to keep database lightweight
      if (statusSheet.getLastRow() > 1) {
        statusSheet.deleteRows(2, statusSheet.getLastRow() - 1);
      }
      
      statusSheet.appendRow([payload.location]);
      response.success = true;
    } else {
      response.error = "Unknown action or parameters in POST request payload.";
    }
  } catch (error) {
    response.error = error.toString();
  }
  
  // Respond safely to bypass cross-domain preflight blocks (no-cors mode friendly)
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeaders({
      'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
      'Access-Control-Allow-Methods': 'POST'
    });
}
