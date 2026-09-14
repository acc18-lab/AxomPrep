const cfg=window.AXOMPREP_CONFIG;
const client=supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey);
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const norm=s=>String(s||'').toLowerCase().replace(/\s+/g,' ').trim();
function msg(id,text,hide=false){const e=$(id);if(!e)return;e.textContent=text;e.classList.toggle('hidden',hide)}
function tagsArray(v){return Array.isArray(v)?v:String(v||'').split(',').map(x=>x.trim()).filter(Boolean)}
let allQuestions=[];let selectedQuestions=new Set();let csvValidRows=[];let csvDuplicateCount=0;

async function init(){
 const {data:{user}}=await client.auth.getUser();
 if(!user){$('authMessage').textContent='Please log in with your AxomPrep account.';return}
 const {data:profile,error}=await client.from('profiles').select('role,full_name').eq('id',user.id).maybeSingle();
 if(error||profile?.role!=='admin'){$('authMessage').textContent='Your account does not have admin access yet.';return}
 $('authState').classList.add('hidden');$('adminApp').classList.remove('hidden');$('adminUser').textContent=profile.full_name||user.email;
 await Promise.all([loadOptions(),loadStats(),loadQuestions(),loadCurrent(),loadMockBuilder()]);
}
$('loginAdmin').onclick=()=>{sessionStorage.setItem('axomprep_admin_return','/admin');location.href='/#login'};
$('logoutBtn').onclick=async()=>{await client.auth.signOut();location.href='index.html'};

async function loadOptions(){
 const [e,s]=await Promise.all([client.from('exams').select('id,name').order('name'),client.from('subjects').select('id,name').order('name')]);
 const exams=e.data||[], subjects=s.data||[];
 $('exam').innerHTML=exams.map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('');
 $('subject').innerHTML=subjects.map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('');
 $('editExam').innerHTML=exams.map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('');
 $('editSubject').innerHTML=subjects.map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('');
 $('qExamFilter').innerHTML='<option value="">All exams</option>'+exams.map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('');
 $('qSubjectFilter').innerHTML='<option value="">All subjects</option>'+subjects.map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('');
 $('mockExam').innerHTML=exams.map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('');
}
async function loadStats(){
 const [{count:q},{count:r},{count:c}]=await Promise.all([
  client.from('questions').select('*',{count:'exact',head:true}).eq('status','published'),
  client.from('questions').select('*',{count:'exact',head:true}).in('status',['draft','review']),
  client.from('current_affairs').select('*',{count:'exact',head:true})
 ]);
 $('qCount').textContent=q??0;$('reviewCount').textContent=r??0;$('caCount').textContent=c??0;
}
async function loadQuestions(){
 const {data,error}=await client.from('questions').select('id,question,option_a,option_b,option_c,option_d,answer,explanation,exam_id,subject_id,difficulty,year,tags,status,created_at,updated_at,exams(name),subjects(name)').order('created_at',{ascending:false}).limit(2000);
 if(error){msg('formMsg',error.message);return}
 allQuestions=data||[]; renderQuestions(); detectDuplicates();
}
function filteredQuestions(){
 const term=norm($('qSearch').value),exam=$('qExamFilter').value,subject=$('qSubjectFilter').value,status=$('qStatusFilter').value,diff=$('qDifficultyFilter').value;
 return allQuestions.filter(q=>(!term||norm(q.question).includes(term)||norm(q.explanation).includes(term)||tagsArray(q.tags).some(t=>norm(t).includes(term)))&&(!exam||q.exam_id===exam)&&(!subject||q.subject_id===subject)&&(!status||q.status===status)&&(!diff||q.difficulty===diff));
}
function renderQuestions(){
 const rows=filteredQuestions();
 $('questionRows').innerHTML=rows.map(q=>`<tr><td><input class="qcheck" type="checkbox" value="${q.id}" ${selectedQuestions.has(q.id)?'checked':''}></td><td><b>${esc(q.question).slice(0,220)}</b><div class="small">${tagsArray(q.tags).map(esc).join(', ')}</div></td><td>${esc(q.subjects?.name||'')}</td><td>${esc(q.exams?.name||'')}</td><td><span class="badge">${esc(q.difficulty||'')}</span></td><td><span class="badge">${esc(q.status)}</span></td><td><button class="btn light edit-q" data-id="${q.id}" type="button">Edit</button></td></tr>`).join('')||'<tr><td colspan="7">No questions match these filters.</td></tr>';
 $('questionRows').querySelectorAll('.qcheck').forEach(cb=>cb.onchange=()=>{if(cb.checked)selectedQuestions.add(cb.value);else selectedQuestions.delete(cb.value);updateSelection()});
 $('questionRows').querySelectorAll('.edit-q').forEach(b=>b.onclick=()=>editQuestion(b.dataset.id));
 updateSelection();
}
function updateSelection(){$('qSelectionCount').textContent=`${selectedQuestions.size} selected`;const visible=filteredQuestions().map(q=>q.id);$('questionMaster').checked=visible.length>0&&visible.every(id=>selectedQuestions.has(id));}
function detectDuplicates(){
 const seen=new Map(),dupes=[];for(const q of allQuestions){const k=norm(q.question);if(!k)continue;if(seen.has(k))dupes.push(q);else seen.set(k,q)}
 if(dupes.length){msg('duplicateNotice',`${dupes.length} duplicate question(s) detected by normalized question text. Review them before publishing.`);$('duplicateNotice').classList.remove('hidden')}else{$('duplicateNotice').classList.add('hidden')}
}
['qSearch','qExamFilter','qSubjectFilter','qStatusFilter','qDifficultyFilter'].forEach(id=>$(id).addEventListener('input',renderQuestions));
$('questionMaster').onchange=()=>{const ids=filteredQuestions().map(q=>q.id);ids.forEach(id=>$('questionMaster').checked?selectedQuestions.add(id):selectedQuestions.delete(id));renderQuestions()};
$('selectAllQuestions').onclick=()=>{filteredQuestions().forEach(q=>selectedQuestions.add(q.id));renderQuestions()};
$('clearQuestionSelection').onclick=()=>{selectedQuestions.clear();renderQuestions()};
$('applyBulkStatus').onclick=async()=>{
  const status=$('bulkStatus').value;
  if(!status){alert('Choose a status first.');return}
  if(!selectedQuestions.size){alert('Select at least one question first.');return}

  const ids=[...selectedQuestions];
  const button=$('applyBulkStatus');
  const oldText=button.textContent;
  button.disabled=true;
  button.textContent='Applying...';

  try{
    const {data:{user},error:userError}=await client.auth.getUser();
    if(userError) throw userError;
    if(!user) throw new Error('Your login session has expired. Please log in again.');

    const {data:profile,error:profileError}=await client
      .from('profiles')
      .select('role')
      .eq('id',user.id)
      .maybeSingle();
    if(profileError) throw profileError;
    if(profile?.role!=='admin') throw new Error('Admin access is required.');

    // Update in batches so a large ADRE selection does not fail because of a long request.
    let updated=0;
    const now=new Date().toISOString();

    for(let i=0;i<ids.length;i+=50){
      const batch=ids.slice(i,i+50);
      const {error}=await client
        .from('questions')
        .update({status,updated_at:now})
        .in('id',batch);

      if(error) throw new Error(error.message+(error.details?` | ${error.details}`:'')+(error.hint?` | Hint: ${error.hint}`:''));
      updated+=batch.length;
    }

    selectedQuestions.clear();
    $('bulkStatus').value='';
    msg('formMsg',`${updated} question(s) moved to ${status}.`);
    alert(`${updated} question(s) successfully moved to ${status}.`);
    await loadQuestions();
    await loadStats();
  }catch(error){
    console.error('Bulk status update failed:',error);
    msg('formMsg','Bulk update failed: '+(error?.message||error));
    alert('Bulk update failed:\\n\\n'+(error?.message||error));
  }finally{
    button.disabled=false;
    button.textContent=oldText;
  }
};

function populateEdit(q){
 $('editId').value=q.id;$('editQtext').value=q.question||'';$('editA').value=q.option_a||'';$('editB').value=q.option_b||'';$('editC').value=q.option_c||'';$('editD').value=q.option_d||'';$('editAnswer').value=q.answer||'A';$('editExam').value=q.exam_id||'';$('editSubject').value=q.subject_id||'';$('editDifficulty').value=q.difficulty||'medium';$('editYear').value=q.year||'';$('editExplanation').value=q.explanation||'';$('editStatus').value=q.status||'draft';$('editTags').value=tagsArray(q.tags).join(', ');
 document.querySelectorAll('.admin-nav button').forEach(x=>x.classList.toggle('active',x.dataset.tab==='edit'));document.querySelectorAll('.tab').forEach(x=>x.classList.add('hidden'));$('tab-edit').classList.remove('hidden');window.scrollTo({top:0,behavior:'smooth'});
}
function editQuestion(id){const q=allQuestions.find(x=>x.id===id);if(q)populateEdit(q)}
$('cancelEdit').onclick=()=>{document.querySelector('[data-tab="questions"]').click()};
$('editQuestionForm').onsubmit=async e=>{e.preventDefault();const id=$('editId').value;const row={question:$('editQtext').value.trim(),option_a:$('editA').value.trim(),option_b:$('editB').value.trim(),option_c:$('editC').value.trim(),option_d:$('editD').value.trim(),answer:$('editAnswer').value,explanation:$('editExplanation').value.trim()||null,exam_id:$('editExam').value||null,subject_id:$('editSubject').value||null,difficulty:$('editDifficulty').value,year:$('editYear').value?Number($('editYear').value):null,tags:tagsArray($('editTags').value),status:$('editStatus').value,updated_at:new Date().toISOString()};const {error}=await client.from('questions').update(row).eq('id',id);msg('editMsg',error?error.message:'Question updated successfully.');if(!error){await loadQuestions();await loadStats()}};

$('questionForm').onsubmit=async e=>{e.preventDefault();const {data:{user}}=await client.auth.getUser();const row={question:$('qtext').value.trim(),option_a:$('a').value.trim(),option_b:$('b').value.trim(),option_c:$('c').value.trim(),option_d:$('d').value.trim(),answer:$('answer').value,explanation:$('explanation').value.trim()||null,exam_id:$('exam').value||null,subject_id:$('subject').value||null,difficulty:$('difficulty').value.toLowerCase()==='moderate'?'medium':$('difficulty').value.toLowerCase(),year:$('year').value?Number($('year').value):null,tags:tagsArray($('tags').value),status:$('status').value,created_by:user?.id||null};const {error}=await client.from('questions').insert(row);msg('formMsg',error?error.message:'Question saved successfully.');if(!error){$('questionForm').reset();await loadQuestions();await loadStats()}};

function parseCSV(text){const rows=[];let row=[],cell='',quote=false;for(let i=0;i<text.length;i++){const ch=text[i],nx=text[i+1];if(ch==='"'&&quote&&nx==='"'){cell+='"';i++;continue}if(ch==='"'){quote=!quote;continue}if(ch===','&&!quote){row.push(cell);cell='';continue}if((ch==='\n'||ch==='\r')&&!quote){if(ch==='\r'&&nx==='\n')i++;row.push(cell);cell='';if(row.some(v=>v.trim()))rows.push(row);row=[];continue}cell+=ch}if(cell||row.length){row.push(cell);rows.push(row)}return rows}
async function previewCSV(){
 const f=$('csvFile').files[0];if(!f){msg('csvMsg','Choose a CSV file first.');return}
 const rows=parseCSV(await f.text());if(rows.length<2){msg('csvMsg','CSV has no data rows.');return}
 const headers=rows[0].map(x=>x.trim().toLowerCase());const required=['question','option_a','option_b','option_c','option_d','answer'];const missing=required.filter(x=>!headers.includes(x));if(missing.length){msg('csvMsg','Missing required columns: '+missing.join(', '));return}
 const objects=rows.slice(1).map((r,i)=>({line:i+2,...Object.fromEntries(headers.map((h,j)=>[h,(r[j]||'').trim()]))}));
 const [er,sr,qr]=await Promise.all([client.from('exams').select('id,name'),client.from('subjects').select('id,name'),client.from('questions').select('question')]);
 const exams=Object.fromEntries((er.data||[]).map(x=>[norm(x.name),x.id])),subjects=Object.fromEntries((sr.data||[]).map(x=>[norm(x.name),x.id])),existing=new Set((qr.data||[]).map(x=>norm(x.question))),fileSeen=new Set();csvDuplicateCount=0;
 csvValidRows=[];const preview=[];
 for(const x of objects){let reason='';const ans=(x.answer||'').toUpperCase();if(!x.question||!x.option_a||!x.option_b||!x.option_c||!x.option_d||!['A','B','C','D'].includes(ans))reason='Missing required data';else if(existing.has(norm(x.question))||fileSeen.has(norm(x.question))){reason='Duplicate question';csvDuplicateCount++}else{fileSeen.add(norm(x.question));csvValidRows.push({question:x.question,option_a:x.option_a,option_b:x.option_b,option_c:x.option_c,option_d:x.option_d,answer:ans,explanation:x.explanation||null,exam_id:exams[norm(x.exam)]||null,subject_id:subjects[norm(x.subject)]||null,difficulty:(x.difficulty||'medium').toLowerCase()==='moderate'?'medium':(x.difficulty||'medium').toLowerCase(),year:x.year?Number(x.year):null,tags:tagsArray(x.tags),status:x.status||'draft'});reason='Valid'}preview.push({line:x.line,question:x.question,result:reason,exam:x.exam||'',subject:x.subject||''})}
 $('csvPreview').innerHTML=`<table class="admin-table"><thead><tr><th>Line</th><th>Question</th><th>Exam</th><th>Subject</th><th>Result</th></tr></thead><tbody>${preview.slice(0,200).map(x=>`<tr><td>${x.line}</td><td>${esc(x.question).slice(0,180)}</td><td>${esc(x.exam)}</td><td>${esc(x.subject)}</td><td><span class="badge">${esc(x.result)}</span></td></tr>`).join('')}</tbody></table>`;
 $('importCsv').disabled=!csvValidRows.length;msg('csvMsg',`Preview complete: ${csvValidRows.length} valid, ${csvDuplicateCount} duplicate, ${objects.length-csvValidRows.length-csvDuplicateCount} invalid.`);
}
$('previewCsv').onclick=previewCSV;
$('importCsv').onclick=async()=>{if(!csvValidRows.length){msg('csvMsg','Preview the CSV first.');return}const {data:{user}}=await client.auth.getUser();const payload=csvValidRows.map(x=>({...x,created_by:user?.id||null}));const {error}=await client.from('questions').insert(payload);if(error){msg('csvMsg',error.message);return}msg('csvMsg',`Imported ${payload.length} questions successfully.`);csvValidRows=[];$('importCsv').disabled=true;await loadQuestions();await loadStats()};

$('caForm').onsubmit=async e=>{e.preventDefault();const row={title:$('caTitle').value,content:$('caContent').value,category:$('caCategory').value,published_date:$('caDate').value,is_published:$('caPublish').value==='true'};const {error}=await client.from('current_affairs').insert(row);msg('caMsg',error?'Error: '+error.message:'Current affair saved.');if(!error){$('caForm').reset();await loadCurrent();await loadStats()}};
async function loadCurrent(){const {data,error}=await client.from('current_affairs').select('title,category,published_date,is_published').order('published_date',{ascending:false}).limit(30);if(error){msg('caMsg',error.message);return}$('caRows').innerHTML=(data||[]).map(x=>`<tr><td>${esc(x.title)}</td><td>${esc(x.category||'')}</td><td>${x.published_date||''}</td><td>${x.is_published?'Yes':'No'}</td></tr>`).join('')||'<tr><td colspan="4">No current affairs yet.</td></tr>'}

// Mock test builder retained and initialized correctly.
let mockQuestions=[];let mockSelected=new Set();
async function loadMockBuilder(){const {data:exams}=await client.from('exams').select('id,name').order('name');$('mockExam').innerHTML=(exams||[]).map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('');const {data,error}=await client.from('questions').select('id,question,year,subjects(name),exams(name)').eq('status','published').order('created_at',{ascending:false}).limit(1000);if(error){msg('mockMsg',error.message);return}mockQuestions=data||[];renderMockPicker();await loadMockTests()}
function renderMockPicker(){const term=norm($('mockSearch').value);const rows=mockQuestions.filter(q=>!term||norm(q.question).includes(term)||norm(q.subjects?.name).includes(term)||norm(q.exams?.name).includes(term));$('mockQuestionPicker').innerHTML=rows.map(q=>`<label class="mock-q ${mockSelected.has(q.id)?'selected':''}"><input type="checkbox" value="${q.id}" ${mockSelected.has(q.id)?'checked':''}><span><p>${esc(q.question)}</p><small>${esc(q.exams?.name||'')} • ${esc(q.subjects?.name||'')}${q.year?' • '+q.year:''}</small></span></label>`).join('')||'<div class="notice">No published questions found.</div>';$('mockQuestionPicker').querySelectorAll('input').forEach(cb=>cb.onchange=()=>{if(cb.checked)mockSelected.add(cb.value);else mockSelected.delete(cb.value);cb.closest('.mock-q').classList.toggle('selected',cb.checked);updateMockCount()});updateMockCount()}
function updateMockCount(){if($('mockSelectedCount'))$('mockSelectedCount').textContent=`${mockSelected.size} question${mockSelected.size===1?'':'s'} selected`}
$('mockSearch').addEventListener('input',renderMockPicker);$('selectVisible').addEventListener('click',()=>{$('mockQuestionPicker').querySelectorAll('input').forEach(cb=>{mockSelected.add(cb.value);cb.checked=true;cb.closest('.mock-q').classList.add('selected')});updateMockCount()});$('clearSelected').addEventListener('click',()=>{mockSelected.clear();renderMockPicker()});$('mockForm').addEventListener('reset',()=>setTimeout(()=>{mockSelected.clear();renderMockPicker()},0));
async function loadMockTests(){const {data,error}=await client.from('mock_tests_v1').select('id,code,title,duration_minutes,total_questions,status,exam_id,exams(name)').order('created_at',{ascending:false}).limit(100);if(error){msg('mockMsg',error.message);return}$('mockRows').innerHTML=(data||[]).map(t=>`<tr><td><b>${esc(t.title)}</b><div class="small">${esc(t.code)}</div></td><td>${esc(t.exams?.name||'')}</td><td>${t.total_questions}</td><td>${t.duration_minutes} min</td><td><span class="badge">${esc(t.status)}</span></td><td><button class="btn light" onclick="setMockStatus('${t.id}','${t.status==='published'?'draft':'published'}')">${t.status==='published'?'Unpublish':'Publish'}</button></td></tr>`).join('')||'<tr><td colspan="6">No mock tests yet.</td></tr>'}
window.setMockStatus=async(id,status)=>{const {error}=await client.from('mock_tests_v1').update({status,updated_at:new Date().toISOString()}).eq('id',id);if(error)msg('mockMsg',error.message);else{msg('mockMsg',`Mock test ${status}.`);await loadMockTests()}};
$('mockForm').addEventListener('submit',async e=>{e.preventDefault();const total=Number($('mockTotal').value);if(mockSelected.size!==total){msg('mockMsg',`Select exactly ${total} questions before saving. You currently selected ${mockSelected.size}.`);return}const {data:{user}}=await client.auth.getUser();if(!user){msg('mockMsg','Login session expired.');return}const row={code:$('mockCode').value.trim(),title:$('mockTitle').value.trim(),description:$('mockDescription').value.trim()||null,exam_id:$('mockExam').value||null,duration_minutes:Number($('mockDuration').value),total_questions:total,marks_per_question:Number($('mockMarks').value),negative_mark:Number($('mockNegative').value||0),status:$('mockStatus').value,created_by:user.id,updated_at:new Date().toISOString()};const ins=await client.from('mock_tests_v1').insert(row).select('id').single();if(ins.error){msg('mockMsg',ins.error.message);return}const links=[...mockSelected].map((question_id,i)=>({mock_test_id:ins.data.id,question_id,question_order:i+1}));const link=await client.from('mock_test_questions_v1').insert(links);if(link.error){await client.from('mock_tests_v1').delete().eq('id',ins.data.id);msg('mockMsg','Test was not saved: '+link.error.message);return}msg('mockMsg',`Mock test “${row.title}” saved successfully.`);$('mockForm').reset();await loadMockTests()});

document.querySelectorAll('.admin-nav button').forEach(b=>b.onclick=()=>{document.querySelectorAll('.admin-nav button').forEach(x=>x.classList.remove('active'));b.classList.add('active');document.querySelectorAll('.tab').forEach(x=>x.classList.add('hidden'));$('tab-'+b.dataset.tab).classList.remove('hidden')});
init();
