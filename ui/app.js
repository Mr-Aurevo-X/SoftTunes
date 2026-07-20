/* Opti UI — pywebview bridge */
(function () {
  "use strict";

  const APP_VERSION = "1.1.0";

  const SUITE_I18N = {
    fr: {
      tagline: "Performance gaming, sans compromis",
      copyright: "© 2026 Mr-Aurevo-X · local · pas de collecte",
      elevating: "Élévation…",
      ready: "Prêt",
      adminOk: "Admin",
      adminNo: "Sans admin",

      navGroupPerf: "Performances",
      navGroupSys: "Système",
      navGroupGames: "Jeux",
      navGroupHistory: "Historique",
      navGroupLegal: "Légal",

      navDash: "Dashboard",
      navPower: "Power",
      navGameMode: "Game Mode",
      navBoost: "Boost",
      navTimer: "Timer / Prio",
      navClean: "Cleanup",
      navNet: "Réseau",
      navVisual: "Visuel",
      navServices: "Services",
      navStartup: "Démarrage",
      navDebloat: "Debloat",
      navProfiles: "Profils jeu",
      navSessions: "Sessions",
      navAbout: "À propos",

      btnRestore: "Point de restauration",
      btnRefresh: "Rafraîchir",
      btnPreset: "Optimiser pour jouer",
      btnOpenPowerPlan: "Ouvrir PowerPlan",
      btnOpenWinClean: "Ouvrir WinCleaner",
      btnBalanced: "Équilibré",
      btnHigh: "Hautes perfs",
      btnUltimate: "Ultimate",
      btnApply: "Appliquer",
      btnStartBoost: "Démarrer boost",
      btnStopBoost: "Terminer session",
      btnScan: "Analyser",
      btnClean: "Nettoyer",
      btnSetDns: "Appliquer DNS",
      btnFlushDns: "Flush DNS",
      btnApplyTcp: "Appliquer tweaks",
      btnDisableSvc: "Passer en manuel",
      btnDisableStartup: "Désactiver sélection",
      btnRemoveBloat: "Supprimer sélection",
      btnApplyTimer: "Appliquer timer",
      btnClearTimer: "Clear timer",
      btnMmcs: "MMCS gaming",
      btnPrio: "Priorité",
      btnFindGames: "Détecter jeux",
      btnCancel: "Annuler",

      scoreLabel: "Score gaming",
      dashHelp: "Un clic pour préparer Windows au jeu : alimentation, Game Mode, effets visuels, overlays. Un point de restauration est créé automatiquement.",

      powerTitle: "Plan d'alimentation",
      powerHelp: "Bascule le plan d'alimentation Windows actif. Hautes perfs / Ultimate maximisent le CPU au prix de la conso.",
      gmTitle: "Game Mode & Focus",
      gmHelp: "Active le Game Mode Windows, coupe Game Bar / DVR (capture en arrière-plan) et le Focus Assist pendant le jeu.",
      boostTitle: "Session boost",
      boostHelp: "Ferme les overlays en tâche de fond pour libérer RAM/CPU pendant une session de jeu. Réversible via « Terminer session ».",
      cleanTitle: "Caches gaming",
      cleanHelp: "Vide les caches shaders/launchers (NVIDIA, AMD, Steam, Epic, Discord…). Régénérés automatiquement au prochain lancement.",
      netTitle: "DNS & latence",
      netHelp: "Change le DNS système pour un résolveur rapide (Cloudflare, Google…). Réversible avec Undo ou en repassant sur DHCP.",
      tcpHelp: "Ajuste des paramètres TCP avancés (autotuning, Nagle) pour réduire la latence réseau. Peut affecter la stabilité sur certaines configs.",
      visualTitle: "Effets Windows",
      visualHelp: "Réduit les effets visuels Windows (animations, transparence) pour libérer un peu de CPU/GPU. Aucun impact sur la stabilité.",
      svcTitle: "Services gaming",
      svcHelp: "Passe les services non essentiels en démarrage manuel. Ils restent installés et peuvent redémarrer automatiquement si nécessaire.",
      startupTitle: "Démarrage",
      startupHelp: "Désactive les entrées lancées automatiquement à l'ouverture de session. Les entrées protégées (🔒) sont ignorées par sécurité.",
      bloatTitle: "Apps détectées",
      bloatHelp: "Supprime les applications préinstallées non essentielles (AppX). Les apps système critiques sont toujours protégées.",
      timerTitle: "Timer & priorités",
      timerHelp: "Force une résolution timer fine (~1ms) pour réduire les micro-freezes. Augmente la conso batterie sur portable.",
      prioHelp: "Relève la priorité CPU d'un processus par son nom. À utiliser avec précaution (risque d'instabilité système).",
      profilesTitle: "Profils par jeu",
      profilesHelp: "Détecte vos jeux Steam/Epic et enregistre un profil de réglages (power, Game Mode, boost…) à appliquer en un clic avant de lancer.",
      savedProfiles: "Profils enregistrés",
      historyTitle: "Historique",
      historyHelp: "Journal des actions appliquées par Opti sur cette machine.",
      undoTitle: "Undo",
      undoHelp: "Annule une action précédente (DNS, services, visuel…) et restaure l'état antérieur.",
      consoleTitle: "Console",

      badgeRec: "Recommandé",
      badgeOptin: "Opt-in",
      badgeAdv: "Avancé",

      statTargets: "Cibles",
      statEst: "Estimation",
      chkGameMode: "Activer Game Mode",
      chkDisableBar: "Désactiver Game Bar / DVR",
      chkFocus: "Focus Assist / Quiet Hours",
      chkKillOv: "Stop overlays",
      chkDiscord: "Inclure Discord",
      chkGpuOv: "Inclure overlay NVIDIA/AMD",
      chkTcp: "Tweaks TCP gaming (opt-in)",
      chkFx: "Meilleures performances visuelles",
      chkAnim: "Désactiver animations",
      chkTrans: "Désactiver transparence",
      chkTimer: "Activer timer ~1ms (opt-in)",
      guardBoost: "Arrête les overlays (Xbox Game Bar, etc.). Discord / overlays GPU = opt-in.",
      guardNet: "Tweaks TCP = opt-in. DNS reversible via undo.",
      guardSvc: "Services protégés (Defender, Update, audio, réseau) jamais touchés.",
      guardDebloat: "keep-apps.txt protège Store, Terminal, Xbox identity, etc.",
      guardTimer: "Timer resolution = agressif (batterie/thermiques). MMCS nécessite admin.",
      emptyGames: "Détecte des jeux Steam/Epic…",
      prioPh: "Nom process (ex. game)",

      aboutCopyright: "© 2026 Mr-Aurevo-X — Tous droits réservés.",
      aboutDisclaimer: "Opti est fourni « en l'état », sans garantie de gain de performance. Créez un point de restauration avant tout preset groupé et utilisez d'abord les réglages Recommandés.",
      legalTitle: "Mentions légales",
      legalTerms: "CGU / ToS",
      legalPrivacy: "Confidentialité",
      legalDisclaimer: "Disclaimer",
      smartTitle: "Windows a protégé votre PC (SmartScreen)",
      smartHelp: "Opti n'est pas encore signé par un éditeur reconnu de Microsoft. Ceci est normal pour un logiciel indépendant : suivez les étapes ci-dessous pour lancer l'application.",
    },
    en: {
      tagline: "Gaming performance, no compromise",
      copyright: "© 2026 Mr-Aurevo-X · local · no collection",
      elevating: "Elevating…",
      ready: "Ready",
      adminOk: "Admin",
      adminNo: "No admin",

      navGroupPerf: "Performance",
      navGroupSys: "System",
      navGroupGames: "Games",
      navGroupHistory: "History",
      navGroupLegal: "Legal",

      navDash: "Dashboard",
      navPower: "Power",
      navGameMode: "Game Mode",
      navBoost: "Boost",
      navTimer: "Timer / Prio",
      navClean: "Cleanup",
      navNet: "Network",
      navVisual: "Visual",
      navServices: "Services",
      navStartup: "Startup",
      navDebloat: "Debloat",
      navProfiles: "Game profiles",
      navSessions: "Sessions",
      navAbout: "About",

      btnRestore: "Restore point",
      btnRefresh: "Refresh",
      btnPreset: "Optimize for gaming",
      btnOpenPowerPlan: "Open PowerPlan",
      btnOpenWinClean: "Open WinCleaner",
      btnBalanced: "Balanced",
      btnHigh: "High perf",
      btnUltimate: "Ultimate",
      btnApply: "Apply",
      btnStartBoost: "Start boost",
      btnStopBoost: "End session",
      btnScan: "Scan",
      btnClean: "Clean",
      btnSetDns: "Apply DNS",
      btnFlushDns: "Flush DNS",
      btnApplyTcp: "Apply tweaks",
      btnDisableSvc: "Set manual",
      btnDisableStartup: "Disable selected",
      btnRemoveBloat: "Remove selected",
      btnApplyTimer: "Apply timer",
      btnClearTimer: "Clear timer",
      btnMmcs: "MMCS gaming",
      btnPrio: "Priority",
      btnFindGames: "Find games",
      btnCancel: "Cancel",

      scoreLabel: "Gaming score",
      dashHelp: "One click to get Windows game-ready: power plan, Game Mode, visual effects, overlays. A restore point is created automatically.",

      powerTitle: "Power plan",
      powerHelp: "Switches the active Windows power plan. High perf / Ultimate maximize CPU at the cost of power draw.",
      gmTitle: "Game Mode & Focus",
      gmHelp: "Enables Windows Game Mode, disables Game Bar / DVR (background capture) and Focus Assist while gaming.",
      boostTitle: "Boost session",
      boostHelp: "Closes background overlays to free up RAM/CPU during a gaming session. Reversible via \u201cEnd session\u201d.",
      cleanTitle: "Gaming caches",
      cleanHelp: "Clears shader/launcher caches (NVIDIA, AMD, Steam, Epic, Discord…). Automatically rebuilt on next launch.",
      netTitle: "DNS & latency",
      netHelp: "Changes the system DNS resolver to a fast one (Cloudflare, Google…). Reversible via Undo or by switching back to DHCP.",
      tcpHelp: "Adjusts advanced TCP settings (autotuning, Nagle) to reduce network latency. May affect stability on some setups.",
      visualTitle: "Windows effects",
      visualHelp: "Reduces Windows visual effects (animations, transparency) to free up a bit of CPU/GPU. No stability impact.",
      svcTitle: "Gaming services",
      svcHelp: "Sets non-essential services to manual startup. They stay installed and can still start automatically if needed.",
      startupTitle: "Startup",
      startupHelp: "Disables entries that auto-launch at sign-in. Protected entries (🔒) are skipped for safety.",
      bloatTitle: "Detected apps",
      bloatHelp: "Removes non-essential preinstalled apps (AppX). Critical system apps are always protected.",
      timerTitle: "Timer & priorities",
      timerHelp: "Forces a fine timer resolution (~1ms) to reduce micro-stutters. Increases battery drain on laptops.",
      prioHelp: "Raises CPU priority for a process by name. Use with care (risk of system instability).",
      profilesTitle: "Per-game profiles",
      profilesHelp: "Detects your Steam/Epic games and saves a settings profile (power, Game Mode, boost…) to apply in one click before launching.",
      savedProfiles: "Saved profiles",
      historyTitle: "History",
      historyHelp: "Log of actions applied by Opti on this machine.",
      undoTitle: "Undo",
      undoHelp: "Reverts a previous action (DNS, services, visual…) and restores the prior state.",
      consoleTitle: "Console",

      badgeRec: "Recommended",
      badgeOptin: "Opt-in",
      badgeAdv: "Advanced",

      statTargets: "Targets",
      statEst: "Estimate",
      chkGameMode: "Enable Game Mode",
      chkDisableBar: "Disable Game Bar / DVR",
      chkFocus: "Focus Assist / Quiet Hours",
      chkKillOv: "Stop overlays",
      chkDiscord: "Include Discord",
      chkGpuOv: "Include NVIDIA/AMD overlay",
      chkTcp: "TCP gaming tweaks (opt-in)",
      chkFx: "Best performance visuals",
      chkAnim: "Disable animations",
      chkTrans: "Disable transparency",
      chkTimer: "Enable ~1ms timer (opt-in)",
      guardBoost: "Stops overlays (Xbox Game Bar, etc.). Discord / GPU overlays = opt-in.",
      guardNet: "TCP tweaks = opt-in. DNS reversible via undo.",
      guardSvc: "Protected services (Defender, Update, audio, network) never touched.",
      guardDebloat: "keep-apps.txt protects Store, Terminal, Xbox identity, etc.",
      guardTimer: "Timer resolution is aggressive (battery/thermals). MMCS needs admin.",
      emptyGames: "Scan Steam/Epic games…",
      prioPh: "Process name (e.g. game)",

      aboutCopyright: "© 2026 Mr-Aurevo-X — All rights reserved.",
      aboutDisclaimer: "Opti is provided \u201cas is\u201d, with no guaranteed performance gain. Create a restore point before any bulk preset and try Recommended settings first.",
      legalTitle: "Legal notices",
      legalTerms: "Terms",
      legalPrivacy: "Privacy",
      legalDisclaimer: "Disclaimer",
      smartTitle: "Windows protected your PC (SmartScreen)",
      smartHelp: "Opti isn't yet signed by a Microsoft-recognized publisher. This is normal for independent software: follow the steps below to launch the app.",
    },
  };

  const PAGE_META = {
    fr: {
      dash: ["Dashboard", "Score gaming et actions rapides"],
      power: ["Power", "Plans d'alimentation"],
      gamemode: ["Game Mode", "Game Mode, Game Bar, Focus"],
      boost: ["Boost", "Session overlays"],
      clean: ["Cleanup", "Caches GPU et launchers"],
      net: ["Réseau", "DNS et tweaks latence"],
      visual: ["Visuel", "Effets Windows"],
      services: ["Services", "Services gaming-safe"],
      startup: ["Démarrage", "Entrées au démarrage"],
      debloat: ["Debloat", "AppX non essentiels"],
      timer: ["Timer / Prio", "Timer resolution et priorités"],
      profiles: ["Profils jeu", "Appliquer un profil et lancer"],
      sessions: ["Sessions", "Historique et undo"],
      about: ["À propos", "Mentions légales et informations"],
    },
    en: {
      dash: ["Dashboard", "Gaming score and quick actions"],
      power: ["Power", "Power plans"],
      gamemode: ["Game Mode", "Game Mode, Game Bar, Focus"],
      boost: ["Boost", "Overlay session"],
      clean: ["Cleanup", "GPU and launcher caches"],
      net: ["Network", "DNS and latency tweaks"],
      visual: ["Visual", "Windows effects"],
      services: ["Services", "Gaming-safe services"],
      startup: ["Startup", "Startup entries"],
      debloat: ["Debloat", "Non-essential AppX"],
      timer: ["Timer / Prio", "Timer resolution and priorities"],
      profiles: ["Game profiles", "Apply profile and launch"],
      sessions: ["Sessions", "History and undo"],
      about: ["About", "Legal notices and information"],
    },
  };

  const LEGAL_FILES = {
    terms: { fr: "legal/cgu.fr.html", en: "legal/tos.en.html" },
    privacy: { fr: "legal/privacy.fr.html", en: "legal/privacy.en.html" },
    disclaimer: { fr: "legal/disclaimer.fr.html", en: "legal/disclaimer.fr.html" },
  };

  let api = null;
  let lang = "fr";
  let jobBusy = false;
  const legalCache = {};

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  function log(msg, cls) {
    const el = $("#log");
    if (!el) return;
    const line = document.createElement("div");
    if (cls) line.className = cls;
    line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    el.appendChild(line);
    el.scrollTop = el.scrollHeight;
  }

  function setStatus(t) {
    const el = $("#sideStatus");
    if (el) el.textContent = t;
  }

  function setProgress(pct, detail) {
    const bar = $("#progBar");
    const label = $("#progLabel");
    if (bar) bar.style.width = `${Math.max(0, Math.min(100, pct))}%`;
    if (label) label.textContent = detail ? `${pct}% — ${detail}` : pct ? `${pct}%` : "";
  }

  async function waitApi(retries = 80) {
    for (let i = 0; i < retries; i++) {
      if (window.pywebview && window.pywebview.api) return window.pywebview.api;
      await new Promise((r) => setTimeout(r, 50));
    }
    return null;
  }

  async function run(action, payload) {
    if (!api) throw new Error("API host indisponible");
    const res = await api.run(action, payload || {});
    if (!res || !res.ok) throw new Error((res && res.error) || "Échec");
    return res.data;
  }

  async function runJob(action, payload) {
    if (!api) throw new Error("API host indisponible");
    if (jobBusy) throw new Error("Action déjà en cours");
    jobBusy = true;
    setProgress(0, action);
    try {
      const start = await api.start_action(action, payload || {});
      if (!start || !start.ok) throw new Error((start && start.error) || "start_action failed");
      for (;;) {
        await new Promise((r) => setTimeout(r, 200));
        const prog = await api.get_action_progress();
        const d = (prog && prog.data) || {};
        setProgress(d.percent || 0, d.detail || d.phase || "");
        if (d.done && !d.running) {
          if (d.error) throw new Error(d.error);
          break;
        }
      }
      const result = await api.get_action_result();
      if (!result || !result.ok) throw new Error((result && result.error) || "Échec");
      return result.data;
    } finally {
      jobBusy = false;
      setProgress(100, "");
    }
  }

  function applyI18n() {
    if (window.MrAurevoXSuite) {
      window.MrAurevoXSuite.applyI18n(lang, SUITE_I18N);
    }
  }

  function showPage(page) {
    $$(".page").forEach((p) => p.classList.remove("active"));
    $$(".nav-btn").forEach((b) => b.classList.toggle("active", b.dataset.page === page));
    const el = $(`#page-${page}`);
    if (el) el.classList.add("active");
    const meta = (PAGE_META[lang] || PAGE_META.fr)[page] || [page, ""];
    $("#pageTitle").textContent = meta[0];
    $("#pageSub").textContent = meta[1];
    if (page === "about") {
      const activeTab = $(".legal-tab.active");
      loadLegal(activeTab ? activeTab.dataset.doc : "terms").catch(() => {});
    }
  }

  async function refreshHealth() {
    const h = await runJob("getHealth", {});
    const score = h.score || 0;
    $("#scoreRing").style.setProperty("--score", score);
    $("#scoreVal").textContent = String(score);
    const ramPct = h.ram ? h.ram.usedPercent : "—";
    const power = h.powerPlan || "—";
    const gm = h.gameMode ? "ON" : "OFF";
    $("#dashStats").innerHTML = `
      <div class="stat"><div class="label">RAM</div><div class="value">${ramPct}%</div></div>
      <div class="stat blue"><div class="label">CPU</div><div class="value">${h.cpuLoad || 0}%</div></div>
      <div class="stat ok"><div class="label">Power</div><div class="value" style="font-size:0.95rem">${power}</div></div>
      <div class="stat warn"><div class="label">Game Mode</div><div class="value">${gm}</div></div>`;
    log(`Score gaming: ${score}`, "ok");
  }

  async function refreshPower() {
    const d = await run("getPowerPlans", {});
    const plans = d.plans || [];
    $("#powerList").innerHTML = plans.length
      ? plans.map((p) => `<li>${p.active ? "★ " : ""}${p.name} <span class="muted">${p.guid}</span></li>`).join("")
      : '<li class="muted">—</li>';
  }

  async function refreshGameMode() {
    const s = await run("getGameMode", {});
    $("#chkGameMode").checked = !!s.gameMode;
    $("#chkDisableBar").checked = !s.gameBar;
    $("#chkFocus").checked = !!s.focusAssist;
  }

  async function refreshBoost() {
    const s = await run("getBoostStatus", {});
    const n = (s.overlays || []).length;
    const tpl = lang === "en"
      ? (s.active ? `Boost active — ${n} overlays seen` : `Inactive — ${n} overlays detected`)
      : (s.active ? `Boost actif — ${n} overlays vus` : `Inactif — ${n} overlays détectés`);
    $("#boostStatus").textContent = tpl;
  }

  async function scanClean() {
    const d = await runJob("scanCleanup", {});
    const items = d.items || [];
    $("#stTargets").textContent = String(items.length);
    $("#stEst").textContent = d.totalSize || "—";
    $("#cleanCats").innerHTML = items
      .map(
        (it) => `<label class="check-item"><input type="checkbox" data-id="${it.id}" ${it.exists && it.bytes > 0 ? "checked" : ""}/>
        <div><div class="t">${it.name}</div><div class="d">${it.size} — ${it.path}</div></div></label>`
      )
      .join("");
    log(`Cleanup scan: ${d.totalSize}`, "ok");
  }

  async function refreshDns() {
    const d = await run("getDnsPresets", {});
    const sel = $("#dnsPreset");
    sel.innerHTML = (d.presets || [])
      .map((p) => `<option value="${p.id}">${p.name}</option>`)
      .join("");
  }

  async function refreshServices() {
    const d = await run("getServices", {});
    $("#svcList").innerHTML = (d.items || [])
      .map(
        (it) => `<label class="check-item"><input type="checkbox" data-name="${it.Name}" ${it.Status === "Running" ? "checked" : ""}/>
        <div><div class="t">${it.DisplayName || it.Name}</div><div class="d">${it.Name} — ${it.Status} / ${it.StartType}</div></div></label>`
      )
      .join("") || '<div class="muted">—</div>';
  }

  async function refreshStartup() {
    const d = await run("getStartup", {});
    $("#startupList").innerHTML = (d.items || [])
      .map(
        (it) => `<label class="check-item"><input type="checkbox" data-name="${encodeURIComponent(it.Name)}" data-hive="${encodeURIComponent(it.Hive)}" data-cmd="${encodeURIComponent(it.Command || "")}" ${it.Protected ? "disabled" : ""}/>
        <div><div class="t">${it.Name}${it.Protected ? " 🔒" : ""}</div><div class="d">${it.Hive}</div></div></label>`
      )
      .join("") || '<div class="muted">—</div>';
  }

  async function scanBloat() {
    const d = await runJob("scanBloat", {});
    $("#bloatList").innerHTML = (d.apps || [])
      .map(
        (a) => `<label class="check-item"><input type="checkbox" data-pfn="${a.PackageFullName}" checked/>
        <div><div class="t">${a.Name}</div><div class="d">${a.Version}</div></div></label>`
      )
      .join("") || '<div class="muted">Aucune app</div>';
  }

  async function refreshProfiles() {
    const d = await run("getProfiles", {});
    const profiles = d.profiles || [];
    $("#profileList").innerHTML = profiles.length
      ? profiles
          .map(
            (p) =>
              `<li><button type="button" class="btn accent" style="height:28px;font-size:0.75rem;margin-right:8px" data-apply="${p.name}">▶</button>${p.name} <span class="muted">${p.exePath || ""}</span></li>`
          )
          .join("")
      : '<li class="muted">—</li>';
    $$("#profileList [data-apply]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        try {
          const r = await runJob("applyProfile", { name: btn.dataset.apply, launch: true });
          log(r.Message || "Profil appliqué", "ok");
        } catch (e) {
          log(String(e.message || e), "err");
        }
      });
    });
  }

  async function refreshSessions() {
    const d = await run("getSessions", {});
    $("#sessionList").innerHTML = (d.sessions || [])
      .map((s) => `<li>${s.createdAt || ""} — ${s.action}: ${s.summary || ""}</li>`)
      .join("") || '<li class="muted">—</li>';
    const u = await run("getUndoList", {});
    $("#undoList").innerHTML = (u.items || [])
      .map(
        (it) =>
          `<li><button type="button" class="btn" style="height:28px;font-size:0.75rem;margin-right:8px" data-undo="${it.id}">Undo</button>${it.name} — ${it.createdAt || ""}</li>`
      )
      .join("") || '<li class="muted">—</li>';
    $$("#undoList [data-undo]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        try {
          const r = await runJob("runUndo", { id: btn.dataset.undo });
          log(r.Message || "Undo OK", "ok");
          await refreshSessions();
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
      try {
        const r = await runJob("createRestorePoint", {});
        log(r.Message || JSON.stringify(r), r.Success ? "ok" : "warn");
      } catch (e) {
        log(String(e.message || e), "err");
      }
    });
    $("#btnCancel").addEventListener("click", async () => {
      if (api && api.cancel_action) await api.cancel_action();
      jobBusy = false;
      log("Annulé", "warn");
    });

    $("#btnHealthRefresh").addEventListener("click", () => refreshHealth().catch((e) => log(e.message, "err")));
    $("#btnPreset").addEventListener("click", async () => {
      try {
        const r = await runJob("applyGamingPreset", {});
        log(r.Message || "Preset OK", "ok");
        await refreshHealth();
      } catch (e) {
        log(String(e.message || e), "err");
      }
    });
    const btnPp = $("#btnOpenPowerPlan");
    if (btnPp) btnPp.addEventListener("click", () => api.open_suite_app("PowerPlan"));
    const btnWc = $("#btnOpenWinClean");
    if (btnWc) btnWc.addEventListener("click", () => api.open_suite_app("WinCleaner"));

    $("#btnPowerBalanced").addEventListener("click", () =>
      runJob("setPowerPlan", { profile: "balanced" }).then((r) => log(r.Message, "ok")).catch((e) => log(e.message, "err"))
    );
    $("#btnPowerHigh").addEventListener("click", () =>
      runJob("setPowerPlan", { profile: "high" }).then((r) => log(r.Message, "ok")).catch((e) => log(e.message, "err"))
    );
    $("#btnPowerUlt").addEventListener("click", () =>
      runJob("setPowerPlan", { profile: "ultimate" }).then((r) => log(r.Message, "ok")).catch((e) => log(e.message, "err"))
    );
    $("#btnPowerRefresh").addEventListener("click", () => refreshPower().catch((e) => log(e.message, "err")));

    $("#btnApplyGm").addEventListener("click", async () => {
      try {
        const r = await runJob("setGameMode", {
          gameMode: $("#chkGameMode").checked,
          disableGameBar: $("#chkDisableBar").checked,
          focusAssist: $("#chkFocus").checked,
        });
        log(r.Message, "ok");
      } catch (e) {
        log(e.message, "err");
      }
    });
    $("#btnRefreshGm").addEventListener("click", () => refreshGameMode().catch((e) => log(e.message, "err")));

    $("#btnStartBoost").addEventListener("click", async () => {
      try {
        const r = await runJob("startBoost", {
          killOverlays: $("#chkKillOv").checked,
          includeDiscord: $("#chkDiscord").checked,
          includeGpuOverlay: $("#chkGpuOv").checked,
        });
        log(r.Message, "ok");
        await refreshBoost();
      } catch (e) {
        log(e.message, "err");
      }
    });
    $("#btnStopBoost").addEventListener("click", async () => {
      try {
        const r = await runJob("stopBoost", {});
        log(r.Message, "ok");
        await refreshBoost();
      } catch (e) {
        log(e.message, "err");
      }
    });

    $("#btnScanClean").addEventListener("click", () => scanClean().catch((e) => log(e.message, "err")));
    $("#btnRunClean").addEventListener("click", async () => {
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
      try {
        const r = await runJob("setDns", { presetId: $("#dnsPreset").value });
        log(r.Message, "ok");
      } catch (e) {
        log(e.message, "err");
      }
    });
    $("#btnFlushDns").addEventListener("click", () =>
      runJob("flushDns", {}).then((r) => log(r.Message, "ok")).catch((e) => log(e.message, "err"))
    );
    $("#btnTcp").addEventListener("click", async () => {
      if (!$("#chkTcp").checked) {
        log(lang === "en" ? "Check the TCP opt-in first" : "Cochez l'opt-in TCP", "warn");
        return;
      }
      try {
        const r = await runJob("setNetworkTweaks", { tcpGaming: true });
        log(r.Message + (r.warning ? " — " + r.warning : ""), "warn");
      } catch (e) {
        log(e.message, "err");
      }
    });

    $("#btnVisual").addEventListener("click", async () => {
      try {
        const r = await runJob("setVisual", {
          reduceEffects: $("#chkFx").checked,
          disableAnimations: $("#chkAnim").checked,
          disableTransparency: $("#chkTrans").checked,
        });
        log(r.Message, "ok");
      } catch (e) {
        log(e.message, "err");
      }
    });

    $("#btnScanSvc").addEventListener("click", () => refreshServices().catch((e) => log(e.message, "err")));
    $("#btnApplySvc").addEventListener("click", async () => {
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

    $("#btnScanBloat").addEventListener("click", () => scanBloat().catch((e) => log(e.message, "err")));
    $("#btnRemoveBloat").addEventListener("click", async () => {
      const packageFullNames = $$("#bloatList input:checked").map((i) => i.dataset.pfn);
      try {
        const r = await runJob("removeBloat", { packageFullNames });
        log(r.Message, "ok");
        await scanBloat();
      } catch (e) {
        log(e.message, "err");
      }
    });

    $("#btnTimer").addEventListener("click", async () => {
      try {
        const r = await runJob("setTimer", { enable: $("#chkTimer").checked });
        log(r.Message, r.warning ? "warn" : "ok");
      } catch (e) {
        log(e.message, "err");
      }
    });
    $("#btnClearTimer").addEventListener("click", () =>
      runJob("clearTimer", {}).then((r) => log(r.Message, "ok")).catch((e) => log(e.message, "err"))
    );
    $("#btnMmcs").addEventListener("click", () =>
      runJob("setMmcs", { gaming: true }).then((r) => log(r.Message, "ok")).catch((e) => log(e.message, "err"))
    );
    $("#btnPrio").addEventListener("click", async () => {
      try {
        const r = await runJob("setPriority", {
          processName: $("#prioProc").value,
          priority: $("#prioLevel").value,
        });
        log(r.Message, "ok");
      } catch (e) {
        log(e.message, "err");
      }
    });

    $("#btnFindGames").addEventListener("click", async () => {
      try {
        const d = await runJob("findGames", {});
        const games = d.games || [];
        $("#gameList").innerHTML = games.length
          ? games
              .map(
                (g) =>
                  `<li><button type="button" class="btn" style="height:28px;font-size:0.75rem;margin-right:8px" data-save="${encodeURIComponent(g.name)}" data-path="${encodeURIComponent(g.path)}">+</button>${g.name}</li>`
              )
              .join("")
          : `<li class="muted">${lang === "en" ? "No game found" : "Aucun jeu trouvé"}</li>`;
        $$("#gameList [data-save]").forEach((btn) => {
          btn.addEventListener("click", async () => {
            const name = decodeURIComponent(btn.dataset.save);
            const exePath = decodeURIComponent(btn.dataset.path);
            await run("saveProfile", {
              name,
              exePath,
              settings: { power: "high", gameMode: true, disableGameBar: true, focusAssist: true, boost: true, visual: true },
            });
            log(`${lang === "en" ? "Profile saved" : "Profil sauvé"}: ${name}`, "ok");
            await refreshProfiles();
          });
        });
      } catch (e) {
        log(e.message, "err");
      }
    });
    $("#btnRefreshProfiles").addEventListener("click", () => refreshProfiles().catch((e) => log(e.message, "err")));
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
  }

  async function boot() {
    api = await waitApi();
    if (!api) {
      log("Host pywebview non détecté — lancez Opti.exe", "err");
      return;
    }
    try {
      if (window.MrAurevoXSuite) {
        const s = await window.MrAurevoXSuite.loadSuiteSettings(api);
        lang = s.language || "fr";
        window.MrAurevoXSuite.applyAccent(s.accent);
      }
    } catch (_) {}
    applyI18n();
    wire();

    try {
      const ping = await run("ping", {});
      const badge = $("#adminBadge");
      if (ping.admin) {
        badge.textContent = SUITE_I18N[lang].adminOk;
        badge.className = "badge ok";
      } else {
        badge.textContent = SUITE_I18N[lang].adminNo;
        badge.className = "badge warn";
      }
      setStatus(SUITE_I18N[lang].ready);
      log(`Opti v${APP_VERSION} prêt`, "ok");
    } catch (e) {
      log(String(e.message || e), "err");
    }

    refreshHealth().catch(() => {});
    refreshPower().catch(() => {});
    refreshDns().catch(() => {});
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
