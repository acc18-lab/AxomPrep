(function () {
  "use strict";
  const target = document.getElementById("homeCurrentAffairsList");
  if (!target) return;

  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[ch]);

  // Decode HTML entities safely without regex replacements that can damage words.
  function decodeText(value) {
    let text = String(value ?? "");
    for (let i = 0; i < 3; i += 1) {
      const textarea = document.createElement("textarea");
      textarea.innerHTML = text;
      const decoded = textarea.value;
      if (decoded === text) break;
      text = decoded;
    }
    return text.replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, " ").trim();
  }

  function showMessage(message, isError) {
    target.innerHTML = `<div class="p-5 text-sm ${isError ? "text-red-600" : "text-slate-500"}">${escapeHtml(message)}</div>`;
  }

  function render(rows) {
    if (!rows.length) {
      showMessage("No current-affairs updates are available right now.", false);
      return;
    }
    target.innerHTML = rows.slice(0, 4).map((row) => {
      const title = decodeText(row.title || "Current affairs update");
      const summary = decodeText(row.content || row.summary || "");
      const category = decodeText(row.category || "India");
      const date = decodeText(row.published_date || "");
      const source = decodeText(row.source_name || row.source || "");
      return `<article class="px-5 py-4 border-b border-slate-100 last:border-b-0">
        <div class="flex items-center justify-between gap-3 mb-2">
          <span class="text-[10px] font-bold uppercase tracking-wide text-emerald-700">${escapeHtml(category)}</span>
          <span class="text-[11px] text-slate-400 whitespace-nowrap">${escapeHtml(date)}</span>
        </div>
        <h3 class="text-sm font-semibold leading-snug text-slate-800">${escapeHtml(title)}</h3>
        ${summary ? `<p class="mt-1 text-xs leading-relaxed text-slate-500">${escapeHtml(summary.slice(0, 145))}${summary.length > 145 ? "…" : ""}</p>` : ""}
        ${source ? `<p class="mt-2 text-[11px] text-slate-400">Source: ${escapeHtml(source)}</p>` : ""}
      </article>`;
    }).join("");
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.onload = resolve;
      script.onerror = () => reject(new Error("Could not load " + src));
      document.head.appendChild(script);
    });
  }

  async function getConfig() {
    if (window.AXOMPREP_CONFIG?.supabaseUrl && (window.AXOMPREP_CONFIG.supabasePublishableKey || window.AXOMPREP_CONFIG.supabaseAnonKey)) {
      return window.AXOMPREP_CONFIG;
    }
    await loadScript("/config.js");
    const cfg = window.AXOMPREP_CONFIG;
    if (!cfg?.supabaseUrl || !(cfg.supabasePublishableKey || cfg.supabaseAnonKey)) {
      throw new Error("Supabase configuration is missing.");
    }
    return cfg;
  }

  async function fetchRows(base, key, table, select, filters) {
    const url = new URL(`${base}/rest/v1/${table}`);
    url.searchParams.set("select", select);
    url.searchParams.set("order", "published_date.desc");
    url.searchParams.set("limit", "20");
    Object.entries(filters || {}).forEach(([name, value]) => url.searchParams.set(name, value));
    const response = await fetch(url.toString(), {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: "no-store"
    });
    const body = await response.text();
    let data;
    try { data = JSON.parse(body); } catch (_) { data = []; }
    if (!response.ok) throw new Error(data?.message || `Supabase returned ${response.status}`);
    return Array.isArray(data) ? data : [];
  }

  async function init() {
    try {
      const cfg = await getConfig();
      if (!window.supabase?.createClient) await loadScript("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2");
      const base = String(cfg.supabaseUrl).replace(/\/+$/, "");
      const key = cfg.supabasePublishableKey || cfg.supabaseAnonKey;
      let rows = [];
      try {
        rows = await fetchRows(base, key, "current_affairs", "title,content,category,published_date,is_published", {});
      } catch (_) {}
      if (!rows.length) {
        rows = await fetchRows(base, key, "current_affairs_v1", "title,summary,content,category,published_date,source_name,status", { status: "eq.published" });
      }
      render(rows);
    } catch (error) {
      showMessage("Current affairs could not be loaded. Please refresh the page.", true);
      console.error("AxomPrep homepage Current Affairs:", error);
    }
  }

  init();
})();