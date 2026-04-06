(function () {
  var MAX_IMAGES = 5;
  var MAX_VIDEOS = 1;

  window.__surveyMedia = {
    siteImageUrls: [],
    siteVideoUrl: null,
  };

  function assertConfig() {
    if (!CONFIG.cloudName || !CONFIG.uploadPreset) {
      throw new Error("يرجى ضبط cloudName و uploadPreset في الإعدادات");
    }
  }

  function uploadEndpoint(resourceType) {
    var base = "https://api.cloudinary.com/v1_1/" + CONFIG.cloudName + "/upload";
    return resourceType === "video" ? base + "?resource_type=video" : base;
  }

  function uploadFile(file, resourceType) {
    assertConfig();
    var fd = new FormData();
    fd.append("file", file);
    fd.append("upload_preset", CONFIG.uploadPreset);
    var isVideo = resourceType === "video";
    return fetch(uploadEndpoint(isVideo ? "video" : "image"), {
      method: "POST",
      body: fd,
    }).then(function (res) {
      if (!res.ok) {
        return res.text().then(function (t) {
          throw new Error(t || res.statusText);
        });
      }
      return res.json();
    });
  }

  function setStatus(el, text, isError) {
    if (!el) return;
    el.textContent = text || "";
    el.classList.toggle("text-error", !!isError);
    el.classList.toggle("text-secondary", !isError);
  }

  function countFromState() {
    return {
      images: window.__surveyMedia.siteImageUrls.length,
      video: window.__surveyMedia.siteVideoUrl ? 1 : 0,
    };
  }

  /**
   * @param {File[]} files
   * @returns {string|null} error message in Arabic or null if ok
   */
  function validateNewFiles(files) {
    var c = countFromState();
    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      var isVid = f.type.indexOf("video/") === 0;
      var isImg = f.type.indexOf("image/") === 0;
      if (!isVid && !isImg) {
        return "يُسمح بالصور والفيديو فقط";
      }
      if (isVid) {
        c.video++;
        if (c.video > MAX_VIDEOS) {
          return "فيديو واحد كحد أقصى";
        }
      } else {
        c.images++;
        if (c.images > MAX_IMAGES) {
          return "حد أقصى 5 صور";
        }
      }
    }
    return null;
  }

  function renderImagePreviews() {
    var row = document.getElementById("site-images-row");
    var wrap = document.getElementById("site-preview-wrap");
    if (!row || !wrap) return;
    row.innerHTML = "";
    window.__surveyMedia.siteImageUrls.forEach(function (url, idx) {
      var div = document.createElement("div");
      div.className =
        "relative group w-24 h-24 rounded-lg overflow-hidden border border-outline-variant shrink-0";
      var img = document.createElement("img");
      img.className = "w-full h-full object-cover";
      img.alt = "";
      img.src = url;
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className =
        "absolute inset-0 bg-error/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white";
      btn.setAttribute("data-remove-image", String(idx));
      btn.innerHTML = '<span class="material-symbols-outlined text-sm">close</span>';
      div.appendChild(img);
      div.appendChild(btn);
      row.appendChild(div);
    });
    row.onclick = function (e) {
      var t = e.target.closest("[data-remove-image]");
      if (!t) return;
      var idx = parseInt(t.getAttribute("data-remove-image"), 10);
      if (!isNaN(idx)) {
        window.__surveyMedia.siteImageUrls.splice(idx, 1);
        renderImagePreviews();
        updatePreviewVisibility();
      }
    };
  }

  function renderVideoPreview() {
    var vwrap = document.getElementById("site-video-wrap");
    var vid = document.getElementById("site-preview-video");
    if (!vwrap || !vid) return;
    if (window.__surveyMedia.siteVideoUrl) {
      vid.src = window.__surveyMedia.siteVideoUrl;
      vwrap.classList.remove("hidden");
    } else {
      vid.removeAttribute("src");
      vwrap.classList.add("hidden");
    }
  }

  function updatePreviewVisibility() {
    var wrap = document.getElementById("site-preview-wrap");
    if (!wrap) return;
    var has =
      window.__surveyMedia.siteImageUrls.length > 0 || !!window.__surveyMedia.siteVideoUrl;
    wrap.classList.toggle("hidden", !has);
  }

  function resetSiteMediaUi() {
    window.__surveyMedia.siteImageUrls = [];
    window.__surveyMedia.siteVideoUrl = null;
    renderImagePreviews();
    renderVideoPreview();
    updatePreviewVisibility();
    var el = document.getElementById("site-status");
    if (el) {
      el.textContent = "";
      el.classList.remove("text-error");
      el.classList.add("text-secondary");
    }
  }
  window.__surveyMediaReset = resetSiteMediaUi;

  function processFiles(fileList) {
    var files = Array.prototype.slice.call(fileList || []);
    if (files.length === 0) return;
    var status = document.getElementById("site-status");
    var err = validateNewFiles(files);
    if (err) {
      setStatus(status, err, true);
      return;
    }
    setStatus(status, "جاري الرفع…", false);

    var uploads = [];
    files.forEach(function (file) {
      var isVid = file.type.indexOf("video/") === 0;
      uploads.push(
        uploadFile(file, isVid ? "video" : "image").then(function (data) {
          return { secure_url: data.secure_url, isVideo: isVid };
        })
      );
    });

    Promise.all(uploads)
      .then(function (results) {
        results.forEach(function (r) {
          if (r.isVideo) {
            window.__surveyMedia.siteVideoUrl = r.secure_url;
          } else {
            window.__surveyMedia.siteImageUrls.push(r.secure_url);
          }
        });
        renderImagePreviews();
        renderVideoPreview();
        updatePreviewVisibility();
        setStatus(status, "تم الرفع", false);
      })
      .catch(function (e) {
        setStatus(status, "فشل الرفع: " + (e.message || e), true);
      });
  }

  function initSiteZone() {
    var input = document.getElementById("site-input");
    var zone = document.getElementById("site-dropzone");
    var status = document.getElementById("site-status");
    var vidRemove = document.getElementById("site-video-remove");

    if (!input || !zone) return;

    zone.addEventListener("click", function () {
      input.click();
    });
    input.addEventListener("change", function () {
      if (input.files && input.files.length) {
        processFiles(input.files);
      }
      input.value = "";
    });

    ["dragenter", "dragover"].forEach(function (ev) {
      zone.addEventListener(ev, function (e) {
        e.preventDefault();
        e.stopPropagation();
      });
    });
    zone.addEventListener("drop", function (e) {
      e.preventDefault();
      if (e.dataTransfer.files && e.dataTransfer.files.length) {
        processFiles(e.dataTransfer.files);
      }
    });

    if (vidRemove) {
      vidRemove.addEventListener("click", function () {
        window.__surveyMedia.siteVideoUrl = null;
        renderVideoPreview();
        updatePreviewVisibility();
      });
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    initSiteZone();
  });
})();
