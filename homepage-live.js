(function(){
  const cfg=window.AXOMPREP_CONFIG;
  if(!cfg || !window.supabase) return;
  const db=window.supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey);
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const safeUrl=v=>{try{const u=new URL(String(v||''),location.href);return /^https?:$/.test(u.protocol)?u.href:''}catch(_){return ''}};
  const state={jobs:[],jobCat:'all',news:[],newsCat:'all',focus:null,focusSelected:null};
  const $=id=>document.getElementById(id);
  function daysLeft(d){if(!d)return null;const x=new Date(d+'T23:59:59');return Math.ceil((x-new Date())/86400000)}

  function renderJobs(){
    const el=$('homeJobsList'); if(!el)return;
    const filtered=state.jobs.filter(j=>state.jobCat==='all'||String(j.category||'').toLowerCase().includes(state.jobCat.toLowerCase()));
    if(!filtered.length){el.innerHTML='<div class="ax-empty"><strong>No active jobs in this category.</strong>Browse Current Jobs for the full list.</div>';return}
    el.innerHTML=filtered.slice(0,4).map(j=>{
      const left=daysLeft(j.application_last_date), closing=left!==null&&left>=0&&left<=7, apply=safeUrl(j.apply_url), official=safeUrl(j.official_url);
      const leftText=left===null?'See notice':left<0?'Closed':left===0?'Today':left+'d left';
      return `<article class="ax-job-item"><div class="ax-job-top"><strong>${esc(j.title||'Recruitment update')}</strong><span class="ax-job-pill ${closing?'close':''}">${leftText}</span></div><div class="ax-job-org">${esc(j.organization||j.post_name||'Recruitment')}</div><div class="ax-job-meta"><div><span>Vacancies</span><b>${esc(j.vacancies||'—')}</b></div><div><span>Last date</span><b>${esc(j.application_last_date||'See notice')}</b></div></div><div class="ax-job-actions">${apply?`<a class="ax-job-apply" href="${esc(apply)}" target="_blank" rel="noopener">Apply →</a>`:''}${official?`<a class="ax-job-official" href="${esc(official)}" target="_blank" rel="noopener">Official →</a>`:''}</div></article>`;
    }).join('');
  }

  function renderNews(){
    const el=$('homeNewsList'); if(!el)return;
    const filtered=state.news.filter(n=>state.newsCat==='all'||String(n.category||'').toLowerCase()===state.newsCat.toLowerCase()||(state.newsCat==='International'&&/international|world/i.test(String(n.category||''))));
    if(!filtered.length){el.innerHTML='<div class="ax-empty"><strong>No current affairs in this category.</strong>Browse all current affairs for the latest entries.</div>';return}
    el.innerHTML=filtered.slice(0,5).map(n=>{
      const img=safeUrl(n.image_url), cat=esc(n.category||'Current Affairs');
      return `<article class="ax-news-item"><div class="ax-news-img">${img?`<img src="${esc(img)}" alt="" loading="lazy" onerror="this.style.display='none'">`:''}</div><div><div class="ax-news-meta"><span class="ax-news-cat">${cat}</span><span>${esc(n.published_date||'')}</span></div><h3>${esc(n.title||'Current affairs update')}</h3><p>${esc(String(n.summary||'').slice(0,110))}${String(n.summary||'').length>110?'…':''}</p></div></article>`;
    }).join('')+`<div class="ax-news-more"><a class="ax-btn ax-btn-light" href="current-affairs.html">Read all current affairs →</a></div>`;
  }

  function renderBooks(data){
    const el=$('homeBooksShelf'); if(!el)return;
    if(!data.length){el.innerHTML='<div class="ax-empty"><strong>No books published yet.</strong><a href="books.html">Open Books →</a></div>';return}
    el.innerHTML=data.slice(0,4).map(b=>{
      const cover=safeUrl(b.cover_url), amazon=safeUrl(b.amazon_url), flip=safeUrl(b.flipkart_url), title=esc(b.title||'Recommended book');
      return `<article class="ax-book-mini"><div class="ax-book-cover"><div class="ax-book-fallback" style="display:${cover?'none':'flex'}"><small>${esc(b.category||'Competitive exams')}</small><strong>${title}</strong></div>${cover?`<img src="${esc(cover)}" alt="${title}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`:''}${cover?`<div class="ax-book-fallback" style="display:none"><small>${esc(b.category||'Competitive exams')}</small><strong>${title}</strong></div>`:''}</div><h3>${title}</h3><div class="ax-book-buttons">${amazon?`<a class="ax-amz" href="${esc(amazon)}" target="_blank" rel="sponsored noopener">Amazon</a>`:''}${flip?`<a class="ax-flip" href="${esc(flip)}" target="_blank" rel="sponsored noopener">Flipkart</a>`:''}</div></article>`;
    }).join('');
  }

  function renderFocus(){
    const el=$('focusQuestion'); if(!el)return; const q=state.focus;
    if(!q){el.innerHTML='<div class="ax-empty"><strong>No published practice questions are available.</strong><a href="practice.html">Open Practice →</a></div>';return}
    const options=['A','B','C','D'];
    el.innerHTML=`<div class="ax-focus-meta"><span class="ax-focus-tag">${esc(q.subjects?.name||'Practice')}</span><span class="ax-focus-count">Question of the day</span></div><div class="ax-focus-question">${esc(q.question)}</div><div id="focusOptions">${options.map((l,i)=>`<button type="button" class="ax-focus-option" data-i="${i}"><span>${l}</span>${esc(q['option_'+l.toLowerCase()])}</button>`).join('')}</div><button id="focusSubmit" type="button" class="ax-btn ax-btn-primary ax-focus-submit">Submit Answer</button><div id="focusResult"></div>`;
    document.querySelectorAll('.ax-focus-option').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('.ax-focus-option').forEach(x=>x.classList.remove('selected'));btn.classList.add('selected');state.focusSelected=Number(btn.dataset.i)}));
    $('focusSubmit').addEventListener('click',()=>{const r=$('focusResult');if(state.focusSelected===null||state.focusSelected===undefined){r.className='ax-focus-result bad';r.textContent='Choose an answer first.';return}const correct=String(q.answer||'A').toUpperCase().charCodeAt(0)-65;if(state.focusSelected===correct){r.className='ax-focus-result';r.textContent='Correct. '+String(q.explanation||'Keep going.')}else{r.className='ax-focus-result bad';r.textContent='Not quite. Correct answer: '+String(q.answer||'A')+'. '+String(q.explanation||'Review this topic in Practice.')}});
  }

  async function loadCounts(){
    try{const r=await db.from('questions').select('*',{count:'exact',head:true}).eq('status','published');const n=r.count||0;const txt=n>=1000?(Math.floor(n/1000)+'k+'):String(n);if($('homeQuestionCount'))$('homeQuestionCount').textContent=txt;if($('statQuestions'))$('statQuestions').textContent=txt}catch(_){}
  }
  async function loadJobs(){
    const {data,error}=await db.from('current_jobs_v1').select('id,title,organization,post_name,vacancies,qualification,application_last_date,category,description,official_url,apply_url,featured,updated_at,status').in('status',['open','closing_soon']).order('featured',{ascending:false}).order('application_last_date',{ascending:true,nullsFirst:false}).limit(10);
    if(!error){state.jobs=data||[];renderJobs();const u=(state.jobs||[]).map(x=>x.updated_at).sort().pop();if($('homeJobsUpdated'))$('homeJobsUpdated').textContent=u?`Updated ${new Date(u).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}`:'Auto-updated daily';if($('statJobs'))$('statJobs').textContent=String(state.jobs.length)+' live';if($('heroJobsCount'))$('heroJobsCount').textContent=String(state.jobs.length)+' live'}else if($('homeJobsList'))$('homeJobsList').innerHTML='<div class="ax-empty"><strong>Current jobs are temporarily unavailable.</strong><a href="current-jobs.html">Open Current Jobs →</a></div>';
  }
  async function loadNews(){
    const {data,error}=await db.from('current_affairs_v1').select('id,title,summary,category,published_date,source_name,source_url,image_url,featured').eq('status','published').order('published_date',{ascending:false}).limit(30);
    if(!error){state.news=data||[];renderNews();const newest=(state.news||[]).map(x=>x.published_date).sort().pop();if($('newsUpdatedLabel'))$('newsUpdatedLabel').textContent=newest?`Updated ${new Date(newest).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}`:'Updated'}else if($('homeNewsList'))$('homeNewsList').innerHTML='<div class="ax-empty"><strong>Current Affairs are temporarily unavailable.</strong><a href="current-affairs.html">Open Current Affairs →</a></div>';
  }
  async function loadBooks(){const {data,error}=await db.from('books_v1').select('id,title,author,description,exam_name,category,cover_url,amazon_url,flipkart_url,featured,created_at').eq('status','published').order('featured',{ascending:false}).order('created_at',{ascending:false}).limit(8);if(!error)renderBooks(data||[]);else if($('homeBooksShelf'))$('homeBooksShelf').innerHTML='<div class="ax-empty"><strong>Books are temporarily unavailable.</strong><a href="books.html">Open Books →</a></div>'}
  async function loadFocus(){const {data,error}=await db.from('questions').select('id,question,option_a,option_b,option_c,option_d,answer,explanation,subject_id,subjects(name)').eq('status','published').limit(60);if(!error&&data?.length){state.focus=data[Math.floor(Math.random()*data.length)];renderFocus()}else renderFocus()}
  function initFilters(){document.querySelectorAll('#jobFilters button').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('#jobFilters button').forEach(x=>x.classList.remove('active'));b.classList.add('active');state.jobCat=b.dataset.cat;renderJobs()}));document.querySelectorAll('#newsFilters button').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('#newsFilters button').forEach(x=>x.classList.remove('active'));b.classList.add('active');state.newsCat=b.dataset.cat;renderNews()}));}
  function initMenu(){const b=$('menuBtn'),n=$('mobileNav');if(!b||!n)return;b.addEventListener('click',()=>{const open=n.classList.toggle('open');b.setAttribute('aria-expanded',String(open));n.setAttribute('aria-hidden',String(!open))})}
  function initSearch(){const b=$('homeSearchBtn');if(!b)return;b.addEventListener('click',()=>{const term=window.prompt('Search AxomPrep practice topics or pages:');if(term&&term.trim())window.location.href='practice.html?search='+encodeURIComponent(term.trim())})}
  function initStreak(){const key='axomprep_visit_dates_v1';const today=new Date();const id=today.toISOString().slice(0,10);let arr=[];try{arr=JSON.parse(localStorage.getItem(key)||'[]')}catch(_){arr=[]}if(!arr.includes(id))arr.push(id);arr=arr.slice(-30);try{localStorage.setItem(key,JSON.stringify(arr))}catch(_){}let streak=0;const d=new Date(today);while(true){const s=d.toISOString().slice(0,10);if(arr.includes(s)){streak++;d.setDate(d.getDate()-1)}else break}if($('streakDays'))$('streakDays').textContent=streak;const days=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];const start=new Date(today);const dow=(start.getDay()+6)%7;start.setDate(start.getDate()-dow);let html='';for(let i=0;i<7;i++){const x=new Date(start);x.setDate(start.getDate()+i);const s=x.toISOString().slice(0,10);html+=`<span><i class="${arr.includes(s)?'done':''}">${arr.includes(s)?'✓':''}</i>${days[i]}</span>`}if($('streakWeek'))$('streakWeek').innerHTML=html}
  document.addEventListener('DOMContentLoaded',()=>{initMenu();initFilters();initSearch();initStreak();loadCounts();loadJobs();loadNews();loadBooks();loadFocus()});
})();
