(function () {
  "use strict";

  var activeCreator = null;
  var editingPostId = null;

  function setUploadStatus(el, message, state) {
    if (!el) return;
    el.textContent = message || "";
    el.classList.remove("is-busy", "is-error", "is-ok");
    if (state) el.classList.add(state);
  }

  function setImagePreview(wrapperId, imgId, url) {
    var wrap = document.getElementById(wrapperId);
    var img = document.getElementById(imgId);
    if (!wrap || !img) return;
    if (url) {
      img.src = url;
      wrap.hidden = false;
    } else {
      img.removeAttribute("src");
      wrap.hidden = true;
    }
  }

  function uploadImageFile(file, kind, refId, refId2) {
    if (!window.CreatorImageUpload) {
      return Promise.reject(new Error("Upload module not loaded"));
    }
    return CreatorImageUpload.uploadCreatorImage(
      activeCreator.slug,
      file,
      kind,
      refId,
      refId2
    );
  }

  function setVideoPreview(wrapperId, videoId, url) {
    var wrap = document.getElementById(wrapperId);
    var vid = document.getElementById(videoId);
    if (!wrap || !vid) return;
    if (url) {
      vid.src = url;
      wrap.hidden = false;
    } else {
      vid.removeAttribute("src");
      wrap.hidden = true;
    }
  }

  function handleVideoFilePick(options) {
    var fileInput = options.fileInput;
    var file = fileInput && fileInput.files && fileInput.files[0];
    if (!file || !activeCreator) return;

    if (!file.type || !file.type.startsWith("video/")) {
      setUploadStatus(options.statusEl, "Please choose a video (MP4 or MOV).", "is-error");
      return;
    }
    if (file.size > 100 * 1024 * 1024) {
      setUploadStatus(options.statusEl, "Video must be under 100 MB.", "is-error");
      return;
    }

    var localPreview = URL.createObjectURL(file);
    setVideoPreview(options.previewWrapId, options.previewVideoId, localPreview);
    setUploadStatus(options.statusEl, "Uploading video…", "is-busy");

    var tripId = options.tripId;
    var dayId = options.dayId;
    if (typeof tripId === "function") tripId = tripId();
    if (typeof dayId === "function") dayId = dayId();

    if (!window.CreatorImageUpload || !CreatorImageUpload.uploadCreatorVideo) {
      setUploadStatus(options.statusEl, "Upload module not loaded", "is-error");
      return;
    }

    CreatorImageUpload.uploadCreatorVideo(activeCreator.slug, file, tripId, dayId)
      .then(function (downloadUrl) {
        if (options.urlInput) options.urlInput.value = downloadUrl;
        setVideoPreview(options.previewWrapId, options.previewVideoId, downloadUrl);
        setUploadStatus(options.statusEl, "Video uploaded", "is-ok");
        URL.revokeObjectURL(localPreview);
      })
      .catch(function (err) {
        console.error(err);
        setUploadStatus(
          options.statusEl,
          (err && err.message) || "Upload failed — try again or paste a video URL.",
          "is-error"
        );
        notifySaved("Video upload failed");
      });
  }

  function handleImageFilePick(options) {
    var fileInput = options.fileInput;
    var file = fileInput && fileInput.files && fileInput.files[0];
    if (!file || !activeCreator) return;

    if (!file.type || !file.type.startsWith("image/")) {
      setUploadStatus(options.statusEl, "Please choose a photo (JPEG or PNG).", "is-error");
      return;
    }

    var localPreview = URL.createObjectURL(file);
    setImagePreview(options.previewWrapId, options.previewImgId, localPreview);
    setUploadStatus(options.statusEl, "Uploading photo…", "is-busy");

    var refId = options.postId || options.tripId;
    if (typeof refId === "function") {
      refId = refId();
    }
    var refId2 = options.dayId;
    if (typeof refId2 === "function") {
      refId2 = refId2();
    }

    uploadImageFile(file, options.kind, refId, refId2)
      .then(function (downloadUrl) {
        if (options.urlInput) {
          options.urlInput.value = downloadUrl;
        }
        setImagePreview(options.previewWrapId, options.previewImgId, downloadUrl);
        setUploadStatus(options.statusEl, "Photo uploaded", "is-ok");
        if (options.onUploaded) options.onUploaded(downloadUrl);
        URL.revokeObjectURL(localPreview);
      })
      .catch(function (err) {
        console.error(err);
        setUploadStatus(
          options.statusEl,
          "Upload failed — check connection or paste an image URL below.",
          "is-error"
        );
        notifySaved("Photo upload failed");
      });
  }

  function escapeHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  function parseTags(raw) {
    if (!raw) return [];
    return raw
      .split(",")
      .map(function (t) {
        return t.trim();
      })
      .filter(Boolean);
  }

  function formatTags(tags) {
    return (tags || []).join(", ");
  }

  function generatePostId(slug) {
    return slug + "-" + Date.now().toString(36);
  }

  function sortPosts(posts) {
    return (posts || [])
      .slice()
      .sort(function (a, b) {
        return String(b.publishedAt || "").localeCompare(String(a.publishedAt || ""));
      });
  }

  function notifySaved(message) {
    if (typeof window.showDashboardToast === "function") {
      window.showDashboardToast(message);
    }
  }

  function persistCreator() {
    if (!activeCreator) {
      return Promise.reject(new Error("No creator signed in"));
    }
    if (!window.CreatorPublicStore || !CreatorPublicStore.savePublicFields) {
      notifySaved("Save failed — Firebase scripts did not load. Re-upload creator-public-store.js");
      return Promise.reject(new Error("CreatorPublicStore missing"));
    }
    if (!window.TrekStakFirebaseConfig) {
      notifySaved("Save failed — firebase-config.js did not load");
      return Promise.reject(new Error("Firebase config missing"));
    }
    renderPostsList();
    renderTripsList();
    renderCityReviewsList();
    renderLiveTripUI();
    return CreatorPublicStore.savePublicFields(activeCreator)
      .then(function () {
        if (typeof window.onCreatorPublicUpdated === "function") {
          window.onCreatorPublicUpdated(activeCreator);
        }
      })
      .catch(function (err) {
        console.error(err);
        var msg = (err && err.message) || String(err);
        if (/permission|insufficient/i.test(msg)) {
          notifySaved("Cloud sync blocked — check Firestore rules + Anonymous Auth");
        } else if (/auth|network|Firebase/i.test(msg)) {
          notifySaved("Cloud sync failed — " + msg.slice(0, 80));
        } else {
          notifySaved("Saved on this device only — cloud sync failed");
        }
        throw err;
      });
  }

  function fillProfileForm(creator) {
    var bio = document.getElementById("profile-bio");
    var avatar = document.getElementById("profile-avatar");
    var ig = document.getElementById("profile-instagram");
    var tt = document.getElementById("profile-tiktok");
    var yt = document.getElementById("profile-youtube");
    var socials = creator.socials || {};

    if (bio) bio.value = creator.bio || "";
    if (avatar) avatar.value = creator.avatarUrl || "";
    if (ig) ig.value = socials.instagram || "";
    if (tt) tt.value = socials.tiktok || "";
    if (yt) yt.value = socials.youtube || "";
    setImagePreview("profile-avatar-preview", "profile-avatar-preview-img", creator.avatarUrl || "");
    setUploadStatus(document.getElementById("profile-avatar-status"), "", "");
  }

  function renderPostsList() {
    var listEl = document.getElementById("posts-list");
    if (!listEl || !activeCreator) return;

    var posts = sortPosts(activeCreator.posts);
    if (!posts.length) {
      listEl.innerHTML =
        '<p class="posts-empty">No posts yet. Add one to start your TrekStak mini-blog on your public page.</p>';
      return;
    }

    listEl.innerHTML = posts
      .map(function (post) {
        var statusClass = post.status === "draft" ? "draft" : "published";
        var statusLabel = post.status === "draft" ? "Draft" : "Live";
        return (
          '<article class="post-admin-card" data-post-id="' +
          escapeHtml(post.id) +
          '">' +
          '<div class="post-admin-head">' +
          "<div>" +
          "<strong>" +
          escapeHtml(post.title || "Untitled") +
          "</strong>" +
          '<span class="status-pill ' +
          statusClass +
          '">' +
          statusLabel +
          "</span>" +
          "</div>" +
          '<div class="post-admin-actions">' +
          '<button type="button" class="btn btn-outline btn-sm" data-action="edit">Edit</button>' +
          '<button type="button" class="btn btn-outline btn-sm" data-action="delete">Delete</button>' +
          "</div></div>" +
          '<p class="post-admin-meta">' +
          escapeHtml(post.publishedAt || "") +
          (post.tags && post.tags.length
            ? " · " + escapeHtml(post.tags.join(", "))
            : "") +
          "</p>" +
          '<p class="post-admin-preview">' +
          escapeHtml((post.body || "").slice(0, 140)) +
          ((post.body || "").length > 140 ? "…" : "") +
          "</p></article>"
        );
      })
      .join("");
  }

  function resetPostForm() {
    editingPostId = null;
    var editor = document.getElementById("post-editor");
    var title = document.getElementById("post-editor-title");
    var form = document.getElementById("post-form");
    if (title) title.textContent = "New post";
    if (form) form.reset();
    var postId = document.getElementById("post-id");
    if (postId) postId.value = "";
    var showCode = document.getElementById("post-show-code");
    if (showCode) showCode.checked = true;
    var status = document.getElementById("post-status");
    if (status) status.value = "published";
    if (editor) editor.hidden = true;
    setImagePreview("post-image-preview", "post-image-preview-img", "");
    setUploadStatus(document.getElementById("post-image-status"), "", "");
    var postFile = document.getElementById("post-image-file");
    if (postFile) postFile.value = "";
  }

  function openPostEditor(post) {
    var editor = document.getElementById("post-editor");
    var title = document.getElementById("post-editor-title");
    if (!editor) return;

    editingPostId = post ? post.id : generatePostId(activeCreator.slug);
    if (title) title.textContent = post ? "Edit post" : "New post";

    document.getElementById("post-id").value = editingPostId;
    document.getElementById("post-title").value = post ? post.title || "" : "";
    document.getElementById("post-body").value = post ? post.body || "" : "";
    document.getElementById("post-image").value = post ? post.imageUrl || "" : "";
    document.getElementById("post-image-alt").value = post ? post.imageAlt || "" : "";
    document.getElementById("post-cta").value = post
      ? post.ctaLabel || "Try it with my code"
      : "Try it with my code";
    document.getElementById("post-status").value = post ? post.status || "published" : "published";
    document.getElementById("post-tags").value = post ? formatTags(post.tags) : "";
    document.getElementById("post-show-code").checked = post
      ? post.showPromoCode !== false
      : true;

    setImagePreview("post-image-preview", "post-image-preview-img", post ? post.imageUrl || "" : "");
    setUploadStatus(document.getElementById("post-image-status"), "", "");

    editor.hidden = false;
    editor.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function handleProfileSubmit(event) {
    event.preventDefault();
    if (!activeCreator) return;

    activeCreator.bio = document.getElementById("profile-bio").value.trim();
    activeCreator.avatarUrl = document.getElementById("profile-avatar").value.trim();
    activeCreator.socials = {
      instagram: document.getElementById("profile-instagram").value.trim(),
      tiktok: document.getElementById("profile-tiktok").value.trim(),
      youtube: document.getElementById("profile-youtube").value.trim()
    };

    persistCreator()
      .then(function () {
        notifySaved("Profile saved — live on your public page");
        var note = document.getElementById("profile-save-note");
        if (note) {
          note.textContent = "Saved just now";
          window.setTimeout(function () {
            note.textContent = "";
          }, 3000);
        }
      })
      .catch(function () {
        /* toast already shown */
      });
  }

  function handlePostSubmit(event) {
    event.preventDefault();
    if (!activeCreator) return;

    var title = document.getElementById("post-title").value.trim();
    var body = document.getElementById("post-body").value.trim();
    if (!title || !body) {
      notifySaved("Title and body are required");
      return;
    }

    var postData = {
      id: document.getElementById("post-id").value || generatePostId(activeCreator.slug),
      status: document.getElementById("post-status").value,
      publishedAt: todayISO(),
      title: title,
      body: body,
      imageUrl: document.getElementById("post-image").value.trim(),
      imageAlt: document.getElementById("post-image-alt").value.trim(),
      ctaLabel: document.getElementById("post-cta").value.trim() || "Get TrekStak",
      showPromoCode: document.getElementById("post-show-code").checked,
      tags: parseTags(document.getElementById("post-tags").value)
    };

    if (!activeCreator.posts) activeCreator.posts = [];

    var existingIndex = -1;
    for (var i = 0; i < activeCreator.posts.length; i++) {
      if (activeCreator.posts[i].id === postData.id) {
        existingIndex = i;
        postData.publishedAt =
          activeCreator.posts[i].publishedAt || postData.publishedAt;
        break;
      }
    }

    if (existingIndex >= 0) {
      activeCreator.posts[existingIndex] = postData;
    } else {
      activeCreator.posts.unshift(postData);
    }

    persistCreator()
      .then(function () {
        notifySaved(existingIndex >= 0 ? "Post updated" : "Post published");
        resetPostForm();
      })
      .catch(function () {
        /* toast already shown */
      });
  }

  function deletePost(postId) {
    if (!activeCreator || !activeCreator.posts) return;
    if (!window.confirm("Delete this post? It will disappear from your public page.")) {
      return;
    }
    activeCreator.posts = activeCreator.posts.filter(function (p) {
      return p.id !== postId;
    });
    persistCreator()
      .then(function () {
        notifySaved("Post deleted");
      })
      .catch(function () {
        /* toast already shown */
      });
  }

  var trekstakCities = [];
  var trekstakCityNames = [];

  function loadTrekstakCities() {
    var urls = ["data/trekstak-cities.json?v=3", "trekstak-cities.json?v=3"];
    function tryUrl(i) {
      if (i >= urls.length) return Promise.resolve();
      return fetch(urls[i], { cache: "force-cache" })
        .then(function (res) {
          if (!res.ok) return tryUrl(i + 1);
          return res.json();
        })
        .then(function (data) {
          if (!data || !data.cities) return;
          trekstakCities = data.cities;
          trekstakCityNames = trekstakCities.map(function (c) {
            return c.name;
          });
          var list = document.getElementById("trekstak-city-list");
          if (!list) return;
          list.innerHTML = trekstakCityNames
            .map(function (name) {
              return "<option value=\"" + escapeHtml(name) + "\"></option>";
            })
            .join("");
        })
        .catch(function () {
          return tryUrl(i + 1);
        });
    }
    return tryUrl(0);
  }

  function findTrekstakCity(name) {
    var needle = String(name || "").trim().toLowerCase();
    if (!needle) return null;
    for (var i = 0; i < trekstakCities.length; i++) {
      if (String(trekstakCities[i].name).toLowerCase() === needle) {
        return trekstakCities[i];
      }
    }
    return null;
  }

  function updateTripCityHint() {
    updateCityMatchHint("trip-city", "trip-city-hint");
  }

  function updateCotwCityHint() {
    updateCityMatchHint("cotw-city", "cotw-city-hint");
  }

  function updateCityMatchHint(inputId, hintId) {
    var input = document.getElementById(inputId);
    var hint = document.getElementById(hintId);
    if (!input || !hint) return;
    var value = input.value.trim();
    if (!value || !trekstakCityNames.length) {
      hint.hidden = true;
      hint.textContent = "";
      return;
    }
    var match = findTrekstakCity(value);
    if (match) {
      hint.hidden = false;
      hint.classList.remove("field-hint--warn");
      var flag = match.flag ? match.flag + " " : "";
      hint.textContent = "TrekStak city · " + flag + match.country;
    } else {
      hint.hidden = false;
      hint.classList.add("field-hint--warn");
      hint.textContent =
        "Not in TrekStak yet — pick from the suggestions if you can, so followers can open that city in the app.";
    }
  }

  function tripFlagLabel(trip) {
    if (!trip) return "";
    if (trip.flag) return trip.flag;
    var match = findTrekstakCity(trip.city);
    return match && match.flag ? match.flag : "";
  }

  var TRIP_STATUS_LABEL = {
    upcoming: "Upcoming",
    currently: "There now",
    "just-back": "Just back"
  };

  var TRIP_STATUS_ORDER = {
    currently: 0,
    upcoming: 1,
    "just-back": 2
  };

  function sortTrips(trips) {
    return (trips || [])
      .slice()
      .sort(function (a, b) {
        var oa = TRIP_STATUS_ORDER[a.status] != null ? TRIP_STATUS_ORDER[a.status] : 9;
        var ob = TRIP_STATUS_ORDER[b.status] != null ? TRIP_STATUS_ORDER[b.status] : 9;
        if (oa !== ob) return oa - ob;
        return String(a.city || "").localeCompare(String(b.city || ""));
      });
  }

  function getTripFocusValues() {
    return Array.prototype.slice
      .call(document.querySelectorAll('input[name="trip-focus"]:checked'))
      .map(function (el) {
        return el.value;
      });
  }

  function setTripFocusValues(focus) {
    var selected = focus || [];
    document.querySelectorAll('input[name="trip-focus"]').forEach(function (el) {
      el.checked = selected.indexOf(el.value) !== -1;
    });
  }

  function renderTripsList() {
    var listEl = document.getElementById("trips-list");
    if (!listEl || !activeCreator) return;

    var trips = sortTrips(activeCreator.tripRadar);
    if (!trips.length) {
      listEl.innerHTML =
        '<p class="posts-empty">No trips yet. Add where you are headed so followers see it on your page.</p>';
      return;
    }

    listEl.innerHTML = trips
      .map(function (trip) {
        var status = trip.status || "upcoming";
        var statusLabel = TRIP_STATUS_LABEL[status] || status;
        var focus = trip.focus || [];
        return (
          '<article class="post-admin-card" data-trip-id="' +
          escapeHtml(trip.id) +
          '">' +
          '<div class="post-admin-head">' +
          "<div>" +
          (tripFlagLabel(trip)
            ? '<span class="trip-flag" aria-hidden="true">' +
              tripFlagLabel(trip) +
              "</span> "
            : "") +
          "<strong>" +
          escapeHtml(trip.city || "Trip") +
          "</strong>" +
          (trip.country
            ? '<span class="trip-country">' + escapeHtml(trip.country) + "</span>"
            : "") +
          '<span class="status-pill ' +
          escapeHtml(status) +
          '">' +
          escapeHtml(statusLabel) +
          "</span>" +
          "</div>" +
          '<div class="post-admin-actions">' +
          '<button type="button" class="btn btn-outline btn-sm" data-trip-action="edit">Edit</button>' +
          '<button type="button" class="btn btn-outline btn-sm" data-trip-action="delete">Delete</button>' +
          "</div></div>" +
          '<p class="post-admin-meta">' +
          escapeHtml(trip.when || "") +
          (focus.length ? " · " + escapeHtml(focus.join(", ")) : "") +
          "</p>" +
          (trip.why
            ? '<p class="post-admin-preview">' + escapeHtml(trip.why) + "</p>"
            : "") +
          "</article>"
        );
      })
      .join("");
  }

  function getCotwTipsFromForm() {
    var tips = [];
    for (var i = 1; i <= 5; i++) {
      var el = document.getElementById("cotw-tip-" + i);
      var text = el ? el.value.trim() : "";
      if (text) tips.push(text);
    }
    return tips;
  }

  function setCotwTipsOnForm(tips) {
    var list = Array.isArray(tips) ? tips : [];
    for (var i = 1; i <= 5; i++) {
      var el = document.getElementById("cotw-tip-" + i);
      if (el) el.value = list[i - 1] || "";
    }
  }

  function fillCityOfTheWeekForm(creator) {
    var pick = (creator && creator.cityOfTheWeek) || null;
    var city = document.getElementById("cotw-city");
    var intro = document.getElementById("cotw-intro");
    var photo = document.getElementById("cotw-photo");
    if (city) city.value = pick ? pick.city || "" : "";
    if (intro) intro.value = pick ? pick.intro || "" : "";
    if (photo) photo.value = pick ? pick.photoUrl || "" : "";
    setCotwTipsOnForm(pick ? pick.tips || [] : []);
    setImagePreview(
      "cotw-photo-preview",
      "cotw-photo-preview-img",
      pick ? pick.photoUrl || "" : ""
    );
    setUploadStatus(document.getElementById("cotw-photo-status"), "", "");
    updateCotwCityHint();
    var note = document.getElementById("cotw-save-note");
    if (note) note.textContent = "";
  }

  function handleCityOfTheWeekSubmit(event) {
    event.preventDefault();
    if (!activeCreator) return;

    var city = document.getElementById("cotw-city").value.trim();
    if (!city) {
      notifySaved("City is required");
      return;
    }

    var matched = findTrekstakCity(city);
    if (matched) {
      city = matched.name;
    }

    var tips = getCotwTipsFromForm();
    if (!tips.length) {
      notifySaved("Add at least one tip");
      return;
    }

    var photoUrl = document.getElementById("cotw-photo").value.trim();
    activeCreator.cityOfTheWeek = {
      city: city,
      country: matched ? matched.country || "" : "",
      flag: matched ? matched.flag || "" : "",
      inTrekstak: !!matched,
      photoUrl: photoUrl,
      intro: document.getElementById("cotw-intro").value.trim(),
      tips: tips,
      updatedAt: new Date().toISOString()
    };

    var note = document.getElementById("cotw-save-note");
    if (note) note.textContent = "Saving…";

    persistCreator()
      .then(function () {
        if (note) note.textContent = "Live on your page";
        notifySaved("City of the week updated");
      })
      .catch(function () {
        if (note) note.textContent = "Saved locally — cloud sync failed";
      });
  }

  function handleClearCityOfTheWeek() {
    if (!activeCreator) return;
    if (!window.confirm("Clear City of the week from your public page?")) return;
    activeCreator.cityOfTheWeek = null;
    fillCityOfTheWeekForm(activeCreator);
    persistCreator()
      .then(function () {
        notifySaved("City of the week cleared");
      })
      .catch(function () {
        /* toast already shown */
      });
  }

  var CITY_RATING_CATEGORIES = [
    { id: "food", label: "Food & markets" },
    { id: "culture", label: "Culture & museums" },
    { id: "nightlife", label: "Nightlife" },
    { id: "art", label: "Art & design" },
    { id: "outdoors", label: "Outdoors & nature" },
    { id: "family", label: "Family travel" },
    { id: "shopping", label: "Shopping" },
    { id: "romance", label: "Couples & romance" },
    { id: "vibe", label: "Atmosphere & vibe" },
    { id: "value", label: "Value / budget" },
    { id: "luxury", label: "Luxury & treat" },
    { id: "beach", label: "Beach & water" },
    { id: "custom", label: "Custom…" }
  ];

  function presetCategoryLabel(categoryId) {
    for (var i = 0; i < CITY_RATING_CATEGORIES.length; i++) {
      if (CITY_RATING_CATEGORIES[i].id === categoryId) {
        return CITY_RATING_CATEGORIES[i].label;
      }
    }
    return categoryId;
  }

  function starsDisplay(count) {
    var n = Math.max(0, Math.min(5, parseInt(count, 10) || 0));
    return "\u2605".repeat(n) + "\u2606".repeat(5 - n);
  }

  function updateCityReviewCityHint() {
    updateCityMatchHint("city-review-city", "city-review-city-hint");
  }

  function syncRatingRowCustomField(row) {
    if (!row) return;
    var select = row.querySelector(".city-review-category");
    var customWrap = row.querySelector(".city-review-custom-label");
    if (!select || !customWrap) return;
    customWrap.hidden = select.value !== "custom";
  }

  function syncAddRatingRowButton() {
    var btn = document.getElementById("btn-add-rating-row");
    var rows = document.querySelectorAll("#city-review-rating-rows .city-review-rating-row");
    if (btn) btn.disabled = rows.length >= 5;
  }

  function setStarPickerValue(row, stars) {
    var picker = row.querySelector(".star-picker");
    if (!picker) return;
    var value = parseInt(stars, 10) || 0;
    picker.querySelectorAll(".star-picker-btn").forEach(function (btn) {
      var star = parseInt(btn.getAttribute("data-star"), 10);
      btn.classList.toggle("is-active", star <= value && value > 0);
      btn.setAttribute("aria-pressed", star <= value && value > 0 ? "true" : "false");
    });
    picker.setAttribute("data-stars", String(value));
  }

  function buildRatingRowElement(data) {
    var row = document.createElement("div");
    row.className = "city-review-rating-row";

    var head = document.createElement("div");
    head.className = "city-review-rating-row-head";

    var select = document.createElement("select");
    select.className = "city-review-category";
    select.setAttribute("aria-label", "Category");
    CITY_RATING_CATEGORIES.forEach(function (cat) {
      var opt = document.createElement("option");
      opt.value = cat.id;
      opt.textContent = cat.label;
      select.appendChild(opt);
    });
    if (data && data.category) {
      select.value = data.category;
    }

    var removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "btn btn-outline btn-sm";
    removeBtn.textContent = "Remove";
    removeBtn.addEventListener("click", function () {
      row.remove();
      syncAddRatingRowButton();
    });

    head.appendChild(select);
    head.appendChild(removeBtn);
    row.appendChild(head);

    var customLabel = document.createElement("label");
    customLabel.className = "field field-full city-review-custom-label";
    customLabel.innerHTML =
      "<span>Custom category</span><input type=\"text\" class=\"city-review-custom-input\" maxlength=\"40\" placeholder=\"e.g. Street art\" />";
    row.appendChild(customLabel);

    var starsWrap = document.createElement("div");
    starsWrap.className = "field field-full";
    var starsLabel = document.createElement("span");
    starsLabel.textContent = "Stars";
    starsWrap.appendChild(starsLabel);

    var picker = document.createElement("div");
    picker.className = "star-picker";
    picker.setAttribute("role", "group");
    picker.setAttribute("aria-label", "Star rating");
    for (var s = 1; s <= 5; s++) {
      (function (star) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "star-picker-btn";
        btn.setAttribute("data-star", String(star));
        btn.setAttribute("aria-label", star + " star" + (star === 1 ? "" : "s"));
        btn.textContent = "\u2605";
        btn.addEventListener("click", function () {
          setStarPickerValue(row, star);
        });
        picker.appendChild(btn);
      })(s);
    }
    starsWrap.appendChild(picker);
    row.appendChild(starsWrap);

    var whyLabel = document.createElement("label");
    whyLabel.className = "field field-full";
    whyLabel.innerHTML =
      "<span>Why</span><input type=\"text\" class=\"city-review-why-input\" maxlength=\"200\" placeholder=\"What earned this score?\" />";
    row.appendChild(whyLabel);

    select.addEventListener("change", function () {
      syncRatingRowCustomField(row);
    });

    if (data) {
      if (data.category === "custom" && data.label) {
        var customInput = row.querySelector(".city-review-custom-input");
        if (customInput) customInput.value = data.label;
      }
      setStarPickerValue(row, data.stars || 0);
      var whyInput = row.querySelector(".city-review-why-input");
      if (whyInput) whyInput.value = data.why || "";
    }

    syncRatingRowCustomField(row);
    return row;
  }

  function clearRatingRows() {
    var container = document.getElementById("city-review-rating-rows");
    if (container) container.innerHTML = "";
    syncAddRatingRowButton();
  }

  function addRatingRow(data) {
    var container = document.getElementById("city-review-rating-rows");
    if (!container) return;
    var existing = container.querySelectorAll(".city-review-rating-row").length;
    if (existing >= 5) return;
    container.appendChild(buildRatingRowElement(data || null));
    syncAddRatingRowButton();
  }

  function setRatingRowsOnForm(ratings) {
    clearRatingRows();
    var list = Array.isArray(ratings) ? ratings : [];
    if (!list.length) {
      addRatingRow(null);
      return;
    }
    list.slice(0, 5).forEach(function (r) {
      addRatingRow(r);
    });
  }

  function readRatingRowsFromForm() {
    var rows = document.querySelectorAll("#city-review-rating-rows .city-review-rating-row");
    var results = [];
    var usedCategories = {};

    rows.forEach(function (row) {
      var select = row.querySelector(".city-review-category");
      var category = select ? select.value : "";
      if (!category) return;

      var stars = parseInt(
        (row.querySelector(".star-picker") || {}).getAttribute("data-stars") || "0",
        10
      );
      if (stars < 1 || stars > 5) return;

      var label = presetCategoryLabel(category);
      if (category === "custom") {
        var customInput = row.querySelector(".city-review-custom-input");
        label = customInput ? customInput.value.trim() : "";
        if (!label) return;
      }

      var dedupeKey = category === "custom" ? "custom:" + label.toLowerCase() : category;
      if (usedCategories[dedupeKey]) return;
      usedCategories[dedupeKey] = true;

      var whyInput = row.querySelector(".city-review-why-input");
      results.push({
        category: category,
        label: label,
        stars: stars,
        why: whyInput ? whyInput.value.trim() : ""
      });
    });

    return results.slice(0, 5);
  }

  function renderCityReviewsList() {
    var listEl = document.getElementById("city-reviews-list");
    if (!listEl || !activeCreator) return;

    var reviews = (activeCreator.cityReviews || []).slice().sort(function (a, b) {
      return String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
    });

    if (!reviews.length) {
      listEl.innerHTML =
        '<p class="posts-empty">No city reviews yet. Add how you rate a city on up to five categories.</p>';
      return;
    }

    listEl.innerHTML = reviews
      .map(function (review) {
        var ratingsPreview = (review.ratings || [])
          .map(function (r) {
            return (
              "<li><strong>" +
              escapeHtml(r.label) +
              "</strong> <span class=\"city-review-admin-stars\">" +
              starsDisplay(r.stars) +
              "</span>" +
              (r.why ? " — " + escapeHtml(r.why) : "") +
              "</li>"
            );
          })
          .join("");

        return (
          '<article class="post-admin-card" data-city-review-id="' +
          escapeHtml(review.id) +
          '">' +
          '<div class="post-admin-head">' +
          "<div>" +
          (review.flag
            ? '<span class="trip-flag" aria-hidden="true">' + review.flag + "</span> "
            : "") +
          "<strong>" +
          escapeHtml(review.city || "City") +
          "</strong>" +
          (review.country
            ? '<span class="trip-country">' + escapeHtml(review.country) + "</span>"
            : "") +
          "</div>" +
          '<div class="post-admin-actions">' +
          '<button type="button" class="btn btn-outline btn-sm" data-city-review-action="edit">Edit</button>' +
          '<button type="button" class="btn btn-outline btn-sm" data-city-review-action="delete">Delete</button>' +
          "</div></div>" +
          (ratingsPreview ? '<ul class="city-review-admin-list">' + ratingsPreview + "</ul>" : "") +
          "</article>"
        );
      })
      .join("");
  }

  function resetCityReviewEditor() {
    var editor = document.getElementById("city-review-editor");
    var title = document.getElementById("city-review-editor-title");
    var form = document.getElementById("city-review-form");
    if (title) title.textContent = "New city review";
    if (form) form.reset();
    var idField = document.getElementById("city-review-id");
    if (idField) idField.value = "";
    clearRatingRows();
    addRatingRow(null);
    updateCityReviewCityHint();
    if (editor) editor.hidden = true;
  }

  function openCityReviewEditor(review) {
    var editor = document.getElementById("city-review-editor");
    var title = document.getElementById("city-review-editor-title");
    if (!editor || !activeCreator) return;

    if (title) title.textContent = review ? "Edit city review" : "New city review";
    document.getElementById("city-review-id").value = review
      ? review.id
      : generatePostId(activeCreator.slug + "-review");
    document.getElementById("city-review-city").value = review ? review.city || "" : "";
    setRatingRowsOnForm(review ? review.ratings || [] : []);
    updateCityReviewCityHint();

    editor.hidden = false;
    editor.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function handleCityReviewSubmit(event) {
    event.preventDefault();
    if (!activeCreator) return;

    var city = document.getElementById("city-review-city").value.trim();
    if (!city) {
      notifySaved("City is required");
      return;
    }

    var ratings = readRatingRowsFromForm();
    if (!ratings.length) {
      notifySaved("Add at least one category with a star rating");
      return;
    }

    var matched = findTrekstakCity(city);
    if (matched) {
      city = matched.name;
    }

    var reviewData = {
      id:
        document.getElementById("city-review-id").value ||
        generatePostId(activeCreator.slug + "-review"),
      city: city,
      country: matched ? matched.country || "" : "",
      flag: matched ? matched.flag || "" : "",
      inTrekstak: !!matched,
      ratings: ratings,
      updatedAt: new Date().toISOString()
    };

    if (!activeCreator.cityReviews) activeCreator.cityReviews = [];

    var existingIndex = -1;
    for (var i = 0; i < activeCreator.cityReviews.length; i++) {
      if (activeCreator.cityReviews[i].id === reviewData.id) {
        existingIndex = i;
        break;
      }
    }

    if (existingIndex >= 0) {
      activeCreator.cityReviews[existingIndex] = reviewData;
    } else {
      activeCreator.cityReviews.unshift(reviewData);
    }

    persistCreator()
      .then(function () {
        notifySaved(existingIndex >= 0 ? "City review updated" : "City review added");
        resetCityReviewEditor();
      })
      .catch(function () {
        /* toast already shown */
      });
  }

  function deleteCityReview(reviewId) {
    if (!activeCreator || !activeCreator.cityReviews) return;
    if (!window.confirm("Remove this city review from your public page?")) return;
    activeCreator.cityReviews = activeCreator.cityReviews.filter(function (r) {
      return r.id !== reviewId;
    });
    persistCreator()
      .then(function () {
        notifySaved("City review removed");
      })
      .catch(function () {
        /* toast already shown */
      });
  }

  var LIVE_TRIP_STATUS_LABEL = {
    planning: "Planning",
    live: "Live now",
    wrapped: "Wrapped"
  };

  function updateLiveTripCityHint() {
    updateCityMatchHint("live-trip-city", "live-trip-city-hint");
  }

  function getLiveTripFromCreator() {
    return activeCreator && activeCreator.liveTrip ? activeCreator.liveTrip : null;
  }

  function ensureLiveTripId() {
    var field = document.getElementById("live-trip-id");
    if (field && field.value) return field.value;
    var id = generatePostId((activeCreator && activeCreator.slug) || "creator") + "-livetrip";
    if (field) field.value = id;
    return id;
  }

  function fillLiveTripShellForm(trip) {
    var t = trip || null;
    var idField = document.getElementById("live-trip-id");
    if (idField) idField.value = t ? t.id || "" : "";
    var title = document.getElementById("live-trip-title");
    if (title) title.value = t ? t.title || "" : "";
    var city = document.getElementById("live-trip-city");
    if (city) city.value = t ? t.city || "" : "";
    var start = document.getElementById("live-trip-start");
    if (start) start.value = t ? t.startDate || "" : "";
    var endDate = document.getElementById("live-trip-end-date");
    if (endDate) endDate.value = t ? t.endDate || "" : "";
    var hook = document.getElementById("live-trip-hook");
    if (hook) hook.value = t ? t.hook || "" : "";
    var cover = document.getElementById("live-trip-cover");
    if (cover) cover.value = t ? t.coverPhotoUrl || "" : "";
    setImagePreview(
      "live-trip-cover-preview",
      "live-trip-cover-preview-img",
      t ? t.coverPhotoUrl || "" : ""
    );
    setUploadStatus(document.getElementById("live-trip-cover-status"), "", "");
    updateLiveTripCityHint();
    var note = document.getElementById("live-trip-save-note");
    if (note) note.textContent = "";
  }

  function renderLiveTripStatusBar(trip) {
    var bar = document.getElementById("live-trip-status-bar");
    var pill = document.getElementById("live-trip-status-pill");
    var goLive = document.getElementById("btn-live-trip-go-live");
    var endBtn = document.getElementById("btn-live-trip-end");
    if (!bar || !trip) {
      if (bar) bar.hidden = true;
      return;
    }
    bar.hidden = false;
    var status = trip.status || "planning";
    if (pill) {
      pill.textContent = LIVE_TRIP_STATUS_LABEL[status] || status;
      pill.className = "status-pill " + status;
    }
    if (goLive) goLive.hidden = status === "live" || status === "wrapped";
    if (endBtn) endBtn.hidden = status !== "live";
  }

  function renderLiveTripDaysList() {
    var listEl = document.getElementById("live-trip-days-list");
    var trip = getLiveTripFromCreator();
    if (!listEl) return;

    if (!trip || !trip.days || !trip.days.length) {
      listEl.innerHTML =
        '<p class="posts-empty">No days yet — add today&rsquo;s update when you&rsquo;re ready.</p>';
      return;
    }

    var days = trip.days.slice().sort(function (a, b) {
      return a.dayNumber - b.dayNumber;
    });

    listEl.innerHTML = days
      .map(function (day) {
        var tagLine = (day.tags || []).length ? day.tags.join(", ") : "";
        return (
          '<article class="post-admin-card" data-live-trip-day-id="' +
          escapeHtml(day.id) +
          '">' +
          '<div class="post-admin-head">' +
          "<div><strong>Day " +
          escapeHtml(String(day.dayNumber)) +
          (day.label ? " · " + escapeHtml(day.label) : "") +
          "</strong></div>" +
          '<div class="post-admin-actions">' +
          '<button type="button" class="btn btn-outline btn-sm" data-live-trip-day-action="edit">Edit</button>' +
          '<button type="button" class="btn btn-outline btn-sm" data-live-trip-day-action="delete">Delete</button>' +
          "</div></div>" +
          '<p class="post-admin-meta">' +
          escapeHtml(day.headline || "") +
          (tagLine ? " · " + escapeHtml(tagLine) : "") +
          (day.videoUrl ? " · Video" : "") +
          "</p>" +
          (day.summary
            ? '<p class="post-admin-preview">' + escapeHtml(day.summary) + "</p>"
            : "") +
          "</article>"
        );
      })
      .join("");
  }

  function renderLiveTripUI() {
    var trip = getLiveTripFromCreator();
    var daysPanel = document.getElementById("live-trip-days-panel");
    var addDayBtn = document.getElementById("btn-add-live-trip-day");
    fillLiveTripShellForm(trip);
    renderLiveTripStatusBar(trip);
    if (daysPanel) daysPanel.hidden = !trip || trip.status === "wrapped";
    if (addDayBtn) {
      addDayBtn.hidden = !trip || trip.status === "wrapped";
    }
    if (trip && trip.status !== "wrapped") {
      renderLiveTripDaysList();
    } else if (document.getElementById("live-trip-days-list")) {
      document.getElementById("live-trip-days-list").innerHTML = "";
    }
  }

  function buildLiveTripShellFromForm(statusOverride) {
    var city = document.getElementById("live-trip-city").value.trim();
    var title = document.getElementById("live-trip-title").value.trim();
    if (!city || !title) return null;

    var matched = findTrekstakCity(city);
    if (matched) city = matched.name;

    var existing = getLiveTripFromCreator();
    var status = statusOverride || (existing && existing.status) || "planning";

    return {
      id: ensureLiveTripId(),
      title: title,
      city: city,
      country: matched ? matched.country || "" : existing ? existing.country || "" : "",
      flag: matched ? matched.flag || "" : existing ? existing.flag || "" : "",
      inTrekstak: !!matched,
      startDate: document.getElementById("live-trip-start").value.trim(),
      endDate: document.getElementById("live-trip-end-date").value.trim(),
      status: status,
      coverPhotoUrl: document.getElementById("live-trip-cover").value.trim(),
      hook: document.getElementById("live-trip-hook").value.trim(),
      days: existing && existing.days ? existing.days.slice() : [],
      updatedAt: new Date().toISOString()
    };
  }

  function handleLiveTripShellSubmit(event) {
    event.preventDefault();
    if (!activeCreator) return;

    var tripData = buildLiveTripShellFromForm();
    if (!tripData) {
      notifySaved("Trip title and city are required");
      return;
    }

    activeCreator.liveTrip = tripData;
    var note = document.getElementById("live-trip-save-note");
    if (note) note.textContent = "Saving…";

    persistCreator()
      .then(function () {
        if (note) note.textContent = "Trip saved";
        notifySaved("Live trip saved");
        renderLiveTripUI();
      })
      .catch(function () {
        if (note) note.textContent = "Save failed";
      });
  }

  function handleClearLiveTrip() {
    if (!activeCreator) return;
    if (!window.confirm("Remove this trip from your public page?")) return;
    activeCreator.liveTrip = null;
    resetLiveTripDayEditor();
    fillLiveTripShellForm(null);
    persistCreator()
      .then(function () {
        notifySaved("Live trip cleared");
        renderLiveTripUI();
      })
      .catch(function () {
        /* toast */
      });
  }

  function setLiveTripStatus(nextStatus) {
    if (!activeCreator) return;
    var tripData = buildLiveTripShellFromForm(nextStatus);
    if (!tripData) {
      notifySaved("Save trip details first (title + city)");
      return;
    }
    tripData.status = nextStatus;
    tripData.updatedAt = new Date().toISOString();
    activeCreator.liveTrip = tripData;
    persistCreator()
      .then(function () {
        notifySaved(
          nextStatus === "live"
            ? "Trip is live on your page"
            : nextStatus === "wrapped"
              ? "Trip marked as wrapped"
              : "Trip updated"
        );
        renderLiveTripUI();
      })
      .catch(function () {
        /* toast */
      });
  }

  function nextLiveTripDayNumber() {
    var trip = getLiveTripFromCreator();
    if (!trip || !trip.days || !trip.days.length) return 1;
    var max = 0;
    trip.days.forEach(function (d) {
      if (d.dayNumber > max) max = d.dayNumber;
    });
    return max + 1;
  }

  function getLiveTripDayTags() {
    return Array.prototype.slice
      .call(document.querySelectorAll('input[name="live-trip-tag"]:checked'))
      .map(function (el) {
        return el.value;
      })
      .slice(0, 3);
  }

  function setLiveTripDayTags(tags) {
    var wanted = tags || [];
    document.querySelectorAll('input[name="live-trip-tag"]').forEach(function (el) {
      el.checked = wanted.indexOf(el.value) >= 0;
    });
  }

  function resetLiveTripDayEditor() {
    var editor = document.getElementById("live-trip-day-editor");
    var form = document.getElementById("live-trip-day-form");
    if (form) form.reset();
    var dayId = document.getElementById("live-trip-day-id");
    if (dayId) dayId.value = "";
    var dayNum = document.getElementById("live-trip-day-number");
    if (dayNum) dayNum.value = "";
    setLiveTripDayTags([]);
    setImagePreview("live-trip-day-photo-preview", "live-trip-day-photo-preview-img", "");
    setVideoPreview("live-trip-day-video-preview", "live-trip-day-video-preview-vid", "");
    setUploadStatus(document.getElementById("live-trip-day-photo-status"), "", "");
    setUploadStatus(document.getElementById("live-trip-day-video-status"), "", "");
    if (editor) editor.hidden = true;
  }

  function openLiveTripDayEditor(day) {
    var editor = document.getElementById("live-trip-day-editor");
    var title = document.getElementById("live-trip-day-editor-title");
    if (!editor || !activeCreator || !getLiveTripFromCreator()) return;

    if (title) {
      title.textContent = day ? "Edit day update" : "Today\u2019s update";
    }

    var trip = getLiveTripFromCreator();
    var dayNumber = day ? day.dayNumber : nextLiveTripDayNumber();
    document.getElementById("live-trip-day-id").value = day
      ? day.id
      : generatePostId(trip.id + "-day");
    document.getElementById("live-trip-day-number").value = String(dayNumber);
    document.getElementById("live-trip-day-label").value = day
      ? day.label || "Day " + dayNumber
      : "Day " + dayNumber;
    document.getElementById("live-trip-day-headline").value = day ? day.headline || "" : "";
    document.getElementById("live-trip-day-summary").value = day ? day.summary || "" : "";
    document.getElementById("live-trip-day-photo").value = day ? day.photoUrl || "" : "";
    document.getElementById("live-trip-day-video").value = day ? day.videoUrl || "" : "";
    document.getElementById("live-trip-day-video-link").value = day ? day.videoLinkUrl || "" : "";
    setLiveTripDayTags(day ? day.tags || [] : []);
    setImagePreview(
      "live-trip-day-photo-preview",
      "live-trip-day-photo-preview-img",
      day ? day.photoUrl || "" : ""
    );
    setVideoPreview(
      "live-trip-day-video-preview",
      "live-trip-day-video-preview-vid",
      day ? day.videoUrl || "" : ""
    );

    editor.hidden = false;
    editor.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function handleLiveTripDaySubmit(event) {
    event.preventDefault();
    if (!activeCreator) return;
    var trip = getLiveTripFromCreator();
    if (!trip) {
      notifySaved("Save the trip shell first");
      return;
    }

    var headline = document.getElementById("live-trip-day-headline").value.trim();
    if (!headline) {
      notifySaved("Headline is required");
      return;
    }

    var dayData = {
      id: document.getElementById("live-trip-day-id").value,
      dayNumber: parseInt(document.getElementById("live-trip-day-number").value, 10) || 1,
      label: document.getElementById("live-trip-day-label").value.trim(),
      headline: headline,
      summary: document.getElementById("live-trip-day-summary").value.trim(),
      tags: getLiveTripDayTags(),
      photoUrl: document.getElementById("live-trip-day-photo").value.trim(),
      videoUrl: document.getElementById("live-trip-day-video").value.trim(),
      videoLinkUrl: document.getElementById("live-trip-day-video-link").value.trim(),
      publishedAt: new Date().toISOString()
    };

    if (!trip.days) trip.days = [];
    var idx = -1;
    for (var i = 0; i < trip.days.length; i++) {
      if (trip.days[i].id === dayData.id) {
        idx = i;
        break;
      }
    }
    if (idx >= 0) {
      trip.days[idx] = dayData;
    } else {
      trip.days.push(dayData);
    }
    trip.days.sort(function (a, b) {
      return a.dayNumber - b.dayNumber;
    });
    trip.updatedAt = new Date().toISOString();
    activeCreator.liveTrip = trip;

    persistCreator()
      .then(function () {
        notifySaved(idx >= 0 ? "Day updated" : "Day added");
        resetLiveTripDayEditor();
      })
      .catch(function () {
        /* toast */
      });
  }

  function deleteLiveTripDay(dayId) {
    var trip = getLiveTripFromCreator();
    if (!trip || !trip.days) return;
    if (!window.confirm("Remove this day from your trip?")) return;
    trip.days = trip.days.filter(function (d) {
      return d.id !== dayId;
    });
    trip.updatedAt = new Date().toISOString();
    activeCreator.liveTrip = trip;
    persistCreator()
      .then(function () {
        notifySaved("Day removed");
      })
      .catch(function () {
        /* toast */
      });
  }

  function resetTripForm() {
    var editor = document.getElementById("trip-editor");
    var title = document.getElementById("trip-editor-title");
    var form = document.getElementById("trip-form");
    if (title) title.textContent = "New trip";
    if (form) form.reset();
    var tripId = document.getElementById("trip-id");
    if (tripId) tripId.value = "";
    var status = document.getElementById("trip-status");
    if (status) status.value = "upcoming";
    setTripFocusValues([]);
    if (editor) editor.hidden = true;
  }

  function openTripEditor(trip) {
    var editor = document.getElementById("trip-editor");
    var title = document.getElementById("trip-editor-title");
    if (!editor || !activeCreator) return;

    if (title) title.textContent = trip ? "Edit trip" : "New trip";
    document.getElementById("trip-id").value = trip
      ? trip.id
      : generatePostId(activeCreator.slug + "-trip");
    document.getElementById("trip-city").value = trip ? trip.city || "" : "";
    document.getElementById("trip-when").value = trip ? trip.when || "" : "";
    document.getElementById("trip-why").value = trip ? trip.why || "" : "";
    document.getElementById("trip-status").value = trip ? trip.status || "upcoming" : "upcoming";
    setTripFocusValues(trip ? trip.focus || [] : []);
    updateTripCityHint();

    editor.hidden = false;
    editor.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function handleTripSubmit(event) {
    event.preventDefault();
    if (!activeCreator) return;

    var city = document.getElementById("trip-city").value.trim();
    var when = document.getElementById("trip-when").value.trim();
    if (!city || !when) {
      notifySaved("City and when are required");
      return;
    }

    var matched = findTrekstakCity(city);
    if (matched) {
      city = matched.name;
    }

    var tripData = {
      id: document.getElementById("trip-id").value || generatePostId(activeCreator.slug + "-trip"),
      city: city,
      when: when,
      why: document.getElementById("trip-why").value.trim(),
      status: document.getElementById("trip-status").value || "upcoming",
      focus: getTripFocusValues(),
      inTrekstak: !!matched,
      country: matched ? matched.country || "" : "",
      flag: matched ? matched.flag || "" : ""
    };

    if (!activeCreator.tripRadar) activeCreator.tripRadar = [];

    var existingIndex = -1;
    for (var i = 0; i < activeCreator.tripRadar.length; i++) {
      if (activeCreator.tripRadar[i].id === tripData.id) {
        existingIndex = i;
        break;
      }
    }

    if (existingIndex >= 0) {
      activeCreator.tripRadar[existingIndex] = tripData;
    } else {
      activeCreator.tripRadar.unshift(tripData);
    }

    persistCreator()
      .then(function () {
        notifySaved(existingIndex >= 0 ? "Trip updated" : "Trip added");
        resetTripForm();
      })
      .catch(function () {
        /* toast already shown */
      });
  }

  function deleteTrip(tripId) {
    if (!activeCreator || !activeCreator.tripRadar) return;
    if (!window.confirm("Remove this trip from your public page?")) {
      return;
    }
    activeCreator.tripRadar = activeCreator.tripRadar.filter(function (t) {
      return t.id !== tripId;
    });
    persistCreator()
      .then(function () {
        notifySaved("Trip removed");
      })
      .catch(function () {
        /* toast already shown */
      });
  }

  function bindEvents() {
    var profileForm = document.getElementById("profile-form");
    if (profileForm) {
      profileForm.addEventListener("submit", handleProfileSubmit);
    }

    var postForm = document.getElementById("post-form");
    if (postForm) {
      postForm.addEventListener("submit", handlePostSubmit);
    }

    var avatarFileInput = document.getElementById("profile-avatar-file");
    if (avatarFileInput) {
      avatarFileInput.addEventListener("change", function () {
        handleImageFilePick({
          fileInput: avatarFileInput,
          kind: "avatar",
          previewWrapId: "profile-avatar-preview",
          previewImgId: "profile-avatar-preview-img",
          urlInput: document.getElementById("profile-avatar"),
          statusEl: document.getElementById("profile-avatar-status")
        });
        avatarFileInput.value = "";
      });
    }

    var postFileInput = document.getElementById("post-image-file");
    if (postFileInput) {
      postFileInput.addEventListener("change", function () {
        var postIdField = document.getElementById("post-id");
        handleImageFilePick({
          fileInput: postFileInput,
          kind: "post",
          postId:
            (postIdField && postIdField.value) ||
            editingPostId ||
            (activeCreator ? generatePostId(activeCreator.slug) : "new"),
          previewWrapId: "post-image-preview",
          previewImgId: "post-image-preview-img",
          urlInput: document.getElementById("post-image"),
          statusEl: document.getElementById("post-image-status")
        });
        postFileInput.value = "";
      });
    }

    var newPostBtn = document.getElementById("btn-new-post");
    if (newPostBtn) {
      newPostBtn.addEventListener("click", function () {
        openPostEditor(null);
      });
    }

    var cancelPostBtn = document.getElementById("btn-cancel-post");
    if (cancelPostBtn) {
      cancelPostBtn.addEventListener("click", resetPostForm);
    }

    var tripForm = document.getElementById("trip-form");
    if (tripForm) {
      tripForm.addEventListener("submit", handleTripSubmit);
    }

    var tripCity = document.getElementById("trip-city");
    if (tripCity) {
      tripCity.addEventListener("input", updateTripCityHint);
      tripCity.addEventListener("change", updateTripCityHint);
      tripCity.addEventListener("blur", updateTripCityHint);
    }

    var cotwForm = document.getElementById("city-week-form");
    if (cotwForm) {
      cotwForm.addEventListener("submit", handleCityOfTheWeekSubmit);
    }

    var cotwCity = document.getElementById("cotw-city");
    if (cotwCity) {
      cotwCity.addEventListener("input", updateCotwCityHint);
      cotwCity.addEventListener("change", updateCotwCityHint);
      cotwCity.addEventListener("blur", updateCotwCityHint);
    }

    var cotwPhotoFile = document.getElementById("cotw-photo-file");
    if (cotwPhotoFile) {
      cotwPhotoFile.addEventListener("change", function () {
        handleImageFilePick({
          fileInput: cotwPhotoFile,
          kind: "cotw",
          previewWrapId: "cotw-photo-preview",
          previewImgId: "cotw-photo-preview-img",
          urlInput: document.getElementById("cotw-photo"),
          statusEl: document.getElementById("cotw-photo-status")
        });
        cotwPhotoFile.value = "";
      });
    }

    var clearCotwBtn = document.getElementById("btn-clear-cotw");
    if (clearCotwBtn) {
      clearCotwBtn.addEventListener("click", handleClearCityOfTheWeek);
    }

    var cityReviewForm = document.getElementById("city-review-form");
    if (cityReviewForm) {
      cityReviewForm.addEventListener("submit", handleCityReviewSubmit);
    }

    var cityReviewCity = document.getElementById("city-review-city");
    if (cityReviewCity) {
      cityReviewCity.addEventListener("input", updateCityReviewCityHint);
      cityReviewCity.addEventListener("change", updateCityReviewCityHint);
      cityReviewCity.addEventListener("blur", updateCityReviewCityHint);
    }

    var addRatingRowBtn = document.getElementById("btn-add-rating-row");
    if (addRatingRowBtn) {
      addRatingRowBtn.addEventListener("click", function () {
        addRatingRow(null);
      });
    }

    var cancelCityReviewBtn = document.getElementById("btn-cancel-city-review");
    if (cancelCityReviewBtn) {
      cancelCityReviewBtn.addEventListener("click", resetCityReviewEditor);
    }

    var newCityReviewBtn = document.getElementById("btn-new-city-review");
    if (newCityReviewBtn) {
      newCityReviewBtn.addEventListener("click", function () {
        openCityReviewEditor(null);
      });
    }

    var cityReviewsList = document.getElementById("city-reviews-list");
    if (cityReviewsList) {
      cityReviewsList.addEventListener("click", function (event) {
        var btn = event.target.closest("[data-city-review-action]");
        if (!btn) return;
        var card = btn.closest("[data-city-review-id]");
        if (!card) return;
        var reviewId = card.getAttribute("data-city-review-id");
        var action = btn.getAttribute("data-city-review-action");
        var review = null;
        for (var k = 0; k < (activeCreator.cityReviews || []).length; k++) {
          if (activeCreator.cityReviews[k].id === reviewId) {
            review = activeCreator.cityReviews[k];
            break;
          }
        }
        if (action === "edit" && review) openCityReviewEditor(review);
        if (action === "delete") deleteCityReview(reviewId);
      });
    }

    var liveTripShellForm = document.getElementById("live-trip-shell-form");
    if (liveTripShellForm) {
      liveTripShellForm.addEventListener("submit", handleLiveTripShellSubmit);
    }

    var liveTripCity = document.getElementById("live-trip-city");
    if (liveTripCity) {
      liveTripCity.addEventListener("input", updateLiveTripCityHint);
      liveTripCity.addEventListener("change", updateLiveTripCityHint);
      liveTripCity.addEventListener("blur", updateLiveTripCityHint);
    }

    var clearLiveTripBtn = document.getElementById("btn-clear-live-trip");
    if (clearLiveTripBtn) {
      clearLiveTripBtn.addEventListener("click", handleClearLiveTrip);
    }

    var goLiveBtn = document.getElementById("btn-live-trip-go-live");
    if (goLiveBtn) {
      goLiveBtn.addEventListener("click", function () {
        setLiveTripStatus("live");
      });
    }

    var endLiveTripBtn = document.getElementById("btn-live-trip-end");
    if (endLiveTripBtn) {
      endLiveTripBtn.addEventListener("click", function () {
        if (window.confirm("End this trip? Followers will no longer see it as live.")) {
          setLiveTripStatus("wrapped");
        }
      });
    }

    var addLiveTripDayBtn = document.getElementById("btn-add-live-trip-day");
    if (addLiveTripDayBtn) {
      addLiveTripDayBtn.addEventListener("click", function () {
        openLiveTripDayEditor(null);
      });
    }

    var liveTripDayForm = document.getElementById("live-trip-day-form");
    if (liveTripDayForm) {
      liveTripDayForm.addEventListener("submit", handleLiveTripDaySubmit);
    }

    var cancelLiveTripDayBtn = document.getElementById("btn-cancel-live-trip-day");
    if (cancelLiveTripDayBtn) {
      cancelLiveTripDayBtn.addEventListener("click", resetLiveTripDayEditor);
    }

    document.querySelectorAll('input[name="live-trip-tag"]').forEach(function (el) {
      el.addEventListener("change", function () {
        var checked = document.querySelectorAll('input[name="live-trip-tag"]:checked');
        if (checked.length > 3) {
          el.checked = false;
          notifySaved("Pick up to three tags");
        }
      });
    });

    var liveTripCoverFile = document.getElementById("live-trip-cover-file");
    if (liveTripCoverFile) {
      liveTripCoverFile.addEventListener("change", function () {
        handleImageFilePick({
          fileInput: liveTripCoverFile,
          kind: "trip-cover",
          tripId: ensureLiveTripId,
          previewWrapId: "live-trip-cover-preview",
          previewImgId: "live-trip-cover-preview-img",
          urlInput: document.getElementById("live-trip-cover"),
          statusEl: document.getElementById("live-trip-cover-status")
        });
        liveTripCoverFile.value = "";
      });
    }

    var liveTripDayPhotoFile = document.getElementById("live-trip-day-photo-file");
    if (liveTripDayPhotoFile) {
      liveTripDayPhotoFile.addEventListener("change", function () {
        handleImageFilePick({
          fileInput: liveTripDayPhotoFile,
          kind: "trip-day-photo",
          tripId: ensureLiveTripId,
          dayId: function () {
            return document.getElementById("live-trip-day-id").value || "day";
          },
          previewWrapId: "live-trip-day-photo-preview",
          previewImgId: "live-trip-day-photo-preview-img",
          urlInput: document.getElementById("live-trip-day-photo"),
          statusEl: document.getElementById("live-trip-day-photo-status")
        });
        liveTripDayPhotoFile.value = "";
      });
    }

    var liveTripDayVideoFile = document.getElementById("live-trip-day-video-file");
    if (liveTripDayVideoFile) {
      liveTripDayVideoFile.addEventListener("change", function () {
        handleVideoFilePick({
          fileInput: liveTripDayVideoFile,
          tripId: ensureLiveTripId,
          dayId: function () {
            return document.getElementById("live-trip-day-id").value || "day";
          },
          previewWrapId: "live-trip-day-video-preview",
          previewVideoId: "live-trip-day-video-preview-vid",
          urlInput: document.getElementById("live-trip-day-video"),
          statusEl: document.getElementById("live-trip-day-video-status")
        });
        liveTripDayVideoFile.value = "";
      });
    }

    var liveTripDaysList = document.getElementById("live-trip-days-list");
    if (liveTripDaysList) {
      liveTripDaysList.addEventListener("click", function (event) {
        var btn = event.target.closest("[data-live-trip-day-action]");
        if (!btn) return;
        var card = btn.closest("[data-live-trip-day-id]");
        if (!card) return;
        var dayId = card.getAttribute("data-live-trip-day-id");
        var action = btn.getAttribute("data-live-trip-day-action");
        var trip = getLiveTripFromCreator();
        var day = null;
        if (trip && trip.days) {
          for (var d = 0; d < trip.days.length; d++) {
            if (trip.days[d].id === dayId) {
              day = trip.days[d];
              break;
            }
          }
        }
        if (action === "edit" && day) openLiveTripDayEditor(day);
        if (action === "delete") deleteLiveTripDay(dayId);
      });
    }

    var newTripBtn = document.getElementById("btn-new-trip");
    if (newTripBtn) {
      newTripBtn.addEventListener("click", function () {
        openTripEditor(null);
      });
    }

    var cancelTripBtn = document.getElementById("btn-cancel-trip");
    if (cancelTripBtn) {
      cancelTripBtn.addEventListener("click", resetTripForm);
    }

    var tripsList = document.getElementById("trips-list");
    if (tripsList) {
      tripsList.addEventListener("click", function (event) {
        var btn = event.target.closest("[data-trip-action]");
        if (!btn) return;
        var card = btn.closest("[data-trip-id]");
        if (!card) return;
        var tripId = card.getAttribute("data-trip-id");
        var action = btn.getAttribute("data-trip-action");
        var trip = null;
        for (var j = 0; j < (activeCreator.tripRadar || []).length; j++) {
          if (activeCreator.tripRadar[j].id === tripId) {
            trip = activeCreator.tripRadar[j];
            break;
          }
        }
        if (action === "edit" && trip) openTripEditor(trip);
        if (action === "delete") deleteTrip(tripId);
      });
    }

    var postsList = document.getElementById("posts-list");
    if (postsList) {
      postsList.addEventListener("click", function (event) {
        var btn = event.target.closest("[data-action]");
        if (!btn) return;
        var card = btn.closest("[data-post-id]");
        if (!card) return;
        var postId = card.getAttribute("data-post-id");
        var action = btn.getAttribute("data-action");
        var post = null;
        for (var j = 0; j < (activeCreator.posts || []).length; j++) {
          if (activeCreator.posts[j].id === postId) {
            post = activeCreator.posts[j];
            break;
          }
        }

        if (action === "edit" && post) {
          openPostEditor(post);
        }
        if (action === "delete") {
          deletePost(postId);
        }
      });
    }
  }

  window.DashboardPageEditor = {
    init: function (creator) {
      activeCreator = creator;
      loadTrekstakCities();
      fillProfileForm(creator);
      fillCityOfTheWeekForm(creator);
      renderTripsList();
      resetTripForm();
      renderCityReviewsList();
      resetCityReviewEditor();
      renderLiveTripUI();
      resetLiveTripDayEditor();
      renderPostsList();
      resetPostForm();

      var inlineLink = document.getElementById("link-public-page-inline");
      if (inlineLink && creator.publicPageUrl) {
        inlineLink.href = creator.publicPageUrl;
      }
    },
    refresh: function (creator) {
      activeCreator = creator;
      fillProfileForm(creator);
      fillCityOfTheWeekForm(creator);
      renderTripsList();
      renderCityReviewsList();
      renderLiveTripUI();
      renderPostsList();
    }
  };

  bindEvents();
})();
