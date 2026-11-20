/**
 * Google Apps Script עבור שמירת עיר מועדפת למתקשרי yemot-weather-api.
 *
 * התקנה:
 * 1. פותחים https://script.google.com/ ויוצרים פרויקט חדש.
 * 2. מדביקים את הקובץ הזה ושומרים.
 * 3. מריצים פעם אחת את setup() ומאשרים הרשאות.
 * 4. ביומן הביצוע (Execution log) יופיעו קישור לגיליון וסוד API.
 * 5. פורסים כ-Web app: Execute as Me, Who has access: Anyone.
 * 6. מעתיקים את כתובת ה-Web app ל-GOOGLE_SHEETS_WEB_APP_URL ב-Vercel,
 *    ואת הסוד ל-GOOGLE_SHEETS_SECRET.
 */

function setup() {
  const props = PropertiesService.getScriptProperties();
  let spreadsheetId = props.getProperty("SPREADSHEET_ID");
  let spreadsheet;

  if (spreadsheetId) {
    spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  } else {
    spreadsheet = SpreadsheetApp.create("מאגר ערים מועדפות - שירות מזג אוויר");
    spreadsheetId = spreadsheet.getId();
    props.setProperty("SPREADSHEET_ID", spreadsheetId);
  }

  let sheet = spreadsheet.getSheetByName("Cities");
  if (!sheet) sheet = spreadsheet.insertSheet("Cities");
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["מספר טלפון", "עיר מועדפת", "עודכן בתאריך"]);
    sheet.setFrozenRows(1);
  }

  let secret = props.getProperty("API_SECRET");
  if (!secret) {
    secret = Utilities.getUuid() + Utilities.getUuid();
    props.setProperty("API_SECRET", secret);
  }

  Logger.log("SPREADSHEET_URL=" + spreadsheet.getUrl());
  Logger.log("API_SECRET=" + secret);
}

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    const props = PropertiesService.getScriptProperties();
    const expectedSecret = props.getProperty("API_SECRET");
    if (!expectedSecret || body.secret !== expectedSecret) {
      return json({ ok: false, error: "unauthorized" });
    }

    const phone = String(body.phone || "").replace(/[^0-9]/g, "");
    const action = String(body.action || "");
    if (phone.length < 7 || phone.length > 15) {
      return json({ ok: false, error: "invalid_phone" });
    }

    const spreadsheetId = props.getProperty("SPREADSHEET_ID");
    if (!spreadsheetId) return json({ ok: false, error: "not_setup" });

    const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    const sheet = spreadsheet.getSheetByName("Cities");
    if (!sheet) return json({ ok: false, error: "sheet_missing" });

    const lastRow = sheet.getLastRow();
    const rows = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, 3).getDisplayValues() : [];
    const foundIndex = rows.findIndex(row => String(row[0]) === phone);

    if (action === "get") {
      return json({ ok: true, town: foundIndex >= 0 ? rows[foundIndex][1] : "" });
    }

    if (action === "set") {
      const town = String(body.town || "").trim().replace(/[<>\r\n]/g, "").slice(0, 80);
      if (!town) return json({ ok: false, error: "invalid_town" });

      const values = [phone, town, new Date()];
      if (foundIndex >= 0) {
        sheet.getRange(foundIndex + 2, 1, 1, 3).setValues([values]);
      } else {
        sheet.appendRow(values);
      }
      return json({ ok: true, town: town });
    }

    return json({ ok: false, error: "unknown_action" });
  } catch (error) {
    return json({ ok: false, error: "server_error" });
  }
}

function json(value) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
