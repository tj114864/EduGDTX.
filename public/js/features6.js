/* =====================================================================
   Chức năng mở rộng (phần 6, nạp sau features5.js) — 3 mảng hoàn toàn mới
   N. Tài liệu học tập (giáo viên đăng · học sinh xem)
   O. Điểm danh theo buổi (giáo viên điểm danh · học sinh xem · admin tổng quan)
   P. Khảo sát nhanh (giáo viên tạo · học sinh bình chọn)
   ===================================================================== */
const ATS={present:['✅','Có mặt'],absent:['❌','Vắng'],late:['🕒','Đi muộn'],excused:['📄','Có phép']};

/* ---------- ADMIN: tổng quan chuyên cần ---------- */
NAV.admin.splice(4,0,['attend','📅','Chuyên cần']);
const _pgAdmin6=PAGES.admin;
PAGES.admin=async()=>{if(tab=='attend')return attendOverviewPage();return _pgAdmin6()};
async function attendOverviewPage(){
  const d=await api('/admin/attendance-overview');
  if(!d.length)return`<h3>📅 Chuyên cần</h3><section class="card"><p>Chưa có lớp nào được điểm danh.</p></section>`;
  return`<h3>📅 Tỉ lệ chuyên cần theo lớp</h3><section class="card scroll"><table><tr><th>Lớp</th><th>Số lượt điểm danh</th><th>Tỉ lệ có mặt</th></tr>${d.map(x=>`<tr><td>${esc(x.class)}</td><td>${x.count}</td><td class="gc ${x.rate==null?'':x.rate>=90?'ok':x.rate<70?'bad':''}"><b>${x.rate??'–'}${x.rate!=null?'%':''}</b></td></tr>`).join('')}</table></section>`;
}

/* ---------- GIÁO VIÊN: tài liệu · điểm danh · khảo sát ---------- */
NAV.gv.splice(7,0,['mat','📎','Tài liệu'],['att','📅','Điểm danh'],['poll','🗳','Khảo sát']);
const _pgGv6=PAGES.gv;
PAGES.gv=async()=>{
  if(tab=='mat')return matPage();
  if(tab=='att')return attPage();
  if(tab=='poll')return pollPage();
  return _pgGv6();
};
async function matPage(){
  const[cs,ms]=await Promise.all([api('/classes'),api('/materials')]);
  return`<section class="card"><h3>📎 Đăng tài liệu mới</h3><div class="row"><select id="mtC">${clsOpts(cs)}</select><input id="mtT" placeholder="Tên tài liệu"></div><input id="mtL" placeholder="Đường dẫn (link) – tùy chọn" style="width:100%;margin-bottom:8px"><textarea id="mtX" rows="3" placeholder="Nội dung / ghi chú – tùy chọn"></textarea><button onclick="addMat()">Đăng tài liệu</button></section>
<h3>Tài liệu đã đăng</h3>${ms.map(m=>`<section class="card item"><div><b>${esc(m.title)}</b> <span class="tag">${esc(m.class)}</span><br>${m.link?`<small><a href="${esc(m.link)}" target="_blank" rel="noopener">${esc(m.link)}</a></small><br>`:''}${m.content?`<small>${esc(m.content)}</small>`:''}</div><button class="ghost" onclick="delMat(${m.id})">Xóa</button></section>`).join('')||'<section class="card"><p>Chưa đăng tài liệu nào.</p></section>'}`;
}
window.addMat=run(async()=>{
  const title=$('#mtT').value.trim();if(!title)return toast('Nhập tên tài liệu');
  await api('/materials','POST',{class_id:+$('#mtC').value,title,link:$('#mtL').value.trim(),content:$('#mtX').value.trim()});
  toast('Đã đăng tài liệu');render();
});
window.delMat=run(async id=>{if(!await uiConfirm('Xóa tài liệu này?'))return;await api('/materials/'+id,'DELETE');render()});

let ATC=null,ATD=new Date().toISOString().slice(0,10);
async function attPage(){
  const cs=await api('/classes');if(ATC==null&&cs[0])ATC=cs[0].id;
  const rows=await api('/attendance/'+ATC+'?date='+ATD);
  return`<section class="card"><h3>📅 Điểm danh</h3><div class="row"><select onchange="ATC=+this.value;render()">${clsOpts(cs)}</select><input type="date" value="${ATD}" onchange="ATD=this.value;render()"></div></section>
<section class="card scroll"><table><tr><th>Học sinh</th><th>Trạng thái</th></tr>${rows.map(s=>`<tr><td>${esc(s.name)}</td><td>${Object.entries(ATS).map(([k,[i,t]])=>`<label class="atlb ${s.status==k?'on':''}"><input type="radio" name="at${s.id}" ${s.status==k?'checked':''} onchange="setAtt(${s.id},'${k}')">${i} ${t}</label>`).join('')}</td></tr>`).join('')||'<tr><td colspan=2><small>Lớp chưa có học sinh.</small></td></tr>'}</table></section><button onclick="saveAttendance()">💾 Lưu điểm danh</button>`;
}
window.setAtt=(sid,status)=>{window._atBuf=window._atBuf||{};window._atBuf[sid]=status};
window.saveAttendance=run(async()=>{
  const recs=Object.entries(window._atBuf||{}).map(([student_id,status])=>({student_id:+student_id,status}));
  if(!recs.length)return toast('Chưa chọn trạng thái cho học sinh nào');
  await api('/attendance','POST',{class_id:ATC,date:ATD,records:recs});window._atBuf={};toast('Đã lưu điểm danh');render();
});

async function pollPage(){
  if(tab.startsWith('pr:')){const d=await api('/polls/'+tab.slice(3)+'/results');return pollResultHTML(d,tab.slice(3))}
  const[cs,ps]=await Promise.all([api('/classes'),api('/polls')]);
  return`<section class="card"><h3>🗳 Tạo khảo sát mới</h3><div class="row"><select id="plC">${clsOpts(cs)}</select></div><input id="plQ" placeholder="Câu hỏi khảo sát" style="width:100%;margin-bottom:8px"><textarea id="plO" rows="3" placeholder="Mỗi dòng một lựa chọn (tối thiểu 2)"></textarea><button onclick="addPoll()">Tạo khảo sát</button></section>
<h3>Khảo sát đã tạo</h3>${ps.map(p=>`<section class="card item"><div><b>${esc(p.question)}</b> <span class="tag">${esc(p.class)}</span>${p.closed?' <span class="tag hard">Đã đóng</span>':''}<br><small>${p.options.length} lựa chọn</small></div><div><button class="ghost" onclick="go('pr:${p.id}')">Kết quả</button> <button class="ghost" onclick="togglePoll(${p.id})">${p.closed?'Mở lại':'Đóng'}</button></div></section>`).join('')||'<section class="card"><p>Chưa tạo khảo sát nào.</p></section>'}`;
}
function pollResultHTML(d,id){
  const mx=Math.max(1,...d.counts);
  return`<button class="ghost" onclick="go('poll')">← Quay lại</button><h3 style="margin-top:12px">${esc(d.question)}</h3><p><small>${d.total} lượt bình chọn${d.closed?' · Đã đóng':''}</small></p>
<section class="card">${d.options.map((o,i)=>`<div class="hb"><span>${esc(o)}</span><div><i style="width:${d.counts[i]/mx*100}%"></i></div><b>${d.counts[i]}</b></div>`).join('')}</section>`;
}
window.addPoll=run(async()=>{
  const q=$('#plQ').value.trim(),options=$('#plO').value.split('\n').map(x=>x.trim()).filter(Boolean);
  if(!q||options.length<2)return toast('Nhập câu hỏi và ít nhất 2 lựa chọn');
  await api('/polls','POST',{class_id:+$('#plC').value,question:q,options});toast('Đã tạo khảo sát');render();
});
window.togglePoll=run(async id=>{await api('/polls/'+id+'/close','POST');render()});

/* ---------- HỌC SINH: tài liệu · điểm danh · khảo sát ---------- */
NAV.hs.splice(NAV.hs.length-1,0,['mat','📎','Tài liệu'],['att','📅','Điểm danh'],['poll','🗳','Khảo sát']);
const _pgHs6=PAGES.hs;
PAGES.hs=async()=>{
  if(tab=='mat')return myMatPage();
  if(tab=='att')return myAttPage();
  if(tab=='poll')return myPollPage();
  return _pgHs6();
};
async function myMatPage(){
  const ms=await api('/my-materials');
  return`<h3>📎 Tài liệu học tập</h3>`+(ms.map(m=>`<section class="card"><b>${esc(m.title)}</b> <small>· ${esc(m.teacher)}</small>${m.link?`<p><a href="${esc(m.link)}" target="_blank" rel="noopener">🔗 ${esc(m.link)}</a></p>`:''}${m.content?`<p>${esc(m.content)}</p>`:''}</section>`).join('')||'<section class="card"><p>Chưa có tài liệu nào.</p></section>')}
async function myAttPage(){
  const d=await api('/attendance-me');
  return`<h3>📅 Điểm danh của tôi</h3><div class="stats">${stat('Tỉ lệ có mặt',d.rate)}${stat('Số buổi',d.rows.length)}</div>
<section class="card scroll"><table><tr><th>Ngày</th><th>Trạng thái</th></tr>${d.rows.map(x=>`<tr><td>${x.date}</td><td>${ATS[x.status]?ATS[x.status][0]+' '+ATS[x.status][1]:x.status}</td></tr>`).join('')||'<tr><td colspan=2><small>Chưa có dữ liệu điểm danh.</small></td></tr>'}</table></section>`;
}
async function myPollPage(){
  if(tab.startsWith('pr:')){const d=await api('/polls/'+tab.slice(3)+'/results-hs');return pollResultHTML(d,tab.slice(3))}
  const ps=await api('/my-polls');
  return`<h3>🗳 Khảo sát</h3>`+(ps.map(p=>`<section class="card"><p><b>${esc(p.question)}</b>${p.closed?' <span class="tag hard">Đã đóng</span>':''}</p>${p.options.map((o,i)=>`<label class="opt ${p.voted==i?'good':''}"><input type="radio" name="pq${p.id}" ${p.voted==i?'checked':''} ${p.closed?'disabled':''} onchange="votePoll(${p.id},${i})"> ${esc(o)}</label>`).join('')}<p><button class="ghost" onclick="go('pr:${p.id}')">Xem kết quả</button></p></section>`).join('')||'<section class="card"><p>Chưa có khảo sát nào.</p></section>')}
window.votePoll=run(async(id,choice)=>{await api('/polls/'+id+'/vote','POST',{choice});toast('Đã ghi nhận lựa chọn của bạn');render()});
