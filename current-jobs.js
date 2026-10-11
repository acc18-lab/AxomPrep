```javascript
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

  const state = {
    items: [],
    loading: false
  };

  if (!grid) {
    console.error('AxomPrep: #jobsGrid was not found.');
    return;
  }

  // Escape text before inserting it into HTML.
  const esc = value =>
    String(value ?? '').replace(/[&<>"']/g, character => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[character]));

  // Allow only HTTP and HTTPS links.
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

    if (retryButton) {
      retryButton.addEventListener('click', load);
    }
  }

  // Check configuration and Supabase availability.
  const cfg = window.AXOMPREP_CONFIG;

  if (
    !cfg ||
    !cfg.supabaseUrl ||
    !cfg.supabasePublishableKey
  ) {
    console.error(
      'AxomPrep: Missing AXOMPREP_CONFIG, supabaseUrl or supabasePublishableKey.'
    );

    showError('Check config.js and your Supabase configuration.');
    return;
  }

  if (!window.supabase || !window.supabase.createClient) {
    console.error('AxomPrep: The Supabase JavaScript library did not load.');
    showError('The Supabase library did not load. Check your connection.');
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

  // Calculate days remaining until the application deadline.
  function daysLeft(dateValue) {
    if (!dateValue) return null;

    const deadline = new Date(`${dateValue}T23:59:59`);

    if (Number.isNaN(deadline.getTime())) return null;

    return Math.ceil(
      (deadline.getTime() - Date.now()) / 86400000
    );
  }

  function statusFor(job) {
    const remaining = daysLeft(job.application_last_date);

    if (remaining === null) {
      return { cls: '', label: 'Check notification' };
    }

    if (remaining < 0) {
      return { cls: 'red', label: 'Closed' };
    }

    if (remaining <= 3) {
      return { cls: 'red', label: 'Closing soon' };
    }

    return { cls: 'orange', label: 'Open' };
  }

  // Build a job card using the existing cj-* CSS classes.
  function card(job) {
    const status = statusFor(job);
    const remaining = daysLeft(job.application_last_date);

    const apply = safeUrl(job.apply_url);
    const official = safeUrl(job.official_url);
    const source = safeUrl(job.source_url);

    let deadlineText = 'Check notification';

    if (remaining !== null) {
      if (remaining < 0) {
        deadlineText = 'Applications closed';
      } else if (remaining === 0) {
        deadlineText = 'Last date: today';
      } else {
        deadlineText =
          `${remaining} day${remaining === 1 ? '' : 's'} left`;
      }
    }

    return `
      <article class="cj-card">
        <div class="cj-top">
          <div class="cj-badges">
            <span class="cj-pill">
              ${esc(job.category || 'Current Jobs')}
            </span>

            <span class="cj-pill ${status.cls}">
              ${esc(status.label)}
            </span>

            ${job.featured
              ? '<span class="cj-pill">Featured</span>'
              : ''}
          </div>
        </div>

        <h2>${esc(job.title || 'Recruitment Notification')}</h2>

        <div class="cj-org">
          ${esc(job.organization || 'Organization not specified')}
        </div>

        <p class="cj-summary">
          ${esc(
            job.description ||
            'Check the official notification for complete details and eligibility.'
          )}
        </p>

        <div class="cj-info">
          <div>
            <span>Vacancies</span>
            <b>${esc(job.vacancies || '—')}</b>
          </div>

          <div>
            <span>Qualification</span>
            <b>${esc(
              String(job.qualification || 'See notification').slice(0, 90)
            )}</b>
          </div>

          <div>
            <span>Location</span>
            <b>${esc(job.location || 'India')}</b>
          </div>

          <div>
            <span>Last date</span>
            <b>${esc(job.application_last_date || 'Not specified')}</b>
          </div>
        </div>

        <div class="cj-deadline">
          <strong>${esc(deadlineText)}</strong>

          ${job.post_name
            ? `<span class="days">${esc(job.post_name)}</span>`
            : ''}
        </div>

        <div class="cj-actions">
          ${apply
            ? `<a class="cj-apply"
                 href="${esc(apply)}"
                 target="_blank"
                 rel="noopener noreferrer">
                 Apply / Portal ↗
               </a>`
            : ''}

          ${official
            ? `<a class="cj-official"
                 href="${esc(official)}"
                 target="_blank"
                 rel="noopener noreferrer">
                 Official site ↗
               </a>`
            : ''}

          ${source
            ? `<a class="cj-source"
                 href="${esc(source)}"
                 target="_blank"
                 rel="noopener noreferrer">
                 Details ↗
               </a>`
            : ''}
        </div>
      </article>
    `;
  }

  // Apply search and filters.
  function render() {
    const query = String(search?.value || '')
      .trim()
      .toLowerCase();

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
        ]
          .map(value => String(value || ''))
          .join(' ')
          .toLowerCase();

        const matchesSearch =
          !query || searchableText.includes(query);

        const matchesCategory =
          selectedCategory === 'all' ||
          job.category === selectedCategory;

        const matchesQualification =
          selectedQualification === 'all' ||
          String(job.qualification || '')
            .toLowerCase()
            .includes(selectedQualification.toLowerCase());

        const remaining = daysLeft(job.application_last_date);

        const matchesDeadline =
          !onlyClosingSoon ||
          (
            remaining !== null &&
            remaining >= 0 &&
            remaining <= 7
          );

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

    if (filtered.length) {
      grid.innerHTML = filtered.map(card).join('');
    } else {
      grid.innerHTML = `
        <div class="cj-empty">
          <strong>
            ${state.items.length
              ? 'No jobs match your filters.'
              : 'No current jobs are available.'}
          </strong>
          <span>
            ${state.items.length
              ? 'Try clearing a filter or searching another qualification.'
              : 'Please check again later.'}
          </span>
        </div>
      `;
    }
  }

  // Fetch jobs from Supabase.
  async function load() {
    if (state.loading) return;

    state.loading = true;
    grid.innerHTML =
      '<div class="cj-loading">Loading current jobs…</div>';

    try {
      const { data, error } = await db
        .from('current_jobs_v1')
        .select('*')
        .in('status', ['open', 'closing_soon', 'closed'])
        .order('application_last_date', {
          ascending: true,
          nullsFirst: false
        })
        .order('featured', {
          ascending: false
        })
        .limit(200);

      if (error) {
        throw error;
      }

      state.items = Array.isArray(data) ? data : [];

      // Populate categories without unnecessarily resetting the selection.
      if (category) {
        const previousCategory = category.value || 'all';

        const categories = [
          ...new Set(
            state.items
              .map(job => job.category)
              .filter(Boolean)
          )
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

      showError(
        'The database request failed. Check the browser console, ' +
        'Supabase table, and access permissions.'
      );
    } finally {
      state.loading = false;
    }
  }

  // Connect the filters.
  [search, category, qualification, closing].forEach(element => {
    if (!element) return;

    element.addEventListener(
      element.type === 'checkbox' ? 'change' : 'input',
      render
    );
  });

  // Clear all filters.
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (search) search.value = '';
      if (category) category.value = 'all';
      if (qualification) qualification.value = 'all';
      if (closing) closing.checked = false;

      render();
    });
  }

  // Load correctly whether this file runs before or after DOM readiness.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', load, { once: true });
  } else {
    load();
  }

  // Refresh the data at midnight India time while the page remains open.
  function scheduleMidnightRefresh() {
    const now = Date.now();

    const indiaParts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(new Date(now));

    const part = type =>
      indiaParts.find(item => item.type === type)?.value;

    const todayIndia = `${part('year')}-${part('month')}-${part('day')}`;

    const [year, month, day] = todayIndia.split('-').map(Number);

    // IST is UTC+05:30. Calculate the next midnight in IST.
    const nextMidnight = Date.UTC(year, month - 1, day + 1) - 330 * 60000;

    const delay = Math.max(1000, nextMidnight - now);

    window.setTimeout(async () => {
      await load();
      scheduleMidnightRefresh();
    }, delay);
  }

  scheduleMidnightRefresh();

})();
```
