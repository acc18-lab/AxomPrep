const { createClient } = supabase;
const client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
let books=[], cats=new Set(), exams=new Set();

function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
function slugSearch(base){return encodeURIComponent(base).replace(/%20/g,'+');}

const starterBooks=[
 {title:"Assam Year Book 2026",author:"Santanu Kausik Baruah / team",exam_name:"ADRE • APSC • Assam Police • TET",category:"Assam GK",description:"Assam-focused reference covering history, culture, geography, economy, polity, society and current updates.",amazon_url:"https://www.amazon.in/s?k=Assam+Year+Book+2026",flipkart_url:"https://www.flipkart.com/search?q=Assam%20Year%20Book%202026"},
 {title:"Assam History & Culture for APSC & ADRE",author:"Exam-focused Assam history reference",exam_name:"APSC • ADRE",category:"Assam History",description:"Dedicated Assam history and culture coverage with exam-oriented practice and previous-year-question focus.",amazon_url:"https://www.amazon.in/s?k=Assam+History+Culture+APSC+ADRE",flipkart_url:"https://www.flipkart.com/search?q=Assam%20History%20Culture%20APSC%20ADRE"},
 {title:"History of Assam for ADRE & Assam State Competitive Exams",author:"Dr. Indrani Medhi & Sailen Baishya",exam_name:"ADRE • APSC • Assam Police",category:"Assam History",description:"State-specific history resource for Assam recruitment and state competitive examinations.",amazon_url:"https://www.amazon.in/s?k=History+of+Assam+Indrani+Medhi+Sailen+Baishya",flipkart_url:"https://www.flipkart.com/search?q=History%20of%20Assam%20Indrani%20Medhi%20Sailen%20Baishya"},
 {title:"The Assam Mathematics Concept",author:"Exam-focused Assam competitive exam reference",exam_name:"ADRE • APSC • Railway • Assam Police",category:"Mathematics",description:"Concept notes and practice questions focused on the mathematics areas commonly used in Assam recruitment exams.",amazon_url:"https://www.amazon.in/s?k=The+Assam+Mathematics+Concept",flipkart_url:"https://www.flipkart.com/search?q=The%20Assam%20Mathematics%20Concept"},
 {title:"Disha GoTo Guide for ADRE Grade III & IV",author:"Disha Publication",exam_name:"ADRE",category:"ADRE",description:"Dedicated ADRE Grade III and IV preparation guide.",amazon_url:"https://www.amazon.in/s?k=Disha+GoTo+Guide+ADRE+Grade+III+IV",flipkart_url:"https://www.flipkart.com/search?q=Disha%20GoTo%20Guide%20ADRE"},
 {title:"Disha 10 Year-wise Solved Papers & 10 Practice Sets for ADRE",author:"Disha Publication",exam_name:"ADRE",category:"Previous Year Papers",description:"Solved papers and practice sets designed around ADRE preparation.",amazon_url:"https://www.amazon.in/s?k=Disha+ADRE+10+year+solved+papers+10+practice+sets",flipkart_url:"https://www.flipkart.com/search?q=Disha%20ADRE%2010%20year%20solved%20papers"},
 {title:"5000+ MCQs on Assam & Northeast",author:"Exam-focused MCQ reference",exam_name:"ADRE • APSC • Assam Police",category:"Assam GK",description:"Large Assam and Northeast question bank for repeated practice and revision.",amazon_url:"https://www.amazon.in/s?k=5000+MCQs+Assam+Northeast",flipkart_url:"https://www.flipkart.com/search?q=5000%20MCQs%20Assam%20Northeast"},
 {title:"Know Your State Assam",author:"Arihant-style state reference",exam_name:"APSC • ADRE • Assam Police • TET",category:"Assam GK",description:"State-specific reference for geography, history, culture, administration and general awareness.",amazon_url:"https://www.amazon.in/s?k=Know+Your+State+Assam",flipkart_url:"https://www.flipkart.com/search?q=Know%20Your%20State%20Assam"},
 {title:"Lucent's General Knowledge",author:"Lucent Publication",exam_name:"ADRE • APSC • SSC • Assam Police",category:"General Knowledge",description:"Static GK reference covering a broad range of general-knowledge topics used in competitive exams.",amazon_url:"https://www.amazon.in/s?k=Lucent+General+Knowledge",flipkart_url:"https://www.flipkart.com/search?q=Lucent%20General%20Knowledge"},
 {title:"Indian Polity",author:"M. Laxmikanth",exam_name:"APSC • SSC • Other Government Exams",category:"Polity",description:"Comprehensive Indian Constitution and polity reference for competitive-exam preparation.",amazon_url:"https://www.amazon.in/s?k=Indian+Polity+M+Laxmikanth",flipkart_url:"https://www.flipkart.com/search?q=Indian%20Polity%20M%20Laxmikanth"},
 {title:"Quantitative Aptitude for Competitive Examinations",author:"R. S. Aggarwal",exam_name:"SSC • Banking • ADRE • APSC",category:"Mathematics",description:"Practice-oriented quantitative aptitude reference covering arithmetic and related competitive-exam topics.",amazon_url:"https://www.amazon.in/s?k=Quantitative+Aptitude+R+S+Aggarwal",flipkart_url:"https://www.flipkart.com/search?q=Quantitative%20Aptitude%20R%20S%20Aggarwal"},
 {title:"A Modern Approach to Verbal & Non-Verbal Reasoning",author:"R. S. Aggarwal",exam_name:"SSC • ADRE • Assam Police • Other Exams",category:"Reasoning",description:"Large reasoning practice resource covering verbal and non-verbal reasoning.",amazon_url:"https://www.amazon.in/s?k=A+Modern+Approach+to+Verbal+Non-Verbal+Reasoning+R+S+Aggarwal",flipkart_url:"https://www.flipkart.com/search?q=A%20Modern%20Approach%20Verbal%20Non-Verbal%20Reasoning"},
 {title:"Objective General English",author:"S. P. Bakshi",exam_name:"SSC • Banking • ADRE • APSC",category:"English",description:"Competitive English reference covering grammar, vocabulary, comprehension and usage.",amazon_url:"https://www.amazon.in/s?k=Objective+General+English+SP+Bakshi",flipkart_url:"https://www.flipkart.com/search?q=Objective%20General%20English%20SP%20Bakshi"},
 {title:"Fast Track Objective Arithmetic",author:"Rajesh Verma",exam_name:"SSC • Banking • ADRE • Assam Police",category:"Mathematics",description:"Fast-practice arithmetic reference for speed and accuracy.",amazon_url:"https://www.amazon.in/s?k=Fast+Track+Objective+Arithmetic+Rajesh+Verma",flipkart_url:"https://www.flipkart.com/search?q=Fast%20Track%20Objective%20Arithmetic%20Rajesh%20Verma"},
 {title:"Indian Economy",author:"Ramesh Singh",exam_name:"APSC • SSC • Other Government Exams",category:"Economy",description:"Indian economy reference for conceptual preparation and revision.",amazon_url:"https://www.amazon.in/s?k=Indian+Economy+Ramesh+Singh",flipkart_url:"https://www.flipkart.com/search?q=Indian%20Economy%20Ramesh%20Singh"},
 {title:"Certificate Physical Geography",author:"G. C. Leong",exam_name:"APSC • SSC • Other Government Exams",category:"Geography",description:"Physical geography foundation covering landforms, climate and related concepts.",amazon_url:"https://www.amazon.in/s?k=Certificate+Physical+Geography+GC+Leong",flipkart_url:"https://www.flipkart.com/search?q=Certificate%20Physical%20Geography%20GC%20Leong"},
 {title:"General Science",author:"Lucent Publication",exam_name:"ADRE • SSC • Assam Police",category:"Science",description:"General science revision reference for objective competitive examinations.",amazon_url:"https://www.amazon.in/s?k=Lucent+General+Science+book",flipkart_url:"https://www.flipkart.com/search?q=Lucent%20General%20Science%20book"},
 {title:"General English for Competitive Exams",author:"Arihant / competitive exam series",exam_name:"SSC • Banking • ADRE",category:"English",description:"Grammar, vocabulary and objective practice resource for government examinations.",amazon_url:"https://www.amazon.in/s?k=General+English+competitive+exam+book+Arihant",flipkart_url:"https://www.flipkart.com/search?q=General%20English%20competitive%20exam%20book"},
 {title:"General Knowledge for Competitive Examinations",author:"Arihant-style GK reference",exam_name:"ADRE • SSC • Assam Police",category:"General Knowledge",description:"Objective GK practice reference for government-exam preparation.",amazon_url:"https://www.amazon.in/s?k=General+Knowledge+competitive+exams+Arihant",flipkart_url:"https://www.flipkart.com/search?q=General%20Knowledge%20competitive%20exams+Arihant"},
 {title:"APSC General Studies Manual",author:"Competitive exam reference",exam_name:"APSC",category:"APSC",description:"General studies reference for Assam Civil Service and related state-level preparation.",amazon_url:"https://www.amazon.in/s?k=APSC+General+Studies+Manual",flipkart_url:"https://www.flipkart.com/search?q=APSC%20General%20Studies%20Manual"}
];

function card(b){
  const title=escapeHtml(b.title||'');
  const cover=b.cover_url?`<img src="${escapeHtml(b.cover_url)}" alt="${title}">`:
    `<div class="cover-fallback">${title}</div>`;
  const chips=(b.exam_name||'').split(/[•|]/).map(x=>x.trim()).filter(Boolean).slice(0,4).map(x=>`<span class="chip">${escapeHtml(x)}</span>`).join('');
  return `<article class="book-card">
    <div class="book-cover">${cover}</div>
    ${b.featured?'<span class="book-badge">Featured</span>':''}
    <h3>${title}</h3>
    <div class="book-meta">${escapeHtml(b.author||'')}</div>
    <div class="book-exams">${chips}</div>
    <div class="book-meta"><strong>${escapeHtml(b.category||'')}</strong></div>
    <p class="book-desc">${escapeHtml(b.description||'')}</p>
    <div class="store-links">
      ${b.amazon_url?`<a class="amazon" target="_blank" rel="sponsored noopener" href="${escapeHtml(b.amazon_url)}" data-book="${escapeHtml(b.id||'')}" data-store="amazon">Amazon ↗</a>`:''}
      ${b.flipkart_url?`<a class="flipkart" target="_blank" rel="sponsored noopener" href="${escapeHtml(b.flipkart_url)}" data-book="${escapeHtml(b.id||'')}" data-store="flipkart">Flipkart ↗</a>`:''}
    </div>
  </article>`;
}

function setFilters(){
  document.getElementById('category').innerHTML='<option value="">All categories</option>'+[...cats].sort().map(x=>`<option>${escapeHtml(x)}</option>`).join('');
  document.getElementById('exam').innerHTML='<option value="">All exams</option>'+[...exams].sort().map(x=>`<option>${escapeHtml(x)}</option>`).join('');
}

function render(){
  const q=(document.getElementById('search').value||'').toLowerCase();
  const c=document.getElementById('category').value;
  const e=document.getElementById('exam').value;
  const list=books.filter(b=>{
    const hay=`${b.title||''} ${b.author||''} ${b.exam_name||''} ${b.category||''} ${b.description||''}`.toLowerCase();
    return (!q||hay.includes(q))&&(!c||b.category===c)&&(!e||(b.exam_name||'').split(/[•|]/).map(x=>x.trim()).includes(e));
  });
  document.getElementById('booksGrid').innerHTML=list.length?list.map(card).join(''):'<div class="empty">No books match your filters.</div>';
}

async function loadBooks(){
  const res=await client.from('books_v1').select('*').eq('status','published').order('featured',{ascending:false}).order('created_at',{ascending:false});
  if(res.error){
    console.error(res.error);
    books=starterBooks.map((x,i)=>({...x,id:`starter-${i+1}`,featured:i<3}));
  }else{
    books=res.data||[];
    if(!books.length) books=starterBooks.map((x,i)=>({...x,id:`starter-${i+1}`,featured:i<3}));
  }
  books.forEach(b=>{if(b.category)cats.add(b.category);(b.exam_name||'').split(/[•|]/).map(x=>x.trim()).filter(Boolean).forEach(x=>exams.add(x));});
  setFilters();render();
}
document.addEventListener('input',e=>{if(e.target.id==='search')render()});
document.addEventListener('change',e=>{if(e.target.id==='category'||e.target.id==='exam')render()});
document.addEventListener('click',async e=>{const a=e.target.closest('a[data-book]');if(!a||a.dataset.book.startsWith('starter-'))return;try{await client.from('book_clicks_v1').insert({book_id:a.dataset.book,store:a.dataset.store});}catch(_){}});
loadBooks();