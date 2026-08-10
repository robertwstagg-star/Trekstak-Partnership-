(() => {
  const header = document.querySelector(".site-header");
  const revealEls = document.querySelectorAll(
    ".section-head, .card-grid, .steps, .offer-panel, .category-grid, .long-term-panel, .faq-list, .final-panel, .hero-benefits, .dashboard-layout, .founding-panel, .who-looking-inner, .earnings-panel, .growth-bonus-panel, .official-panel"
  );

  const onScroll = () => {
    if (!header) return;
    header.classList.toggle("is-scrolled", window.scrollY > 20);
  };

  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  revealEls.forEach((el) => el.classList.add("reveal"));

  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
    );
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add("is-visible"));
  }

  const params = new URLSearchParams(window.location.search);
  if (params.get("applied") === "1") {
    const success = document.getElementById("apply-success");
    const form = document.getElementById("partner-apply-form");
    if (success) success.hidden = false;
    if (form) form.hidden = true;
  }

  const form = document.getElementById("partner-apply-form");
  if (form) {
    form.addEventListener("submit", () => {
      const pack = (name, outName) => {
        const values = [...form.querySelectorAll(`input[name="${name}"]:checked`)].map((el) => el.value);
        let hidden = form.querySelector(`input[type="hidden"][name="${outName}"]`);
        if (!hidden) {
          hidden = document.createElement("input");
          hidden.type = "hidden";
          hidden.name = outName;
          form.appendChild(hidden);
        }
        hidden.value = values.join(", ");
        form.querySelectorAll(`input[name="${name}"]`).forEach((el) => {
          el.disabled = true;
        });
      };
      pack("Content focus", "Content focus summary");
      pack("Preferred collaboration", "Preferred collaboration summary");
    });
  }

  const rolePanel = document.getElementById("role-info-panel");
  const roleOpen = document.getElementById("role-info-open");
  const roleClose = document.getElementById("role-info-close");

  const setRolePanel = (open) => {
    if (!rolePanel || !roleOpen) return;
    rolePanel.hidden = !open;
    roleOpen.setAttribute("aria-expanded", open ? "true" : "false");
  };

  if (roleOpen && rolePanel) {
    roleOpen.addEventListener("click", () => {
      setRolePanel(rolePanel.hidden);
      if (!rolePanel.hidden && roleClose) roleClose.focus();
    });
  }

  if (roleClose) {
    roleClose.addEventListener("click", () => {
      setRolePanel(false);
      if (roleOpen) roleOpen.focus();
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && rolePanel && !rolePanel.hidden) {
      setRolePanel(false);
      if (roleOpen) roleOpen.focus();
    }
  });

  document.addEventListener("click", (event) => {
    if (!rolePanel || rolePanel.hidden) return;
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (rolePanel.contains(target) || (roleOpen && roleOpen.contains(target))) return;
    setRolePanel(false);
  });
})();
