const cfg=window.AXOMPREP_CONFIG;
const client=supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey);
let quizQuestions=[],quizIndex=0,quizScore=0,isSignup=false;

const $=id=>document.getElementById(id);
function openAuth(signup=false){isSignup=signup;$('authModal').classList.remove('hidden');$('tabLogin').classList.toggle('active',!signup);$('tabSignup').classList.toggle('active',signup);$('nameWrap').classList.toggle('hidden',!signup);$('authSubmit').textContent=signup?'Create account':'Login';$('authMsg').textContent=''}
function closeModal(){$('authModal').classList.add('hidden')}
function requireLogin(){openAuth(false)}
$('loginBtn').onclick=()=>openAuth(false);$('signupBtn').onclick=()=>openAuth(true);
$('tabLogin').onclick=()=>openAuth(false);$('tabSignup').onclick=()=>openAuth(true);
$('authForm').onsubmit=async e=>{e.preventDefault();const email=$('email').value,password=$('password').value,name=$('fullName').value;
let r=isSignup?await client.auth.signUp({email,password,options:{data:{full_name:name}}}):await client.auth.signInWithPassword({email,password});
if(r.error){$('authMsg').textContent=r.error.message;return}
$('authMsg').textContent=isSignup?'Account created. Check your email if confirmation is enabled.':'Logged in.';setTimeout(closeModal,900);updateAuthUI()};
async function updateAuthUI(){const {data}=await client.auth.getUser();if(data.user){$('loginBtn').textContent='Dashboard';$('loginBtn').onclick=()=>location.hash='dashboard';$('signupBtn').textContent='Logout';$('signupBtn').onclick=async()=>{await client.auth.signOut();location.reload()}}}
async function loadPractice(subject){location.hash='practice';const panel=$('practicePanel');panel.classList.remove('hidden');panel.innerHTML='<div class="loading">Loading questions…</div>';
const {data,error}=await client.from('questions').select('id,question,option_a,option_b,option_c,option_d,answer,explanation').eq('status','published').eq('subject_id',(await getSubjectId(subject))).limit(10);
if(error||!data?.length){panel.innerHTML='<div class="loading">No published questions are available for this subject yet. Add questions from the admin workflow.</div>';return}
panel.innerHTML='<h3>'+subject+' Practice</h3>'+data.map((q,i)=>questionHtml(q,i)).join('');
}
async function getSubjectId(name){const {data}=await client.from('subjects').select('id').eq('name',name).maybeSingle();return data?.id||''}
function questionHtml(q,i){return `<div class="question"><h3>${i+1}. ${escapeHtml(q.question)}</h3><div class="options">${[['A',q.option_a],['B',q.option_b],['C',q.option_c],['D',q.option_d]].map(([l,t])=>`<button class="option" onclick="checkOption(this,'${q.answer}','${l}')"><b>${l}.</b> ${escapeHtml(t)}</button>`).join('')}</div><div class="explanation hidden"><b>Explanation:</b> ${escapeHtml(q.explanation||'No explanation added yet.')}</div></div>`}
function checkOption(el,correct,chosen){const box=el.parentElement;[...box.children].forEach(x=>x.disabled=true);el.classList.add(chosen===correct?'correct':'wrong');if(chosen!==correct)[...box.children].find(x=>x.textContent.trim().startsWith(correct+'.'))?.classList.add('correct');el.parentElement.nextElementSibling?.classList.remove('hidden')}
async function startQuiz(){const p=$('quizPanel');p.classList.remove('hidden');p.innerHTML='<div class="loading">Loading today’s quiz…</div>';const {data,error}=await client.from('questions').select('id,question,option_a,option_b,option_c,option_d,answer,explanation').eq('status','published').limit(50);if(error||!data?.length){p.innerHTML='<div class="loading">No published questions yet. Your admin panel will populate this.</div>';return}quizQuestions=data.sort(()=>Math.random()-.5).slice(0,10);quizIndex=0;quizScore=0;$('quizScore').textContent='0';renderQuiz()}
function renderQuiz(){const q=quizQuestions[quizIndex],p=$('quizPanel');p.innerHTML=`<div class="question"><small>QUESTION ${quizIndex+1} OF ${quizQuestions.length}</small><h3>${escapeHtml(q.question)}</h3><div class="options">${[['A',q.option_a],['B',q.option_b],['C',q.option_c],['D',q.option_d]].map(([l,t])=>`<button class="option" onclick="answerQuiz('${l}')"><b>${l}.</b> ${escapeHtml(t)}</button>`).join('')}</div></div>`}
window.answerQuiz=async chosen=>{const q=quizQuestions[quizIndex];if(chosen===q.answer){quizScore++;$('quizScore').textContent=quizScore}quizIndex++;if(quizIndex<quizQuestions.length)renderQuiz();else $('quizPanel').innerHTML=`<div class="center"><h2>Quiz complete</h2><p>Your score: <b>${quizScore}/${quizQuestions.length}</b></p><button class="btn primary" onclick="startQuiz()">Try again</button></div>`}
window.loadPractice=loadPractice;window.filterExam=()=>location.hash='practice';window.requireLogin=requireLogin;window.closeModal=closeModal;
function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
async function loadCurrent(){const g=$('currentGrid');const {data}=await client.from('current_affairs').select('title,content,category,published_date').eq('is_published',true).order('published_date',{ascending:false}).limit(3);if(!data?.length){g.innerHTML='<div class="loading">Current affairs will appear here after publication from the admin panel.</div>';return}g.innerHTML=data.map(n=>`<article class="news-card"><small>${escapeHtml(n.category||'CURRENT AFFAIRS')} • ${n.published_date}</small><h3>${escapeHtml(n.title)}</h3><p>${escapeHtml((n.content||'').slice(0,150))}</p></article>`).join('')}
$('startQuiz').onclick=startQuiz;
loadCurrent();updateAuthUI();
