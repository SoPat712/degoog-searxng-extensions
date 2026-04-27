// ── TMDB slot: client-side in-slot navigation ─────────────────────────────────
// Clicking a cast card with data-tmdb-nav="person" swaps the slot contents
// for a person panel fetched from /api/plugin/tmdb/person?id=...
// A back button is injected at the top to return to the previous panel.
// History is stored per-.tmdb-result instance on the element itself.

(function () {
  "use strict";

  const STACK_PROP = "__tmdbNavStack";
  const LOADING_CLASS = "tmdb-loading";

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[c]));
  }

  function findRoot(el) {
    return el && el.closest ? el.closest(".tmdb-result") : null;
  }

  function currentLabel(root) {
    if (!root) return "";
    const panel = root.querySelector(":scope > .tmdb-panel, .tmdb-panel");
    if (panel && panel.dataset && panel.dataset.tmdbLabel) {
      return panel.dataset.tmdbLabel;
    }
    return "";
  }

  function getStack(root) {
    if (!root[STACK_PROP]) root[STACK_PROP] = [];
    return root[STACK_PROP];
  }

  function backButtonHtml(label) {
    const text = label ? `\u2190 ${esc(label)}` : "\u2190 Back";
    const aria = label ? `Back to ${esc(label)}` : "Back";
    return (
      `<button type="button" class="tmdb-back-btn" aria-label="${aria}" ` +
      `data-tmdb-back="1">${text}</button>`
    );
  }

  function renderStackedHtml(root, newInnerHtml) {
    const stack = getStack(root);
    if (stack.length === 0) {
      // No history — just the new content, no back button.
      root.innerHTML = newInnerHtml;
      return;
    }
    const prevLabel = stack[stack.length - 1].label || "";
    root.innerHTML = backButtonHtml(prevLabel) + newInnerHtml;
  }

  async function navigate(root, type, id, fallbackName) {
    if (!root || !type || !id) return;

    // Capture current state for the back stack.
    const label = currentLabel(root) || "";
    const html = root.innerHTML;
    const stack = getStack(root);
    stack.push({ html, label });

    root.classList.add(LOADING_CLASS);
    root.setAttribute("aria-busy", "true");

    try {
      const url =
        `/api/plugin/tmdb/${encodeURIComponent(type)}` +
        `?id=${encodeURIComponent(id)}`;
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        credentials: "same-origin",
      });
      if (!res.ok) {
        throw new Error(`TMDB nav fetch failed: ${res.status}`);
      }
      const data = await res.json();
      if (!data || typeof data.html !== "string" || !data.html) {
        throw new Error("TMDB nav response missing html");
      }
      renderStackedHtml(root, data.html);
      // Scroll the slot into view so the user sees the new panel.
      try {
        root.scrollIntoView({ behavior: "smooth", block: "nearest" });
      } catch (_e) {
        // Older browsers: ignore.
      }
    } catch (err) {
      // Roll back the stack push since the navigation failed.
      stack.pop();
      if (window && window.console) {
        console.warn("[tmdb] navigation failed:", err, {
          type,
          id,
          fallbackName,
        });
      }
    } finally {
      root.classList.remove(LOADING_CLASS);
      root.removeAttribute("aria-busy");
    }
  }

  function goBack(root) {
    if (!root) return;
    const stack = getStack(root);
    const prev = stack.pop();
    if (!prev) return;
    root.innerHTML = prev.html;
    try {
      root.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } catch (_e) {
      // ignore
    }
  }

  // Click delegation: works for cast cards, back button, and any future
  // element with [data-tmdb-nav="..."] + [data-tmdb-id="..."].
  document.addEventListener(
    "click",
    function (e) {
      const target = e.target;
      if (!target || !target.closest) return;

      // Back button
      const back = target.closest("[data-tmdb-back]");
      if (back) {
        const root = findRoot(back);
        if (!root) return;
        e.preventDefault();
        e.stopPropagation();
        goBack(root);
        return;
      }

      // Navigation trigger (cast card, etc.)
      const navEl = target.closest("[data-tmdb-nav]");
      if (!navEl) return;

      // If the click happened on an internal anchor inside the nav card
      // (e.g. an external TMDB link we add later), let the anchor handle it.
      const anchor = target.closest("a");
      if (anchor && navEl.contains(anchor) && anchor !== navEl) return;

      const type = navEl.getAttribute("data-tmdb-nav");
      const id = navEl.getAttribute("data-tmdb-id");
      const name = navEl.getAttribute("data-tmdb-name") || "";
      if (!type || !id) return;

      const root = findRoot(navEl);
      if (!root) return;

      e.preventDefault();
      e.stopPropagation();
      navigate(root, type, id, name);
    },
    false,
  );

  // Keyboard accessibility: Enter/Space on a focused nav element activates it.
  document.addEventListener(
    "keydown",
    function (e) {
      if (e.key !== "Enter" && e.key !== " " && e.key !== "Spacebar") return;
      const target = e.target;
      if (!target || !target.matches) return;

      if (target.matches("[data-tmdb-back]")) {
        e.preventDefault();
        const root = findRoot(target);
        if (root) goBack(root);
        return;
      }

      if (target.matches("[data-tmdb-nav]")) {
        e.preventDefault();
        const type = target.getAttribute("data-tmdb-nav");
        const id = target.getAttribute("data-tmdb-id");
        const name = target.getAttribute("data-tmdb-name") || "";
        const root = findRoot(target);
        if (root && type && id) navigate(root, type, id, name);
      }
    },
    false,
  );
})();
