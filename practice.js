const cfg=window.AXOMPREP_CONFIG;
const client=supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey);
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
let questions=[], answers=[], index=0, startedAt=0, timer=null, seconds=0, submitted=false;
let exams=[],subjects=[],topics=[];

async function init(){
  bindAuth();
  const params=new URLSearchParams(location.search);
  await Promise.all([loadExams(),loadSubjects()]);
  const exam=params.get('exam'),subject=params.get('subject'),topic=params.get('topic');
  if(exam) setSelectByText($('examFilter'),exam);
  if(subject) setSelectByText($('subjectFilter'),subject);
  await loadTopics();
  if(topic) setSelectByText($('topicFilter'),topic);
  $('startPractice').onclick=startPractice;
  $('resetPractice').onclick=resetAll;
  $('examFilter').onchange=async()=>{await loadTopics();};
  $('subjectFilter').onchange=async()=>{await loadTopics();};
}
function setSelectByText(select,text){const opt=[...select.options].find(o=>o.text.toLowerCase()===text.toLowerCase());if(opt)select.value=opt.value;}
async function loadExams(){const {data,error}=await client.from('exams').select('id,name').order('name');if(error){setStatus(error.message);return}exams=data||[];$('examFilter').innerHTML='<option value="">All Exams</option>'+exams.map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('')}
async function loadSubjects(){const {data,error}=await client.from('subjects').select('id,name').order('name');if(error){setStatus(error.message);return}subjects=data||[];$('subjectFilter').innerHTML='<option value="">All Subjects</option>'+subjects.map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('')}
async function loadTopics(){
  const sid=$('subjectFilter').value;
  let q=client.from('topics').select('id,name,subject_id').order('name');
  if(sid)q=q.eq('subject_id',sid);
  const {data,error}=await q;
  if(error){$('topicFilter').innerHTML='<option value="">All Topics</option>';return}
  topics=data||[];$('topicFilter').innerHTML='<option value="">All Topics</option>'+topics.map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('');
}
function setStatus(t){$('practiceStatus').textContent=t||''}
async function startPractice(){
  stopTimer(); submitted=false;setStatus('Loading published questions…');
  const exam=$('examFilter').value,subject=$('subjectFilter').value,topic=$('topicFilter').value,diff=$('difficultyFilter').value,count=Number($('countFilter').value||10);
  let q=client.from('questions').select('id,question,option_a,option_b,option_c,option_d,answer,explanation,difficulty,year,tags,exam_id,subject_id,topic_id,exams(name),subjects(name)').eq('status','published').limit(500);
  if(exam)q=q.eq('exam_id',exam);if(subject)q=q.eq('subject_id',subject);if(topic)q=q.eq('topic_id',topic);if(diff)q=q.eq('difficulty',diff);
  const {data,error}=await q;
  if(error){setStatus(error.message);return}
  if(!data?.length){setStatus('No published questions match these filters.');$('practiceArea').innerHTML='<div class="practice-empty"><h3>No questions found</h3><p>Try broader filters or add more published questions from Admin.</p></div>';return}
  questions=data.sort(()=>Math.random()-.5).slice(0,count);index=0;answers=new Array(questions.length).fill(null);startedAt=Date.now();seconds=Math.max(300,questions.length*45);renderQuestion();setStatus(`${questions.length} questions loaded.`);timer=setInterval(()=>{seconds--;renderTimer();if(seconds<=0)submitPractice(true)},1000);
}
function renderTimer(){const e=$('practiceTimer');if(!e)return;const m=Math.floor(Math.max(seconds,0)/60),s=Math.max(seconds,0)%60;e.textContent=`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;e.classList.toggle('warning',seconds<=60)}
function renderQuestion(){
 const q=questions[index],chosen=answers[index],done=answers.filter(Boolean).length;
 $('practiceArea').innerHTML=`<div class="practice-top"><div><strong>Practice Session</strong><div style="font-size:12px;color:#728095;margin-top:3px">${done}/${questions.length} answered</div></div><div class="practice-timer" id="practiceTimer">00:00</div></div><div class="practice-progress"><i style="width:${((index+1)/questions.length)*100}%"></i></div><div class="practice-question-meta"><span class="practice-chip">Question ${index+1} of ${questions.length}</span>${q.exams?.name?`<span class="practice-chip">${esc(q.exams.name)}</span>`:''}${q.subjects?.name?`<span class="practice-chip">${esc(q.subjects.name)}</span>`:''}${q.difficulty?`<span class="practice-chip">${esc(q.difficulty)}</span>`:''}${q.year?`<span class="practice-chip">${q.year}</span>`:''}</div><div class="practice-question"><h2>${esc(q.question)}</h2><div class="practice-options">${[['A',q.option_a],['B',q.option_b],['C',q.option_c],['D',q.option_d]].map(([l,t])=>`<button class="practice-option ${chosen===l?'selected':''}" data-opt="${l}" ${chosen?'disabled':''}><b>${l}.</b> ${esc(t)}</button>`).join('')}</div>${chosen?`<div class="practice-explanation"><b>${chosen===q.answer?'Correct':'Incorrect'}</b><br>Correct answer: <b>${esc(q.answer)}</b><br><br>${esc(q.explanation||'No explanation has been added yet.')}</div>`:''}</div><div class="practice-controls"><button class="btn light" id="prevBtn" ${index===0?'disabled':''}>← Previous</button><div class="center-controls">${questions.map((_,i)=>`<button class="practice-dot ${i===index?'current':''} ${answers[i]?'done':''}" data-i="${i}">${i+1}</button>`).join('')}</div>${index<questions.length-1?'<button class="btn primary" id="nextBtn">Next →</button>':'<button class="btn primary" id="submitBtn">Submit Practice</button>'}</div>`;
 document.querySelectorAll('.practice-option').forEach(b=>b.onclick=()=>choose(b.dataset.opt));
 $('prevBtn').onclick=()=>{if(index>0){index--;renderQuestion()}};document.querySelectorAll('.practice-dot').forEach(b=>b.onclick=()=>{index=Number(b.dataset.i);renderQuestion()});
 const next=$('nextBtn');if(next)next.onclick=()=>{index++;renderQuestion()};const submit=$('submitBtn');if(submit)submit.onclick=()=>submitPractice(false);renderTimer();
}
function choose(opt){if(submitted||answers[index])return;answers[index]=opt;renderQuestion()}
async function submitPractice(auto=false){if(submitted||!questions.length)return;submitted=true;stopTimer();const score=questions.reduce((n,q,i)=>n+(answers[i]===q.answer?1:0),0),attempted=answers.filter(Boolean).length,total=questions.length,pct=Math.round(score/total*100),timeTaken=Math.round((Date.now()-startedAt)/1000);let saved=false;const {data:{user}}=await client.auth.getUser();if(user){try{const ins=await client.from('practice_attempts_v1').insert({user_id:user.id,exam_id:$('examFilter').value||null,subject_id:$('subjectFilter').value||null,topic_id:$('topicFilter').value||null,total_questions:total,score,percentage:pct,time_taken_seconds:timeTaken}).select('id').single();if(!ins.error&&ins.data){const rows=questions.map((q,i)=>({attempt_id:ins.data.id,question_id:q.id,selected_answer:answers[i],correct_answer:q.answer,is_correct:answers[i]===q.answer}));const ar=await client.from('practice_answers_v1').insert(rows);saved=!ar.error}}catch(e){console.warn(e)}}renderResult(auto,score,attempted,total,pct,timeTaken,saved)}
function renderResult(auto,score,attempted,total,pct,timeTaken,saved){const m=Math.floor(timeTaken/60),s=timeTaken%60;$('practiceArea').innerHTML=`<div class="practice-result"><div class="eyebrow">${auto?'TIME UP':'PRACTICE COMPLETE'}</div><h2>${score}/${total}</h2><p>${pct}% score • ${attempted}/${total} attempted</p><div class="practice-result-stats"><div><b>${score}</b><span>Correct</span></div><div><b>${total-score}</b><span>Incorrect / skipped</span></div><div><b>${pct}%</b><span>Accuracy</span></div><div><b>${m}:${String(s).padStart(2,'0')}</b><span>Time</span></div></div><p>${saved?'Result saved to your account.':'Result saved for this session. Log in to sync results across devices.'}</p><div class="practice-actions-result"><button class="btn primary" id="tryAgain">Try Again</button><button class="btn light" id="reviewBtn">Review Answers</button></div></div>`;$('tryAgain').onclick=startPractice;$('reviewBtn').onclick=reviewAnswers}
function reviewAnswers(){$('practiceArea').innerHTML=`<div class="practice-review"><div class="practice-top"><div><div class="eyebrow">ANSWER REVIEW</div><h2>Practice Review</h2></div><button class="btn light" id="backResult">Back</button></div>${questions.map((q,i)=>{const ok=answers[i]===q.answer;return `<article><h3>${i+1}. ${esc(q.question)}</h3><p class="${ok?'review-correct':'review-wrong'}"><b>Your answer:</b> ${esc(answers[i]||'Not answered')} • <b>Correct:</b> ${esc(q.answer)}</p><p><b>Explanation:</b> ${esc(q.explanation||'No explanation has been added yet.')}</p></article>`}).join('')}</div>`;$('backResult').onclick=()=>{const score=questions.reduce((n,q,i)=>n+(answers[i]===q.answer?1:0),0);const attempted=answers.filter(Boolean).length;renderResult(false,score,attempted,questions.length,Math.round(score/questions.length*100),Math.round((Date.now()-startedAt)/1000),true)}}
function stopTimer(){if(timer){clearInterval(timer);timer=null}}
function resetAll(){stopTimer();questions=[];answers=[];index=0;submitted=false;$('examFilter').value='';$('subjectFilter').value='';$('difficultyFilter').value='';$('countFilter').value='10';loadTopics();setStatus('');$('practiceArea').innerHTML='<div class="practice-empty"><h3>Choose your filters and start a practice session</h3><p>Your questions will be loaded from the published AxomPrep Question Bank.</p></div>'}
function bindAuth(){let signup=false;const open=mode=>{$('authModal').classList.remove('hidden');signup=mode;$('tabLogin').classList.toggle('active',!mode);$('tabSignup').classList.toggle('active',mode);$('nameWrap').classList.toggle('hidden',!mode);$('authSubmit').textContent=mode?'Create account':'Login';$('authMsg').textContent=''};$('loginBtn').onclick=()=>open(false);$('signupBtn').onclick=async()=>{const {data:{user}}=await client.auth.getUser();if(user){await client.auth.signOut();location.reload()}else open(true)};$('closeAuth').onclick=()=>$('authModal').classList.add('hidden');$('tabLogin').onclick=()=>open(false);$('tabSignup').onclick=()=>open(true);$('authForm').onsubmit=async e=>{e.preventDefault();const email=$('email').value,password=$('password').value,name=$('fullName').value;const r=signup?await client.auth.signUp({email,password,options:{data:{full_name:name}}}):await client.auth.signInWithPassword({email,password});$('authMsg').textContent=r.error?r.error.message:(signup?'Account created. Check your email if confirmation is enabled.':'Logged in.');if(!r.error)setTimeout(()=>$('authModal').classList.add('hidden'),900)}}
init();
