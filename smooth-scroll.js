(function () {
  "use strict";

  var DURATION_MS = 1000;

  function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function getScrollOffset() {
    var header = document.querySelector(".site-header");
    return header ? header.offsetHeight + 14 : 0;
  }

  function smoothScrollToY(targetY) {
    var startY = window.scrollY;
    var distance = targetY - startY;
    if (Math.abs(distance) < 2) return;

    if (prefersReducedMotion()) {
      window.scrollTo(0, targetY);
      return;
    }

    var startTime = performance.now();

    function step(now) {
      var elapsed = now - startTime;
      var progress = Math.min(elapsed / DURATION_MS, 1);
      window.scrollTo(0, startY + distance * easeInOutCubic(progress));
      if (progress < 1) {
        requestAnimationFrame(step);
      }
    }

    requestAnimationFrame(step);
  }

  function scrollToHash(hash, pushHistory) {
    if (!hash || hash === "#") return false;
    var id = hash.replace(/^#/, "");
    var target = document.getElementById(id);
    if (!target) return false;

    var top =
      target.getBoundingClientRect().top + window.scrollY - getScrollOffset();
    smoothScrollToY(Math.max(0, top));

    if (pushHistory) {
      history.pushState(null, "", "#" + id);
    }

    return true;
  }

  document.addEventListener("click", function (event) {
    var link = event.target.closest("a[href^='#']");
    if (!link) return;

    var href = link.getAttribute("href");
    if (!href || href === "#") return;
    if (link.target === "_blank" || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }

    if (scrollToHash(href, true)) {
      event.preventDefault();
    }
  });

  window.addEventListener("load", function () {
    if (location.hash) {
      window.setTimeout(function () {
        scrollToHash(location.hash, false);
      }, 80);
    }
  });
})();
