(function () {
  'use strict';

  const grid = document.getElementById('jobsGrid');
  const search = document.getElementById('jobSearch');
  const category = document.getElementById('jobCategory');
  const qualification = document.getElementById('jobQualification');
  const closing = document.getElementById('closingSoon');
  const resultCount = document.getElementById('jobResultCount');
  const updateTime = document.getElementById('jobUpdateTime');
  const clearBtn = document.getElementById('jobClear');

  const state = { items: [], loading: false };

  if (!grid) {
    console.error('AxomPrep: #jobsGrid element was not found.');
    return;
  }

  const esc = value =>
    String(value ?? '').replace(/[&<>"']/g, character => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[character]));

  const safeUrl = value => {
    try {
      const url = new URL(String(value || ''), window.location.href);
      return /^https?:$/.test(url.protocol) ? url.href : '';
    } catch (_) {
      return '';
    }
  };

  function showError(message) {
    grid.innerHTML = `
      <div class="cj-empty">
        <strong>Current jobs could not be loaded.</strong>
        <span>${esc(message)}</span>
        <button type="button" id="cjRetry"
          style="margin-top:12px;padding:9px 14px;border-radius:8px;cursor:pointer">
          Try again
        </button>
      </div>
    `;

    const retryButton = document.getElementById('cjRetry');
    if (retryButton) retryButton.addEventListener('click', load);
  }

  const cfg = window.AXOMPREP_CONFIG;

  if (
    !cfg ||
    !cfg.supabaseUrl ||
    !cfg.supabasePublishableKey
  ) {
    console.error('AxomPrep: Supabase configuration is missing or incomplete.');
    showError('Check config.js and the Supabase URL/key settings.');
    return;
  }

  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    console.error('AxomPrep: Supabase JavaScript library did not load.');
    showError('The Supabase library did not load. Check the page scripts and internet connection.');
    return;
  }

  let db;

  try {
    db = window.supabase.createClient(
      cfg.supabaseUrl,
      cfg.supabasePublishableKey
    );
  } catch (error) {
    console.error('AxomPrep: Could not initialize Supabase.', error);
    showError('Supabase could not be initialized. Check config.js.');
    return;
  }

  function daysLeft(dateValue) {
    if (!dateValue) return null;

    const deadline = new Date(`${dateValue}T23:59:59`);
    if (Number.isNaN(deadline.getTime())) return null;

    return Math.ceil((deadline.getTime() - Date.now()) / 86400000);
  }

  function statusFor(job) {
    const remaining = daysLeft(job.application_last_date);

    if (remaining === null) return { cls: '', label: 'Check notification' };
    if (remaining < 0) return { cls: 'red', label: 'Closed' };
    if (remaining <= 3) return { cls: 'red', label: 'Closing soon' };

    return { cls: 'orange', label: 'Open' };
  }

  function card(job) {
    const status = statusFor(job);
    const remaining = daysLeft(job.application_last_date);
    const apply = safeUrl(job.apply_url);
    const official = safeUrl(job.official_url);
    const source = safeUrl(job.source_url);

    let deadlineText = 'Check notification';

    if (remaining !== null) {
      if (remaining < 0) deadlineText = 'Applications closed';
      else if (remaining === 0) deadlineText = 'Last date: today';
      else deadlineText = `${remaining} day${remaining === 1 ? '' : 's'} left`;
    }

    return `
      <article class="cj-card">
        <div class="cj-top">
          <div class="cj-badges">
            <span class="cj-pill">${esc(job.category || 'Current Jobs')}</span>
            <span class="cj-pill ${status.cls}">${esc(status.label)}</span>
            ${job.featured ? '<span class="cj-pill">Featured</span>' : ''}
          </div>
        </div>

        <h2>${esc(job.title || 'Recruitment Notification')}</h2>
        <div class="cj-org">${esc(job.organization || 'Organization not specified')}</div>

        <p class="cj-summary">
          ${esc(job.description || 'Check the official notification for complete details and eligibility.')}
        </p>

        <div class="cj-info">
          <div><span>Vacancies</span><b>${esc(job.vacancies || '—')}</b></div>
          <div><span>Qualification</span><b>${esc(String(job.qualification || 'See notification').slice(0, 90))}</b></div>
          <div><span>Location</span><b>${esc(job.location || 'India')}</b></div>
          <div><span>Last date</span><b>${esc(job.application_last_date || 'Not specified')}</b></div>
        </div>

        <div class="cj-deadline">
          <strong>${esc(deadlineText)}</strong>
          ${job.post_name ? `<span class="days">${esc(job.post_name)}</span>` : ''}
        </div>

        <div class="cj-actions">
          ${apply ? `<a class="cj-apply" href="${esc(apply)}" target="_blank" rel="noopener noreferrer">Apply / Portal ↗</a>` : ''}
          ${official ? `<a class="cj-official" href="${esc(official)}" target="_blank" rel="noopener noreferrer">Official site ↗</a>` : ''}
          ${source ? `<a class="cj-source" href="${esc(source)}" target="_blank" rel="noopener noreferrer">Details ↗</a>` : ''}
        </div>
      </article>
    `;
  }

  function render() {
    const query = String(search?.value || '').trim().toLowerCase();
    const selectedCategory = category?.value || 'all';
    const selectedQualification = qualification?.value || 'all';
    const onlyClosingSoon = Boolean(closing?.checked);

    const filtered = state.items
      .filter(job => {
        const searchableText = [
          job.title,
          job.organization,
          job.post_name,
          job.category,
          job.qualification,
          job.location,
          job.vacancies
        ].map(value => String(value || '')).join(' ').toLowerCase();

        const matchesSearch = !query || searchableText.includes(query);
        const matchesCategory =
          selectedCategory === 'all' || job.category === selectedCategory;
        const matchesQualification =
          selectedQualification === 'all' ||
          String(job.qualification || '')
            .toLowerCase()
            .includes(selectedQualification.toLowerCase());

        const remaining = daysLeft(job.application_last_date);
        const matchesDeadline =
          !onlyClosingSoon ||
          (remaining !== null && remaining >= 0 && remaining <= 7);

        return (
          matchesSearch &&
          matchesCategory &&
          matchesQualification &&
          matchesDeadline
        );
      })
      .sort((a, b) => {
        const dateA = a.application_last_date || '9999-12-31';
        const dateB = b.application_last_date || '9999-12-31';
        return dateA.localeCompare(dateB);
      });

    if (resultCount) {
      resultCount.textContent =
        `${filtered.length} job${filtered.length === 1 ? '' : 's'} found`;
    }

    grid.innerHTML = filtered.length
      ? filtered.map(card).join('')
      : `
        <div class="cj-empty">
          <strong>${state.items.length ? 'No jobs match your filters.' : 'No current jobs are available.'}</strong>
          <span>${state.items.length ? 'Try clearing a filter or searching another qualification.' : 'Please check again later.'}</span>
        </div>
      `;
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
        .order('application_last_date', {
          ascending: true,
          nullsFirst: false
        })
        .order('featured', { ascending: false })
        .limit(200);

      if (error) throw error;

      state.items = Array.isArray(data) ? data : [];

      if (category) {
        const previousCategory = category.value || 'all';
        const categories = [
          ...new Set(state.items.map(job => job.category).filter(Boolean))
        ].sort();

        category.innerHTML =
          '<option value="all">All categories</option>' +
          categories.map(item =>
            `<option value="${esc(item)}">${esc(item)}</option>`
          ).join('');

        category.value = categories.includes(previousCategory)
          ? previousCategory
          : 'all';
      }

      if (updateTime) {
        const latest = state.items.reduce((mostRecent, job) => {
          const updated = job.updated_at || '';
          return updated > mostRecent ? updated : mostRecent;
        }, '');

        updateTime.textContent = latest
          ? `Updated ${new Date(latest).toLocaleString('en-IN', {
              dateStyle: 'medium',
              timeStyle: 'short',
              timeZone: 'Asia/Kolkata'
            })}`
          : `Checked ${new Date().toLocaleString('en-IN', {
              dateStyle: 'medium',
              timeStyle: 'short',
              timeZone: 'Asia/Kolkata'
            })}`;
      }

      render();
    } catch (error) {
      console.error('AxomPrep current jobs error:', error);
      showError('The database request failed. Check the Console, Supabase table, and access permissions.');
    } finally {
      state.loading = false;
    }
  }

  [search, category, qualification, closing].forEach(element => {
    if (!element) return;
    element.addEventListener(
      element.type === 'checkbox' ? 'change' : 'input',
      render
    );
  });

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (search) search.value = '';
      if (category) category.value = 'all';
      if (qualification) qualification.value = 'all';
      if (closing) closing.checked = false;
      render();
    });
  }

  // Run even if this script is loaded after DOMContentLoaded.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', load, { once: true });
  } else {
    load();
  }

  // Refresh the database query at midnight India time while the page is open.
  function scheduleMidnightRefresh() {
    const now = Date.now();
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(new Date(now));

    const getPart = type => parts.find(part => part.type === type)?.value;
    const year = Number(getPart('year'));
    const month = Number(getPart('month'));
    const day = Number(getPart('day'));

    // India Standard Time is UTC+05:30.
    const nextMidnight = Date.UTC(year, month - 1, day + 1) - 330 * 60000;
    const delay = Math.max(1000, nextMidnight - now);

    window.setTimeout(async () => {
      await load();
      scheduleMidnightRefresh();
    }, delay);
  }

  scheduleMidnightRefresh();
})();
