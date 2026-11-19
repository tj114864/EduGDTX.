/* =====================================================================
   Chức năng mở rộng (phần 7, nạp sau features6.js)
   Q. Chức vụ cán sự lớp (admin tạo/sửa, học sinh xem ban cán sự lớp mình)
   R. Lịch nghỉ / sự kiện chung (admin quản lý, mọi vai trò xem)
   S. Đơn xin nghỉ học (học sinh gửi, giáo viên duyệt)
   ===================================================================== */

/* ---------- Q. CHỨC VỤ CÁN SỰ LỚP ---------- */
const _pgAdmin7=PAGES.admin;
PAGES.admin=async()=>{
  if(tab=='events')return eventsPage();
  let h=await _pgAdmin7();
  if(tab==''&&h.includes('id="ntt"')){
    const ts=await api('/officer-titles');
    h=h.replace('<option value="">Không có chức vụ</option>',`<option value="">Không có chức vụ</option>${ts.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('')}`);
  }
  return h;
};
window.setTitle=run(async(id,cur)=>{
  const ts=await api('/officer-titles');
  showModal(`<h3>✎ Chức vụ cán sự lớp</h3><select id="ttSel"><option value="">Không có chức vụ</option>${ts.map(t=>`<option value="${esc(t)}" ${t==cur?'selected':''}>${esc(t)}</option>`).join('')}</select><div class="row" style="margin-top:10px"><button onclick="saveTitle(${id})">Lưu</button></div>`,'Đóng');
});
window.saveTitle=run(async id=>{await api('/users/'+id+'/title','PUT',{title:$('#ttSel').value||null});toast('Đã cập nhật chức vụ');$('#modal').hidden=true;render()});

/* ---------- R. LỊCH NGHỈ / SỰ KIỆN CHUNG ---------- */
NAV.admin.splice(5,0,['events','🎉','Sự kiện & lịch nghỉ']);
NAV.gv.splice(10,0,['events','🎉','Sự kiện']);
NAV.hs.splice(NAV.hs.length-1,0,['events','🎉','Sự kiện']);
async function eventsPage(){
  const es=await api('/events'),today=new Date().toISOString().slice(0,10);
  const mgr=me.role=='admin';
  return`${mgr?`<section class="card"><h3>🎉 Thêm sự kiện / lịch nghỉ</h3><div class="row"><input id="evT" placeholder="Tên sự kiện"><input id="evD" type="date"></div><input id="evN" placeholder="Ghi chú (tùy chọn)" style="width:100%;margin-bottom:8px"><button onclick="addEvent()">Thêm</button></section>`:''}
<h3>Danh sách sự kiện</h3>${es.map(e=>`<section class="card item"><div><b>${esc(e.title)}</b> ${e.date<today?'<span class="tag">Đã qua</span>':'<span class="tag">Sắp tới</span>'}<br><small>${new Date(e.date).toLocaleDateString('vi-VN')}${e.note?' · '+esc(e.note):''}</small></div>${mgr?`<button class="ghost" onclick="delEvent(${e.id})">Xóa</button>`:''}</section>`).join('')||'<section class="card"><p>Chưa có sự kiện nào.</p></section>'}`;
}
window.addEvent=run(async()=>{
  const title=$('#evT').value.trim(),date=$('#evD').value;if(!title||!date)return toast('Nhập tên và ngày sự kiện');
  await api('/events','POST',{title,date,note:$('#evN').value.trim()});toast('Đã thêm sự kiện');render();
});
window.delEvent=run(async id=>{if(!await uiConfirm('Xóa sự kiện này?'))return;await api('/events/'+id,'DELETE');render()});
PAGES.gv=(f=>async()=>{if(tab=='events')return eventsPage();return f()})(PAGES.gv);
PAGES.hs=(f=>async()=>{if(tab=='events')return eventsPage();return f()})(PAGES.hs);

/* ---------- S. ĐƠN XIN NGHỈ HỌC ----------
   Học sinh: điền ngày + lý do, đính kèm tối đa 3 ảnh (giấy khám bệnh, đơn có chữ ký phụ huynh...), gửi lên.
   Giáo viên: hộp thư đơn, chia theo lớp, lọc theo trạng thái, xem ảnh, duyệt / từ chối kèm lời nhắn. */
NAV.gv.splice(10,0,['leaves','🙋','Đơn xin nghỉ']);
NAV.hs.splice(NAV.hs.length-1,0,['leaves','🙋','Xin nghỉ học']);
const LV={pending:['⏳','Đang chờ'],approved:['✅','Đã duyệt'],rejected:['❌','Từ chối']};
PAGES.gv=(f=>async()=>{if(tab=='leaves')return leavesGvPage();return f()})(PAGES.gv);
PAGES.hs=(f=>async()=>{if(tab=='leaves')return leavesHsPage();return f()})(PAGES.hs);

const lvDays=(a,b)=>Math.round((new Date(b)-new Date(a))/864e5)+1;
const lvDmy=s=>String(s).split('-').reverse().join('/');
const lvRange=l=>`${lvDmy(l.date_from)}${l.date_to!=l.date_from?' → '+lvDmy(l.date_to):''} <b>(${lvDays(l.date_from,l.date_to)} ngày)</b>`;
const lvToday=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const lvThumbs=(l,lazy)=>l.photo_count?`<div class="lvth">${[...Array(l.photo_count)].map((_,n)=>`<img alt="Ảnh đính kèm ${n+1}" ${lazy?`data-l="${l.id}"`:`data-lid="${l.id}"`} data-n="${n}" onclick="viewLeavePic(this)">`).join('')}</div>`:'';

/* ảnh nằm sau đăng nhập nên phải tải bằng fetch kèm token rồi gắn vào <img> */
new MutationObserver(()=>document.querySelectorAll('img[data-lid]:not([data-ok])').forEach(async im=>{
  im.dataset.ok='1';
  try{const r=await fetch(`/api/leaves/${im.dataset.lid}/photo/${im.dataset.n}`,{headers:{Authorization:'Bearer '+token}});if(!r.ok)throw 0;im.src=URL.createObjectURL(await r.blob())}
  catch{im.alt='Không tải được ảnh';im.style.opacity='.4'}
})).observe(document.body,{childList:true,subtree:true});
window.viewLeavePic=im=>{
  if(!im.src)return;
  const d=document.createElement('div');d.className='lvbox';d.innerHTML=`<img src="${im.src}" alt=""><span>✕ Đóng</span>`;
  d.onclick=()=>d.remove();document.body.append(d);
};

/* ===== HỌC SINH ===== */
let lvPics=[];
const shrinkPic=file=>new Promise((res,rej)=>{
  const im=new Image(),u=URL.createObjectURL(file);
  im.onload=()=>{const k=Math.min(1,1600/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=Math.round(im.width*k);c.height=Math.round(im.height*k);
    c.getContext('2d').drawImage(im,0,0,c.width,c.height);c.toBlob(b=>{URL.revokeObjectURL(u);b?res(b):rej(new Error('Không xử lý được ảnh'))},'image/jpeg',.78)};
  im.onerror=()=>{URL.revokeObjectURL(u);rej(new Error('Không đọc được ảnh này (ảnh HEIC? hãy chụp lại hoặc chọn ảnh JPG/PNG)'))};
  im.src=u});
const lvPreview=()=>{$('#lvPics').innerHTML=lvPics.map((p,i)=>`<div class="lvp"><img src="${p.url}" alt=""><button type="button" class="ghost" onclick="lvRemovePic(${i})" title="Bỏ ảnh này">✕</button></div>`).join('');$('#lvAdd').hidden=lvPics.length>=3;$('#lvCnt').textContent=lvPics.length+'/3 ảnh'};
window.pickLeavePics=run(async inp=>{
  const files=[...inp.files];inp.value='';
  for(const f of files){
    if(lvPics.length>=3){toast('Mỗi đơn đính kèm tối đa 3 ảnh');break}
    if(!/^image\//.test(f.type)&&!/\.(jpe?g|png|webp)$/i.test(f.name)){toast('Chỉ chọn file ảnh');continue}
    const b=await shrinkPic(f);lvPics.push({blob:b,url:URL.createObjectURL(b)});
  }
  lvPreview();
});
window.lvRemovePic=i=>{URL.revokeObjectURL(lvPics[i].url);lvPics.splice(i,1);lvPreview()};
async function leavesHsPage(){
  lvPics=[];
  const ls=await api('/my-leaves');
  return`<section class="card"><h3>🙋 Gửi đơn xin nghỉ học</h3>
<div class="row"><label>Từ ngày<input id="lvF" type="date" value="${lvToday()}"></label><label>Đến ngày<input id="lvT" type="date" value="${lvToday()}"></label></div>
<textarea id="lvR" rows="3" maxlength="300" placeholder="Lý do xin nghỉ (ví dụ: bị ốm, việc gia đình...)"></textarea>
<div class="lvup"><label id="lvAdd" class="lvbtn">📷 Thêm ảnh<input type="file" accept="image/*" multiple hidden onchange="pickLeavePics(this)"></label> <small id="lvCnt">0/3 ảnh</small><small> · Ảnh giấy khám bệnh hoặc đơn có chữ ký phụ huynh (không bắt buộc)</small></div>
<div id="lvPics" class="lvth"></div>
<button id="lvSend" onclick="sendLeave()">📨 Gửi đơn</button></section>
<h3>Đơn đã gửi</h3>${ls.map(l=>`<section class="card item"><div style="flex:1;min-width:220px"><span class="tag">${LV[l.status][0]} ${LV[l.status][1]}</span>${l.photo_count?`<span class="tag">📎 ${l.photo_count} ảnh</span>`:''}<br><small>Nghỉ ${lvRange(l)} · ${esc(l.reason)}</small>
${l.status=='pending'?(l.seen_at?`<br><small>👁 Giáo viên đã xem lúc ${fmt(l.seen_at)}, đang chờ duyệt</small>`:'<br><small>Đã gửi, giáo viên chưa xem</small>'):`<br><small>${l.reviewer?esc(l.reviewer)+' · ':''}${fmt(l.reviewed_at)}</small>`}
${l.review_note?`<br><small>💬 <i>${esc(l.review_note)}</i></small>`:''}${lvThumbs(l)}</div>${l.status=='pending'?`<button class="ghost" onclick="withdrawLeave(${l.id})">Rút đơn</button>`:''}</section>`).join('')||'<section class="card"><p>Bạn chưa gửi đơn nào.</p></section>'}`;
}
window.sendLeave=run(async()=>{
  const f=$('#lvF').value,t=$('#lvT').value,reason=$('#lvR').value.trim();
  if(!f||!t||!reason)return toast('Nhập đầy đủ ngày nghỉ và lý do');
  const btn=$('#lvSend');btn.disabled=true;btn.textContent='Đang gửi...';
  try{
    const d=await api('/leaves','POST',{date_from:f,date_to:t,reason});
    let bad=0;
    for(const p of lvPics){
      try{const r=await fetch(`/api/leaves/${d.id}/photo`,{method:'POST',headers:{'Content-Type':'application/octet-stream',Authorization:'Bearer '+token},body:p.blob});
        if(!r.ok)throw new Error((await r.json().catch(()=>({}))).error||'Lỗi tải ảnh')}catch(e){bad++}
    }
    toast(bad?`Đã gửi đơn nhưng ${bad} ảnh tải lên bị lỗi, bạn có thể rút đơn và gửi lại`:'Đã gửi đơn xin nghỉ');
  }finally{btn.disabled=false}
  render();
});
window.withdrawLeave=run(async id=>{if(!await uiConfirm('Rút lại đơn xin nghỉ này?',{danger:false,okText:'Rút đơn'}))return;await api('/leaves/'+id,'DELETE');toast('Đã rút đơn');render()});

/* ===== GIÁO VIÊN ===== */
let lvCls='',lvSt='pending';
window.lvSet=(k,v)=>{if(k=='c')lvCls=v;else lvSt=v;render()};
async function leavesGvPage(){
  const ls=await api('/leaves');
  const names=[...new Set(ls.map(l=>l.class))].sort((a,b)=>a.localeCompare(b,'vi',{numeric:true}));   // chỉ liệt kê lớp đã có đơn
  if(lvCls&&!names.includes(lvCls))lvCls='';
  const inCls=ls.filter(l=>!lvCls||l.class==lvCls);
  const cnt=s=>inCls.filter(l=>l.status==s).length,pendAll=ls.filter(l=>l.status=='pending').length;
  const shown=inCls.filter(l=>lvSt=='all'||l.status==lvSt);
  const today=lvToday(),off=ls.filter(l=>l.status=='approved'&&l.date_from<=today&&today<=l.date_to&&(!lvCls||l.class==lvCls));
  const clsBtn=(v,label,n)=>`<button class="ghost ${lvCls==v?'on':''}" data-v="${esc(v)}" onclick="lvSet('c',this.dataset.v)">${esc(label)}${n?` <span class="lvn">${n}</span>`:''}</button>`;
  const stBtn=(v,label)=>`<button class="ghost ${lvSt==v?'on':''}" onclick="lvSet('s','${v}')">${label}</button>`;
  const groups=names.filter(n=>shown.some(l=>l.class==n));
  const card=l=>`<section class="card item" id="lv${l.id}"><div style="flex:1;min-width:240px"><b>${esc(l.student)}</b> <span class="tag">${LV[l.status][0]} ${LV[l.status][1]}</span>${l.status=='pending'&&!l.seen_at?'<span class="tag hard">🆕 Mới</span>':''}${l.photo_count?`<span class="tag">📎 ${l.photo_count} ảnh</span>`:''}
<br><small>Nghỉ ${lvRange(l)}<br>Gửi lúc ${fmt(l.created_at)}</small>
<div class="lvd" id="lvd${l.id}" hidden><p>${esc(l.reason)}</p>${lvThumbs(l,true)}</div>
${l.status!='pending'?`<br><small>${esc(l.reviewer||'Giáo viên')} · ${fmt(l.reviewed_at)}${l.review_note?` · 💬 <i>${esc(l.review_note)}</i>`:''}</small>`:''}</div>
<div><button class="ghost" onclick="openLeave(${l.id})">👁 Xem đơn</button>${l.status=='pending'?` <button onclick="reviewLeave(${l.id},'approved')">Duyệt</button> <button class="ghost" onclick="reviewLeave(${l.id},'rejected')">Từ chối</button>`:''}</div></section>`;
  return`<h3>🙋 Đơn xin nghỉ học ${pendAll?`<span class="tag hard">${pendAll} đang chờ</span>`:''}</h3>
<div class="lvbar">${clsBtn('','Tất cả các lớp',pendAll)}${names.map(n=>clsBtn(n,n,ls.filter(l=>l.class==n&&l.status=='pending').length)).join('')}</div>
<div class="lvbar">${stBtn('pending',`⏳ Chờ duyệt (${cnt('pending')})`)}${stBtn('approved',`✅ Đã duyệt (${cnt('approved')})`)}${stBtn('rejected',`❌ Từ chối (${cnt('rejected')})`)}${stBtn('all',`Tất cả (${inCls.length})`)}</div>
${off.length?`<section class="card"><small>📅 Hôm nay đang nghỉ có phép${lvCls?' ('+esc(lvCls)+')':''}: ${off.map(l=>`<b>${esc(l.student)}</b>${lvCls?'':' ('+esc(l.class)+')'}`).join(', ')}</small></section>`:''}
${groups.map(n=>`<h4 class="lvh">🏫 Lớp ${esc(n)} <span class="tag">${shown.filter(l=>l.class==n).length} đơn</span></h4>${shown.filter(l=>l.class==n).map(card).join('')}`).join('')||`<section class="card"><p>${lvSt=='pending'?'Không có đơn nào đang chờ duyệt 🎉':'Không có đơn nào.'}</p></section>`}`;
}
window.openLeave=run(async id=>{
  const d=$('#lvd'+id);d.hidden=!d.hidden;
  if(d.hidden)return;
  d.querySelectorAll('img[data-l]').forEach(im=>{im.dataset.lid=im.dataset.l;delete im.dataset.l});
  if(d.closest('.card').querySelector('.tag.hard')){await api(`/leaves/${id}/seen`,'POST');d.closest('.card').querySelector('.tag.hard').remove()}
});
window.reviewLeave=run(async(id,status)=>{
  const ok=status=='approved',note=await uiPrompt(ok?'Lời nhắn cho học sinh (có thể để trống):':'Lý do từ chối (nên ghi để học sinh biết):','',{title:ok?'Duyệt đơn xin nghỉ':'Từ chối đơn xin nghỉ',okText:ok?'Duyệt':'Từ chối',placeholder:ok?'Ví dụ: Nghỉ khỏe nhé, nhớ chép bài':'Ví dụ: Cần có giấy xác nhận của phụ huynh'});
  if(note===null)return;
  await api('/leaves/'+id+'/review','POST',{status,note});toast(ok?'Đã duyệt đơn':'Đã từ chối đơn');render()});
