(function(){
  const cfg=window.AXOMPREP_CONFIG;
  if(!cfg||!window.supabase) return;
  const db=window.supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey);
  const grid=document.getElementById('jobsGrid');
  const search=document.getElementById('jobSearch');
  const category=document.getElementById('jobCategory');
  const qualification=document.getElementById('jobQualification');
  const closing=document.getElementById('closingSoon');
  const resultCount=document.getElementById('jobResultCount');
  const updateTime=document.getElementById('jobUpdateTime');
  const clearBtn=document.getElementById('jobClear');
  const state={items:[]};
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const safeUrl=u=>{try{const x=new URL(String(u||''),location.href);return /^https?:$/.test(x.protocol)?x.href:''}catch(_){return ''}};
  function daysLeft(d){if(!d)return null;const end=new Date(d+'T23:59:59');const diff=end-new Date();return Math.ceil(diff/86400000)}
  function statusFor(j){const n=daysLeft(j.application_last_date);if(n===null)return {cls:'',label:'Open'};if(n<0)return {cls:'red',label:'Closed'};if(n<=3)return {cls:'red',label:'Closing soon'};return {cls:'orange',label:'Open'}}
  function card(j){
    const st=statusFor(j), n=daysLeft(j.application_last_date);
    const apply=safeUrl(j.apply_url), official=safeUrl(j.official_url), source=safeUrl(j.source_url);
    return `<article class="cj-card"><div class="cj-top"><div class="cj-badges"><span class="cj-pill">${esc(j.category||'Current Jobs')}</span><span class="cj-pill ${st.cls}">${st.label}</span>${j.featured?'<span class="cj-pill">Featured</span>':''}</div></div><h2>${esc(j.title)}</h2><div class="cj-org">${esc(j.organization||'Organization not specified')}</div><p class="cj-summary">${esc(j.description||'Check the official notification for complete details and eligibility.')}</p><div class="cj-info"><div><span>Vacancies</span><b>${esc(j.vacancies||'—')}</b></div><div><span>Qualification</span><b>${esc((j.qualification||'See notification').slice(0,90))}</b></div><div><span>Location</span><b>${esc(j.location||'India')}</b></div><div><span>Last date</span><b>${esc(j.application_last_date||'Not specified')}</b></div></div><div class="cj-deadline"><strong>${n===null?'Check notification':n<0?'Applications closed':n===0?'Last date: today':`${n} day${n===1?'':'s'} left`}</strong>${j.post_name?`<span class="days">${esc(j.post_name)}</span>`:''}</div><div class="cj-actions">${apply?`<a class="cj-apply" href="${esc(apply)}" target="_blank" rel="noopener noreferrer">Apply / Portal ↗</a>`:''}${official?`<a class="cj-official" href="${esc(official)}" target="_blank" rel="noopener noreferrer">Official site ↗</a>`:''}${source?`<a class="cj-source" href="${esc(source)}" target="_blank" rel="noopener noreferrer">Details ↗</a>`:''}</div></article>`;
  }
  function render(){
    const q=String(search?.value||'').trim().toLowerCase();
    const cat=category?.value||'all';
    const qual=qualification?.value||'all';
    const onlyClosing=!!closing?.checked;
    const filtered=state.items.filter(j=>{
      const hay=[j.title,j.organization,j.post_name,j.category,j.qualification,j.location,j.vacancies].join(' ').toLowerCase();
      const qok=!q||hay.includes(q);
      const cok=cat==='all'||j.category===cat;
      const qlok=qual==='all'||String(j.qualification||'').toLowerCase().includes(qual.toLowerCase());
      const n=daysLeft(j.application_last_date); const lok=!onlyClosing||(n!==null&&n>=0&&n<=7);
      return qok&&cok&&qlok&&lok;
    }).sort((a,b)=>{const da=a.application_last_date||'9999-12-31',db=b.application_last_date||'9999-12-31';return da.localeCompare(db)});
    if(resultCount)resultCount.textContent=`${filtered.length} job${filtered.length===1?'':'s'} found`;
    grid.innerHTML=filtered.length?filtered.map(card).join(''):`<div class="cj-empty"><strong>No jobs match your filters.</strong><span>Try clearing a filter or searching another qualification.</span></div>`;
  }
  async function load(){
    grid.innerHTML='<div class="cj-loading">Loading current jobs…</div>';
    const {data,error}=await db.from('current_jobs_v1').select('*').in('status',['open','closing_soon','closed']).order('application_last_date',{ascending:true,nullsFirst:false}).order('featured',{ascending:false}).limit(200);
    if(error){console.error(error);grid.innerHTML='<div class="cj-empty"><strong>Current jobs could not be loaded.</strong><span>Please try again later.</span></div>';return;}
    state.items=data||[];
    const cats=[...new Set(state.items.map(x=>x.category).filter(Boolean))].sort();
    if(category)category.innerHTML='<option value="all">All categories</option>'+cats.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');
    if(updateTime){const latest=state.items.reduce((m,x)=>x.updated_at>m?x.updated_at:m,'');updateTime.textContent=latest?`Updated ${new Date(latest).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'})}`:'Auto-updated daily';}
    render();
  }
  [search,category,qualification,closing].forEach(el=>el&&el.addEventListener(el.type==='checkbox'?'change':'input',render));
  clearBtn&&clearBtn.addEventListener('click',()=>{search.value='';category.value='all';qualification.value='all';closing.checked=false;render()});
  document.addEventListener('DOMContentLoaded',load);
})();
