/* AxomPrep homepage Current Affairs module only.
   Loads the same public tables and fields used by current-affairs.html.
   Does not modify jobs, quiz, navigation, books, auth, or other homepage modules. */
(function () {
  'use strict';

  const container = document.getElementById('homeCurrentAffairsList');
  if (!container) return;

  const esc = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[ch]);

  function dateLabel(value) {
    if (!value) return '';
    const date = new Date(String(value).length === 10 ? value + 'T00:00:00' : value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata'
    }).format(date);
  }

  function render(items) {
    if (!items.length) {
      container.innerHTML = '<div class="p-5 text-sm text-slate-500">No current-affairs updates are available right now. Please check the Current Affairs page.</div>';
      return;
    }

    container.innerHTML = items.map((item) => {
      const title = esc(item.title || 'Current-affairs update');
      const category = esc(item.category || 'India');
      const summary = esc(item.content || item.summary || '');
      const date = esc(dateLabel(item.published_date));
      return `
        <article class="px-5 py-4 border-b border-slate-100 last:border-b-0">
          <div class="flex items-center justify-between gap-3 mb-2">
            <span class="text-[11px] font-bold text-axom-blue bg-blue-50 rounded-full px-2 py-1">${category}</span>
            <span class="text-[11px] text-slate-400 whitespace-nowrap">${date}</span>
          </div>
          <h3 class="text-sm font-semibold leading-5 text-slate-800">${title}</h3>
          ${summary ? `<p class="mt-1 text-xs leading-5 text-slate-500 line-clamp-2">${summary}</p>` : ''}
        </article>`;
    }).join('');
  }

  async function requestRows(base, key, table, query) {
    const response = await fetch(`${base}/rest/v1/${table}?${query}`, {
      method: 'GET',
      headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' },
      cache: 'no-store'
    });
    const raw = await response.text();
    let payload;
    try { payload = raw ? JSON.parse(raw) : []; } catch (_) { payload = []; }
    if (!response.ok) {
      const message = payload && (payload.message || payload.details || payload.hint);
      throw new Error(message || `Supabase returned HTTP ${response.status}`);
    }
    return Array.isArray(payload) ? payload : [];
  }

  async function load() {
    try {
      const config = window.AXOMPREP_CONFIG || {};
      const base = String(config.supabaseUrl || '').replace(/\/+$/, '');
      const key = config.supabasePublishableKey || config.supabaseAnonKey || '';
      if (!base || !key) throw new Error('Homepage Supabase configuration is unavailable.');

      let rows = [];
      // Match the primary table and column set used by the full Current Affairs page.
      try {
        rows = await requestRows(
          base, key, 'current_affairs',
          'select=title,content,category,published_date&order=published_date.desc&limit=4'
        );
      } catch (_) {
        rows = [];
      }

      // The automated feed table is the existing fallback used by current-affairs.html.
      if (!rows.length) {
        rows = await requestRows(
          base, key, 'current_affairs_v1',
          'select=title,summary,content,category,published_date,source_name,status&status=eq.published&order=published_date.desc&limit=4'
        );
      }

      render(rows.slice(0, 4));
    } catch (error) {
      console.error('[AxomPrep Current Affairs] Could not load homepage updates:', error);
      container.innerHTML = '<div class="p-5 text-sm text-rose-600">Current affairs could not be loaded. Please try again or use Read All.</div>';
    }
  }

  load();
})();
