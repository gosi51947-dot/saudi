(function () {
  var DRAFT_KEY = "survey_form_draft_v2";

  function $(id) {
    return document.getElementById(id);
  }

  function valTrim(id) {
    var el = $(id);
    return el && el.value != null ? String(el.value).trim() : "";
  }

  function isFiniteNumberString(s) {
    if (s === "" || s == null) return false;
    var n = parseFloat(String(s).replace(",", "."));
    return Number.isFinite(n);
  }

  function violatorsIsValid() {
    var el = $("violators");
    if (!el) return false;
    var raw = el.value;
    if (raw === "" || raw == null) return false;
    var n = typeof el.valueAsNumber === "number" && !isNaN(el.valueAsNumber) ? el.valueAsNumber : parseInt(String(raw), 10);
    return Number.isFinite(n) && n >= 0;
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

  function getActiveSquareIndex() {
    for (var i = 1; i <= 4; i++) {
      if (valTrim("square_" + i)) return i;
    }
    return 0;
  }

  function neighborhoodFinal() {
    var idx = getActiveSquareIndex();
    if (!idx) return "";
    var v = valTrim("square_" + idx);
    if (v === "أخرى") return valTrim("hay_other");
    return v;
  }

  function syncHayOtherWrap() {
    var wrap = $("hay_other_wrap");
    if (!wrap) return;
    var idx = getActiveSquareIndex();
    if (idx && valTrim("square_" + idx) === "أخرى") wrap.classList.remove("hidden");
    else wrap.classList.add("hidden");
  }

  function applySquareMutex(changedIndex) {
    var sel = $("square_" + changedIndex);
    if (!sel) return;
    var v = (sel.value || "").trim();
    if (!v) {
      var hoClear = $("hay_other");
      if (hoClear) hoClear.value = "";
      for (var j = 1; j <= 4; j++) {
        var s = $("square_" + j);
        if (s) s.disabled = false;
      }
      syncHayOtherWrap();
      updateSubmitButtonState();
      return;
    }
    for (var k = 1; k <= 4; k++) {
      var t = $("square_" + k);
      if (!t) continue;
      if (k === changedIndex) {
        t.disabled = false;
      } else {
        t.disabled = true;
        t.value = "";
      }
    }
    if (v !== "أخرى") {
      var hoN = $("hay_other");
      if (hoN) hoN.value = "";
    }
    syncHayOtherWrap();
    updateSubmitButtonState();
  }

  function bindHaySection() {
    for (var i = 1; i <= 4; i++) {
      (function (idx) {
        var el = $("square_" + idx);
        if (!el) return;
        el.addEventListener("change", function () {
          applySquareMutex(idx);
        });
      })(i);
    }
    var ho = $("hay_other");
    if (ho) ho.addEventListener("input", updateSubmitButtonState);
    syncHayOtherWrap();
  }

  function collectPayload() {
    var m = window.__surveyMedia || { siteImageUrls: [], siteVideoUrl: null };
    var hay = neighborhoodFinal();
    return {
      timestamp: new Date().toISOString(),
      shift: valTrim("shift"),
      hay: hay,
      square_1: hay,
      square_1_other: "",
      square_2: "",
      square_2_other: "",
      square_3: "",
      square_3_other: "",
      square_4: "",
      square_4_other: "",
      site_image_urls: JSON.stringify(m.siteImageUrls || []),
      site_video_url: m.siteVideoUrl || "",
      coord_x: valTrim("coord_x"),
      coord_y: valTrim("coord_y"),
      meter_num: valTrim("meter_num"),
      violators: valTrim("violators"),
      hajj_1: valTrim("hajj_1"),
      hajj_2: valTrim("hajj_2"),
      notes: valTrim("notes"),
      secret: typeof CONFIG !== "undefined" && CONFIG.formSecret ? CONFIG.formSecret : "",
    };
  }

  function validateFormFields() {
    if (!$("survey-form")) return "النموذج غير متوفر";

    if (!valTrim("shift")) return "يرجى إدخال الوردية";

    var active = getActiveSquareIndex();
    if (!active) return "يرجى اختيار الحي من أحد المربعات";
    var sv = valTrim("square_" + active);
    if (sv === "أخرى" && !valTrim("hay_other")) return "يرجى كتابة تفاصيل «أخرى»";

    if (!isFiniteNumberString(valTrim("coord_x"))) return "يرجى إدخال خط الطول (X) كرقم صالح";
    if (!isFiniteNumberString(valTrim("coord_y"))) return "يرجى إدخال خط العرض (Y) كرقم صالح";
    if (!valTrim("meter_num")) return "يرجى إدخال رقم عداد الكهرباء";
    if (!violatorsIsValid()) return "يرجى إدخال عدد المخالفين (رقم صحيح ٠ أو أكثر)";

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
      var hayVal = d.hay != null && String(d.hay).trim() !== "" ? String(d.hay).trim() : "";
      if (!hayVal && d.square_1) hayVal = String(d.square_1).trim();
      if (!hayVal) {
        for (var k = 1; k <= 4; k++) {
          var key = "square_" + k;
          if (d[key] == null || String(d[key]).trim() === "") continue;
          var xv = String(d[key]).trim();
          if (xv === "أخرى" && d[key + "_other"] != null && String(d[key + "_other"]).trim() !== "") {
            hayVal = String(d[key + "_other"]).trim();
          } else if (xv !== "أخرى") {
            hayVal = xv;
          }
          break;
        }
      }
      var loaded = false;
      for (var si = 1; si <= 4 && !loaded; si++) {
        var sEl = $("square_" + si);
        if (!sEl) continue;
        var opts = Array.prototype.slice.call(sEl.options).map(function (o) {
          return o.value;
        });
        for (var oi = 0; oi < opts.length; oi++) {
          var ov = opts[oi];
          if (!ov || ov === "أخرى") continue;
          if (ov === hayVal) {
            sEl.value = ov;
            applySquareMutex(si);
            loaded = true;
            break;
          }
        }
      }
      if (!loaded && hayVal) {
        for (var sj = 1; sj <= 4; sj++) {
          var sEl2 = $("square_" + sj);
          if (!sEl2) continue;
          var hasOther = Array.prototype.slice.call(sEl2.options).some(function (o) {
            return o.value === "أخرى";
          });
          if (hasOther) {
            sEl2.value = "أخرى";
            setv("hay_other", hayVal);
            applySquareMutex(sj);
            loaded = true;
            break;
          }
        }
      }
      setv("coord_x", d.coord_x);
      setv("coord_y", d.coord_y);
      setv("meter_num", d.meter_num);
      setv("violators", d.violators);
      setv("hajj_1", d.hajj_1);
      setv("hajj_2", d.hajj_2);
      setv("notes", d.notes);
      syncHayOtherWrap();
      updateSubmitButtonState();
    } catch (e) {}
  }

  document.addEventListener("DOMContentLoaded", function () {
    var form = $("survey-form");
    bindHaySection();
    loadDraft();
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
        for (var j = 1; j <= 4; j++) {
          var sq = $("square_" + j);
          if (sq) sq.disabled = false;
        }
        form.reset();
        var how = $("hay_other_wrap");
        if (how) how.classList.add("hidden");
        if (typeof window.__surveyMediaReset === "function") {
          window.__surveyMediaReset();
        }
        try {
          localStorage.removeItem(DRAFT_KEY);
        } catch (e) {}
        hideMessages();
        syncHayOtherWrap();
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
            for (var j = 1; j <= 4; j++) {
              var sq = $("square_" + j);
              if (sq) sq.disabled = false;
            }
            form.reset();
            var how = $("hay_other_wrap");
            if (how) how.classList.add("hidden");
            if (typeof window.__surveyMediaReset === "function") {
              window.__surveyMediaReset();
            }
            localStorage.removeItem(DRAFT_KEY);
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
