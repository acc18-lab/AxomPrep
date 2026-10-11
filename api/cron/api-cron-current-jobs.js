// Vercel Cron endpoint: /api/cron/current-jobs
// This is SERVER-SIDE code. Do not put it in the root current-jobs.js file.
//
// Required Vercel environment variables:
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY   (server-side only; never expose in browser code)
//   CURRENT_JOBS_FEED_URL       (URL returning a JSON array of job records)
//
// Optional:
//   CRON_SECRET                 (Vercel sends Authorization: Bearer <CRON_SECRET>)

const TABLE = 'current_jobs_v1';

function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function isoNow() {
  return new Date().toISOString();
}

function statusForDate(dateValue, now = new Date()) {
  if (!dateValue) return 'open';

  const match = String(dateValue).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return 'open';

  // Interpret the application deadline as the end of that date in IST.
  // Vercel runs server code in UTC, so convert IST midnight to UTC explicitly.
  const deadline = new Date(
    Date.UTC(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]) + 1
    ) - (330 * 60 * 1000) - 1
  );

  if (Number.isNaN(deadline.getTime())) return 'open';
  if (deadline.getTime() < now.getTime()) return 'closed';

  const days = Math.ceil((deadline.getTime() - now.getTime()) / 86400000);
  return days <= 3 ? 'closing_soon' : 'open';
}

function cleanText(value, max = 10000) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text ? text.slice(0, max) : null;
}

function normalizeJob(input, now) {
  if (!input || typeof input !== 'object') return null;

  const title = cleanText(input.title, 500);
  const externalKey = cleanText(input.external_key, 500);
  const sourceUrl = cleanText(input.source_url, 2000);
  const officialUrl = cleanText(input.official_url, 2000);
  const applyUrl = cleanText(input.apply_url, 2000);

  // Do not import incomplete entries or entries without a stable deduplication key.
  if (!title || !externalKey || !sourceUrl) return null;

  const urlIsHttp = value => {
    if (!value) return true;
    try {
      return ['http:', 'https:'].includes(new URL(value).protocol);
    } catch (_) {
      return false;
    }
  };

  if (!urlIsHttp(sourceUrl) || !urlIsHttp(officialUrl) || !urlIsHttp(applyUrl)) {
    return null;
  }

  const job = {
    external_key: externalKey,
    title,
    organization: cleanText(input.organization, 500),
    post_name: cleanText(input.post_name, 500),
    vacancies: cleanText(input.vacancies, 100),
    location: cleanText(input.location, 500),
    qualification: cleanText(input.qualification, 2000),
    age_limit: cleanText(input.age_limit, 500),
    salary: cleanText(input.salary, 500),
    application_start_date: cleanText(input.application_start_date, 30),
    application_last_date: cleanText(input.application_last_date, 30),
    posted_date: cleanText(input.posted_date, 30),
    category: cleanText(input.category, 200) || 'Other',
    description: cleanText(input.description, 5000),
    source_name: cleanText(input.source_name, 300) || 'Configured feed',
    source_url: sourceUrl,
    official_url: officialUrl,
    apply_url: applyUrl,
    featured: Boolean(input.featured),
    status: statusForDate(input.application_last_date, now),
    last_verified: now.toISOString()
  };

  // Remove null values so absent feed fields do not erase existing details on upsert.
  for (const key of Object.keys(job)) {
    if (job[key] === null) delete job[key];
  }

  return job;
}

async function supabaseRequest(url, serviceKey, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  const bodyText = await response.text();
  let body = null;
  try {
    body = bodyText ? JSON.parse(bodyText) : null;
  } catch (_) {
    body = bodyText;
  }

  if (!response.ok) {
    const message = typeof body === 'string' ? body : JSON.stringify(body);
    throw new Error(`Supabase request failed (${response.status}): ${message}`);
  }

  return body;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return json(res, 405, { ok: false, error: 'Method not allowed' });
  }

  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    return json(res, 401, { ok: false, error: 'Unauthorized cron request' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const feedUrl = process.env.CURRENT_JOBS_FEED_URL;

  if (!supabaseUrl || !serviceKey) {
    return json(res, 500, {
      ok: false,
      error: 'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel Environment Variables.'
    });
  }

  if (!feedUrl) {
    return json(res, 500, {
      ok: false,
      error: 'Set CURRENT_JOBS_FEED_URL to a trusted JSON feed. No new job data was imported.'
    });
  }

  let parsedFeedUrl;
  try {
    parsedFeedUrl = new URL(feedUrl);
    if (!['http:', 'https:'].includes(parsedFeedUrl.protocol)) throw new Error('Invalid protocol');
  } catch (_) {
    return json(res, 500, { ok: false, error: 'CURRENT_JOBS_FEED_URL must be a valid HTTPS/HTTP URL.' });
  }

  const now = new Date();
  const restBase = `${supabaseUrl.replace(/\/+$/, '')}/rest/v1/${TABLE}`;

  try {
    // Fetch the configured feed. It must return a JSON array of job objects.
    const feedResponse = await fetch(parsedFeedUrl.href, {
      headers: { Accept: 'application/json' }
    });

    if (!feedResponse.ok) {
      throw new Error(`Job feed returned HTTP ${feedResponse.status}`);
    }

    const feedData = await feedResponse.json();
    const rawJobs = Array.isArray(feedData)
      ? feedData
      : (Array.isArray(feedData.jobs) ? feedData.jobs : null);

    if (!rawJobs) {
      throw new Error('Job feed must return a JSON array, or an object with a jobs array.');
    }

    const normalized = rawJobs
      .map(item => normalizeJob(item, now))
      .filter(Boolean);

    let imported = 0;
    if (normalized.length) {
      await supabaseRequest(
        `${restBase}?on_conflict=external_key`,
        serviceKey,
        {
          method: 'POST',
          headers: {
            Prefer: 'resolution=merge-duplicates,return=minimal'
          },
          body: JSON.stringify(normalized)
        }
      );
      imported = normalized.length;
    }

    // Recalculate statuses for existing records too. Do not claim these records
    // were verified against a source; last_verified is only set for feed entries.
    const existing = await supabaseRequest(
      `${restBase}?select=id,application_last_date,status&limit=1000`,
      serviceKey,
      { method: 'GET' }
    );

    let statusesUpdated = 0;
    for (const job of (Array.isArray(existing) ? existing : [])) {
      const nextStatus = statusForDate(job.application_last_date, now);
      if (job.status === nextStatus) continue;

      await supabaseRequest(
        `${restBase}?id=eq.${encodeURIComponent(job.id)}`,
        serviceKey,
        {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ status: nextStatus })
        }
      );
      statusesUpdated += 1;
    }

    return json(res, 200, {
      ok: true,
      feedRecords: rawJobs.length,
      importedOrUpdated: imported,
      skippedInvalidRecords: rawJobs.length - normalized.length,
      statusesUpdated,
      checkedAt: now.toISOString(),
      note: 'New job records can only be imported when CURRENT_JOBS_FEED_URL points to a trusted JSON feed with the required fields.'
    });
  } catch (error) {
    console.error('AxomPrep current-jobs cron failed:', error);
    return json(res, 500, {
      ok: false,
      error: error.message || 'Current jobs update failed'
    });
  }
};
