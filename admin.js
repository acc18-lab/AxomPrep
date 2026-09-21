const cfg=window.AXOMPREP_CONFIG;
const client=supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey);
const $=id=>document.getElementById(id);

function msg(id,text,hide=false){
  const e=$(id);
  e.textContent=text;
  e.classList.toggle('hidden',hide);
}

async function init(){
  const {data:{user},error:userError}=await client.auth.getUser();
  if(userError||!user){
    $('authMessage').textContent='Please log in with your AxomPrep account.';
    return;
  }

  const {data:profile,error:profileError}=await client
    .from('profiles')
    .select('role,full_name')
    .eq('id',user.id)
    .maybeSingle();

  if(profileError||profile?.role!=='admin'){
    $('authMessage').textContent='Your account does not have admin access yet.';
    return;
  }

  $('authState').classList.add('hidden');
  $('adminApp').classList.remove('hidden');
  $('adminUser').textContent=profile.full_name||user.email;

  try{
    await Promise.all([loadOptions(),loadQuestions(),loadStats(),loadCurrent()]);
  }catch(err){
    alert('Admin panel error: '+(err?.message||err));
  }
}

$('loginAdmin').onclick=()=>{
  sessionStorage.setItem('axomprep_admin_return','/admin');
  location.href='/#login';
};

$('logoutBtn').onclick=async()=>{
  await client.auth.signOut();
  location.href='index.html';
};

async function loadOptions(){
  const [e,s]=await Promise.all([
    client.from('exams').select('id,name').order('name'),
    client.from('subjects').select('id,name').order('name')
  ]);

  if(e.error) throw e.error;
  if(s.error) throw s.error;

  $('exam').innerHTML=(e.data||[])
    .map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('');

  $('subject').innerHTML=(s.data||[])
    .map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('');
}

async function loadStats(){
  const [
    {count:q,error:qError},
    {count:r,error:rError},
    {count:c,error:cError}
  ]=await Promise.all([
    client.from('questions').select('*',{count:'exact',head:true}).eq('status','published'),
    client.from('questions').select('*',{count:'exact',head:true}).in('status',['draft','review']),
    client.from('current_affairs_v1').select('*',{count:'exact',head:true})
  ]);

  if(qError) throw qError;
  if(rError) throw rError;
  if(cError) throw cError;

  $('qCount').textContent=q??0;
  $('reviewCount').textContent=r??0;
  $('caCount').textContent=c??0;
}

async function loadQuestions(){
  const {data,error}=await client
    .from('questions')
    .select('id,question,status,exam_id,subject_id,exams(name),subjects(name)')
    .order('created_at',{ascending:false})
    .limit(50);

  if(error) throw error;

  $('questionRows').innerHTML=(data||[]).map(q=>`
    <tr>
      <td>${esc(q.question).slice(0,180)}</td>
      <td>${esc(q.subjects?.name||'')}</td>
      <td>${esc(q.exams?.name||'')}</td>
      <td><span class="badge">${esc(q.status)}</span></td>
      <td><button class="btn light" onclick="setStatus('${q.id}','published')">Publish</button></td>
    </tr>
  `).join('')||'<tr><td colspan="5">No questions yet.</td></tr>';
}

window.setStatus=async(id,status)=>{
  const {error}=await client.from('questions').update({status}).eq('id',id);
  if(error) alert(error.message);
  else{
    await loadQuestions();
    await loadStats();
  }
};

$('questionForm').onsubmit=async e=>{
  e.preventDefault();

  const button=$('questionForm').querySelector('button[type="submit"]');
  const oldText=button.textContent;
  button.disabled=true;
  button.textContent='Saving...';
  msg('formMsg','Saving question...',false);

  try{
    const {data:{user},error:userError}=await client.auth.getUser();
    if(userError) throw userError;
    if(!user) throw new Error('Your login session has expired. Please log in again.');

    const tags=$('tags').value
      .split(',')
      .map(x=>x.trim())
      .filter(Boolean);

    const difficultyMap={
      Easy:'easy',
      Moderate:'medium',
      Hard:'hard'
    };

    const row={
      question:$('qtext').value.trim(),
      option_a:$('a').value.trim(),
      option_b:$('b').value.trim(),
      option_c:$('c').value.trim(),
      option_d:$('d').value.trim(),
      answer:$('answer').value,
      explanation:$('explanation').value.trim()||null,
      exam_id:$('exam').value||null,
      subject_id:$('subject').value||null,
      topic_id:null,
      difficulty:difficultyMap[$('difficulty').value]||'medium',
      year:$('year').value?Number($('year').value):null,
      tags:tags,
      status:$('status').value||'draft',
      created_by:user.id
    };

    const {data,error}=await client
      .from('questions')
      .insert(row)
      .select('id,question,status')
      .single();

    if(error){
      console.error('Supabase insert error:',error);
      throw new Error(error.message+(error.details?` | ${error.details}`:'')+(error.hint?` | Hint: ${error.hint}`:''));
    }

    msg('formMsg',`Question saved successfully. ID: ${data.id}`,false);
    $('questionForm').reset();

    await loadQuestions();
    await loadStats();

  }catch(error){
    console.error(error);
    msg('formMsg','Could not save question: '+(error?.message||error),false);
    alert('Could not save question:\n\n'+(error?.message||error));
  }finally{
    button.disabled=false;
    button.textContent=oldText;
  }
};

function parseCSV(text){
  const rows=[];let row=[],cell='',quote=false;
  for(let i=0;i<text.length;i++){
    const ch=text[i],nx=text[i+1];
    if(ch==='"'&&quote&&nx==='"'){cell+='"';i++;continue}
    if(ch==='"'){quote=!quote;continue}
    if(ch===','&&!quote){row.push(cell);cell='';continue}
    if((ch==='\n'||ch==='\r')&&!quote){
      if(ch==='\r'&&nx==='\n')i++;
      row.push(cell);cell='';
      if(row.some(v=>v.trim()))rows.push(row);
      row=[];
      continue
    }
    cell+=ch
  }
  if(cell||row.length){row.push(cell);rows.push(row)}
  return rows
}

$('importCsv').onclick=async()=>{
  const f=$('csvFile').files[0];
  if(!f){msg('csvMsg','Choose a CSV file first.');return}
  const rows=parseCSV(await f.text());
  if(rows.length<2){msg('csvMsg','CSV has no data rows.');return}

  const headers=rows[0].map(x=>x.trim().toLowerCase());
  const objects=rows.slice(1).map(r=>Object.fromEntries(headers.map((h,i)=>[h,(r[i]||'').trim()])));

  const [er,sr]=await Promise.all([
    client.from('exams').select('id,name'),
    client.from('subjects').select('id,name')
  ]);

  if(er.error) return msg('csvMsg',er.error.message);
  if(sr.error) return msg('csvMsg',sr.error.message);

  const exams=Object.fromEntries((er.data||[]).map(x=>[x.name.toLowerCase(),x.id]));
  const subjects=Object.fromEntries((sr.data||[]).map(x=>[x.name.toLowerCase(),x.id]));

  const payload=objects.filter(x=>x.question).map(x=>({
    question:x.question,
    option_a:x.option_a,
    option_b:x.option_b,
    option_c:x.option_c,
    option_d:x.option_d,
    answer:(x.answer||'A').toUpperCase(),
    explanation:x.explanation||null,
    exam_id:exams[(x.exam||'').toLowerCase()]||null,
    subject_id:subjects[(x.subject||'').toLowerCase()]||null,
    topic_id:null,
    difficulty:(x.difficulty||'medium').toLowerCase(),
    year:x.year?Number(x.year):null,
    tags:(x.tags||'').split(',').map(v=>v.trim()).filter(Boolean),
    status:x.status||'draft'
  }));

  const {error}=await client.from('questions').insert(payload);
  msg('csvMsg',error?error.message:`Imported ${payload.length} questions.`);
  if(!error){await loadQuestions();await loadStats()}
};

$('caForm').onsubmit=async e=>{
  e.preventDefault();
  const btn=$('caSaveBtn'); const old=btn.textContent; btn.disabled=true; btn.textContent='Saving...';
  try{
    const {data:{user},error:userError}=await client.auth.getUser();
    if(userError) throw userError;
    if(!user) throw new Error('Your login session has expired. Please log in again.');

    const status=$('caStatus').value||'draft';
    const row={
      title:$('caTitle').value.trim(),
      title_assamese:$('caTitleAs').value.trim()||null,
      summary:$('caSummary').value.trim()||null,
      summary_assamese:$('caSummaryAs').value.trim()||null,
      content:$('caContent').value.trim(),
      content_assamese:$('caContentAs').value.trim()||null,
      category:$('caCategory').value,
      published_date:$('caDate').value,
      source_name:$('caSource').value.trim()||null,
      source_url:$('caSourceUrl').value.trim()||null,
      image_url:$('caImage').value.trim()||null,
      status,
      featured:$('caFeatured').value==='true',
      created_by:user.id
    };

    const existingId=$('caId').value;
    const result=existingId
      ? await client.from('current_affairs_v1').update({
          title:row.title,title_assamese:row.title_assamese,summary:row.summary,summary_assamese:row.summary_assamese,
          content:row.content,content_assamese:row.content_assamese,category:row.category,published_date:row.published_date,
          source_name:row.source_name,source_url:row.source_url,image_url:row.image_url,status:row.status,
          featured:row.featured,updated_at:new Date().toISOString(),
          published_at:status==='published'?new Date().toISOString():null
        }).eq('id',existingId)
      : await client.from('current_affairs_v1').insert(row);

    if(result.error) throw result.error;
    msg('caMsg',existingId?'Current affair updated successfully.':'Current affair saved successfully.',false);
    $('caForm').reset(); $('caId').value='';
    $('caSaveBtn').textContent='Save Article';
    await loadCurrent(); await loadStats();
  }catch(err){
    console.error(err);
    msg('caMsg','Could not save current affair: '+(err?.message||err),false);
    alert('Could not save current affair:\n\n'+(err?.message||err));
  }finally{
    btn.disabled=false; btn.textContent=old;
  }
};

async function loadCurrent(){
  const {data,error}=await client
    .from('current_affairs_v1')
    .select('id,title,category,published_date,status,featured,source_name')
    .order('published_date',{ascending:false})
    .limit(200);

  if(error) throw error;

  $('caRows').innerHTML=(data||[]).map(x=>`
    <tr>
      <td>${esc(x.title)}</td>
      <td>${esc(x.category||'')}</td>
      <td>${x.published_date||''}</td>
      <td><span class="badge">${esc(x.status||'')}</span></td>
      <td>${x.featured?'Yes':'No'}</td>
      <td>
        ${x.status!=='published'?`<button class="btn light ca-publish" data-id="${x.id}">Publish</button>`:''}
        <button class="btn light ca-edit" data-id="${x.id}">Edit</button>
      </td>
    </tr>
  `).join('')||'<tr><td colspan="6">No current affairs yet.</td></tr>';

  document.querySelectorAll('.ca-publish').forEach(b=>b.onclick=()=>publishCurrent(b.dataset.id));
  document.querySelectorAll('.ca-edit').forEach(b=>b.onclick=()=>editCurrent(b.dataset.id));
}

window.publishCurrent=async id=>{
  const {error}=await client.from('current_affairs_v1').update({
    status:'published',
    published_at:new Date().toISOString(),
    updated_at:new Date().toISOString()
  }).eq('id',id);
  if(error) return alert(error.message);
  await loadCurrent(); await loadStats();
};

window.editCurrent=async id=>{
  const {data,error}=await client.from('current_affairs_v1').select('*').eq('id',id).maybeSingle();
  if(error) return alert(error.message);
  if(!data) return;
  $('caId').value=data.id||'';
  $('caTitle').value=data.title||'';
  $('caTitleAs').value=data.title_assamese||'';
  $('caSummary').value=data.summary||'';
  $('caSummaryAs').value=data.summary_assamese||'';
  $('caContent').value=data.content||'';
  $('caContentAs').value=data.content_assamese||'';
  $('caCategory').value=data.category||'Assam';
  $('caDate').value=data.published_date||'';
  $('caSource').value=data.source_name||'';
  $('caSourceUrl').value=data.source_url||'';
  $('caImage').value=data.image_url||'';
  $('caStatus').value=data.status||'draft';
  $('caFeatured').value=String(!!data.featured);
  $('caSaveBtn').textContent='Update Article';
  window.scrollTo({top:$('caForm').offsetTop-20,behavior:'smooth'});
};

$('caRefreshBtn').onclick=async()=>{
  try{await loadCurrent();await loadStats()}catch(e){alert(e.message)}
};

$('caPublishReviewBtn').onclick=async()=>{
  const ok=confirm('Publish all current-affairs articles currently in Review status?');
  if(!ok)return;
  const {error}=await client.from('current_affairs_v1').update({
    status:'published',
    published_at:new Date().toISOString(),
    updated_at:new Date().toISOString()
  }).eq('status','review');
  if(error) return alert(error.message);
  await loadCurrent(); await loadStats();
  alert('All Review current-affairs articles are now Published.');
};

$('caClearBtn').onclick=()=>{
  $('caForm').reset(); $('caId').value=''; $('caSaveBtn').textContent='Save Article';
};

function esc(s){
  return String(s??'').replace(/[&<>"']/g,m=>({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    '"':'&quot;',
    "'":'&#039;'
  }[m]));
}

document.querySelectorAll('.admin-nav button').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('.admin-nav button').forEach(x=>x.classList.remove('active'));
  b.classList.add('active');
  document.querySelectorAll('.tab').forEach(x=>x.classList.add('hidden'));
  $('tab-'+b.dataset.tab).classList.remove('hidden');
});

init();
