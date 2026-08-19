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

  async function waitApi(retries = 80) {
    for (let i = 0; i < retries; i++) {
      if (global.pywebview && global.pywebview.api) return global.pywebview.api;
      await new Promise((r) => setTimeout(r, 50));
    }
    return null;
  }

  function needsAdminMessage(res, hint) {
    if (res && res.data && res.data.needsAdmin) return hint || res.error || "Admin required";
    if (res && /admin required/i.test(String(res.error || ""))) return hint || res.error;
    return null;
  }

  async function run(action, payload) {
    if (!api) throw new Error("API host indisponible");
    const res = await api.run(action, payload || {});
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
    if (jobBusy) throw new Error("Action déjà en cours");
    jobBusy = true;
    setProgress(0, action);
    try {
      const start = await api.start_action(action, payload || {});
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
