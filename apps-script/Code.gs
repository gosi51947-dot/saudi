/**
 * Google Apps Script — نموذج المسح الميداني (اصدار الأعمدة المنفصلة)
 * ============================================
 * 1) تأكد من مسح صف العناوين القديم في جدول البيانات لتوليد العناوين الجديدة.
 * 2) استبدل SPREADSHEET_ID بمعرّف جدول البيانات.
 * 3) اضبط SHEET_NAME باسم التبويب.
 * 4) انشر: Deploy → New deployment → New version.
 */

var SPREADSHEET_ID = "14dRLB-LRf-s6nVm7UFw9TBimimOygEGjA8G-rbifONI";
var SHEET_NAME = "Sheet1";
var FORMS_SECRET = "";

var COLUMN_HEADERS = [
  "الوقت",
  "التاريخ الهجري",
  "الوردية",
  "المربع",
  "الحي",
  "نوع المبني",
  "اسم الفندق",
  "تفصيل المبني",
  "صورة 1",
  "صورة 2",
  "صورة 3",
  "صورة 4",
  "صورة 5",
  "فيديو الموقع",
  "الإحداثيات",
  "رقم عداد الكهرباء",
  "إجمالي المخالفين",
  "تفاصيل المخالفين (النوع والعدد)",
  "ملاحظات",
  "اسم المعد",
];

// خريطة ترجمة مفاتيح المخالفات للغة العربية
var VIOLATION_LABELS = {
  hajj_visa: "مخالف انظمة الحج (التأشيرات)",
  residence_outside: "مخالف نظام الاقامة (خارج مكة)",
  unknown_identity: "مجهول هوية",
  shelter_violator: "ايواء مخالف",
  covering_violator: "تستر على مخالف",
  transporter_violator: "ناقل مخالف",
  security_wanted: "مطلوب",
  criminal_case: "قضية جنائية",
  no_selection: "لا يوجد",
};

/**
 * doPost — استلام البيانات من النموذج
 */
function doPost(e) {
  try {
    if (!e.postData || !e.postData.contents) {
      return jsonResponse({ ok: false, error: "Empty body" });
    }

    var data = JSON.parse(e.postData.contents);

    if (FORMS_SECRET && data.secret !== FORMS_SECRET) {
      return jsonResponse({ ok: false, error: "Forbidden" });
    }

    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
      return jsonResponse({ ok: false, error: "Sheet not found" });
    }

    ensureHeaderRow(sheet);

    // ── تحليل روابط الصور (توقع ما يصل لـ 5 صور)
    var imageUrls = [];
    try {
      var parsed = JSON.parse(data.site_image_urls || "[]");
      if (Array.isArray(parsed)) {
        imageUrls = parsed.filter(function (u) {
          return !!u;
        });
      }
    } catch (ei) {}

    var videoUrl = (data.site_video_url || "").trim();
    var violRaw = data.violators_breakdown || data.violators_detail || "";
    var violText = parseViolationDetails(violRaw);

    // ── تجهيز بيانات الصف (إضافة فراغات لأعمدة الصور والفيديو)
    var row = [
      data.timestamp || new Date().toISOString(), // 1
      data.hijri_date || "", // 2
      data.shift || "", // 3
      data.square_zone || "", // 4
      data.hay || "", // 5
      data.building_type || "", // 6
      data.building_hotel || "", // 7
      data.building_other || "", // 8
      "",
      "",
      "",
      "",
      "", // 9, 10, 11, 12, 13 (خانات صور الموقع)
      "", // 14 (خانة الفيديو)
      data.coords || "", // 15
      data.meter_num || "", // 16
      data.violators || "", // 17
      violText, // 18
      data.notes || "", // 19
      data.meter_name || "", // 20
    ];

    sheet.appendRow(row);
    var lastRow = sheet.getLastRow();

    // ── تعيين روابط الصور بشكل منفصل في أعمدتها (9-13)
    for (var i = 0; i < 5; i++) {
      var col = 9 + i;
      if (imageUrls[i]) {
        setCellLink(sheet, lastRow, col, imageUrls[i], "عرض الصورة " + (i + 1));
      }
    }

    // ── تعيين رابط الفيديو في عموده الخاص (14)
    if (videoUrl) {
      setCellLink(sheet, lastRow, 14, videoUrl, "فتح الفيديو");
    }

    // ── تحويل الإحداثيات إلى رابط Google Maps (15)
    if (data.coords) {
      var coordsUrl = coordsToGoogleMapsLink(data.coords);
      if (coordsUrl) {
        setCellLink(sheet, lastRow, 15, coordsUrl, data.coords);
      }
    }

    applyRowStyling(sheet, lastRow);

    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err.message || err) });
  }
}

/**
 * تحويل الإحداثيات إلى رابط Google Maps
 * تتعامل مع صيغة: "26.2777371, 50.1830249"
 */
function coordsToGoogleMapsLink(coordsString) {
  try {
    if (!coordsString) return null;

    // إزالة المسافات وتنظيف النص
    var cleaned = coordsString.trim().replace(/[()]/g, "").trim();

    // فصل بين الإحداثيات
    var parts = cleaned.split(/[,;]/);
    if (parts.length < 2) return null;

    var lat = parseFloat(parts[0].trim());
    var lng = parseFloat(parts[1].trim());

    // التحقق من صحة الإحداثيات
    if (isNaN(lat) || isNaN(lng)) return null;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

    // إنشاء رابط Google Maps
    return "https://maps.google.com/?q=" + lat + "," + lng;
  } catch (e) {
    return null;
  }
}

/**
 * تعيين رابط تشعبي لخلية واحدة بدون استخدام صيغة HYPERLINK
 */
function setCellLink(sheet, row, col, url, label) {
  try {
    var richText = SpreadsheetApp.newRichTextValue()
      .setText(label)
      .setLinkUrl(0, label.length, url)
      .build();
    sheet.getRange(row, col).setRichTextValue(richText);
  } catch (e) {
    sheet.getRange(row, col).setValue(url);
  }
}

/**
 * تفاصيل المخالفين بالعربية
 */
function parseViolationDetails(violJsonString) {
  try {
    if (!violJsonString) return "";
    var violations = JSON.parse(violJsonString);
    if (!Array.isArray(violations) || violations.length === 0) return "";

    var lines = [];
    for (var i = 0; i < violations.length; i++) {
      var v = violations[i];
      var key = v.key || "";
      var label = VIOLATION_LABELS[key] || v.label || key;
      lines.push(label + ": " + (v.count || "0"));
    }
    return lines.join("\n");
  } catch (e) {
    return violJsonString || "";
  }
}

/**
 * التأكد من وجود صف العناوين وتنسيقه
 */
function ensureHeaderRow(sheet) {
  var firstCell = sheet.getRange(1, 1).getValue();
  if (firstCell === "" || firstCell === null) {
    sheet.getRange(1, 1, 1, COLUMN_HEADERS.length).setValues([COLUMN_HEADERS]);
    var r = sheet.getRange(1, 1, 1, COLUMN_HEADERS.length);
    r.setBackground("#1F4E78")
      .setFontColor("#FFFFFF")
      .setFontWeight("bold")
      .setHorizontalAlignment("center")
      .setVerticalAlignment("middle");
    sheet.setRowHeight(1, 40);
  }

  // ── تعيين اتجاه الورقة من اليمين لليسار (RTL)
  sheet.setRightToLeft(true);
}

/**
 * تنسيق الصف الجديد
 */
function applyRowStyling(sheet, rowNum) {
  var range = sheet.getRange(rowNum, 1, 1, COLUMN_HEADERS.length);
  range
    .setBackground(rowNum % 2 === 0 ? "#F0F0F0" : "#FFFFFF")
    .setFontColor("#333333")
    .setWrap(true)
    .setVerticalAlignment("middle");
  sheet.setRowHeight(rowNum, 60);
}

/**
 * إرجاع استجابة JSON
 */
function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
