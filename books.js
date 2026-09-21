const client = window.supabase?.createClient(AXOMPREP_CONFIG.supabaseUrl, AXOMPREP_CONFIG.supabasePublishableKey);
let books=[], cats=new Set(), exams=new Set();

function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
function safeUrl(value){
  try{
    const u=new URL(String(value||''),window.location.href);
    return /^https?:$/.test(u.protocol)?u.href:'';
  }catch(_){return '';}
}
function coverFor(book){return String(window.getAxomPrepBookCover?.(book)||'').trim();}
function splitExams(value){return String(value||'').split(/[•|]/).map(x=>x.trim()).filter(Boolean).slice(0,4)}
function fallbackCover(book){
  const title=escapeHtml(book.title||'Competitive Exam Book');
  const category=escapeHtml(book.category||'Recommended');
  return `<div class="cover-fallback-v2"><small>${category}</small><strong>${title}</strong></div>`;
}

function card(b){
  const title=escapeHtml(b.title||'Recommended book');
  const cover=coverFor(b);
  const coverHtml=cover
    ? `<img src="${escapeHtml(cover)}" alt="${title} book cover" loading="lazy" data-fallback-title="${title}"><div class="cover-fallback-v2" hidden></div>`
    : fallbackCover(b);
  const chips=splitExams(b.exam_name).map(x=>`<span>${escapeHtml(x)}</span>`).join('');
  const amazon=safeUrl(b.amazon_url), flipkart=safeUrl(b.flipkart_url);
  return `<article class="study-book-card">
    <div class="study-cover${cover?'':' is-fallback'}">${coverHtml}</div>
    <div class="study-book-content">
      ${b.featured?'<span class="study-book-badge">FEATURED PICK</span>':''}
      <div class="study-book-category">${escapeHtml(b.category||'Competitive Exams')}</div>
      <h3>${title}</h3>
      <div class="study-book-author">${escapeHtml(b.author||'')}</div>
      <div class="study-book-exams">${chips}</div>
      <p class="study-book-desc">${escapeHtml((b.description||'').slice(0,145))}${(b.description||'').length>145?'…':''}</p>
      <div class="study-store-links">
        ${amazon?`<a class="study-amazon" target="_blank" rel="sponsored noopener" href="${escapeHtml(amazon)}" data-book="${escapeHtml(b.id||'')}" data-store="amazon">Amazon ↗</a>`:''}
        ${flipkart?`<a class="study-flipkart" target="_blank" rel="sponsored noopener" href="${escapeHtml(flipkart)}" data-book="${escapeHtml(b.id||'')}" data-store="flipkart">Flipkart ↗</a>`:''}
      </div>
    </div>
  </article>`;
}

function setFilters(){
  document.getElementById('category').innerHTML='<option value="">All categories</option>'+[...cats].sort().map(x=>`<option value="${escapeHtml(x)}">${escapeHtml(x)}</option>`).join('');
  document.getElementById('exam').innerHTML='<option value="">All exams</option>'+[...exams].sort().map(x=>`<option value="${escapeHtml(x)}">${escapeHtml(x)}</option>`).join('');
}

function render(){
  const q=(document.getElementById('search').value||'').toLowerCase().trim();
  const c=document.getElementById('category').value;
  const e=document.getElementById('exam').value;
  const list=books.filter(b=>{
    const hay=`${b.title||''} ${b.author||''} ${b.exam_name||''} ${b.category||''} ${b.description||''}`.toLowerCase();
    const examsForBook=splitExams(b.exam_name);
    return (!q||hay.includes(q))&&(!c||b.category===c)&&(!e||examsForBook.includes(e));
  });
  document.getElementById('bookCount').textContent=`${list.length} ${list.length===1?'book':'books'}`;
  document.getElementById('booksGrid').innerHTML=list.length?list.map(card).join(''):'<div class="books-empty"><strong>No books match your filters.</strong><span>Try another search, category or exam.</span></div>';
  document.querySelectorAll('.study-cover img').forEach(img=>img.addEventListener('error',()=>{
    const box=img.closest('.study-cover');
    if(!box) return;
    img.remove();
    box.classList.add('is-fallback');
    const title=img.dataset.fallbackTitle||'Book cover unavailable';
    const cat=box.closest('.study-book-card')?.querySelector('.study-book-category')?.textContent||'Recommended';
    box.insertAdjacentHTML('beforeend',`<div class="cover-fallback-v2"><small>${escapeHtml(cat)}</small><strong>${title}</strong></div>`);
  },{once:true}));
}

async function loadBooks(){
  if(!client){
    books=[];
    render();
    return;
  }
  const res=await client.from('books_v1').select('*').eq('status','published').order('featured',{ascending:false}).order('created_at',{ascending:false});
  if(res.error){
    console.error('Books:',res.error);
    books=[];
  }else books=res.data||[];
  cats.clear(); exams.clear();
  books.forEach(b=>{
    if(b.category) cats.add(b.category);
    splitExams(b.exam_name).forEach(x=>exams.add(x));
  });
  setFilters();
  render();
  document.getElementById('heroBookTotal').textContent=books.length||0;
}

document.addEventListener('input',e=>{if(e.target.id==='search')render()});
document.addEventListener('change',e=>{if(e.target.id==='category'||e.target.id==='exam')render()});
document.addEventListener('click',async e=>{
  const a=e.target.closest('a[data-book]');
  if(!a||!a.dataset.book||!client||a.dataset.book.startsWith('starter-')) return;
  try{await client.from('book_clicks_v1').insert({book_id:a.dataset.book,store:a.dataset.store});}catch(_){ }
});

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',loadBooks); else loadBooks();
