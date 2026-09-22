const { createClient } = require('@supabase/supabase-js');
const { XMLParser } = require('fast-xml-parser');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET = process.env.CRON_SECRET;
const AUTO_PUBLISH = String(process.env.CURRENT_AFFAIRS_AUTO_PUBLISH || 'true').toLowerCase() === 'true';
const MAX_INSERTS = Math.max(1, Math.min(40, Number(process.env.CURRENT_AFFAIRS_MAX_INSERTS || 20)));

const FEEDS = [
  {
    url: 'https://www.pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=1',
    fallbackCategory: 'India',
    fallbackSource: 'Press Information Bureau'
  },
  {
    url: 'https://assamtribune.com/feed',
    fallbackCategory: 'Assam',
    fallbackSource: 'The Assam Tribune'
  },
  {
    url: 'https://news.google.com/rss/search?q=Assam+government+OR+Assam+economy+OR+Assam+education&hl=en-IN&gl=IN&ceid=IN:en',
    fallbackCategory: 'Assam',
    fallbackSource: 'Google News'
  },
  {
    url: 'https://news.google.com/rss/search?q=India+government+OR+India+economy+OR+India+science+technology&hl=en-IN&gl=IN&ceid=IN:en',
    fallbackCategory: 'India',
    fallbackSource: 'Google News'
  },
  {
    url: 'https://news.google.com/rss/search?q=world+international+geopolitics&hl=en-IN&gl=IN&ceid=IN:en',
    fallbackCategory: 'International',
    fallbackSource: 'Google News'
  },
  {
    url: 'https://news.google.com/rss/search?q=India+science+technology+space&hl=en-IN&gl=IN&ceid=IN:en',
    fallbackCategory: 'Science & Technology',
    fallbackSource: 'Google News'
  },
  {
    url: 'https://news.google.com/rss/search?q=India+sports+cricket+football&hl=en-IN&gl=IN&ceid=IN:en',
    fallbackCategory: 'Sports',
    fallbackSource: 'Google News'
  },
  {
    url: 'https://news.google.com/rss/search?q=India+economy+RBI+budget+inflation&hl=en-IN&gl=IN&ceid=IN:en',
    fallbackCategory: 'Economy',
    fallbackSource: 'Google News'
  }
];

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  trimValues: true,
  cdataPropName: '__cdata'
});

function textOf(value) {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim();
  if (typeof value === 'object') {
    return String(value.__cdata ?? value['#text'] ?? value.text ?? '').trim();
  }
  return '';
}

function arr(v) {
  return Array.isArray(v) ? v : (v == null ? [] : [v]);
}

function clean(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

function stripHtml(s) {
  return clean(String(s || '').replace(/<[^>]*>/g, ' '));
}

function parseDate(s) {
  const d = new Date(s || '');
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function yyyyMmDd(d) {
  return d.toISOString().slice(0, 10);
}

function categoryFor(title, feedFallback) {
  const t = title.toLowerCase();
  const rules = [
    ['Defence', /defen[cs]e|army|navy|air force|missile|military|border security/],
    ['Science & Technology', /science|technology|isro|space|satellite|ai\b|artificial intelligence|quantum|semiconductor/],
    ['Economy', /economy|rbi|inflation|gdp|budget|tax|bank|finance|investment|industry|trade|export|import/],
    ['Environment', /climate|environment|forest|wildlife|pollution|biodiversity|tiger|rhino|kaziranga/],
    ['Sports', /sport|cricket|football|hockey|badminton|tennis|olympic|athlete/],
    ['Government Schemes', /scheme|yojana|subsidy|welfare|benefit|mission/],
    ['Infrastructure', /highway|railway|airport|bridge|metro|road|infrastructure|port/],
    ['International', /united nations|u\.n\.|china|russia|ukraine|usa|united states|europe|european|g20|g7|bimstec|asean|international/],
    ['Governance', /cabinet|government|policy|minister|parliament|bill|law|election|administration/],
  ];
  for (const [cat, rx] of rules) if (rx.test(t)) return cat;
  return feedFallback || 'India';
}

function parseItems(xml, feed) {
  const root = parser.parse(xml);
  const channel = root?.rss?.channel || root?.feed || {};
  const rawItems = channel.item || channel.entry || [];
  return arr(rawItems).map(item => {
    const title = clean(textOf(item.title));
    const linkValue = item.link;
    let sourceUrl = '';
    if (typeof linkValue === 'string') sourceUrl = linkValue;
    else if (Array.isArray(linkValue)) {
      const l = linkValue.find(x => x?.['@_rel'] === 'alternate') || linkValue[0];
      sourceUrl = typeof l === 'string' ? l : String(l?.['@_href'] || '');
    } else if (linkValue && typeof linkValue === 'object') {
      sourceUrl = String(linkValue['@_href'] || linkValue.__cdata || linkValue['#text'] || '');
    }

    let sourceName = feed.fallbackSource;
    if (item.source) {
      if (typeof item.source === 'string') sourceName = clean(item.source);
      else sourceName = clean(item.source['#text'] || item.source.__cdata || item.source);
    }

    const rawDescription = textOf(item.description || item.summary || item.content || '');
    const summary = stripHtml(rawDescription).slice(0, 420);
    const publishedAt = parseDate(textOf(item.pubDate || item.published || item.updated || item.date));

    let imageUrl = '';
    const media = item['media:content'] || item['media:thumbnail'] || item.enclosure;
    if (media) {
      const m = Array.isArray(media) ? media[0] : media;
      imageUrl = String(m?.['@_url'] || m?.['@_href'] || '');
    }

    if (!title || !sourceUrl) return null;
    return {
      title,
      summary: summary || `Current-affairs update: ${title}`,
      content: summary || `Current-affairs update: ${title}`,
      category: categoryFor(title, feed.fallbackCategory),
      published_date: yyyyMmDd(publishedAt),
      source_name: sourceName || feed.fallbackSource,
      source_url: sourceUrl,
      image_url: imageUrl || null,
      published_at: AUTO_PUBLISH ? new Date().toISOString() : null,
      status: AUTO_PUBLISH ? 'published' : 'review',
      featured: false
    };
  }).filter(Boolean);
}

async function fetchFeed(feed) {
  const response = await fetch(feed.url, {
    headers: { 'user-agent': 'AxomPrep-Current-Affairs-Bot/1.0' }
  });
  if (!response.ok) throw new Error(`${feed.url} -> HTTP ${response.status}`);
  const xml = await response.text();
  return parseItems(xml, feed);
}

function requireCronAuth(req) {
  if (!CRON_SECRET) return true;
  const auth = String(req.headers.authorization || '');
  return auth === `Bearer ${CRON_SECRET}`;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  if (!requireCronAuth(req)) return res.status(401).json({ ok: false, error: 'Unauthorized' });
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ ok: false, error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const results = await Promise.allSettled(FEEDS.map(fetchFeed));
  const items = results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
  const errors = results.filter(r => r.status === 'rejected').map(r => String(r.reason?.message || r.reason));

  if (!items.length) {
    return res.status(502).json({ ok: false, inserted: 0, feeds_ok: FEEDS.length - errors.length, errors });
  }

  const recent = await supabase
    .from('current_affairs_v1')
    .select('title,published_date,source_url')
    .order('created_at', { ascending: false })
    .limit(500);
  if (recent.error) return res.status(500).json({ ok: false, error: recent.error.message });

  const seen = new Set((recent.data || []).map(x => `${clean(x.source_url)}|${clean(x.title).toLowerCase()}|${x.published_date}`));
  const fresh = [];
  for (const item of items.sort((a,b) => b.published_date.localeCompare(a.published_date))) {
    const key = `${item.source_url}|${item.title.toLowerCase()}|${item.published_date}`;
    if (seen.has(key)) continue;
    seen.add(key);
    fresh.push(item);
    if (fresh.length >= MAX_INSERTS) break;
  }

  let inserted = 0;
  if (fresh.length) {
    const { data, error } = await supabase.from('current_affairs_v1').insert(fresh).select('id');
    if (error) return res.status(500).json({ ok: false, error: error.message, candidate_count: fresh.length });
    inserted = data?.length || 0;
  }

  return res.status(200).json({
    ok: true,
    inserted,
    candidates: items.length,
    duplicates_skipped: items.length - fresh.length,
    feeds_ok: FEEDS.length - errors.length,
    feeds_failed: errors.length,
    auto_published: AUTO_PUBLISH,
    errors
  });
};
