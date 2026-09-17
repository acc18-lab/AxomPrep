(()=>{const c=window.AXOMPREP_CONFIG||{},sb=window.supabase.createClient(c.supabaseUrl,c.supabasePublishableKey),$=id=>document.getElementById(id);
let rows=[],examNames={},subjectNames={},session=[],pos=0,answered=false,premiumState={active:false};
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
async function lookupsOnly(){
  const [{data:ex},{data:su}]=await Promise.all([
    sb.from("exams").select("id,name").order("name"),
    sb.from("subjects").select("id,name").order("name")
  ]);
  (ex||[]).forEach(x=>examNames[x.id]=x.name);
  (su||[]).forEach(x=>subjectNames[x.id]=x.name);
}
async function init(){
  premiumState=await AxomPrepPremium.getState();
  if(!premiumState.active){
    $('premiumGate').style.display='block';
    $('grid').style.display='none';
    $('empty').style.display='none';
    $('total').textContent='—'; $('groups').textContent='—'; $('years').textContent='—';
    await lookupsOnly();
    return;
  }
const params=new URLSearchParams(location.search);const requestedExam=params.get("exam")||"";const requestedSubject=params.get("subject")||"";const requestedYear=params.get("year")||"";const [{data:ex},{data:su}]=await Promise.all([sb.from("exams").select("id,name").order("name"),sb.from("subjects").select("id,name").order("name")]);
(ex||[]).forEach(x=>{examNames[x.id]=x.name;$("exam").insertAdjacentHTML("beforeend",`<option value="${x.id}">${esc(x.name)}</option>`)});$("exam").value=requestedExam;
(su||[]).forEach(x=>{subjectNames[x.id]=x.name;$("subject").insertAdjacentHTML("beforeend",`<option value="${x.id}">${esc(x.name)}</option>`)});$("subject").value=requestedSubject;$("year").value=requestedYear;
await load()}
async function load(){let q=sb.from("questions").select("id,question,option_a,option_b,option_c,option_d,answer,explanation,exam_id,subject_id,year,tags").eq("status","published").contains("tags",["PYQ"]).order("year",{ascending:false});
if($("exam").value)q=q.eq("exam_id",$("exam").value);if($("year").value)q=q.eq("year",Number($("year").value));if($("subject").value)q=q.eq("subject_id",$("subject").value);if($("search").value.trim())q=q.ilike("question",`%${$("search").value.trim()}%`);
const {data,error}=await q.limit(500);if(error){console.error(error);rows=[];return render()}rows=data||[];years();render();if(!rows.length){$("emptyHint").innerHTML="No published questions are currently classified with the exact <b>PYQ</b> tag for these filters. Add the PYQ tag in the Admin Question Bank, then refresh this page."}}
function years(){let cur=$("year").value,ys=[...new Set(rows.map(x=>x.year).filter(Boolean))].sort((a,b)=>b-a);$("year").innerHTML='<option value="">All years</option>'+ys.map(y=>`<option value="${y}">${y}</option>`).join("");$("year").value=cur}
function render(){let g=new Map;rows.forEach(r=>{let k=(r.exam_id||"unknown")+"::"+(r.year||"Unspecified");if(!g.has(k))g.set(k,[]);g.get(k).push(r)});$("total").textContent=rows.length;$("groups").textContent=g.size;$("years").textContent=new Set(rows.map(r=>r.year).filter(Boolean)).size;let grid=$("grid");grid.innerHTML="";$("empty").style.display=g.size?"none":"block";
g.forEach((rs,k)=>{let [eid,yr]=k.split("::"),card=document.createElement("article");card.className="paper";card.innerHTML=`<span class="badge">${esc(examNames[eid]||"Exam")}</span><h3>${esc(yr)}</h3><p>Previous-year questions from the AxomPrep Question Bank.</p><div class="meta">${rs.length} questions</div><button class="btn primary">Start Practice →</button>`;card.querySelector("button").onclick=()=>start(rs,`${examNames[eid]||"Exam"} • ${yr}`);grid.appendChild(card)})}
function start(rs,title){session=[...rs].sort(()=>Math.random()-.5);pos=0;answered=false;$("title").textContent=title;$("practice").style.display="block";$("grid").style.display="none";$("empty").style.display="none";showQ();scrollTo({top:$("practice").offsetTop-15,behavior:"smooth"})}
function showQ(){let r=session[pos];if(!r)return;answered=false;$("count").textContent=`Question ${pos+1} of ${session.length}`;$("bar").style.width=`${pos/session.length*100}%`;let opts=[["A",r.option_a],["B",r.option_b],["C",r.option_c],["D",r.option_d]];$("q").innerHTML=`<div style="font-size:18px;font-weight:800;line-height:1.5">${esc(r.question)}</div>${opts.map(([k,v])=>`<button class="option" data-k="${k}"><strong>${k}.</strong> ${esc(v)}</button>`).join("")}<div id="fb"></div><div class="actions"><button class="btn" id="prev" ${pos===0?"disabled":""}>Previous</button><button class="btn primary" id="next">${pos===session.length-1?"Finish":"Next"}</button></div>`;document.querySelectorAll(".option").forEach(b=>b.onclick=()=>answer(b.dataset.k));$("prev").onclick=()=>{if(pos>0){pos--;showQ()}};$("next").onclick=()=>{if(!answered){answer("");return}if(pos<session.length-1){pos++;showQ()}else{$("bar").style.width="100%";$("fb").innerHTML='<div class="feedback"><strong>Set complete.</strong> Use “Back to papers” to choose another set.</div>'}}
}
function answer(k){if(answered)return;answered=true;let r=session[pos];document.querySelectorAll(".option").forEach(b=>{if(b.dataset.k===r.answer)b.classList.add("correct");if(k&&k===b.dataset.k&&k!==r.answer)b.classList.add("wrong");b.disabled=true});$("fb").innerHTML=`<div class="feedback"><strong>${k===r.answer?"Correct.":"Answer: "+esc(r.answer||"Not provided")}</strong>${r.explanation?`<br><br>${esc(r.explanation)}`:""}</div>`}
$("apply").onclick=load;$("search").onkeydown=e=>{if(e.key==="Enter")load()};$("back").onclick=()=>{$("practice").style.display="none";$("grid").style.display="grid";render()};init()})();