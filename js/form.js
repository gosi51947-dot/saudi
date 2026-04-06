(function () {
  var DRAFT_KEY = "survey_form_draft_v3";

  /** Preset hay options (excludes «اخري») — used to restore drafts with custom neighborhood names */
  var HAY_PRESET_VALUES = [
    "الرصيفة",
    "حوش بكر",
    "الاسكان",
    "الشوقية",
    "الهنداوية",
    "المنصور",
    "الخالدية",
    "الخالدية2",
    "السبهاني",
    "جرهم",
    "المحمدية",
  ];

  function isHayPresetValue(v) {
    var s = v != null ? String(v).trim() : "";
    if (!s) return false;
    for (var i = 0; i < HAY_PRESET_VALUES.length; i++) {
      if (HAY_PRESET_VALUES[i] === s) return true;
    }
    return false;
  }

  var VIOLATION_KEYS = [
    "hajj_visa",
    "residence_outside",
    "unknown_identity",
    "shelter_violator",
    "covering_violator",
    "transporter_violator",
    "security_wanted",
  ];

  function $(id) {
    return document.getElementById(id);
  }

  function valTrim(id) {
    var el = $(id);
    return el && el.value != null ? String(el.value).trim() : "";
  }

  function setHijriDateHidden() {
    var el = $("hijri_date");
    if (!el) return;
    try {
      var s = new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date());
      el.value = s;
    } catch (e1) {
      try {
        el.value = new Intl.DateTimeFormat("ar-SA-u-ca-islamic", {
          day: "numeric",
          month: "long",
          year: "numeric",
        }).format(new Date());
      } catch (e2) {
        el.value = "";
      }
    }
  }

  function showError(msg) {
    var el = $("form-global-error");
    var ok = $("form-global-success");
    if (ok) ok.classList.add("hidden");
    if (!el) return;
    el.textContent = msg;
    el.classList.remove("hidden");
  }

  function showSuccess(msg) {
    var el = $("form-global-success");
    var err = $("form-global-error");
    if (err) err.classList.add("hidden");
    if (!el) return;
    el.textContent = msg;
    el.classList.remove("hidden");
  }

  function hideMessages() {
    var el = $("form-global-error");
    var ok = $("form-global-success");
    if (el) el.classList.add("hidden");
    if (ok) ok.classList.add("hidden");
  }

  function setSubmitting(loading) {
    var btn = $("btn-submit");
    var label = $("submit-label");
    var icon = $("submit-icon");
    if (!btn) return;
    if (loading) {
      btn.disabled = true;
      btn.setAttribute("aria-disabled", "true");
    } else {
      updateSubmitButtonState();
    }
    if (label) label.textContent = loading ? "جاري الإرسال…" : "إرسال البيانات";
    if (icon) icon.textContent = loading ? "hourglass_empty" : "send";
  }

  function fieldsAreValid() {
    return validateFormFields() === null;
  }

  function updateSubmitButtonState() {
    var btn = $("btn-submit");
    if (!btn) return;
    var ok = fieldsAreValid();
    btn.disabled = !ok;
    if (btn.setAttribute) btn.setAttribute("aria-disabled", ok ? "false" : "true");
  }

  function syncBuildingOtherWrap() {
    var wrap = $("building_other_wrap");
    var sel = $("building_type");
    if (!wrap || !sel) return;
    if ((sel.value || "").trim() === "اخري") wrap.classList.remove("hidden");
    else wrap.classList.add("hidden");
  }

  function syncHayOtherWrap() {
    var wrap = $("hay_other_wrap");
    var sel = $("hay");
    if (!wrap || !sel) return;
    if ((sel.value || "").trim() === "اخري") wrap.classList.remove("hidden");
    else wrap.classList.add("hidden");
  }

  function syncViolationRow(key) {
    var cb = $("viol_cb_" + key);
    var wrap = $("viol_num_wrap_" + key);
    var num = $("viol_num_" + key);
    if (!cb || !wrap) return;
    if (cb.checked) {
      wrap.classList.remove("hidden");
    } else {
      wrap.classList.add("hidden");
      if (num) num.value = "";
    }
  }

  function syncAllViolationRows() {
    for (var i = 0; i < VIOLATION_KEYS.length; i++) {
      syncViolationRow(VIOLATION_KEYS[i]);
    }
  }

  function bindBuildingType() {
    var sel = $("building_type");
    if (!sel) return;
    sel.addEventListener("change", function () {
      syncBuildingOtherWrap();
      updateSubmitButtonState();
    });
    var bo = $("building_other");
    if (bo) bo.addEventListener("input", updateSubmitButtonState);
    syncBuildingOtherWrap();
  }

  function bindHay() {
    var sel = $("hay");
    if (!sel) return;
    sel.addEventListener("change", function () {
      syncHayOtherWrap();
      updateSubmitButtonState();
    });
    var ho = $("hay_other");
    if (ho) ho.addEventListener("input", updateSubmitButtonState);
    syncHayOtherWrap();
  }

  function bindViolationSection() {
    for (var i = 0; i < VIOLATION_KEYS.length; i++) {
      (function (key) {
        var cb = $("viol_cb_" + key);
        if (!cb) return;
        cb.addEventListener("change", function () {
          syncViolationRow(key);
          updateSubmitButtonState();
        });
        var num = $("viol_num_" + key);
        if (num) num.addEventListener("input", updateSubmitButtonState);
      })(VIOLATION_KEYS[i]);
    }
    syncAllViolationRows();
  }

  function parseViolNum(key) {
    var cb = $("viol_cb_" + key);
    var numEl = $("viol_num_" + key);
    if (!cb || !cb.checked || !numEl) return null;
    var raw = numEl.value;
    if (raw === "" || raw == null) return null;
    var n = typeof numEl.valueAsNumber === "number" && !isNaN(numEl.valueAsNumber) ? numEl.valueAsNumber : parseInt(String(raw), 10);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }

  function collectViolationsPayload() {
    var list = [];
    var total = 0;
    for (var i = 0; i < VIOLATION_KEYS.length; i++) {
      var key = VIOLATION_KEYS[i];
      var cb = $("viol_cb_" + key);
      if (!cb || !cb.checked) continue;
      var n = parseViolNum(key);
      if (n === null) continue;
      list.push({ key: key, count: n });
      total += n;
    }
    return { list: list, total: total, json: JSON.stringify(list) };
  }

  function violationsValidationError() {
    for (var i = 0; i < VIOLATION_KEYS.length; i++) {
      var key = VIOLATION_KEYS[i];
      var cb = $("viol_cb_" + key);
      if (!cb || !cb.checked) continue;
      var n = parseViolNum(key);
      if (n === null) return "يرجى إدخال عدد صحيح (٠ أو أكثر) لكل نوع مخالفة تم تحديده";
    }
    return null;
  }

  function collectPayload() {
    var m = window.__surveyMedia || { siteImageUrls: [], siteVideoUrl: null };
    var haySelect = valTrim("hay");
    var hayVal = haySelect === "اخري" ? valTrim("hay_other") : haySelect;
    var squareZone = valTrim("square_zone");
    var buildingType = valTrim("building_type");
    var buildingOther = buildingType === "اخري" ? valTrim("building_other") : "";
    var viol = collectViolationsPayload();

    return {
      timestamp: new Date().toISOString(),
      hijri_date: valTrim("hijri_date"),
      shift: valTrim("shift"),
      square_zone: squareZone,
      hay: hayVal,
      building_type: buildingType,
      building_other: buildingOther,
      site_image_urls: JSON.stringify(m.siteImageUrls || []),
      site_video_url: m.siteVideoUrl || "",
      coords: valTrim("coords"),
      coord_x: "",
      coord_y: "",
      meter_num: valTrim("meter_num"),
      violators: String(viol.total),
      violators_breakdown: viol.json,
      violators_detail: viol.json,
      hajj_1: valTrim("hajj_1"),
      hajj_2: valTrim("hajj_2"),
      notes: valTrim("notes"),
      secret: typeof CONFIG !== "undefined" && CONFIG.formSecret ? CONFIG.formSecret : "",
    };
  }

  function validateFormFields() {
    if (!$("survey-form")) return "النموذج غير متوفر";

    if (!valTrim("shift")) return "يرجى اختيار الوردية";
    if (!valTrim("square_zone")) return "يرجى اختيار المربع";
    if (!valTrim("hay")) return "يرجى اختيار الحي";
    if (valTrim("hay") === "اخري" && !valTrim("hay_other")) return "يرجى كتابة اسم الحي";
    if (!valTrim("building_type")) return "يرجى اختيار نوع المبني";
    if (valTrim("building_type") === "اخري" && !valTrim("building_other")) return "يرجى كتابة تفصيل نوع المبني";

    if (!valTrim("coords")) return "يرجى إدخال الإحداثيات";
    if (!valTrim("meter_num")) return "يرجى إدخال رقم عداد الكهرباء";

    var vErr = violationsValidationError();
    if (vErr) return vErr;

    return null;
  }

  function validateConfig() {
    if (!CONFIG.appsScriptUrl) {
      return "يرجى ضبط appsScriptUrl في الإعدادات";
    }
    if (!CONFIG.cloudName || !CONFIG.uploadPreset) {
      return "يرجى ضبط Cloudinary في الإعدادات";
    }
    return null;
  }

  function submitToSheet(payload) {
    return fetch(CONFIG.appsScriptUrl, {
      method: "POST",
      mode: "cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    }).then(function (res) {
      return res.text().then(function (text) {
        var data;
        try {
          data = JSON.parse(text);
        } catch (e) {
          throw new Error(text || res.statusText);
        }
        if (!res.ok || data.ok === false) {
          throw new Error(data.error || res.statusText);
        }
        return data;
      });
    });
  }

  function saveDraft() {
    try {
      var payload = collectPayload();
      localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
      showSuccess("تم حفظ المسودة في هذا المتصفح.");
    } catch (e) {
      showError("تعذر حفظ المسودة.");
    }
  }

  function setCheckboxAndNumber(key, checked, countVal) {
    var cb = $("viol_cb_" + key);
    var num = $("viol_num_" + key);
    if (cb) {
      cb.checked = !!checked;
    }
    if (num && countVal != null && countVal !== "") {
      num.value = String(countVal);
    }
    syncViolationRow(key);
  }

  function loadDraft() {
    try {
      var raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      var d = JSON.parse(raw);
      if (!$("survey-form")) return;
      function setv(id, v) {
        if (v == null || v === "") return;
        var el = $(id);
        if (el) el.value = v;
      }
      setv("shift", d.shift);
      setv("square_zone", d.square_zone);
      setv("hay", d.hay);
      setv("building_type", d.building_type);
      setv("building_other", d.building_other);
      syncBuildingOtherWrap();
      syncHayOtherWrap();

      var coordsVal = d.coords;
      if (
        (coordsVal == null || String(coordsVal).trim() === "") &&
        (d.coord_x != null || d.coord_y != null)
      ) {
        var cx = d.coord_x != null ? String(d.coord_x).trim() : "";
        var cy = d.coord_y != null ? String(d.coord_y).trim() : "";
        coordsVal = [cx, cy].filter(function (x) {
          return x !== "";
        }).join(" ، ");
      }
      setv("coords", coordsVal);
      setv("meter_num", d.meter_num);
      setv("hajj_1", d.hajj_1);
      setv("hajj_2", d.hajj_2);
      setv("notes", d.notes);
      setv("hijri_date", d.hijri_date);

      var breakdown = d.violators_breakdown || d.violators_detail;
      if (breakdown) {
        try {
          var arr = typeof breakdown === "string" ? JSON.parse(breakdown) : breakdown;
          if (Array.isArray(arr)) {
            for (var i = 0; i < VIOLATION_KEYS.length; i++) {
              setCheckboxAndNumber(VIOLATION_KEYS[i], false, "");
            }
            for (var j = 0; j < arr.length; j++) {
              var item = arr[j];
              if (item && item.key) {
                setCheckboxAndNumber(item.key, true, item.count);
              }
            }
          }
        } catch (e) {}
      } else if (d.violators != null && String(d.violators).trim() !== "") {
        /* legacy single count — ignore for new form */
      }

      syncAllViolationRows();
      updateSubmitButtonState();
    } catch (e) {}
  }

  function resetViolationUi() {
    for (var i = 0; i < VIOLATION_KEYS.length; i++) {
      var key = VIOLATION_KEYS[i];
      var cb = $("viol_cb_" + key);
      var num = $("viol_num_" + key);
      if (cb) cb.checked = false;
      if (num) num.value = "";
      syncViolationRow(key);
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    setHijriDateHidden();
    var form = $("survey-form");
    bindBuildingType();
    bindHay();
    bindViolationSection();
    loadDraft();
    if (!$("hijri_date") || !valTrim("hijri_date")) {
      setHijriDateHidden();
    }
    updateSubmitButtonState();

    if (form) {
      form.addEventListener("input", updateSubmitButtonState);
      form.addEventListener("change", updateSubmitButtonState);
    }

    var draftBtn = $("btn-draft");
    if (draftBtn) draftBtn.addEventListener("click", saveDraft);

    var resetBtn = $("btn-reset");
    if (resetBtn && form) {
      resetBtn.addEventListener("click", function () {
        form.reset();
        resetViolationUi();
        var bow = $("building_other_wrap");
        if (bow) bow.classList.add("hidden");
        if (typeof window.__surveyMediaReset === "function") {
          window.__surveyMediaReset();
        }
        try {
          localStorage.removeItem(DRAFT_KEY);
        } catch (e) {}
        hideMessages();
        setHijriDateHidden();
        syncBuildingOtherWrap();
        syncHayOtherWrap();
        syncAllViolationRows();
        updateSubmitButtonState();
      });
    }

    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var cfgErr = validateConfig();
        if (cfgErr) {
          showError(cfgErr);
          return;
        }
        var fieldErr = validateFormFields();
        if (fieldErr) {
          showError(fieldErr);
          return;
        }
        hideMessages();
        var payload = collectPayload();
        setSubmitting(true);
        submitToSheet(payload)
          .then(function () {
            showSuccess("تم إرسال البيانات بنجاح. شكراً لك.");
            form.reset();
            resetViolationUi();
            var bow = $("building_other_wrap");
            if (bow) bow.classList.add("hidden");
            var how = $("hay_other_wrap");
            if (how) how.classList.add("hidden");
            if (typeof window.__surveyMediaReset === "function") {
              window.__surveyMediaReset();
            }
            localStorage.removeItem(DRAFT_KEY);
            setHijriDateHidden();
            syncBuildingOtherWrap();
            syncHayOtherWrap();
            syncAllViolationRows();
            updateSubmitButtonState();
          })
          .catch(function (err) {
            showError("فشل الإرسال: " + (err.message || err));
          })
          .finally(function () {
            setSubmitting(false);
          });
      });
    }
  });
})();
