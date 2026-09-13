const cfg=window.AXOMPREP_CONFIG;
const client=supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey);
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));

let TESTS=[
 {code:'ADRE-FULL-01',exam:'ADRE',title:'ADRE Full Mock Test',description:'Mixed Assam GK, Mathematics, Reasoning, English and General Knowledge.',questions:50,minutes:60,marks:1,negative:0},
 {code:'APSC-GS-01',exam:'APSC',title:'APSC General Studies Mock',description:'General Studies practice covering Assam and India-focused topics.',questions:50,minutes:60,marks:1,negative:0},
 {code:'SSC-MIX-01',exam:'SSC',title:'SSC Practice Mock',description:'Mixed aptitude, reasoning, English and general awareness practice.',questions:50,minutes:60,marks:1,negative:0},
 {code:'POLICE-MIX-01',exam:'Assam Police',title:'Assam Police Practice Mock',description:'Mixed recruitment-oriented practice for Assam Police aspirants.',questions:50,minutes:60,marks:1,negative:0}
];

let currentUser=null,currentTest=null,questions=[],answers=[],idx=0,timer=null,remaining=0,startedAt=0,questionStartedAt=0,attemptId=null,submitted=false;

async function init(){
 const {data,error}=await client.auth.getUser();
 if(error||!data.user){location.href='index.html#login';return;}
 currentUser=data.user;
 $('dashboardBtn').onclick=()=>location.href='dashboard.html';
 $('logoutBtn').onclick=async()=>{await client.auth.signOut();location.href='index.html';};
 $('menuBtn').onclick=()=>document.querySelector('nav')?.classList.toggle('mobile-show');
 document.querySelectorAll('.mock-filter').forEach(b=>b.onclick=()=>{document.querySelectorAll('.mock-filter').forEach(x=>x.classList.remove('active'));b.classList.add('active');renderCatalogue(b.dataset.exam);});
 await loadPublishedTests();
 renderCatalogue('all');
}

async function loadPublishedTests(){
 const {data,error}=await client.from('mock_tests_v1').select('id,code,title,description,duration_minutes,total_questions,marks_per_question,negative_mark,exam_id,exams(name)').eq('status','published').order('created_at',{ascending:false});
 if(error){console.warn('Builder tests unavailable; using built-in tests.',error.message);return;}
 const dynamic=(data||[]).map(t=>({id:t.id,code:t.code,exam:t.exams?.name||'Exam',title:t.title,description:t.description||'',questions:t.total_questions,minutes:t.duration_minutes,marks:Number(t.marks_per_question||1),negative:Number(t.negative_mark||0),dynamic:true}));
 if(dynamic.length)TESTS=dynamic;
}

function renderCatalogue(filter){
 const list=filter==='all'?TESTS:TESTS.filter(t=>t.exam===filter);
 $('mockCatalogue').innerHTML=list.map(t=>`<article class="mock-catalog-card"><div class="mock-card-top"><span>${esc(t.exam)}</span><b>${t.questions} Q</b></div><h2>${esc(t.title)}</h2><p>${esc(t.description)}</p><div class="mock-meta"><span>⏱ ${t.minutes} min</span><span>✓ Instant result</span><span>📊 Analytics</span></div><button class="btn primary full" onclick="startMock('${t.code}')">Start Mock Test</button></article>`).join('');
}

window.startMock=async code=>{
 currentTest=TESTS.find(t=>t.code===code); if(!currentTest)return;
 $('mockCatalogue').classList.add('hidden'); $('mockPanel').classList.remove('hidden'); $('mockPanel').innerHTML='<div class="loading">Preparing your mock test…</div>';
 let pool=[];
 if(currentTest.dynamic){
   const {data,error}=await client.from('mock_test_questions_v1').select('question_order,questions(id,question,option_a,option_b,option_c,option_d,answer,explanation,exam_id,subjects(name),exams(name))').eq('mock_test_id',currentTest.id).order('question_order');
   if(error){showRunError(error.message);return;}
   pool=(data||[]).map(x=>x.questions).filter(Boolean);
 } else {
   const {data,error}=await client.from('questions').select('id,question,option_a,option_b,option_c,option_d,answer,explanation,exam_id,subjects(name),exams(name)').eq('status','published').limit(1000);
   if(error){showRunError(error.message);return;}
   pool=data||[];
   const examPool=pool.filter(q=>(q.exams?.name||'').toLowerCase()===currentTest.exam.toLowerCase());
   if(examPool.length>=currentTest.questions)pool=examPool;
 }
 if(pool.length<currentTest.questions){showRunError(`This mock needs ${currentTest.questions} published questions, but only ${pool.length} suitable questions are currently available. Add and publish more questions from the Admin panel.`);return;}
 questions=currentTest.dynamic?pool:pool.sort(()=>Math.random()-.5).slice(0,currentTest.questions);
 answers=questions.map(q=>({question_id:q.id,selected_answer:null,correct_answer:q.answer,is_correct:false,time_spent_seconds:0}));
 idx=0;remaining=currentTest.minutes*60;startedAt=Date.now();questionStartedAt=Date.now();submitted=false;
 const ins=await client.from('mock_attempts_v1').insert({user_id:currentUser.id,test_code:currentTest.code,test_title:currentTest.title,exam_name:currentTest.exam,total_questions:questions.length,time_limit_seconds:remaining,completed:false}).select('id').single();
 if(ins.error){showRunError('Could not start this mock test: '+ins.error.message);return;}
 attemptId=ins.data.id;renderQuestion();startTimer();
};

function showRunError(msg){$('mockPanel').innerHTML=`<div class="mock-error"><h2>Mock test unavailable</h2><p>${esc(msg)}</p><button class="btn light" onclick="location.reload()">Back to Mock Tests</button></div>`;}
function formatTime(s){return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;}
function startTimer(){clearInterval(timer);timer=setInterval(()=>{remaining--;updateTimer();if(remaining<=0){clearInterval(timer);submitMock(true);}},1000);updateTimer();}
function updateTimer(){const el=document.getElementById('mockTimer');if(el){el.textContent=formatTime(Math.max(remaining,0));el.classList.toggle('danger',remaining<=300);}}
function renderQuestion(){
 questionStartedAt=Date.now(); const q=questions[idx],a=answers[idx];
 $('mockPanel').innerHTML=`<div class="mock-run-head"><div><span>${esc(currentTest.exam)} • ${esc(currentTest.title)}</span><strong>Question ${idx+1} of ${questions.length}</strong></div><div class="mock-timer" id="mockTimer">${formatTime(remaining)}</div></div><div class="mock-progress"><i style="width:${((idx+1)/questions.length)*100}%"></i></div><div class="mock-question-card"><div class="mock-question-number">Q${idx+1}</div><h2>${esc(q.question)}</h2><div class="mock-options">${['a','b','c','d'].map(k=>{const key='option_'+k;const letter=k.toUpperCase();return `<button class="mock-option ${a.selected_answer===letter?'selected':''}" onclick="selectAnswer('${letter}')"><b>${letter}</b><span>${esc(q[key])}</span></button>`}).join('')}</div></div><div class="mock-run-controls"><button class="btn light" onclick="prevQuestion()" ${idx===0?'disabled':''}>← Previous</button><div class="mock-dots">${questions.map((_,i)=>`<button class="${i===idx?'active':''} ${answers[i].selected_answer?'answered':''}" onclick="jumpQuestion(${i})">${i+1}</button>`).join('')}</div>${idx<questions.length-1?`<button class="btn primary" onclick="nextQuestion()">Next →</button>`:`<button class="btn primary" onclick="submitMock(false)">Submit Test</button>`}</div><button class="mock-submit-link" onclick="submitMock(false)">Submit test now</button>`;
 updateTimer();
}
window.selectAnswer=letter=>{if(submitted)return;const a=answers[idx];a.time_spent_seconds+=Math.max(0,Math.round((Date.now()-questionStartedAt)/1000));a.selected_answer=letter;renderQuestion();};
function saveTime(){answers[idx].time_spent_seconds+=Math.max(0,Math.round((Date.now()-questionStartedAt)/1000));}
window.nextQuestion=()=>{saveTime();if(idx<questions.length-1){idx++;renderQuestion();}};
window.prevQuestion=()=>{saveTime();if(idx>0){idx--;renderQuestion();}};
window.jumpQuestion=i=>{saveTime();idx=i;renderQuestion();};

window.submitMock=async forced=>{
 if(submitted)return; submitted=true;clearInterval(timer);saveTime();
 const score=answers.reduce((n,a)=>n+(a.selected_answer===a.correct_answer?1:0),0);
 answers.forEach(a=>a.is_correct=a.selected_answer===a.correct_answer);
 const timeTaken=Math.min(currentTest.minutes*60,Math.round((Date.now()-startedAt)/1000));
 const up=await client.from('mock_attempts_v1').update({score,time_taken_seconds:timeTaken,completed:true,completed_at:new Date().toISOString()}).eq('id',attemptId).eq('user_id',currentUser.id);
 if(up.error){$('mockPanel').innerHTML=`<div class="mock-error"><h2>Result could not be saved</h2><p>${esc(up.error.message)}</p></div>`;return;}
 const rows=answers.map(a=>({attempt_id:attemptId,question_id:a.question_id,selected_answer:a.selected_answer,correct_answer:a.correct_answer,is_correct:a.is_correct,time_spent_seconds:a.time_spent_seconds}));
 const ins=await client.from('mock_answers_v1').insert(rows);
 if(ins.error){console.error(ins.error);}
 renderResult(score,timeTaken,forced);
};

function renderResult(score,timeTaken,forced){
 const pct=Math.round(score/questions.length*100);const correct=score,wrong=answers.filter(a=>a.selected_answer&&a.selected_answer!==a.correct_answer).length,unanswered=answers.length-correct-wrong;
 $('mockPanel').innerHTML=`<div class="mock-result"><div class="result-badge">TEST COMPLETE</div><h1>${pct>=70?'Strong attempt.':pct>=40?'Good start.':'Keep practising.'}</h1><p>${forced?'Time expired. Your answers were submitted automatically.':'Your mock test has been submitted.'}</p><div class="result-stats"><div><b>${score}/${questions.length}</b><span>Score</span></div><div><b>${pct}%</b><span>Accuracy</span></div><div><b>${formatTime(timeTaken)}</b><span>Time used</span></div><div><b>${unanswered}</b><span>Unanswered</span></div></div><div class="mock-result-actions"><button class="btn primary" onclick="showReview()">Review Answers</button><button class="btn light" onclick="location.href='dashboard.html'">View Dashboard</button><button class="btn light" onclick="location.reload()">More Mock Tests</button></div><div id="mockReview" class="mock-review hidden"></div></div>`;
}
window.showReview=()=>{$('mockReview').classList.remove('hidden');$('mockReview').innerHTML='<h2>Answer Review</h2>'+questions.map((q,i)=>{const a=answers[i];const ok=a.is_correct;return `<article class="review-item ${ok?'correct':'incorrect'}"><div><b>Q${i+1}</b><span>${ok?'Correct':a.selected_answer?'Incorrect':'Not answered'}</span></div><p>${esc(q.question)}</p><small>Your answer: <strong>${esc(a.selected_answer||'—')}</strong> • Correct: <strong>${esc(a.correct_answer)}</strong></small>${q.explanation?`<p class="review-explanation">${esc(q.explanation)}</p>`:''}</article>`}).join('');};
init();
