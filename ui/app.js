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

  const APP_VERSION = "1.7.0";
  const OVERLAY_KEY = "opti-fps-overlay";
  const OVERLAY_CFG_KEY = "opti-overlay-config";
  const ADV_KEY = "opti-advanced-mode";
  const HONESTY_KEY = "softtunes-honesty-ack";
  const SESSION_OPTS_KEY = "softtunes-session-opts";

  const LEGAL_FILES = {
    terms: { fr: "legal/cgu.fr.html", en: "legal/tos.en.html" },
    privacy: { fr: "legal/privacy.fr.html", en: "legal/privacy.en.html" },
    disclaimer: { fr: "legal/disclaimer.fr.html", en: "legal/disclaimer.en.html" },
  };

  const PAGE_TIPS = {
    dash: ["score", "bottleneck", "overlays"],
    session: ["overlays", "stutter", "softperf"],
    fps: ["fps-frametime", "stutter", "bottleneck"],
    nvidia: ["softperf", "soft-vs-ab", "thermals"],
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
    const btnLang = $("#btnLang");
    if (btnLang && pack().btnLang) btnLang.textContent = pack().btnLang;
  }

  function setLang(next) {
    if (next !== "fr" && next !== "en") return;
    lang = next;
    try { localStorage.setItem("opti-lang", lang); } catch (_) {}
    applyI18n();
    const aboutVer = $("#aboutVersion");
    if (aboutVer) aboutVer.textContent = `v${APP_VERSION} · ${lang === "en" ? "final version" : "version finale"}`;
    const meta = (PAGE_META[lang] || PAGE_META.fr)[currentPage];
    if (meta) {
      $("#pageTitle").textContent = meta[0];
      $("#pageSub").textContent = meta[1];
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
    const h = prefetched || (await runJob("getHealth", {}));
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

    if (resolved === "about") {
      const activeTab = $(".legal-tab.active");
      loadLegal(activeTab ? activeTab.dataset.doc : "terms").catch(() => {});
    }
    if (resolved === "net") refreshDns().catch(() => {});
    if (resolved === "nvidia") {
      refreshSoftPerf().catch(() => {});
      refreshSoftOc().catch(() => {});
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

  function confirmSessionPreset() {
    const p = pack();
    let body = p.presetConfirmBody || "";
    const rp = $("#chkCreateRp");
    if (rp && rp.checked) {
      body += lang === "en" ? "\n\nA restore point will be created." : "\n\nUn point de restauration sera créé.";
    }
    return window.confirm((p.presetConfirmTitle || "Session") + "\n\n" + body);
  }

  async function applySession(fromDash) {
    if (!confirmSessionPreset()) return;
    try {
      const payload = collectSessionPayload(fromDash);
      const r = await runJob("applySessionPreset", payload);
      log(r.MessageFr && lang === "fr" ? r.MessageFr : (r.Message || "OK"), "ok");
      persistSessionOpts();
      await refreshHealth();
      await refreshPower().catch(() => {});
      await refreshBoost().catch(() => {});
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

  async function refreshPower() {
    const d = await run("getPowerPlans", {});
    const plans = d.plans || [];
    const list = $("#powerList");
    if (!list) return;
    list.innerHTML = plans.length
      ? plans.map((p) => `<li>${p.active ? "★ " : ""}${esc(p.name)} <span class="muted">${esc(p.guid)}</span></li>`).join("")
      : '<li class="muted">—</li>';
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

  async function refreshSoftPerf() {
    const d = await run("getSoftPerf", {});
    const os = d.os || {};
    const gpu = d.gpu || {};
    const nv = d.nvidia || {};
    const gpuNames = ((gpu.gpus || []).map((g) => g.name).filter(Boolean).join(", ")) || "—";
    const status = $("#softPerfStatus");
    if (status) {
      const nvLine = nv.available
        ? `${nv.name || "NVIDIA"} · PL ${nv.currentPl}W`
        : (lang === "en" ? "nvidia-smi unavailable" : "nvidia-smi indisponible");
      status.textContent = lang === "en"
        ? `GPU: ${gpuNames} · HAGS: ${os.hagsEnabled == null ? "?" : os.hagsEnabled ? "on" : "off"} · ${nvLine}`
        : `GPU : ${gpuNames} · HAGS : ${os.hagsEnabled == null ? "?" : os.hagsEnabled ? "on" : "off"} · ${nvLine}`;
    }
    if ($("#chkHags") && os.hagsEnabled != null) $("#chkHags").checked = !!os.hagsEnabled;
    const canNv = !!nv.available;
    ["btnPlEco", "btnPlStock", "btnPlPerf"].forEach((id) => {
      const b = $("#" + id);
      if (b) b.disabled = !canNv;
    });
    const nav = $("#navNvidia");
    if (nav) nav.hidden = !canNv;
  }

  async function updateNvidiaNav() {
    try { await refreshSoftPerf(); } catch (_) {}
  }

  async function refreshSoftOc() {
    const d = await run("getSoftOc", {});
    const nv = d.nvidia || {};
    const ab = d.afterburner || {};
    const el = $("#softOcStatus");
    if (el) {
      el.textContent = nv.available
        ? `${nv.name || "NVIDIA"} · core ${nv.coreCurrent}/${nv.coreMax} MHz · mem ${nv.memCurrent}/${nv.memMax} MHz`
        : (lang === "en" ? `Clocks unavailable (${nv.reason || "n/a"})` : `Horloges indisponibles (${nv.reason || "n/a"})`);
    }
    const abEl = $("#afterburnerStatus");
    if (abEl) {
      abEl.textContent = ab.found
        ? (lang === "en" ? `Found: ${ab.path}` : `Trouvé : ${ab.path}`)
        : (lang === "en" ? "Afterburner not installed" : "Afterburner non installé");
    }
    ["btnOcStock", "btnOc50", "btnOc100"].forEach((id) => {
      const b = $("#" + id);
      if (b) b.disabled = !nv.available;
    });
  }

  function defaultOverlayConfig() {
    return {
      layout: "line",
      show: {
        brand: true, fps: true, frametime: true, onePercentLow: true,
        app: true, cpu: true, cpuTemp: true, gpu: true, gpuTemp: true, ram: true,
      },
    };
  }

  function applyOverlayPreset(name) {
    const preset = name === "full" ? defaultOverlayConfig() : OVERLAY_PRESETS[name];
    if (!preset) return;
    applyOverlayConfigToForm(preset);
    persistOverlayConfig().catch(() => {});
  }

  function collectOverlayConfigFromForm() {
    const cfg = defaultOverlayConfig();
    const sel = $("#selOverlayLayout");
    if (sel && (sel.value === "line" || sel.value === "card")) cfg.layout = sel.value;
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
        if (d && d.needsAdmin) {
          lines.push(lang === "en"
            ? "Try « Elevate (admin) » in the header, then reopen FPS."
            : "Essayez « Élever (admin) » en haut, puis rouvrez FPS.");
        } else if (active) {
          lines.push(lang === "en"
            ? "Capture is running. Focus a game window and wait a few seconds."
            : "La capture tourne. Mettez le jeu au premier plan et attendez.");
        } else {
          lines.push(lang === "en"
            ? "1. Launch a game · 2. Alt+Tab to the game · 3. Run SoftTunes as admin if still empty"
            : "1. Lancez un jeu · 2. Alt+Tab vers le jeu · 3. Élevez SoftTunes en admin si vide");
        }
        hintEl.textContent = lines.join(" ");
        hintEl.hidden = false;
      }
    }
  }

  async function scanClean() {
    const d = await runJob("scanCleanup", {});
    const items = d.items || [];
    $("#stTargets").textContent = String(items.length);
    $("#stEst").textContent = d.totalSize || "—";
    $("#cleanCats").innerHTML = items
      .map(
        (it) => `<label class="check-item"><input type="checkbox" data-id="${esc(it.id)}" ${it.exists && it.bytes > 0 ? "checked" : ""}/>
        <div><div class="t">${esc(it.name)}</div><div class="d">${esc(it.size)} — ${esc(it.path)}</div></div></label>`
      )
      .join("");
    log(`Cleanup scan: ${d.totalSize}`, "ok");
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
        if (!window.confirm(p.undoConfirm || "Annuler cette action ?")) return;
        try {
          const r = await runJob("runUndo", { id: btn.dataset.undo });
          const cls = r.Partial ? "warn" : r.Success === false ? "err" : "ok";
          log(r.Message || "Undo OK", cls);
          await refreshSessions();
          await refreshHealth();
        } catch (e) {
          log(String(e.message || e), "err");
        }
      });
    });
  }

  async function loadLegal(doc) {
    const key = doc && LEGAL_FILES[doc] ? doc : "terms";
    const file = LEGAL_FILES[key][lang] || LEGAL_FILES[key].fr;
    const frame = $("#legalFrame");
    if (!frame) return;
    try {
      if (!legalCache[file]) {
        const res = await fetch(file, { cache: "no-store" });
        legalCache[file] = res.ok ? await res.text() : `<p>(${key})</p>`;
      }
      frame.srcdoc = legalCache[file];
    } catch (_) {
      frame.srcdoc = `<p>(${key})</p>`;
    }
  }

  function wire() {
    $("#nav").addEventListener("click", (e) => {
      const btn = e.target.closest(".nav-btn");
      if (btn) showPage(btn.dataset.page);
    });

    $("#btnRestore").addEventListener("click", async () => {
      if (!window.confirm(p.rpConfirm || "Creer un point de restauration ?")) return;
      try {
        const r = await runJob("createRestorePoint", {});
        log(r.Message || JSON.stringify(r), r.Success ? "ok" : "warn");
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
      if (btn) {
        btn.addEventListener("click", async () => {
          if (!window.confirm((p.powerConfirm || "Appliquer le plan d'alimentation") + "\n\n" + profile)) return;
          try {
            const r = await runJob("setPowerPlan", { profile });
            log(r.Message, "ok");
          } catch (e) {
            log(e.message, "err");
          }
        });
      }
    };
    bindPower("#btnPowerBalanced", "balanced");
    bindPower("#btnPowerHigh", "high");
    bindPower("#btnPowerUlt", "ultimate");

    const btnGm = $("#btnApplyGm");
    if (btnGm) {
      btnGm.addEventListener("click", async () => {
        if (!window.confirm(p.gmConfirm || "Appliquer Game Mode / Focus Assist ?")) return;
        try {
          const r = await runJob("setGameMode", {
            gameMode: $("#chkGameMode").checked,
            disableGameBar: $("#chkDisableBar").checked,
            focusAssist: $("#chkFocus").checked,
          });
          log(r.Message, "ok");
          persistSessionOpts();
        } catch (e) {
          log(e.message, "err");
        }
      });
    }

    const btnStartBoost = $("#btnStartBoost");
    if (btnStartBoost) {
      btnStartBoost.addEventListener("click", async () => {
        if (!window.confirm(p.boostConfirm || "Lancer le boost (fermeture overlays) ?")) return;
        try {
          const r = await runJob("startBoost", {
            killOverlays: $("#chkKillOv").checked,
            includeDiscord: $("#chkDiscord").checked,
            includeGpuOverlay: $("#chkGpuOv").checked,
          });
          log(r.Message, "ok");
          persistSessionOpts();
          await refreshBoost();
        } catch (e) {
          log(e.message, "err");
        }
      });
    }
    const btnStopBoost = $("#btnStopBoost");
    if (btnStopBoost) {
      btnStopBoost.addEventListener("click", async () => {
        try {
          const r = await runJob("stopBoost", {});
          log(r.Message, "ok");
          await refreshBoost();
        } catch (e) {
          log(e.message, "err");
        }
      });
    }

    const btnVisual = $("#btnVisual");
    if (btnVisual) {
      btnVisual.addEventListener("click", async () => {
        try {
          const r = await runJob("setVisual", {
            reduceEffects: $("#chkFx").checked,
            disableAnimations: $("#chkAnim").checked,
            disableTransparency: $("#chkTrans").checked,
          });
          log(r.Message, "ok");
          persistSessionOpts();
        } catch (e) {
          log(e.message, "err");
        }
      });
    }

    $$("#page-session input[type=checkbox]").forEach((el) => {
      el.addEventListener("change", persistSessionOpts);
    });

    $("#btnScanClean").addEventListener("click", () => scanClean().catch((e) => log(e.message, "err")));
    $("#btnRunClean").addEventListener("click", async () => {
      if (!confirm(pack().confirmDanger || "Confirm?")) return;
      const ids = $$("#cleanCats input:checked").map((i) => i.dataset.id);
      try {
        const r = await runJob("runCleanup", { ids });
        log(r.Message, "ok");
        await scanClean();
      } catch (e) {
        log(e.message, "err");
      }
    });

    $("#btnSetDns").addEventListener("click", async () => {
      if (!window.confirm(p.dnsConfirm || "Appliquer le DNS selectionne ?")) return;
      try {
        const r = await runJob("setDns", { presetId: $("#dnsPreset").value });
        log(r.Message, "ok");
      } catch (e) {
        log(e.message, "err");
      }
    });
    $("#btnFlushDns").addEventListener("click", async () => {
      if (!window.confirm(p.flushDnsConfirm || "Vider le cache DNS ?")) return;
      try {
        const r = await runJob("flushDns", {});
        log(r.Message, "ok");
      } catch (e) {
        log(e.message, "err");
      }
    });

    $("#btnScanSvc").addEventListener("click", () => refreshServices().catch((e) => log(e.message, "err")));
    $("#btnApplySvc").addEventListener("click", async () => {
      if (!confirm(pack().confirmDanger || "Confirm?")) return;
      const names = $$("#svcList input:checked").map((i) => i.dataset.name);
      try {
        const r = await runJob("setServices", { names });
        log(r.Message, "ok");
        await refreshServices();
      } catch (e) {
        log(e.message, "err");
      }
    });
    $("#btnScanStartup").addEventListener("click", () => refreshStartup().catch((e) => log(e.message, "err")));
    $("#btnDisableStartup").addEventListener("click", async () => {
      if (!confirm(pack().confirmDanger || "Confirm?")) return;
      const items = $$("#startupList input:checked").map((i) => ({
        Name: decodeURIComponent(i.dataset.name),
        Hive: decodeURIComponent(i.dataset.hive),
        Command: decodeURIComponent(i.dataset.cmd || ""),
        Protected: false,
      }));
      try {
        const r = await runJob("disableStartup", { items });
        log(r.Message, "ok");
        await refreshStartup();
      } catch (e) {
        log(e.message, "err");
      }
    });

    const btnSoftOs = $("#btnSoftPerfOs");
    if (btnSoftOs) {
      btnSoftOs.addEventListener("click", async () => {
        if (!confirm(pack().confirmSoftPerf || pack().confirmDanger || "Confirm?")) return;
        try {
          const r = await runJob("setSoftPerfOs", {
            enableSoftOs: true,
            setHags: !!($("#chkApplyHags") && $("#chkApplyHags").checked),
            hagsEnabled: !!($("#chkHags") && $("#chkHags").checked),
          });
          log(r.Message || "OK", "ok");
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
          const r = await runJob("resetSoftPerf", {});
          log(r.Message || "OK", r.Success === false ? "err" : "ok");
          await refreshSoftPerf();
        } catch (e) {
          log(e.message, "err");
        }
      });
    }
    const setPl = (preset) => async () => {
      if (!confirm(pack().confirmSoftPerf || pack().confirmDanger || "Confirm?")) return;
      try {
        const r = await runJob("setNvidiaPowerLimit", { preset });
        log(r.Message || "OK", r.Success === false ? "err" : "ok");
        await refreshSoftPerf();
      } catch (e) {
        log(e.message, "err");
      }
    };
    if ($("#btnPlEco")) $("#btnPlEco").addEventListener("click", setPl("eco"));
    if ($("#btnPlStock")) $("#btnPlStock").addEventListener("click", setPl("stock"));
    if ($("#btnPlPerf")) $("#btnPlPerf").addEventListener("click", setPl("perf"));

    const setOc = (preset) => async () => {
      if (!confirm(pack().confirmSoftOc || pack().confirmDanger || "Confirm?")) return;
      try {
        const r = await runJob("setNvidiaClocks", { preset });
        log(r.Message || "OK", r.Success === false ? "err" : "ok");
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
          log(r.Message || "OK", r.Success === false ? "warn" : "ok");
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

    const btnEl = $("#btnElevate");
    if (btnEl) {
      btnEl.addEventListener("click", async () => {
        try {
          const api = B.api;
          if (!api || !api.request_elevation) { log("Elevation API missing", "err"); return; }
          const r = await api.request_elevation();
          if (r && r.alreadyAdmin) log(lang === "en" ? "Already admin" : "Déjà admin", "ok");
          else if (r && r.elevating) log(lang === "en" ? "UAC prompted — relaunching" : "UAC demandé — relance", "warn");
          else log((r && r.error) || "Elevation failed", "err");
        } catch (e) {
          log(String(e.message || e), "err");
        }
      });
    }

    const gotoSession = $("#btnGotoSession");
    if (gotoSession) gotoSession.addEventListener("click", () => showPage("session"));
    const gotoFps = $("#btnGotoFps");
    if (gotoFps) gotoFps.addEventListener("click", () => showPage("fps"));

    const btnLang = $("#btnLang");
    if (btnLang) btnLang.addEventListener("click", () => setLang(lang === "fr" ? "en" : "fr"));

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

    const legalTabs = $(".legal-tabs");
    if (legalTabs) {
      legalTabs.addEventListener("click", (e) => {
        const tab = e.target.closest(".legal-tab");
        if (!tab) return;
        $$(".legal-tab").forEach((t) => t.classList.toggle("active", t === tab));
        loadLegal(tab.dataset.doc).catch(() => {});
      });
    }

    const honestyAck = $("#honestyAck");
    if (honestyAck) {
      honestyAck.addEventListener("click", () => {
        const dont = $("#honestyDontShow");
        hideHonestyGate(!!(dont && dont.checked));
      });
    }
    const btnHonestyReminder = $("#btnHonestyReminder");
    if (btnHonestyReminder) btnHonestyReminder.addEventListener("click", () => maybeShowHonestyGate(true));

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

  async function checkReleaseNotice() {
    const api = B.api;
    if (!api || typeof api.check_latest_release !== "function") return;
    let info;
    try {
      info = await api.check_latest_release();
    } catch (_) {
      return;
    }
    const bar = document.getElementById("hubReleaseBanner");
    if (!bar || !info?.ok || !info.updateAvailable) return;
    const remote = String(info.remote || "");
    try {
      if (sessionStorage.getItem("hubReleaseDismissed") === remote) return;
    } catch (_) {}
    bar.hidden = false;
    bar.innerHTML =
      '<div class="hub-release-text"><strong>Nouvelle version</strong><span></span></div>' +
      '<div class="hub-release-actions">' +
      '<button type="button" class="hub-release-btn" id="hubReleaseOpen">Ouvrir la release</button>' +
      '<button type="button" class="hub-release-dismiss" id="hubReleaseDismiss" aria-label="Fermer">×</button>' +
      "</div>";
    const span = bar.querySelector(".hub-release-text span");
    if (span) span.textContent = info.message || `Nouvelle version ${remote}`;
    document.getElementById("hubReleaseDismiss")?.addEventListener("click", () => {
      try { sessionStorage.setItem("hubReleaseDismissed", remote); } catch (_) {}
      bar.hidden = true;
      bar.innerHTML = "";
    });
    document.getElementById("hubReleaseOpen")?.addEventListener("click", async () => {
      try {
        if (typeof api.open_release_page === "function") await api.open_release_page(info.releaseUrl || "");
      } catch (_) {}
    });
  }

  async function boot() {
    B.setApi(await B.waitApi());
    if (!B.api) {
      log("Host pywebview non détecté — lancez SoftTunes (Opti.exe)", "err");
      return;
    }
    try {
      const saved = localStorage.getItem("opti-lang");
      if (saved === "en" || saved === "fr") lang = saved;
      else if (navigator.language && navigator.language.toLowerCase().startsWith("en")) lang = "en";
      if (window.MrAurevoXSuite) window.MrAurevoXSuite.applyAccent("#e03545");
    } catch (_) {}
    applyI18n();
    wire();
    maybeShowHonestyGate(false);
    const aboutVer = $("#aboutVersion");
    if (aboutVer) aboutVer.textContent = `v${APP_VERSION} · ${lang === "en" ? "final version" : "version finale"}`;

    try {
      const ping = await run("ping", {});
      let admin = !!(ping && ping.admin);
      try {
        if (B.api && B.api.is_admin) admin = !!(await B.api.is_admin());
      } catch (_) {}
      const badge = $("#adminBadge");
      if (badge) {
        if (admin) { badge.textContent = pack().adminOk; badge.className = "badge ok"; }
        else { badge.textContent = pack().adminNo; badge.className = "badge warn"; }
      }
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
