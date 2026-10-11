// Vercel Cron endpoint: /api/cron/current-jobs
// Scrapes publicly visible AssamCareer listing/article pages and upserts basic job records.
// Server-side only. Never expose SUPABASE_SERVICE_ROLE_KEY in browser code.
// Required env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Optional env: CRON_SECRET
// Optional env: ASSAMCAREER_LISTING_URL (defaults to AssamCareer homepage)

const TABLE = 'current_jobs_v1';
const DEFAULT_LISTING_URL = 'https://www.assamcareer.com/';
const SOURCE_NAME = 'AssamCareer';
const MAX_ARTICLES = 25;

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
    return ['https:', 'http:'].includes(u.protocol) && u.hostname.endsWith('assamcareer.com') ? u.href : null;
  } catch (_) { return null; }
}
function dateToIso(raw) {
  if (!raw) return null;
  const s = String(raw).replace(/\u00a0/g, ' ').trim();
  let m = s.match(/\b(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})\b/);
  if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  m = s.match(/\b(\d{1,2})\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s*,?\s*(\d{4})\b/i);
  if (m) {
    const months = {jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12'};
    return `${m[3]}-${months[m[2].slice(0,3).toLowerCase()]}-${m[1].padStart(2,'0')}`;
  }
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
function parseArticle(html, article, now) {
  const text = stripHtml(html);
  const titleMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)/i) ||
    html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  let title = titleMatch ? cleanText(stripHtml(titleMatch[1]).replace(/\s*[-|].*AssamCareer.*$/i, ''), 500) : article.title;
  if (!title || title.length < 8) title = article.title;
  const lastDateRaw = extractField(text, ['Last Date', 'Last date of submission', 'Last date to apply', 'Closing Date', 'Last date for online application']);
  const startDateRaw = extractField(text, ['Start Date', 'Starting date of submission', 'Application Start Date', 'Starting date to apply']);
  const organization = extractField(text, ['Organization', 'Name of organisation', 'Name of organization', 'Department']) || title.replace(/\s*(Recruitment|Vacancy|Jobs?).*$/i, '').slice(0, 500);
  const vacancies = extractField(text, ['No of posts', 'No. of posts', 'Total posts', 'Vacancy']);
  const qualification = extractField(text, ['Qualification', 'Educational Qualification', 'Minimum qualification']);
  const ageLimit = extractField(text, ['Age Limit', 'Age limit']);
  const salary = extractField(text, ['Pay', 'Salary', 'Pay Scale']);
  const postedDate = dateToIso((html.match(/<meta\s+property=["']article:published_time["']\s+content=["']([^"']+)/i) || [])[1]) ||
    dateToIso((text.match(/(?:by\s+[^,]{2,80}\s+)?(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}/i) || [])[0]);
  const lastDate = dateToIso(lastDateRaw);
  const description = cleanText(text.slice(0, 4500), 4500);
  const key = article.url.replace(/[?#].*$/, '').replace(/\/$/, '');
  return {
    external_key: key,
    title,
    organization,
    post_name: title,
    vacancies,
    location: /assam|guwahati|dibrugarh|silchar|jorhat|kokrajhar|barpeta|goalpara/i.test(text) ? 'Assam / As specified in notice' : 'See official notification',
    qualification,
    age_limit: ageLimit,
    salary,
    application_start_date: startDateRaw ? (dateToIso(startDateRaw) || startDateRaw) : null,
    application_last_date: lastDate,
    posted_date: postedDate,
    category: /private job|private limited|sales executive|company/i.test(title + ' ' + text.slice(0,1000)) ? 'Private Jobs' : 'Government Jobs',
    description,
    source_name: SOURCE_NAME,
    source_url: article.url,
    official_url: null,
    apply_url: null,
    featured: false,
    status: statusForDate(lastDate, now),
    last_verified: now.toISOString()
  };
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
    const listingHtml = await getHtml(listingUrl);
    const links = extractArticleLinks(listingHtml, listingUrl);
    if (!links.length) throw new Error('No article links were found. AssamCareer may have changed its HTML; no job records were imported.');
    const results = await Promise.allSettled(links.map(async article => ({ article, job: parseArticle(await getHtml(article.url), article, now) })));
    const jobs = results.filter(x => x.status === 'fulfilled').map(x => x.value.job).filter(j => j && j.title && j.external_key && j.source_url);
    const articleErrors = results.filter(x => x.status === 'rejected').length;
    if (!jobs.length) throw new Error('Article links were found, but no article pages could be parsed. No job records were imported.');
    const base = `${supabaseUrl.replace(/\/+$/, '')}/rest/v1/${TABLE}`;
    await supabaseRequest(`${base}?on_conflict=external_key`, serviceKey, {
      method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(jobs)
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
      ok: true, source: SOURCE_NAME, listingUrl, articlesFound: links.length,
      importedOrUpdated: jobs.length, articleFetchErrors: articleErrors, statusesUpdated,
      checkedAt: now.toISOString(),
      warning: 'This imports basic listing/article data from AssamCareer. Verify official notifications and application links before relying on details; fields not reliably extracted may be blank.'
    });
  } catch (error) {
    console.error('AxomPrep current-jobs cron failed:', error);
    return json(res, 500, { ok: false, error: error.message || 'Current jobs update failed' });
  }
};
