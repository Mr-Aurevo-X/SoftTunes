/**
 * Copyright (c) 2026 Mr-Aurevo-X. All rights reserved.
 * SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
 * Author: Mr-Aurevo-X | https://github.com/Mr-Aurevo-X
 *
 * Shared « À propos » panel for Mr-Aurevo-X suite apps.
 *
 * Usage:
 *   <div id="aboutRoot"></div>
 *   <script src="suite-about.js"></script>
 *   MrAurevoXAbout.mount("#aboutRoot", {
 *     productName: "SiteCheck",
 *     version: "1.0.0",
 *     tagline: "Vérification de sites web",
 *     taglineEn: "Website health check",
 *     productIcon: "app-icon.svg",
 *     editorIcon: "brand-icon.png",
 *     legalBase: "legal/",
 *     language: "fr",
 *   });
 *
 * Legal markdown files live under legalBase:
 *   privacy.fr.md, privacy.en.md, terms.*, mentions.*, notices.*
 * Use {{PRODUCT}} in those files; it is replaced at load time.
 */
(function (global) {
  "use strict";

  const I18N = {
    fr: {
      aboutEditor: "Éditeur",
      legalPrivacy: "Confidentialité",
      legalTerms: "CGU",
      legalMentions: "Mentions",
      legalNotices: "Licences",
      privacyFoot: "Local-first · pas de collecte éditeur · pas de MAJ auto",
      supportHint: "Si le boulot te plaît, un café — sinon profite.",
      disclaimer:
        "Logiciel fourni « en l’état ». Vous êtes responsable des actions lancées. Aucune collecte de données par Mr-Aurevo-X.",
    },
    en: {
      aboutEditor: "Publisher",
      legalPrivacy: "Privacy",
      legalTerms: "Terms",
      legalMentions: "Legal notice",
      legalNotices: "Licenses",
      privacyFoot: "Local-first · no publisher collection · no auto-update",
      supportHint: "If this helped, a coffee is welcome — otherwise just enjoy it.",
      disclaimer:
        "Software provided “as is”. You are responsible for actions you run. Mr-Aurevo-X does not collect your data.",
    },
  };

  const DOCS = ["privacy", "terms", "mentions", "notices"];
  const cache = {};

  function t(lang, key) {
    const pack = I18N[lang] || I18N.fr;
    return pack[key] || I18N.fr[key] || key;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function buildHtml(opts, lang) {
    const name = opts.productName || "App";
    const version = opts.version || "";
    const tagline = lang === "en" ? opts.taglineEn || opts.tagline || "" : opts.tagline || opts.taglineEn || "";
    const productIcon = opts.productIcon || "app-icon.svg";
    const editorIcon = opts.editorIcon || "brand-icon.png";
    const disclaimer = opts.disclaimer || t(lang, "disclaimer");

    const tabs = DOCS.map((doc, i) => {
      const labelKey =
        doc === "privacy"
          ? "legalPrivacy"
          : doc === "terms"
            ? "legalTerms"
            : doc === "mentions"
              ? "legalMentions"
              : "legalNotices";
      return `<button type="button" class="legal-tab${i === 0 ? " active" : ""}" data-doc="${doc}">${escapeHtml(
        t(lang, labelKey)
      )}</button>`;
    }).join("");

    return `<div class="about-panel suite-about">
      <div class="about-product">
        <img src="${escapeHtml(productIcon)}" width="72" height="72" alt="" />
        <div>
          <h2>${escapeHtml(name)}</h2>
          <p class="muted about-tagline">${escapeHtml(tagline)}</p>
          ${version ? `<p class="mono muted about-version">v${escapeHtml(version)}</p>` : ""}
        </div>
      </div>
      <div class="about-editor">
        <img src="${escapeHtml(editorIcon)}" width="48" height="48" alt="" class="editor-mark" />
        <div>
          <h3>${escapeHtml(t(lang, "aboutEditor"))}</h3>
          <p>© 2026 Mr-Aurevo-X</p>
        </div>
      </div>
      <p class="muted about-disclaimer">${escapeHtml(disclaimer)}</p>
      <div class="about-support">
        <p class="muted small">${escapeHtml(t(lang, "supportHint"))}</p>
        <p class="about-support-links">
          <a href="https://discord.com/users/406891052516114442" target="_blank" rel="noopener noreferrer">Discord</a>
          · <a href="https://github.com/Mr-Aurevo-X#user-content-support" target="_blank" rel="noopener noreferrer">Crypto tips</a>
        </p>
      </div>
      <div class="legal-tabs" role="tablist">${tabs}</div>
      <article class="legal-body" data-legal-body></article>
      <p class="muted small about-privacy-foot">${escapeHtml(t(lang, "privacyFoot"))}</p>
    </div>`;
  }

  async function loadLegal(root, opts, doc, lang) {
    const base = (opts.legalBase || "legal/").replace(/\/?$/, "/");
    const file = `${base}${doc}.${lang}.md`;
    const cacheKey = `${file}|${opts.productName || ""}`;
    const body = root.querySelector("[data-legal-body]");
    if (!body) return;
    try {
      if (!cache[cacheKey]) {
        const res = await fetch(file, { cache: "no-store" });
        let text = res.ok ? await res.text() : `(${doc})`;
        text = text.replace(/\{\{PRODUCT\}\}/g, opts.productName || "App");
        cache[cacheKey] = text;
      }
      body.textContent = cache[cacheKey];
    } catch (_) {
      body.textContent = "(…)";
    }
  }

  function wire(root, opts, lang) {
    const tabs = root.querySelector(".legal-tabs");
    if (!tabs) return;
    tabs.addEventListener("click", (ev) => {
      const tab = ev.target.closest(".legal-tab");
      if (!tab) return;
      tabs.querySelectorAll(".legal-tab").forEach((x) => x.classList.toggle("active", x === tab));
      loadLegal(root, opts, tab.dataset.doc || "privacy", lang);
    });
  }

  /**
   * @param {string|HTMLElement} target
   * @param {object} options
   */
  function mount(target, options) {
    const opts = options || {};
    const lang = opts.language === "en" ? "en" : "fr";
    const el = typeof target === "string" ? document.querySelector(target) : target;
    if (!el) return null;
    el.innerHTML = buildHtml(opts, lang);
    wire(el, opts, lang);
    loadLegal(el, opts, "privacy", lang);
    el._suiteAbout = { opts, lang, remount: () => mount(el, { ...opts, language: lang }) };
    return el;
  }

  function setLanguage(root, language) {
    if (!root || !root._suiteAbout) return;
    const opts = { ...root._suiteAbout.opts, language: language === "en" ? "en" : "fr" };
    mount(root, opts);
  }

  global.MrAurevoXAbout = {
    mount,
    setLanguage,
    I18N,
  };
})(typeof window !== "undefined" ? window : globalThis);
