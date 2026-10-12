// Vercel Cron endpoint: /api/cron/current-jobs
// Scrapes publicly visible AssamCareer listing/article pages and upserts basic job records.
// Server-side only. Never expose SUPABASE_SERVICE_ROLE_KEY in browser code.
// Required env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Optional env: CRON_SECRET
// Optional env: ASSAMCAREER_LISTING_URL (defaults to AssamCareer homepage)

const TABLE = 'current_jobs_v1';
const DEFAULT_LISTING_URL = 'https://www.assamcareer.com/';
const SOURCE_NAME = 'AssamCareer';
const MAX_ARTICLES = 100;
const FEED_URLS = [
  'https://www.assamcareer.com/feeds/posts/default?alt=json&max-results=150',
  'https://www.assamcareer.com/feeds/posts/default/-/Private%20Job?alt=json&max-results=50'
];
const LISTING_URLS = [DEFAULT_LISTING_URL, 'https://www.assamcareer.com/p/latest-updates.html', 'https://www.assamcareer.com/search?max-results=50'];

function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}
function cleanText(value, max = 10000) {
  if (value == null) return null;
  const s = String(value).replace(/\s+/g, ' ').trim();
  return s ? s.slice(0, max) : null;
}
function decodeEntities(s) {
  return String(s || '')
    .replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}
function stripHtml(s) {
  return decodeEntities(String(s || '').replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--([\s\S]*?)-->/g, ' ').replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ').trim());
}
function safeUrl(raw, base) {
  try {
    const u = new URL(decodeEntities(raw), base);
    return ['https:', 'http:'].includes(u.protocol) && (u.hostname === 'assamcareer.com' || u.hostname.endsWith('.assamcareer.com')) ? u.href : null;
  } catch (_) { return null; }
}
function dateToIso(raw) {
  if (!raw) return null;
  const s = String(raw).replace(/\u00a0/g, ' ').replace(/(\d{1,2})(st|nd|rd|th)\b/gi, '$1').trim();
  // ISO / Blogger timestamps (e.g. 2026-10-12T03:15:00Z).
  let m = s.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (m) return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
  // Numeric dates: dd/mm/yyyy or dd-mm-yyyy.
  m = s.match(/\b(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})\b/);
  if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  const months = {jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12'};
  // 12 October 2026.
  m = s.match(/\b(\d{1,2})\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s*,?\s*(\d{4})\b/i);
  if (m) return `${m[3]}-${months[m[2].slice(0,3).toLowerCase()]}-${m[1].padStart(2,'0')}`;
  // October 12, 2026.
  m = s.match(/\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2}),?\s+(\d{4})\b/i);
  if (m) return `${m[3]}-${months[m[1].slice(0,3).toLowerCase()]}-${m[2].padStart(2,'0')}`;
  return null;
}
function statusForDate(dateValue, now = new Date()) {
  if (!dateValue || !/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) return 'open';
  const [y,m,d] = dateValue.split('-').map(Number);
  const deadline = new Date(Date.UTC(y, m - 1, d + 1) - 330 * 60000 - 1);
  if (deadline.getTime() < now.getTime()) return 'closed';
  return Math.ceil((deadline.getTime() - now.getTime()) / 86400000) <= 3 ? 'closing_soon' : 'open';
}
async function getHtml(url) {
  const r = await fetch(url, {
    headers: {
      'User-Agent': 'AxomPrepJobIndexer/1.0 (public job listing links; contact site owner for concerns)',
      'Accept': 'text/html,application/xhtml+xml'
    },
    signal: AbortSignal.timeout(15000)
  });
  if (!r.ok) throw new Error(`AssamCareer returned HTTP ${r.status} for ${url}`);
  const type = r.headers.get('content-type') || '';
  if (type && !type.includes('html') && !type.includes('text/')) throw new Error(`Expected HTML but received ${type}`);
  return r.text();
}
function isJobTitle(title) {
  if (!title || title.length < 12) return false;
  if (/\b(result|admit card|admission|scholarship|scheme|answer key|counselling|merit list|exam date|syllabus)\b/i.test(title)) return false;
  return /\b(recruitment|vacanc|jobs?|posts?|hiring|career|apprentice|walk.?in|employment|notification|trainee|officer|assistant|teacher|faculty|engineer|constable|technician|driver|staff nurse|internship|field assistant|non.?executive|young professional|credit analyst|executive|manager|professor|nurse|grade [a-z])\b/i.test(title);
}
function extractFeedArticles(feedJson) {
  const entries = feedJson && feedJson.feed && Array.isArray(feedJson.feed.entry) ? feedJson.feed.entry : [];
  const found = new Map();
  for (const entry of entries) {
    const title = cleanText(entry && entry.title && entry.title.$t, 500);
    if (!isJobTitle(title)) continue;
    const links = Array.isArray(entry.link) ? entry.link : [];
    const alternate = links.find(link => link && link.rel === 'alternate' && link.href);
    if (!alternate) continue;
    const url = safeUrl(alternate.href, DEFAULT_LISTING_URL);
    if (!url || !/^\/\d{4}\/\d{2}\/[^/]+\.html$/i.test(new URL(url).pathname)) continue;
    found.set(url, { url, title, published: entry.published && entry.published.$t || null, updated: entry.updated && entry.updated.$t || null });
  }
  return [...found.values()];
}
async function getFeedArticles(url) {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'AxomPrepJobIndexer/1.1', 'Accept': 'application/json' },
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error(`AssamCareer feed returned HTTP ${response.status} for ${url}`);
  const payload = await response.json();
  return extractFeedArticles(payload);
}
function extractArticleLinks(html, baseUrl) {
  const found = new Map();
  const re = /<a\b[^>]*href\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    const url = safeUrl(m[2], baseUrl);
    const title = cleanText(stripHtml(m[3]), 500);
    if (!url || !title || title.length < 12) continue;
    const u = new URL(url);
    // Blogger article URLs generally look like /2026/09/article-name.html.
    if (!/^\/\d{4}\/\d{2}\/[^/]+\.html$/i.test(u.pathname)) continue;
    if (/^(home|read more|click here|older posts|newer posts)$/i.test(title)) continue;
    if (!isJobTitle(title)) continue;
    if (!found.has(url)) found.set(url, { url, title });
  }
  return [...found.values()].slice(0, MAX_ARTICLES);
}
function extractField(text, labels) {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`${escaped}\\s*[:：-]\\s*([^.!?]{1,180})`, 'i');
    const m = text.match(re);
    if (m) return cleanText(m[1], 500);
  }
  return null;
}
function extractDateField(text, labels) {
  const source = String(text || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ');
  const datePattern = '(\\d{4}-\\d{1,2}-\\d{1,2}|\\d{1,2}[\\/.-]\\d{1,2}[\\/.-]\\d{4}|\\d{1,2}(?:st|nd|rd|th)?\\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\\.?\\s*,?\\s*\\d{4}|(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\\s+\\d{1,2}(?:st|nd|rd|th)?\\s*,?\\s*\\d{4})';
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Labels are often rendered in tables without a colon, e.g. "Application Start Date 12th October 2026".
    const re = new RegExp('(?:^|\\b)' + escaped + '\\b\\s*(?:[:：–—-]\\s*)?(?:is\\s+|on\\s+|from\\s+)?(' + datePattern + ')', 'i');
    const m = source.match(re);
    if (m) {
      const iso = dateToIso(m[1]);
      if (iso) return iso;
    }
  }
  return null;
}

function externalApplicationLinks(html, baseUrl) {
  const found = [];
  const seen = new Set();
  const re = /<a\b([^>]*?)href\s*=\s*(["'])(.*?)\2([^>]*)>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    try {
      const u = new URL(decodeEntities(m[3]), baseUrl);
      if (!['https:', 'http:'].includes(u.protocol)) continue;
      const host = u.hostname.toLowerCase().replace(/^www\./, '');
      if (host === 'assamcareer.com' || host.endsWith('.assamcareer.com')) continue;
      if (/facebook|instagram|youtube|telegram|twitter|x\.com|whatsapp|pinterest|google\.com|linkedin\.com/i.test(host)) continue;
      if (/javascript:|mailto:|tel:/i.test(m[3])) continue;
      const label = stripHtml(m[5] || '').toLowerCase().replace(/\s+/g, ' ').trim();
      const attrs = `${m[1]} ${m[4]}`.toLowerCase();
      const full = `${label} ${u.href.toLowerCase()} ${attrs}`;
      let type = '';
      if (/apply|application|registration|register|candidate.?login|online.?form|submit.?form|careers?\.?.*(?:login|apply)|recruitment.*portal/i.test(full)) type = 'apply';
      else if (/official|website|notification|advertisement|recruitment.?notice|detailed.?notice|download.?pdf|\.pdf(?:$|[?#])|careers?\b/i.test(full)) type = 'official';
      // Common recruitment portals use generic link text such as "Click Here".
      else if (/^(click here|here|apply|apply online|online application)$/i.test(label) && /apply|career|recruit|registration|portal|application/i.test(u.href)) type = 'apply';
      if (!type) continue;
      const key = `${type}:${u.href}`;
      if (seen.has(key)) continue;
      seen.add(key);
      found.push({ type, url: u.href, label });
    } catch (_) {}
  }
  return found;
}
function paraphrasedSummary(fields) {
  const org = fields.organization || 'The recruiting organisation';
  const role = fields.post_name || fields.title || 'the advertised position';
  const bits = [`${org} has published a recruitment update for ${role}.`];
  if (fields.vacancies) bits.push(`The listing reports ${fields.vacancies} vacancies.`);
  if (fields.qualification) bits.push(`The stated qualification is ${fields.qualification}.`);
  if (fields.application_last_date) bits.push(`The listed application deadline is ${fields.application_last_date}.`);
  bits.push('Review the linked official notice for full eligibility, category-wise vacancies, selection stages, fees and application instructions.');
  return cleanText(bits.join(' '), 1200);
}
function parseArticle(html, article, now) {
  const text = stripHtml(html);
  const titleMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)/i) ||
    html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  let title = titleMatch ? cleanText(stripHtml(titleMatch[1]).replace(/\s*[-|].*AssamCareer.*$/i, ''), 500) : article.title;
  if (!title || title.length < 8) title = article.title;
  const lastDate = extractDateField(text, ['Last Date of Submission', 'Last Date to Apply', 'Last Date for Online Application', 'Last Date for Application', 'Application Deadline', 'Online Application Last Date', 'Closing Date', 'Last Date', 'Apply Before']);
  const startDate = extractDateField(text, ['Application Start Date', 'Starting Date of Submission', 'Starting Date to Apply', 'Online Application Start Date', 'Application Begins', 'Start Date']);
  const organization = extractField(text, ['Organization', 'Name of organisation', 'Name of organization', 'Department']) || title.replace(/\s*(Recruitment|Vacancy|Jobs?).*$/i, '').slice(0, 500);
  const vacancies = extractField(text, ['No of posts', 'No. of posts', 'Total posts', 'Vacancy']);
  const qualification = extractField(text, ['Qualification', 'Educational Qualification', 'Minimum qualification']);
  const ageLimit = extractField(text, ['Age Limit', 'Age limit']);
  const salary = extractField(text, ['Pay', 'Salary', 'Pay Scale']);
  const postedDate = dateToIso(article.published) || dateToIso(article.updated) || dateToIso((html.match(/<meta\s+property=["']article:published_time["']\s+content=["']([^"']+)/i) || [])[1]) ||
    dateToIso((text.match(/(?:published|posted|updated|date of notification|notification date)\s*[:：-]?\s*(?:on\s+)?(?:\d{1,2}[\/.-]\d{1,2}[\/.-]\d{4}|\d{1,2}\s+[A-Za-z]+\s+\d{4}|[A-Za-z]+\s+\d{1,2},?\s+\d{4})/i) || [])[0]);
  const links = externalApplicationLinks(html, article.url);
  const officialLink = links.find(x => x.type === 'official');
  const applyLink = links.find(x => x.type === 'apply');
  const key = article.url.replace(/[?#].*$/, '').replace(/\/$/, '');
  const fields = {
    external_key: key,
    title,
    organization,
    post_name: title,
    vacancies,
    location: /assam|guwahati|dibrugarh|silchar|jorhat|kokrajhar|barpeta|goalpara/i.test(text) ? 'Assam / As specified in notice' : 'See official notification',
    qualification,
    age_limit: ageLimit,
    salary,
    application_start_date: startDate,
    application_last_date: lastDate,
    posted_date: postedDate,
    notification_date: extractDateField(text, ['Date of Notification', 'Notification Date', 'Advertisement Date']) || postedDate,
    category: /private job|private limited|sales executive|company/i.test(title + ' ' + text.slice(0,1000)) ? 'Private Jobs' : 'Government Jobs',
    source_name: SOURCE_NAME,
    source_url: article.url,
    official_url: officialLink ? officialLink.url : null,
    apply_url: applyLink ? applyLink.url : null,
    featured: false,
    status: statusForDate(lastDate, now),
    last_verified: now.toISOString(),
    updated_at: now.toISOString()
  };
  fields.description = paraphrasedSummary(fields);
  return fields;
}
async function supabaseRequest(url, serviceKey, options = {}) {
  const r = await fetch(url, { ...options, headers: {
    apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json', ...(options.headers || {})
  }});
  const raw = await r.text();
  let body = null; try { body = raw ? JSON.parse(raw) : null; } catch (_) { body = raw; }
  if (!r.ok) throw new Error(`Supabase request failed (${r.status}): ${typeof body === 'string' ? body : JSON.stringify(body)}`);
  return body;
}
module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST'); return json(res, 405, { ok: false, error: 'Method not allowed' });
  }
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) return json(res, 401, { ok: false, error: 'Unauthorized cron request' });
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return json(res, 500, { ok: false, error: 'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel.' });
  const listingUrl = process.env.ASSAMCAREER_LISTING_URL || DEFAULT_LISTING_URL;
  const now = new Date();
  try {
    const listingUrls = [...new Set([listingUrl, ...LISTING_URLS.filter(u => u !== listingUrl)])];
    const [listingResults, feedResults] = await Promise.all([
      Promise.allSettled(listingUrls.map(async url => ({url, html: await getHtml(url)}))),
      Promise.allSettled(FEED_URLS.map(async url => ({url, articles: await getFeedArticles(url)})))
    ]);
    const listingPages = listingResults.filter(x => x.status === 'fulfilled').map(x => x.value);
    const linkMap = new Map();
    for (const result of feedResults) {
      if (result.status !== 'fulfilled') continue;
      for (const article of result.value.articles) if (!linkMap.has(article.url)) linkMap.set(article.url, article);
    }
    for (const page of listingPages) {
      for (const article of extractArticleLinks(page.html, page.url)) if (!linkMap.has(article.url)) linkMap.set(article.url, article);
    }
    if (!linkMap.size && !listingPages.length) throw new Error('Could not load an AssamCareer feed or listing page; no job records were imported.');
    const links = [...linkMap.values()].sort((a, b) => {
      const da = Date.parse(a.published || a.updated || '') || 0;
      const db = Date.parse(b.published || b.updated || '') || 0;
      return db - da;
    }).slice(0, MAX_ARTICLES);
    if (!links.length) throw new Error('AssamCareer pages loaded, but no matching job article links were found. No job records were imported.');
    const results = await Promise.allSettled(links.map(async article => ({ article, job: parseArticle(await getHtml(article.url), article, now) })));
    const jobs = results.filter(x => x.status === 'fulfilled').map(x => x.value.job).filter(j => j && j.title && j.external_key && j.source_url);
    const articleErrors = results.filter(x => x.status === 'rejected').length;
    if (!jobs.length) throw new Error('Article links were found, but no article pages could be parsed. No job records were imported.');
    const base = `${supabaseUrl.replace(/\/+$/, '')}/rest/v1/${TABLE}`;
    // Preserve previously verified application/official URLs when a source page temporarily omits them.
    const existingLinks = await supabaseRequest(`${base}?select=external_key,apply_url,official_url&limit=1000`, serviceKey, { method: 'GET' });
    const linkByKey = new Map((Array.isArray(existingLinks) ? existingLinks : []).map(row => [row.external_key, row]));
    const mergedJobs = jobs.map(job => {
      const previous = linkByKey.get(job.external_key) || {};
      return {
        ...job,
        apply_url: job.apply_url || previous.apply_url || null,
        official_url: job.official_url || previous.official_url || null
      };
    });
    await supabaseRequest(`${base}?on_conflict=external_key`, serviceKey, {
      method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(mergedJobs)
    });
    const existing = await supabaseRequest(`${base}?select=id,application_last_date,status&limit=1000`, serviceKey, { method: 'GET' });
    let statusesUpdated = 0;
    for (const row of Array.isArray(existing) ? existing : []) {
      const status = statusForDate(row.application_last_date, now);
      if (row.status === status) continue;
      await supabaseRequest(`${base}?id=eq.${encodeURIComponent(row.id)}`, serviceKey, {
        method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status })
      });
      statusesUpdated++;
    }
    return json(res, 200, {
      ok: true, source: SOURCE_NAME, listingUrlsChecked: listingPages.map(p => p.url), feedsChecked: feedResults.filter(x => x.status === 'fulfilled').map(x => x.value.url), articlesFound: links.length,
      importedOrUpdated: jobs.length, articleFetchErrors: articleErrors, statusesUpdated,
      checkedAt: now.toISOString(),
      warning: 'Job summaries are rewritten from extracted facts, not copied article text. Some fields may be unavailable; always verify against the linked official notice.'
    });
  } catch (error) {
    console.error('AxomPrep current-jobs cron failed:', error);
    return json(res, 500, { ok: false, error: error.message || 'Current jobs update failed' });
  }
};
