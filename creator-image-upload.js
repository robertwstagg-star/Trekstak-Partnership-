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
        return firebase.auth().signInAnonymously();
      })
      .then(function () {
        return {
          auth: firebase.auth(),
          storage: firebase.storage(),
          firestore: firebase.firestore()
        };
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

  function uploadCreatorImage(slug, file, kind, postId) {
    if (!slug || !file) {
      return Promise.reject(new Error("Missing slug or file"));
    }

    var safeSlug = String(slug).toLowerCase().replace(/[^a-z0-9-]/g, "");
    var stamp = Date.now();
    var path;

    if (kind === "avatar") {
      path = "creator_pages/" + safeSlug + "/profile-" + stamp + ".jpg";
    } else {
      var safePost = String(postId || "post")
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

  global.CreatorImageUpload = {
    ensureFirebase: ensureFirebase,
    compressImageFile: compressImageFile,
    uploadCreatorImage: uploadCreatorImage
  };
})(typeof window !== "undefined" ? window : globalThis);
