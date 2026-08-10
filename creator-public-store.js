(function (global) {
  "use strict";

  var STORAGE_PREFIX = "trekstak-creator-public-";
  var COLLECTION = "creator_pages";

  function storageKey(slug) {
    return STORAGE_PREFIX + String(slug || "").toLowerCase();
  }

  function normalizeSlug(slug) {
    return String(slug || "")
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "");
  }

  function readOverlay(slug) {
    try {
      var raw = localStorage.getItem(storageKey(slug));
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function writeOverlay(slug, data) {
    var payload = Object.assign({}, data, { updatedAt: new Date().toISOString() });
    try {
      localStorage.setItem(storageKey(slug), JSON.stringify(payload));
    } catch (e) {
      /* ignore quota */
    }
    return payload;
  }

  function extractPublicFields(creator) {
    if (!creator) return null;
    return {
      bio: creator.bio || "",
      avatarUrl: creator.avatarUrl || "",
      socials: Object.assign(
        { instagram: "", tiktok: "", youtube: "" },
        creator.socials || {}
      ),
      posts: Array.isArray(creator.posts) ? creator.posts.slice() : []
    };
  }

  function applyOverlay(creator, overlay) {
    if (!creator) return creator;
    var base = extractPublicFields(creator);
    if (!overlay) {
      return Object.assign({}, creator, base);
    }
    return Object.assign({}, creator, base, {
      bio: overlay.bio != null ? overlay.bio : base.bio,
      avatarUrl: overlay.avatarUrl != null ? overlay.avatarUrl : base.avatarUrl,
      socials: Object.assign({}, base.socials, overlay.socials || {}),
      posts: Array.isArray(overlay.posts) ? overlay.posts.slice() : base.posts
    });
  }

  function mergePublicFields(creator) {
    return applyOverlay(creator, readOverlay(creator && creator.slug));
  }

  function ensureFirestore() {
    if (global.CreatorImageUpload && global.CreatorImageUpload.ensureFirebase) {
      return global.CreatorImageUpload.ensureFirebase();
    }
    return Promise.reject(new Error("Firebase upload module not loaded"));
  }

  function fetchRemoteOverlay(slug) {
    var safeSlug = normalizeSlug(slug);
    if (!safeSlug) return Promise.resolve(null);

    return ensureFirestore()
      .then(function (fb) {
        return fb.firestore.collection(COLLECTION).doc(safeSlug).get();
      })
      .then(function (snap) {
        if (!snap.exists) return null;
        var data = snap.data() || {};
        var overlay = {
          bio: data.bio || "",
          avatarUrl: data.avatarUrl || "",
          socials: Object.assign(
            { instagram: "", tiktok: "", youtube: "" },
            data.socials || {}
          ),
          posts: Array.isArray(data.posts) ? data.posts.slice() : [],
          updatedAt: data.updatedAt || null
        };
        writeOverlay(safeSlug, overlay);
        return overlay;
      })
      .catch(function (err) {
        console.warn("Creator page remote read failed", err);
        return readOverlay(safeSlug);
      });
  }

  function mergePublicFieldsAsync(creator) {
    if (!creator) return Promise.resolve(creator);
    return fetchRemoteOverlay(creator.slug).then(function (overlay) {
      return applyOverlay(creator, overlay || readOverlay(creator.slug));
    });
  }

  function savePublicFields(creator) {
    var safeSlug = normalizeSlug(creator && creator.slug);
    var fields = extractPublicFields(creator);
    if (!safeSlug || !fields) {
      return Promise.reject(new Error("Missing creator slug"));
    }

    writeOverlay(safeSlug, fields);

    return ensureFirestore().then(function (fb) {
      var payload = Object.assign({}, fields, {
        slug: safeSlug,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      return fb.firestore
        .collection(COLLECTION)
        .doc(safeSlug)
        .set(payload, { merge: true })
        .then(function () {
          return fields;
        });
    });
  }

  global.CreatorPublicStore = {
    readOverlay: readOverlay,
    writeOverlay: writeOverlay,
    extractPublicFields: extractPublicFields,
    mergePublicFields: mergePublicFields,
    mergePublicFieldsAsync: mergePublicFieldsAsync,
    fetchRemoteOverlay: fetchRemoteOverlay,
    savePublicFields: savePublicFields,
    storageKey: storageKey
  };
})(typeof window !== "undefined" ? window : globalThis);
