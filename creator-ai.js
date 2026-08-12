/* Creator AI — Phase 1 dashboard UI */

(function (global) {
  "use strict";

  var TREKSTAK_FEATURES = [
    "Self-guided walks",
    "Neighborhoods",
    "Quick Escapes",
    "Local Flavours",
    "Nightlife tours",
    "Family activities",
    "Viewpoints & gems",
    "Smart day planner",
    "Favorites / Stak lists",
    "General app overview",
  ];

  var TOOLS = [
    {
      id: "trekstak_content",
      label: "TrekStak Content",
      icon: "📱",
      description: "Content that naturally promotes TrekStak.",
      fields: [
        { key: "destination", label: "Destination", type: "text", placeholder: "Rome" },
        {
          key: "feature",
          label: "TrekStak feature",
          type: "select",
          options: TREKSTAK_FEATURES,
        },
        {
          key: "platform",
          label: "Platform",
          type: "select",
          options: ["Instagram", "TikTok", "YouTube", "Stories"],
        },
        {
          key: "format",
          label: "Format",
          type: "select",
          options: ["Reel", "Carousel", "Story sequence", "Post"],
        },
        {
          key: "tone",
          label: "Tone",
          type: "select",
          options: ["Casual / personal", "Educational", "Energetic", "Calm"],
        },
        {
          key: "additionalContext",
          label: "Extra context (optional)",
          type: "textarea",
          placeholder: "Anything else to include…",
        },
      ],
    },
    {
      id: "reel_ideas",
      label: "Reel Ideas",
      icon: "🎥",
      description: "Short-form video concepts and shot lists.",
      fields: [
        { key: "destination", label: "Destination", type: "text", placeholder: "Paris" },
        { key: "topic", label: "Topic", type: "text", placeholder: "3-day itinerary" },
        {
          key: "platform",
          label: "Platform",
          type: "select",
          options: ["Instagram Reels", "TikTok", "YouTube Shorts"],
        },
        {
          key: "style",
          label: "Style",
          type: "select",
          options: ["Casual", "Cinematic", "Fast-cut", "Talking head"],
        },
        { key: "includeTrekstak", label: "Include TrekStak integration", type: "checkbox" },
      ],
    },
    {
      id: "instagram",
      label: "Instagram",
      icon: "📸",
      description: "Posts, carousels, Stories, and captions.",
      fields: [
        {
          key: "brief",
          label: "What do you want to create?",
          type: "textarea",
          placeholder: "e.g. 5-slide carousel about preparing for a trip to Italy",
        },
        { key: "includeTrekstakCta", label: "Include TrekStak CTA", type: "checkbox" },
      ],
    },
    {
      id: "youtube",
      label: "YouTube",
      icon: "🎬",
      description: "Titles, hooks, outlines, and descriptions.",
      fields: [
        {
          key: "brief",
          label: "Video idea",
          type: "textarea",
          placeholder: "e.g. How I plan a 7-day trip to Italy",
        },
        { key: "includeTrekstak", label: "Include TrekStak integration", type: "checkbox" },
      ],
    },
    {
      id: "travel_content_ideas",
      label: "Travel Content Ideas",
      icon: "🗺️",
      description: "Grow your audience — not just TrekStak ads.",
      fields: [
        { key: "destination", label: "Destination or theme", type: "text", placeholder: "Barcelona" },
        { key: "count", label: "Number of ideas", type: "text", placeholder: "20" },
      ],
    },
    {
      id: "hooks_captions",
      label: "Hooks & Captions",
      icon: "✍️",
      description: "Quick hooks, captions, and CTAs.",
      fields: [
        {
          key: "brief",
          label: "What is the content about?",
          type: "textarea",
          placeholder: "Video showing my five favorite restaurants in Florence",
        },
        { key: "hookCount", label: "Hooks", type: "text", placeholder: "5" },
        { key: "captionCount", label: "Captions", type: "text", placeholder: "3" },
        { key: "ctaCount", label: "CTAs", type: "text", placeholder: "5" },
        { key: "includeTrekstakCta", label: "Include TrekStak CTA", type: "checkbox" },
      ],
    },
  ];

  var rootEl = null;
  var activeCreator = null;
  var currentToolId = null;
  var lastInputs = null;
  var usageEl = null;

  function escapeHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function toast(msg) {
    if (global.showDashboardToast) global.showDashboardToast(msg);
  }

  function callFunction(name, data) {
    if (!global.CreatorHubAuth) {
      return Promise.reject(new Error("Sign in with your email link to use Creator AI."));
    }
    return CreatorHubAuth.ensureFirebase().then(function (fb) {
      return fb.functions.httpsCallable(name)(data || {});
    });
  }

  function refreshUsage() {
    return callFunction("creatorAiGetUsage", {})
      .then(function (res) {
        var u = res.data;
        if (usageEl && u) {
          usageEl.textContent =
            u.remaining + " of " + u.limit + " generations left this month";
        }
        return u;
      })
      .catch(function () {
        if (usageEl) usageEl.textContent = "Sign in to see usage";
      });
  }

  function collectInputs(tool) {
    var inputs = {};
    tool.fields.forEach(function (field) {
      var el = document.getElementById("creator-ai-field-" + field.key);
      if (!el) return;
      if (field.type === "checkbox") {
        inputs[field.key] = el.checked;
      } else {
        inputs[field.key] = el.value.trim();
      }
    });
    return inputs;
  }

  function renderLanding() {
    currentToolId = null;
    var cards = TOOLS.map(function (tool) {
      return (
        '<button type="button" class="creator-ai-card" data-tool-id="' +
        escapeHtml(tool.id) +
        '">' +
        '<span class="creator-ai-card-icon" aria-hidden="true">' +
        tool.icon +
        "</span>" +
        '<span class="creator-ai-card-label">' +
        escapeHtml(tool.label) +
        "</span>" +
        '<span class="creator-ai-card-desc">' +
        escapeHtml(tool.description) +
        "</span>" +
        "</button>"
      );
    }).join("");

    rootEl.innerHTML =
      '<section class="dash-panel dash-panel--ai">' +
      '<div class="dash-panel-head dash-panel-head--section">' +
      "<h2>Creator AI</h2>" +
      '<span class="creator-ai-usage" id="creator-ai-usage"></span>' +
      "</div>" +
      '<p class="creator-ai-lede">What do you want to create?</p>' +
      '<div class="creator-ai-grid">' +
      cards +
      "</div>" +
      "</section>";

    usageEl = document.getElementById("creator-ai-usage");
    refreshUsage();

    rootEl.querySelectorAll(".creator-ai-card").forEach(function (btn) {
      btn.addEventListener("click", function () {
        renderToolForm(btn.getAttribute("data-tool-id"));
      });
    });
  }

  function renderToolForm(toolId) {
    var tool = TOOLS.find(function (t) {
      return t.id === toolId;
    });
    if (!tool) return;
    currentToolId = toolId;

    var fieldsHtml = tool.fields
      .map(function (field) {
        var id = "creator-ai-field-" + field.key;
        if (field.type === "textarea") {
          return (
            '<label class="field field-full">' +
            "<span>" +
            escapeHtml(field.label) +
            "</span>" +
            '<textarea id="' +
            id +
            '" rows="3" placeholder="' +
            escapeHtml(field.placeholder || "") +
            '"></textarea>' +
            "</label>"
          );
        }
        if (field.type === "checkbox") {
          return (
            '<label class="field field-full checkbox-field">' +
            '<input type="checkbox" id="' +
            id +
            '" />' +
            "<span>" +
            escapeHtml(field.label) +
            "</span>" +
            "</label>"
          );
        }
        if (field.type === "select") {
          var opts = (field.options || [])
            .map(function (o) {
              return "<option>" + escapeHtml(o) + "</option>";
            })
            .join("");
          return (
            '<label class="field">' +
            "<span>" +
            escapeHtml(field.label) +
            "</span>" +
            '<select id="' +
            id +
            '">' +
            opts +
            "</select>" +
            "</label>"
          );
        }
        return (
          '<label class="field">' +
          "<span>" +
          escapeHtml(field.label) +
          "</span>" +
          '<input type="text" id="' +
          id +
          '" placeholder="' +
          escapeHtml(field.placeholder || "") +
          '" />' +
          "</label>"
        );
      })
      .join("");

    rootEl.innerHTML =
      '<section class="dash-panel dash-panel--ai">' +
      '<div class="dash-panel-head dash-panel-head--section">' +
      '<button type="button" class="btn btn-ghost btn-sm creator-ai-back">← All tools</button>' +
      "<h2>" +
      escapeHtml(tool.icon + " " + tool.label) +
      "</h2>" +
      '<span class="creator-ai-usage" id="creator-ai-usage"></span>' +
      "</div>" +
      '<p class="creator-ai-lede">' +
      escapeHtml(tool.description) +
      "</p>" +
      '<form class="creator-ai-form" id="creator-ai-form">' +
      '<div class="creator-ai-fields">' +
      fieldsHtml +
      "</div>" +
      '<div class="form-actions">' +
      '<button type="submit" class="btn btn-primary" id="creator-ai-generate">Generate</button>' +
      "</div>" +
      "</form>" +
      '<div id="creator-ai-results" class="creator-ai-results" hidden></div>' +
      "</section>";

    usageEl = document.getElementById("creator-ai-usage");
    refreshUsage();

    rootEl.querySelector(".creator-ai-back").addEventListener("click", renderLanding);

    document.getElementById("creator-ai-form").addEventListener("submit", function (ev) {
      ev.preventDefault();
      runGenerate(false);
    });
  }

  function runGenerate(isRegenerate) {
    var tool = TOOLS.find(function (t) {
      return t.id === currentToolId;
    });
    if (!tool) return;

    var inputs = isRegenerate && lastInputs ? lastInputs : collectInputs(tool);
    lastInputs = inputs;

    var btn = document.getElementById("creator-ai-generate");
    var regenBtn = document.getElementById("creator-ai-regenerate");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Generating…";
    }
    if (regenBtn) {
      regenBtn.disabled = true;
    }

    callFunction("creatorAiGenerate", { toolId: currentToolId, inputs: inputs })
      .then(function (res) {
        renderResults(res.data);
        refreshUsage();
      })
      .catch(function (err) {
        var msg =
          (err && err.message) ||
          "Creator AI could not complete that request. Try again.";
        toast(msg);
      })
      .finally(function () {
        if (btn) {
          btn.disabled = false;
          btn.textContent = "Generate";
        }
        if (regenBtn) {
          regenBtn.disabled = false;
        }
      });
  }

  function renderResults(data) {
    var container = document.getElementById("creator-ai-results");
    if (!container || !data || !data.result) return;

    var sections = (data.result.sections || [])
      .map(function (sec, idx) {
        var body = escapeHtml(sec.body).replace(/\n/g, "<br>");
        return (
          '<article class="creator-ai-result-block">' +
          '<div class="creator-ai-result-head">' +
          "<h3>" +
          escapeHtml(sec.heading) +
          "</h3>" +
          '<button type="button" class="btn btn-outline btn-sm creator-ai-copy" data-copy-idx="' +
          idx +
          '">Copy</button>' +
          "</div>" +
          '<div class="creator-ai-result-body">' +
          body +
          "</div>" +
          "</article>"
        );
      })
      .join("");

    container.hidden = false;
    container.innerHTML =
      '<div class="creator-ai-results-head">' +
      "<h3>" +
      escapeHtml(data.result.title) +
      "</h3>" +
      '<div class="creator-ai-results-actions">' +
      '<button type="button" class="btn btn-outline btn-sm" id="creator-ai-copy-all">Copy all</button>' +
      '<button type="button" class="btn btn-primary btn-sm" id="creator-ai-regenerate">Regenerate</button>' +
      "</div></div>" +
      sections;

    container.querySelectorAll(".creator-ai-copy").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var idx = Number(btn.getAttribute("data-copy-idx"));
        var sec = data.result.sections[idx];
        if (sec && navigator.clipboard) {
          navigator.clipboard.writeText(sec.body).then(function () {
            toast("Copied");
          });
        }
      });
    });

    var copyAll = document.getElementById("creator-ai-copy-all");
    if (copyAll) {
      copyAll.addEventListener("click", function () {
        var text = data.result.sections
          .map(function (s) {
            return s.heading + "\n\n" + s.body;
          })
          .join("\n\n---\n\n");
        if (navigator.clipboard) {
          navigator.clipboard.writeText(text).then(function () {
            toast("Copied all");
          });
        }
      });
    }

    document.getElementById("creator-ai-regenerate").addEventListener("click", function () {
      runGenerate(true);
    });

    container.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function init(creator) {
    activeCreator = creator;
    rootEl = document.getElementById("creator-ai-root");
    if (!rootEl) return;
    renderLanding();
  }

  function onTabShow() {
    rootEl = document.getElementById("creator-ai-root");
    if (!rootEl) return;
    if (!rootEl.querySelector(".creator-ai-grid")) {
      currentToolId = null;
      renderLanding();
    }
    refreshUsage();
  }

  global.CreatorAI = {
    init: init,
    onTabShow: onTabShow,
  };
})(typeof window !== "undefined" ? window : globalThis);
