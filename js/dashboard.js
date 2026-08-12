(function () {
  "use strict";

  var SESSION_KEY = "trekstak-partner-session";
  var DATA_URL = "data/creator-accounts.json";
  var accountsCache = null;

  /* Inline fallback so demo login works even if fetch fails (e.g. opened without a local server). */
  var DEMO_ACCOUNTS_FALLBACK = {
    travelRewardTarget: 500,
    travelRewardAmount: 1000,
    creators: [
      {
        id: "demo-chris",
        slug: "chris",
        email: "chris@demo.trekstakapp.com",
        displayName: "Chris",
        handle: "@chris.travels",
        role: "Planning Creator",
        promoCode: "CHRIS20",
        discountLabel: "20% off your first year",
        commissionRate: 0.25,
        commissionLabel: "25%",
        publicPageUrl: "https://creators.trekstakapp.com/c/chris",
        appStoreUrl: "https://apps.apple.com/app/trekstak/id6758947030",
        bio: "Trip planning tips and TrekStak walkthroughs — without clogging my Instagram feed.",
        avatarUrl: "",
        socials: {
          instagram: "https://www.instagram.com/",
          tiktok: "",
          youtube: ""
        },
        posts: [
          {
            id: "chris-001",
            status: "published",
            publishedAt: "2026-08-08",
            title: "How I plan a city day in under 10 minutes",
            body: "Open TrekStak, pick the neighborhood, stak the stops you actually care about, and you are out the door with a route — not a 40-tab browser mess.",
            imageUrl: "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1200&q=80",
            imageAlt: "Traveler looking at a map outdoors",
            ctaLabel: "Try it with my code",
            showPromoCode: true,
            tags: ["planning", "tips"]
          }
        ],
        stats: {
          codeUses: 47,
          qualifyingSubscribers: 32,
          subscriptionRevenue: 767.68,
          commissionEarned: 191.92,
          commissionPending: 47.98,
          travelRewardProgress: 32
        },
        nextPayout: {
          date: "2026-04-15",
          label: "Apr 15, 2026",
          note: "After Apple remittance for March activity"
        },
        dailyUses: [
          { date: "2026-07-12", uses: 1 },
          { date: "2026-07-14", uses: 2 },
          { date: "2026-08-07", uses: 5 },
          { date: "2026-08-09", uses: 2 }
        ],
        payouts: [
          {
            period: "Mar 2026",
            qualifyingSubs: 8,
            commission: 47.98,
            status: "pending",
            statusLabel: "Pending (14-day hold)"
          },
          {
            period: "Feb 2026",
            qualifyingSubs: 12,
            commission: 71.97,
            status: "paid",
            statusLabel: "Paid Mar 28"
          }
        ],
        payoutMethod: {
          type: "E-transfer",
          email: "chris@demo.trekstakapp.com",
          note: "Update with partners@trekstakapp.com if this changes."
        }
      }
    ]
  };

  var loginView = document.getElementById("login-view");
  var dashboardView = document.getElementById("dashboard-view");
  var loginForm = document.getElementById("login-form");
  var loginError = document.getElementById("login-error");
  var signOutBtn = document.getElementById("sign-out");
  var toastEl = document.getElementById("toast");

  function escapeHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatMoney(amount) {
    return "$" + Number(amount).toFixed(2);
  }

  function showToast(message) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.add("is-visible");
    window.clearTimeout(showToast._timer);
    showToast._timer = window.setTimeout(function () {
      toastEl.classList.remove("is-visible");
    }, 2200);
  }

  window.showDashboardToast = showToast;

  function resolvePublicPageUrl(creator) {
    if (!creator || !creator.slug) {
      return (creator && creator.publicPageUrl) || "";
    }
    var host = location.hostname;
    if (host === "127.0.0.1" || host === "localhost") {
      return location.origin + "/c/" + encodeURIComponent(creator.slug);
    }
    return (
      creator.publicPageUrl || "https://creators.trekstakapp.com/c/" + encodeURIComponent(creator.slug)
    );
  }

  function withPublicMerge(creator) {
    if (!creator || !window.CreatorPublicStore) {
      return Promise.resolve(creator);
    }
    if (CreatorPublicStore.mergePublicFieldsAsync) {
      return CreatorPublicStore.mergePublicFieldsAsync(creator);
    }
    return Promise.resolve(CreatorPublicStore.mergePublicFields(creator));
  }

  function copyText(text, successMessage) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        function () {
          showToast(successMessage || "Copied");
        },
        function () {
          fallbackCopy(text, successMessage);
        }
      );
      return;
    }
    fallbackCopy(text, successMessage);
  }

  function fallbackCopy(text, successMessage) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
      showToast(successMessage || "Copied");
    } catch (e) {
      showToast("Could not copy — select and copy manually");
    }
    document.body.removeChild(ta);
  }

  function getSession() {
    try {
      var raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function setSession(creatorId, email) {
    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ creatorId: creatorId, email: email, at: Date.now() })
    );
  }

  function clearSession() {
    sessionStorage.removeItem(SESSION_KEY);
  }

  function loadAccounts() {
    if (accountsCache) {
      return Promise.resolve(accountsCache);
    }
    return fetch(DATA_URL, { cache: "no-cache" })
      .then(function (res) {
        if (!res.ok) throw new Error("Could not load partner data");
        return res.json();
      })
      .then(function (data) {
        accountsCache = data;
        return data;
      })
      .catch(function () {
        accountsCache = DEMO_ACCOUNTS_FALLBACK;
        return DEMO_ACCOUNTS_FALLBACK;
      });
  }

  function findCreatorByEmail(data, email) {
    var normalized = String(email || "")
      .trim()
      .toLowerCase();
    var list = (data && data.creators) || [];
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].email).toLowerCase() === normalized) {
        return list[i];
      }
    }
    return null;
  }

  function findCreatorById(data, id) {
    var list = (data && data.creators) || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return null;
  }

  function findCreatorBySlug(data, slug) {
    var normalized = String(slug || "")
      .trim()
      .toLowerCase();
    var list = (data && data.creators) || [];
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].slug).toLowerCase() === normalized) {
        return list[i];
      }
    }
    return null;
  }

  function qrUrl(pageUrl) {
    return (
      "https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=10&data=" +
      encodeURIComponent(pageUrl)
    );
  }

  function buildUsageChart(dailyUses) {
    if (!dailyUses || !dailyUses.length) {
      return '<p class="usage-chart-empty">No recent code activity yet.</p>';
    }
    var max = 1;
    dailyUses.forEach(function (d) {
      if (d.uses > max) max = d.uses;
    });
    var bars = dailyUses
      .map(function (d) {
        var pct = Math.round((d.uses / max) * 100);
        var title = d.date + ": " + d.uses + " use" + (d.uses === 1 ? "" : "s");
        return (
          '<div class="usage-bar" style="height:' +
          Math.max(pct, 8) +
          '%" title="' +
          escapeHtml(title) +
          '" role="img" aria-label="' +
          escapeHtml(title) +
          '"></div>'
        );
      })
      .join("");
    return '<div class="usage-chart" aria-label="Code uses over recent days">' + bars + "</div>";
  }

  function renderPayoutRows(payouts) {
    if (!payouts || !payouts.length) {
      return '<tr><td colspan="4">No payout history yet.</td></tr>';
    }
    return payouts
      .map(function (row) {
        var statusClass = row.status === "paid" ? "paid" : "pending";
        return (
          "<tr>" +
          "<td>" +
          escapeHtml(row.period) +
          "</td>" +
          "<td>" +
          escapeHtml(String(row.qualifyingSubs)) +
          "</td>" +
          "<td>" +
          formatMoney(row.commission) +
          "</td>" +
          '<td><span class="status-pill ' +
          statusClass +
          '">' +
          escapeHtml(row.statusLabel) +
          "</span></td>" +
          "</tr>"
        );
      })
      .join("");
  }

  function renderDashboard(data, creator) {
    try {
      var stats = creator.stats || {};
    var travelTarget = data.travelRewardTarget || 500;
    var travelAmount = data.travelRewardAmount || 1000;
    var progress = stats.travelRewardProgress || 0;
    var progressPct = Math.min(100, Math.round((progress / travelTarget) * 100));
    var nextPayout = creator.nextPayout || {};

    document.getElementById("dash-greeting-name") &&
      (document.getElementById("dash-greeting-name").textContent = creator.displayName);
    var roleEl = document.getElementById("dash-role");
    if (roleEl) {
      roleEl.textContent = creator.role + " · " + creator.handle;
    }

    document.getElementById("stat-code").textContent = creator.promoCode;
    document.getElementById("stat-uses").textContent = String(stats.codeUses || 0);
    document.getElementById("stat-subs").textContent = String(stats.qualifyingSubscribers || 0);
    document.getElementById("stat-revenue").textContent = formatMoney(stats.subscriptionRevenue || 0);
    document.getElementById("stat-earned").textContent = formatMoney(stats.commissionEarned || 0);
    document.getElementById("stat-pending").textContent = formatMoney(stats.commissionPending || 0);

    var codeHeroValue = document.getElementById("code-hero-value");
    if (codeHeroValue) codeHeroValue.textContent = creator.promoCode;
    var codeHeroDiscount = document.getElementById("code-hero-discount");
    if (codeHeroDiscount) codeHeroDiscount.textContent = creator.discountLabel || "";
    var toolsPromo = document.getElementById("tools-promo-code");
    if (toolsPromo) toolsPromo.textContent = creator.promoCode || "—";
    var toolsDiscount = document.getElementById("tools-promo-discount");
    if (toolsDiscount) toolsDiscount.textContent = creator.discountLabel || "";

    document.getElementById("reward-count").textContent = progress + " / " + travelTarget;
    document.getElementById("reward-fill").style.width = progressPct + "%";
    document.getElementById("reward-note").textContent =
      progress +
      " qualifying subscribers toward a $" +
      travelAmount.toLocaleString() +
      " travel reward.";

    document.getElementById("next-payout-label").textContent = nextPayout.label || "—";
    document.getElementById("next-payout-note").textContent = nextPayout.note || "";

    document.getElementById("usage-chart").innerHTML = buildUsageChart(creator.dailyUses);
    document.getElementById("payout-rows").innerHTML = renderPayoutRows(creator.payouts);

    var publicLink = document.getElementById("link-public-page");
    var publicPageUrl = document.getElementById("public-page-url");
    var pageUrl = resolvePublicPageUrl(creator);
    var publicDisplay = pageUrl.replace(/^https?:\/\//, "");
    if (publicLink) {
      publicLink.href = pageUrl;
      publicLink.textContent = "View public page";
      publicLink.title = pageUrl;
    }
    if (publicPageUrl) publicPageUrl.textContent = publicDisplay;

    document.getElementById("link-app-store").href = creator.appStoreUrl;

    var qrImg = document.getElementById("qr-image");
    qrImg.src = qrUrl(pageUrl);
    qrImg.alt = "QR code for " + pageUrl;

    var payout = creator.payoutMethod || {};
    document.getElementById("payout-type").textContent = payout.type || "—";
    document.getElementById("payout-email").textContent = payout.email || "—";
    document.getElementById("payout-note").textContent = payout.note || "";

    document.getElementById("commission-rate").textContent =
      creator.commissionLabel || Math.round((creator.commissionRate || 0) * 100) + "%";

    bindDashboardActions(creator);

    if (window.DashboardPageEditor) {
      DashboardPageEditor.init(creator);
    }
    if (window.CreatorAI) {
      CreatorAI.init(creator);
    }
    initDashboardAppNav();
    } catch (err) {
      console.error("Dashboard render error", err);
    }
  }

  function bindDashboardActions(creator) {
    var pageUrl = resolvePublicPageUrl(creator);

    function bindCopyPage() {
      copyText(pageUrl, "Public page link copied");
    }

    var copyCodeBtn = document.getElementById("btn-copy-code");
    if (copyCodeBtn) {
      copyCodeBtn.onclick = function () {
        copyText(creator.promoCode, "Promo code copied");
      };
    }
    var copyPageBtn = document.getElementById("btn-copy-page");
    if (copyPageBtn) copyPageBtn.onclick = bindCopyPage;
    var copyPageShare = document.getElementById("btn-copy-page-share");
    if (copyPageShare) copyPageShare.onclick = bindCopyPage;
    document.getElementById("btn-copy-app-store").onclick = function () {
      copyText(creator.appStoreUrl, "App Store link copied");
    };
  }

  function initDashboardAppNav() {
    var nav = document.getElementById("dashboard-app-nav");
    var scope = document.getElementById("dashboard-view");
    if (!nav || !scope || !window.TrekStakWebApp) return;

    var tabs = [
      { id: "page", label: "Page" },
      { id: "ai", label: "Creator AI" },
      { id: "earn", label: "Earn" },
      { id: "tools", label: "Tools" }
    ];

    if (!nav.dataset.ready) {
      nav.innerHTML = TrekStakWebApp.buildNavButtons(tabs);
      nav.dataset.ready = "1";
      TrekStakWebApp.mountBottomNav({
        nav: nav,
        tabs: tabs,
        defaultTab: "page",
        scope: scope,
        onChange: handleDashboardTabChange
      });
    }

    initPageSectionNav(scope);
    handleDashboardTabChange(parseDashboardTab());
    initStandaloneHint();
  }

  function parseDashboardTab() {
    var hash = (location.hash || "").replace(/^#/, "").trim().toLowerCase();
    if (hash === "share") return "tools";
    if (hash === "page" || hash === "earn" || hash === "tools" || hash === "ai") return hash;
    return "page";
  }

  function handleDashboardTabChange(tabId) {
    if (tabId === "share") tabId = "tools";
    var sectionNav = document.getElementById("page-section-nav");
    if (sectionNav) {
      sectionNav.hidden = tabId !== "page";
    }
    if (tabId === "page") {
      setPageSection(window._activePageSection || "profile");
    }
    if (tabId === "ai" && window.CreatorAI) {
      CreatorAI.onTabShow();
    }
  }

  function setPageSection(sectionId) {
    var scope = document.getElementById("dashboard-view");
    if (!scope) return;
    window._activePageSection = sectionId;

    scope.querySelectorAll(".dash-panel[data-page-section]").forEach(function (el) {
      el.hidden = el.getAttribute("data-page-section") !== sectionId;
    });

    var sectionNav = document.getElementById("page-section-nav");
    if (sectionNav) {
      sectionNav.querySelectorAll(".page-section-btn").forEach(function (btn) {
        btn.classList.toggle(
          "is-active",
          btn.getAttribute("data-section-tab") === sectionId
        );
      });
    }
  }

  function initPageSectionNav(scope) {
    var sectionNav = document.getElementById("page-section-nav");
    if (!sectionNav || sectionNav.dataset.ready) return;
    sectionNav.dataset.ready = "1";

    sectionNav.querySelectorAll(".page-section-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        setPageSection(btn.getAttribute("data-section-tab"));
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    });

    setPageSection(window._activePageSection || "profile");
  }

  function initStandaloneHint() {
    var link = document.getElementById("link-open-browser");
    if (!link) return;
    var standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;
    link.hidden = !standalone;
  }

  function showLogin() {
    document.body.classList.remove("dashboard-authed", "webapp-has-nav");
    var nav = document.getElementById("dashboard-app-nav");
    if (nav) nav.hidden = true;
    if (loginView) loginView.hidden = false;
    if (dashboardView) dashboardView.hidden = true;
  }

  function showDashboard() {
    document.body.classList.add("dashboard-authed");
    if (loginView) loginView.hidden = true;
    if (dashboardView) dashboardView.hidden = false;
    initDashboardAppNav();
    window.scrollTo(0, 0);
  }

  function showDashboardEntry(data, creator, email) {
    setSession(creator.id, email || creator.email);
    return withPublicMerge(creator).then(function (merged) {
      renderDashboard(data, merged);
      showDashboard();
    });
  }

  function tryLocalDemoSession(data) {
    if (!window.CreatorHubAuth || !CreatorHubAuth.isLocalHost()) {
      return Promise.resolve(false);
    }
    var session = getSession();
    if (!session || !session.creatorId) {
      return Promise.resolve(false);
    }
    var creator = findCreatorById(data, session.creatorId);
    if (!creator) {
      clearSession();
      return Promise.resolve(false);
    }
    return showDashboardEntry(data, creator, session.email).then(function () {
      showToast("Local preview — use email sign-in to sync to the cloud");
      return true;
    });
  }

  function openDashboardForActivation(data, activation) {
    var creator =
      findCreatorById(data, activation.creatorId) ||
      findCreatorBySlug(data, activation.slug);
    if (!creator) {
      if (loginError) {
        loginError.hidden = false;
        loginError.textContent =
          "Your account is registered but partner data could not be loaded. Contact partners@trekstakapp.com.";
      }
      showLogin();
      return Promise.resolve();
    }
    return showDashboardEntry(data, creator, activation.email);
  }

  function boot() {
    var header = document.querySelector(".site-header");
    if (header) {
      window.addEventListener(
        "scroll",
        function () {
          header.classList.toggle("is-scrolled", window.scrollY > 20);
        },
        { passive: true }
      );
      header.classList.toggle("is-scrolled", window.scrollY > 20);
    }

    loadAccounts()
      .then(function (data) {
        if (!window.CreatorHubAuth) {
          return tryLocalDemoSession(data).then(function (opened) {
            if (!opened) showLogin();
          });
        }

        return CreatorHubAuth.tryRestoreSession()
          .then(function (activation) {
            if (activation && (activation.creatorId || activation.slug)) {
              return openDashboardForActivation(data, activation);
            }
            return tryLocalDemoSession(data).then(function (opened) {
              if (!opened) showLogin();
            });
          })
          .catch(function (err) {
            console.warn("Creator Hub auth restore failed", err);
            return tryLocalDemoSession(data).then(function (opened) {
              if (!opened) showLogin();
            });
          });
      })
      .catch(function () {
        if (loginError) {
          loginError.hidden = false;
          loginError.textContent =
            "Could not load partner data. Try refreshing, or use the demo email below.";
        }
        showLogin();
      });
  }

  if (loginForm) {
    loginForm.addEventListener("submit", function (event) {
      event.preventDefault();
      handleSignIn();
    });
  }

  function handleSignIn() {
    if (loginError) loginError.hidden = true;
    var linkSent = document.getElementById("login-link-sent");
    if (linkSent) linkSent.hidden = true;

    var emailInput = document.getElementById("login-email");
    var email = emailInput ? emailInput.value : "";
    var submitBtn = document.getElementById("login-submit");

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Sending link…";
    }

    loadAccounts()
      .then(function (data) {
        var creator = findCreatorByEmail(data, email);
        if (!creator) {
          if (loginError) {
            loginError.hidden = false;
            loginError.textContent =
              "No partner account found for that email. Use your approved partner email or the demo address below.";
          }
          return;
        }

        if (!window.CreatorHubAuth) {
          return showDashboardEntry(data, creator, creator.email);
        }

        return CreatorHubAuth.sendSignInLink(creator.email).then(function () {
          if (linkSent) {
            linkSent.hidden = false;
            linkSent.textContent =
              "Check your inbox for a sign-in link. Open it on this device to continue.";
          }
          if (loginForm) loginForm.hidden = true;
        });
      })
      .catch(function (err) {
        if (loginError) {
          loginError.hidden = false;
          loginError.textContent =
            err && err.message
              ? err.message
              : "Could not send sign-in link. Try again later.";
        }
      })
      .finally(function () {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "Send sign-in link";
        }
      });
  }

  function handleDemoLocalPreview() {
    if (loginError) loginError.hidden = true;
    var linkSent = document.getElementById("login-link-sent");
    if (linkSent) linkSent.hidden = true;

    loadAccounts()
      .then(function (data) {
        var creator = findCreatorByEmail(data, "chris@demo.trekstakapp.com");
        if (!creator) {
          if (loginError) {
            loginError.hidden = false;
            loginError.textContent = "Demo account missing from partner data.";
          }
          return;
        }
        return showDashboardEntry(data, creator, creator.email);
      })
      .catch(function () {
        if (loginError) {
          loginError.hidden = false;
          loginError.textContent = "Could not open demo preview.";
        }
      });
  }

  var emailField = document.getElementById("login-email");
  if (emailField) {
    emailField.addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        handleSignIn();
      }
    });
  }

  if (signOutBtn) {
    signOutBtn.addEventListener("click", function () {
      clearSession();
      if (window.CreatorHubAuth) {
        CreatorHubAuth.signOut().catch(function () {
          /* ignore */
        });
      }
      if (loginForm) loginForm.hidden = false;
      var linkSent = document.getElementById("login-link-sent");
      if (linkSent) linkSent.hidden = true;
      showLogin();
      showToast("Signed out");
    });
  }

  var demoLocalBtn = document.getElementById("btn-demo-local");
  if (demoLocalBtn) {
    demoLocalBtn.addEventListener("click", handleDemoLocalPreview);
  }

  boot();
})();
