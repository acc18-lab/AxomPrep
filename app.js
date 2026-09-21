const cfg=window.AXOMPREP_CONFIG;
const client=supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey);
let quizQuestions=[],quizIndex=0,quizScore=0,isSignup=false;

const AXOMPREP_PRODUCTION_URL='https://www.axomprep.online/';
const $=id=>document.getElementById(id);

function ensureAuthEnhancements(){
  if(document.getElementById('axomprep-auth-enhancements')) return;
  const style=document.createElement('style');
  style.id='axomprep-auth-enhancements';
  style.textContent=`
    #authMsg{margin:12px 0 0;line-height:1.45;white-space:pre-line}
    .auth-success{color:#147a4b}
    .auth-error{color:#c7462e}
    .auth-info{color:#315f93}
    .auth-resend{display:none;margin-top:10px;padding:0;border:0;background:transparent;color:#1553a0;font:600 13px/1.4 inherit;text-decoration:underline;cursor:pointer}
    .auth-resend.show{display:inline-block}
    .auth-resend:disabled{opacity:.55;cursor:wait}
    .auth-confirm-note{display:none;margin-top:10px;padding:10px 12px;border-radius:10px;background:#eef6ff;color:#315f93;font-size:12px;line-height:1.45}
    .auth-confirm-note.show{display:block}
  `;
  document.head.appendChild(style);

  const form=$('authForm');
  const msg=$('authMsg');
  if(!form||!msg) return;

  const forgot=document.createElement('a');
  forgot.href='forgot-password.html';
  forgot.id='forgotPasswordLink';
  forgot.textContent='Forgot password?';
  forgot.style.cssText='display:block;margin:9px 0 0;text-align:right;color:#1553a0;text-decoration:none;font-size:13px;font-weight:600;';
  forgot.addEventListener('click',()=>{ sessionStorage.setItem('axomprep_reset_return','1'); });
  form.insertBefore(forgot,msg);

  const resend=document.createElement('button');
  resend.type='button';
  resend.id='resendConfirmationBtn';
  resend.className='auth-resend';
  resend.textContent='Resend confirmation email';
  resend.onclick=resendConfirmation;
  form.insertBefore(resend,msg.nextSibling);

  const note=document.createElement('div');
  note.id='authConfirmNote';
  note.className='auth-confirm-note';
  note.textContent='New accounts require email confirmation before you can log in.';
  form.insertBefore(note,msg);
}

function setAuthMessage(message,type=''){
  ensureAuthEnhancements();
  const el=$('authMsg');
  if(!el) return;
  el.textContent=message||'';
  el.className=type?('auth-'+type):'';
}

function setResendVisible(show){
  ensureAuthEnhancements();
  const btn=$('resendConfirmationBtn');
  if(btn) btn.classList.toggle('show',Boolean(show));
}

function setSignupNote(show){
  ensureAuthEnhancements();
  const note=$('authConfirmNote');
  if(note) note.classList.toggle('show',Boolean(show));
}

function getAuthRedirectUrl(){
  return AXOMPREP_PRODUCTION_URL;
}

function getPasswordResetRedirectUrl(){
  return 'https://www.axomprep.online/reset-password.html';
}

async function resendConfirmation(){
  const email=($('email')?.value||'').trim().toLowerCase();
  if(!email){setAuthMessage('Enter your email address first.','error');return}
  const btn=$('resendConfirmationBtn');
  if(btn){btn.disabled=true;btn.textContent='Sending…'}
  try{
    const {error}=await client.auth.resend({
      type:'signup',
      email,
      options:{emailRedirectTo:getAuthRedirectUrl()}
    });
    if(error) throw error;
    setAuthMessage('A fresh confirmation email has been sent. Please check your inbox and spam folder.','success');
  }catch(error){
    setAuthMessage(error?.message||'Could not resend the confirmation email right now.','error');
  }finally{
    if(btn){btn.disabled=false;btn.textContent='Resend confirmation email'}
  }
}

function openAuth(signup=false){
  ensureAuthEnhancements();
  isSignup=signup;
  $('authModal').classList.remove('hidden');
  $('tabLogin').classList.toggle('active',!signup);
  $('tabSignup').classList.toggle('active',signup);
  $('nameWrap').classList.toggle('hidden',!signup);
  $('authSubmit').textContent=signup?'Create account':'Login';
  const forgot=$('forgotPasswordLink');
  if(forgot) forgot.style.display=signup?'none':'block';
  setSignupNote(Boolean(signup));
  setResendVisible(false);
  setAuthMessage('');
}

function closeModal(){$('authModal').classList.add('hidden');setResendVisible(false);setAuthMessage('')}
function requireLogin(){openAuth(false)}

$('loginBtn').onclick=()=>openAuth(false);
$('signupBtn').onclick=()=>openAuth(true);
$('tabLogin').onclick=()=>openAuth(false);
$('tabSignup').onclick=()=>openAuth(true);

window.requestPasswordReset=async function(email){
  const cleanEmail=String(email||'').trim().toLowerCase();
  if(!cleanEmail) throw new Error('Enter your email address.');
  const {error}=await client.auth.resetPasswordForEmail(cleanEmail,{
    redirectTo:getPasswordResetRedirectUrl()
  });
  if(error) throw error;
};

$('authForm').onsubmit=async e=>{
  e.preventDefault();
  ensureAuthEnhancements();
  const email=$('email').value.trim().toLowerCase();
  const password=$('password').value;
  const name=$('fullName').value.trim();
  const button=$('authSubmit');

  if(!email||!password){setAuthMessage('Enter your email and password.','error');return}
  if(isSignup&&password.length<6){setAuthMessage('Password must be at least 6 characters.','error');return}

  button.disabled=true;
  button.textContent=isSignup?'Creating…':'Logging in…';
  setResendVisible(false);
  setAuthMessage(isSignup?'Creating your AxomPrep account…':'Checking your account…','info');

  try{
    if(isSignup){
      const {data,error}=await client.auth.signUp({
        email,
        password,
        options:{
          data:{full_name:name},
          emailRedirectTo:getAuthRedirectUrl()
        }
      });
      if(error) throw error;

      // Confirm Email ON: account exists, but no active session yet.
      if(data?.user&&!data?.session){
        $('password').value='';
        setSignupNote(true);
        setAuthMessage('Account created successfully. Check your email and click “Confirm your email” before logging in.','success');
        setResendVisible(true);
        return;
      }

      // Safety guard if the project setting is accidentally changed.
      const confirmed=Boolean(data?.user?.email_confirmed_at||data?.user?.confirmed_at);
      if(data?.user&&!confirmed){
        await client.auth.signOut();
        $('password').value='';
        setSignupNote(true);
        setAuthMessage('Account created, but the email is not confirmed yet. Please confirm it from your inbox.','error');
        setResendVisible(true);
        return;
      }

      setAuthMessage('Account created successfully.','success');
      await updateAuthUI();
      setTimeout(closeModal,700);
      return;
    }

    const {data,error}=await client.auth.signInWithPassword({email,password});
    if(error) throw error;

    const user=data?.user;
    const confirmed=Boolean(user?.email_confirmed_at||user?.confirmed_at);
    if(!confirmed){
      await client.auth.signOut();
      setAuthMessage('Your email is not confirmed yet. Check your inbox or request a new confirmation email below.','error');
      setResendVisible(true);
      return;
    }

    setAuthMessage('Logged in successfully.','success');
    await updateAuthUI();
    setTimeout(closeModal,500);
  }catch(error){
    const raw=String(error?.message||'');
    const lower=raw.toLowerCase();
    if(lower.includes('email not confirmed')||lower.includes('not confirmed')){
      setAuthMessage('Your email is not confirmed yet. Check your inbox or request a new confirmation email below.','error');
      setResendVisible(true);
    }else{
      setAuthMessage(raw||'Authentication failed. Please try again.','error');
    }
  }finally{
    button.disabled=false;
    button.textContent=isSignup?'Create account':'Login';
  }
};

async function updateAuthUI(){
  const {data}=await client.auth.getUser();
  if(data.user){
    $('loginBtn').textContent='Dashboard';
    $('loginBtn').onclick=()=>location.hash='dashboard';
    $('signupBtn').textContent='Logout';
    $('signupBtn').onclick=async()=>{await client.auth.signOut();location.reload()};
  }
}
window.updateAuthUI=updateAuthUI;

ensureAuthEnhancements();
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
