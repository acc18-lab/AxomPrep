```javascript
(function () {
  const grid = document.getElementById('jobsGrid');
  const resultCount = document.getElementById('jobResultCount');
  const updateTime = document.getElementById('jobUpdateTime');

  if (!grid) return;

  const showError = (message) => {
    grid.innerHTML = `
      <div class="cj-empty">
        <strong>Current jobs could not be loaded.</strong>
        <span>${message}</span>
        <button type="button" id="cjRetry"
          style="margin-top:12px;padding:9px 14px;border-radius:8px;cursor:pointer">
          Try again
        </button>
      </div>`;
    document.getElementById('cjRetry')?.addEventListener('click', load);
  };

  const cfg = window.AXOMPREP_CONFIG;

  if (!cfg || !cfg.supabaseUrl || !cfg.supabasePublishableKey) {
    showError('Supabase configuration is missing. Check config.js.');
    return;
  }

  if (!window.supabase?.createClient) {
    showError('The Supabase library did not load. Check your internet connection.');
    return;
  }

  const db = window.supabase.createClient(
    cfg.supabaseUrl,
    cfg.supabasePublishableKey
  );

  const search = document.getElementById('jobSearch');
  const category = document.getElementById('jobCategory');
  const qualification = document.getElementById('jobQualification');
  const closing = document.getElementById('closingSoon');
  const clearBtn = document.getElementById('jobClear');

  const state = { items: [], loading: false };

  const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;',
    '"': '&quot;', "'": '&#39;'
  }[m]));

  const safeUrl = u => {
    try {
      const x = new URL(String(u || ''), location.href);
      return /^https?:$/.test(x.protocol) ? x.href : '';
    } catch (_) {
      return '';
    }
  };

  function daysLeft(d) {
    if (!d) return null;
    const end = new Date(d + 'T23:59:59');
    return Number.isNaN(end.getTime())
      ? null
      : Math.ceil((end - new Date()) / 86400000);
  }

  function statusFor(j) {
    const n = daysLeft(j.application_last_date);
    if (n === null) return { cls: '', label: 'Check notification' };
    if (n < 0) return { cls: 'red', label: 'Closed' };
    if (n <= 3) return { cls: 'red', label: 'Closing soon' };
    return { cls: 'orange', label: 'Open' };
  }

  function card(j) {
    const st = statusFor(j);
    const n = daysLeft(j.application_last_date);
    const apply = safeUrl(j.apply_url);
    const official = safeUrl(j.official_url);
    const source = safeUrl(j.source_url);

    return `<article class="cj-card">
      <div class="cj-top"><div class="cj-badges">
        <span class="cj-pill">${esc(j.category || 'Current Jobs')}</span>
        <span class="cj-pill ${st.cls}">${st.label}</span>
        ${j.featured ? '<span class="cj-pill">Featured</span>' : ''}
      </div></div>
      <h2>${esc(j.title)}</h2>
      <div class="cj-org">${esc(j.organization || 'Organization not specified')}</div>
      <p class="cj-summary">${esc(j.description || 'Check the official notification for details.')}</p>
      <div class="cj-info">
        <div><span>Vacancies</span><b>${esc(j.vacancies || '—')}</b></div>
        <div><span>Qualification</span><b>${esc(j.qualification || 'See notification')}</b></div>
        <div><span>Location</span><b>${esc(j.location || 'India')}</b></div>
        <div><span>Last date</span><b>${esc(j.application_last_date || 'Not specified')}</b></div>
      </div>
      <div class="cj-deadline"><strong>${
        n === null ? 'Check notification' :
        n < 0 ? 'Applications closed' :
        n === 0 ? 'Last date: today' :
        `${n} day${n === 1 ? '' : 's'} left`
      }</strong>${j.post_name ? `<span class="days">${esc(j.post_name)}</span>` : ''}</div>
      <div class="cj-actions">
        ${apply ? `<a class="cj-apply" href="${esc(apply)}" target="_blank" rel="noopener noreferrer">Apply / Portal ↗</a>` : ''}
        ${official ? `<a class="cj-official" href="${esc(official)}" target="_blank" rel="noopener noreferrer">Official site ↗</a>` : ''}
        ${source ? `<a class="cj-source" href="${esc(source)}" target="_blank" rel="noopener noreferrer">Details ↗</a>` : ''}
      </div>
    </article>`;
  }

  function render() {
    const q = String(search?.value || '').trim().toLowerCase();
    const cat = category?.value || 'all';
    const qual = qualification?.value || 'all';
    const onlyClosing = !!closing?.checked;

    const filtered = state.items.filter(j => {
      const hay = [
        j.title, j.organization, j.post_name, j.category,
        j.qualification, j.location, j.vacancies
      ].join(' ').toLowerCase();

      const qok = !q || hay.includes(q);
      const cok = cat === 'all' || j.category === cat;
      const qlok = qual === 'all' ||
        String(j.qualification || '').toLowerCase().includes(qual.toLowerCase());

      const n = daysLeft(j.application_last_date);
      const lok = !onlyClosing || (n !== null && n >= 0 && n <= 7);

      return qok && cok && qlok && lok;
    }).sort((a, b) => {
      const da = a.application_last_date || '9999-12-31';
      const db = b.application_last_date || '9999-12-31';
      return da.localeCompare(db);
    });

    if (resultCount) {
      resultCount.textContent =
        `${filtered.length} job${filtered.length === 1 ? '' : 's'} found`;
    }

    grid.innerHTML = filtered.length
      ? filtered.map(card).join('')
      : `<div class="cj-empty">
           <strong>No jobs match your filters.</strong>
           <span>Try another search or qualification.</span>
         </div>`;
  }

  async function load() {
    if (state.loading) return;
    state.loading = true;
    grid.innerHTML = '<div class="cj-loading">Loading current jobs…</div>';

    try {
      const { data, error } = await db
        .from('current_jobs_v1')
        .select('*')
        .in('status', ['open', 'closing_soon', 'closed'])
        .order('application_last_date', { ascending: true, nullsFirst: false })
        .order('featured', { ascending: false })
        .limit(200);

      if (error) throw error;

      state.items = data || [];

      if (category) {
        const selected = category.value || 'all';
        const cats = [...new Set(state.items.map(x => x.category).filter(Boolean))].sort();

        category.innerHTML =
          '<option value="all">All categories</option>' +
          cats.map(x => `<option value="${esc(x)}">${esc(x)}</option>`).join('');

        category.value = cats.includes(selected) ? selected : 'all';
      }

      if (updateTime) {
        updateTime.textContent = 'Data checked ' +
          new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
      }

      render();
    } catch (error) {
      console.error('AxomPrep jobs loading error:', error);
      showError('The database request failed. Check the browser console and Supabase settings.');
    } finally {
      state.loading = false;
    }
  }

  [search, category, qualification, closing].forEach(el => {
    el?.addEventListener(el.type === 'checkbox' ? 'change' : 'input', render);
  });

  clearBtn?.addEventListener('click', () => {
    if (search) search.value = '';
    if (category) category.value = 'all';
    if (qualification) qualification.value = 'all';
    if (closing) closing.checked = false;
    render();
  });

  // Load after the HTML has finished parsing.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', load, { once: true });
} else {
  load();
}

  // Re-fetch job records daily at midnight IST, even if the tab stays open.
  function scheduleMidnightRefresh() {
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(now);

    const get = type => parts.find(p => p.type === type)?.value;
    const tomorrow = new Date(
      `${get('year')}-${get('month')}-${get('day')}T00:00:00+05:30`
    );
    tomorrow.setDate(tomorrow.getDate() + 1);

    setTimeout(async () => {
      await load();
      scheduleMidnightRefresh();
    }, Math.max(1000, tomorrow.getTime() - now.getTime()));
  }

  scheduleMidnightRefresh();
})();
```
