(function(){
 'use strict';
 const grid=document.getElementById('homeJobsGrid');
 if(!grid)return;
 const meta=document.getElementById('homeJobsUpdated');
 const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
 const days=d=>{if(!d)return null;const n=Math.ceil((new Date(d+'T23:59:59')-new Date())/86400000);return Number.isFinite(n)?n:null};
 let tries=0;
 function showError(){grid.innerHTML='<div class="rounded-xl border border-slate-100 p-4 text-sm text-slate-500">Job alerts are temporarily unavailable. <a class="font-semibold text-blue-700 underline" href="current-jobs.html">Browse all jobs</a>.</div>';}
 function card(j){const n=days(j.application_last_date);const tag=n===null?'Check notice':n<0?'Closed':n===0?'Last day today':n+' days left';const last=j.application_last_date?new Date(j.application_last_date+'T00:00:00').toLocaleDateString('en-CA'):'Check notice';return `<a href="job.html?id=${encodeURIComponent(j.id)}" class="home-job-card group block border border-slate-100 rounded-xl p-3 hover:border-blue-200 hover:shadow-sm transition-all bg-white"><div class="home-job-top flex justify-between items-start gap-2 mb-1.5"><span class="home-job-pill bg-orange-50 text-orange-700 text-[10px] font-bold px-2 py-1 rounded line-clamp-1">${esc(j.organization||j.category||'Recruitment')}</span><span class="text-[10px] text-slate-400 whitespace-nowrap">${esc(tag)}</span></div><h3 class="font-semibold text-slate-800 group-hover:text-blue-700 text-sm leading-snug line-clamp-2 mb-1">${esc(j.title||'Recruitment notification')}</h3><div class="flex items-center justify-end gap-2 text-[11px] text-slate-500"><span class="whitespace-nowrap">Last date: ${esc(last)}</span></div><span class="inline-block mt-2 text-xs font-bold text-blue-700">View details →</span></a>`;}
 async function init(){
   const cfg=window.AXOMPREP_CONFIG;
   if(!cfg||!cfg.supabaseUrl||!cfg.supabasePublishableKey||!window.supabase||!window.supabase.createClient){
     if(tries++<40){setTimeout(init,250);return;} showError();return;
   }
   try{
     const db=window.AXOMPREP_AUTH_CLIENT||window.supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey);
     const {data,error}=await db.from('current_jobs_v1').select('id,title,organization,vacancies,qualification,application_last_date,posted_date,category,featured,updated_at,last_verified,status').in('status',['open','closing_soon']).order('posted_date',{ascending:false,nullsFirst:false}).order('featured',{ascending:false}).limit(3);
     if(error)throw error;
     if(!Array.isArray(data)||!data.length){grid.innerHTML='<div class="rounded-xl border border-slate-100 p-4 text-sm text-slate-500">No active job alerts right now. <a class="font-semibold text-blue-700 underline" href="current-jobs.html">See all listings</a>.</div>';return;}
     grid.innerHTML=data.map(card).join('');
     if(meta){
       let stamp=null;
       try {
         const {data:syncRows}=await db.from('current_jobs_v1').select('last_verified').not('last_verified','is',null).order('last_verified',{ascending:false}).limit(1);
         stamp=syncRows&&syncRows[0]&&syncRows[0].last_verified;
       } catch (_) {}
       if(!stamp) stamp=data.map(x=>x.last_verified||'').filter(Boolean).sort().pop()||null;
       meta.textContent=stamp?'Last updated: '+new Date(stamp).toLocaleString('en-IN',{day:'numeric',month:'short',year:'numeric',hour:'numeric',minute:'2-digit'}):'Last updated time unavailable';
     }
   }catch(e){console.error('AxomPrep homepage job alerts:',e);showError();}
 }
 async function loadCurrentAffairs(attempt=0){
   const list=document.getElementById('homeCurrentAffairsList'); if(!list)return;
   const cfg=window.AXOMPREP_CONFIG;
   if(!cfg||!cfg.supabaseUrl||!cfg.supabasePublishableKey||!window.supabase||!window.supabase.createClient){if(attempt<40){setTimeout(()=>loadCurrentAffairs(attempt+1),250);return;}list.innerHTML='<div class="p-5 text-sm text-slate-500">Current affairs are temporarily unavailable. <a class="text-blue-700 underline" href="current-affairs.html">Read all</a>.</div>';return;}
   try{
     const db=window.AXOMPREP_AUTH_CLIENT||window.supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey);
     const {data,error}=await db.from('current_affairs_v1').select('title,category,published_date,source_url').eq('status','published').order('published_date',{ascending:false,nullsFirst:false}).limit(3);
     if(error)throw error;
     if(!data||!data.length){list.innerHTML='<div class="p-5 text-sm text-slate-500">No published current affairs yet. <a class="text-blue-700 underline" href="current-affairs.html">Read all</a>.</div>';return;}
     const colors=[['bg-green-50','border-green-100','text-axom-green'],['bg-blue-50','border-blue-100','text-axom-blue'],['bg-orange-50','border-orange-100','text-orange-500']];
     list.innerHTML=data.map((n,i)=>{
       const d=n.published_date?new Date(n.published_date+'T00:00:00'):null;
       const valid=d&&!Number.isNaN(d.getTime());
       const month=valid?d.toLocaleDateString('en-IN',{month:'short'}).toUpperCase():'';
       const day=valid?d.toLocaleDateString('en-IN',{day:'2-digit'}):'';
       const c=colors[i%colors.length];
       const href=/^https?:\/\//i.test(n.source_url||'')?n.source_url:'current-affairs.html';
       return `<a href="${esc(href)}" ${href.startsWith('http')?'target="_blank" rel="noopener noreferrer"':''} class="p-5 flex gap-4 hover:bg-slate-50 transition-colors group"><div class="w-12 h-12 rounded-lg ${c[0]} flex-shrink-0 flex flex-col items-center justify-center border ${c[1]} ${c[2]}"><span class="text-xs font-bold">${esc(month)}</span><span class="text-lg font-black leading-none">${esc(day)}</span></div><div class="min-w-0"><h3 class="font-semibold text-slate-800 text-sm mb-1 group-hover:text-axom-blue transition-colors line-clamp-2">${esc(n.title||'Current affairs update')}</h3><p class="text-xs text-slate-500">${esc(n.category||'Current Affairs')}</p></div></a>`;
     }).join('');
   }catch(e){console.error('AxomPrep homepage current affairs:',e);list.innerHTML='<div class="p-5 text-sm text-slate-500">Current affairs are temporarily unavailable. <a class="text-blue-700 underline" href="current-affairs.html">Read all</a>.</div>';}
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{init();loadCurrentAffairs();},{once:true});else {init();loadCurrentAffairs();}
})();
