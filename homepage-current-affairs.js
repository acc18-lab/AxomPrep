(function () {
  'use strict';

  // Homepage Current Affairs module only.
  const root = document.getElementById('homeCurrentAffairsList');
  if (!root) return;

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));

  function formatDate(value) {
    if (!value) return '';
    const date = new Date(String(value).length === 10 ? `${value}T00:00:00` : value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata'
    }).format(date);
  }

  function showMessage(message, isError) {
    root.innerHTML = `<div class="p-5 text-sm ${isError ? 'text-rose-600' : 'text-slate-500'}">${escapeHtml(message)}</div>`;
  }

  async function waitForConfig() {
    for (let i = 0; i < 40; i++) {
      const cfg = window.AXOMPREP_CONFIG;
      if (cfg && cfg.supabaseUrl && (cfg.supabasePublishableKey || cfg.supabaseAnonKey)) return cfg;
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    throw new Error('Supabase configuration is not available. Check config.js.');
  }

  async function fetchRows(base, key, table, select, extra) {
    const url = new URL(`${base}/rest/v1/${table}`);
    url.searchParams.set('select', select);
    url.searchParams.set('order', 'published_date.desc');
    url.searchParams.set('limit', '4');
    if (extra) Object.entries(extra).forEach(([k, v]) => url.searchParams.set(k, v));
    const response = await fetch(url.toString(), {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: 'no-store'
    });
    const raw = await response.text();
    let payload;
    try { payload = raw ? JSON.parse(raw) : []; } catch (_) { payload = []; }
    if (!response.ok) {
      const message = payload && (payload.message || payload.details || payload.hint);
      throw new Error(message || `Supabase ${table} request failed (HTTP ${response.status}).`);
    }
    return Array.isArray(payload) ? payload : [];
  }

  function render(rows) {
    if (!rows.length) {
      showMessage('No current-affairs updates are published yet. Please check the Current Affairs page.', false);
      return;
    }
    root.innerHTML = rows.slice(0, 4).map(row => {
      const title = escapeHtml(row.title || 'Current-affairs update');
      const category = escapeHtml(row.category || 'India');
      const summary = escapeHtml(String(row.content || row.summary || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 118));
      const date = formatDate(row.published_date);
      return `<article class="px-5 py-4">
        <div class="mb-1 flex items-center justify-between gap-2">
          <span class="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">${category}</span>
          ${date ? `<time class="shrink-0 text-[11px] text-slate-400">${escapeHtml(date)}</time>` : ''}
        </div>
        <h3 class="text-sm font-semibold leading-snug text-slate-800">${title}</h3>
        ${summary ? `<p class="mt-1 text-xs leading-relaxed text-slate-500">${summary}${String(row.content || row.summary || '').length > 118 ? '…' : ''}</p>` : ''}
      </article>`;
    }).join('');
  }

  async function load() {
    try {
      const cfg = await waitForConfig();
      const base = String(cfg.supabaseUrl).replace(/\/+$/, '');
      const key = cfg.supabasePublishableKey || cfg.supabaseAnonKey;
      let rows = [];
      let primaryError = null;

      try {
        rows = await fetchRows(base, key, 'current_affairs',
          'title,content,category,published_date,is_published');
      } catch (error) {
        primaryError = error;
      }

      if (!rows.length) {
        try {
          rows = await fetchRows(base, key, 'current_affairs_v1',
            'title,summary,content,category,published_date,source_name,status',
            { status: 'eq.published' });
        } catch (fallbackError) {
          if (primaryError) throw new Error(`Primary table: ${primaryError.message} Fallback table: ${fallbackError.message}`);
          throw fallbackError;
        }
      }
      render(rows);
    } catch (error) {
      console.error('[AxomPrep homepage current affairs]', error);
      showMessage('Current affairs could not be loaded. Please use “Read All” or try again later.', true);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', load, { once: true });
  } else {
    load();
  }
})();
