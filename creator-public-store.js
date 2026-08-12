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
      posts: Array.isArray(creator.posts) ? creator.posts.slice() : [],
      cityOfTheWeek: normalizeCityOfTheWeek(creator.cityOfTheWeek),
      cityReviews: normalizeCityReviews(creator.cityReviews),
      liveTrip: normalizeLiveTrip(creator.liveTrip)
    };
  }

  var LIVE_TRIP_STATUSES = { planning: true, live: true, wrapped: true };

  function normalizeLiveTripDay(day) {
    if (!day || typeof day !== "object") return null;
    var headline = String(day.headline || "").trim();
    if (!headline) return null;
    var dayNumber = parseInt(day.dayNumber, 10);
    if (isNaN(dayNumber) || dayNumber < 1) dayNumber = 1;
    var tags = Array.isArray(day.tags)
      ? day.tags
          .map(function (t) {
            return String(t || "").trim();
          })
          .filter(Boolean)
          .slice(0, 3)
      : [];
    return {
      id: String(day.id || "").trim(),
      dayNumber: dayNumber,
      label: String(day.label || "").trim(),
      date: String(day.date || "").trim(),
      headline: headline,
      summary: String(day.summary || "").trim(),
      tags: tags,
      photoUrl: String(day.photoUrl || "").trim(),
      videoUrl: String(day.videoUrl || "").trim(),
      videoLinkUrl: String(day.videoLinkUrl || "").trim(),
      publishedAt: day.publishedAt || null
    };
  }

  function normalizeLiveTrip(trip) {
    if (!trip || typeof trip !== "object") return null;
    var title = String(trip.title || "").trim();
    var city = String(trip.city || "").trim();
    if (!title || !city) return null;
    var status = String(trip.status || "planning").trim();
    if (!LIVE_TRIP_STATUSES[status]) status = "planning";
    var days = Array.isArray(trip.days)
      ? trip.days.map(normalizeLiveTripDay).filter(Boolean)
      : [];
    days.sort(function (a, b) {
      if (a.date && b.date && a.date !== b.date) {
        return String(a.date).localeCompare(String(b.date));
      }
      return a.dayNumber - b.dayNumber;
    });
    return {
      id: String(trip.id || "").trim(),
      title: title,
      city: city,
      country: String(trip.country || "").trim(),
      flag: String(trip.flag || "").trim(),
      inTrekstak: !!trip.inTrekstak,
      startDate: String(trip.startDate || "").trim(),
      endDate: String(trip.endDate || "").trim(),
      status: status,
      coverPhotoUrl: String(trip.coverPhotoUrl || "").trim(),
      hook: String(trip.hook || "").trim(),
      days: days,
      updatedAt: trip.updatedAt || null
    };
  }

  function normalizeCityReviewRating(entry) {
    if (!entry || typeof entry !== "object") return null;
    var stars = parseInt(entry.stars, 10);
    if (isNaN(stars) || stars < 1 || stars > 5) return null;
    var category = String(entry.category || "").trim();
    var label = String(entry.label || "").trim();
    if (!category) return null;
    if (category === "custom") {
      if (!label) return null;
    } else if (!label) {
      label = category;
    }
    return {
      category: category,
      label: label,
      stars: stars,
      why: String(entry.why || "").trim()
    };
  }

  function normalizeCityReview(review) {
    if (!review || typeof review !== "object") return null;
    var city = String(review.city || "").trim();
    if (!city) return null;
    var ratings = Array.isArray(review.ratings)
      ? review.ratings.map(normalizeCityReviewRating).filter(Boolean).slice(0, 5)
      : [];
    if (!ratings.length) return null;
    return {
      id: String(review.id || "").trim(),
      city: city,
      country: String(review.country || "").trim(),
      flag: String(review.flag || "").trim(),
      inTrekstak: !!review.inTrekstak,
      ratings: ratings,
      updatedAt: review.updatedAt || null
    };
  }

  function normalizeCityReviews(reviews) {
    if (!Array.isArray(reviews)) return [];
    return reviews.map(normalizeCityReview).filter(Boolean);
  }

  function normalizeCityOfTheWeek(value) {
    if (!value || typeof value !== "object") return null;
    var tips = Array.isArray(value.tips)
      ? value.tips
          .map(function (t) {
            return String(t || "").trim();
          })
          .filter(Boolean)
          .slice(0, 5)
      : [];
    var city = String(value.city || "").trim();
    if (!city) return null;
    return {
      city: city,
      country: String(value.country || "").trim(),
      flag: String(value.flag || "").trim(),
      inTrekstak: !!value.inTrekstak,
      photoUrl: String(value.photoUrl || "").trim(),
      intro: String(value.intro || "").trim(),
      tips: tips,
      updatedAt: value.updatedAt || null
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
      posts: Array.isArray(overlay.posts) ? overlay.posts.slice() : base.posts,
      cityOfTheWeek:
        overlay.cityOfTheWeek !== undefined
          ? normalizeCityOfTheWeek(overlay.cityOfTheWeek)
          : base.cityOfTheWeek,
      cityReviews: Array.isArray(overlay.cityReviews)
        ? normalizeCityReviews(overlay.cityReviews)
        : base.cityReviews,
      liveTrip:
        overlay.liveTrip !== undefined
          ? normalizeLiveTrip(overlay.liveTrip)
          : base.liveTrip
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
          cityOfTheWeek: normalizeCityOfTheWeek(data.cityOfTheWeek),
          cityReviews: normalizeCityReviews(data.cityReviews),
          liveTrip: normalizeLiveTrip(data.liveTrip),
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

    if (!global.TrekStakFirebaseConfig) {
      return Promise.resolve({ fields: fields, cloudSynced: false });
    }

    return ensureFirestore()
      .then(function (fb) {
        var payload = Object.assign({}, fields, {
          slug: safeSlug,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        return fb.firestore
          .collection(COLLECTION)
          .doc(safeSlug)
          .set(payload, { merge: true })
          .then(function () {
            return { fields: fields, cloudSynced: true };
          });
      })
      .catch(function (err) {
        console.warn("Cloud save failed — kept local preview overlay", err);
        return { fields: fields, cloudSynced: false };
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
