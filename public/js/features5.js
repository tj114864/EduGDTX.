/* =====================================================================
   Chức năng mở rộng (phần 5, nạp sau features4.js) — mỗi vai trò +4
   K. Admin: Thông báo toàn trường · Học sinh cần quan tâm · Bảng điểm toàn trường · In danh sách lớp
   L. Giáo viên: Nhận xét học sinh · Thống kê theo dạng câu · Nhập điểm thủ công · So sánh các lớp
   M. Học sinh: Xem nhận xét · Đề yêu thích · In bảng điểm cá nhân · Mục tiêu điểm số
   ===================================================================== */

/* ================= K. ADMIN ================= */
NAV.admin.splice(3,0,['broadcast','📣','Thông báo toàn trường'],['watchlist','⚠️','Cần quan tâm'],['allgrade','📒','Bảng điểm toàn trường']);
const _pgAdmin5=PAGES.admin;
PAGES.admin=async()=>{
  if(tab=='broadcast')return broadcastPage();
  if(tab=='watchlist')return watchlistPage();
  if(tab=='allgrade')return allGradePage();
  if(tab=='overview')return withRoll(await overviewPage());
  return _pgAdmin5();
};
async function broadcastPage(){
  const cs=await api('/classes');
  return`<section class="card"><h3>📣 Thông báo toàn trường</h3><p><small>Gửi đến tất cả học sinh của các lớp được chọn (hiện ở mục Thông báo của học sinh).</small></p>
<label class="chk"><input type="checkbox" id="bcAll" onchange="document.querySelectorAll('.bcc').forEach(c=>c.checked=this.checked)"> Chọn tất cả các lớp</label>
<div class="chips2">${cs.map(c=>`<label class="chk"><input type="checkbox" class="bcc" value="${c.id}"> ${esc(c.name)}</label>`).join('')}</div>
<textarea id="bctx" rows="3" placeholder="Nội dung thông báo..."></textarea><button onclick="sendBroadcast()">Gửi thông báo</button></section>`;
}
window.sendBroadcast=run(async()=>{
  const all=$('#bcAll').checked,ids=[...document.querySelectorAll('.bcc:checked')].map(c=>+c.value);
  const content=$('#bctx').value.trim();if(!content)return toast('Nhập nội dung thông báo');
  const d=await api('/broadcast','POST',{class_ids:all?'all':ids,content});
  toast(`Đã gửi tới ${d.count} lớp`);render();
});
async function watchlistPage(){
  const d=await api('/admin/watchlist');
  return`<h3>⚠️ Học sinh cần quan tâm</h3><p><small>Những học sinh có điểm trung bình dưới 5 trong tối đa 3 bài kiểm tra gần nhất.</small></p>
<section class="card scroll"><table><tr><th>Học sinh</th><th>Lớp</th><th>Điểm TB gần đây</th><th>Số bài tính</th></tr>${d.map(x=>`<tr><td>${esc(x.name)}</td><td>${esc(x.class||'')}</td><td class="gc bad"><b>${x.avg}</b></td><td>${x.count}</td></tr>`).join('')||'<tr><td colspan=4><small>Hiện không có học sinh nào cần lưu ý.</small></td></tr>'}</table></section>`;
}
async function allGradePage(){
  const d=await api('/admin/full-gradebook');
  if(!d.length)return`<h3>📒 Bảng điểm toàn trường</h3><section class="card"><p>Chưa có bài kiểm tra nào trong hệ thống.</p></section>`;
  return`<h3>📒 Bảng điểm toàn trường</h3><button class="ghost" onclick="exportAllGrade()">⬇ Xuất Excel</button>`+
    d.map(c=>`<section class="card scroll"><h3>Lớp ${esc(c.class)}</h3><table><tr><th>Học sinh</th>${c.exams.map(e=>`<th title="${esc(e.teacher||'')}">${esc(e.title.length>12?e.title.slice(0,11)+'…':e.title)}</th>`).join('')}<th>TB</th></tr>${c.rows.map(s=>`<tr><td>${esc(s.name)}</td>${s.scores.map(v=>`<td class="gc ${v==null?'none':v>=8?'ok':v<5?'bad':''}">${v??'–'}</td>`).join('')}<td class="gc"><b>${s.avg??'–'}</b></td></tr>`).join('')}</table></section>`).join('');
}
window.exportAllGrade=run(async()=>{
  const d=await api('/admin/full-gradebook');
  const t=d.map(c=>`<table style="border-collapse:collapse">${xTitle('LỚP '+c.class.toUpperCase(),c.exams.length+2)}<tr>${xTh('Học sinh')}${c.exams.map(e=>xTh(esc(e.title))).join('')}${xTh('TB')}</tr>${c.rows.map(s=>`<tr>${xTd(esc(s.name),'font-weight:bold')}${s.scores.map(v=>xTd(v??'','text-align:center')).join('')}${xTd(s.avg??'','text-align:center;font-weight:bold')}</tr>`).join('')}</table><br>`).join('');
  dlXls('Bang-diem-toan-truong',t);toast('Đã tải bảng điểm toàn trường');
});
async function withRoll(h){
  const cs=await api('/classes');
  return h.replace('<h3>🏫 Tổng quan theo lớp</h3>',`<h3>🏫 Tổng quan theo lớp</h3><section class="card"><div class="row"><select id="rollC">${clsOpts(cs)}</select><button class="ghost" onclick="printRoll()">🖨 In danh sách lớp</button></div></section>`);
}
window.printRoll=run(async()=>{
  const[us,cs]=await Promise.all([api('/users'),api('/classes')]);
  const cid=+$('#rollC').value,cname=(cs.find(c=>c.id==cid)||{}).name||'';
  const students=us.filter(u=>u.role=='hs'&&u.class==cname).sort((a,b)=>a.name.localeCompare(b.name,'vi'));
  const w=window.open('','_blank');if(!w)return toast('Trình duyệt chặn cửa sổ in, hãy cho phép pop-up cho trang này');
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Danh sách lớp ${esc(cname)}</title>
  <style>body{font-family:Arial,sans-serif;padding:24px}h1{font-size:19px}table{border-collapse:collapse;width:100%;margin-top:12px}th,td{border:1px solid #333;padding:6px 8px;text-align:left}th:first-child,td:first-child{width:40px;text-align:center}</style></head>
  <body><h1>Danh sách lớp ${esc(cname)}</h1><small>Sĩ số: ${students.length}</small>
  <table><tr><th>#</th><th>Họ tên</th><th>Điểm danh</th><th>Ký tên</th></tr>${students.map((s,i)=>`<tr><td>${i+1}</td><td>${esc(s.name)}</td><td></td><td></td></tr>`).join('')}</table></body></html>`);
  w.document.close();w.focus();w.print();
});

/* ================= L. GIÁO VIÊN ================= */
NAV.gv.splice(6,0,['stype','📐','Thống kê theo dạng câu']);
const _pgGv5=PAGES.gv;
PAGES.gv=async()=>{if(tab=='stype')return stypePage();return gradeRemarkWrap(await _pgGv5())};
async function stypePage(){
  const d=await api('/stats-by-type'),L={mc:'Trắc nghiệm',tf:'Đúng / Sai',essay:'Tự luận'};
  if(!d.length||d.every(x=>!x.n))return`<h3>📐 Thống kê theo dạng câu</h3><section class="card"><p>Chưa có bài làm nào để thống kê.</p></section>`;
  return`<h3>📐 Thống kê theo dạng câu hỏi</h3><p><small>Tính trên mọi bài bạn đã giao.</small></p>
<div class="mbars">${d.map(x=>`<div class="mbar" style="width:80px"><div class="mbwrap" style="height:100px"><div class="mbfill ${x.rate==null?'':x.rate>=70?'good':x.rate<40?'bad':''}" style="height:${x.rate??0}%"></div></div><small>${x.rate==null?'–':x.rate+'%'}</small><small class="mblabel" style="max-width:80px">${L[x.type]||x.type}</small></div>`).join('')}</div>
<section class="card scroll"><table><tr><th>Dạng câu</th><th>Số câu đã ra</th><th>Lượt làm</th><th>Tỉ lệ đạt điểm tối đa</th></tr>${d.map(x=>`<tr><td>${L[x.type]||x.type}</td><td>${x.qcount}</td><td>${x.n}</td><td>${x.rate==null?'–':x.rate+'%'}</td></tr>`).join('')}</table></section>`;
}
function gradeRemarkWrap(h){
  if(tab!='grade'||GBC==null)return h;
  return h+'<section class="card"><button class="ghost" onclick="openRemarks()">✎ Nhận xét học sinh</button></section>';
}
window.openRemarks=run(async()=>{
  const d=await api('/classes/'+GBC+'/gradebook');
  showModal(`<h3>✎ Nhận xét học sinh – ${esc(d.class)}</h3><div class="remlist">${d.rows.map(s=>`<div class="remrow"><b>${esc(s.name)}</b><button class="ghost" onclick="editRemark(${s.id},'${esc(s.name).replace(/'/g,"\\'")}')">Nhận xét</button></div>`).join('')||'<p><small>Lớp chưa có học sinh.</small></p>'}</div>`,'Đóng');
});
window.editRemark=run(async(sid,name)=>{
  const cur=await api('/remarks/'+sid);
  showModal(`<h3>✎ Nhận xét: ${esc(name)}</h3><textarea id="remtx" rows="3" placeholder="Nhận xét về học sinh...">${esc(cur.content||'')}</textarea><div class="row"><button onclick="saveRemark(${sid})">Lưu</button></div>`,'Đóng');
});
window.saveRemark=run(async sid=>{await api('/remarks/'+sid,'POST',{content:$('#remtx').value});toast('Đã lưu nhận xét');$('#modal').hidden=true});
window.manualScoreForm=run(async eid=>{
  const rows=(_exam&&_exam.id==eid&&_rows)||(await api('/exams/'+eid+'/results')).rows;
  showModal(`<h3>✍ Nhập điểm thủ công</h3><p><small>Dùng khi học sinh làm bài giấy, vắng hoặc gặp sự cố kỹ thuật.</small></p>
<select id="msU">${rows.map(s=>`<option value="${s.id}">${esc(s.name)}${s.score!=null?' (đang có '+s.score+' đ)':''}</option>`).join('')}</select>
<input id="msS" type="number" min="0" max="10" step="0.25" placeholder="Điểm (0–10)">
<input id="msN" placeholder="Ghi chú (ví dụ: làm bài giấy)"><div class="row"><button onclick="saveManualScore(${eid})">Lưu điểm</button></div>`,'Đóng');
});
window.saveManualScore=run(async eid=>{
  const s=+$('#msS').value;if(Number.isNaN(s)||s<0||s>10)return toast('Nhập điểm từ 0 đến 10');
  await api('/exams/'+eid+'/manual-score','POST',{student_id:+$('#msU').value,score:s,note:$('#msN').value});
  toast('Đã lưu điểm');$('#modal').hidden=true;go('r:'+eid);
});
window.compareClasses=run(async eid=>{
  const d=await api('/exams/'+eid+'/compare');
  if(d.length<2)return toast('Bài này chỉ giao cho 1 lớp, không có gì để so sánh');
  const mx=Math.max(1,...d.map(x=>x.avg||0));
  showModal(`<h3>📊 So sánh các lớp cùng đề</h3><div class="mbars">${d.map(x=>`<div class="mbar"><div class="mbwrap"><div class="mbfill ${x.self?'':''}" style="height:${x.avg?x.avg/10*100:0}%;${x.self?'outline:2px solid var(--pr)':''}"></div></div><small>${x.avg??'–'}</small><small class="mblabel">${esc(x.class)}</small></div>`).join('')}</div>
<table><tr><th>Lớp</th><th>Sĩ số</th><th>Đã nộp</th><th>Điểm TB</th></tr>${d.map(x=>`<tr${x.self?' style="font-weight:bold"':''}><td>${esc(x.class)}${x.self?' (lớp này)':''}</td><td>${x.students}</td><td>${x.done}</td><td>${x.avg??'–'}</td></tr>`).join('')}</table>`,'Đóng');
});

/* ================= M. HỌC SINH ================= */
NAV.hs.splice(NAV.hs.length-1,0,['fav','⭐','Yêu thích']);
const _pgHs5=PAGES.hs;
PAGES.hs=async()=>{if(tab=='fav')return favPage();if(tab=='profile')return profileAddons(await _pgHs5());return _pgHs5()};
async function favPage(){
  const d=await api('/favorites');
  if(!d.length)return`<h3>⭐ Yêu thích</h3><section class="card"><p>Bạn chưa đánh dấu bài nào. Bấm ngôi sao ☆ cạnh tên bài ở trang "Bài của tôi" để lưu lại.</p></section>`;
  return`<h3>⭐ Yêu thích</h3>`+d.map(e=>`<section class="card item"><div><b>${esc(e.title)}</b> <span class="tag">${e.mode=='exam'?'Kiểm tra':'Ôn tập'}</span>${!e.same_class?' <span class="tag hard">Không còn thuộc lớp bạn</span>':''}<br><small>${e.minutes} phút</small></div><div>${e.same_class?`<button onclick="go('');setTimeout(()=>document.getElementById('ex${e.id}')?.scrollIntoView(),50)">Đi tới bài</button>`:''}<button class="ghost" onclick="unfav(${e.id})">Bỏ thích</button></div></section>`).join('');
}
window.toggleFav=run(async(id,el)=>{
  const on=el.classList.contains('on');
  await api('/favorites/'+id,on?'DELETE':'POST');
  el.classList.toggle('on');el.textContent=on?'☆':'★';
});
window.unfav=run(async id=>{await api('/favorites/'+id,'DELETE');render()});
function profileAddons(h){
  return h+'<div id="pmore"><small>Đang tải thêm…</small></div>';
}
const _render5=render;
render=async function(){await _render5();if(me&&me.role=='hs'&&tab=='profile')loadProfileMore()};
async function loadProfileMore(){
  try{
    const[rk,p]=await Promise.all([api('/remarks-me'),api('/profile')]);
    const goalPct=p.goal&&p.avg!=null?Math.min(100,Math.round(p.avg/p.goal*100)):null;
    const html=`${rk.length?`<section class="card"><h3>💬 Nhận xét từ giáo viên</h3>${rk.map(x=>`<div class="remrow2"><b>${esc(x.teacher)}</b> <small>${fmt(x.updated_at)}</small><p>${esc(x.content)}</p></div>`).join('')}</section>`:''}
<section class="card"><h3>🎯 Mục tiêu điểm số</h3>${p.goal!=null?`<p>Mục tiêu: <b>${p.goal}</b> điểm · Hiện tại: <b>${p.avg??'–'}</b>${goalPct!=null?` · Đạt <b>${goalPct}%</b> mục tiêu`:''}</p><div class="prog"><i style="width:${goalPct??0}%"></i></div>`:'<p><small>Bạn chưa đặt mục tiêu.</small></p>'}
<div class="row"><input id="goalIn" type="number" min="0" max="10" step="0.5" placeholder="Điểm mục tiêu (0–10)" value="${p.goal??''}"><button onclick="setGoal()">Đặt mục tiêu</button>${p.goal!=null?'<button class="ghost" onclick="clearGoal()">Xóa</button>':''}</div></section>
<section class="card"><button class="ghost" onclick="printTranscript()">🖨 In bảng điểm cá nhân</button></section>`;
    const el=document.getElementById('pmore');if(el)el.innerHTML=html;
  }catch(e){}
}
window.setGoal=run(async()=>{const g=+$('#goalIn').value;if(Number.isNaN(g))return toast('Nhập điểm hợp lệ');await api('/profile/goal','PUT',{goal:g});toast('Đã đặt mục tiêu');await loadProfileMore()});
window.clearGoal=run(async()=>{await api('/profile/goal','PUT',{goal:null});toast('Đã xóa mục tiêu');await loadProfileMore()});
window.printTranscript=run(async()=>{
  const[hist,p]=await Promise.all([api('/my-history'),api('/profile')]);
  const w=window.open('','_blank');if(!w)return toast('Trình duyệt chặn cửa sổ in, hãy cho phép pop-up cho trang này');
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Bảng điểm – ${esc(p.name)}</title>
  <style>body{font-family:Arial,sans-serif;padding:24px}table{border-collapse:collapse;width:100%;margin-top:12px}th,td{border:1px solid #333;padding:6px 8px;text-align:left}</style></head>
  <body><h1>Bảng điểm cá nhân</h1><p>Họ tên: <b>${esc(p.name)}</b> · Lớp: <b>${esc(p.class||'')}</b> · Điểm TB: <b>${p.avg??'–'}</b></p>
  <table><tr><th>Bài</th><th>Loại</th><th>Điểm</th><th>Nộp lúc</th></tr>${hist.map(x=>`<tr><td>${esc(x.title)}</td><td>${x.mode=='exam'?'Kiểm tra':'Ôn tập'}</td><td>${x.score??'–'}</td><td>${fmt(x.submitted_at)}</td></tr>`).join('')}</table></body></html>`);
  w.document.close();w.focus();w.print();
});
