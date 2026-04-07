(function () {
  var MAX_IMAGES = 5;
  var MAX_VIDEOS = 1;

  window.__surveyMedia = {
    siteImages: [], // Now stores {url, publicId}
    siteVideo: null, // Now stores {url, publicId}
    // Legacy compatibility
    get siteImageUrls() {
      return this.siteImages.map(img => img.url);
    },
    get siteVideoUrl() {
      return this.siteVideo ? this.siteVideo.url : null;
    }
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

  // SECURITY NOTE: For production, consider implementing deletion via your backend server
  // as it requires API secrets that shouldn't be exposed in client-side code.
  // 
  // Alternative approach:
  // 1. Send deletion requests to your backend API
  // 2. Backend validates the request and calls Cloudinary's API
  // 3. This keeps API secrets secure on the server
  function deleteFromCloudinary(publicId, resourceType) {
    if (!CONFIG.cloudinaryApiKey || !CONFIG.cloudinaryApiSecret) {
      console.warn("Cloudinary API credentials not configured for deletion");
      return Promise.resolve();
    }

    try {
      // Generate timestamp
      var timestamp = Math.round(Date.now() / 1000);
      
      // Create signature for authentication using crypto-js
      var stringToSign = "public_id=" + publicId + "&timestamp=" + timestamp + CONFIG.cloudinaryApiSecret;
      var signature = CryptoJS.SHA1(stringToSign).toString();
      
      var formData = new FormData();
      formData.append('public_id', publicId);
      formData.append('timestamp', timestamp);
      formData.append('api_key', CONFIG.cloudinaryApiKey);
      formData.append('signature', signature);

      var deleteUrl = "https://api.cloudinary.com/v1_1/" + CONFIG.cloudName + "/image/destroy";
      if (resourceType === "video") {
        deleteUrl = "https://api.cloudinary.com/v1_1/" + CONFIG.cloudName + "/video/destroy";
      }

      return fetch(deleteUrl, {
        method: 'POST',
        body: formData
      })
      .then(function(response) {
        return response.json();
      })
      .then(function(data) {
        if (data.result === "ok") {
          console.log("Successfully deleted from Cloudinary:", publicId);
        } else {
          console.warn("Failed to delete from Cloudinary:", data);
        }
        return data;
      })
      .catch(function(error) {
        console.error("Error deleting from Cloudinary:", error);
        // Don't throw the error to prevent UI disruption
        return { result: "error", error: error.message };
      });
    } catch (error) {
      console.error("Error deleting from Cloudinary:", error);
      return Promise.resolve({ result: "error", error: error.message });
    }
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
      images: window.__surveyMedia.siteImages.length,
      video: window.__surveyMedia.siteVideo ? 1 : 0,
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
    window.__surveyMedia.siteImages.forEach(function (imageData, idx) {
      var div = document.createElement("div");
      div.className =
        "relative group w-24 h-24 rounded-lg overflow-hidden border border-outline-variant shrink-0";
      var img = document.createElement("img");
      img.className = "w-full h-full object-cover";
      img.alt = "";
      img.src = imageData.url;
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
        var imageData = window.__surveyMedia.siteImages[idx];
        // Remove from local state immediately for better UX
        window.__surveyMedia.siteImages.splice(idx, 1);
        renderImagePreviews();
        updatePreviewVisibility();
        
        // Delete from Cloudinary in the background
        if (imageData && imageData.publicId) {
          var status = document.getElementById("site-status");
          setStatus(status, "جاري حذف الصورة من التخزين السحابي...", false);
          
          deleteFromCloudinary(imageData.publicId, "image").then(function(result) {
            if (result.result === "ok") {
              setStatus(status, "تم حذف الصورة بنجاح", false);
              setTimeout(function() {
                setStatus(status, "", false);
              }, 2000);
            } else {
              console.warn("Failed to delete image from Cloudinary:", result);
            }
          }).catch(function(error) {
            console.error("Failed to delete image from Cloudinary:", error);
          });
        }
      }
    };
  }

  function renderVideoPreview() {
    var vwrap = document.getElementById("site-video-wrap");
    var vid = document.getElementById("site-preview-video");
    if (!vwrap || !vid) return;
    if (window.__surveyMedia.siteVideo && window.__surveyMedia.siteVideo.url) {
      vid.src = window.__surveyMedia.siteVideo.url;
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
      window.__surveyMedia.siteImages.length > 0 || !!window.__surveyMedia.siteVideo;
    wrap.classList.toggle("hidden", !has);
  }

  function resetSiteMediaUi() {
    // Clean up Cloudinary files before resetting
    var cleanupPromises = [];
    
    // Delete images from Cloudinary
    window.__surveyMedia.siteImages.forEach(function(imageData) {
      if (imageData.publicId) {
        cleanupPromises.push(deleteFromCloudinary(imageData.publicId, "image"));
      }
    });
    
    // Delete video from Cloudinary
    if (window.__surveyMedia.siteVideo && window.__surveyMedia.siteVideo.publicId) {
      cleanupPromises.push(deleteFromCloudinary(window.__surveyMedia.siteVideo.publicId, "video"));
    }
    
    // Reset the UI state
    window.__surveyMedia.siteImages = [];
    window.__surveyMedia.siteVideo = null;
    renderImagePreviews();
    renderVideoPreview();
    updatePreviewVisibility();
    var el = document.getElementById("site-status");
    if (el) {
      el.textContent = "";
      el.classList.remove("text-error");
      el.classList.add("text-secondary");
    }
    
    // Log cleanup results (optional)
    if (cleanupPromises.length > 0) {
      Promise.all(cleanupPromises).then(function() {
        console.log("Cloudinary cleanup completed");
      }).catch(function(error) {
        console.error("Some Cloudinary cleanup operations failed:", error);
      });
    }
  }
  // Function to reset UI without deleting from Cloudinary (for successful submissions)
  function resetSiteMediaUiOnly() {
    window.__surveyMedia.siteImages = [];
    window.__surveyMedia.siteVideo = null;
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
  window.__surveyMediaResetUiOnly = resetSiteMediaUiOnly;

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
          return { 
            url: data.secure_url, 
            publicId: data.public_id,
            isVideo: isVid 
          };
        })
      );
    });

    Promise.all(uploads)
      .then(function (results) {
        results.forEach(function (r) {
          if (r.isVideo) {
            window.__surveyMedia.siteVideo = {
              url: r.url,
              publicId: r.publicId
            };
          } else {
            window.__surveyMedia.siteImages.push({
              url: r.url,
              publicId: r.publicId
            });
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
        var videoData = window.__surveyMedia.siteVideo;
        // Remove from local state immediately for better UX
        window.__surveyMedia.siteVideo = null;
        renderVideoPreview();
        updatePreviewVisibility();
        
        // Delete from Cloudinary in the background
        if (videoData && videoData.publicId) {
          var status = document.getElementById("site-status");
          setStatus(status, "جاري حذف الفيديو من التخزين السحابي...", false);
          
          deleteFromCloudinary(videoData.publicId, "video").then(function(result) {
            if (result.result === "ok") {
              setStatus(status, "تم حذف الفيديو بنجاح", false);
              setTimeout(function() {
                setStatus(status, "", false);
              }, 2000);
            } else {
              console.warn("Failed to delete video from Cloudinary:", result);
            }
          }).catch(function(error) {
            console.error("Failed to delete video from Cloudinary:", error);
          });
        }
      });
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    initSiteZone();
  });
})();
