/**
 * Copyright (c) 2026 Mr-Aurevo-X. All rights reserved.
 * SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
 */
(function (global) {
  "use strict";

  let api = null;
  let jobBusy = false;

  function $(sel) {
    return document.querySelector(sel);
  }

  function $$(sel) {
    return Array.from(document.querySelectorAll(sel));
  }

  function esc(value) {
    return String(value == null ? "" : value).replace(
      /[&<>"']/g,
      (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]
    );
  }

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

  async function waitApi(retries = 120) {
    for (let i = 0; i < retries; i++) {
      const a = global.pywebview && global.pywebview.api;
      // pywebview injects api:{} first, then fills methods async (_createApi).
      // Returning too early → "api.run is not a function".
      if (
        a &&
        (typeof a.run === "function" ||
          typeof a.start_action === "function" ||
          typeof a.prepare_action === "function")
      ) {
        return a;
      }
      await new Promise((r) => setTimeout(r, 50));
    }
    return null;
  }

  function needsAdminMessage(res, hint) {
    if (res && res.data && res.data.needsAdmin) return hint || res.error || "Admin required";
    if (res && /admin required/i.test(String(res.error || ""))) return hint || res.error;
    return null;
  }

  function hostCall(name) {
    if (!api) throw new Error("API host indisponible");
    const fn = api[name];
    if (typeof fn !== "function") {
      throw new Error(`API host pas prêt (${name}). Relance SoftTunes.`);
    }
    return fn.apply(api, Array.prototype.slice.call(arguments, 1));
  }

  async function run(action, payload) {
    if (!api) throw new Error("API host indisponible");
    const body = payload || {};
    let token = null;
    if (typeof api.prepare_action === "function") {
      try {
        const prep = await api.prepare_action(action, body);
        if (prep && prep.ok && prep.token) token = prep.token;
        else if (prep && prep.need_confirm === false && prep.ok === false && /non gatee/i.test(String(prep.error || ""))) {
          /* read-only action — no token */
        } else if (prep && !prep.ok && prep.error && !/non gatee/i.test(String(prep.error))) {
          throw new Error(prep.error || "Confirmation refusée");
        }
      } catch (e) {
        if (!/non gatee/i.test(String(e && e.message))) throw e;
      }
    }
    const res =
      token != null
        ? await hostCall("run", action, body, token)
        : await hostCall("run", action, body);
    if (!res || !res.ok) {
      const adm = needsAdminMessage(res);
      if (adm) {
        setStatus(adm);
        throw new Error(adm);
      }
      throw new Error((res && res.error) || "Échec");
    }
    return res.data;
  }

  async function runJob(action, payload) {
    if (!api) throw new Error("API host indisponible");
    // Wait instead of hard-fail if Accueil refresh / scan overlap (avoids freeze + dead clicks).
    if (jobBusy) {
      const waitStart = Date.now();
      while (jobBusy && Date.now() - waitStart < 180000) {
        await new Promise((r) => setTimeout(r, 150));
      }
      if (jobBusy) throw new Error("Action déjà en cours");
    }
    jobBusy = true;
    setProgress(0, action);
    try {
      const body = payload || {};
      let token = null;
      if (typeof api.prepare_action === "function") {
        const prep = await api.prepare_action(action, body);
        if (prep && prep.ok && prep.token) {
          token = prep.token;
        } else if (prep && !prep.ok && prep.error && !/non gatee/i.test(String(prep.error || ""))) {
          throw new Error(prep.error || "Confirmation refusée");
        }
      }
      const start =
        token != null
          ? await hostCall("start_action", action, body, token)
          : await hostCall("start_action", action, body);
      if (!start || !start.ok) {
        const adm = needsAdminMessage(start);
        if (adm) {
          setStatus(adm);
          throw new Error(adm);
        }
        throw new Error((start && start.error) || "start_action failed");
      }
      for (;;) {
        await new Promise((r) => setTimeout(r, 200));
        const prog = await hostCall("get_action_progress");
        const d = (prog && prog.data) || {};
        setProgress(d.percent || 0, d.detail || d.phase || "");
        if (d.done && !d.running) {
          if (d.error) throw new Error(d.error);
          break;
        }
      }
      const result = await hostCall("get_action_result");
      if (!result || !result.ok) throw new Error((result && result.error) || "Échec");
      return result.data;
    } finally {
      jobBusy = false;
      setProgress(0, "");
    }
  }

  global.SoftTunesBridge = {
    get api() {
      return api;
    },
    setApi(value) {
      api = value;
    },
    get jobBusy() {
      return jobBusy;
    },
    set jobBusy(value) {
      jobBusy = value;
    },
    $,
    $$,
    esc,
    log,
    setStatus,
    setProgress,
    waitApi,
    run,
    runJob,
    needsAdminMessage,
  };
})(typeof window !== "undefined" ? window : globalThis);
