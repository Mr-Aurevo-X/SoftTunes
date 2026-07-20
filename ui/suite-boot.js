/**
 * Suite boot helpers: accent + language from Launcher.
 * Expects pywebview api.get_suite_settings() -> { ok, accent, language }
 * or get_suite_accent / get_suite_language.
 */
(function (global) {
  const DEFAULT_ACCENT = "#e03545";
  const PRIVACY = {
    fr: "Aucune collecte de données par Mr-Aurevo-X. Tout reste sur cet ordinateur.",
    en: "Mr-Aurevo-X does not collect your data. Everything stays on this PC.",
  };

  function normalizeAccent(value) {
    const accent = String(value || "").trim();
    if (accent.startsWith("#") && (accent.length === 4 || accent.length === 7)) return accent;
    return DEFAULT_ACCENT;
  }

  function applyAccent(hex) {
    const accent = normalizeAccent(hex);
    let h = accent.slice(1);
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    const root = document.documentElement;
    root.style.setProperty("--accent", accent);
    root.style.setProperty("--accent-dim", `rgba(${r}, ${g}, ${b}, 0.2)`);
    root.style.setProperty("--accent-glow", `rgba(${r}, ${g}, ${b}, 0.4)`);
    return accent;
  }

  function applyI18n(lang, dict) {
    const pack = (dict && dict[lang]) || (dict && dict.fr) || {};
    document.documentElement.lang = lang === "en" ? "en" : "fr";
    document.querySelectorAll("[data-i18n]").forEach((node) => {
      const key = node.getAttribute("data-i18n");
      if (key && pack[key] != null) node.textContent = pack[key];
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
      const key = node.getAttribute("data-i18n-placeholder");
      if (key && pack[key] != null) node.setAttribute("placeholder", pack[key]);
    });
    document.querySelectorAll("[data-i18n-title]").forEach((node) => {
      const key = node.getAttribute("data-i18n-title");
      if (key && pack[key] != null) node.setAttribute("title", pack[key]);
    });
    const privacy = document.getElementById("privacyNote") || document.querySelector(".privacy-note");
    if (privacy) {
      const custom = pack.privacy;
      privacy.textContent = custom || PRIVACY[lang] || PRIVACY.fr;
    }
  }

  async function loadSuiteSettings(api) {
    const out = { language: "fr", accent: DEFAULT_ACCENT };
    try {
      if (api && typeof api.get_suite_settings === "function") {
        const res = await api.get_suite_settings();
        if (res && res.ok) {
          if (res.language === "en" || res.language === "fr") out.language = res.language;
          if (res.accent) out.accent = normalizeAccent(res.accent);
          return out;
        }
      }
      if (api && typeof api.get_suite_language === "function") {
        const res = await api.get_suite_language();
        if (res && res.language) out.language = res.language === "en" ? "en" : "fr";
      }
      if (api && typeof api.get_suite_accent === "function") {
        const res = await api.get_suite_accent();
        if (res && res.accent) out.accent = normalizeAccent(res.accent);
      }
    } catch (_) {}
    return out;
  }

  global.MrAurevoXSuite = {
    PRIVACY,
    applyAccent,
    applyI18n,
    loadSuiteSettings,
    normalizeAccent,
  };
})(typeof window !== "undefined" ? window : globalThis);
