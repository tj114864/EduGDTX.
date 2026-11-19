/* =====================================================================
   Chức năng mở rộng (phần 3, nạp sau features2.js)
   G. Admin – Tổng quan theo lớp & chuyển lớp cho học sinh
   H. Học sinh – Hồ sơ cá nhân
   ===================================================================== */

/* ---------- G. ADMIN: tổng quan theo lớp + chuyển lớp ---------- */
NAV.admin.splice(2,0,['overview','🏫','Tổng quan lớp']);
const _pgAdmin3=PAGES.admin;
PAGES.admin=async()=>{if(tab=='overview')return overviewPage();return _pgAdmin3()};
async function overviewPage(){
  const[rows,us,cs]=await Promise.all([api('/admin/classes-overview'),api('/users'),api('/classes')]);
  const students=us.filter(u=>u.role=='hs');
  return`<h3>🏫 Tổng quan theo lớp</h3>
<section class="card scroll"><table><tr><th>Lớp</th><th>Sĩ số</th><th>Bài kiểm tra đã giao</th><th>Điểm TB (bài kiểm tra)</th></tr>${rows.map(c=>`<tr><td><b>${esc(c.name)}</b></td><td>${c.students}</td><td>${c.exams}</td><td>${c.avg??'–'}</td></tr>`).join('')||'<tr><td colspan=4><small>Chưa có lớp nào.</small></td></tr>'}</table></section>
<section class="card"><h3>Chuyển lớp cho học sinh</h3>${students.length?`<div class="row"><select id="mvU">${students.map(s=>`<option value="${s.id}">${esc(s.name)} (${esc(s.username)}) – lớp ${esc(s.class||'chưa có')}</option>`).join('')}</select><select id="mvC">${clsOpts(cs)}</select><button onclick="moveClass()">Chuyển lớp</button></div><p><small>Dùng khi học sinh học nhầm lớp hoặc chuyển lớp giữa năm. Các bài kiểm tra cũ vẫn giữ nguyên ở lớp lúc giao.</small></p>`:'<p><small>Chưa có học sinh nào.</small></p>'}</section>`;
}
window.moveClass=run(async()=>{
  const u=$('#mvU'),c=$('#mvC');if(!u||!u.value)return toast('Chưa có học sinh nào để chuyển');
  await api(`/users/${u.value}/class`,'POST',{class_id:+c.value});toast('Đã chuyển lớp cho học sinh');render();
});

/* ---------- H. HỌC SINH: hồ sơ cá nhân ---------- */
NAV.hs.splice(NAV.hs.length-1,0,['profile','🙋','Hồ sơ']);
const _pgHs3=PAGES.hs;
PAGES.hs=async()=>{if(tab=='profile')return profilePage();return _pgHs3()};
async function profilePage(){
  const p=await api('/profile');
  const badge=p.avg==null?null:p.avg>=9?['🏆','Xuất sắc']:p.avg>=8?['🥇','Giỏi']:p.avg>=6.5?['🥈','Khá']:p.avg>=5?['🥉','Trung bình']:['📘','Cần cố gắng hơn'];
  return`<section class="card" style="text-align:center"><div class="av" style="width:56px;height:56px;line-height:56px;font-size:22px;margin:0 auto 8px">${esc(p.name.trim().slice(-1).toUpperCase())}</div><h3 style="margin:4px 0 2px">${esc(p.name)}</h3><small>${esc(p.username)} · Lớp ${esc(p.class||'chưa có')}</small>${badge?`<p class="badge2">${badge[0]} ${badge[1]}</p>`:''}${p.avg!=null&&p.avg>=8?'<p><button class="ghost" onclick="printOwnCert()">🏅 In giấy khen thành tích</button></p>':''}</section>
<div class="stats">${stat('Bài KT đã làm',p.examCount)}${stat('Điểm TB',p.avg)}${stat('Điểm cao nhất',p.best)}${stat('Lượt ôn tập',p.practiceCount)}</div>
${p.rank&&p.examCount?`<section class="card"><p>Bạn đang xếp <b>hạng ${p.rank}</b> trong lớp theo điểm trung bình các bài kiểm tra.</p></section>`:''}`;
}
