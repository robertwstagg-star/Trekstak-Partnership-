(function (global) {
  "use strict";

  var STORAGE_PREFIX = "trekstak-creator-public-";

  function storageKey(slug) {
    return STORAGE_PREFIX + String(slug || "").toLowerCase();
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
    localStorage.setItem(storageKey(slug), JSON.stringify(payload));
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

  function mergePublicFields(creator) {
    if (!creator) return creator;
    var base = extractPublicFields(creator);
    var overlay = readOverlay(creator.slug);
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

  function savePublicFields(creator) {
    return writeOverlay(creator.slug, extractPublicFields(creator));
  }

  global.CreatorPublicStore = {
    readOverlay: readOverlay,
    writeOverlay: writeOverlay,
    extractPublicFields: extractPublicFields,
    mergePublicFields: mergePublicFields,
    savePublicFields: savePublicFields,
    storageKey: storageKey
  };
})(typeof window !== "undefined" ? window : globalThis);
