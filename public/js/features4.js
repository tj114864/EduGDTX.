/* =====================================================================
   Chức năng mở rộng (phần 4, nạp sau features3.js)
   I. Giáo viên – Hộp góp ý chung · Biểu đồ điểm theo bài · In giấy khen
   J. Học sinh – Biểu đồ tiến bộ · Tự in giấy khen thành tích
   ===================================================================== */

/* ---------- I.1 GIÁO VIÊN: Hộp góp ý chung (mọi bài) ---------- */
NAV.gv.splice(5,0,['inbox','📬','Hộp góp ý']);
const _pgGv4=PAGES.gv;
PAGES.gv=async()=>{if(tab=='inbox')return inboxPage();return _pgGv4()};
async function inboxPage(){
  const fb=await api('/feedback');
  if(!fb.length)return`<h3>📬 Hộp góp ý</h3><section class="card"><p>Chưa có góp ý nào từ học sinh.</p></section>`;
  const left=fb.filter(x=>!x.resolved).length;
  return`<h3>📬 Hộp góp ý ${left?`<span class="tag hard">${left} chưa xử lý</span>`:''}</h3>
${fb.map(x=>`<section class="card fbrow2 ${x.resolved?'done':''}"><div><span class="tag">${esc(x.exam)}</span> <b>${esc(x.student)}</b> <small>${fmt(x.created_at)}</small><p class="q">${esc(x.question)}</p><p>${esc(x.content)}</p></div>${x.resolved?'<span class="tag">✓ Đã xử lý</span>':`<button class="ghost" onclick="resolveFb2(${x.id})">Đánh dấu đã xử lý</button>`}</section>`).join('')}`;
}
window.resolveFb2=run(async fid=>{await api(`/feedback/${fid}/resolve`,'POST');toast('Đã đánh dấu xử lý');render()});

/* ---------- I.2 GIÁO VIÊN: biểu đồ điểm trung bình theo bài trong Sổ điểm ---------- */
const _gradePage4=gradePage;
gradePage=async function(){
  const h=await _gradePage4();
  if(GBC==null)return h;
  try{
    const d=await api('/classes/'+GBC+'/gradebook');if(!d.exams.length)return h;
    const avgs=d.exams.map((e,i)=>{const v=d.rows.map(s=>s.scores[i]).filter(x=>x!=null);return v.length?Math.round(v.reduce((a,b)=>a+b,0)/v.length*100)/100:null});
    return h+`<section class="card"><h3>📊 Điểm trung bình theo từng bài</h3><div class="mbars">${d.exams.map((e,i)=>`<div class="mbar"><div class="mbwrap"><div class="mbfill ${avgs[i]==null?'':avgs[i]>=8?'good':avgs[i]<5?'bad':''}" style="height:${avgs[i]==null?0:avgs[i]/10*100}%"></div></div><small>${avgs[i]??'–'}</small><small class="mblabel" title="${esc(e.title)}">${esc(e.title.length>10?e.title.slice(0,9)+'…':e.title)}</small></div>`).join('')}</div></section>`;
  }catch(e){return h}
};

/* ---------- I.3 GIÁO VIÊN: in giấy khen cho học sinh đạt điểm cao ---------- */
/* (mẫu giấy khen nằm trong js/cert.js) */
window.printCert=run(async id=>{
  const d=await api('/exams/'+id+'/results'),top=d.rows.filter(x=>x.score!=null&&x.score>=8);
  if(!top.length)return toast('Chưa có học sinh nào đạt từ 8 điểm trở lên ở bài này');
  openCert(top.map(x=>certHTML(x.name,d.exam.class,d.exam.title,x.score)).join(''),'Giấy khen – '+d.exam.title);
});

/* ---------- J.1 HỌC SINH: biểu đồ tiến bộ trong Hồ sơ ---------- */
const _profilePage4=profilePage;
profilePage=async function(){
  const h=await _profilePage4();
  try{
    const hist=(await api('/my-history')).filter(x=>x.mode=='exam'&&x.score!=null).slice(0,10).reverse();
    if(hist.length<2)return h;
    return h+`<section class="card"><h3>📈 Tiến bộ qua các bài gần đây</h3><div class="mbars">${hist.map(x=>`<div class="mbar"><div class="mbwrap"><div class="mbfill ${x.score>=8?'good':x.score<5?'bad':''}" style="height:${x.score/10*100}%"></div></div><small>${x.score}</small><small class="mblabel" title="${esc(x.title)}">${esc(x.title.length>10?x.title.slice(0,9)+'…':x.title)}</small></div>`).join('')}</div></section>`;
  }catch(e){return h}
};

/* ---------- J.2 HỌC SINH: tự in giấy khen thành tích ---------- */
window.printOwnCert=run(async()=>{
  const p=await api('/profile');
  if(p.avg==null||p.avg<8)return toast('Điểm trung bình các bài kiểm tra cần từ 8 trở lên mới in được giấy khen nhé');
  openCert(certHTML(p.name,p.class,'',p.avg,{n:p.examCount}),'Giấy khen – '+p.name);
});
