/* =====================================================================
   Chức năng mở rộng (phần 2, nạp sau features.js)
   D. Admin – Nhật ký hoạt động & xuất dữ liệu dự phòng
   E. Giáo viên – Sổ điểm theo lớp · Lịch thi
   F. Học sinh – Bài sắp đến hạn trên trang chủ · Thông báo chưa đọc
   ===================================================================== */

/* ---------- D. ADMIN: nhật ký hoạt động ---------- */
NAV.admin.splice(1,0,['log','🗒','Nhật ký & dữ liệu']);
const _pgAdmin2=PAGES.admin;
PAGES.admin=async()=>{if(tab=='log')return logPage();return _pgAdmin2()};
let LOGF='';
async function logPage(){
  const d=await api('/admin/log'+(LOGF?`?action=${encodeURIComponent(LOGF)}`:''));
  return`<div class="stats">${stat('Tổng hoạt động',d.total)}</div>
<section class="card"><div class="item"><h3 style="margin:0">🗒 Nhật ký hoạt động</h3><span><select onchange="logFilter(this.value)"><option value="">Tất cả hành động</option>${d.actions.map(a=>`<option value="${esc(a)}" ${LOGF==a?'selected':''}>${esc(a)}</option>`).join('')}</select> <button class="ghost" onclick="exportAll()">⬇ Xuất dữ liệu dự phòng</button></span></div>
<p><small>Ghi lại việc tạo/xóa tài khoản, khóa/mở khóa, tạo/xóa lớp và tạo/xóa bài kiểm tra. Chỉ hiện ${d.rows.length} hoạt động gần nhất.</small></p>
<div class="row"><input id="logq" placeholder="🔍 Tìm theo người thực hiện" oninput="filterLog()" style="flex:1;min-width:200px"></div>
<div class="scroll"><table><tr><th>Thời gian</th><th>Người thực hiện</th><th>Hành động</th><th>Chi tiết</th></tr>${d.rows.map(x=>`<tr data-s="${esc((x.actor_name||'').toLowerCase())}"><td><small>${fmt(x.at)}</small></td><td>${esc(x.actor_name||'(đã xóa)')} <small>${x.role?ROLE[x.role]||x.role:''}</small></td><td><span class="tag">${esc(x.action)}</span></td><td>${esc(x.detail||'')}</td></tr>`).join('')||'<tr><td colspan=4><small>Chưa có hoạt động nào.</small></td></tr>'}</table></div></section>`;
}
window.logFilter=v=>{LOGF=v;render()};
window.filterLog=()=>{const q=$('#logq').value.toLowerCase().trim();document.querySelectorAll('tr[data-s]').forEach(t=>t.style.display=!q||t.dataset.s.includes(q)?'':'none')};
window.exportAll=run(async()=>{
  const[cs,us,ex]=await Promise.all([api('/classes'),api('/users'),api('/admin/exams')]);
  const t1=`<table style="border-collapse:collapse">${xTitle('DANH SÁCH LỚP',2)}<tr>${['STT','Tên lớp'].map(xTh).join('')}</tr>${cs.map((c,i)=>`<tr>${xTd(i+1,'text-align:center')}${xTd(esc(c.name))}</tr>`).join('')}</table>`;
  const t2=`<br><table style="border-collapse:collapse">${xTitle('DANH SÁCH TÀI KHOẢN',4)}<tr>${['Họ tên','Tên đăng nhập','Vai trò','Lớp'].map(xTh).join('')}</tr>${us.map(u=>`<tr>${xTd(esc(u.name))}${xTd(esc(u.username))}${xTd(ROLE[u.role]||u.role)}${xTd(esc(u.class||''))}</tr>`).join('')}</table>`;
  const t3=`<br><table style="border-collapse:collapse">${xTitle('TỔNG QUAN BÀI THI',6)}<tr>${['Tên bài','Loại','Lớp','Giáo viên','Số câu','Đã nộp'].map(xTh).join('')}</tr>${ex.map(e=>`<tr>${xTd(esc(e.title))}${xTd(e.mode=='exam'?'Kiểm tra':'Ôn tập')}${xTd(esc(e.class))}${xTd(esc(e.teacher||''))}${xTd(e.qcount,'text-align:center')}${xTd(e.done,'text-align:center')}</tr>`).join('')}</table>`;
  dlXls('EduGDTX-du-phong-'+new Date().toISOString().slice(0,10),t1+t2+t3);toast('Đã tải dữ liệu dự phòng')});

/* ---------- E. GIÁO VIÊN: sổ điểm & lịch thi ---------- */
NAV.gv.splice(3,0,['grade','🧮','Sổ điểm'],['cal','🗓','Lịch thi']);
const _pgGv2=PAGES.gv;
PAGES.gv=async()=>{if(tab=='grade')return gradePage();if(tab=='cal')return calPage();return _pgGv2()};
let GBC=null;
async function gradePage(){
  const es=await api('/exams'),byClass={};
  es.forEach(e=>{byClass[e.class_id]=byClass[e.class_id]||e.class});
  const classes=Object.entries(byClass);
  if(!classes.length)return`<section class="card"><p>Bạn chưa giao bài cho lớp nào nên chưa có sổ điểm. Hãy giao bài trước.</p></section>`;
  if(GBC==null)GBC=+classes[0][0];
  const d=await api('/classes/'+GBC+'/gradebook');
  const cell=s=>s==null?'<td class="gc none">–</td>':`<td class="gc ${s>=8?'ok':s<5?'bad':''}">${s}</td>`;
  return`<section class="card"><div class="row" style="align-items:center"><label>Lớp<select onchange="GBC=+this.value;render()">${classes.map(([id,name])=>`<option value="${id}" ${id==GBC?'selected':''}>${esc(name)}</option>`).join('')}</select></label>${d.exams.length?`<button class="ghost" onclick="exportGrade()">⬇ Xuất Excel</button>`:''}</div></section>
${!d.exams.length?`<section class="card"><p>Lớp <b>${esc(d.class)}</b> chưa có bài kiểm tra nào của bạn.</p></section>`:
`<section class="card scroll"><h3>🧮 Sổ điểm lớp ${esc(d.class)}</h3><table><tr><th>Học sinh</th>${d.exams.map(e=>`<th title="${esc(e.title)}">${esc(e.title.length>14?e.title.slice(0,13)+'…':e.title)}</th>`).join('')}<th>TB</th></tr>${d.rows.map(s=>`<tr><td>${esc(s.name)}</td>${s.scores.map(cell).join('')}<td class="gc ${s.avg==null?'none':s.avg>=8?'ok':s.avg<5?'bad':''}"><b>${s.avg??'–'}</b></td></tr>`).join('')}</table></section>`}`;
}
window.exportGrade=run(async()=>{
  const d=await api('/classes/'+GBC+'/gradebook');
  const t=`<table style="border-collapse:collapse">${xTitle('SỔ ĐIỂM LỚP '+d.class.toUpperCase(),d.exams.length+2)}<tr>${xTh('Học sinh')}${d.exams.map(e=>xTh(esc(e.title))).join('')}${xTh('Trung bình')}</tr>${d.rows.map(s=>`<tr>${xTd(esc(s.name),'font-weight:bold')}${s.scores.map(v=>xTd(v??'',`text-align:center;${v!=null&&v<5?'color:#c62828':''}`)).join('')}${xTd(s.avg??'','text-align:center;font-weight:bold')}</tr>`).join('')}</table>`;
  dlXls('So-diem-'+d.class,t);toast('Đã tải sổ điểm')});
async function calPage(){
  const es=(await api('/exams')).filter(e=>e.teacher_id==me.id||!('teacher_id'in e));
  if(!es.length)return`<section class="card"><p>Bạn chưa giao bài nào.</p></section>`;
  const key=e=>e.start_at||e.deadline||'';
  const groups={};es.slice().sort((a,b)=>(key(a)||'9').localeCompare(key(b)||'9')).forEach(e=>{const d=(e.start_at||e.deadline||'').slice(0,10)||'none';(groups[d]=groups[d]||[]).push(e)});
  const now=Date.now(),tagOf=e=>{
    if(e.start_at&&new Date(e.start_at)>now)return`<span class="tag">Mở lúc ${fmt(e.start_at).slice(-5)}</span>`;
    if(e.deadline){const t=new Date(e.deadline)-now;if(t<0)return'<span class="tag">Đã hết hạn</span>';if(t<86400000)return'<span class="tag hard">Hết hạn hôm nay</span>';return`<span class="tag">Còn ${Math.ceil(t/86400000)} ngày</span>`}
    return''};
  return`<h3>🗓 Lịch thi của bạn</h3>`+Object.entries(groups).map(([d,L])=>`<section class="card"><h3>${d=='none'?'Không đặt lịch cụ thể':new Date(d).toLocaleDateString('vi-VN',{weekday:'long',day:'2-digit',month:'2-digit',year:'numeric'})}</h3>${L.map(e=>`<div class="item calrow" onclick="go('r:${e.id}')"><div><b>${esc(e.title)}</b> <span class="tag">${e.mode=='exam'?'Kiểm tra':'Ôn tập'}</span> ${tagOf(e)}<br><small>${esc(e.class)} · ${e.qcount} câu · ${e.minutes} phút${e.deadline?' · Hạn '+fmt(e.deadline):''}</small></div><span>${e.done} nộp ›</span></div>`).join('')}</section>`).join('');
}

/* ---------- F. HỌC SINH: bài sắp đến hạn + thông báo chưa đọc ---------- */
const _pgHs2=PAGES.hs;
PAGES.hs=async()=>{const h=await _pgHs2();return tab==''?await withUpcoming(h):h};
async function withUpcoming(h){
  if(!h.includes('<h3>Bài của tôi</h3>'))return h;
  try{
    const es=await api('/my-exams'),now=Date.now();
    const soon=es.filter(e=>e.score==null&&e.tries==0&&e.mode=='exam'&&(e.deadline||e.start_at))
      .map(e=>{const open=e.start_at&&new Date(e.start_at)>now;return{...e,t:open?new Date(e.start_at)-now:(e.deadline?new Date(e.deadline)-now:1/0),open}})
      .filter(e=>!e.deadline||new Date(e.deadline)>now).sort((a,b)=>a.t-b.t).slice(0,3);
    if(!soon.length)return h;
    const rel=ms=>{if(ms<0)return'Sắp hết hạn';const h=ms/3600000;if(h<1)return'Còn '+Math.max(1,Math.round(ms/60000))+' phút';if(h<24)return'Còn '+Math.round(h)+' giờ';return'Còn '+Math.round(h/24)+' ngày'};
    const block=`<section class="card upc"><h3>⏰ Sắp đến hạn</h3><div class="upclist">${soon.map(e=>`<div class="upcx ${e.t<86400000&&!e.open?'soon':''}" onclick="document.getElementById('ex${e.id}')?.scrollIntoView({behavior:'smooth',block:'center'})"><b>${esc(e.title)}</b><small>${e.open?'Mở lúc '+fmt(e.start_at):rel(e.t)}</small></div>`).join('')}</div></section>`;
    return h.replace('<h3>Bài của tôi</h3>',block+'<h3>Bài của tôi</h3>');
  }catch(e){return h}
}
const annSeenKey='annSeen';
async function patchAnnBadge(){
  if(!me||me.role!='hs')return;
  try{
    const as=await api('/announcements');if(!as.length)return;
    const latest=Math.max(...as.map(a=>a.created_at));
    if(tab=='ann'){localStorage.setItem(annSeenKey,String(latest));return}
    const seen=+localStorage.getItem(annSeenKey)||0,n=as.filter(a=>a.created_at>seen).length;
    if(!n)return;
    const el=document.querySelector(`nav a[onclick="go('ann')"]`);
    if(el&&!el.querySelector('.navbadge'))el.insertAdjacentHTML('beforeend',`<span class="navbadge">${n>9?'9+':n}</span>`);
  }catch(e){}
}
const _render2=render;
render=async function(){await _render2();await patchAnnBadge()};
