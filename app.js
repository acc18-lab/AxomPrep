const cfg=window.AXOMPREP_CONFIG;
const client=supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey);
let quizQuestions=[],quizIndex=0,quizScore=0,quizAnswers=[],quizTimer=null,quizSeconds=600,quizStartedAt=null,quizSubmitted=false,isSignup=false;

const $=id=>document.getElementById(id);
function openAuth(signup=false){isSignup=signup;$('authModal').classList.remove('hidden');$('tabLogin').classList.toggle('active',!signup);$('tabSignup').classList.toggle('active',signup);$('nameWrap').classList.toggle('hidden',!signup);$('authSubmit').textContent=signup?'Create account':'Login';$('authMsg').textContent=''}
function closeModal(){$('authModal').classList.add('hidden')}
function requireLogin(){openAuth(false)}
$('loginBtn').onclick=()=>openAuth(false);$('signupBtn').onclick=()=>openAuth(true);
$('tabLogin').onclick=()=>openAuth(false);$('tabSignup').onclick=()=>openAuth(true);
$('authForm').onsubmit=async e=>{e.preventDefault();const email=$('email').value,password=$('password').value,name=$('fullName').value;let r=isSignup?await client.auth.signUp({email,password,options:{data:{full_name:name}}}):await client.auth.signInWithPassword({email,password});if(r.error){$('authMsg').textContent=r.error.message;return}$('authMsg').textContent=isSignup?'Account created. Check your email if confirmation is enabled.':'Logged in.';const returnTo=sessionStorage.getItem('axomprep_admin_return');if(!isSignup&&returnTo){sessionStorage.removeItem('axomprep_admin_return');setTimeout(()=>location.href=returnTo,400);return}setTimeout(closeModal,900);updateAuthUI()};
async function updateAuthUI(){const {data}=await client.auth.getUser();if(data.user){$('loginBtn').textContent='Dashboard';$('loginBtn').onclick=()=>location.hash='dashboard';$('signupBtn').textContent='Logout';$('signupBtn').onclick=async()=>{await client.auth.signOut();location.reload()}}}

async function loadPractice(subject){location.hash='practice';const panel=$('practicePanel');panel.classList.remove('hidden');panel.innerHTML='<div class="loading">Loading questions…</div>';const {data,error}=await client.from('questions').select('id,question,option_a,option_b,option_c,option_d,answer,explanation').eq('status','published').eq('subject_id',(await getSubjectId(subject))).limit(10);if(error||!data?.length){panel.innerHTML='<div class="loading">No published questions are available for this subject yet. Add questions from the admin workflow.</div>';return}panel.innerHTML='<h3>'+subject+' Practice</h3>'+data.map((q,i)=>questionHtml(q,i)).join('')}
async function getSubjectId(name){const {data}=await client.from('subjects').select('id').eq('name',name).maybeSingle();return data?.id||''}
function questionHtml(q,i){return `<div class="question"><h3>${i+1}. ${escapeHtml(q.question)}</h3><div class="options">${[['A',q.option_a],['B',q.option_b],['C',q.option_c],['D',q.option_d]].map(([l,t])=>`<button class="option" onclick="checkOption(this,'${q.answer}','${l}')"><b>${l}.</b> ${escapeHtml(t)}</button>`).join('')}</div><div class="explanation hidden"><b>Explanation:</b> ${escapeHtml(q.explanation||'No explanation added yet.')}</div></div>`}
function checkOption(el,correct,chosen){const box=el.parentElement;[...box.children].forEach(x=>x.disabled=true);el.classList.add(chosen===correct?'correct':'wrong');if(chosen!==correct)[...box.children].find(x=>x.textContent.trim().startsWith(correct+'.'))?.classList.add('correct');el.parentElement.nextElementSibling?.classList.remove('hidden')}

/* =========================
   DAILY QUIZ ENGINE
========================= */

async function startQuiz(){
  location.hash='quiz';
  const p=$('quizPanel');
  p.classList.remove('hidden');
  p.innerHTML='<div class="loading">Loading today’s quiz…</div>';
  const {data,error}=await client.from('questions').select('id,question,option_a,option_b,option_c,option_d,answer,explanation').eq('status','published').limit(100);
  if(error||!data?.length){p.innerHTML='<div class="loading">No published questions yet. Add questions from the admin panel.</div>';return}
  if(data.length<10){p.innerHTML=`<div class="loading">Daily Quiz needs at least 10 published questions. There are currently ${data.length}. Add more questions from Admin.</div>`;return}
  quizQuestions=data.sort(()=>Math.random()-.5).slice(0,10);
  quizIndex=0;
  quizScore=0;
  quizAnswers=new Array(quizQuestions.length).fill(null);
  quizSeconds=600;
  quizStartedAt=Date.now();
  quizSubmitted=false;
  clearInterval(quizTimer);
  renderQuiz();
  quizTimer=setInterval(()=>{quizSeconds--;updateQuizTimer();if(quizSeconds<=0){clearInterval(quizTimer);submitQuiz(true)}},1000);
}

function updateQuizTimer(){
  const e=$('quizTimer');
  if(!e)return;
  const m=Math.floor(Math.max(quizSeconds,0)/60);
  const s=Math.max(quizSeconds,0)%60;
  e.textContent=`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  e.classList.toggle('timer-warning',quizSeconds<=60);
}

function renderQuiz(){
  const q=quizQuestions[quizIndex],p=$('quizPanel');
  const selected=quizAnswers[quizIndex];
  const answered=quizAnswers.filter(Boolean).length;
  p.innerHTML=`
    <div class="quiz-topbar">
      <div><strong>Daily Quiz</strong><span>${answered}/${quizQuestions.length} answered</span></div>
      <div class="quiz-timer" id="quizTimer">10:00</div>
    </div>
    <div class="quiz-progress"><i style="width:${((quizIndex+1)/quizQuestions.length)*100}%"></i></div>
    <div class="quiz-question-head"><span>QUESTION ${quizIndex+1} OF ${quizQuestions.length}</span><b>${selected?'Answered':'Not answered'}</b></div>
    <div class="question quiz-question">
      <h3>${escapeHtml(q.question)}</h3>
      <div class="options quiz-options">
        ${[['A',q.option_a],['B',q.option_b],['C',q.option_c],['D',q.option_d]].map(([l,t])=>`
          <button class="option ${selected===l?'selected':''}" onclick="selectQuizAnswer('${l}')" ${quizSubmitted?'disabled':''}>
            <b>${l}.</b> ${escapeHtml(t)}
          </button>`).join('')}
      </div>
    </div>
    <div class="quiz-controls">
      <button class="btn light" onclick="quizPrev()" ${quizIndex===0?'disabled':''}>← Previous</button>
      <div class="quiz-dots">${quizQuestions.map((_,i)=>`<button class="quiz-dot ${i===quizIndex?'current':''} ${quizAnswers[i]?'done':''}" onclick="goQuizQuestion(${i})">${i+1}</button>`).join('')}</div>
      ${quizIndex<quizQuestions.length-1
        ? `<button class="btn primary" onclick="quizNext()">Next →</button>`
        : `<button class="btn primary" onclick="submitQuiz(false)">Submit Quiz</button>`}
    </div>`;
  updateQuizTimer();
}

window.selectQuizAnswer=chosen=>{if(quizSubmitted)return;quizAnswers[quizIndex]=chosen;renderQuiz()};
window.quizNext=()=>{if(quizIndex<quizQuestions.length-1){quizIndex++;renderQuiz()}};
window.quizPrev=()=>{if(quizIndex>0){quizIndex--;renderQuiz()}};
window.goQuizQuestion=i=>{if(i>=0&&i<quizQuestions.length){quizIndex=i;renderQuiz()}};

async function submitQuiz(auto=false){
  if(quizSubmitted)return;
  quizSubmitted=true;
  clearInterval(quizTimer);
  quizScore=quizQuestions.reduce((score,q,i)=>score+(quizAnswers[i]===q.answer?1:0),0);
  const timeTaken=Math.min(600,Math.max(0,Math.round((Date.now()-quizStartedAt)/1000)));
  const attempted=quizAnswers.filter(Boolean).length;
  const percentage=Math.round((quizScore/quizQuestions.length)*100);
  const today=new Date().toISOString().slice(0,10);
  const previous=localStorage.getItem('axomprep_last_quiz_date');
  let streak=Number(localStorage.getItem('axomprep_quiz_streak')||0);
  const yesterday=new Date(Date.now()-86400000).toISOString().slice(0,10);
  if(previous===today){streak=Math.max(streak,1)}else if(previous===yesterday){streak+=1}else{streak=1}
  localStorage.setItem('axomprep_last_quiz_date',today);
  localStorage.setItem('axomprep_quiz_streak',String(streak));
  localStorage.setItem('axomprep_last_quiz_result',JSON.stringify({score:quizScore,total:quizQuestions.length,percentage,streak,date:today}));

  let saved=false;
  const {data:{user}}=await client.auth.getUser();
  if(user){
    try{
      const {data:attempt,error:attemptError}=await client.from('daily_quiz_attempts').insert({user_id:user.id,quiz_date:today,score:quizScore,total_questions:quizQuestions.length,time_taken_seconds:timeTaken}).select('id').single();
      if(!attemptError&&attempt){
        const rows=quizQuestions.map((q,i)=>({attempt_id:attempt.id,question_id:q.id,selected_answer:quizAnswers[i],correct_answer:q.answer,is_correct:quizAnswers[i]===q.answer}));
        const {error:answerError}=await client.from('daily_quiz_answers').insert(rows);
        saved=!answerError;
      }
    }catch(e){console.warn('Daily quiz result save skipped:',e)}
  }
  renderQuizResult(auto,attempted,timeTaken,percentage,streak,saved);
}

function renderQuizResult(auto,attempted,timeTaken,percentage,streak,saved){
  const p=$('quizPanel');
  const mins=Math.floor(timeTaken/60),secs=timeTaken%60;
  p.innerHTML=`
    <div class="quiz-result">
      <div class="eyebrow">${auto?'TIME UP':'QUIZ COMPLETE'}</div>
      <h2>${quizScore}/${quizQuestions.length}</h2>
      <p class="result-percent">${percentage}% score • ${attempted}/${quizQuestions.length} attempted</p>
      <div class="result-stats"><div><b>${quizScore}</b><span>Correct</span></div><div><b>${quizQuestions.length-quizScore}</b><span>Incorrect / skipped</span></div><div><b>${streak}</b><span>Day streak</span></div><div><b>${mins}:${String(secs).padStart(2,'0')}</b><span>Time</span></div></div>
      <p>${saved?'Result saved to your account.':'Result saved on this device. Log in to sync results across devices.'}</p>
      <div class="result-actions"><button class="btn primary" onclick="startQuiz()">Try Again</button><button class="btn light" onclick="showQuizReview()">Review Answers</button></div>
    </div>`;
  $('quizScore').textContent=quizScore;
}

window.showQuizReview=()=>{
  const p=$('quizPanel');
  p.innerHTML=`<div class="quiz-review"><div class="quiz-review-head"><div><div class="eyebrow">ANSWER REVIEW</div><h2>Your Daily Quiz</h2></div><button class="btn light" onclick="renderQuizResult(false,quizAnswers.filter(Boolean).length,Math.min(600,Math.max(0,Math.round((Date.now()-quizStartedAt)/1000))),Math.round((quizScore/quizQuestions.length)*100),Number(localStorage.getItem('axomprep_quiz_streak')||1),true)">Back to Result</button></div>${quizQuestions.map((q,i)=>{const chosen=quizAnswers[i];const ok=chosen===q.answer;return `<article class="review-item"><div class="review-number">${i+1}</div><div><h3>${escapeHtml(q.question)}</h3><p class="review-answer ${ok?'review-correct':'review-wrong'}">Your answer: <b>${chosen||'Not answered'}</b> • Correct: <b>${q.answer}</b></p><p><b>Explanation:</b> ${escapeHtml(q.explanation||'No explanation added yet.')}</p></div></article>`}).join('')}</div>`;
};

window.loadPractice=loadPractice;window.filterExam=()=>location.hash='practice';window.requireLogin=requireLogin;window.closeModal=closeModal;
function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
async function loadCurrent(){const g=$('currentGrid');const {data}=await client.from('current_affairs').select('title,content,category,published_date').eq('is_published',true).order('published_date',{ascending:false}).limit(3);if(!data?.length){g.innerHTML='<div class="loading">Current affairs will appear here after publication from the admin panel.</div>';return}g.innerHTML=data.map(n=>`<article class="news-card"><small>${escapeHtml(n.category||'CURRENT AFFAIRS')} • ${n.published_date}</small><h3>${escapeHtml(n.title)}</h3><p>${escapeHtml((n.content||'').slice(0,150))}</p></article>`).join('')}
$('startQuiz').onclick=startQuiz;
if(location.hash==='#login')openAuth(false);
loadCurrent();updateAuthUI();
