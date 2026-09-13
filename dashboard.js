const cfg=window.AXOMPREP_CONFIG;
const client=supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey);
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));

async function initDashboard(){
 const {data,error}=await client.auth.getUser(); if(error||!data.user){location.href='index.html#login';return;}
 const user=data.user; const {data:profile}=await client.from('profiles').select('full_name').eq('id',user.id).maybeSingle();
 $('userName').textContent=(profile?.full_name||user.user_metadata?.full_name||user.email?.split('@')[0]||'Aspirant').split(' ')[0];
 await loadDashboard(user.id);
}
async function loadDashboard(userId){
 const [dailyRes,mockRes]=await Promise.all([
  client.from('daily_quiz_attempts').select('id,quiz_date,score,total_questions,time_taken_seconds,created_at').eq('user_id',userId).order('quiz_date',{ascending:false}).limit(100),
  client.from('mock_attempts_v1').select('id,test_title,exam_name,score,total_questions,time_taken_seconds,created_at,completed').eq('user_id',userId).eq('completed',true).order('created_at',{ascending:false}).limit(100)
 ]);
 if(dailyRes.error){console.error(dailyRes.error);showError('Unable to load your dashboard right now.');return;}
 const daily=dailyRes.data||[], mocks=mockRes.error?[]:(mockRes.data||[]);
 const dailyPct=daily.map(a=>pct(a.score,a.total_questions)); const mockPct=mocks.map(a=>pct(a.score,a.total_questions));
 const allPct=dailyPct.concat(mockPct);
 $('statAttempts').textContent=daily.length; $('statMockAttempts').textContent=mocks.length;
 $('statQuestions').textContent=daily.reduce((n,a)=>n+Number(a.total_questions||0),0)+mocks.reduce((n,a)=>n+Number(a.total_questions||0),0);
 $('statAverage').textContent=(allPct.length?Math.round(allPct.reduce((a,b)=>a+b,0)/allPct.length):0)+'%'; $('statBest').textContent=(allPct.length?Math.max(...allPct):0)+'%';
 $('streakValue').textContent=calculateStreak(daily.map(a=>a.quiz_date))+(calculateStreak(daily.map(a=>a.quiz_date))===1?' day':' days');
 renderAttempts(daily); renderMockAttempts(mocks); await renderSubjects(daily,mocks);
}
function pct(score,total){return Number(total)?Math.round(Number(score||0)/Number(total)*100):0;}
function calculateStreak(dates){const unique=[...new Set(dates.filter(Boolean))].sort((a,b)=>b.localeCompare(a));if(!unique.length)return 0;const today=new Date();today.setHours(0,0,0,0);const first=new Date(unique[0]+'T00:00:00');if(Math.round((today-first)/86400000)>1)return 0;let s=1;for(let i=1;i<unique.length;i++){const prev=new Date(unique[i-1]+'T00:00:00'),cur=new Date(unique[i]+'T00:00:00');if(Math.round((prev-cur)/86400000)===1)s++;else break;}return s;}
function renderAttempts(list){const rows=$('attemptRows');if(!list.length){rows.innerHTML='<tr><td colspan="4" class="empty-cell">No Daily Quiz attempts yet.</td></tr>';return;}rows.innerHTML=list.slice(0,10).map(a=>{const p=pct(a.score,a.total_questions),d=new Date((a.quiz_date||a.created_at)+'T00:00:00'),sec=Number(a.time_taken_seconds||0);return `<tr><td>${esc(d.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}))}</td><td><strong>${a.score}/${a.total_questions}</strong></td><td><span class="score-pill ${p>=70?'good':p>=40?'mid':'low'}">${p}%</span></td><td>${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}</td></tr>`;}).join('');}
function renderMockAttempts(list){const rows=$('mockAttemptRows');if(!rows)return;if(!list.length){rows.innerHTML='<tr><td colspan="5" class="empty-cell">No completed Mock Tests yet. Take your first mock to start tracking performance.</td></tr>';return;}rows.innerHTML=list.slice(0,10).map(a=>{const p=pct(a.score,a.total_questions),d=new Date(a.created_at),sec=Number(a.time_taken_seconds||0);return `<tr><td>${esc(a.test_title)}</td><td>${esc(d.toLocaleDateString('en-IN',{day:'2-digit',month:'short'}))}</td><td><strong>${a.score}/${a.total_questions}</strong></td><td><span class="score-pill ${p>=70?'good':p>=40?'mid':'low'}">${p}%</span></td><td>${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}</td></tr>`;}).join('');}
async function renderSubjects(daily,mocks){
 const ids=daily.map(a=>a.id),mockIds=mocks.map(a=>a.id),box=$('subjectPerformance'),improve=$('improveList');
 const groups={};
 if(ids.length){const {data}=await client.from('daily_quiz_answers').select('is_correct,question_id,questions(subjects(name))').in('attempt_id',ids);(data||[]).forEach(row=>addSubject(groups,row.questions?.subjects?.name,row.is_correct));}
 if(mockIds.length){const {data}=await client.from('mock_answers_v1').select('is_correct,question_id,questions(subjects(name))').in('attempt_id',mockIds);(data||[]).forEach(row=>addSubject(groups,row.questions?.subjects?.name,row.is_correct));}
 const items=Object.entries(groups).map(([name,v])=>({name,...v,pct:Math.round(v.correct/v.total*100)})).sort((a,b)=>b.pct-a.pct);
 if(!items.length){box.innerHTML='<div class="empty-state">Complete a Daily Quiz or Mock Test to see subject-wise accuracy.</div>';improve.innerHTML='<div class="empty-state">Your improvement suggestions will appear after your first test.</div>';return;}
 box.innerHTML=items.map(x=>`<div class="subject-row"><div class="subject-label"><b>${esc(x.name)}</b><span>${x.correct}/${x.total} correct</span></div><div class="subject-bar"><i style="width:${x.pct}%"></i></div><strong>${x.pct}%</strong></div>`).join('');
 improve.innerHTML=[...items].sort((a,b)=>a.pct-b.pct).slice(0,3).map((x,i)=>`<div class="improve-item"><span>${i+1}</span><div><b>${esc(x.name)}</b><small>${x.pct}% accuracy • ${x.total} questions</small></div><a href="index.html#practice">Practice →</a></div>`).join('');
}
function addSubject(groups,name,correct){name=name||'Other';if(!groups[name])groups[name]={correct:0,total:0};groups[name].total++;if(correct)groups[name].correct++;}
function showError(message){$('subjectPerformance').innerHTML=`<div class="empty-state">${esc(message)}</div>`;$('improveList').innerHTML='<div class="empty-state">Please refresh and try again.</div>';}
$('homeBtn').onclick=()=>location.href='index.html#home';$('logoutBtn').onclick=async()=>{await client.auth.signOut();location.href='index.html';};$('menuBtn').onclick=()=>document.querySelector('nav')?.classList.toggle('mobile-show');initDashboard();
