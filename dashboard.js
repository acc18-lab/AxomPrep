const cfg=window.AXOMPREP_CONFIG;
const client=supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey);
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const pct=(c,t)=>t?Math.round(c/t*100):0;
let meta={exams:{},subjects:{},topics:{}};

async function initDashboard(){
  const {data,error}=await client.auth.getUser();
  if(error||!data.user){location.href='index.html#login';return;}
  const user=data.user;
  const [{data:profile},{data:exams},{data:subjects},{data:topics}]=await Promise.all([
    client.from('profiles').select('full_name').eq('id',user.id).maybeSingle(),
    client.from('exams').select('id,name'),
    client.from('subjects').select('id,name'),
    client.from('topics').select('id,name')
  ]);
  (exams||[]).forEach(x=>meta.exams[x.id]=x.name);
  (subjects||[]).forEach(x=>meta.subjects[x.id]=x.name);
  (topics||[]).forEach(x=>meta.topics[x.id]=x.name);
  const name=(profile?.full_name||user.user_metadata?.full_name||user.email?.split('@')[0]||'Aspirant').split(' ')[0];
  $('userName').textContent=name;
  await loadAnalytics(user.id);
}

async function loadAnalytics(userId){
  const [daily,practice,mock]=await Promise.all([
    client.from('daily_quiz_attempts').select('id,quiz_date,score,total_questions,time_taken_seconds,created_at').eq('user_id',userId).order('created_at',{ascending:false}).limit(200),
    client.from('practice_attempts_v1').select('id,exam_id,subject_id,topic_id,total_questions,score,percentage,time_taken_seconds,created_at').eq('user_id',userId).order('created_at',{ascending:false}).limit(200),
    client.from('mock_attempts_v1').select('id,test_code,test_title,exam_name,total_questions,score,time_limit_seconds,time_taken_seconds,completed,created_at,completed_at').eq('user_id',userId).eq('completed',true).order('created_at',{ascending:false}).limit(200)
  ]);
  const d=daily.data||[], p=practice.data||[], m=mock.data||[];
  const errors=[daily.error,practice.error,mock.error].filter(Boolean);
  if(errors.length) console.warn(errors);

  const sources=[
    {type:'Daily Quiz', attempts:d},
    {type:'Practice', attempts:p},
    {type:'Mock Test', attempts:m}
  ];
  const totalAttempts=d.length+p.length+m.length;
  const totalQuestions=d.reduce((n,a)=>n+Number(a.total_questions||0),0)+p.reduce((n,a)=>n+Number(a.total_questions||0),0)+m.reduce((n,a)=>n+Number(a.total_questions||0),0);
  const totalCorrect=d.reduce((n,a)=>n+Number(a.score||0),0)+p.reduce((n,a)=>n+Number(a.score||0),0)+m.reduce((n,a)=>n+Number(a.score||0),0);
  const overall=pct(totalCorrect,totalQuestions);
  const scores=[
    ...d.map(a=>pct(a.score,a.total_questions)),
    ...p.map(a=>Number(a.percentage||0)),
    ...m.map(a=>pct(a.score,a.total_questions))
  ];
  const best=scores.length?Math.max(...scores):0;

  $('statAttempts').textContent=totalAttempts;
  $('statQuestions').textContent=totalQuestions;
  $('statAverage').textContent=overall+'%';
  $('statBest').textContent=best+'%';
  $('streakValue').textContent=calculateStreak([...d.map(x=>x.quiz_date),...p.map(x=>dateKey(x.created_at)),...m.map(x=>dateKey(x.created_at))])+(calculateStreak([...d.map(x=>x.quiz_date),...p.map(x=>dateKey(x.created_at)),...m.map(x=>dateKey(x.created_at))])===1?' day':' days');

  renderSourceBreakdown(sources);
  await renderAnswerAnalytics(userId,d,p,m);
  renderRecent(d,p,m);
}

function dateKey(v){return v?new Date(v).toISOString().slice(0,10):null}

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

function renderSourceBreakdown(sources){
  const box=$('sourceBreakdown');
  const total=sources.reduce((n,s)=>n+s.attempts.length,0);
  if(!total){box.innerHTML='<div class="empty-state">Start a Daily Quiz, Practice session or Mock Test to build your analytics.</div>';return;}
  box.innerHTML=sources.map(s=>{
    const qs=s.attempts.reduce((n,a)=>n+Number(a.total_questions||0),0);
    const correct=s.attempts.reduce((n,a)=>n+Number(a.score||0),0);
    const accuracy=pct(correct,qs);
    return `<div class="subject-row"><div class="subject-label"><b>${esc(s.type)}</b><span>${s.attempts.length} attempts • ${qs} questions</span></div><div class="subject-bar"><i style="width:${accuracy}%"></i></div><strong>${accuracy}%</strong></div>`;
  }).join('');
}

async function renderAnswerAnalytics(userId,d,p,m){
  const ids={
    daily:d.map(x=>x.id),
    practice:p.map(x=>x.id),
    mock:m.map(x=>x.id)
  };
  const [da,pa,ma]=await Promise.all([
    ids.daily.length?client.from('daily_quiz_answers').select('question_id,is_correct,attempt_id').in('attempt_id',ids.daily):Promise.resolve({data:[]}),
    ids.practice.length?client.from('practice_answers_v1').select('question_id,is_correct,attempt_id').in('attempt_id',ids.practice):Promise.resolve({data:[]}),
    ids.mock.length?client.from('mock_answers_v1').select('question_id,is_correct,attempt_id').in('attempt_id',ids.mock):Promise.resolve({data:[]})
  ]);
  const answers=[...(da.data||[]),...(pa.data||[]),...(ma.data||[])];
  const questionIds=[...new Set(answers.map(x=>x.question_id).filter(Boolean))];
  let questions=[];
  if(questionIds.length){
    const {data,error}=await client.from('questions').select('id,subject_id,topic_id,exam_id,year').in('id',questionIds);
    if(error)console.warn(error); else questions=data||[];
  }
  const qm={};questions.forEach(q=>qm[q.id]=q);

  renderGroup('subjectPerformance',answers,qm,'subject_id','subject');
  renderGroup('topicPerformance',answers,qm,'topic_id','topic');
  renderGroup('examPerformance',answers,qm,'exam_id','exam');

  const weak=aggregate(answers,qm,'topic_id').sort((a,b)=>a.pct-b.pct).filter(x=>x.total>=2).slice(0,5);
  $('improveList').innerHTML=weak.length?weak.map((x,i)=>`<div class="improve-item"><span>${i+1}</span><div><b>${esc(x.name)}</b><small>${x.pct}% accuracy • ${x.total} questions</small></div><a href="practice.html">Practice →</a></div>`).join(''):'<div class="empty-state">Take more questions to generate reliable weak-area recommendations.</div>';

  renderTrend(d,p,m);
}

function aggregate(answers,qm,key){
  const g={};
  answers.forEach(a=>{
    const q=qm[a.question_id]; if(!q)return;
    const id=q[key]||'other';
    if(!g[id])g[id]={id,correct:0,total:0};
    g[id].total++;if(a.is_correct)g[id].correct++;
  });
  return Object.values(g).map(x=>({...x,name:key==='subject_id'?(meta.subjects[x.id]||'Other'):key==='topic_id'?(meta.topics[x.id]||'Other'):(meta.exams[x.id]||'Other'),pct:pct(x.correct,x.total)})).filter(x=>x.total);
}

function renderGroup(id,answers,qm,key){
  const box=$(id),items=aggregate(answers,qm,key).sort((a,b)=>b.pct-a.pct);
  if(!items.length){box.innerHTML='<div class="empty-state">Not enough answer data yet.</div>';return;}
  box.innerHTML=items.slice(0,10).map(x=>`<div class="subject-row"><div class="subject-label"><b>${esc(x.name)}</b><span>${x.correct}/${x.total} correct</span></div><div class="subject-bar"><i style="width:${x.pct}%"></i></div><strong>${x.pct}%</strong></div>`).join('');
}

function renderTrend(d,p,m){
  const buckets={};
  const add=(arr,type)=>arr.forEach(a=>{
    const day=dateKey(a.created_at||a.quiz_date);if(!day)return;
    if(!buckets[day])buckets[day]={attempts:0,correct:0,total:0};
    buckets[day].attempts++;buckets[day].correct+=Number(a.score||0);buckets[day].total+=Number(a.total_questions||0);
  });
  add(d,'Daily');add(p,'Practice');add(m,'Mock');
  const days=Object.keys(buckets).sort().slice(-14);
  const box=$('trendList');
  if(!days.length){box.innerHTML='<div class="empty-state">Your accuracy trend will appear after you start practicing.</div>';return;}
  box.innerHTML=days.map(day=>{
    const b=buckets[day],v=pct(b.correct,b.total);
    const label=new Date(day+'T00:00:00').toLocaleDateString('en-IN',{day:'2-digit',month:'short'});
    return `<div class="trend-row"><span>${label}</span><div class="trend-bar"><i style="width:${v}%"></i></div><b>${v}%</b></div>`;
  }).join('');
}

function renderRecent(d,p,m){
  const rows=[
    ...d.map(a=>({date:a.quiz_date||a.created_at,type:'Daily Quiz',title:'Daily Quiz',score:a.score,total:a.total_questions,time:a.time_taken_seconds})),
    ...p.map(a=>({date:a.created_at,type:'Practice',title:'Practice Session',score:a.score,total:a.total_questions,time:a.time_taken_seconds})),
    ...m.map(a=>({date:a.completed_at||a.created_at,type:'Mock Test',title:a.test_title||'Mock Test',score:a.score,total:a.total_questions,time:a.time_taken_seconds}))
  ].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,12);
  $('attemptRows').innerHTML=rows.length?rows.map(a=>{
    const pp=pct(a.score,a.total),sec=Number(a.time||0),time=`${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}`,date=new Date(a.date+(String(a.date).length<=10?'T00:00:00':'')).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});
    return `<tr><td>${esc(date)}</td><td>${esc(a.type)}</td><td>${esc(a.title)}</td><td><strong>${a.score}/${a.total}</strong></td><td><span class="score-pill ${pp>=70?'good':pp>=40?'mid':'low'}">${pp}%</span></td><td>${time}</td></tr>`;
  }).join(''):'<tr><td colspan="6" class="empty-cell">No attempts yet. Start practicing to build your performance history.</td></tr>';
}

$('homeBtn').onclick=()=>location.href='index.html';
$('logoutBtn').onclick=async()=>{await client.auth.signOut();location.href='index.html';};
$('menuBtn').onclick=()=>document.querySelector('nav')?.classList.toggle('mobile-show');
initDashboard();