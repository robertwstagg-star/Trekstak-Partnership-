(function (global) {
  "use strict";

  var EMAIL_FOR_SIGNIN_KEY = "trekstak-partner-email-for-signin";
  var FUNCTIONS_REGION = "us-central1";
  var firebaseReady = null;

  function isLocalHost() {
    var host = global.location && global.location.hostname;
    return host === "127.0.0.1" || host === "localhost";
  }

  function useEmulators() {
    return isLocalHost() && global.localStorage.getItem("trekstak-use-firebase-emulators") === "1";
  }

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
          "https://www.gstatic.com/firebasejs/10.12.0/firebase-functions-compat.js"
        );
      })
      .then(function () {
        if (!firebase.apps.length) {
          firebase.initializeApp(global.TrekStakFirebaseConfig);
        }
        if (useEmulators()) {
          firebase.auth().useEmulator("http://127.0.0.1:9099");
          firebase.app().functions(FUNCTIONS_REGION).useEmulator("127.0.0.1", 5001);
        }
        return {
          auth: firebase.auth(),
          functions: firebase.app().functions(FUNCTIONS_REGION),
        };
      });

    return firebaseReady;
  }

  function sendSignInLink(email) {
    var normalized = String(email || "").trim().toLowerCase();
    if (!normalized) {
      return Promise.reject(new Error("Enter your email address."));
    }

    return ensureFirebase().then(function (fb) {
      var actionCodeSettings = {
        url: global.location.origin + global.location.pathname,
        handleCodeInApp: true,
      };
      return fb.auth
        .sendSignInLinkToEmail(normalized, actionCodeSettings)
        .then(function () {
          try {
            global.localStorage.setItem(EMAIL_FOR_SIGNIN_KEY, normalized);
          } catch (e) {
            /* ignore */
          }
          return normalized;
        });
    });
  }

  function completeSignInFromEmailLink() {
    if (!global.location || !global.location.href) {
      return Promise.resolve(null);
    }

    return ensureFirebase().then(function (fb) {
      if (!fb.auth.isSignInWithEmailLink(global.location.href)) {
        return null;
      }

      var email = null;
      try {
        email = global.localStorage.getItem(EMAIL_FOR_SIGNIN_KEY);
      } catch (e) {
        email = null;
      }

      if (!email) {
        return Promise.reject(
          new Error("Confirm the same email you used to request the sign-in link.")
        );
      }

      return fb.auth.signInWithEmailLink(email, global.location.href).then(function () {
        try {
          global.localStorage.removeItem(EMAIL_FOR_SIGNIN_KEY);
        } catch (e) {
          /* ignore */
        }
        // Remove sign-in query params from the URL bar.
        if (global.history && global.history.replaceState) {
          global.history.replaceState({}, document.title, global.location.pathname);
        }
        return activateSession();
      });
    });
  }

  function activateSession() {
    return ensureFirebase()
      .then(function (fb) {
        if (!fb.auth.currentUser) {
          return Promise.reject(new Error("Not signed in."));
        }
        var callable = fb.functions.httpsCallable("creatorHubActivateSession");
        return callable();
      })
      .then(function (result) {
        return ensureFirebase().then(function (fb) {
          return fb.auth.currentUser.getIdToken(true).then(function () {
            return result.data;
          });
        });
      });
  }

  function getCurrentUser() {
    return ensureFirebase().then(function (fb) {
      return fb.auth.currentUser;
    });
  }

  function signOut() {
    return ensureFirebase().then(function (fb) {
      return fb.auth.signOut();
    });
  }

  function tryRestoreSession() {
    return completeSignInFromEmailLink()
      .then(function (activated) {
        if (activated) return activated;
        return ensureFirebase().then(function (fb) {
          if (!fb.auth.currentUser) return null;
          return activateSession();
        });
      });
  }

  global.CreatorHubAuth = {
    ensureFirebase: ensureFirebase,
    sendSignInLink: sendSignInLink,
    completeSignInFromEmailLink: completeSignInFromEmailLink,
    activateSession: activateSession,
    tryRestoreSession: tryRestoreSession,
    getCurrentUser: getCurrentUser,
    signOut: signOut,
    isLocalHost: isLocalHost,
    useEmulators: useEmulators,
  };
})(typeof window !== "undefined" ? window : globalThis);
