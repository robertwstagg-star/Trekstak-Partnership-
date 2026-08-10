(function () {
  "use strict";

  var SESSION_KEY = "trekstak-partner-session";
  var DATA_URL = "/data/creator-accounts.json";
  var accountsCache = null;

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

  function renderShareCaptions(captions, code) {
    if (!captions || !captions.length) return "";
    return captions
      .map(function (caption, index) {
        var id = "caption-" + index;
        return (
          '<div class="share-card">' +
          '<div class="share-card-head">' +
          "<strong>Caption " +
          (index + 1) +
          "</strong>" +
          '<button type="button" class="btn btn-outline btn-sm" data-copy-caption="' +
          index +
          '">Copy</button>' +
          "</div>" +
          '<textarea id="' +
          id +
          '" readonly aria-label="Caption ' +
          (index + 1) +
          '">' +
          escapeHtml(caption) +
          "</textarea>" +
          "</div>"
        );
      })
      .join("");
  }

  function renderDashboard(data, creator) {
    var stats = creator.stats || {};
    var travelTarget = data.travelRewardTarget || 500;
    var travelAmount = data.travelRewardAmount || 1000;
    var progress = stats.travelRewardProgress || 0;
    var progressPct = Math.min(100, Math.round((progress / travelTarget) * 100));
    var nextPayout = creator.nextPayout || {};

    document.getElementById("dash-greeting-name").textContent = creator.displayName;
    document.getElementById("dash-role").textContent =
      creator.role + " · " + creator.handle;

    document.getElementById("stat-code").textContent = creator.promoCode;
    document.getElementById("stat-uses").textContent = String(stats.codeUses || 0);
    document.getElementById("stat-subs").textContent = String(stats.qualifyingSubscribers || 0);
    document.getElementById("stat-revenue").textContent = formatMoney(stats.subscriptionRevenue || 0);
    document.getElementById("stat-earned").textContent = formatMoney(stats.commissionEarned || 0);
    document.getElementById("stat-pending").textContent = formatMoney(stats.commissionPending || 0);

    document.getElementById("code-hero-value").textContent = creator.promoCode;
    document.getElementById("code-hero-discount").textContent = creator.discountLabel || "";

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
    document.getElementById("share-captions").innerHTML = renderShareCaptions(
      creator.shareCaptions,
      creator.promoCode
    );

    var publicLink = document.getElementById("link-public-page");
    var publicPageUrl = document.getElementById("public-page-url");
    var publicDisplay = creator.publicPageUrl.replace(/^https:\/\//, "");
    publicLink.href = creator.publicPageUrl;
    publicLink.textContent = publicDisplay;
    if (publicPageUrl) publicPageUrl.textContent = publicDisplay;

    document.getElementById("link-app-store").href = creator.appStoreUrl;

    var qrImg = document.getElementById("qr-image");
    qrImg.src = qrUrl(creator.publicPageUrl);
    qrImg.alt = "QR code for " + creator.publicPageUrl;

    var payout = creator.payoutMethod || {};
    document.getElementById("payout-type").textContent = payout.type || "—";
    document.getElementById("payout-email").textContent = payout.email || "—";
    document.getElementById("payout-note").textContent = payout.note || "";

    document.getElementById("commission-rate").textContent =
      creator.commissionLabel || Math.round((creator.commissionRate || 0) * 100) + "%";

    bindDashboardActions(creator);
  }

  function bindDashboardActions(creator) {
    function bindCopyPage() {
      copyText(creator.publicPageUrl, "Public page link copied");
    }

    document.getElementById("btn-copy-code").onclick = function () {
      copyText(creator.promoCode, "Promo code copied");
    };
    document.getElementById("btn-copy-page").onclick = bindCopyPage;
    var copyPageShare = document.getElementById("btn-copy-page-share");
    if (copyPageShare) copyPageShare.onclick = bindCopyPage;
    document.getElementById("btn-copy-app-store").onclick = function () {
      copyText(creator.appStoreUrl, "App Store link copied");
    };

    document.querySelectorAll("[data-copy-caption]").forEach(function (btn) {
      btn.onclick = function () {
        var index = btn.getAttribute("data-copy-caption");
        var ta = document.getElementById("caption-" + index);
        if (ta) copyText(ta.value, "Caption copied");
      };
    });
  }

  function showLogin() {
    if (loginView) loginView.hidden = false;
    if (dashboardView) dashboardView.hidden = true;
  }

  function showDashboard() {
    if (loginView) loginView.hidden = true;
    if (dashboardView) dashboardView.hidden = false;
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
        var session = getSession();
        if (!session || !session.creatorId) {
          showLogin();
          return;
        }
        var creator = findCreatorById(data, session.creatorId);
        if (!creator) {
          clearSession();
          showLogin();
          return;
        }
        renderDashboard(data, creator);
        showDashboard();
      })
      .catch(function () {
        if (loginError) {
          loginError.hidden = false;
          loginError.textContent = "Could not load partner data. Try again later.";
        }
        showLogin();
      });
  }

  if (loginForm) {
    loginForm.addEventListener("submit", function (event) {
      event.preventDefault();
      if (loginError) loginError.hidden = true;

      var emailInput = document.getElementById("login-email");
      var email = emailInput ? emailInput.value : "";

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
          setSession(creator.id, creator.email);
          renderDashboard(data, creator);
          showDashboard();
        })
        .catch(function () {
          if (loginError) {
            loginError.hidden = false;
            loginError.textContent = "Could not sign in. Try again later.";
          }
        });
    });
  }

  if (signOutBtn) {
    signOutBtn.addEventListener("click", function () {
      clearSession();
      showLogin();
      showToast("Signed out");
    });
  }

  boot();
})();
