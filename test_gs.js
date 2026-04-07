
const VIOLATION_LABELS = {
  hajj_visa: "مخالف انظمة الحج (التأشيرات)",
  residence_outside: "مخالف نظام الاقامة (خارج مكة)",
  unknown_identity: "مجهول هوية",
  shelter_violator: "ايواء مخالف",
  covering_violator: "تستر على مخالف",
  transporter_violator: "ناقل مخالف",
  security_wanted: "مطلوب امني",
  other: "اخري",
};

function parseImageUrls(urlsJsonString) {
  try {
    if (!urlsJsonString || urlsJsonString === "[]") return "";
    var urls = JSON.parse(urlsJsonString);
    if (!Array.isArray(urls)) return urlsJsonString;
    if (urls.length === 0) return "";

    var links = [];
    for (var i = 0; i < urls.length; i++) {
      var url = urls[i];
      if (url) {
        links.push('=HYPERLINK("' + url + '", "صورة ' + (i + 1) + '")');
      }
    }
    return links.join("\n");
  } catch (e) {
    return urlsJsonString || "";
  }
}

function parseViolationDetails(violJsonString) {
  try {
    if (!violJsonString) return "";
    var violations = JSON.parse(violJsonString);
    if (!Array.isArray(violations) || violations.length === 0) return "";

    var detailed = [];
    for (var i = 0; i < violations.length; i++) {
      var v = violations[i];
      var key = v.key || "";
      var label = VIOLATION_LABELS[key] || v.label || key;
      if (key === "other" && v.label) {
        label = v.label;
      }
      var detail = label + ": " + (v.count || "0");
      detailed.push(detail);
    }
    return detailed.join("\n");
  } catch (e) {
    return violJsonString || "";
  }
}

// Test Image URLs
const imgs = '["http://img1.jpg", "http://img2.jpg"]';
console.log("Images Output:\n" + parseImageUrls(imgs));

// Test Violations
const viols = '[{"key":"security_wanted","count":22},{"key":"residence_outside","count":5},{"key":"other","label":"Custom Viol","count":1}]';
console.log("\nViolations Output:\n" + parseViolationDetails(viols));
