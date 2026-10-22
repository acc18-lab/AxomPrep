const cfg=window.AXOMPREP_CONFIG;
const client=window.AXOMPREP_AUTH_CLIENT || supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey);
window.AXOMPREP_AUTH_CLIENT=client;
let initInProgress=false;
const $=id=>document.getElementById(id);

function msg(id,text,hide=false){
  const e=$(id);
  e.textContent=text;
  e.classList.toggle('hidden',hide);
}

async function init(){
  if(initInProgress) return;
  initInProgress=true;
  $('authState').classList.remove('hidden');
  $('adminApp').classList.add('hidden');
  $('authMessage').textContent='Checking your account…';
  try {
    const {data:{session},error:sessionError}=await client.auth.getSession();
    const user=session?.user||null;
    const account=$('adminHeaderAccount');
    const logout=$('logoutBtn');
    if(account) account.textContent=user ? (user.email||'Signed in') : '';
    if(logout) logout.classList.toggle('hidden',!user);
    if(sessionError||!user){
      $('authMessage').textContent=sessionError ? 'Could not check your session: '+sessionError.message : 'Please log in with your AxomPrep account.';
      return;
    }
    const {data:profile,error:profileError}=await client
      .from('profiles')
      .select('role,full_name')
      .eq('id',user.id)
      .maybeSingle();
    if(profileError||profile?.role!=='admin'){
      $('authMessage').textContent=profileError
        ? 'Could not verify admin permissions: '+profileError.message
        : 'You are logged in, but this account does not have admin access. Ask an administrator to set profiles.role to admin.';
      return;
    }
    $('authState').classList.add('hidden');
    $('adminApp').classList.remove('hidden');
    $('adminUser').textContent=profile.full_name||user.email;
    try { await Promise.all([loadOptions(),loadQuestions(),loadStats(),loadCurrent(),loadBooksAdmin()]); }
    catch(err) { $('authMessage').textContent='Admin data could not load: '+(err?.message||err); $('authState').classList.remove('hidden'); $('adminApp').classList.add('hidden'); }
  } catch(err) {
    $('authMessage').textContent='Admin check failed: '+(err?.message||err);
    $('authState').classList.remove('hidden'); $('adminApp').classList.add('hidden');
  } finally { initInProgress=false; }
}

$('loginAdmin').onclick=()=>{
  sessionStorage.setItem('axomprep_admin_return','/admin.html');
  location.href='/index.html#login';
};

$('logoutBtn').onclick=async()=>{
  const button=$('logoutBtn'); button.disabled=true;
  try { await client.auth.signOut(); } finally { location.href='/index.html'; }
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
    client.from('current_affairs').select('*',{count:'exact',head:true})
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

let csvPreviewObjects=[];
let csvPayload=[];

function normalizeTags(value){
  const s=String(value||'').trim();
  if(!s) return [];
  // Accept both PostgreSQL array-literal format: {PRACTICE,GENERATED}
  // and normal comma-separated CSV format: PRACTICE,GENERATED
  if(s.startsWith('{')&&s.endsWith('}')){
    return s.slice(1,-1).split(',').map(v=>v.trim().replace(/^"|"$/g,'')).filter(Boolean);
  }
  return s.split(',').map(v=>v.trim()).filter(Boolean);
}

function showCsvPreview(objects){
  const wrap=$('csvPreview');
  if(!objects.length){
    wrap.innerHTML='<div class="notice">No question rows found.</div>';
    return;
  }

  const sample=objects.slice(0,50);
  const bad=[];
  sample.forEach((x,i)=>{
    const row=i+2;
    if(!x.question) bad.push(`Row ${row}: question is empty`);
    if(!x.option_a||!x.option_b||!x.option_c||!x.option_d) bad.push(`Row ${row}: one or more options are empty`);
    if(!['A','B','C','D'].includes((x.answer||'').toUpperCase())) bad.push(`Row ${row}: answer must be A, B, C or D`);
    if(x.difficulty && !['easy','medium','hard'].includes(x.difficulty.toLowerCase())) bad.push(`Row ${row}: invalid difficulty "${x.difficulty}"`);
  });

  const html = `
    <div class="notice"><b>Preview:</b> showing ${sample.length} of ${objects.length} rows. ${
      bad.length ? `<span class="danger">${bad.length} validation issue(s) found in preview.</span>` :
      '<span>Preview looks valid.</span>'
    }</div>
    ${bad.length ? `<div class="notice"><div class="danger">${bad.slice(0,15).map(escapeHtml).join('<br>')}</div></div>` : ''}
    <div class="table-wrap">
      <table class="admin-table">
        <thead><tr><th>#</th><th>Question</th><th>A</th><th>B</th><th>C</th><th>D</th><th>Answer</th><th>Subject</th><th>Topic</th><th>Difficulty</th></tr></thead>
        <tbody>
          ${sample.map((x,i)=>`
            <tr>
              <td>${i+1}</td>
              <td>${escapeHtml(x.question||'')}</td>
              <td>${escapeHtml(x.option_a||'')}</td>
              <td>${escapeHtml(x.option_b||'')}</td>
              <td>${escapeHtml(x.option_c||'')}</td>
              <td>${escapeHtml(x.option_d||'')}</td>
              <td><span class="badge">${escapeHtml((x.answer||'').toUpperCase())}</span></td>
              <td>${escapeHtml(x.subject||'')}</td>
              <td>${escapeHtml(x.topic||'')}</td>
              <td>${escapeHtml((x.difficulty||'medium').toLowerCase())}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>`;
  wrap.innerHTML=html;
}

function escapeHtml(value){
  return String(value??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
}

async function buildCsvPayload(){
  const f=$('csvFile').files[0];
  if(!f) throw new Error('Choose a CSV file first.');
  const rows=parseCSV(await f.text());
  if(rows.length<2) throw new Error('CSV has no data rows.');

  const headers=rows[0].map(x=>x.trim().toLowerCase());
  const required=['question','option_a','option_b','option_c','option_d','answer'];
  const missing=required.filter(h=>!headers.includes(h));
  if(missing.length) throw new Error('Missing required columns: '+missing.join(', '));

  csvPreviewObjects=rows.slice(1)
    .map(r=>Object.fromEntries(headers.map((h,i)=>[h,(r[i]||'').trim()])))
    .filter(x=>x.question);

  const [er,sr]=await Promise.all([
    client.from('exams').select('id,name'),
    client.from('subjects').select('id,name')
  ]);
  if(er.error) throw er.error;
  if(sr.error) throw sr.error;

  const exams=Object.fromEntries((er.data||[]).map(x=>[x.name.toLowerCase(),x.id]));
  const subjects=Object.fromEntries((sr.data||[]).map(x=>[x.name.toLowerCase(),x.id]));

  csvPayload=csvPreviewObjects.map(x=>({
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
    tags:normalizeTags(x.tags),
    status:x.status||'draft'
  }));

  return {rows,payload:csvPayload};
}

$('previewCsv').onclick=async()=>{
  const button=$('previewCsv');
  const old=button.textContent;
  button.disabled=true;
  button.textContent='Previewing...';
  $('importCsv').disabled=true;
  try{
    const {payload}=await buildCsvPayload();
    showCsvPreview(csvPreviewObjects);
    const invalid=payload.filter(x=>
      !x.question||!x.option_a||!x.option_b||!x.option_c||!x.option_d||
      !['A','B','C','D'].includes(x.answer)||
      !['easy','medium','hard'].includes(x.difficulty)
    );
    if(invalid.length){
      msg('csvMsg',`Preview found ${invalid.length} invalid row(s). Fix the CSV before importing.`);
    }else{
      msg('csvMsg',`Preview ready: ${payload.length} valid question rows. Import is now enabled.`);
      $('importCsv').disabled=false;
    }
  }catch(error){
    console.error(error);
    $('csvPreview').innerHTML='';
    msg('csvMsg',error?.message||String(error));
  }finally{
    button.disabled=false;
    button.textContent=old;
  }
};

$('csvFile').onchange=()=>{
  $('importCsv').disabled=true;
  $('csvPreview').innerHTML='';
  $('csvMsg').classList.add('hidden');
};

$('importCsv').onclick=async()=>{
  const button=$('importCsv');
  if(!csvPayload.length){
    msg('csvMsg','Please click Preview CSV first.');
    return;
  }

  button.disabled=true;
  const old=button.textContent;
  button.textContent='Importing...';

  try{
    const {error}=await client.from('questions').insert(csvPayload);
    if(error) throw error;
    msg('csvMsg',`Imported ${csvPayload.length} questions successfully.`);
    await loadQuestions();
    await loadStats();
    $('csvPreview').insertAdjacentHTML('afterbegin','<div class="notice">Import complete.</div>');
    csvPayload=[];
  }catch(error){
    console.error(error);
    msg('csvMsg',error?.message||String(error));
  }finally{
    button.disabled=false;
    button.textContent=old;
  }
};

$('caForm').onsubmit=async e=>{
  e.preventDefault();
  const row={
    title:$('caTitle').value,
    content:$('caContent').value,
    category:$('caCategory').value,
    published_date:$('caDate').value,
    is_published:$('caPublish').value==='true'
  };
  const {error}=await client.from('current_affairs').insert(row);
  msg('caMsg',error?error.message:'Current affair saved.');
  if(!error){
    $('caForm').reset();
    await loadCurrent();
    await loadStats();
  }
};

async function loadCurrent(){
  const {data,error}=await client
    .from('current_affairs')
    .select('title,category,published_date,is_published')
    .order('published_date',{ascending:false})
    .limit(30);

  if(error) throw error;

  $('caRows').innerHTML=(data||[]).map(x=>`
    <tr>
      <td>${esc(x.title)}</td>
      <td>${esc(x.category||'')}</td>
      <td>${x.published_date||''}</td>
      <td>${x.is_published?'Yes':'No'}</td>
    </tr>
  `).join('')||'<tr><td colspan="4">No current affairs yet.</td></tr>';
}

// Books CMS: uploads cover images to Supabase Storage and saves book details to books_v1.
let adminBooksCache=[];
function bookMsg(text,hide=false){const e=$('bookAdminMsg');if(!e)return;e.textContent=text;e.classList.toggle('hidden',hide);}
function safeHttpUrl(v){if(!v)return null;try{const u=new URL(v);return /^https?:$/.test(u.protocol)?u.href:null;}catch(_){return null;}}
function clearBookForm(){
  $('bookAdminForm').reset();$('bookAdminId').value='';$('bookExistingCover').value='';$('bookCoverFile').value='';$('bookCoverPreview').src='';$('bookCoverPreview').hidden=true;$('bookSaveBtn').textContent='Save book';bookMsg('',true);
}
$('bookCoverFile')?.addEventListener('change',()=>{
  const file=$('bookCoverFile').files?.[0];const img=$('bookCoverPreview');
  if(!file){img.hidden=true;return;}
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024){bookMsg('Choose a JPG, PNG or WebP image smaller than 5 MB.');$('bookCoverFile').value='';img.hidden=true;return;}
  img.src=URL.createObjectURL(file);img.hidden=false;bookMsg('',true);
});
$('bookClearBtn')?.addEventListener('click',clearBookForm);
$('bookRefreshBtn')?.addEventListener('click',loadBooksAdmin);
async function loadBooksAdmin(){
  const tbody=$('bookAdminRows');if(!tbody||!client)return;
  tbody.innerHTML='<tr><td colspan="7">Loading books…</td></tr>';
  const {data,error}=await client.from('books_v1').select('*').order('created_at',{ascending:false}).limit(500);
  if(error){tbody.innerHTML='<tr><td colspan="7">Could not load books: '+esc(error.message)+'</td></tr>';return;}
  adminBooksCache=data||[];
  tbody.innerHTML=adminBooksCache.map(b=>{const mappedCover=window.getAxomPrepBookCover?.(b)||'';const directCover=String(b.cover_url||'').trim();const cover=mappedCover||directCover;const coverCell=cover?`<img class="book-row-cover" src="${esc(cover)}" data-direct-fallback="${esc(directCover)}" alt="${esc((b.title||'Book')+' cover')}" loading="lazy" onerror="axAdminBookCoverError(this)">`:`<span class="book-row-cover-empty">No cover</span>`;return `<tr><td>${coverCell}</td><td><strong>${esc(b.title||'Untitled')}</strong><div class="small">${esc(b.author||'')}</div></td><td>${esc(b.category||'')}</td><td>${b.price==null?'—':'₹'+esc(b.price)}</td><td><span class="badge">${esc(b.status||'draft')}</span></td><td>${b.featured?'Yes':'No'}</td><td><button class="btn light" type="button" data-book-edit="${esc(b.id)}">Edit</button> <button class="btn light danger" type="button" data-book-delete="${esc(b.id)}">Delete</button></td></tr>`}).join('')||'<tr><td colspan="7">No books yet. Add one using the form above.</td></tr>';
}
window.axAdminBookCoverError=function(img){
  if(!img||img.dataset.coverErrorHandled==='1')return;
  const fallback=img.dataset.directFallback||'';
  if(fallback && img.src!==fallback && !img.dataset.triedDirectFallback){img.dataset.triedDirectFallback='1';img.src=fallback;return;}
  img.dataset.coverErrorHandled='1';
  const box=document.createElement('span');box.className='book-row-cover-empty';box.textContent='No cover';img.replaceWith(box);
};
function editBookAdmin(id){
  const b=adminBooksCache.find(x=>String(x.id)===String(id));if(!b)return;
  $('bookAdminId').value=b.id||'';$('bookExistingCover').value=b.cover_url||'';$('bookTitle').value=b.title||'';$('bookAuthor').value=b.author||'';$('bookCategory').value=b.category||'';$('bookExamName').value=b.exam_name||'';$('bookPrice').value=b.price??'';$('bookStatus').value=b.status||'draft';$('bookFeatured').value=String(!!b.featured);$('bookDescription').value=b.description||'';$('bookAmazonUrl').value=b.amazon_url||'';$('bookFlipkartUrl').value=b.flipkart_url||'';$('bookCoverFile').value='';
  const img=$('bookCoverPreview');const editCover=window.getAxomPrepBookCover?.(b)||b.cover_url||'';img.src=editCover;img.hidden=!editCover;$('bookSaveBtn').textContent='Save changes';bookMsg('Editing: '+(b.title||'book'),true);$('tab-books').scrollIntoView({behavior:'smooth',block:'start'});
}
$('bookAdminRows')?.addEventListener('click',async e=>{
  const edit=e.target.closest('[data-book-edit]');if(edit){editBookAdmin(edit.dataset.bookEdit);return;}
  const del=e.target.closest('[data-book-delete]');if(!del)return;
  const b=adminBooksCache.find(x=>String(x.id)===String(del.dataset.bookDelete));if(!b||!confirm(`Delete “${b.title}” from the Books page?`))return;
  del.disabled=true;const {error}=await client.from('books_v1').delete().eq('id',b.id);
  if(error){bookMsg('Delete failed: '+error.message);del.disabled=false;return;}
  if($('bookAdminId').value===String(b.id))clearBookForm();bookMsg('Book deleted.');await loadBooksAdmin();
});
async function saveBookAdmin(){
  const form=$('bookAdminForm');const btn=$('bookSaveBtn');
  if(!form||!btn)return;
  btn.disabled=true;const originalText=btn.textContent;btn.textContent='Saving…';
  bookMsg('Saving book details…',false);
  try{
    if(!client)throw new Error('Supabase client is not initialized. Refresh the page and sign in again.');
    const {data:{user},error:userError}=await client.auth.getUser();
    if(userError)throw userError;
    if(!user)throw new Error('Your login session has expired. Please sign in again.');
    const title=$('bookTitle').value.trim();
    const category=$('bookCategory').value.trim();
    if(!title)throw new Error('Enter a book title.');
    if(!category)throw new Error('Enter a book category.');
    let coverUrl=$('bookExistingCover').value||null;const file=$('bookCoverFile').files?.[0];
    if(file){
      if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024)throw new Error('Cover must be JPG, PNG or WebP and smaller than 5 MB.');
      const ext=file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg';
      const path=`${Date.now()}-${crypto.randomUUID?crypto.randomUUID():Math.random().toString(36).slice(2)}.${ext}`;
      const {error:uploadError}=await client.storage.from('book-covers').upload(path,file,{contentType:file.type,cacheControl:'3600',upsert:false});
      if(uploadError)throw new Error('Cover upload failed: '+uploadError.message+' (check the book-covers bucket and its Storage policies).');
      coverUrl=client.storage.from('book-covers').getPublicUrl(path).data.publicUrl;
    }
    const rawPrice=$('bookPrice').value;
    const payload={title,author:$('bookAuthor').value.trim()||null,category,exam_name:$('bookExamName').value.trim()||null,description:$('bookDescription').value.trim()||null,cover_url:coverUrl,amazon_url:safeHttpUrl($('bookAmazonUrl').value.trim()),flipkart_url:safeHttpUrl($('bookFlipkartUrl').value.trim()),price:rawPrice===''?null:Number(rawPrice),status:$('bookStatus').value,featured:$('bookFeatured').value==='true'};
    if(payload.price!==null&&(!Number.isFinite(payload.price)||payload.price<0))throw new Error('Price must be zero or higher.');
    const id=$('bookAdminId').value;let result;
    if(id)result=await client.from('books_v1').update(payload).eq('id',id);
    else result=await client.from('books_v1').insert(payload);
    if(result.error)throw result.error;
    clearBookForm();bookMsg(id?'Book updated successfully.':'Book added successfully. Published books appear on the Books page; featured published books can appear on the homepage.');
    await loadBooksAdmin();
  }catch(err){
    console.error('[AxomPrep Books Admin] Save failed:',err);
    bookMsg('Save failed: '+(err?.message||String(err))+' — check Supabase table columns, admin role and RLS policies.');
  }finally{btn.disabled=false;btn.textContent=$('bookAdminId').value?'Save changes':'Save book';}
}
$('bookSaveBtn')?.addEventListener('click',saveBookAdmin);
$('bookAdminForm')?.addEventListener('submit',async e=>{e.preventDefault();await saveBookAdmin();});

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
  if(b.dataset.tab==='books') loadBooksAdmin();
});

client.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') {
    init();
  }
});
init();
