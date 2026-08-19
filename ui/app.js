/**
 * Copyright (c) 2026 Mr-Aurevo-X. All rights reserved.
 * SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
 * Author: Mr-Aurevo-X | https://github.com/Mr-Aurevo-X
 */
/* Opti UI — pywebview bridge */
(function () {
  "use strict";

  const APP_VERSION = "1.6.0";
  const OVERLAY_KEY = "opti-fps-overlay";
  const OVERLAY_CFG_KEY = "opti-overlay-config";
  const ADV_KEY = "opti-advanced-mode";
  let lastPresetDelta = null;

  function esc(value) {
    return String(value == null ? "" : value).replace(
      /[&<>"']/g,
      (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]
    );
  }

  const SUITE_I18N = {
    fr: {
      tagline: "Indépendant · 100 % gratuit · version finale",
      copyright: "© 2026 Mr-Aurevo-X · indépendant · gratuit",
      privacy: "Opti est un logiciel indépendant 100 % gratuit. Traitement local uniquement. Version finale — pas de mise à jour automatique.",
      modeAdvanced: "Mode avancé",
      modeAdvancedHint: "Révèle : Power Limit, Soft OC, Monitor, Timer, Services, Debloat",
      btnElevate: "Élever (admin)",
      dashSoftHint: "Power Limit NVIDIA et anti-parking — Mode avancé",
      dashMonitorHint: "FPS en direct + overlay HUD → Mode avancé · Monitor FPS",
      navGroupEssentials: "Essentiels",
      navGroupTools: "Outils",
      navGroupAdvanced: "Avancé — experts",
      navGroupHistory: "Historique",
      navGroupLegal: "Légal",
      btnLang: "English",
      overlayPreset: "Préréglage overlay",
      overlayPresetMinimal: "Minimal (FPS)",
      overlayPresetStandard: "Standard",
      overlayPresetFull: "Complet",
      presetActionPower: "Plan d'alimentation hautes performances",
      presetActionGameMode: "Game Mode activé · Game Bar/DVR off",
      presetActionVisual: "Effets visuels optimisés pour le jeu",
      presetActionBoost: "Session boost (overlays Xbox / Game Bar)",
      presetConfirmTitle: "Appliquer « Optimiser pour jouer » ?",
      presetConfirmBody: "Actions prévues :\n• Plan hautes performances\n• Game Mode + Focus\n• Effets visuels gaming\n• Session boost (overlays Xbox)\n\nRéversible via Sessions / Undo.",
      navSoftOc: "Soft OC",
      navMonitor: "Monitor FPS",
      softOcTitle: "Soft OC NVIDIA",
      softOcHelp: "Soft OC NVIDIA : locks clocks bornés. Pas d'undervolt.",
      guardSoftOc: "Soft OC n'est pas un undervolt. Limites nvidia-smi. Stabilité = vous.",
      btnOcStock: "Reset clocks",
      btnOc50: "+50 MHz",
      btnOc100: "+100 MHz",
      afterburnerTitle: "Undervolt (externe)",
      afterburnerHelp: "Vrai undervolt via MSI Afterburner.",
      btnOpenAfterburner: "Ouvrir Afterburner",
      btnAfterburnerDl: "Page téléchargement",
      monitorTitle: "Monitor FPS",
      monitorHelp: "FPS / frametime mesurés nativement (PresentMon). Lancez un jeu au premier plan — ou activez l'overlay HUD.",
      monitorApp: "App",
      btnMonHelp: "Aide capture FPS",
      chkFpsOverlay: "Overlay FPS léger (déplaçable, toujours visible)",
      overlayHelp: "Petit HUD — glissez Opti pour déplacer. Layout et métriques mémorisés. Températures via Libre Hardware Monitor.",
      overlayLayout: "Layout",
      overlayLayoutLine: "Ligne",
      overlayLayoutCard: "Carte",
      ovBrand: "Brand",
      ovOpl: "1% low",
      ovApp: "App",
      ovCpu: "CPU %",
      ovCpuTemp: "CPU °C",
      ovGpu: "GPU %",
      ovGpuTemp: "GPU °C",
      ovRam: "RAM %",
      confirmDanger: "Confirmer cette action ? Elle peut être difficile à annuler.",
      needsAdminHint: "Admin requis — cliquez Élever, puis réessayez.",
      confirmSoftOc: "Appliquer un Soft OC (locks clocks NVIDIA) ?",
      confirmSoftPerf: "Appliquer Soft Perf / Power Limit ?",
      emptyBloat: "Aucune app",
      profileSaveTitle: "Enregistrer un profil",
      profileApplyTitle: "Appliquer le profil",
      navTips: "Conseils",
      breakdownTitle: "Détail du score",
      deltaTitle: "Avant / après preset",
      tipsHelp: "Conseils pédagogiques — pas de promesse « boost x4 ».",
      scoreLabel: "Score de préparation",
      gradeExcellent: "Excellent — prêt à jouer",
      gradeGood: "Bon — quelques freins mineurs",
      gradeFair: "Moyen — optimisez avant de jouer",
      gradePoor: "Faible — machine saturée ou mal réglée",
      aboutCopyright: "© 2026 Mr-Aurevo-X · Logiciel indépendant · 100 % gratuit · version finale · 100 % local",
      aboutDisclaimer: "Logiciel indépendant, 100 % gratuit, version finale. Aucune garantie de FPS. Pas de mise à jour automatique.",
      smartHelp: "Opti n'est pas encore signé par un éditeur reconnu de Microsoft. Ceci est normal pour un logiciel indépendant : suivez les étapes ci-dessous pour lancer l'application.",
      dashHelp: "Le score mesure si le PC est prêt maintenant (pas un FPS). Preset = power + Game Mode + visuel + boost. CPU/RAM varient à la seconde — une baisse juste après le preset est souvent temporaire.",
      elevating: "Élévation…",
      ready: "Prêt",
      adminOk: "Admin",
      adminNo: "Sans admin",

      navDash: "Dashboard",
      navPower: "Énergie",
      navGameMode: "Mode jeu",
      navBoost: "Session boost",
      navSoftPerf: "Power Limit / Soft",
      navTimer: "Timer / Priorité",
      navClean: "Nettoyage",
      navNet: "Réseau",
      navVisual: "Visuel",
      navServices: "Services Windows",
      navStartup: "Démarrage",
      navDebloat: "Apps inutiles",
      navProfiles: "Profils jeu",
      navSessions: "Sessions",
      navAbout: "À propos",

      btnRestore: "Point de restauration",
      btnRefresh: "Rafraîchir",
      btnPreset: "Optimiser pour jouer",
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
      btnSoftPerfOs: "Appliquer OS soft",
      btnSoftPerfReset: "Restaurer",
      btnPlEco: "Eco soft",
      btnPlStock: "Stock",
      btnPlPerf: "Perf soft",
      btnFindGames: "Détecter jeux",
      btnCancel: "Annuler",
      softPerfTitle: "Power Limit / Soft OS",
      softPerfHelp: "Réglages soft réversibles : anti-parking CPU, PCIe ASPM, accélération graphique matérielle (HAGS), Power Limit NVIDIA. Pas d'undervolt/OC matériel.",
      softPerfNvTitle: "Power Limit NVIDIA",
      softPerfNvHelp: "Eco ≈ −10 %, Perf soft ≈ +5 %, toujours dans les limites carte. Stock = valeur mémorisée / défaut.",
      chkHags: "Activer HAGS — accélération graphique matérielle (redémarrage possible)",
      chkApplyHags: "Inclure HAGS dans « Appliquer OS soft »",
      guardSoftPerf: "Pas un undervolt/OC matériel. PL NVIDIA soft uniquement (borné min/max carte). AMD : Adrenalin manuellement.",

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

      legalTitle: "Mentions légales",
      legalTerms: "CGU / ToS",
      legalPrivacy: "Confidentialité",
      legalDisclaimer: "Disclaimer",
      smartTitle: "Windows a protégé votre PC (SmartScreen)",
    },
    en: {
      tagline: "Standalone · 100% free · final version",
      copyright: "© 2026 Mr-Aurevo-X · standalone · free",
      privacy: "Opti is standalone 100% free software. Local processing only. Final version — no automatic updates.",
      modeAdvanced: "Advanced mode",
      modeAdvancedHint: "Shows: Power Limit, Soft OC, Monitor, Timer, Services, Debloat",
      btnElevate: "Elevate (admin)",
      dashSoftHint: "NVIDIA Power Limit and anti-parking — Advanced mode",
      dashMonitorHint: "Live FPS + HUD overlay → Advanced mode · FPS Monitor",
      navGroupEssentials: "Essentials",
      navGroupTools: "Tools",
      navGroupAdvanced: "Advanced — experts",
      navGroupHistory: "History",
      navGroupLegal: "Legal",
      btnLang: "Français",
      overlayPreset: "Overlay preset",
      overlayPresetMinimal: "Minimal (FPS)",
      overlayPresetStandard: "Standard",
      overlayPresetFull: "Full",
      presetActionPower: "High performance power plan",
      presetActionGameMode: "Game Mode on · Game Bar/DVR off",
      presetActionVisual: "Visual effects tuned for gaming",
      presetActionBoost: "Boost session (Xbox / Game Bar overlays)",
      presetConfirmTitle: "Apply “Optimize for gaming”?",
      presetConfirmBody: "Planned actions:\n• High performance power\n• Game Mode + Focus\n• Gaming visual effects\n• Boost session (Xbox overlays)\n\nReversible via Sessions / Undo.",
      navSoftOc: "Soft OC",
      navMonitor: "FPS Monitor",
      softOcTitle: "NVIDIA Soft OC",
      softOcHelp: "NVIDIA Soft OC: bounded clock locks. Not undervolt.",
      guardSoftOc: "Soft OC is not undervolt. nvidia-smi limits. Stability is on you.",
      btnOcStock: "Reset clocks",
      btnOc50: "+50 MHz",
      btnOc100: "+100 MHz",
      afterburnerTitle: "Undervolt (external)",
      afterburnerHelp: "Real undervolt via MSI Afterburner.",
      btnOpenAfterburner: "Open Afterburner",
      btnAfterburnerDl: "Download page",
      monitorTitle: "FPS Monitor",
      monitorHelp: "Native FPS / frametime (PresentMon). Run a game in the foreground — or enable the HUD overlay.",
      monitorApp: "App",
      btnMonHelp: "FPS capture help",
      chkFpsOverlay: "Light FPS overlay (draggable, always on screen)",
      overlayHelp: "Small HUD — drag Opti to move. Layout and metrics are saved. Temps via Libre Hardware Monitor.",
      overlayLayout: "Layout",
      overlayLayoutLine: "Line",
      overlayLayoutCard: "Card",
      ovBrand: "Brand",
      ovOpl: "1% low",
      ovApp: "App",
      ovCpu: "CPU %",
      ovCpuTemp: "CPU °C",
      ovGpu: "GPU %",
      ovGpuTemp: "GPU °C",
      ovRam: "RAM %",
      confirmDanger: "Confirm this action? It may be hard to undo.",
      needsAdminHint: "Admin required — click Elevate, then retry.",
      confirmSoftOc: "Apply Soft OC (NVIDIA clock locks)?",
      confirmSoftPerf: "Apply Soft Perf / Power Limit?",
      emptyBloat: "No apps",
      profileSaveTitle: "Save a profile",
      profileApplyTitle: "Apply profile",
      navTips: "Tips",
      breakdownTitle: "Score breakdown",
      deltaTitle: "Before / after preset",
      tipsHelp: "Educational tips — no fake “x4 boost” claims.",
      scoreLabel: "Readiness score",
      gradeExcellent: "Excellent — ready to play",
      gradeGood: "Good — minor bottlenecks",
      gradeFair: "Fair — optimize before playing",
      gradePoor: "Poor — machine saturated or misconfigured",
      aboutCopyright: "© 2026 Mr-Aurevo-X · Standalone · 100% free · final version · 100% local",
      aboutDisclaimer: "Standalone, 100% free, final version. No FPS guarantee. No automatic updates.",
      smartHelp: "Opti isn't yet signed by a Microsoft-recognized publisher. This is normal for independent software: follow the steps below to launch the app.",
      dashHelp: "Score is readiness now (not FPS). Preset = power + Game Mode + visual + boost. CPU/RAM fluctuate — a drop right after preset is often temporary.",
      elevating: "Elevating…",
      ready: "Ready",
      adminOk: "Admin",
      adminNo: "No admin",

      navDash: "Dashboard",
      navPower: "Power",
      navGameMode: "Game Mode",
      navBoost: "Boost session",
      navSoftPerf: "Power Limit / Soft",
      navTimer: "Timer / Priority",
      navClean: "Cleanup",
      navNet: "Network",
      navVisual: "Visual",
      navServices: "Windows services",
      navStartup: "Startup",
      navDebloat: "Bloat apps",
      navProfiles: "Game profiles",
      navSessions: "Sessions",
      navAbout: "About",

      btnRestore: "Restore point",
      btnRefresh: "Refresh",
      btnPreset: "Optimize for gaming",
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
      btnSoftPerfOs: "Apply soft OS",
      btnSoftPerfReset: "Restore",
      btnPlEco: "Eco soft",
      btnPlStock: "Stock",
      btnPlPerf: "Perf soft",
      btnFindGames: "Find games",
      btnCancel: "Cancel",

      powerTitle: "Power plan",
      powerHelp: "Switches the active Windows power plan. High perf / Ultimate maximize CPU at the cost of power draw.",
      gmTitle: "Game Mode & Focus",
      gmHelp: "Enables Windows Game Mode, disables Game Bar / DVR (background capture) and Focus Assist while gaming.",
      boostTitle: "Boost session",
      boostHelp: "Closes background overlays to free up RAM/CPU during a gaming session. Reversible via \u201cEnd session\u201d.",
      softPerfTitle: "Power Limit / Soft",
      softPerfHelp: "Reversible soft tweaks: CPU anti-parking, PCIe ASPM, HAGS, NVIDIA Power Limit. Not hardware undervolt/OC.",
      softPerfNvTitle: "NVIDIA Power Limit",
      softPerfNvHelp: "Eco ≈ −10%, Perf soft ≈ +5%, always within board limits. Stock = remembered / default value.",
      chkHags: "Enable HAGS — hardware-accelerated GPU scheduling (reboot may be required)",
      chkApplyHags: "Include HAGS in “Apply soft OS”",
      guardSoftPerf: "Not hardware undervolt/OC. Soft NVIDIA PL only (board min/max). AMD: use Adrenalin manually.",
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

      legalTitle: "Legal notices",
      legalTerms: "Terms",
      legalPrivacy: "Privacy",
      legalDisclaimer: "Disclaimer",
      smartTitle: "Windows protected your PC (SmartScreen)",
    },
  };

  const PAGE_META = {
    fr: {
      dash: ["Dashboard", "Score gaming et actions rapides"],
      power: ["Power", "Plans d'alimentation"],
      gamemode: ["Game Mode", "Game Mode, Game Bar, Focus"],
      boost: ["Boost", "Session overlays"],
      softperf: ["Power Limit / Soft", "OS soft + Power Limit NVIDIA"],
      softoc: ["Soft OC", "Locks clocks NVIDIA"],
      monitor: ["Monitor FPS", "FPS / frametime natif"],
      clean: ["Cleanup", "Caches GPU et launchers"],
      net: ["Réseau", "DNS et tweaks latence"],
      visual: ["Visuel", "Effets Windows"],
      services: ["Services", "Services gaming-safe"],
      startup: ["Démarrage", "Entrées au démarrage"],
      debloat: ["Debloat", "AppX non essentiels"],
      timer: ["Timer / Prio", "Timer resolution et priorités"],
      profiles: ["Profils jeu", "Appliquer un profil et lancer"],
      tips: ["Conseils", "Comprendre score, stutter, overlays"],
      sessions: ["Sessions", "Historique et undo"],
      about: ["À propos", "Mentions légales — version finale"],
    },
    en: {
      dash: ["Dashboard", "Readiness score and quick actions"],
      power: ["Power", "Power plans"],
      gamemode: ["Game Mode", "Game Mode, Game Bar, Focus"],
      boost: ["Boost", "Overlay session"],
      softperf: ["Power Limit / Soft", "Soft OS + NVIDIA Power Limit"],
      softoc: ["Soft OC", "Bounded NVIDIA clock locks"],
      monitor: ["FPS Monitor", "Native FPS / frametime"],
      clean: ["Cleanup", "GPU and launcher caches"],
      net: ["Network", "DNS and latency tweaks"],
      visual: ["Visual", "Windows effects"],
      services: ["Services", "Gaming-safe services"],
      startup: ["Startup", "Startup entries"],
      debloat: ["Debloat", "Non-essential AppX"],
      timer: ["Timer / Prio", "Timer resolution and priorities"],
      profiles: ["Game profiles", "Apply profile and launch"],
      tips: ["Tips", "Score, stutter, overlays"],
      sessions: ["Sessions", "History and undo"],
      about: ["About", "Legal — final version"],
    },
  };

  const LEGAL_FILES = {
    terms: { fr: "legal/cgu.fr.html", en: "legal/tos.en.html" },
    privacy: { fr: "legal/privacy.fr.html", en: "legal/privacy.en.html" },
    disclaimer: { fr: "legal/disclaimer.fr.html", en: "legal/disclaimer.en.html" },
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

  function needsAdminMessage(res) {
    const pack = SUITE_I18N[lang] || SUITE_I18N.fr;
    if (res && res.data && res.data.needsAdmin) return pack.needsAdminHint || res.error || "Admin required";
    if (res && /admin required/i.test(String(res.error || ""))) return pack.needsAdminHint || res.error;
    return null;
  }

  async function run(action, payload) {
    if (!api) throw new Error("API host indisponible");
    const res = await api.run(action, payload || {});
    if (!res || !res.ok) {
      const adm = needsAdminMessage(res);
      if (adm) { setStatus(adm); throw new Error(adm); }
      throw new Error((res && res.error) || "Échec");
    }
    return res.data;
  }

  async function runJob(action, payload) {
    if (!api) throw new Error("API host indisponible");
    if (jobBusy) throw new Error("Action déjà en cours");
    jobBusy = true;
    setProgress(0, action);
    try {
      const start = await api.start_action(action, payload || {});
      if (!start || !start.ok) {
        const adm = needsAdminMessage(start);
        if (adm) { setStatus(adm); throw new Error(adm); }
        throw new Error((start && start.error) || "start_action failed");
      }
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
    const pack = SUITE_I18N[lang] || SUITE_I18N.fr;
    document.documentElement.lang = lang === "en" ? "en" : "fr";
    if (window.MrAurevoXSuite) {
      window.MrAurevoXSuite.applyI18n(lang, SUITE_I18N);
    } else {
      document.querySelectorAll("[data-i18n]").forEach((el) => {
        const key = el.getAttribute("data-i18n");
        if (key && pack[key]) el.textContent = pack[key];
      });
      document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
        const key = el.getAttribute("data-i18n-placeholder");
        if (key && pack[key]) el.placeholder = pack[key];
      });
    }
    const btnLang = $("#btnLang");
    if (btnLang && pack.btnLang) btnLang.textContent = pack.btnLang;
  }

  function setLang(next) {
    if (next !== "fr" && next !== "en") return;
    lang = next;
    try { localStorage.setItem("opti-lang", lang); } catch (_) {}
    applyI18n();
    const aboutVer = $("#aboutVersion");
    if (aboutVer) aboutVer.textContent = `v${APP_VERSION} · ${lang === "en" ? "final version" : "version finale"}`;
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
    if (page === "tips") loadTips().catch(() => {});
    if (page === "net") refreshDns().catch(() => {});
    if (page === "softperf") refreshSoftPerf().catch(() => {});
    if (page === "softoc") refreshSoftOc().catch(() => {});
    if (page === "monitor") {
      stopDashFpsPoll();
      if (api && api.start_fps_monitor) api.start_fps_monitor().catch(() => {});
      startMonitorPoll();
      refreshMonitor().catch(() => {});
    } else {
      stopMonitorPoll();
      if (api && api.stop_fps_monitor) api.stop_fps_monitor().catch(() => {});
      if (document.body.classList.contains("mode-advanced")) startDashFpsPoll();
    }
  }

  function renderHealth(h) {
    if (!h) return;
    const score = h.score || 0;
    const grade = h.grade || "poor";
    const label = lang === "en" ? (h.labelEn || grade) : (h.labelFr || grade);
    const gradeKey = {
      excellent: "gradeExcellent",
      good: "gradeGood",
      fair: "gradeFair",
      poor: "gradePoor",
    }[grade] || "gradePoor";
    const pack = SUITE_I18N[lang] || SUITE_I18N.fr;
    $("#scoreRing").style.setProperty("--score", score);
    $("#scoreVal").textContent = String(score);
    const gradeEl = $("#scoreGradeText");
    if (gradeEl) {
      gradeEl.textContent = `${label} — ${pack[gradeKey] || label}`;
      gradeEl.className = `score-grade grade-${grade}`;
    }
    const bd = h.breakdown || {};
    const bars = [
      ["RAM", bd.ram],
      ["Disque", bd.disk],
      ["CPU", bd.cpu],
      ["Power", bd.power],
      ["Game Mode", bd.game],
    ];
    const barsEl = $("#scoreBars");
    if (barsEl) {
      barsEl.innerHTML = bars
        .map(
          ([name, v]) =>
            `<div class="bar-row"><span>${name}</span><div class="bar"><i style="width:${Math.max(0, Math.min(100, v || 0))}%"></i></div><b>${v ?? "—"}</b></div>`
        )
        .join("");
    }
    const badges = $("#dashBadges");
    if (badges) {
      badges.innerHTML = `
        <span class="risk ${h.gameMode ? "ok" : "warn"}">Game Mode ${h.gameMode ? "ON" : "OFF"}</span>
        <span class="risk ok">${esc((h.powerPlan || "Power").toString().slice(0, 28))}</span>
        <span class="risk ok">v${esc(APP_VERSION)}</span>`;
    }
    const ramPct = h.ram ? h.ram.usedPercent : "—";
    const power = h.powerPlan || "—";
    const gm = h.gameMode ? "ON" : "OFF";
    $("#dashStats").innerHTML = `
      <div class="stat"><div class="label">RAM</div><div class="value">${ramPct}%</div></div>
      <div class="stat blue"><div class="label">CPU</div><div class="value">${h.cpuLoad || 0}%</div></div>
      <div class="stat ok"><div class="label">Power</div><div class="value" style="font-size:0.95rem">${esc(power)}</div></div>
      <div class="stat warn"><div class="label">Game Mode</div><div class="value">${gm}</div></div>`;

    const deltaPanel = $("#deltaPanel");
    const deltaText = $("#deltaText");
    if (deltaPanel && deltaText) {
      if (lastPresetDelta) {
        deltaPanel.hidden = false;
        deltaText.textContent = lastPresetDelta;
      } else if (h.lastScore && h.lastScore.context === "after-preset") {
        deltaPanel.hidden = false;
        deltaText.textContent =
          lang === "en"
            ? `Last preset score: ${h.lastScore.score} (${h.lastScore.labelFr || h.lastScore.grade})`
            : `Dernier score après preset : ${h.lastScore.score} (${h.lastScore.labelFr || h.lastScore.grade})`;
      }
    }
    log(`Score: ${score} (${label})`, "ok");
  }

  async function refreshHealth(prefetched) {
    const h = prefetched || (await runJob("getHealth", {}));
    renderHealth(h);
    return h;
  }

  function applyAdvancedMode(on) {
    document.body.classList.toggle("mode-advanced", !!on);
    try {
      localStorage.setItem(ADV_KEY, on ? "1" : "0");
    } catch (_) {}
    $$(".nav-btn[data-page-mode='adv']").forEach((btn) => {
      btn.hidden = !on;
    });
    const active = $(".nav-btn.active");
    if (active && active.hidden) showPage("dash");
    if (on) startDashFpsPoll(); else { stopDashFpsPoll(); refreshMonitor().catch(() => {}); }
  }

  async function loadTips() {
    const box = $("#tipsList");
    if (!box) return;
    try {
      const res = await fetch("tips/tips.json", { cache: "no-store" });
      const data = await res.json();
      const items = data[lang] || data.fr || [];
      box.innerHTML = items
        .map(
          (t) =>
            `<article class="tip-card"><h3>${esc(t.title)}</h3><p>${esc(t.body)}</p></article>`
        )
        .join("");
    } catch (_) {
      box.innerHTML = `<p class="muted">${lang === "en" ? "Tips unavailable" : "Conseils indisponibles"}</p>`;
    }
  }

  async function refreshPower() {
    const d = await run("getPowerPlans", {});
    const plans = d.plans || [];
    $("#powerList").innerHTML = plans.length
      ? plans.map((p) => `<li>${p.active ? "★ " : ""}${esc(p.name)} <span class="muted">${esc(p.guid)}</span></li>`).join("")
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

  async function refreshSoftPerf() {
    const d = await run("getSoftPerf", {});
    const os = d.os || {};
    const gpu = d.gpu || {};
    const nv = d.nvidia || {};
    const gpuNames = ((gpu.gpus || []).map((g) => g.name).filter(Boolean).join(", ")) || "—";
    const status = $("#softPerfStatus");
    if (status) {
      status.textContent =
        lang === "en"
          ? `GPU: ${gpuNames} (${gpu.vendor || "?"}) · CPU min/max AC: ${os.procMinAc ?? "?"}/${os.procMaxAc ?? "?"} · boost: ${os.boostAvailable ? os.boostModeAc : "n/a"} · ASPM: ${os.aspmAvailable ? os.aspmAc : "n/a"} · HAGS: ${os.hagsEnabled == null ? "?" : os.hagsEnabled ? "on" : "off"}`
          : `GPU : ${gpuNames} (${gpu.vendor || "?"}) · CPU min/max AC : ${os.procMinAc ?? "?"}/${os.procMaxAc ?? "?"} · boost : ${os.boostAvailable ? os.boostModeAc : "n/a"} · ASPM : ${os.aspmAvailable ? os.aspmAc : "n/a"} · HAGS : ${os.hagsEnabled == null ? "?" : os.hagsEnabled ? "on" : "off"}`;
    }
    const chkHags = $("#chkHags");
    if (chkHags && os.hagsEnabled != null) chkHags.checked = !!os.hagsEnabled;

    const nvStatus = $("#softPerfNvStatus");
    const nvPanel = $("#softPerfNvidiaPanel");
    const canNv = !!nv.available;
    ["btnPlEco", "btnPlStock", "btnPlPerf"].forEach((id) => {
      const b = $("#" + id);
      if (b) b.disabled = !canNv;
    });
    if (nvPanel) nvPanel.style.opacity = canNv ? "1" : "0.65";
    if (nvStatus) {
      if (canNv) {
        nvStatus.textContent =
          lang === "en"
            ? `${nv.name || "NVIDIA"} · PL ${nv.currentPl}W (min ${nv.minPl} / max ${nv.maxPl} / stock ${nv.stockPl})`
            : `${nv.name || "NVIDIA"} · PL ${nv.currentPl}W (min ${nv.minPl} / max ${nv.maxPl} / stock ${nv.stockPl})`;
      } else {
        nvStatus.textContent =
          lang === "en"
            ? `nvidia-smi unavailable (${nv.reason || "n/a"}). Soft OS still works; AMD undervolt via Adrenalin.`
            : `nvidia-smi indisponible (${nv.reason || "n/a"}). OS soft reste utilisable ; undervolt AMD via Adrenalin.`;
      }
    }
  }


  let monitorTimer = null;
  let dashFpsTimer = null;
  function stopMonitorPoll() {
    if (monitorTimer) { clearInterval(monitorTimer); monitorTimer = null; }
  }
  function startMonitorPoll() {
    stopMonitorPoll();
    monitorTimer = setInterval(() => { refreshMonitor().catch(() => {}); }, 1000);
  }
  function stopDashFpsPoll() {
    if (dashFpsTimer) { clearInterval(dashFpsTimer); dashFpsTimer = null; }
  }
  function gotoMonitorPage() {
    const chk = $("#chkAdvanced");
    if (chk && !chk.checked) { chk.checked = true; applyAdvancedMode(true); }
    showPage("monitor");
  }

  function startDashFpsPoll() {
    stopDashFpsPoll();
    if (!document.body.classList.contains("mode-advanced")) return;
    if ($("#page-monitor") && $("#page-monitor").classList.contains("active")) return;
    refreshMonitor().catch(() => {});
    dashFpsTimer = setInterval(() => { refreshMonitor().catch(() => {}); }, 2000);
  }

  async function refreshSoftOc() {
    const d = await run("getSoftOc", {});
    const nv = d.nvidia || {};
    const ab = d.afterburner || {};
    const el = $("#softOcStatus");
    if (el) {
      el.textContent = nv.available
        ? (nv.name || "NVIDIA") + " · core " + nv.coreCurrent + "/" + nv.coreMax + " MHz · mem " + nv.memCurrent + "/" + nv.memMax + " MHz"
        : (lang === "en" ? ("Clocks unavailable (" + (nv.reason || "n/a") + ")") : ("Clocks indisponibles (" + (nv.reason || "n/a") + ")"));
    }
    const abEl = $("#afterburnerStatus");
    if (abEl) {
      abEl.textContent = ab.found
        ? (lang === "en" ? ("Found: " + ab.path) : ("Trouvé : " + ab.path))
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
        app: true, cpu: true, cpuTemp: true, gpu: true, gpuTemp: true, ram: true
      }
    };
  }

  const OVERLAY_PRESETS = {
    minimal: {
      layout: "line",
      show: {
        brand: false, fps: true, frametime: false, onePercentLow: false,
        app: false, cpu: false, cpuTemp: false, gpu: false, gpuTemp: false, ram: false
      }
    },
    standard: {
      layout: "line",
      show: {
        brand: false, fps: true, frametime: true, onePercentLow: true,
        app: true, cpu: false, cpuTemp: false, gpu: true, gpuTemp: false, ram: false
      }
    },
    full: null
  };

  function applyOverlayPreset(name) {
    const preset = name === "full" ? defaultOverlayConfig() : OVERLAY_PRESETS[name];
    if (!preset) return;
    applyOverlayConfigToForm(preset);
    persistOverlayConfig().catch(() => {});
  }

  function guessOverlayPreset(cfg) {
    if (!cfg || !cfg.show) return "full";
    const show = cfg.show;
    if (show.fps && !show.frametime && !show.app && !show.cpu && !show.gpu) return "minimal";
    if (show.fps && show.frametime && show.app && show.gpu && !show.cpuTemp && !show.gpuTemp && !show.ram) return "standard";
    return "full";
  }

  function confirmGamingPreset() {
    const pack = SUITE_I18N[lang] || SUITE_I18N.fr;
    return window.confirm((pack.presetConfirmTitle || "Preset") + "\n\n" + (pack.presetConfirmBody || ""));
  }

  function collectOverlayConfigFromForm() {
    const cfg = defaultOverlayConfig();
    const sel = $("#selOverlayLayout");
    if (sel && (sel.value === "line" || sel.value === "card")) cfg.layout = sel.value;
    document.querySelectorAll("[data-ov]").forEach((el) => {
      const key = el.getAttribute("data-ov");
      if (key && Object.prototype.hasOwnProperty.call(cfg.show, key)) {
        cfg.show[key] = !!el.checked;
      }
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
    try {
      localStorage.setItem(OVERLAY_CFG_KEY, JSON.stringify(cfg));
    } catch (_) {}
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
    if (api && api.get_overlay_config) {
      try {
        const r = await api.get_overlay_config();
        if (r && r.config) cfg = r.config;
      } catch (_) {}
    }
    applyOverlayConfigToForm(cfg);
    const selPreset = $("#selOverlayPreset");
    if (selPreset) selPreset.value = guessOverlayPreset(cfg);
    return cfg;
  }

  async function setFpsOverlay(enabled) {
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
    const mini = $("#dashFpsMini");
    const active = d && (d.captureActive || d.available);
    if (d && d.available && d.fps != null) {
      if (fpsEl) fpsEl.textContent = String(d.fps);
      if (ftEl) ftEl.textContent = (d.frametimeMs != null ? d.frametimeMs + " ms" : "—");
      if (appEl) appEl.textContent = d.app || "—";
      if (st) st.textContent = lang === "en" ? "Capture active" : "Capture active";
      const hintEl = $("#monitorHint");
      if (hintEl) { hintEl.hidden = true; hintEl.textContent = ""; }
      if (mini) {
        mini.hidden = false;
        mini.removeAttribute("role");
        mini.textContent = "FPS " + d.fps + (d.frametimeMs != null ? (" · " + d.frametimeMs + " ms") : "");
      }
    } else {
      if (fpsEl) fpsEl.textContent = "—";
      if (ftEl) ftEl.textContent = "—";
      if (appEl) appEl.textContent = d && d.app ? d.app : "—";
      const err = (d && d.error) || (lang === "en" ? "No FPS sample" : "Pas d'échantillon FPS");
      const hint = lang === "en" ? ((d && d.hintEn) || "") : ((d && d.hintFr) || "");
      if (st) st.textContent = hint ? err + " — " + hint : err;
      const hintEl = $("#monitorHint");
      if (hintEl) {
        const lines = [];
        if (d && d.needsAdmin) {
          lines.push(lang === "en"
            ? "Try « Elevate (admin) » in the header, then reopen Monitor FPS."
            : "Essayez « Élever (admin) » en haut, puis rouvrez Monitor FPS.");
        } else if (active) {
          lines.push(lang === "en"
            ? "Capture is running. Focus a game window and wait a few seconds."
            : "La capture tourne. Mettez le jeu au premier plan et attendez quelques secondes.");
        } else {
          lines.push(lang === "en"
            ? "1. Launch a game · 2. Alt+Tab to the game · 3. Run Opti as admin if still empty"
            : "1. Lancez un jeu · 2. Alt+Tab vers le jeu · 3. Élevez Opti en admin si toujours vide");
        }
        hintEl.textContent = lines.join(" ");
        hintEl.hidden = false;
      }
      if (mini) {
        const adv = document.body.classList.contains("mode-advanced");
        if (adv) {
          mini.hidden = false;
          mini.setAttribute("role", "button");
          const short = active
            ? (lang === "en" ? "FPS — waiting for game" : "FPS — en attente de jeu")
            : (lang === "en" ? "FPS — open Monitor" : "FPS — ouvrir Monitor");
          mini.textContent = short;
        } else {
          mini.hidden = true;
          mini.removeAttribute("role");
        }
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

  const DNS_PRESETS_FALLBACK = [
    { id: "cloudflare", name: "Cloudflare" },
    { id: "google", name: "Google" },
    { id: "quad9", name: "Quad9" },
    { id: "dhcp", name: "Automatique (DHCP)" },
  ];

  async function refreshDns() {
    const sel = $("#dnsPreset");
    if (!sel) return;
    const prev = sel.value || "cloudflare";
    let presets = DNS_PRESETS_FALLBACK;
    try {
      const d = await run("getDnsPresets", {});
      if (d && Array.isArray(d.presets) && d.presets.length) {
        presets = d.presets.filter((p) => p && p.id);
      }
    } catch (_) {
      /* keep HTML / fallback presets */
    }
    sel.innerHTML = presets
      .map((p) => `<option value="${esc(p.id)}">${esc(p.name || p.id)}</option>`)
      .join("");
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

  async function scanBloat() {
    const d = await runJob("scanBloat", {});
    $("#bloatList").innerHTML = (d.apps || [])
      .map(
        (a) => `<label class="check-item"><input type="checkbox" data-pfn="${esc(a.PackageFullName)}" checked/>
        <div><div class="t">${esc(a.Name)}</div><div class="d">${esc(a.Version)}</div></div></label>`
      )
      .join("") || `<div class="muted">${(SUITE_I18N[lang] || SUITE_I18N.fr).emptyBloat || "—"}</div>`;
  }

  async function refreshProfiles() {
    const d = await run("getProfiles", {});
    const profiles = d.profiles || [];
    $("#profileList").innerHTML = profiles.length
      ? profiles
          .map(
            (p) =>
              `<li><button type="button" class="btn accent" style="height:28px;font-size:0.75rem;margin-right:8px" data-apply="${esc(p.name)}" title="${esc((SUITE_I18N[lang] || SUITE_I18N.fr).profileApplyTitle || "Apply")}">▶</button>${esc(p.name)} <span class="muted">${esc(p.exePath || "")}</span></li>`
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
      .map((s) => `<li>${esc(s.createdAt || "")} — ${esc(s.action)}: ${esc(s.summary || "")}</li>`)
      .join("") || '<li class="muted">—</li>';
    const u = await run("getUndoList", {});
    $("#undoList").innerHTML = (u.items || [])
      .map(
        (it) =>
          `<li><button type="button" class="btn" style="height:28px;font-size:0.75rem;margin-right:8px" data-undo="${esc(it.id)}" title="${esc(it.name)}">Undo</button><span class="t">${esc(it.name)}</span> <span class="muted">${esc(it.createdAt || "")}${it.summary ? " · " + esc(it.summary) : ""}</span></li>`
      )
      .join("") || '<li class="muted">—</li>';
    $$("#undoList [data-undo]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        try {
          const r = await runJob("runUndo", { id: btn.dataset.undo });
          const cls = r.Partial ? "warn" : r.Success === false ? "err" : "ok";
          log(r.Message || "Undo OK", cls);
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
      if (!confirmGamingPreset()) return;
      try {
        const r = await runJob("applyGamingPreset", {});
        log(r.Message || "Preset OK", "ok");
        if (r && (r.before || r.after)) {
          const d = r.delta != null ? r.delta : 0;
          let deltaLine =
            lang === "en"
              ? `Before ${r.before && r.before.score} → after ${r.after && r.after.score} (${d >= 0 ? "+" : ""}${d})`
              : `Avant ${r.before && r.before.score} → après ${r.after && r.after.score} (${d >= 0 ? "+" : ""}${d})`;
          if (r.settingsDelta > 0 && d < 0) {
            deltaLine +=
              lang === "en"
                ? ` · Settings +${r.settingsDelta} pts`
                : ` · Réglages +${r.settingsDelta} pts`;
          }
          const note = lang === "en" ? r.scoreNoteEn || r.scoreNoteFr : r.scoreNoteFr || r.scoreNoteEn;
          lastPresetDelta = note ? `${deltaLine}\n${note}` : deltaLine;
          const deltaPanel = $("#deltaPanel");
          const deltaText = $("#deltaText");
          if (deltaPanel && deltaText) {
            deltaPanel.hidden = false;
            deltaText.textContent = lastPresetDelta;
          }
        }
        if (r && r.afterHealth) {
          await refreshHealth(r.afterHealth);
        } else {
          await refreshHealth();
        }
      } catch (e) {
        log(String(e.message || e), "err");
      }
    });

    const chkAdv = $("#chkAdvanced");
    if (chkAdv) {
      let adv = false;
      try {
        adv = localStorage.getItem(ADV_KEY) === "1";
      } catch (_) {}
      chkAdv.checked = adv;
      applyAdvancedMode(adv);
      chkAdv.addEventListener("change", () => applyAdvancedMode(chkAdv.checked));
    }
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
      const pack = SUITE_I18N[lang] || SUITE_I18N.fr;
      if (!confirm(pack.confirmDanger || "Confirm?")) return;
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
      const pack = SUITE_I18N[lang] || SUITE_I18N.fr;
      if (!confirm(pack.confirmDanger || "Confirm?")) return;
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
      const pack = SUITE_I18N[lang] || SUITE_I18N.fr;
      if (!confirm(pack.confirmDanger || "Confirm?")) return;
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
      const pack = SUITE_I18N[lang] || SUITE_I18N.fr;
      if (!confirm(pack.confirmDanger || "Confirm?")) return;
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

    const wireSoftPerf = () => {
      const btnOs = $("#btnSoftPerfOs");
      if (!btnOs) return;
      btnOs.addEventListener("click", async () => {
        const pack = SUITE_I18N[lang] || SUITE_I18N.fr;
        if (!confirm(pack.confirmSoftPerf || pack.confirmDanger || "Confirm?")) return;
        try {
          const r = await runJob("setSoftPerfOs", {
            enableSoftOs: true,
            setHags: !!($("#chkApplyHags") && $("#chkApplyHags").checked),
            hagsEnabled: !!($("#chkHags") && $("#chkHags").checked),
          });
          log(r.Message || "OK", "ok");
          if (r.note) log(r.note, "warn");
          await refreshSoftPerf();
        } catch (e) {
          log(e.message, "err");
        }
      });
      $("#btnSoftPerfRefresh").addEventListener("click", () =>
        refreshSoftPerf().catch((e) => log(e.message, "err"))
      );
      $("#btnSoftPerfReset").addEventListener("click", async () => {
        try {
          const r = await runJob("resetSoftPerf", {});
          log(r.Message || "OK", r.Success === false ? "err" : "ok");
          await refreshSoftPerf();
        } catch (e) {
          log(e.message, "err");
        }
      });
      const setPl = (preset) => async () => {
        const pack = SUITE_I18N[lang] || SUITE_I18N.fr;
        if (!confirm(pack.confirmSoftPerf || pack.confirmDanger || "Confirm?")) return;
        try {
          const r = await runJob("setNvidiaPowerLimit", { preset });
          log(r.Message || "OK", r.Success === false ? "err" : "ok");
          await refreshSoftPerf();
        } catch (e) {
          log(e.message, "err");
        }
      };
      $("#btnPlEco").addEventListener("click", setPl("eco"));
      $("#btnPlStock").addEventListener("click", setPl("stock"));
      $("#btnPlPerf").addEventListener("click", setPl("perf"));
    };
    wireSoftPerf();

    const btnEl = $("#btnElevate");
    if (btnEl) {
      btnEl.addEventListener("click", async () => {
        try {
          if (!api.request_elevation) { log("Elevation API missing", "err"); return; }
          const r = await api.request_elevation();
          if (r && r.alreadyAdmin) log(lang === "en" ? "Already admin" : "Déjà admin", "ok");
          else if (r && r.elevating) log(lang === "en" ? "UAC prompted — relaunching" : "UAC demandé — relance", "warn");
          else log((r && r.error) || "Elevation failed", "err");
        } catch (e) { log(String(e.message || e), "err"); }
      });
    }
    const gotoSoft = $("#btnGotoSoftPerf");
    if (gotoSoft) {
      gotoSoft.addEventListener("click", () => {
        const chk = $("#chkAdvanced");
        if (chk && !chk.checked) { chk.checked = true; applyAdvancedMode(true); }
        showPage("softperf");
      });
    }
    const gotoMon = $("#btnGotoMonitor");
    if (gotoMon) gotoMon.addEventListener("click", gotoMonitorPage);
    if ($("#dashFpsMini")) $("#dashFpsMini").addEventListener("click", gotoMonitorPage);
    const setOc = (preset) => async () => {
      const pack = SUITE_I18N[lang] || SUITE_I18N.fr;
      if (!confirm(pack.confirmSoftOc || pack.confirmDanger || "Confirm?")) return;
      try {
        const r = await runJob("setNvidiaClocks", { preset });
        log(r.Message || "OK", r.Success === false ? "err" : "ok");
        await refreshSoftOc();
      } catch (e) { log(e.message, "err"); }
    };
    if ($("#btnOcStock")) $("#btnOcStock").addEventListener("click", setOc("stock"));
    if ($("#btnOc50")) $("#btnOc50").addEventListener("click", setOc("plus50"));
    if ($("#btnOc100")) $("#btnOc100").addEventListener("click", setOc("plus100"));
    if ($("#btnOcRefresh")) $("#btnOcRefresh").addEventListener("click", () => refreshSoftOc().catch((e) => log(e.message, "err")));
    if ($("#btnOpenAfterburner")) {
      $("#btnOpenAfterburner").addEventListener("click", async () => {
        try {
          const r = await run("openAfterburner", {});
          log(r.Message || "OK", r.Success === false ? "warn" : "ok");
        } catch (e) { log(e.message, "err"); }
      });
    }
    const openDl = async () => {
      try {
        if (api.open_url) await api.open_url("https://www.msi.com/Landing/afterburner");
      } catch (e) { log(e.message, "err"); }
    };
    if ($("#btnAfterburnerDl")) $("#btnAfterburnerDl").addEventListener("click", openDl);
    if ($("#btnMonHelp")) {
      $("#btnMonHelp").addEventListener("click", () => {
        const hintEl = $("#monitorHint");
        if (hintEl) hintEl.hidden = !hintEl.hidden;
      });
    }
    if ($("#btnMonRefresh")) $("#btnMonRefresh").addEventListener("click", () => refreshMonitor().catch((e) => log(e.message, "err")));
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
    document.querySelectorAll("[data-ov]").forEach((el) => {
      el.addEventListener("change", () => {
        const selPreset = $("#selOverlayPreset");
        if (selPreset) selPreset.value = "full";
        persistOverlayConfig().catch((e) => log(e.message, "err"));
      });
    });
    const selPreset = $("#selOverlayPreset");
    if (selPreset) {
      selPreset.addEventListener("change", () => {
        applyOverlayPreset(selPreset.value);
      });
    }

    const btnLang = $("#btnLang");
    if (btnLang) {
      btnLang.addEventListener("click", () => setLang(lang === "fr" ? "en" : "fr"));
    }


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
                  `<li><button type="button" class="btn" style="height:28px;font-size:0.75rem;margin-right:8px" data-save="${encodeURIComponent(g.name)}" data-path="${encodeURIComponent(g.path)}" title="${esc((SUITE_I18N[lang] || SUITE_I18N.fr).profileSaveTitle || "Save")}">+</button>${esc(g.name)}</li>`
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
      // Local language preference only (no suite dependency)
      const saved = localStorage.getItem("opti-lang");
      if (saved === "en" || saved === "fr") lang = saved;
      else if (navigator.language && navigator.language.toLowerCase().startsWith("en")) lang = "en";
      if (window.MrAurevoXSuite) {
        window.MrAurevoXSuite.applyAccent("#e03545");
      }
    } catch (_) {}
    applyI18n();
    wire();
    const aboutVer = $("#aboutVersion");
    if (aboutVer) aboutVer.textContent = `v${APP_VERSION} · ${lang === "en" ? "final version" : "version finale"}`;

    try {
      const ping = await run("ping", {});
      let admin = !!(ping && ping.admin);
      try { if (api && api.is_admin) admin = !!(await api.is_admin()); } catch (_) {}
      const badge = $("#adminBadge");
      if (badge) {
        if (admin) { badge.textContent = SUITE_I18N[lang].adminOk; badge.className = "badge ok"; }
        else { badge.textContent = SUITE_I18N[lang].adminNo; badge.className = "badge warn"; }
      }
      setStatus(SUITE_I18N[lang].ready);
      log("Opti v" + APP_VERSION + " ready", "ok");
      if (document.body.classList.contains("mode-advanced")) {
        refreshMonitor().catch(() => {});
      }
      restoreFpsOverlay().catch(() => {});
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
