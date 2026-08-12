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
        return activateSession().then(function (data) {
          if (data) data.fromEmailLink = true;
          return data;
        });
      });
    });
  }

  function mapAuthError(err) {
    var code = err && err.code ? String(err.code) : "";
    if (code === "auth/wrong-password" || code === "auth/invalid-credential" || code === "auth/invalid-login-credentials") {
      return "That password did not match. Try again, or leave password blank to get a sign-in link.";
    }
    if (code === "auth/user-not-found") {
      return "No password is set for this email yet. Leave password blank and we will email a sign-in link.";
    }
    if (code === "auth/weak-password") {
      return "Use at least 8 characters for your password.";
    }
    if (code === "auth/too-many-requests") {
      return "Too many attempts. Wait a minute, then try again.";
    }
    if (code === "auth/requires-recent-login") {
      return "For security, use a fresh sign-in link before setting a password.";
    }
    return (err && err.message) || "Could not complete sign-in.";
  }

  function signInWithPassword(email, password) {
    var normalized = String(email || "").trim().toLowerCase();
    var pass = String(password || "");
    if (!normalized) {
      return Promise.reject(new Error("Enter your email address."));
    }
    if (!pass) {
      return Promise.reject(new Error("Enter your password, or leave it blank to get a sign-in link."));
    }
    return ensureFirebase().then(function (fb) {
      return fb.auth.signInWithEmailAndPassword(normalized, pass).then(function () {
        return activateSession();
      });
    }).catch(function (err) {
      return Promise.reject(new Error(mapAuthError(err)));
    });
  }

  function setPassword(password) {
    var pass = String(password || "");
    if (pass.length < 8) {
      return Promise.reject(new Error("Use at least 8 characters for your password."));
    }
    return ensureFirebase().then(function (fb) {
      if (!fb.auth.currentUser) {
        return Promise.reject(new Error("Not signed in."));
      }
      return fb.auth.currentUser.updatePassword(pass).then(function () {
        return activateSession({ passwordSet: true });
      });
    }).catch(function (err) {
      return Promise.reject(new Error(mapAuthError(err)));
    });
  }

  function sendPasswordReset(email) {
    var normalized = String(email || "").trim().toLowerCase();
    if (!normalized) {
      return Promise.reject(new Error("Enter your email address first."));
    }
    return ensureFirebase().then(function (fb) {
      return fb.auth.sendPasswordResetEmail(normalized);
    });
  }

  function activateSession(data) {
    return ensureFirebase()
      .then(function (fb) {
        if (!fb.auth.currentUser) {
          return Promise.reject(new Error("Not signed in."));
        }
        var callable = fb.functions.httpsCallable("creatorHubActivateSession");
        return callable(data || {});
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
    signInWithPassword: signInWithPassword,
    setPassword: setPassword,
    sendPasswordReset: sendPasswordReset,
    activateSession: activateSession,
    tryRestoreSession: tryRestoreSession,
    getCurrentUser: getCurrentUser,
    signOut: signOut,
    isLocalHost: isLocalHost,
    useEmulators: useEmulators,
  };
})(typeof window !== "undefined" ? window : globalThis);
