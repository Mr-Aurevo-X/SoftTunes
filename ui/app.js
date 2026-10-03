/**
 * Copyright (c) 2026 Mr-Aurevo-X. All rights reserved.
 * SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
 * Author: Mr-Aurevo-X | https://github.com/Mr-Aurevo-X
 */
/* SoftTunes UI — pywebview bridge (repo/build: Opti) */
(function () {
  "use strict";

  const B = window.SoftTunesBridge;
  const I18N_ROOT = window.SoftTunesI18n || {};
  const SUITE_I18N = I18N_ROOT.SUITE_I18N || { fr: {}, en: {} };
  const PAGE_META = I18N_ROOT.PAGE_META || { fr: {}, en: {} };
  const PAGE_ALIASES = I18N_ROOT.PAGE_ALIASES || {};

  const APP_VERSION = "2.0.0";
  const OVERLAY_KEY = "opti-fps-overlay";
  const OVERLAY_CFG_KEY = "opti-overlay-config";
  const ADV_KEY = "opti-advanced-mode";
  const HONESTY_KEY = "softtunes-honesty-ack";
  const SESSION_OPTS_KEY = "softtunes-session-opts";

  const LEGAL_FILES = {
    terms: { fr: "legal/terms.fr.md", en: "legal/terms.en.md" },
    privacy: { fr: "legal/privacy.fr.md", en: "legal/privacy.en.md" },
    mentions: { fr: "legal/mentions.fr.md", en: "legal/mentions.en.md" },
    notices: { fr: "legal/notices.fr.md", en: "legal/notices.en.md" },
  };

  const PAGE_TIPS = {
    dash: ["score", "bottleneck", "overlays"],
    session: ["overlays", "stutter", "softperf"],
    fps: ["fps-frametime", "stutter", "bottleneck"],
    nvidia: ["softperf", "soft-vs-ab", "thermals"],
    amd: ["softperf", "overlays", "vram"],
    clean: ["vram"],
    net: [],
    background: ["stutter"],
    sessions: [],
    about: ["score"],
  };

  const DNS_PRESETS_FALLBACK = [
    { id: "cloudflare", name: "Cloudflare" },
    { id: "google", name: "Google" },
    { id: "quad9", name: "Quad9" },
    { id: "dhcp", name: "Automatique (DHCP)" },
  ];

  const OVERLAY_PRESETS = {
    minimal: {
      layout: "line",
      show: {
        brand: false, fps: true, frametime: false, onePercentLow: false,
        app: false, cpu: false, cpuTemp: false, gpu: false, gpuTemp: false, ram: false,
      },
    },
    standard: {
      layout: "line",
      show: {
        brand: false, fps: true, frametime: true, onePercentLow: true,
        app: true, cpu: false, cpuTemp: false, gpu: true, gpuTemp: false, ram: false,
      },
    },
    full: null,
  };

  let lang = "fr";
  let currentPage = "dash";
  let monitorTimer = null;
  const legalCache = {};
  let tipsCache = null;
  /** @type {{ nvidia: boolean, amd: boolean, names: string }} */
  let gpuDetect = { nvidia: false, amd: false, names: "" };

  const $ = B.$;
  const $$ = B.$$;
  const esc = B.esc;
  const log = B.log;
  const setStatus = B.setStatus;
  const run = (action, payload) => B.run(action, payload);
  const runJob = (action, payload) => B.runJob(action, payload);

  function pack() {
    return SUITE_I18N[lang] || SUITE_I18N.fr;
  }

  function t(key, vars) {
    let s = pack()[key] || key;
    if (vars != null && typeof vars === "object" && !Array.isArray(vars)) {
      Object.keys(vars).forEach((k) => {
        s = String(s).split(`{${k}}`).join(String(vars[k] == null ? "" : vars[k]));
      });
    } else if (arguments.length > 1) {
      Array.prototype.slice.call(arguments, 1).forEach((a, i) => {
        s = String(s).split(`{${i}}`).join(String(a));
      });
    }
    return s;
  }

  function syncLangSwitch() {
    const root = $("#langSwitch");
    if (!root) return;
    root.querySelectorAll("[data-lang]").forEach((btn) => {
      const on = btn.getAttribute("data-lang") === lang;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
    root.setAttribute("aria-label", t("langSwitchAria"));
  }

  async function persistLanguage(next) {
    try { localStorage.setItem("opti-lang", next); } catch (_) {}
    try {
      if (B.api && typeof B.api.set_suite_language === "function") {
        await B.api.set_suite_language(next);
      }
    } catch (_) {}
  }

  async function resolveBootLanguage() {
    try {
      if (B.api?.get_suite_settings) {
        const res = await B.api.get_suite_settings();
        if (res && (res.language === "en" || res.language === "fr")) return res.language;
      }
      if (B.api?.get_suite_language) {
        const res = await B.api.get_suite_language();
        if (res && (res.language === "en" || res.language === "fr")) return res.language;
      }
    } catch (_) {}
    try {
      const saved = localStorage.getItem("opti-lang");
      if (saved === "en" || saved === "fr") return saved;
    } catch (_) {}
    if (navigator.language && navigator.language.toLowerCase().startsWith("en")) return "en";
    return "fr";
  }

  let lastReleaseInfo = null;

  function applyGpuVendorPages() {
    const hasNv = !!gpuDetect.nvidia;
    const hasAmd = !!gpuDetect.amd;
    const nvBody = $("#nvidiaBody");
    const nvEmpty = $("#nvidiaEmpty");
    const nvMsg = $("#nvidiaEmptyMsg");
    const amdBody = $("#amdBody");
    const amdEmpty = $("#amdEmpty");
    const amdMsg = $("#amdEmptyMsg");
    if (nvBody) nvBody.hidden = !hasNv;
    if (nvEmpty) nvEmpty.hidden = hasNv;
    if (amdBody) amdBody.hidden = !hasAmd;
    if (amdEmpty) amdEmpty.hidden = hasAmd;
    const other = gpuDetect.names || "—";
    if (nvMsg && !hasNv) {
      nvMsg.textContent = hasAmd || other !== "—"
        ? t("gpuEmptyNvidiaOther", other)
        : t("gpuEmptyNvidia");
    }
    if (amdMsg && !hasAmd) {
      amdMsg.textContent = hasNv || other !== "—"
        ? t("gpuEmptyAmdOther", other)
        : t("gpuEmptyAmd");
    }
    // Keep both nav entries visible so the empty message is reachable.
    const navNv = $("#navNvidia");
    const navAmd = $("#navAmd");
    if (navNv) navNv.hidden = false;
    if (navAmd) navAmd.hidden = false;
  }

  function ingestGpuDetect(gpu, extras) {
    const gpus = (gpu && gpu.gpus) || [];
    const names = gpus.map((g) => g && g.name).filter(Boolean).join(", ") || gpuDetect.names || "";
    let hasNv = gpus.some((g) => String(g.vendor || "").toLowerCase() === "nvidia");
    let hasAmd = gpus.some((g) => String(g.vendor || "").toLowerCase() === "amd");
    const top = String((gpu && gpu.vendor) || "").toLowerCase();
    if (top === "nvidia") hasNv = true;
    if (top === "amd") hasAmd = true;
    if (extras) {
      if (extras.nvidiaAvailable) hasNv = true;
      if (extras.amdAvailable) hasAmd = true;
    }
    gpuDetect = { nvidia: hasNv, amd: hasAmd, names: names || "—" };
    applyGpuVendorPages();
  }

  function applyI18n() {
    document.documentElement.lang = lang === "en" ? "en" : "fr";
    if (window.MrAurevoXSuite) {
      window.MrAurevoXSuite.applyI18n(lang, SUITE_I18N);
    } else {
      document.querySelectorAll("[data-i18n]").forEach((el) => {
        const key = el.getAttribute("data-i18n");
        if (key && pack()[key]) el.textContent = pack()[key];
      });
    }
    syncLangSwitch();
    applyGpuVendorPages();
    const hint = $("#aboutUpdateHint");
    const chk = $("#chkGithubUpdates");
    if (hint && chk) {
      hint.textContent = chk.checked ? t("aboutUpdateHintOn") : t("aboutUpdateHintOff");
    }
    if (lastReleaseInfo && lastReleaseInfo.updateAvailable) {
      paintReleaseBanner(lastReleaseInfo);
    }
  }

  async function setLang(next) {
    if (next !== "fr" && next !== "en") return;
    if (next === lang) {
      syncLangSwitch();
      return;
    }
    lang = next;
    await persistLanguage(lang);
    // Drop legal cache so FR/EN docs reload for the new language.
    Object.keys(legalCache).forEach((k) => { delete legalCache[k]; });
    applyI18n();
    const aboutVer = $("#aboutVersion");
    if (aboutVer) aboutVer.textContent = `v${APP_VERSION} · ${t("versionFinal")}`;
    const meta = (PAGE_META[lang] || PAGE_META.fr)[currentPage];
    if (meta) {
      $("#pageTitle").textContent = meta[0];
      $("#pageSub").textContent = meta[1];
    }
    const dlg = $("#aboutDialog");
    if (dlg && (dlg.open || dlg.hasAttribute("open"))) {
      const active = document.querySelector(".about-legal-links [data-doc].active");
      loadLegal(active?.getAttribute("data-doc") || "terms").catch(() => {});
    }
  }

  function maybeShowHonestyGate(force) {
    const gate = $("#honestyGate");
    if (!gate) return;
    if (!force) {
      try {
        if (localStorage.getItem(HONESTY_KEY) === APP_VERSION) return;
      } catch (_) {}
    }
    gate.hidden = false;
    document.body.classList.add("pcd-confirm-open");
  }

  function hideHonestyGate(persist) {
    const gate = $("#honestyGate");
    if (gate) gate.hidden = true;
    document.body.classList.remove("pcd-confirm-open");
    if (persist) {
      try { localStorage.setItem(HONESTY_KEY, APP_VERSION); } catch (_) {}
    }
  }

  function setPill(id, ok) {
    const el = $(id);
    if (!el) return;
    el.classList.remove("ok", "warn", "bad");
    el.classList.add(ok ? "ok" : "warn");
  }

  function renderReadiness(h) {
    if (!h) return;
    const rd = h.readiness || {};
    setPill("#pillPower", rd.powerOk);
    setPill("#pillGameMode", rd.gameModeOk);
    setPill("#pillRam", rd.ramOk);
    setPill("#pillCpu", rd.cpuOk);
    const ramPct = h.ram ? h.ram.usedPercent : "—";
    const power = h.powerPlan || "—";
    const gm = h.gameMode ? "ON" : "OFF";
    const stats = $("#dashStats");
    if (stats) {
      stats.innerHTML = `
        <div class="stat"><div class="label">RAM</div><div class="value">${ramPct}%</div></div>
        <div class="stat blue"><div class="label">CPU</div><div class="value">${h.cpuLoad || 0}%</div></div>
        <div class="stat ok"><div class="label">Power</div><div class="value" style="font-size:0.95rem">${esc(power)}</div></div>
        <div class="stat warn"><div class="label">Game Mode</div><div class="value">${gm}</div></div>`;
    }
  }

  async function refreshHealth(prefetched) {
    const h = prefetched || (await run("getHealth", {}));
    renderReadiness(h);
    return h;
  }

  function applyAdvancedMode(on) {
    document.body.classList.toggle("mode-advanced", !!on);
    try { localStorage.setItem(ADV_KEY, on ? "1" : "0"); } catch (_) {}
    const expert = $(".nav-group-expert");
    if (expert) expert.hidden = !on;
    const active = $(".nav-btn.active");
    if (active && active.closest(".nav-group-expert") && !on) showPage("dash");
  }

  function stopMonitorPoll() {
    if (monitorTimer) { clearInterval(monitorTimer); monitorTimer = null; }
  }

  function startMonitorPoll() {
    stopMonitorPoll();
    monitorTimer = setInterval(() => { refreshMonitor().catch(() => {}); }, 1000);
  }

  function showPage(page) {
    const resolved = PAGE_ALIASES[page] || page;
    currentPage = resolved;
    $$(".page").forEach((p) => p.classList.remove("active"));
    $$(".nav-btn").forEach((b) => b.classList.toggle("active", b.dataset.page === resolved));
    const el = $(`#page-${resolved}`);
    if (el) el.classList.add("active");
    const meta = (PAGE_META[lang] || PAGE_META.fr)[resolved] || [resolved, ""];
    const title = $("#pageTitle");
    const sub = $("#pageSub");
    if (title) title.textContent = meta[0];
    if (sub) sub.textContent = meta[1];
    const helpBtn = $("#btnPageHelp");
    if (helpBtn) helpBtn.hidden = !(PAGE_TIPS[resolved] || []).length;

    if (resolved === "net") refreshDns().catch(() => {});
    if (resolved === "nvidia") {
      refreshSoftPerf().catch(() => {});
      refreshSoftOc().catch(() => {});
    }
    if (resolved === "amd") {
      refreshSoftPerf().catch(() => {});
      refreshAmd().catch(() => {});
    }
    if (resolved === "background") {
      const tab = $(".bg-tab.active");
      if (!tab || tab.dataset.bgTab === "services") refreshServices().catch(() => {});
      else refreshStartup().catch(() => {});
    }
    if (resolved === "session") {
      refreshPower().catch(() => {});
      refreshGameMode().catch(() => {});
      refreshBoost().catch(() => {});
      refreshProfiles().catch(() => {});
      restoreSessionOpts();
    }
    if (resolved === "sessions") refreshSessions().catch(() => {});

    const api = B.api;
    if (resolved === "fps") {
      if (api && api.start_fps_monitor) api.start_fps_monitor().catch(() => {});
      startMonitorPoll();
      refreshMonitor().catch(() => {});
      loadOverlayConfig().catch(() => {});
    } else {
      stopMonitorPoll();
      if (api && api.stop_fps_monitor) api.stop_fps_monitor().catch(() => {});
    }
  }

  function collectSessionPayload(fromDash) {
    const chkRp = fromDash ? $("#chkCreateRp") : null;
    return {
      createRestorePoint: fromDash ? !!(chkRp && chkRp.checked) : false,
      powerProfile: "high",
      gameMode: $("#chkGameMode") ? !!$("#chkGameMode").checked : true,
      disableGameBar: $("#chkDisableBar") ? !!$("#chkDisableBar").checked : true,
      focusAssist: $("#chkFocus") ? !!$("#chkFocus").checked : true,
      visual: $("#chkFx") ? !!$("#chkFx").checked : true,
      killOverlays: $("#chkKillOv") ? !!$("#chkKillOv").checked : true,
      includeDiscord: $("#chkDiscord") ? !!$("#chkDiscord").checked : false,
      includeGpuOverlay: $("#chkGpuOv") ? !!$("#chkGpuOv").checked : false,
    };
  }

  function collectSessionSettings() {
    return {
      power: "high",
      gameMode: !!($("#chkGameMode") && $("#chkGameMode").checked),
      disableGameBar: !!($("#chkDisableBar") && $("#chkDisableBar").checked),
      focusAssist: !!($("#chkFocus") && $("#chkFocus").checked),
      visual: !!($("#chkFx") && $("#chkFx").checked),
      killOverlays: !!($("#chkKillOv") && $("#chkKillOv").checked),
      includeDiscord: !!($("#chkDiscord") && $("#chkDiscord").checked),
      includeGpuOverlay: !!($("#chkGpuOv") && $("#chkGpuOv").checked),
    };
  }

  function persistSessionOpts() {
    try {
      localStorage.setItem(SESSION_OPTS_KEY, JSON.stringify(collectSessionSettings()));
    } catch (_) {}
  }

  function restoreSessionOpts() {
    try {
      const raw = localStorage.getItem(SESSION_OPTS_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      if ($("#chkGameMode")) $("#chkGameMode").checked = s.gameMode !== false;
      if ($("#chkDisableBar")) $("#chkDisableBar").checked = s.disableGameBar !== false;
      if ($("#chkFocus")) $("#chkFocus").checked = s.focusAssist !== false;
      if ($("#chkFx")) $("#chkFx").checked = s.visual !== false;
      if ($("#chkKillOv")) $("#chkKillOv").checked = s.killOverlays !== false;
      if ($("#chkDiscord")) $("#chkDiscord").checked = !!s.includeDiscord;
      if ($("#chkGpuOv")) $("#chkGpuOv").checked = !!s.includeGpuOverlay;
    } catch (_) {}
  }

  async function confirmSessionPreset() {
    const p = pack();
    let body = p.presetConfirmBody || "";
    const rp = $("#chkCreateRp");
    if (rp && rp.checked) {
      body += lang === "en" ? "\n\nA restore point will be created." : "\n\nUn point de restauration sera créé.";
    }
    return askConfirm(body, p.presetConfirmTitle || "Session");
  }

  async function applySession(fromDash) {
    if (!(await confirmSessionPreset())) return;
    try {
      const payload = collectSessionPayload(fromDash);
      const r = await runJob("applySessionPreset", payload);
      logAction(r, lang === "en" ? "Session preset applied" : "Preset session appliqué");
      persistSessionOpts();
      await refreshHealth();
      await refreshPower().catch(() => {});
      await refreshBoost().catch(() => {});
      await refreshGameMode().catch(() => {});
    } catch (e) {
      log(String(e.message || e), "err");
    }
  }

  async function showTipsModal(page) {
    const modal = $("#tipsModal");
    const body = $("#tipsModalBody");
    if (!modal || !body) return;
    const ids = PAGE_TIPS[page || currentPage] || [];
    if (!ids.length) return;
    try {
      if (!tipsCache) {
        const res = await fetch("tips/tips.json", { cache: "no-store" });
        tipsCache = await res.json();
      }
      const items = (tipsCache[lang] || tipsCache.fr || []).filter((t) => ids.includes(t.id));
      body.innerHTML = items.length
        ? items.map((t) => `<article class="tip-card"><h3>${esc(t.title)}</h3><p>${esc(t.body)}</p></article>`).join("")
        : `<p class="muted">${lang === "en" ? "No tips for this page" : "Pas de conseil pour cette page"}</p>`;
      modal.hidden = false;
    } catch (_) {
      body.innerHTML = `<p class="muted">${lang === "en" ? "Tips unavailable" : "Conseils indisponibles"}</p>`;
      modal.hidden = false;
    }
  }

  function hideTipsModal() {
    const modal = $("#tipsModal");
    if (modal) modal.hidden = true;
  }

  function wireBgTabs() {
    $$(".bg-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        $$(".bg-tab").forEach((t) => t.classList.toggle("active", t === tab));
        const name = tab.dataset.bgTab;
        $("#bgPaneServices").classList.toggle("active", name === "services");
        $("#bgPaneStartup").classList.toggle("active", name === "startup");
        if (name === "services") refreshServices().catch(() => {});
        else refreshStartup().catch(() => {});
      });
    });
  }

  function actionMessage(r, fallback) {
    if (!r) return fallback || (lang === "en" ? "Done" : "OK");
    if (lang === "fr" && r.MessageFr) return String(r.MessageFr);
    if (r.Message) return String(r.Message);
    return fallback || (lang === "en" ? "Done" : "OK");
  }

  function logAction(r, fallbackOk) {
    const ok = !!(r && r.Success !== false);
    log(actionMessage(r, fallbackOk || (ok ? (lang === "en" ? "Done" : "OK") : (lang === "en" ? "Failed" : "Échec"))), ok ? "ok" : "err");
    return ok;
  }

  let confirmResolver = null;

  function askConfirm(message, titleText) {
    const ov = $("#confirmOverlay");
    const title = $("#confirmTitle");
    const msg = $("#confirmMsg");
    if (!ov || !msg) {
      return Promise.resolve(window.confirm(String(message || "")));
    }
    if (title) title.textContent = titleText || t("confirmTitle");
    msg.textContent = String(message || "");
    ov.hidden = false;
    document.body.classList.add("pcd-confirm-open");
    return new Promise((resolve) => {
      confirmResolver = resolve;
    });
  }

  function closeConfirm(ok) {
    const ov = $("#confirmOverlay");
    if (ov) ov.hidden = true;
    document.body.classList.remove("pcd-confirm-open");
    const fn = confirmResolver;
    confirmResolver = null;
    if (fn) fn(!!ok);
  }

  function detectActivePowerProfile(plans) {
    const active = (plans || []).find((x) => x && x.active);
    if (!active) return null;
    const g = String(active.guid || "").toLowerCase();
    const n = String(active.name || "");
    if (g === "381b4222-f694-41f0-9685-ff5bb260df2e" || /Balanced|Équilibré|Equilibre|Utilisation normale/i.test(n)) {
      return "balanced";
    }
    if (g === "8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c" || /High performance|Haute performance|Hautes performances|Performances élevées|Performances elevees/i.test(n)) {
      return "high";
    }
    if (
      g === "e9a42b02-d5df-448d-aa00-03f14749eb61" ||
      /Ultimate|Performances maximales|Performances optimales/i.test(n)
    ) {
      return "ultimate";
    }
    return null;
  }

  function syncPowerButtons(plans) {
    const profile = detectActivePowerProfile(plans);
    const active = (plans || []).find((x) => x && x.active);
    const map = {
      btnPowerBalanced: "balanced",
      btnPowerHigh: "high",
      btnPowerUlt: "ultimate",
    };
    Object.keys(map).forEach((id) => {
      const btn = $("#" + id);
      if (!btn) return;
      const on = profile === map[id];
      btn.classList.toggle("accent", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
    const hint = $("#powerActiveHint");
    if (hint) {
      const name = (active && active.name) || "—";
      hint.textContent = t("powerActive", { name });
    }
  }

  async function refreshPower() {
    const d = await run("getPowerPlans", {});
    const plans = d.plans || [];
    const list = $("#powerList");
    if (!list) return;
    list.innerHTML = plans.length
      ? plans.map((plan) => `<li>${plan.active ? "★ " : ""}${esc(plan.name)} <span class="muted">${esc(plan.guid)}</span></li>`).join("")
      : '<li class="muted">—</li>';
    syncPowerButtons(plans);
  }

  async function refreshGameMode() {
    const s = await run("getGameMode", {});
    if ($("#chkGameMode")) $("#chkGameMode").checked = !!s.gameMode;
    if ($("#chkDisableBar")) $("#chkDisableBar").checked = !s.gameBar;
    if ($("#chkFocus")) $("#chkFocus").checked = !!s.focusAssist;
  }

  async function refreshBoost() {
    const s = await run("getBoostStatus", {});
    const el = $("#boostStatus");
    if (!el) return;
    const n = (s.overlays || []).length;
    el.textContent = lang === "en"
      ? (s.active ? `Active — ${n} overlays seen` : `Inactive — ${n} overlays detected`)
      : (s.active ? `Actif — ${n} overlays vus` : `Inactif — ${n} overlays détectés`);
  }

  function setAccentButtons(map) {
    Object.keys(map).forEach((id) => {
      const b = $("#" + id);
      if (!b) return;
      const on = !!map[id];
      b.classList.toggle("accent", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  async function refreshSoftPerf() {
    const d = await run("getSoftPerf", {});
    const os = d.os || {};
    const gpu = d.gpu || {};
    const nv = d.nvidia || {};
    const vendor = String(gpu.vendor || "").toLowerCase();
    const gpuNames = ((gpu.gpus || []).map((g) => g.name).filter(Boolean).join(", ")) || "—";
    ingestGpuDetect(gpu, { nvidiaAvailable: !!nv.available });
    const plPreset = String(nv.activePlPreset || nv.lastPlPreset || "");
    const softOn = !!os.softOsActive;
    const status = $("#softPerfStatus");
    if (status) {
      const hagsTxt = os.hagsEnabled == null ? "?" : (os.hagsEnabled ? "on" : "off");
      let nvLine = lang === "en" ? "nvidia-smi unavailable" : "nvidia-smi indisponible";
      if (nv.available) {
        const bits = [`${nv.name || "NVIDIA"}`, `PL ${nv.currentPl}W`];
        if (nv.stockPl != null) bits.push(`stock ${nv.stockPl}W`);
        if (nv.maxPl != null) bits.push(`max ${nv.maxPl}W`);
        if (plPreset) bits.push(plPreset);
        nvLine = bits.join(" · ");
      }
      status.textContent = lang === "en"
        ? `GPU: ${gpuNames} · HAGS: ${hagsTxt} · OS soft: ${softOn ? "on" : "off"} · ${nvLine}`
        : `GPU : ${gpuNames} · HAGS : ${hagsTxt} · OS soft : ${softOn ? "on" : "off"} · ${nvLine}`;
    }
    const amdPerf = $("#amdSoftPerfStatus");
    if (amdPerf) {
      amdPerf.textContent = lang === "en"
        ? `GPU: ${gpuNames} · vendor ${vendor || "?"} · HAGS: ${os.hagsEnabled == null ? "?" : os.hagsEnabled ? "on" : "off"}`
        : `GPU : ${gpuNames} · vendor ${vendor || "?"} · HAGS : ${os.hagsEnabled == null ? "?" : os.hagsEnabled ? "on" : "off"}`;
    }
    if ($("#chkHags") && os.hagsEnabled != null) $("#chkHags").checked = !!os.hagsEnabled;
    if ($("#chkAmdHags") && os.hagsEnabled != null) $("#chkAmdHags").checked = !!os.hagsEnabled;
    const canNv = !!nv.available && !!gpuDetect.nvidia;
    ["btnPlEco", "btnPlStock", "btnPlPerf"].forEach((id) => {
      const b = $("#" + id);
      if (b) b.disabled = !canNv;
    });
    setAccentButtons({
      btnSoftPerfOs: softOn,
      btnPlEco: canNv && plPreset === "eco",
      btnPlStock: canNv && plPreset === "stock",
      btnPlPerf: canNv && plPreset === "perf",
    });
  }

  async function updateNvidiaNav() {
    try { await refreshSoftPerf(); } catch (_) {}
  }

  async function refreshAmd() {
    const d = await run("getSoftOc", {});
    const amd = d.amd || {};
    const soft = amd.software || {};
    ingestGpuDetect(d.gpu || {}, {
      nvidiaAvailable: !!(d.nvidia && d.nvidia.available),
      amdAvailable: !!amd.available,
    });
    const status = $("#amdStatus");
    if (status) {
      if (amd.available) {
        const names = ((amd.gpus || []).map((g) => g.name).filter(Boolean).join(", ")) || amd.name || "AMD";
        status.textContent = lang === "en"
          ? `Detected: ${names}`
          : `Détecté : ${names}`;
      } else {
        status.textContent = lang === "en"
          ? "No AMD / Radeon GPU detected (WMI)."
          : "Aucun GPU AMD / Radeon détecté (WMI).";
      }
    }
    const note = $("#amdSoftwareStatus");
    if (note) {
      if (soft.found) {
        note.textContent = lang === "en" ? `Found: ${soft.path}` : `Trouvé : ${soft.path}`;
      } else {
        note.textContent = lang === "en"
          ? "AMD Software not installed — download Adrenalin for UV / tuning."
          : "AMD Software non installé — télécharge Adrenalin pour UV / réglages.";
      }
    }
  }

  async function refreshSoftOc() {
    const d = await run("getSoftOc", {});
    const nv = d.nvidia || {};
    const ab = d.afterburner || {};
    ingestGpuDetect(d.gpu || {}, {
      nvidiaAvailable: !!nv.available,
      amdAvailable: !!(d.amd && d.amd.available),
    });
    const ocPreset = String(nv.activeOcPreset || nv.lastOcPreset || "");
    const el = $("#softOcStatus");
    if (el) {
      el.textContent = nv.available
        ? `${nv.name || "NVIDIA"} · core ${nv.coreCurrent}/${nv.coreMax} MHz · mem ${nv.memCurrent}/${nv.memMax} MHz` +
          (ocPreset ? ` · ${ocPreset}` : "")
        : (lang === "en" ? `Clocks unavailable (${nv.reason || "n/a"})` : `Horloges indisponibles (${nv.reason || "n/a"})`);
    }
    const abEl = $("#afterburnerStatus");
    if (abEl) {
      abEl.textContent = ab.found
        ? (lang === "en" ? `Found: ${ab.path}` : `Trouvé : ${ab.path}`)
        : (lang === "en" ? "Afterburner not installed" : "Afterburner non installé");
    }
    const canOc = !!nv.available && !!gpuDetect.nvidia;
    ["btnOcStock", "btnOc50", "btnOc100"].forEach((id) => {
      const b = $("#" + id);
      if (b) b.disabled = !canOc;
    });
    setAccentButtons({
      btnOcStock: canOc && ocPreset === "stock",
      btnOc50: canOc && ocPreset === "plus50",
      btnOc100: canOc && ocPreset === "plus100",
    });
  }

  const OVERLAY_COLOR_PRESETS = {
    voidglow: {
      accent: "#e03545",
      text: "#f0f2f5",
      brand: "#e03545",
      fps: "#ff6b7a",
      muted: "#a8aab4",
    },
    neonlime: {
      accent: "#39ff14",
      text: "#f7ff00",
      brand: "#39ff14",
      fps: "#f7ff00",
      muted: "#b8ff66",
    },
    neoncold: {
      accent: "#00e8ff",
      text: "#ffe566",
      brand: "#00e8ff",
      fps: "#ff4fd8",
      muted: "#7adfff",
    },
    neonorange: {
      accent: "#ff7a18",
      text: "#39d0ff",
      brand: "#ff9a3c",
      fps: "#39d0ff",
      muted: "#ffc078",
    },
    neonviolet: {
      accent: "#b44dff",
      text: "#b8ff3c",
      brand: "#d27aff",
      fps: "#b8ff3c",
      muted: "#e0b3ff",
    },
    neonice: {
      accent: "#e8fbff",
      text: "#7af0ff",
      brand: "#ffffff",
      fps: "#5ce1ff",
      muted: "#b6f3ff",
    },
    neonfire: {
      accent: "#ff2a2a",
      text: "#ffe600",
      brand: "#ff4d4d",
      fps: "#ffe600",
      muted: "#ffb347",
    },
  };

  function defaultOverlayConfig() {
    return {
      layout: "line",
      scale: 1,
      colors: Object.assign({}, OVERLAY_COLOR_PRESETS.voidglow),
      show: {
        brand: true, fps: true, frametime: true, onePercentLow: true,
        app: true, cpu: true, cpuTemp: true, gpu: true, gpuTemp: true, ram: true,
      },
    };
  }

  function applyOverlayColorPreset(name) {
    const colors = OVERLAY_COLOR_PRESETS[name];
    if (!colors) return;
    const cfg = collectOverlayConfigFromForm();
    cfg.colors = Object.assign({}, colors);
    applyOverlayConfigToForm(cfg);
    document.querySelectorAll("[data-ov-color-preset]").forEach((btn) => {
      btn.classList.toggle("accent", btn.getAttribute("data-ov-color-preset") === name);
    });
    persistOverlayConfig().catch((e) => log(e.message || String(e), "err"));
  }

  function applyOverlayPreset(name) {
    const base = defaultOverlayConfig();
    const preset = name === "full" ? base : OVERLAY_PRESETS[name];
    if (!preset) return;
    const merged = Object.assign({}, base, preset, {
      colors: Object.assign({}, base.colors, (preset.colors || {})),
      show: Object.assign({}, base.show, (preset.show || {})),
      scale: (typeof preset.scale === "number" ? preset.scale : base.scale),
    });
    applyOverlayConfigToForm(merged);
    persistOverlayConfig().catch(() => {});
  }

  function collectOverlayConfigFromForm() {
    const cfg = defaultOverlayConfig();
    const sel = $("#selOverlayLayout");
    if (sel && (sel.value === "line" || sel.value === "card")) cfg.layout = sel.value;
    const scaleEl = $("#rngOverlayScale");
    if (scaleEl) {
      const s = Number(scaleEl.value);
      if (s >= 0.7 && s <= 2.2) cfg.scale = Math.round(s * 100) / 100;
    }
    document.querySelectorAll("[data-ov-color]").forEach((el) => {
      const key = el.getAttribute("data-ov-color");
      if (key && Object.prototype.hasOwnProperty.call(cfg.colors, key) && el.value) {
        cfg.colors[key] = String(el.value).toLowerCase();
      }
    });
    document.querySelectorAll("[data-ov]").forEach((el) => {
      const key = el.getAttribute("data-ov");
      if (key && Object.prototype.hasOwnProperty.call(cfg.show, key)) cfg.show[key] = !!el.checked;
    });
    return cfg;
  }

  function applyOverlayConfigToForm(cfg) {
    if (!cfg) return;
    const sel = $("#selOverlayLayout");
    if (sel && (cfg.layout === "line" || cfg.layout === "card")) sel.value = cfg.layout;
    const scaleEl = $("#rngOverlayScale");
    const scaleVal = $("#overlayScaleVal");
    const scale = typeof cfg.scale === "number" ? cfg.scale : 1;
    if (scaleEl) scaleEl.value = String(scale);
    if (scaleVal) scaleVal.textContent = `${Math.round(scale * 100)}%`;
    const colors = cfg.colors || {};
    document.querySelectorAll("[data-ov-color]").forEach((el) => {
      const key = el.getAttribute("data-ov-color");
      if (key && colors[key]) el.value = colors[key];
    });
    const show = cfg.show || {};
    document.querySelectorAll("[data-ov]").forEach((el) => {
      const key = el.getAttribute("data-ov");
      if (key && Object.prototype.hasOwnProperty.call(show, key)) el.checked = !!show[key];
    });
  }

  async function persistOverlayConfig() {
    const cfg = collectOverlayConfigFromForm();
    try { localStorage.setItem(OVERLAY_CFG_KEY, JSON.stringify(cfg)); } catch (_) {}
    const api = B.api;
    if (!api || !api.set_overlay_config) return cfg;
    try {
      const r = await api.set_overlay_config(cfg);
      if (r && r.config) applyOverlayConfigToForm(r.config);
    } catch (e) {
      log(e.message || String(e), "err");
    }
    return cfg;
  }

  async function loadOverlayConfig() {
    let cfg = defaultOverlayConfig();
    try {
      const raw = localStorage.getItem(OVERLAY_CFG_KEY);
      if (raw) cfg = Object.assign(cfg, JSON.parse(raw));
    } catch (_) {}
    const api = B.api;
    if (api && api.get_overlay_config) {
      try {
        const r = await api.get_overlay_config();
        if (r && r.config) cfg = r.config;
      } catch (_) {}
    }
    applyOverlayConfigToForm(cfg);
    return cfg;
  }

  async function setFpsOverlay(enabled) {
    const api = B.api;
    if (!api) return;
    const chk = $("#chkFpsOverlay");
    if (enabled) {
      if (!api.start_fps_overlay) {
        log(lang === "en" ? "Overlay API missing" : "API overlay absente", "err");
        if (chk) chk.checked = false;
        return;
      }
      await persistOverlayConfig();
      const r = await api.start_fps_overlay();
      if (!r || r.ok === false) {
        log((r && r.error) || (lang === "en" ? "Overlay failed" : "Échec overlay"), "err");
        if (chk) chk.checked = false;
        localStorage.removeItem(OVERLAY_KEY);
        return;
      }
      localStorage.setItem(OVERLAY_KEY, "1");
      if (r.config) applyOverlayConfigToForm(r.config);
    } else {
      if (api.stop_fps_overlay) await api.stop_fps_overlay().catch(() => {});
      localStorage.removeItem(OVERLAY_KEY);
    }
  }

  async function restoreFpsOverlay() {
    const chk = $("#chkFpsOverlay");
    const api = B.api;
    if (!chk || !api) return;
    await loadOverlayConfig();
    let want = localStorage.getItem(OVERLAY_KEY) === "1";
    try {
      if (api.get_fps_overlay_status) {
        const st = await api.get_fps_overlay_status();
        if (st && st.enabled) want = true;
        if (st && st.config) applyOverlayConfigToForm(st.config);
      }
    } catch (_) {}
    chk.checked = want;
    if (want) await setFpsOverlay(true);
  }

  async function refreshMonitor() {
    const api = B.api;
    if (!api || !api.get_fps_sample) {
      const st = $("#monitorStatus");
      if (st) st.textContent = lang === "en" ? "Host API missing get_fps_sample" : "API host sans get_fps_sample";
      return;
    }
    const d = await api.get_fps_sample();
    const fpsEl = $("#monFps");
    const ftEl = $("#monFt");
    const appEl = $("#monApp");
    const st = $("#monitorStatus");
    const active = d && (d.captureActive || d.available);
    if (d && d.available && d.fps != null) {
      if (fpsEl) fpsEl.textContent = String(d.fps);
      if (ftEl) ftEl.textContent = d.frametimeMs != null ? `${d.frametimeMs} ms` : "—";
      if (appEl) appEl.textContent = d.app || "—";
      if (st) st.textContent = lang === "en" ? "Capture active" : "Capture active";
      const hintEl = $("#monitorHint");
      if (hintEl) { hintEl.hidden = true; hintEl.textContent = ""; }
    } else {
      if (fpsEl) fpsEl.textContent = "—";
      if (ftEl) ftEl.textContent = "—";
      if (appEl) appEl.textContent = d && d.app ? d.app : "—";
      const err = (d && d.error) || (lang === "en" ? "No FPS sample" : "Pas d'échantillon FPS");
      const hint = lang === "en" ? ((d && d.hintEn) || "") : ((d && d.hintFr) || "");
      if (st) st.textContent = hint ? `${err} — ${hint}` : err;
      const hintEl = $("#monitorHint");
      if (hintEl) {
        const lines = [];
        if (active) {
          lines.push(lang === "en"
            ? "Capture is running. Focus a game window and wait a few seconds."
            : "La capture tourne. Mettez le jeu au premier plan et attendez.");
        } else {
          lines.push(lang === "en"
            ? "1. Launch a game · 2. Alt+Tab to the game · 3. Wait a few seconds"
            : "1. Lancez un jeu · 2. Alt+Tab vers le jeu · 3. Attendez quelques secondes");
        }
        hintEl.textContent = lines.join(" ");
        hintEl.hidden = false;
      }
    }
  }

  async function scanClean() {
    log(lang === "en" ? "Scanning caches…" : "Analyse des caches…", "warn");
    setStatus(lang === "en" ? "Scanning…" : "Analyse…");
    const d = await runJob("scanCleanup", {});
    const items = d.items || [];
    const targets = $("#stTargets");
    const est = $("#stEst");
    if (targets) targets.textContent = String(items.length);
    if (est) est.textContent = d.totalSize || "—";
    const box = $("#cleanCats");
    if (box) {
      // Yield to UI before heavy DOM write (avoids freeze after large scans).
      await new Promise((r) => requestAnimationFrame(() => r()));
      const frag = document.createDocumentFragment();
      const wrap = document.createElement("div");
      wrap.innerHTML = items
        .map(
          (it) => `<label class="check-item"><input type="checkbox" data-id="${esc(it.id)}" ${it.exists && it.bytes > 0 ? "checked" : ""}/>
        <div><div class="t">${esc(it.name)}</div><div class="d">${esc(it.size)} — ${esc(it.path)}</div></div></label>`
        )
        .join("");
      while (wrap.firstChild) frag.appendChild(wrap.firstChild);
      box.replaceChildren(frag);
      await new Promise((r) => requestAnimationFrame(() => r()));
    }
    log(`Cleanup scan: ${d.totalSize}`, "ok");
    setStatus(pack().ready || "Prêt");
  }

  async function refreshDns() {
    const sel = $("#dnsPreset");
    if (!sel) return;
    const prev = sel.value || "cloudflare";
    let presets = DNS_PRESETS_FALLBACK;
    try {
      const d = await run("getDnsPresets", {});
      if (d && Array.isArray(d.presets) && d.presets.length) presets = d.presets.filter((p) => p && p.id);
    } catch (_) {}
    sel.innerHTML = presets.map((p) => `<option value="${esc(p.id)}">${esc(p.name || p.id)}</option>`).join("");
    if ([].some.call(sel.options, (o) => o.value === prev)) sel.value = prev;
    else if (sel.options.length) sel.selectedIndex = 0;
  }

  async function refreshServices() {
    const d = await run("getServices", {});
    $("#svcList").innerHTML = (d.items || [])
      .map(
        (it) => `<label class="check-item"><input type="checkbox" data-name="${esc(it.Name)}" ${it.Status === "Running" ? "checked" : ""}/>
        <div><div class="t">${esc(it.DisplayName || it.Name)}</div><div class="d">${esc(it.Name)} — ${esc(it.Status)} / ${esc(it.StartType)}</div></div></label>`
      )
      .join("") || '<div class="muted">—</div>';
  }

  async function refreshStartup() {
    const d = await run("getStartup", {});
    $("#startupList").innerHTML = (d.items || [])
      .map(
        (it) => `<label class="check-item"><input type="checkbox" data-name="${encodeURIComponent(it.Name)}" data-hive="${encodeURIComponent(it.Hive)}" data-cmd="${encodeURIComponent(it.Command || "")}" ${it.Protected ? "disabled" : ""}/>
        <div><div class="t">${esc(it.Name)}${it.Protected ? " 🔒" : ""}</div><div class="d">${esc(it.Hive)}</div></div></label>`
      )
      .join("") || '<div class="muted">—</div>';
  }

  async function refreshProfiles() {
    const d = await run("getProfiles", {});
    const profiles = d.profiles || [];
    const list = $("#profileList");
    if (!list) return;
    list.innerHTML = profiles.length
      ? profiles.map(
        (p) =>
          `<li><button type="button" class="btn accent" style="height:28px;font-size:0.75rem;margin-right:8px" data-apply="${esc(p.name)}" title="${esc(lang === "en" ? "Apply and launch" : "Appliquer et lancer")}">▶</button>${esc(p.name)} <span class="muted">${esc(p.exePath || "")}</span></li>`
      ).join("")
      : `<li class="muted">${lang === "en" ? "No saved games" : "Aucun jeu enregistré"}</li>`;
    $$("#profileList [data-apply]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        try {
          const r = await runJob("applyProfile", { name: btn.dataset.apply, launch: true });
          log(r.Message || (lang === "en" ? "Profile applied" : "Profil appliqué"), "ok");
          await refreshHealth();
        } catch (e) {
          log(String(e.message || e), "err");
        }
      });
    });
  }

  async function refreshSessions() {
    const d = await run("getSessions", {});
    $("#sessionList").innerHTML = (d.sessions || [])
      .map((s) => `<li>${esc(s.createdAt || "")} — ${esc(s.action)}: ${esc(s.summary || "")}</li>`)
      .join("") || '<li class="muted">—</li>';
    const u = await run("getUndoList", {});
    $("#undoList").innerHTML = (u.items || [])
      .map(
        (it) =>
          `<li><button type="button" class="btn" style="height:28px;font-size:0.75rem;margin-right:8px" data-undo="${esc(it.id)}" title="${esc(it.name)}">Undo</button><span class="t">${esc(it.name)}</span> <span class="muted">${esc(it.createdAt || "")}${it.summary ? ` · ${esc(it.summary)}` : ""}</span></li>`
      )
      .join("") || '<li class="muted">—</li>';
    $$("#undoList [data-undo]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const p = pack();
        if (!(await askConfirm(p.undoConfirm || (lang === "en" ? "Undo this action?" : "Annuler cette action ?")))) return;
        try {
          const r = await runJob("runUndo", { id: btn.dataset.undo });
          const cls = r.Partial ? "warn" : r.Success === false ? "err" : "ok";
          log(actionMessage(r, "Undo OK"), cls);
          await refreshSessions();
          await refreshHealth();
          await refreshPower().catch(() => {});
        } catch (e) {
          log(String(e.message || e), "err");
        }
      });
    });
  }

  async function loadLegal(doc) {
    const key = doc && LEGAL_FILES[doc] ? doc : "terms";
    const file = LEGAL_FILES[key][lang] || LEGAL_FILES[key].fr;
    const body = $("#aboutLegalBody");
    if (!body) return;
    document.querySelectorAll(".about-legal-links [data-doc]").forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-doc") === key);
    });
    try {
      if (!legalCache[file]) {
        const res = await fetch(file, { cache: "no-store" });
        legalCache[file] = res.ok
          ? await res.text()
          : (lang === "en" ? `Could not load ${file}` : `Impossible de charger ${file}`);
      }
      body.textContent = legalCache[file];
      body.hidden = false;
    } catch (err) {
      body.textContent = String(err);
      body.hidden = false;
    }
  }

  function wire() {
    const confirmOk = $("#confirmOk");
    const confirmCancel = $("#confirmCancel");
    if (confirmOk) confirmOk.addEventListener("click", () => closeConfirm(true));
    if (confirmCancel) confirmCancel.addEventListener("click", () => closeConfirm(false));
    const confirmOverlay = $("#confirmOverlay");
    if (confirmOverlay) {
      confirmOverlay.addEventListener("click", (e) => {
        if (e.target === confirmOverlay) closeConfirm(false);
      });
    }

    $("#nav").addEventListener("click", (e) => {
      const btn = e.target.closest(".nav-btn");
      if (btn) showPage(btn.dataset.page);
    });

    $("#btnRestore").addEventListener("click", async () => {
      const p = pack();
      if (!(await askConfirm(p.rpConfirm || (lang === "en" ? "Create a restore point?" : "Créer un point de restauration ?")))) return;
      try {
        const r = await runJob("createRestorePoint", {});
        logAction(r, lang === "en" ? "Restore point created" : "Point de restauration créé");
      } catch (e) {
        log(String(e.message || e), "err");
      }
    });

    $("#btnCancel").addEventListener("click", async () => {
      const api = B.api;
      if (api && api.cancel_action) await api.cancel_action();
      B.jobBusy = false;
      log(lang === "en" ? "Cancelled" : "Annulé", "warn");
    });

    $("#btnHealthRefresh").addEventListener("click", () => refreshHealth().catch((e) => log(e.message, "err")));
    $("#btnPreset").addEventListener("click", () => applySession(true));
    const btnSession = $("#btnApplySession");
    if (btnSession) btnSession.addEventListener("click", () => applySession(false));

    const chkAdv = $("#chkAdvanced");
    if (chkAdv) {
      let adv = false;
      try { adv = localStorage.getItem(ADV_KEY) === "1"; } catch (_) {}
      chkAdv.checked = adv;
      applyAdvancedMode(adv);
      chkAdv.addEventListener("change", () => applyAdvancedMode(chkAdv.checked));
    }

    const bindPower = (id, profile) => {
      const btn = $(id);
      if (!btn) return;
      btn.addEventListener("click", async () => {
        const p = pack();
        const label = profile === "balanced"
          ? (p.btnBalanced || "balanced")
          : profile === "ultimate"
            ? (p.btnUltimate || "ultimate")
            : (p.btnHigh || "high");
        if (!(await askConfirm(`${p.powerConfirm || (lang === "en" ? "Apply power plan?" : "Appliquer le plan d'alimentation ?")}\n\n${label}`, t("confirmTitle")))) return;
        try {
          log(t("powerApplying", { name: label }), "warn");
          setStatus(t("powerApplying", { name: label }));
          const r = await runJob("setPowerPlan", { profile });
          const ok = logAction(r, t("powerDone", { name: label }));
          await refreshPower();
          await refreshHealth().catch(() => {});
          if (ok) setStatus(t("powerDone", { name: label }));
        } catch (e) {
          log(String(e.message || e), "err");
        }
      });
    };
    bindPower("#btnPowerBalanced", "balanced");
    bindPower("#btnPowerHigh", "high");
    bindPower("#btnPowerUlt", "ultimate");

    const btnGm = $("#btnApplyGm");
    if (btnGm) {
      btnGm.addEventListener("click", async () => {
        const p = pack();
        if (!(await askConfirm(p.gmConfirm || (lang === "en" ? "Apply Game Mode / Focus Assist?" : "Appliquer Game Mode / Focus Assist ?")))) return;
        try {
          log(lang === "en" ? "Applying Game Mode…" : "Application Game Mode…", "warn");
          const r = await runJob("setGameMode", {
            gameMode: $("#chkGameMode").checked,
            disableGameBar: $("#chkDisableBar").checked,
            focusAssist: $("#chkFocus").checked,
          });
          logAction(r, lang === "en" ? "Game Mode applied" : "Game Mode appliqué");
          persistSessionOpts();
          await refreshGameMode();
          await refreshHealth().catch(() => {});
        } catch (e) {
          log(String(e.message || e), "err");
        }
      });
    }

    const btnStartBoost = $("#btnStartBoost");
    if (btnStartBoost) {
      btnStartBoost.addEventListener("click", async () => {
        const p = pack();
        if (!(await askConfirm(p.boostConfirm || (lang === "en" ? "Start boost (close overlays)?" : "Lancer le boost (fermeture overlays) ?")))) return;
        try {
          log(lang === "en" ? "Starting boost…" : "Démarrage boost…", "warn");
          const r = await runJob("startBoost", {
            killOverlays: $("#chkKillOv").checked,
            includeDiscord: $("#chkDiscord").checked,
            includeGpuOverlay: $("#chkGpuOv").checked,
          });
          logAction(r, lang === "en" ? "Boost started" : "Boost démarré");
          persistSessionOpts();
          await refreshBoost();
        } catch (e) {
          log(String(e.message || e), "err");
        }
      });
    }
    const btnStopBoost = $("#btnStopBoost");
    if (btnStopBoost) {
      btnStopBoost.addEventListener("click", async () => {
        try {
          log(lang === "en" ? "Stopping boost…" : "Arrêt boost…", "warn");
          const r = await runJob("stopBoost", {});
          logAction(r, lang === "en" ? "Boost stopped" : "Boost arrêté");
          await refreshBoost();
        } catch (e) {
          log(String(e.message || e), "err");
        }
      });
    }

    const btnVisual = $("#btnVisual");
    if (btnVisual) {
      btnVisual.addEventListener("click", async () => {
        try {
          log(lang === "en" ? "Applying desktop visuals…" : "Application effets bureau…", "warn");
          const r = await runJob("setVisual", {
            reduceEffects: $("#chkFx").checked,
            disableAnimations: $("#chkAnim").checked,
            disableTransparency: $("#chkTrans").checked,
          });
          logAction(r, lang === "en" ? "Visual settings applied" : "Effets bureau appliqués");
          persistSessionOpts();
        } catch (e) {
          log(String(e.message || e), "err");
        }
      });
    }

    $$("#page-session input[type=checkbox]").forEach((el) => {
      el.addEventListener("change", persistSessionOpts);
    });

    $("#btnScanClean").addEventListener("click", () => scanClean().catch((e) => log(e.message, "err")));
    $("#btnRunClean").addEventListener("click", async () => {
      if (!(await askConfirm(pack().confirmDanger || "Confirm?"))) return;
      try {
        log(lang === "en" ? "Cleaning caches…" : "Nettoyage des caches…", "warn");
        const ids = $$("#cleanCats input:checked").map((i) => i.dataset.id);
        const r = await runJob("runCleanup", { ids });
        logAction(r, lang === "en" ? "Cleanup done" : "Nettoyage terminé");
        await scanClean();
      } catch (e) {
        log(e.message, "err");
      }
    });

    $("#btnSetDns").addEventListener("click", async () => {
      const p = pack();
      if (!(await askConfirm(p.dnsConfirm || (lang === "en" ? "Apply selected DNS?" : "Appliquer le DNS sélectionné ?")))) return;
      try {
        log(lang === "en" ? "Applying DNS…" : "Application DNS…", "warn");
        const r = await runJob("setDns", { presetId: $("#dnsPreset").value });
        logAction(r, lang === "en" ? "DNS applied" : "DNS appliqué");
        await refreshDns().catch(() => {});
      } catch (e) {
        log(e.message, "err");
      }
    });
    $("#btnFlushDns").addEventListener("click", async () => {
      const p = pack();
      if (!(await askConfirm(p.flushDnsConfirm || (lang === "en" ? "Flush DNS cache?" : "Vider le cache DNS ?")))) return;
      try {
        log(lang === "en" ? "Flushing DNS…" : "Flush DNS…", "warn");
        const r = await runJob("flushDns", {});
        logAction(r, lang === "en" ? "DNS flushed" : "Cache DNS vidé");
      } catch (e) {
        log(e.message, "err");
      }
    });

    $("#btnScanSvc").addEventListener("click", () => refreshServices().catch((e) => log(e.message, "err")));
    $("#btnApplySvc").addEventListener("click", async () => {
      if (!(await askConfirm(pack().confirmDanger || "Confirm?"))) return;
      const names = $$("#svcList input:checked").map((i) => i.dataset.name);
      try {
        log(lang === "en" ? "Applying services…" : "Application services…", "warn");
        const r = await runJob("setServices", { names });
        logAction(r, lang === "en" ? "Services updated" : "Services mis à jour");
        await refreshServices();
      } catch (e) {
        log(e.message, "err");
      }
    });
    $("#btnScanStartup").addEventListener("click", () => refreshStartup().catch((e) => log(e.message, "err")));
    $("#btnDisableStartup").addEventListener("click", async () => {
      if (!(await askConfirm(pack().confirmDanger || "Confirm?"))) return;
      const items = $$("#startupList input:checked").map((i) => ({
        Name: decodeURIComponent(i.dataset.name),
        Hive: decodeURIComponent(i.dataset.hive),
        Command: decodeURIComponent(i.dataset.cmd || ""),
        Protected: false,
      }));
      try {
        log(lang === "en" ? "Disabling startup items…" : "Désactivation démarrage…", "warn");
        const r = await runJob("disableStartup", { items });
        logAction(r, lang === "en" ? "Startup items disabled" : "Éléments de démarrage désactivés");
        await refreshStartup();
      } catch (e) {
        log(e.message, "err");
      }
    });

    const btnSoftOs = $("#btnSoftPerfOs");
    if (btnSoftOs) {
      btnSoftOs.addEventListener("click", async () => {
        if (!(await askConfirm(pack().confirmSoftPerf || pack().confirmDanger || "Confirm?"))) return;
        try {
          log(lang === "en" ? "Applying soft OS…" : "Application OS soft…", "warn");
          const r = await runJob("setSoftPerfOs", {
            enableSoftOs: true,
            setHags: !!($("#chkApplyHags") && $("#chkApplyHags").checked),
            hagsEnabled: !!($("#chkHags") && $("#chkHags").checked),
          });
          logAction(r);
          await refreshSoftPerf();
        } catch (e) {
          log(e.message, "err");
        }
      });
    }
    const btnSoftReset = $("#btnSoftPerfReset");
    if (btnSoftReset) {
      btnSoftReset.addEventListener("click", async () => {
        try {
          log(lang === "en" ? "Resetting soft OS…" : "Reset OS soft…", "warn");
          const r = await runJob("resetSoftPerf", {});
          logAction(r);
          await refreshSoftPerf();
        } catch (e) {
          log(e.message, "err");
        }
      });
    }
    const setPl = (preset) => async () => {
      if (!(await askConfirm(pack().confirmSoftPerf || pack().confirmDanger || "Confirm?"))) return;
      try {
        log(lang === "en" ? `NVIDIA power limit → ${preset}…` : `Power Limit NVIDIA → ${preset}…`, "warn");
        const r = await runJob("setNvidiaPowerLimit", { preset });
        logAction(r);
        await refreshSoftPerf();
      } catch (e) {
        log(e.message, "err");
      }
    };
    if ($("#btnPlEco")) $("#btnPlEco").addEventListener("click", setPl("eco"));
    if ($("#btnPlStock")) $("#btnPlStock").addEventListener("click", setPl("stock"));
    if ($("#btnPlPerf")) $("#btnPlPerf").addEventListener("click", setPl("perf"));

    const setOc = (preset) => async () => {
      if (!(await askConfirm(pack().confirmSoftOc || pack().confirmDanger || "Confirm?"))) return;
      try {
        log(lang === "en" ? `NVIDIA clocks → ${preset}…` : `Horloges NVIDIA → ${preset}…`, "warn");
        const r = await runJob("setNvidiaClocks", { preset });
        logAction(r);
        await refreshSoftOc();
      } catch (e) {
        log(e.message, "err");
      }
    };
    if ($("#btnOcStock")) $("#btnOcStock").addEventListener("click", setOc("stock"));
    if ($("#btnOc50")) $("#btnOc50").addEventListener("click", setOc("plus50"));
    if ($("#btnOc100")) $("#btnOc100").addEventListener("click", setOc("plus100"));

    if ($("#btnOpenAfterburner")) {
      $("#btnOpenAfterburner").addEventListener("click", async () => {
        try {
          const r = await run("openAfterburner", {});
          logAction(r, "Afterburner");
        } catch (e) {
          log(e.message, "err");
        }
      });
    }
    if ($("#btnAfterburnerDl")) {
      $("#btnAfterburnerDl").addEventListener("click", async () => {
        try {
          const api = B.api;
          if (api && api.open_url) await api.open_url("https://www.msi.com/Landing/afterburner");
        } catch (e) {
          log(e.message, "err");
        }
      });
    }

    const runAmdSoftOs = async () => {
      if (!(await askConfirm(pack().confirmSoftPerf || pack().confirmDanger || "Confirm?"))) return;
      try {
        log(lang === "en" ? "Applying AMD soft OS…" : "Application OS soft AMD…", "warn");
        const r = await runJob("setSoftPerfOs", {
          enableSoftOs: true,
          setHags: !!($("#chkAmdApplyHags") && $("#chkAmdApplyHags").checked),
          hagsEnabled: !!($("#chkAmdHags") && $("#chkAmdHags").checked),
        });
        logAction(r);
        await refreshSoftPerf();
        await refreshAmd();
      } catch (e) {
        log(e.message, "err");
      }
    };
    if ($("#btnAmdSoftPerfOs")) $("#btnAmdSoftPerfOs").addEventListener("click", runAmdSoftOs);
    if ($("#btnAmdSoftPerfReset")) {
      $("#btnAmdSoftPerfReset").addEventListener("click", async () => {
        try {
          log(lang === "en" ? "Resetting soft OS…" : "Reset OS soft…", "warn");
          const r = await runJob("resetSoftPerf", {});
          logAction(r);
          await refreshSoftPerf();
          await refreshAmd();
        } catch (e) {
          log(e.message, "err");
        }
      });
    }
    if ($("#btnOpenAmdSoftware")) {
      $("#btnOpenAmdSoftware").addEventListener("click", async () => {
        try {
          const r = await run("openAmdSoftware", {});
          logAction(r, "AMD Software");
        } catch (e) {
          log(e.message, "err");
        }
      });
    }
    if ($("#btnAmdSoftwareDl")) {
      $("#btnAmdSoftwareDl").addEventListener("click", async () => {
        try {
          const api = B.api;
          const url = lang === "fr"
            ? "https://www.amd.com/fr/support/download/drivers.html"
            : "https://www.amd.com/en/support/download/drivers.html";
          if (api && api.open_url) await api.open_url(url);
        } catch (e) {
          log(e.message, "err");
        }
      });
    }

    if ($("#btnMonHelp")) {
      $("#btnMonHelp").addEventListener("click", () => {
        const hintEl = $("#monitorHint");
        if (hintEl) hintEl.hidden = !hintEl.hidden;
      });
    }
    if ($("#btnMonRefresh")) {
      $("#btnMonRefresh").addEventListener("click", () => refreshMonitor().catch((e) => log(e.message, "err")));
    }
    const chkOv = $("#chkFpsOverlay");
    if (chkOv) {
      chkOv.addEventListener("change", () => {
        setFpsOverlay(chkOv.checked).catch((e) => log(e.message, "err"));
      });
    }
    const selLayout = $("#selOverlayLayout");
    if (selLayout) {
      selLayout.addEventListener("change", () => {
        persistOverlayConfig().catch((e) => log(e.message, "err"));
      });
    }
    const selPreset = $("#selOverlayPreset");
    if (selPreset) {
      selPreset.addEventListener("change", () => {
        applyOverlayPreset(selPreset.value);
      });
    }
    const scaleEl = $("#rngOverlayScale");
    if (scaleEl) {
      const syncScaleLabel = () => {
        const scaleVal = $("#overlayScaleVal");
        const s = Number(scaleEl.value) || 1;
        if (scaleVal) scaleVal.textContent = `${Math.round(s * 100)}%`;
      };
      scaleEl.addEventListener("input", syncScaleLabel);
      scaleEl.addEventListener("change", () => {
        syncScaleLabel();
        persistOverlayConfig().catch((e) => log(e.message, "err"));
      });
    }
    document.querySelectorAll("[data-ov-color]").forEach((el) => {
      el.addEventListener("change", () => {
        persistOverlayConfig().catch((e) => log(e.message, "err"));
      });
    });
    document.querySelectorAll("[data-ov]").forEach((el) => {
      el.addEventListener("change", () => {
        persistOverlayConfig().catch((e) => log(e.message, "err"));
      });
    });
    const btnOvReset = $("#btnOvColorsReset");
    if (btnOvReset) {
      btnOvReset.addEventListener("click", () => {
        applyOverlayColorPreset("neonlime");
      });
    }
    document.querySelectorAll("[data-ov-color-preset]").forEach((btn) => {
      btn.addEventListener("click", () => {
        applyOverlayColorPreset(btn.getAttribute("data-ov-color-preset"));
      });
    });

    const gotoSession = $("#btnGotoSession");
    if (gotoSession) gotoSession.addEventListener("click", () => showPage("session"));
    const gotoFps = $("#btnGotoFps");
    if (gotoFps) gotoFps.addEventListener("click", () => showPage("fps"));

    const langSwitch = $("#langSwitch");
    if (langSwitch) {
      langSwitch.addEventListener("click", (ev) => {
        const seg = ev.target.closest("[data-lang]");
        if (!seg || !langSwitch.contains(seg)) return;
        setLang(seg.getAttribute("data-lang") === "en" ? "en" : "fr").catch(() => {});
      });
    }

    const btnFindGames = $("#btnFindGames");
    if (btnFindGames) {
      btnFindGames.addEventListener("click", async () => {
        try {
          const d = await runJob("findGames", {});
          const games = d.games || [];
          $("#gameList").innerHTML = games.length
            ? games.map(
              (g) =>
                `<li><button type="button" class="btn" style="height:28px;font-size:0.75rem;margin-right:8px" data-save="${encodeURIComponent(g.name)}" data-path="${encodeURIComponent(g.path)}" title="+">+</button>${esc(g.name)}</li>`
            ).join("")
            : `<li class="muted">${lang === "en" ? "No game found" : "Aucun jeu trouvé"}</li>`;
          $$("#gameList [data-save]").forEach((btn) => {
            btn.addEventListener("click", async () => {
              const name = decodeURIComponent(btn.dataset.save);
              const exePath = decodeURIComponent(btn.dataset.path);
              await run("saveProfile", { name, exePath, settings: collectSessionSettings() });
              log(`${lang === "en" ? "Saved for" : "Enregistré pour"} ${name}`, "ok");
              await refreshProfiles();
            });
          });
        } catch (e) {
          log(e.message, "err");
        }
      });
    }

    $("#btnRefreshSessions").addEventListener("click", () => refreshSessions().catch((e) => log(e.message, "err")));

    document.querySelector(".hub-support")?.addEventListener("click", async (ev) => {
      const supportBtn = ev.target.closest("[data-support]");
      if (!supportBtn) return;
      const kind = (supportBtn.dataset.support || "").toLowerCase();
    if (kind === "crypto") {
      try {
        if (globalThis.MrAurevoXCrypto && typeof MrAurevoXCrypto.open === "function") {
          await MrAurevoXCrypto.open();
        }
      } catch (_) {}
      return;
    }
      try {
        if (B.api && typeof B.api.open_support_url === "function") {
          await B.api.open_support_url(kind);
        }
      } catch (_) {}
    });

    wireAboutDialog();

    const honestyAck = $("#honestyAck");
    if (honestyAck) {
      honestyAck.addEventListener("click", () => {
        const dont = $("#honestyDontShow");
        hideHonestyGate(!!(dont && dont.checked));
      });
    }

    const btnHelp = $("#btnPageHelp");
    if (btnHelp) btnHelp.addEventListener("click", () => showTipsModal(currentPage));
    const tipsClose = $("#tipsClose");
    if (tipsClose) tipsClose.addEventListener("click", hideTipsModal);
    const tipsModal = $("#tipsModal");
    if (tipsModal) {
      tipsModal.addEventListener("click", (e) => {
        if (e.target === tipsModal) hideTipsModal();
      });
    }

    wireBgTabs();
  }

  function wireAboutDialog() {
    const btn = $("#btnAbout");
    const dlg = $("#aboutDialog");
    const chk = $("#chkGithubUpdates");
    const hint = $("#aboutUpdateHint");
    if (!btn || !dlg) return;

    async function copyText(value, hintEl, okMsg) {
      const text = (value || "").trim();
      if (!text) return;
      try {
        if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
        else {
          const tmp = document.createElement("textarea");
          tmp.value = text;
          document.body.appendChild(tmp);
          tmp.select();
          document.execCommand("copy");
          tmp.remove();
        }
        if (hintEl) {
          hintEl.hidden = false;
          hintEl.textContent = okMsg || (lang === "en" ? "Copied." : "Copié.");
          setTimeout(() => { hintEl.hidden = true; }, 1800);
        }
      } catch (_) {
        if (hintEl) {
          hintEl.hidden = false;
          hintEl.textContent = lang === "en" ? "Select and Ctrl+C." : "Sélectionne et Ctrl+C.";
        }
      }
    }

    async function refreshPref() {
      try {
        if (B.api?.get_update_check_pref) {
          const r = await B.api.get_update_check_pref();
          if (chk) chk.checked = r?.checkGithubUpdates !== false;
          const repo = $("#aboutRepoUrl");
          if (repo && r?.repoUrl) repo.value = r.repoUrl;
        }
      } catch (_) {}
      if (hint && chk) {
        hint.textContent = chk.checked
          ? (pack().aboutUpdateHintOn || hint.textContent)
          : (pack().aboutUpdateHintOff || hint.textContent);
      }
    }

    async function refreshLocalPaths() {
      const list = $("#aboutPathsList");
      const pathHint = $("#aboutPathCopyHint");
      if (!list) return;
      list.replaceChildren();
      let paths = [];
      try {
        if (B.api?.get_about_local_paths) {
          const r = await B.api.get_about_local_paths();
          if (Array.isArray(r?.paths)) paths = r.paths;
        }
      } catch (_) {}
      if (!paths.length) {
        paths = [
          {
            id: "app",
            label: lang === "en" ? "SoftTunes install (exe folder)" : "Install SoftTunes (dossier de l’exe)",
            path: "%LOCALAPPDATA%\\Programs\\SoftTunes",
            hint: lang === "en"
              ? "%LOCALAPPDATA%\\Programs\\SoftTunes — SoftTunes.exe (zip build)."
              : "%LOCALAPPDATA%\\Programs\\SoftTunes — emplacement SoftTunes.exe (build zip).",
            optional: true,
          },
          {
            id: "data",
            label: lang === "en" ? "SoftTunes data" : "Données SoftTunes",
            path: "%LOCALAPPDATA%\\SoftTunes",
            hint: "%LOCALAPPDATA%\\SoftTunes",
          },
          {
            id: "settings",
            label: lang === "en" ? "Shared preferences" : "Préférences partagées",
            path: "%LOCALAPPDATA%\\Mr-Aurevo-X\\user-settings.json",
            hint: lang === "en"
              ? "Shared Mr-Aurevo-X file — keep if other apps use it."
              : "Fichier partagé Mr-Aurevo-X — à garder si d’autres apps l’utilisent.",
          },
        ];
      }
      for (const entry of paths) {
        const id = String(entry.id || "");
        const labelKey = id === "app" ? "aboutPathApp"
          : id === "data" ? "aboutPathData"
          : id === "settings" ? "aboutPathSettings"
          : "";
        const hintKey = id === "app" ? "aboutPathAppHint"
          : id === "data" ? "aboutPathDataHint"
          : id === "settings" ? "aboutPathSettingsHint"
          : "";
        const item = document.createElement("div");
        item.className = "about-path-item";
        const label = document.createElement("div");
        label.className = "about-path-label";
        const baseLabel = (labelKey && pack()[labelKey]) || entry.label || entry.id || "Path";
        label.textContent =
          baseLabel + (entry.optional ? (lang === "en" ? " (optional)" : " (optionnel)") : "");
        const row = document.createElement("div");
        row.className = "about-repo-row";
        const input = document.createElement("input");
        input.type = "text";
        input.className = "about-repo-input";
        input.readOnly = true;
        input.spellcheck = false;
        input.value = entry.path || "";
        const copyBtn = document.createElement("button");
        copyBtn.type = "button";
        copyBtn.className = "btn accent";
        copyBtn.textContent = pack().btnCopy || "Copier";
        copyBtn.addEventListener("click", () => {
          copyText(input.value, pathHint, t("aboutCopyPath"));
        });
        row.appendChild(input);
        row.appendChild(copyBtn);
        item.appendChild(label);
        item.appendChild(row);
        const hintText = (hintKey && pack()[hintKey]) || entry.hint;
        if (hintText) {
          const note = document.createElement("p");
          note.className = "about-note";
          note.textContent = hintText;
          item.appendChild(note);
        }
        list.appendChild(item);
      }
    }

    btn.addEventListener("click", async () => {
      const aboutVer = $("#aboutVersion");
      if (aboutVer) aboutVer.textContent = `v${APP_VERSION} · ${t("versionFinal")}`;
      await refreshPref();
      await refreshLocalPaths();
      loadLegal("terms").catch(() => {});
      if (typeof dlg.showModal === "function") dlg.showModal();
      else dlg.setAttribute("open", "");
    });

    if (chk) {
      chk.addEventListener("change", async () => {
        try {
          if (B.api?.set_update_check_pref) await B.api.set_update_check_pref(!!chk.checked);
        } catch (_) {}
        await refreshPref();
        if (chk.checked) checkReleaseNotice().catch(() => {});
        else {
          lastReleaseInfo = null;
          const bar = document.getElementById("hubReleaseBanner");
          if (bar) { bar.hidden = true; bar.innerHTML = ""; }
        }
      });
    }

    $("#btnCopyRepo")?.addEventListener("click", () => {
      const repo = $("#aboutRepoUrl");
      copyText(repo?.value, $("#aboutCopyHint"), t("aboutCopyLink"));
    });

    document.querySelector(".about-legal-links")?.addEventListener("click", (e) => {
      const tab = e.target.closest("[data-doc]");
      if (!tab) return;
      document.querySelectorAll(".about-legal-links [data-doc]").forEach((t) => {
        t.classList.toggle("active", t === tab);
      });
      loadLegal(tab.dataset.doc).catch(() => {});
    });
  }

  function paintReleaseBanner(info) {
    const bar = document.getElementById("hubReleaseBanner");
    if (!bar || !info?.ok || !info.updateAvailable) return;
    const remote = String(info.remote || "");
    const local = String(info.local || APP_VERSION || "?");
    const api = B.api;
    bar.hidden = false;
    bar.innerHTML =
      `<div class="hub-release-text"><strong>${esc(t("releaseNew"))}</strong><span></span></div>` +
      '<div class="hub-release-actions">' +
      `<button type="button" class="hub-release-btn" id="hubReleaseOpen">${esc(t("releaseOpen"))}</button>` +
      `<button type="button" class="hub-release-dismiss" id="hubReleaseDismiss" aria-label="${esc(t("releaseClose"))}">×</button>` +
      "</div>";
    const span = bar.querySelector(".hub-release-text span");
    if (span) {
      span.textContent = local
        ? t("releaseMsgLocal", { ver: remote, local })
        : t("releaseMsg", { ver: remote });
    }
    document.getElementById("hubReleaseDismiss")?.addEventListener("click", () => {
      try { sessionStorage.setItem("hubReleaseDismissed", remote); } catch (_) {}
      bar.hidden = true;
      bar.innerHTML = "";
      lastReleaseInfo = null;
    });
    document.getElementById("hubReleaseOpen")?.addEventListener("click", async () => {
      try {
        if (api && typeof api.open_release_page === "function") {
          await api.open_release_page(info.releaseUrl || "");
        }
      } catch (_) {}
    });
  }

  async function checkReleaseNotice() {
    const api = B.api;
    if (!api || typeof api.check_latest_release !== "function") return;
    try {
      if (api.get_update_check_pref) {
        const pref = await api.get_update_check_pref();
        if (pref && pref.checkGithubUpdates === false) return;
      }
    } catch (_) {}
    let info;
    try {
      info = await api.check_latest_release();
    } catch (e) {
      log(t("releaseCheckFail", { err: String(e && e.message ? e.message : e) }), "warn");
      return;
    }
    if (info && info.skipped) return;
    if (!info?.ok) {
      log(t("releaseCheckFail", { err: String(info?.error || "error") }), "warn");
      return;
    }
    if (!info.updateAvailable) {
      const local = String(info.local || APP_VERSION || "?");
      log(t("releaseUpToDate", { local }), "ok");
      return;
    }
    const remote = String(info.remote || "");
    try {
      if (sessionStorage.getItem("hubReleaseDismissed") === remote) return;
    } catch (_) {}
    lastReleaseInfo = info;
    paintReleaseBanner(info);
  }

  async function boot() {
    B.setApi(await B.waitApi());
    if (!B.api) {
      log("Host pywebview non détecté — lancez SoftTunes (Opti.exe)", "err");
      return;
    }
    try {
      lang = await resolveBootLanguage();
      if (window.MrAurevoXSuite) window.MrAurevoXSuite.applyAccent("#e03545");
    } catch (_) {}
    applyI18n();
    wire();
    maybeShowHonestyGate(false);
    const aboutVer = $("#aboutVersion");
    if (aboutVer) aboutVer.textContent = `v${APP_VERSION} · ${t("versionFinal")}`;

    try {
      await run("ping", {});
      setStatus(pack().ready);
      log(`SoftTunes v${APP_VERSION} ready`, "ok");
      restoreFpsOverlay().catch(() => {});
    } catch (e) {
      log(String(e.message || e), "err");
    }

    refreshHealth().catch(() => {});
    refreshDns().catch(() => {});
    updateNvidiaNav().catch(() => {});
    restoreSessionOpts();
    checkReleaseNotice().catch(() => {});
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();

