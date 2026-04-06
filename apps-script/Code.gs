/**
 * 1) Create a Google Sheet — use a new tab or new spreadsheet so column order matches COLUMN_HEADERS.
 * 2) Replace SPREADSHEET_ID with your spreadsheet ID (from the URL).
 * 3) Set SHEET_NAME to your tab name (default "Sheet1").
 * 4) Optionally set FORMS_SECRET and the same value in index.html CONFIG.formSecret.
 * 5) Deploy: Deploy → New deployment → Web app → Execute as: Me → Who has access: Anyone
 * 6) Copy the web app URL into index.html CONFIG.appsScriptUrl.
 *
 * Migration: If you used an older version with different columns, add a new sheet tab with the
 * headers below or create a new spreadsheet to avoid misaligned columns.
 */

var SPREADSHEET_ID = "YOUR_SPREADSHEET_ID_HERE";
var SHEET_NAME = "Sheet1";
/** Leave empty to disable; if set, client must send the same in JSON field "secret" */
var FORMS_SECRET = "";

var COLUMN_HEADERS = [
  "timestamp",
  "shift",
  "square_1",
  "square_1_other",
  "square_2",
  "square_2_other",
  "square_3",
  "square_3_other",
  "square_4",
  "square_4_other",
  "site_image_urls",
  "site_video_url",
  "coord_x",
  "coord_y",
  "meter_num",
  "violators",
  "hajj_1",
  "hajj_2",
  "notes",
];

function doPost(e) {
  try {
    if (!e.postData || !e.postData.contents) {
      return jsonResponse({ ok: false, error: "Empty body" });
    }
    var data = JSON.parse(e.postData.contents);
    if (FORMS_SECRET && data.secret !== FORMS_SECRET) {
      return jsonResponse({ ok: false, error: "Forbidden" });
    }

    var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
    if (!sheet) {
      return jsonResponse({ ok: false, error: "Sheet not found" });
    }

    ensureHeaderRow(sheet);

    var row = [
      data.timestamp || new Date().toISOString(),
      data.shift || "",
      data.hay || data.square_1 || "",
      data.square_1_other || "",
      data.square_2 || "",
      data.square_2_other || "",
      data.square_3 || "",
      data.square_3_other || "",
      data.square_4 || "",
      data.square_4_other || "",
      data.site_image_urls || "",
      data.site_video_url || "",
      data.coord_x || "",
      data.coord_y || "",
      data.meter_num || "",
      data.violators || "",
      data.hajj_1 || "",
      data.hajj_2 || "",
      data.notes || "",
    ];

    sheet.appendRow(row);
    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err.message || err) });
  }
}

function ensureHeaderRow(sheet) {
  var first = sheet.getRange(1, 1, 1, COLUMN_HEADERS.length).getValues()[0];
  var empty = first.every(function (c) {
    return c === "" || c === null;
  });
  if (empty) {
    sheet.getRange(1, 1, 1, COLUMN_HEADERS.length).setValues([COLUMN_HEADERS]);
  }
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
