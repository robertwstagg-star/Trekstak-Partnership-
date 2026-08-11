(function (global) {
  "use strict";

  var NAV_ICONS = {
    page: "\u25A3",
    earn: "\u0024",
    share: "\u2197",
    home: "\u2302",
    live: "\u25CF",
    cities: "\u2637",
    posts: "\u2261"
  };

  function parseHashTab(fallback) {
    var hash = (location.hash || "").replace(/^#/, "").trim().toLowerCase();
    return hash || fallback || "home";
  }

  function setHashTab(tabId) {
    var next = "#" + tabId;
    if (location.hash !== next) {
      try {
        history.replaceState(null, "", next);
      } catch (e) {
        location.hash = tabId;
      }
    }
  }

  function mountTabPanels(options) {
    var root = options.root;
    if (!root) return;

    var tabs = options.tabs || [];
    var tabById = {};
    tabs.forEach(function (t) {
      tabById[t.id] = t;
    });

    var defaultTab = options.defaultTab || tabs[0].id;
    var activeTab = tabById[parseHashTab(defaultTab)] ? parseHashTab(defaultTab) : defaultTab;

    var tabsEl = root.querySelector(".webapp-tabs");
    var panelsEl = root.querySelector(".webapp-panels");
    if (!tabsEl || !panelsEl) return;

    function activate(tabId) {
      if (!tabById[tabId]) return;
      activeTab = tabId;
      setHashTab(tabId);

      tabsEl.querySelectorAll(".webapp-tab").forEach(function (btn) {
        var isActive = btn.getAttribute("data-tab") === tabId;
        btn.classList.toggle("is-active", isActive);
        btn.setAttribute("aria-selected", isActive ? "true" : "false");
      });

      panelsEl.querySelectorAll(".webapp-panel").forEach(function (panel) {
        var show = panel.getAttribute("data-panel") === tabId;
        panel.hidden = !show;
      });
    }

    tabsEl.querySelectorAll(".webapp-tab").forEach(function (btn) {
      btn.addEventListener("click", function () {
        activate(btn.getAttribute("data-tab"));
      });
    });

    window.addEventListener("hashchange", function () {
      var next = parseHashTab(defaultTab);
      if (tabById[next]) activate(next);
    });

    activate(activeTab);
  }

  function mountBottomNav(options) {
    var nav = options.nav;
    if (!nav) return;

    var tabs = options.tabs || [];
    var viewAttr = options.viewAttr || "data-app-view";
    var defaultTab = options.defaultTab || tabs[0].id;
    var tabById = {};
    tabs.forEach(function (t) {
      tabById[t.id] = t;
    });

    var activeTab = tabById[parseHashTab(defaultTab)] ? parseHashTab(defaultTab) : defaultTab;
    var scope = options.scope || document;

    function activate(tabId) {
      if (!tabById[tabId]) return;
      activeTab = tabId;
      setHashTab(tabId);

      nav.querySelectorAll(".webapp-nav-btn").forEach(function (btn) {
        var isActive = btn.getAttribute("data-tab") === tabId;
        btn.classList.toggle("is-active", isActive);
        btn.setAttribute("aria-current", isActive ? "page" : "false");
      });

      scope.querySelectorAll("[" + viewAttr + "]").forEach(function (el) {
        var view = el.getAttribute(viewAttr);
        var show = view === "all" || view === tabId;
        el.hidden = !show;
      });

      if (typeof options.onChange === "function") {
        options.onChange(tabId);
      }
    }

    nav.querySelectorAll(".webapp-nav-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        activate(btn.getAttribute("data-tab"));
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    });

    window.addEventListener("hashchange", function () {
      var next = parseHashTab(defaultTab);
      if (tabById[next]) activate(next);
    });

    nav.hidden = false;
    document.body.classList.add("webapp-has-nav");
    activate(activeTab);
  }

  function buildTabButtons(tabs, className) {
    return tabs
      .map(function (tab) {
        var badge = tab.badge
          ? '<span class="webapp-tab-badge" aria-hidden="true"></span>'
          : "";
        return (
          '<button type="button" class="' +
          className +
          '" data-tab="' +
          tab.id +
          '" role="tab" aria-selected="false">' +
          tab.label +
          badge +
          "</button>"
        );
      })
      .join("");
  }

  function buildNavButtons(tabs) {
    return tabs
      .map(function (tab) {
        var icon = NAV_ICONS[tab.id] || "\u2022";
        return (
          '<button type="button" class="webapp-nav-btn" data-tab="' +
          tab.id +
          '" type="button">' +
          '<span class="webapp-nav-icon" aria-hidden="true">' +
          icon +
          "</span>" +
          "<span>" +
          tab.label +
          "</span>" +
          "</button>"
        );
      })
      .join("");
  }

  function registerServiceWorker(path) {
    if (!("serviceWorker" in navigator)) return;
    window.addEventListener("load", function () {
      navigator.serviceWorker.register(path).catch(function (err) {
        console.warn("Service worker registration failed", err);
      });
    });
  }

  global.TrekStakWebApp = {
    mountTabPanels: mountTabPanels,
    mountBottomNav: mountBottomNav,
    buildTabButtons: buildTabButtons,
    buildNavButtons: buildNavButtons,
    registerServiceWorker: registerServiceWorker
  };
})(typeof window !== "undefined" ? window : globalThis);
