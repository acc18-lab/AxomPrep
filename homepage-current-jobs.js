(function(){
 'use strict';
 const grid=document.getElementById('homeJobsGrid');
 if(!grid)return;
 const meta=document.getElementById('homeJobsUpdated');
 const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
 const days=d=>{if(!d)return null;const n=Math.ceil((new Date(d+'T23:59:59')-new Date())/86400000);return Number.isFinite(n)?n:null};
 let tries=0;
 function showError(){grid.innerHTML='<div class="rounded-xl border border-slate-100 p-4 text-sm text-slate-500">Job alerts are temporarily unavailable. <a class="font-semibold text-blue-700 underline" href="current-jobs.html">Browse all jobs</a>.</div>';}
 function card(j){const n=days(j.application_last_date);const tag=n===null?'Check notice':n<0?'Closed':n===0?'Last day today':n+' days left';const last=j.application_last_date?new Date(j.application_last_date+'T00:00:00').toLocaleDateString('en-CA'):'Check notice';return `<a href="job.html?id=${encodeURIComponent(j.id)}" class="home-job-card group block border border-slate-100 rounded-xl p-3 hover:border-blue-200 hover:shadow-sm transition-all bg-white"><div class="home-job-top flex justify-between items-start gap-2 mb-1.5"><span class="home-job-pill bg-orange-50 text-orange-700 text-[10px] font-bold px-2 py-1 rounded line-clamp-1">${esc(j.organization||j.category||'Recruitment')}</span><span class="text-[10px] text-slate-400 whitespace-nowrap">${esc(tag)}</span></div><h3 class="font-semibold text-slate-800 group-hover:text-blue-700 text-sm leading-snug line-clamp-2 mb-1">${esc(j.title||'Recruitment notification')}</h3><div class="flex items-center justify-between gap-2 text-[11px] text-slate-500"><span>${esc(j.vacancies||'Vacancies as notified')}</span><span class="whitespace-nowrap">Last date: ${esc(last)}</span></div><span class="inline-block mt-2 text-xs font-bold text-blue-700">View details →</span></a>`;}
 async function init(){
   const cfg=window.AXOMPREP_CONFIG;
   if(!cfg||!cfg.supabaseUrl||!cfg.supabasePublishableKey||!window.supabase||!window.supabase.createClient){
     if(tries++<40){setTimeout(init,250);return;} showError();return;
   }
   try{
     const db=window.AXOMPREP_AUTH_CLIENT||window.supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey);
     const {data,error}=await db.from('current_jobs_v1').select('id,title,organization,vacancies,qualification,application_last_date,posted_date,category,featured,updated_at,status').in('status',['open','closing_soon']).order('posted_date',{ascending:false,nullsFirst:false}).order('featured',{ascending:false}).limit(3);
     if(error)throw error;
     if(!Array.isArray(data)||!data.length){grid.innerHTML='<div class="rounded-xl border border-slate-100 p-4 text-sm text-slate-500">No active job alerts right now. <a class="font-semibold text-blue-700 underline" href="current-jobs.html">See all listings</a>.</div>';return;}
     grid.innerHTML=data.map(card).join('');
     if(meta){const latest=data.map(x=>x.posted_date||x.updated_at||'').sort().pop();meta.textContent=latest?'Latest listings updated '+new Date(latest).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}):'Updated from current job listings';}
   }catch(e){console.error('AxomPrep homepage job alerts:',e);showError();}
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
