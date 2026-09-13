const cfg=window.AXOMPREP_CONFIG;
const client=supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey);
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));

async function initDashboard(){
  const {data,error}=await client.auth.getUser();
  if(error||!data.user){location.href='index.html#login';return;}
  const user=data.user;
  const {data:profile}=await client.from('profiles').select('full_name').eq('id',user.id).maybeSingle();
  const name=(profile?.full_name||user.user_metadata?.full_name||user.email?.split('@')[0]||'Aspirant').split(' ')[0];
  $('userName').textContent=name;
  await loadDashboard(user.id);
}

async function loadDashboard(userId){
  const {data:attempts,error}=await client.from('daily_quiz_attempts').select('id,quiz_date,score,total_questions,time_taken_seconds,created_at').eq('user_id',userId).order('quiz_date',{ascending:false}).limit(100);
  if(error){console.error(error);showError('Unable to load your dashboard right now.');return;}
  const list=attempts||[];
  const totalQuestions=list.reduce((n,a)=>n+Number(a.total_questions||0),0);
  const percentages=list.map(a=>Number(a.total_questions)?Math.round(Number(a.score||0)/Number(a.total_questions)*100):0);
  const avg=list.length?Math.round(percentages.reduce((a,b)=>a+b,0)/list.length):0;
  const best=list.length?Math.max(...percentages):0;
  $('statAttempts').textContent=list.length;
  $('statQuestions').textContent=totalQuestions;
  $('statAverage').textContent=avg+'%';
  $('statBest').textContent=best+'%';
  const streak=calculateStreak(list.map(a=>a.quiz_date));
  $('streakValue').textContent=streak+(streak===1?' day':' days');
  renderAttempts(list);
  await renderSubjects(list);
}

function calculateStreak(dates){
  const unique=[...new Set(dates.filter(Boolean))].sort((a,b)=>b.localeCompare(a));
  if(!unique.length)return 0;
  const today=new Date();today.setHours(0,0,0,0);
  const first=new Date(unique[0]+'T00:00:00');
  const diff=Math.round((today-first)/86400000);
  if(diff>1)return 0;
  let streak=1;
  for(let i=1;i<unique.length;i++){
    const prev=new Date(unique[i-1]+'T00:00:00');
    const cur=new Date(unique[i]+'T00:00:00');
    if(Math.round((prev-cur)/86400000)===1)streak++;else break;
  }
  return streak;
}

function renderAttempts(list){
  const rows=$('attemptRows');
  if(!list.length){rows.innerHTML='<tr><td colspan="4" class="empty-cell">No Daily Quiz attempts yet. Take your first quiz to start tracking progress.</td></tr>';return;}
  rows.innerHTML=list.slice(0,10).map(a=>{
    const total=Number(a.total_questions||0),score=Number(a.score||0),pct=total?Math.round(score/total*100):0;
    const date=new Date((a.quiz_date||a.created_at)+'T00:00:00');
    const label=date.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});
    const sec=Number(a.time_taken_seconds||0),time=`${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}`;
    return `<tr><td>${esc(label)}</td><td><strong>${score}/${total}</strong></td><td><span class="score-pill ${pct>=70?'good':pct>=40?'mid':'low'}">${pct}%</span></td><td>${time}</td></tr>`;
  }).join('');
}

async function renderSubjects(attempts){
  const ids=attempts.map(a=>a.id);
  const box=$('subjectPerformance');
  const improve=$('improveList');
  if(!ids.length){box.innerHTML='<div class="empty-state">Complete a Daily Quiz to see subject-wise accuracy.</div>';improve.innerHTML='<div class="empty-state">Your improvement suggestions will appear after your first quiz.</div>';return;}
  const {data,error}=await client.from('daily_quiz_answers').select('is_correct,question_id,questions(subjects(name))').in('attempt_id',ids);
  if(error){console.error(error);box.innerHTML='<div class="empty-state">Subject analytics will appear after more quiz data is available.</div>';improve.innerHTML='<div class="empty-state">Keep taking Daily Quizzes to build your analytics.</div>';return;}
  const groups={};
  (data||[]).forEach(row=>{
    const subject=row.questions?.subjects?.name||'Other';
    if(!groups[subject])groups[subject]={correct:0,total:0};
    groups[subject].total++;
    if(row.is_correct)groups[subject].correct++;
  });
  const items=Object.entries(groups).map(([name,v])=>({name,...v,pct:Math.round(v.correct/v.total*100)})).sort((a,b)=>b.pct-a.pct);
  if(!items.length){box.innerHTML='<div class="empty-state">No subject data available yet.</div>';improve.innerHTML='<div class="empty-state">No improvement data available yet.</div>';return;}
  box.innerHTML=items.map(x=>`<div class="subject-row"><div class="subject-label"><b>${esc(x.name)}</b><span>${x.correct}/${x.total} correct</span></div><div class="subject-bar"><i style="width:${x.pct}%"></i></div><strong>${x.pct}%</strong></div>`).join('');
  const weak=[...items].sort((a,b)=>a.pct-b.pct).slice(0,3);
  improve.innerHTML=weak.map((x,i)=>`<div class="improve-item"><span>${i+1}</span><div><b>${esc(x.name)}</b><small>${x.pct}% accuracy • ${x.total} questions</small></div><a href="index.html#practice">Practice →</a></div>`).join('');
}

function showError(message){$('subjectPerformance').innerHTML=`<div class="empty-state">${esc(message)}</div>`;$('improveList').innerHTML='<div class="empty-state">Please refresh and try again.</div>';}
$('homeBtn').onclick=()=>location.href='index.html#home';
$('logoutBtn').onclick=async()=>{await client.auth.signOut();location.href='index.html';};
$('menuBtn').onclick=()=>document.querySelector('nav')?.classList.toggle('mobile-show');
initDashboard();
