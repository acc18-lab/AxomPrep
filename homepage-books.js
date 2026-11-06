/* Homepage Recommended Books module only.
   Loads the published catalogue used by books.html and selects four at random per page load. */
(function () {
  'use strict';
  const grid = document.getElementById('homeBooksGrid');
  if (!grid) return;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const safeUrl = value => {
    try { const u = new URL(String(value || ''), location.href); return /^https?:$/.test(u.protocol) ? u.href : ''; }
    catch (_) { return ''; }
  };
  function shuffle(items) {
    const a = items.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function coverFor(book) {
    const mapped = typeof window.getAxomPrepBookCover === 'function' ? window.getAxomPrepBookCover(book) : '';
    return safeUrl(mapped || book.cover_url || '');
  }
  function card(book) {
    const title = esc(book.title || 'Recommended book');
    const author = esc(book.author || book.publisher || '');
    const cover = coverFor(book);
    const amazon = safeUrl(book.amazon_url);
    const flipkart = safeUrl(book.flipkart_url);
    const image = cover
      ? `<img src="${esc(cover)}" alt="${title} book cover" loading="lazy" decoding="async" class="h-36 w-28 object-contain drop-shadow-md" onerror="this.style.display='none';this.nextElementSibling.hidden=false"><div hidden class="h-36 w-28 rounded bg-slate-200 text-slate-700 text-xs font-semibold p-3 flex items-center justify-center text-center">${title}</div>`
      : `<div class="h-36 w-28 rounded bg-slate-200 text-slate-700 text-xs font-semibold p-3 flex items-center justify-center text-center">${title}</div>`;
    const actions = [amazon ? `<a href="${esc(amazon)}" target="_blank" rel="noopener noreferrer sponsored" class="text-xs font-semibold bg-blue-50 text-axom-blue px-3 py-1.5 rounded hover:bg-axom-blue hover:text-white">Amazon</a>` : '',
      flipkart ? `<a href="${esc(flipkart)}" target="_blank" rel="noopener noreferrer sponsored" class="text-xs font-semibold bg-blue-50 text-axom-blue px-3 py-1.5 rounded hover:bg-axom-blue hover:text-white">Flipkart</a>` : ''].filter(Boolean).join('');
    return `<article class="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-lg transition-all">
      <div class="h-48 bg-slate-100 flex items-center justify-center p-4">${image}</div>
      <div class="p-4"><h3 class="font-bold text-slate-800 text-sm mb-1">${title}</h3>
      ${author ? `<p class="text-xs text-slate-500 mb-3">${author}</p>` : '<div class="mb-3"></div>'}
      ${actions ? `<div class="flex flex-wrap gap-2">${actions}</div>` : `<a href="/books.html" class="text-xs font-semibold text-axom-blue hover:underline">View book →</a>`}
      </div></article>`;
  }
  async function load() {
    try {
      const cfg = window.AXOMPREP_CONFIG || {};
      if (!cfg.supabaseUrl || !cfg.supabasePublishableKey || !window.supabase?.createClient) throw new Error('Books catalogue is temporarily unavailable.');
      const client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabasePublishableKey);
      const { data, error } = await client.from('books_v1')
        .select('id,title,author,publisher,description,exam_name,category,cover_url,amazon_url,flipkart_url,featured,status')
        .eq('status', 'published').limit(200);
      if (error) throw error;
      const books = Array.isArray(data) ? data.filter(b => b && b.title) : [];
      if (!books.length) {
        grid.innerHTML = '<div class="col-span-full text-sm text-slate-500">No published books are available yet. <a class="text-blue-600" href="/books.html">See all books</a>.</div>';
        return;
      }
      grid.innerHTML = shuffle(books).slice(0, 4).map(card).join('');
    } catch (error) {
      console.error('AxomPrep homepage recommended books:', error);
      grid.innerHTML = '<div class="col-span-full text-sm text-slate-500">Books are temporarily unavailable. <a class="text-blue-600" href="/books.html">See all books</a>.</div>';
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load, { once: true });
  else load();
})();
