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

  function uploadImageFile(file, kind, postId) {
    if (!window.CreatorImageUpload) {
      return Promise.reject(new Error("Upload module not loaded"));
    }
    return CreatorImageUpload.uploadCreatorImage(
      activeCreator.slug,
      file,
      kind,
      postId
    );
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

    var postId = options.postId;
    if (typeof postId === "function") {
      postId = postId();
    }

    uploadImageFile(file, options.kind, postId)
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
      fillProfileForm(creator);
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
      renderPostsList();
    }
  };

  bindEvents();
})();
