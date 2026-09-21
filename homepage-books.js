(function(){
  const grid=document.getElementById('homeBooksGrid');
  if(!grid) return;

  const escapeHtml=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const safeUrl=value=>{
    try{
      const u=new URL(String(value||''),window.location.href);
      return /^https?:$/.test(u.protocol) ? u.href : '';
    }catch(_){ return ''; }
  };
  const coverTone=category=>{
    const c=String(category||'').toLowerCase();
    if(c.includes('mathemat')) return 'math';
    if(c.includes('reason')) return 'reason';
    if(c.includes('english')) return 'english';
    if(c.includes('science')) return 'science';
    if(c.includes('current')||c.includes('economy')) return 'orange';
    if(c.includes('polity')||c.includes('apsc')) return 'blue';
    return 'assam';
  };
  const splitExam=s=>(String(s||'').split(/[•|]/).map(x=>x.trim()).filter(Boolean).slice(0,3));

  function renderCard(b){
    const title=escapeHtml(b.title||'Recommended book');
    const cat=escapeHtml(b.category||'Competitive exams');
    const author=escapeHtml(b.author||'');
    const desc=escapeHtml((b.description||'').slice(0,135));
    const exams=splitExam(b.exam_name).map(x=>`<span>${escapeHtml(x)}</span>`).join('');
    const amazon=safeUrl(b.amazon_url), flipkart=safeUrl(b.flipkart_url), cover=safeUrl(b.cover_url);
    const coverHtml=cover
      ? `<img src="${escapeHtml(cover)}" alt="${title}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';"><div class="home-cover-fallback" style="display:none"><small>${cat}</small><strong>${title}</strong></div>`
      : `<div class="home-cover-fallback"><small>${cat}</small><strong>${title}</strong></div>`;
    return `<article class="home-book-card">
      <div class="home-book-cover tone-${coverTone(b.category)}">${coverHtml}</div>
      <div class="home-book-body">
        ${b.featured?'<span class="home-book-badge">Featured</span>':''}
        <h3>${title}</h3>
        ${author?`<div class="home-book-author">${author}</div>`:''}
        <div class="home-book-exams">${exams}</div>
        <p>${desc}${(b.description||'').length>135?'…':''}</p>
        <div class="home-book-actions">
          ${amazon?`<a class="home-affiliate amazon" href="${escapeHtml(amazon)}" target="_blank" rel="sponsored noopener" data-book="${escapeHtml(b.id||'')}" data-store="amazon">Amazon ↗</a>`:''}
          ${flipkart?`<a class="home-affiliate flipkart" href="${escapeHtml(flipkart)}" target="_blank" rel="sponsored noopener" data-book="${escapeHtml(b.id||'')}" data-store="flipkart">Flipkart ↗</a>`:''}
        </div>
      </div>
    </article>`;
  }

  function renderBooks(data){
    if(!data?.length){
      grid.innerHTML='<div class="home-books-empty"><strong>No featured books yet.</strong><br><span>Publish books from the AxomPrep Books section to show them here.</span><a href="books.html">Open Books →</a></div>';
      return;
    }
    grid.innerHTML=data.map(renderCard).join('');
  }

  document.addEventListener('click',async e=>{
    const a=e.target.closest('a[data-book]');
    if(!a || a.dataset.book.startsWith('starter-') || !window.supabase || !window.AXOMPREP_CONFIG) return;
    try{
      const client=window.supabase.createClient(AXOMPREP_CONFIG.supabaseUrl,AXOMPREP_CONFIG.supabasePublishableKey);
      await client.from('book_clicks_v1').insert({book_id:a.dataset.book,store:a.dataset.store});
    }catch(_){ }
  });

  async function load(){
    if(!window.supabase || !window.AXOMPREP_CONFIG){
      renderBooks([]); return;
    }
    const client=window.supabase.createClient(AXOMPREP_CONFIG.supabaseUrl,AXOMPREP_CONFIG.supabasePublishableKey);
    try{
      let {data,error}=await client.from('books_v1')
        .select('id,title,author,description,exam_name,category,cover_url,amazon_url,flipkart_url,featured,status')
        .eq('status','published').eq('featured',true)
        .order('created_at',{ascending:false}).limit(6);
      if(error) throw error;
      if(!data || data.length<3){
        const supplement=await client.from('books_v1')
          .select('id,title,author,description,exam_name,category,cover_url,amazon_url,flipkart_url,featured,status')
          .eq('status','published')
          .order('featured',{ascending:false}).order('created_at',{ascending:false}).limit(6);
        if(!supplement.error) data=supplement.data||[];
      }
      renderBooks((data||[]).slice(0,6));
    }catch(err){
      console.error('Homepage books:',err);
      grid.innerHTML='<div class="home-books-empty"><strong>Books are temporarily unavailable.</strong><br><span>Please open the full Books page.</span><a href="books.html">Open Books →</a></div>';
    }
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',load); else load();
})();
