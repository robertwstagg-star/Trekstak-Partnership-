(function (global) {
  "use strict";

  var firebaseReady = null;

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      if (document.querySelector('script[src="' + src + '"]')) {
        resolve();
        return;
      }
      var script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  function ensureFirebase() {
    if (firebaseReady) return firebaseReady;
    if (!global.TrekStakFirebaseConfig) {
      return Promise.reject(new Error("Firebase config missing"));
    }

    firebaseReady = loadScript(
      "https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js"
    )
      .then(function () {
        return loadScript(
          "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js"
        );
      })
      .then(function () {
        return loadScript(
          "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage-compat.js"
        );
      })
      .then(function () {
        return loadScript(
          "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js"
        );
      })
      .then(function () {
        if (!firebase.apps.length) {
          firebase.initializeApp(global.TrekStakFirebaseConfig);
        }
        var auth = firebase.auth();
        return new Promise(function (resolve, reject) {
          var unsub = auth.onAuthStateChanged(
            function (user) {
              unsub();
              if (user) {
                resolve({
                  auth: auth,
                  storage: firebase.storage(),
                  firestore: firebase.firestore(),
                });
                return;
              }
              auth.signInAnonymously()
                .then(function () {
                  resolve({
                    auth: firebase.auth(),
                    storage: firebase.storage(),
                    firestore: firebase.firestore(),
                  });
                })
                .catch(reject);
            },
            reject
          );
        });
      });

    return firebaseReady;
  }

  function readFileAsDataUrl(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        resolve(reader.result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function compressImageFile(file, maxWidth, quality) {
    maxWidth = maxWidth || 1400;
    quality = quality || 0.86;

    return readFileAsDataUrl(file).then(function (dataUrl) {
      return new Promise(function (resolve, reject) {
        var img = new Image();
        img.onload = function () {
          var width = img.width;
          var height = img.height;
          if (width > maxWidth) {
            height = Math.round(height * (maxWidth / width));
            width = maxWidth;
          }
          var canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          var ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob(
            function (blob) {
              if (!blob) {
                reject(new Error("Could not compress image"));
                return;
              }
              resolve(blob);
            },
            "image/jpeg",
            quality
          );
        };
        img.onerror = function () {
          reject(new Error("Could not read image"));
        };
        img.src = dataUrl;
      });
    });
  }

  function uploadCreatorImage(slug, file, kind, refId, refId2) {
    if (!slug || !file) {
      return Promise.reject(new Error("Missing slug or file"));
    }

    var safeSlug = String(slug).toLowerCase().replace(/[^a-z0-9-]/g, "");
    var stamp = Date.now();
    var path;

    if (kind === "avatar") {
      path = "creator_pages/" + safeSlug + "/profile-" + stamp + ".jpg";
    } else if (kind === "cotw") {
      path = "creator_pages/" + safeSlug + "/city-of-the-week-" + stamp + ".jpg";
    } else if (kind === "trip-cover") {
      var safeTripCover = String(refId || "trip")
        .replace(/[^a-z0-9-_]/gi, "")
        .slice(0, 40);
      path =
        "creator_pages/" + safeSlug + "/trips/" + safeTripCover + "/cover-" + stamp + ".jpg";
    } else if (kind === "trip-day-photo") {
      var safeTripPhoto = String(refId || "trip")
        .replace(/[^a-z0-9-_]/gi, "")
        .slice(0, 40);
      var safeDayPhoto = String(refId2 || "day")
        .replace(/[^a-z0-9-_]/gi, "")
        .slice(0, 40);
      path =
        "creator_pages/" +
        safeSlug +
        "/trips/" +
        safeTripPhoto +
        "/day-" +
        safeDayPhoto +
        "-photo-" +
        stamp +
        ".jpg";
    } else {
      var safePost = String(refId || "post")
        .replace(/[^a-z0-9-_]/gi, "")
        .slice(0, 40);
      path = "creator_pages/" + safeSlug + "/posts/" + safePost + "-" + stamp + ".jpg";
    }

    return ensureFirebase()
      .then(function (fb) {
        return compressImageFile(file).then(function (blob) {
          var ref = fb.storage.ref(path);
          return ref.put(blob, {
            contentType: "image/jpeg",
            cacheControl: "public,max-age=31536000"
          });
        });
      })
      .then(function (snapshot) {
        return snapshot.ref.getDownloadURL();
      });
  }

  function uploadCreatorVideo(slug, file, refId, refId2, kind) {
    if (!slug || !file) {
      return Promise.reject(new Error("Missing slug or file"));
    }
    var maxBytes = 150 * 1024 * 1024;
    if (file.size > maxBytes) {
      return Promise.reject(new Error("Video must be under 150 MB"));
    }
    if (!file.type || !file.type.startsWith("video/")) {
      return Promise.reject(new Error("Please choose a video file"));
    }

    var safeSlug = String(slug).toLowerCase().replace(/[^a-z0-9-]/g, "");
    var stamp = Date.now();
    var ext = "mp4";
    if (file.type.indexOf("quicktime") >= 0) ext = "mov";
    else if (file.type.indexOf("webm") >= 0) ext = "webm";
    var path;

    if (kind === "post") {
      var safePost = String(refId || "post")
        .replace(/[^a-z0-9-_]/gi, "")
        .slice(0, 40);
      path =
        "creator_pages/" +
        safeSlug +
        "/posts/" +
        safePost +
        "-video-" +
        stamp +
        "." +
        ext;
    } else {
      var safeTrip = String(refId || "trip")
        .replace(/[^a-z0-9-_]/gi, "")
        .slice(0, 40);
      var safeDay = String(refId2 || "day")
        .replace(/[^a-z0-9-_]/gi, "")
        .slice(0, 40);
      path =
        "creator_pages/" +
        safeSlug +
        "/trips/" +
        safeTrip +
        "/day-" +
        safeDay +
        "-video-" +
        stamp +
        "." +
        ext;
    }

    return ensureFirebase()
      .then(function (fb) {
        var ref = fb.storage.ref(path);
        return ref.put(file, {
          contentType: file.type,
          cacheControl: "public,max-age=31536000"
        });
      })
      .then(function (snapshot) {
        return snapshot.ref.getDownloadURL();
      });
  }

  global.CreatorImageUpload = {
    ensureFirebase: ensureFirebase,
    compressImageFile: compressImageFile,
    uploadCreatorImage: uploadCreatorImage,
    uploadCreatorVideo: uploadCreatorVideo
  };
})(typeof window !== "undefined" ? window : globalThis);
