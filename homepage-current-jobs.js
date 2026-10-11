(function(){
 'use strict';
 const grid=document.getElementById('homeJobsGrid');
 if(!grid)return;
 const meta=document.getElementById('homeJobsUpdated');
 const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
 const days=d=>{if(!d)return null;const n=Math.ceil((new Date(d+'T23:59:59')-new Date())/86400000);return Number.isFinite(n)?n:null};
 let tries=0;
 function showError(){grid.innerHTML='<div class="rounded-xl border border-slate-100 p-4 text-sm text-slate-500">Job alerts are temporarily unavailable. <a class="font-semibold text-blue-700 underline" href="current-jobs.html">Browse all jobs</a>.</div>';}
 function card(j){const n=days(j.application_last_date);const tag=n===null?'Check notice':n<0?'Closed':n===0?'Last day today':n+' days left';return `<a href="job.html?id=${encodeURIComponent(j.id)}" class="home-job-card group block border border-slate-100 rounded-xl p-4 hover:border-blue-200 hover:shadow-sm transition-all bg-white"><div class="home-job-top flex justify-between items-start gap-2 mb-2"><span class="home-job-pill bg-orange-50 text-orange-700 text-xs font-bold px-2 py-1 rounded">${esc(j.organization||j.category||'Recruitment')}</span><span class="text-xs text-slate-400 whitespace-nowrap">${esc(tag)}</span></div><h3 class="font-semibold text-slate-800 group-hover:text-blue-700 text-sm leading-tight mb-1">${esc(j.title||'Recruitment notification')}</h3><p class="text-xs text-slate-500">${esc(j.vacancies||'Vacancies as notified')} • ${esc(j.qualification||'Eligibility in notification')}</p><p class="text-xs text-slate-400 mt-1">Last date: ${esc(j.application_last_date||'Check official notice')}</p><span class="inline-block mt-3 text-xs font-bold text-blue-700">View details →</span></a>`;}
 async function init(){
   const cfg=window.AXOMPREP_CONFIG;
   if(!cfg||!cfg.supabaseUrl||!cfg.supabasePublishableKey||!window.supabase||!window.supabase.createClient){
     if(tries++<40){setTimeout(init,250);return;} showError();return;
   }
   try{
     const db=window.AXOMPREP_AUTH_CLIENT||window.supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey);
     const {data,error}=await db.from('current_jobs_v1').select('id,title,organization,vacancies,qualification,application_last_date,category,featured,updated_at,status').in('status',['open','closing_soon']).order('featured',{ascending:false}).order('application_last_date',{ascending:true,nullsFirst:false}).limit(3);
     if(error)throw error;
     if(!Array.isArray(data)||!data.length){grid.innerHTML='<div class="rounded-xl border border-slate-100 p-4 text-sm text-slate-500">No active job alerts right now. <a class="font-semibold text-blue-700 underline" href="current-jobs.html">See all listings</a>.</div>';return;}
     grid.innerHTML=data.map(card).join('');
     if(meta){const latest=data.map(x=>x.updated_at||'').sort().pop();meta.textContent=latest?'Updated '+new Date(latest).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}):'Updated from current job listings';}
   }catch(e){console.error('AxomPrep homepage job alerts:',e);showError();}
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
