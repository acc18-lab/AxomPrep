const cfg=window.AXOMPREP_CONFIG;
const sb=supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey);
const $=id=>document.getElementById(id);
let rows=[],selected=new Set(),examNames={},subjectNames={};

const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const isPYQ=r=>Array.isArray(r.tags)&&r.tags.some(t=>String(t).trim().toUpperCase()==='PYQ');

function note(text){$('notice').textContent=text;$('notice').classList.add('show');setTimeout(()=>$('notice').classList.remove('show'),3500)}

async function auth(){
 const {data:{user},error}=await sb.auth.getUser();
 if(error||!user){location.href='index.html#login';return false}
 const {data:p}=await sb.from('profiles').select('role').eq('id',user.id).maybeSingle();
 if(p?.role!=='admin'){$('notice').textContent='Admin access required.';$('notice').classList.add('show');return false}
 return true
}

async function lookups(){
 const [{data:e,error:ee},{data:s,error:se}]=await Promise.all([
  sb.from('exams').select('id,name').order('name'),
  sb.from('subjects').select('id,name').order('name')
 ]);
 if(ee)throw ee;if(se)throw se;
 $('exam').innerHTML='<option value="">All exams</option>';
 (e||[]).forEach(x=>{examNames[x.id]=x.name;$('exam').insertAdjacentHTML('beforeend',`<option value="${x.id}">${esc(x.name)}</option>`)});
 $('subject').innerHTML='<option value="">All subjects</option>';
 (s||[]).forEach(x=>{subjectNames[x.id]=x.name;$('subject').insertAdjacentHTML('beforeend',`<option value="${x.id}">${esc(x.name)}</option>`)});
}

async function load(){
 const exam=$('exam').value,subject=$('subject').value,status=$('status').value,pyq=$('pyq').value,search=$('search').value.trim();
 let q=sb.from('questions').select('id,question,exam_id,subject_id,year,status,tags,created_at').order('created_at',{ascending:false}).limit(500);
 if(exam)q=q.eq('exam_id',exam);if(subject)q=q.eq('subject_id',subject);if(status)q=q.eq('status',status);if(search)q=q.ilike('question',`%${search}%`);
 const {data,error}=await q;if(error){note(error.message);return}
 rows=(data||[]).filter(r=>pyq==='yes'?isPYQ(r):pyq==='no'?!isPYQ(r):true);
 selected.clear();$('master').checked=false;render()
}

function render(){
 const pyqs=rows.filter(isPYQ).length,years=rows.filter(r=>r.year).length;
 $('visible').textContent=rows.length;$('pyqs').textContent=pyqs;$('withYear').textContent=years;$('selectedCount').textContent=`${selected.size} selected`;
 $('rows').innerHTML=rows.length?rows.map(r=>{
   const tags=(r.tags||[]).map(t=>`<span class="tag ${String(t).toUpperCase()==='PYQ'?'pyq':''}">${esc(t)}</span>`).join('');
   return `<tr><td><input type="checkbox" class="pick" value="${r.id}" ${selected.has(r.id)?'checked':''}></td>
   <td class="qtext"><strong>${esc(r.question).slice(0,220)}</strong><div>${tags}</div></td>
   <td>${esc(examNames[r.exam_id]||'')}</td><td>${esc(subjectNames[r.subject_id]||'')}</td>
   <td>${r.year||'—'}</td><td>${isPYQ(r)?'<span class="tag pyq">PYQ</span>':'—'}</td>
   <td><span class="status ${esc(r.status)}">${esc(r.status)}</span></td>
   <td><button class="btn light edit" data-id="${r.id}">Edit</button></td></tr>`
 }).join(''):'<tr><td colspan="8" class="empty">No questions match these filters.</td></tr>';
 document.querySelectorAll('.pick').forEach(x=>x.onchange=()=>{x.checked?selected.add(x.value):selected.delete(x.value);renderSelectionOnly()});
 document.querySelectorAll('.edit').forEach(x=>x.onclick=()=>openEdit(x.dataset.id));
}

function renderSelectionOnly(){$('selectedCount').textContent=`${selected.size} selected`;document.querySelectorAll('.pick').forEach(x=>x.checked=selected.has(x.value))}

function openEdit(id){
 const r=rows.find(x=>x.id===id);if(!r)return;
 $('id').value=r.id;$('modalQuestion').textContent=r.question;$('editYear').value=r.year||'';$('editPyq').value=isPYQ(r)?'yes':'no';$('editTags').value=(r.tags||[]).join(', ');$('modal').classList.add('open')
}

async function save(id,year,pyq,tags){
 let arr=tags.split(',').map(x=>x.trim()).filter(Boolean);
 arr=arr.filter(x=>x.toUpperCase()!=='PYQ');if(pyq)arr.push('PYQ');
 const payload={year:year?Number(year):null,tags:arr};
 const {error}=await sb.from('questions').update(payload).eq('id',id);
 if(error)throw error
}

$('form').onsubmit=async e=>{e.preventDefault();try{await save($('id').value,$('editYear').value,$('editPyq').value==='yes',$('editTags').value);$('modal').classList.remove('open');note('PYQ classification saved.');await load()}catch(err){note(err.message)}};
$('close').onclick=()=>$('modal').classList.remove('open');
$('apply').onclick=load;$('reload').onclick=load;
$('clear').onclick=()=>{['search','exam','subject','status','pyq'].forEach(id=>$(id).value='');load()};
$('master').onchange=e=>{selected.clear();if(e.target.checked)rows.forEach(r=>selected.add(r.id));render()};
$('bulkApply').onclick=async()=>{
 const action=$('bulkAction').value;if(!action)return note('Choose a bulk action first.');
 if(!selected.size)return note('Select at least one question.');
 const year=$('bulkYear').value;
 if(action==='mark'&&!year)return note('Enter the PYQ year for Mark as PYQ.');
 const list=[...selected];
 let ok=0;
 for(const id of list){
   const r=rows.find(x=>x.id===id);if(!r)continue;
   let tags=(r.tags||[]).filter(x=>String(x).toUpperCase()!=='PYQ');
   const payload=action==='mark'?{tags:[...tags,'PYQ'],year:Number(year)}:{tags,year:null};
   const {error}=await sb.from('questions').update(payload).eq('id',id);
   if(!error)ok++
 }
 note(`${ok} question${ok===1?'':'s'} updated.`);
 await load()
};
$('logout').onclick=async()=>{await sb.auth.signOut();location.href='index.html'};
$('search').onkeydown=e=>{if(e.key==='Enter')load()};

(async()=>{if(await auth()){try{await lookups();await load()}catch(e){note(e.message)}}})()
