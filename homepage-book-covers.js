/* Load real book-cover thumbnails for the static Recommended Books cards. */
(function () {
  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const tokens = (s) => norm(s).split(/\s+/).filter(w => w.length > 2 && !['the','and','for','with','book','guide','edition'].includes(w));
  const scoreTitle = (wanted, candidate) => {
    const a = tokens(wanted), b = new Set(tokens(candidate));
    if (!a.length || !b.size) return 0;
    const overlap = a.filter(t => b.has(t)).length / a.length;
    if (norm(candidate).includes(norm(wanted))) return 1;
    return overlap;
  };
  const https = (url) => String(url || '').replace(/^http:\/\//i, 'https://');

  async function findGoogleCover(title, author) {
    const queries = [
      `intitle:${title}${author ? ` inauthor:${author}` : ''}`,
      title
    ];
    for (const q of queries) {
      try {
        const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=10&printType=books`;
        const response = await fetch(url, { mode: 'cors' });
        if (!response.ok) continue;
        const data = await response.json();
        const candidates = (data.items || []).map(item => {
          const info = item.volumeInfo || {};
          const links = info.imageLinks || {};
          return { title: info.title || '', authors: (info.authors || []).join(' '), image: links.extraLarge || links.large || links.medium || links.thumbnail || links.smallThumbnail || '' };
        }).filter(x => x.image);
        candidates.sort((a, b) => scoreTitle(title, b.title) - scoreTitle(title, a.title));
        if (candidates.length && scoreTitle(title, candidates[0].title) >= 0.45) return https(candidates[0].image).replace(/&amp;/g, '&');
      } catch (_) {}
    }
    return '';
  }

  async function findOpenLibraryCover(title) {
    try {
      const response = await fetch(`https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&limit=10`, { mode: 'cors' });
      if (!response.ok) return '';
      const data = await response.json();
      const docs = (data.docs || []).filter(d => d.cover_i);
      docs.sort((a, b) => scoreTitle(title, b.title) - scoreTitle(title, a.title));
      if (docs.length && scoreTitle(title, docs[0].title) >= 0.45) return `https://covers.openlibrary.org/b/id/${docs[0].cover_i}-L.jpg`;
    } catch (_) {}
    return '';
  }

  async function run() {
    const section = [...document.querySelectorAll('section')].find(s => /recommended books/i.test(s.querySelector('h2')?.textContent || ''));
    if (!section) return;
    const cards = [...section.querySelectorAll('.group')].filter(card => card.querySelector('h3'));
    for (const card of cards) {
      const title = card.querySelector('h3')?.textContent?.trim();
      const author = card.querySelector('.text-slate-500')?.textContent?.replace(/^By\s+/i, '').trim() || '';
      const frame = card.querySelector('.h-48');
      if (!title || !frame || frame.dataset.coverLookupDone === '1') continue;
      frame.dataset.coverLookupDone = '1';
      frame.style.position = 'relative';
      let src = await findGoogleCover(title, author);
      if (!src) src = await findOpenLibraryCover(title);
      if (!src) continue;
      const img = document.createElement('img');
      img.src = src;
      img.alt = `${title} original book cover`;
      img.loading = 'lazy';
      img.decoding = 'async';
      img.style.cssText = 'width:112px;height:144px;object-fit:contain;display:block;position:relative;z-index:2;filter:drop-shadow(0 2px 3px rgba(15,23,42,.18));';
      img.addEventListener('load', () => {
        const placeholder = frame.querySelector(':scope > div');
        if (placeholder) placeholder.style.display = 'none';
        frame.style.backgroundColor = '#f1f5f9';
      }, { once: true });
      img.addEventListener('error', () => img.remove(), { once: true });
      frame.appendChild(img);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once: true });
  else run();
})();
