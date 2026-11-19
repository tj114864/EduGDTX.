/* =====================================================================
   Chức năng mở rộng (nạp sau app.js, dùng chung các biến toàn cục của app.js)
   A. Nhập tài khoản hàng loạt · Ngân hàng câu hỏi · Tự lưu bài · Giám sát trực tiếp · Sổ tay lỗi
   ===================================================================== */

/* ---------- Tiện ích chung ---------- */
const openModal=(h,cls='')=>{const m=$('#modal');m.onclick=null;m.className='';m._fn=null;m.innerHTML=`<div class="mbox ${cls}">${h}</div>`;m.hidden=false;return m};
const closeM=()=>{const m=$('#modal');m.hidden=true;m.onclick=null;m._fn=null};
window.closeM=closeM;
const dlBlob=(name,blob)=>{const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.append(a);a.click();setTimeout(()=>{a.remove();URL.revokeObjectURL(a.href)},1500)};
const dlXls=(name,body,cols=8)=>dlBlob(name.replace(/[\\/:*?"<>|]+/g,'-')+'.xls',new Blob(['﻿<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body style="font-family:Calibri,Arial,sans-serif">'+body+'</body></html>'],{type:'application/vnd.ms-excel;charset=utf-8'}));
const xTh=t=>`<th style="background:#1d5fd6;color:#fff;font-weight:bold;border:1px solid #14459c;padding:8px;text-align:center">${t}</th>`;
const xTd=(v,st='')=>`<td style="border:1px solid #c9d6ee;padding:6px 8px;${st}">${v}</td>`;
const xTitle=(t,cols,sub)=>`<tr><td colspan="${cols}" style="font-size:20px;font-weight:bold;color:#fff;background:#14459c;padding:12px;text-align:center">${t}</td></tr>${sub?`<tr><td colspan="${cols}" style="background:#e3edff;padding:6px;text-align:center">${sub}</td></tr>`:''}`;
const copyText=async t=>{try{await navigator.clipboard.writeText(t);toast('Đã sao chép')}catch{const a=document.createElement('textarea');a.value=t;document.body.append(a);a.select();try{document.execCommand('copy');toast('Đã sao chép')}catch{}a.remove()}};
const postRaw=async(p,file)=>{const r=await fetch('/api'+p,{method:'POST',headers:{'Content-Type':'application/octet-stream',Authorization:'Bearer '+token},body:file});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Lỗi '+r.status);return d};
const pluck=(h,a,b)=>{const i=h.indexOf(a);return i<0?h:h.replace(a,b)};

/* ---------- Điều hướng bổ sung ---------- */
NAV.gv.splice(2,0,['bank','📚','Ngân hàng câu hỏi']);
NAV.hs.splice(2,0,['mis','📓','Sổ tay lỗi']);
const _pg={gv:PAGES.gv,hs:PAGES.hs,admin:PAGES.admin};

/* =====================================================================
   1. ADMIN – nhập tài khoản hàng loạt
   ===================================================================== */
PAGES.admin=async()=>{
  const[h,cs]=await Promise.all([_pg.admin(),api('/classes')]);
  const sec=`<section class="card" id="bkc"><h3>📥 Nhập tài khoản hàng loạt (Excel / CSV)</h3>
<p><small>Mỗi dòng một người: <b>Họ tên</b> · Tên đăng nhập · Mật khẩu · Lớp. Chỉ cần có <b>họ tên</b> – hệ thống tự tạo tên đăng nhập (ví dụ "Nguyễn Văn An" → <code>annv</code>) và mật khẩu ngẫu nhiên. Dán trực tiếp từ Excel hoặc chọn file .xlsx / .csv.</small></p>
<div class="row"><select id="bkr"><option value="hs">Học sinh</option><option value="gv">Giáo viên</option></select><select id="bkcl" title="Lớp mặc định (dùng khi dòng không ghi lớp)">${clsOpts(cs)}</select><input type="file" id="bkf" accept=".xlsx,.csv,.txt,.tsv" onchange="bkFile(this)"><button class="ghost" onclick="bkSample()">⬇ File mẫu</button></div>
<textarea id="bkt" rows="6" placeholder="Dán danh sách từ Excel vào đây, ví dụ:&#10;Nguyễn Văn An&#9;&#9;&#9;11B&#10;Trần Thị Bình&#9;binhtt&#9;Matkhau123&#9;11C" oninput="bkPreview()"></textarea>
<div id="bkp"></div><div class="row"><button id="bkgo" onclick="bkRun()" disabled>Tạo tài khoản</button></div><div id="bkres"></div></section>`;
  return h.replace('<section class="card"><h3>Lớp học</h3>',sec+'<section class="card"><h3>Lớp học</h3>');
};
let BKROWS=[];
function bkParse(text){
  const lines=text.replace(/\r/g,'').split('\n').filter(l=>l.trim());if(!lines.length)return[];
  const split=l=>l.includes('\t')?l.split('\t'):/[;,]/.test(l)?l.split(/[;,]/):[l];
  let rows=lines.map(l=>split(l).map(c=>c.trim().replace(/^"|"$/g,'').trim()));
  const H={name:/^(họ\s*(và)?\s*tên|tên|name|hoten|ho\s*ten)$/i,username:/^(tên\s*đăng\s*nhập|tài\s*khoản|username|user|tendangnhap|taikhoan)$/i,password:/^(mật\s*khẩu|password|mk|matkhau)$/i,class:/^(lớp|class|lop)$/i};
  let map;
  if(rows[0].some(c=>Object.values(H).some(re=>re.test(c)))){map={};rows[0].forEach((c,i)=>{for(const k in H)if(H[k].test(c)&&map[k]==null)map[k]=i});if(map.name==null)map.name=0;rows=rows.slice(1)}
  else if(rows.every(r=>/^\d+$/.test(r[0]||'')&&r.length>1))map={name:1,username:2,password:3,class:4};   // có cột STT
  else map={name:0,username:1,password:2,class:3};
  return rows.map((r,i)=>({n:i+1,name:r[map.name]||'',username:r[map.username]||'',password:r[map.password]||'',class:r[map.class]||''})).filter(x=>x.name||x.username);
}
window.bkPreview=()=>{
  BKROWS=bkParse($('#bkt').value);const p=$('#bkp'),go=$('#bkgo');
  if(!BKROWS.length){p.innerHTML='';go.disabled=true;return}
  p.innerHTML=`<p><b>${BKROWS.length}</b> dòng sẽ được tạo. Xem trước:</p><div class="scroll"><table><tr><th>#</th><th>Họ tên</th><th>Tên đăng nhập</th><th>Mật khẩu</th><th>Lớp</th></tr>${BKROWS.slice(0,6).map(x=>`<tr><td>${x.n}</td><td>${esc(x.name)}</td><td>${esc(x.username)||'<small>(tự tạo)</small>'}</td><td>${esc(x.password)||'<small>(ngẫu nhiên)</small>'}</td><td>${esc(x.class)||'<small>(lớp mặc định)</small>'}</td></tr>`).join('')}</table></div>${BKROWS.length>6?`<small>… và ${BKROWS.length-6} dòng nữa</small>`:''}`;
  go.disabled=false;go.textContent=`Tạo ${BKROWS.length} tài khoản`};
window.bkFile=run(async inp=>{const f=inp.files[0];if(!f)return;const n=f.name.toLowerCase();let text;
  if(n.endsWith('.xlsx')){toast('Đang đọc file Excel...');const d=await postRaw('/users/xlsx',f);text=d.rows.map(r=>r.join('\t')).join('\n')}
  else text=await f.text();
  $('#bkt').value=text.replace(/^﻿/,'');bkPreview();inp.value=''});
window.bkSample=()=>dlBlob('mau-nhap-tai-khoan.csv',new Blob(['﻿Họ tên,Tên đăng nhập,Mật khẩu,Lớp\nNguyễn Văn An,,,11B\nTrần Thị Bình,binhtt,Matkhau123,11C\nLê Văn Cường,,,11B\n'],{type:'text/csv;charset=utf-8'}));
window.bkRun=run(async()=>{
  if(!BKROWS.length)return;const role=$('#bkr').value,cid=+$('#bkcl').value||null,btn=$('#bkgo');
  if(role=='hs'&&!cid&&BKROWS.some(x=>!x.class))throw new Error('Hãy chọn lớp mặc định');
  btn.disabled=true;const created=[],errors=[];
  try{for(let i=0;i<BKROWS.length;i+=40){
    btn.textContent=`Đang tạo… ${Math.min(i,BKROWS.length)}/${BKROWS.length}`;
    const d=await api('/users/bulk','POST',{role,class_id:cid,rows:BKROWS.slice(i,i+40)});created.push(...d.created);errors.push(...d.errors)}}
  finally{btn.disabled=false;btn.textContent='Tạo tài khoản'}
  BKROWS=[];$('#bkt').value='';$('#bkp').innerHTML='';
  window._bkCreated=created;
  $('#bkres').innerHTML=`<div class="bkok"><b>✅ Đã tạo ${created.length} tài khoản</b>${errors.length?` · <span class="hard">${errors.length} dòng lỗi</span>`:''}
<div class="row" style="margin:8px 0"><button onclick="bkExport()">⬇ Tải danh sách tài khoản (Excel)</button><button class="ghost" onclick="bkCopy()">📋 Sao chép</button></div>
<small>⚠ Hãy tải hoặc sao chép danh sách ngay – mật khẩu chỉ hiện một lần, sau này chỉ có thể đặt lại.</small>
<div class="scroll"><table><tr><th>Họ tên</th><th>Tên đăng nhập</th><th>Mật khẩu</th><th>Lớp</th></tr>${created.slice(0,50).map(x=>`<tr><td>${esc(x.name)}</td><td><b>${esc(x.username)}</b></td><td><code>${esc(x.password)}</code></td><td>${esc(x.class)}</td></tr>`).join('')}</table></div>${created.length>50?`<small>… hiển thị 50 dòng đầu, file Excel có đủ ${created.length} dòng.</small>`:''}
${errors.length?`<div class="bker"><b>Các dòng không tạo được:</b>${errors.map(e=>`<div>Dòng ${e.row}${e.name?' ('+esc(e.name)+')':''}: ${esc(e.error)}</div>`).join('')}</div>`:''}</div>`;
  toast(`Đã tạo ${created.length} tài khoản`)});
window.bkExport=()=>{const L=window._bkCreated||[];dlXls('Danh-sach-tai-khoan',`<table style="border-collapse:collapse">${xTitle('DANH SÁCH TÀI KHOẢN',5,'Xuất ngày '+new Date().toLocaleDateString('vi-VN')+' · Hãy gửi riêng cho từng người và yêu cầu đổi mật khẩu sau khi đăng nhập')}<tr>${['STT','Họ và tên','Tên đăng nhập','Mật khẩu','Lớp'].map(xTh).join('')}</tr>${L.map((x,i)=>`<tr>${xTd(i+1,'text-align:center')}${xTd(esc(x.name),'font-weight:bold')}${xTd(esc(x.username))}${xTd(esc(x.password),'font-family:Consolas,monospace')}${xTd(esc(x.class),'text-align:center')}</tr>`).join('')}</table>`)};
window.bkCopy=()=>copyText((window._bkCreated||[]).map(x=>[x.name,x.username,x.password,x.class].join('\t')).join('\n'));

/* =====================================================================
   2. GIÁO VIÊN – ngân hàng câu hỏi
   ===================================================================== */
let BK={rows:[],tags:[],tag:'',q:'',type:'',sel:new Set()};
const qPreview=x=>x.type=='mc'?x.options.map((o,k)=>`<div class="bo ${k==x.answer?'ok':''}">${'ABCD'[k]}. ${esc(o)}${k==x.answer?' ✓':''}</div>`).join(''):x.type=='tf'?x.options.map((o,k)=>`<div class="bo ${x.key[k]=='D'?'ok':''}">${'abcd'[k]}) ${esc(o)} — <b>${x.key[k]=='D'?'Đúng':'Sai'}</b></div>`).join(''):(x.model?`<div class="bo"><small>Gợi ý: ${esc(x.model)}</small></div>`:'');
const bkFilter=rows=>rows.filter(x=>(!BK.tag&&BK.tag!=='\0'||(BK.tag=='\0'?!x.tag:x.tag==BK.tag))&&(!BK.type||x.type==BK.type)&&(!BK.q||(x.content+' '+x.options.join(' ')).toLowerCase().includes(BK.q.toLowerCase())));
const tagOpts=()=>`<option value="">Tất cả thẻ</option>${BK.tags.map(t=>`<option value="${t.name||'\0'}" ${BK.tag==(t.name||'\0')?'selected':''}>${esc(t.name||'(chưa gắn thẻ)')} (${t.n})</option>`).join('')}`;
async function bankLoad(){const d=await api('/bank');BK.rows=d.rows;BK.tags=d.tags;BK.sel=new Set()}
function bankList(){
  const rows=bkFilter(BK.rows);
  return rows.length?rows.slice(0,200).map(x=>`<section class="card bki"><div class="item"><div><label class="chk"><input type="checkbox" ${BK.sel.has(x.id)?'checked':''} onchange="bkSel(${x.id},this.checked)"> <span class="tag">${TYPE[x.type]}</span> <a class="tagc" onclick="bkTag(${x.id})" title="Bấm để đổi thẻ">${x.tag?'🏷 '+esc(x.tag):'🏷 + thẻ'}</a> <small>${x.points} điểm</small></label></div><a class="x" onclick="bkDel(${x.id})" title="Xóa">🗑</a></div><p class="bkq">${esc(x.content)}</p>${qPreview(x)}</section>`).join('')+(rows.length>200?`<small>Hiển thị 200/${rows.length} câu đầu – hãy lọc theo thẻ hoặc tìm kiếm.</small>`:''):'<section class="card" style="text-align:center"><small>Không có câu hỏi nào.</small></section>'}
window.bkRefresh=()=>{$('#bklist').innerHTML=bankList();const n=BK.sel.size;const b=$('#bkdel');if(b){b.hidden=!n;b.textContent=`🗑 Xóa ${n} câu đã chọn`}};
window.bkSel=(id,on)=>{on?BK.sel.add(id):BK.sel.delete(id);const n=BK.sel.size,b=$('#bkdel');b.hidden=!n;b.textContent=`🗑 Xóa ${n} câu đã chọn`};
window.bkSelAll=()=>{bkFilter(BK.rows).forEach(x=>BK.sel.add(x.id));bkRefresh()};
window.bkSetF=(k,v)=>{BK[k]=v;bkRefresh()};
window.bkDel=run(async id=>{if(!await uiConfirm('Xóa câu này khỏi ngân hàng?'))return;await api('/bank/'+id,'DELETE');await bankLoad();render()});
window.bkDelSel=run(async()=>{if(!await uiConfirm(`Xóa ${BK.sel.size} câu đã chọn?`))return;await api('/bank/delete','POST',{ids:[...BK.sel]});await bankLoad();render()});
window.bkTag=run(async id=>{const x=BK.rows.find(r=>r.id==id),t=await uiPrompt('Thẻ cho câu này (chương / chủ đề / mức độ):',x.tag||'',{title:'Gắn thẻ câu hỏi',icon:'🏷️',okText:'Lưu'});if(t===null)return;await api('/bank/'+id,'PUT',{tag:t});await bankLoad();render()});
window.bkImport=run(async()=>{const f=$('#bkfi').files[0];if(!f)throw new Error('Hãy chọn file đề');toast('Đang đọc file...');
  const d=await postRaw('/import?name='+encodeURIComponent(f.name),f);
  const r=await api('/bank','POST',{tag:$('#bkgtag').value,questions:d.questions});
  toast(`Đã thêm ${r.added} câu${r.dup?`, bỏ qua ${r.dup} câu trùng`:''}${r.bad?`, ${r.bad} câu chưa có đáp án`:''}`);await bankLoad();render()});
async function bankPage(){
  await bankLoad();
  return`<div class="stats">${stat('Câu trong ngân hàng',BK.rows.length)}${stat('Số thẻ',BK.tags.filter(t=>t.name).length)}</div>
<section class="card"><h3>📥 Nhập thẳng từ file đề vào ngân hàng</h3><p><small>Chỉ những câu đã nhận được đáp án đúng mới được lưu; câu trùng nội dung được bỏ qua. Để gắn câu vào bài, dùng nút "📚 Thêm từ ngân hàng" khi soạn bài.</small></p><div class="row"><input type="file" id="bkfi" accept=".docx,.pdf,.txt"><input id="bkgtag" placeholder="Thẻ (VD: Lịch sử 11 – Chương 1)" style="min-width:220px"><button onclick="bkImport()">Nhập vào ngân hàng</button></div></section>
<section class="card"><div class="row"><select onchange="bkSetF('tag',this.value)" id="bktg">${tagOpts()}</select><select onchange="bkSetF('type',this.value)"><option value="">Mọi loại câu</option><option value="mc">Trắc nghiệm</option><option value="tf">Đúng / Sai</option><option value="essay">Tự luận</option></select><input placeholder="🔍 Tìm trong câu hỏi" oninput="bkSetF('q',this.value)" style="flex:1;min-width:180px"><button class="ghost" onclick="bkSelAll()">Chọn tất cả</button><button class="ghost" id="bkdel" onclick="bkDelSel()" hidden></button></div></section>
<div id="bklist">${bankList()}</div>`}
PAGES.gv=async()=>{
  if(tab=='bank')return bankPage();
  if(tab.startsWith('live:'))return livePage(+tab.slice(5));
  let h=await _pg.gv();
  if(tab=='new'||tab=='edit')h=h.replace(/<small>Chọn nút tròn/,'<small>Chọn nút tròn');
  return h};
window.saveBank=run(async i=>{
  const list=i=='all'?qb:[qb[i]],ok=list.filter(q=>!chk(q));
  if(!ok.length)throw new Error('Chưa có câu hợp lệ để lưu (cần đủ nội dung và đáp án đúng)');
  const tag=($('#btag')&&$('#btag').value.trim())||ex.title||'';
  const r=await api('/bank','POST',{tag,questions:ok.map(({warn,...q})=>({...q,answer:+q.answer,points:+q.points||1}))});
  toast(`Đã lưu ${r.added} câu vào ngân hàng${r.dup?` (bỏ qua ${r.dup} câu trùng)`:''}`)});
/* chọn câu từ ngân hàng khi soạn bài */
let PK={rows:[],tags:[],tag:'',q:'',type:'',sel:new Set()};
window.openPicker=run(async()=>{
  const d=await api('/bank');PK={rows:d.rows,tags:d.tags,tag:'',q:'',type:'',sel:new Set()};
  if(!PK.rows.length)throw new Error('Ngân hàng đang trống. Hãy dùng "💾 Lưu cả đề vào ngân hàng" hoặc nhập đề ở mục Ngân hàng câu hỏi.');
  const m=openModal(`<h3>📚 Thêm câu từ ngân hàng</h3>
<div class="row"><select onchange="pkSet('tag',this.value)"><option value="">Tất cả thẻ</option>${PK.tags.map(t=>`<option value="${esc(t.name||'\0')}">${esc(t.name||'(chưa gắn thẻ)')} (${t.n})</option>`).join('')}</select><select onchange="pkSet('type',this.value)"><option value="">Mọi loại</option><option value="mc">Trắc nghiệm</option><option value="tf">Đúng / Sai</option><option value="essay">Tự luận</option></select><input placeholder="🔍 Tìm" oninput="pkSet('q',this.value)" style="flex:1;min-width:120px"></div>
<div class="pklist" id="pkl"></div>
<div class="pkfoot"><div class="row" style="margin:0;align-items:center"><button class="ghost" onclick="pkAll()">Chọn tất cả đang hiện</button><span>Bốc ngẫu nhiên</span><input type="number" id="pkn" min="1" value="10" style="width:70px"><button class="ghost" onclick="pkRand()">🎲 Bốc</button></div>
<div class="row" style="margin:8px 0 0;justify-content:space-between"><b id="pkc">Đã chọn 0 câu</b><span><button onclick="pkAdd()">Thêm vào bài</button> <button class="ghost" onclick="closeM()">Đóng</button></span></div></div>`,'wide');
  pkDraw()});
const pkRows=()=>PK.rows.filter(x=>(!PK.tag||(PK.tag=='\0'?!x.tag:x.tag==PK.tag))&&(!PK.type||x.type==PK.type)&&(!PK.q||(x.content+' '+x.options.join(' ')).toLowerCase().includes(PK.q.toLowerCase())));
function pkDraw(){const rows=pkRows();$('#pkl').innerHTML=rows.length?rows.slice(0,150).map(x=>`<label class="pki ${PK.sel.has(x.id)?'on':''}"><input type="checkbox" ${PK.sel.has(x.id)?'checked':''} onchange="pkTog(${x.id},this.checked)"><span><span class="tag">${TYPE[x.type]}</span>${x.tag?` <small>🏷 ${esc(x.tag)}</small>`:''}<br>${esc(x.content.length>160?x.content.slice(0,160)+'…':x.content)}</span></label>`).join(''):'<small>Không có câu phù hợp.</small>';$('#pkc').textContent=`Đã chọn ${PK.sel.size} câu`}
window.pkSet=(k,v)=>{PK[k]=v;pkDraw()};
window.pkTog=(id,on)=>{on?PK.sel.add(id):PK.sel.delete(id);pkDraw()};
window.pkAll=()=>{pkRows().forEach(x=>PK.sel.add(x.id));pkDraw()};
window.pkRand=()=>{const n=Math.max(1,+$('#pkn').value||10),a=[...pkRows()];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}PK.sel=new Set(a.slice(0,n).map(x=>x.id));pkDraw();toast(`Đã bốc ${PK.sel.size} câu ngẫu nhiên`)};
window.pkAdd=()=>{const pick=PK.rows.filter(x=>PK.sel.has(x.id));if(!pick.length)return toast('Chưa chọn câu nào');
  qb.push(...pick.map(x=>({...newQ(x.type),content:x.content,options:x.options.length?x.options:['','','',''],answer:x.answer,key:x.key||'DDDD',points:x.points,model:x.model||''})));
  closeM();toast(`Đã thêm ${pick.length} câu vào bài`);render()};

/* =====================================================================
   3. HỌC SINH – tự lưu bài đang làm
   ===================================================================== */
const dkey=()=>'draft:'+(cur&&cur.attempt);
let svT=null;
const svInd=(t,bad)=>{const e=$('#sv');if(e){e.textContent=t;e.className='svi'+(bad?' bad':'')}};
window.touch=()=>{if(!cur)return;try{localStorage.setItem(dkey(),JSON.stringify(cur.ans))}catch{}clearTimeout(svT);svT=setTimeout(autosave,1500);svInd('✎ …')};
async function autosave(){
  const c=cur;if(!c||c.ending)return;
  try{const d=await api(`/attempts/${c.attempt}/save`,'POST',{answers:c.ans});if(cur!==c)return;
    if(d.closed)return teacherClosed();
    if(d.endsAt)c.endsAt=d.endsAt;svInd('💾 Đã lưu '+new Date().toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'}))}
  catch(e){if(cur===c)svInd('⚠ Mất kết nối – bài được lưu tạm trên máy',true)}}
window.startSave=()=>{const c=cur;clearInterval(window._svI);window._svI=setInterval(()=>{if(cur!==c){clearInterval(window._svI);return}autosave()},8000);autosave()};
window.restoreAns=()=>{
  if(!cur)return;let n=0;
  for(const q of cur.questions){const a=cur.ans[q.id];if(a==null||a==='')continue;n++;
    if(q.type=='mc'){const r=document.querySelectorAll(`input[name="q${q.id}"]`)[a];if(r)r.checked=true}
    else if(q.type=='tf'){for(let k=0;k<4;k++){const ch=String(a)[k];if(ch=='D'||ch=='S'){const r=document.querySelectorAll(`input[name="q${q.id}s${k}"]`)[ch=='D'?0:1];if(r)r.checked=true}}}
    else{const t=document.querySelector(`#q${q.id} textarea`);if(t)t.value=a}
    const chip=$('#c'+q.id);if(chip)chip.classList.toggle('on',answered(q))}
  const pb=$('#pb');if(pb)pb.style.width=cur.questions.filter(answered).length/cur.questions.length*100+'%';
  if(n)toast(`Đã khôi phục ${n} câu bạn đã làm`)};
window.teacherClosed=()=>{if(!cur)return;clearInterval(timer);clearInterval(window._svI);cur=null;exitFs();toast('Giáo viên đã thu bài hoặc mở lại bài của bạn');tab='';render()};

/* =====================================================================
   4. GIÁO VIÊN – giám sát trực tiếp (REALTIME: máy chủ tự đẩy dữ liệu, không làm mới trang)
   ===================================================================== */
const mmss=s=>{s=Math.max(0,s);return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0')};
const LIVE={id:null,gen:0,abort:null,timer:null,lastRx:0,stale:false,sig:new Map(),seen:new Set(),prev:new Map(),notes:[],first:true,max:3,snd:localStorage.getItem('liveSnd')!='0',bad:false};
const liveSig=x=>JSON.stringify([x.status,x.online,x.answered,x.total,x.viol,x.locked,x.score,x.pending,x.extra,x.attempt_id,x.submitted_at]);
const liveBad=x=>(x.viol||0)>0||x.locked||(x.status=='doing'&&!x.online);
const clk=t=>new Date(t).toLocaleTimeString('vi-VN');
function liveStats(d){
  const R=d.rows;
  return stat('Đang làm',String(R.filter(x=>x.status=='doing').length))+stat('Đã nộp',String(R.filter(x=>x.status=='done').length))+stat('Chưa vào',String(R.filter(x=>x.status=='none').length))+stat('Có vi phạm',String(R.filter(x=>(x.viol||0)>0).length))+stat('Mất kết nối',String(R.filter(x=>x.status=='doing'&&!x.online).length))}
function liveRow(x,d){
  const st={doing:'<span class="lvs doing">● Đang làm</span>',done:'<span class="lvs done">✔ Đã nộp</span>',none:'<span class="lvs none">○ Chưa vào</span>'};
  const pct=x.status=='doing'&&x.total?Math.round(x.answered/x.total*100):x.status=='done'?100:0;
  const act=x.status=='doing'?`<button class="ghost" onclick="liveAct('extend',${x.attempt_id},5)">+5′</button> <button class="ghost" onclick="liveAct('extend',${x.attempt_id},10)">+10′</button> <button class="ghost" onclick="liveAct('force',${x.attempt_id})">Nộp hộ</button>`:x.status=='done'?`<button class="ghost" onclick="liveAct('reopen',${x.attempt_id})">Cho làm lại</button>`:'';
  const kinds={};d.events.filter(v=>v.attempt_id==x.attempt_id).forEach(v=>kinds[v.kind]=(kinds[v.kind]||0)+1);
  const short={tab:'Chuyển tab',blur:'Rời cửa sổ',fullscreen:'Thoát toàn màn hình',reload:'Tải lại trang'};
  const vsum=Object.entries(kinds).map(([k,n])=>`${short[k]||k} ×${n}`).join(' · ');
  const left=x.status=='doing'?`<b class="lvleft ${x.left<300?'hard':''}" data-end="${d._rx+x.left*1000}">${mmss(x.left)}</b>${x.extra?` <small>(+${x.extra}′)</small>`:''}`:'–';
  const ago=x.last_seen?`<small class="lvago" data-ls="${d._rx-(d.now-x.last_seen)}">${Math.max(0,Math.round((d.now-x.last_seen)/1000))} giây trước</small>`:'<small>–</small>';
  const cls=[x.status=='doing'&&!x.online?'off':'',(x.viol||0)>0?'vio':'',x.locked?'lck':''].filter(Boolean).join(' ');
  return`<tr id="lvr${x.user_id}" class="${cls}" data-bad="${liveBad(x)?1:0}"><td><b>${esc(x.name)}</b>${x.locked?' <span class="tag">🔒 Bị khóa</span> <a class="x" style="opacity:1;color:var(--pr);cursor:pointer" onclick="liveAct(\'unlock\',0,${x.user_id})">Mở khóa</a>':''}</td>
<td>${st[x.status]}${x.status=='doing'?(x.online?' <small>trực tuyến</small>':' <small class="hard">⚠ mất kết nối</small>'):''}</td>
<td style="min-width:120px">${x.status=='none'?'–':`<div class="lvb"><i style="width:${pct}%"></i></div><small>${x.status=='done'?(x.score!=null?'Điểm '+x.score+(x.pending?' (chờ chấm)':''):'Đã nộp'):x.answered+'/'+x.total+' câu'}</small>`}</td>
<td>${left}</td>
<td class="${x.viol?'hard':''}"><b>${x.viol||0}</b>/${d.exam.max}${vsum?`<br><small class="hard">${esc(vsum)}</small>`:''}</td><td>${ago}</td><td>${act}</td></tr>`}
function liveBeep(){if(!LIVE.snd)return;try{const c=LIVE.ac||(LIVE.ac=new(window.AudioContext||window.webkitAudioContext)()),o=c.createOscillator(),g=c.createGain();o.type='square';o.frequency.value=880;g.gain.value=.06;o.connect(g);g.connect(c.destination);o.start();o.stop(c.currentTime+.2)}catch{}}
function liveFlash(uid){const tr=document.getElementById('lvr'+uid);if(!tr)return;tr.classList.add('newv');setTimeout(()=>{const t=document.getElementById('lvr'+uid);if(t)t.classList.remove('newv')},8000)}
function liveNote(name,text,cls){LIVE.notes.unshift({t:Date.now(),name,text,cls});if(LIVE.notes.length>60)LIVE.notes.length=60}
function liveFeed(d){
  const L=[...d.events.map(v=>({t:v.at,cls:'bad',name:v.name,text:`⚠ ${VK[v.kind]||v.kind} — lần ${v.n}/${d.exam.max}`})),...LIVE.notes.map(n=>({t:n.t,cls:n.cls,name:n.name,text:n.text}))].sort((a,b)=>b.t-a.t).slice(0,50);
  return L.length?L.map(x=>`<div class="lvev ${x.cls}"><time>${clk(x.t)}</time><b>${esc(x.name||'')}</b><span>${esc(x.text)}</span></div>`).join(''):'<small>Chưa có vi phạm nào. Hệ thống sẽ báo ngay lập tức khi học sinh chuyển tab, rời cửa sổ, thoát toàn màn hình hoặc mất kết nối.</small>'}
function liveDetect(d){          // so sánh với lần trước để phát hiện sự kiện mới
  for(const x of d.rows){
    const p=LIVE.prev.get(x.user_id),nm=x.name;
    if(p&&!LIVE.first){
      if(p.status=='none'&&x.status=='doing')liveNote(nm,'▶ Vào làm bài','info');
      if(p.status=='doing'&&x.status=='done')liveNote(nm,'✔ Đã nộp bài','ok');
      if(p.status=='doing'&&x.status=='doing'&&p.online&&!x.online){liveNote(nm,'📴 Mất kết nối (quá 30 giây không có tín hiệu)','warn');liveFlash(x.user_id);liveBeep();toast(`📴 ${nm} mất kết nối`)}
      if(p.status=='doing'&&x.status=='doing'&&!p.online&&x.online)liveNote(nm,'📶 Đã kết nối lại','info');
      if(!p.locked&&x.locked){liveNote(nm,'🔒 Tài khoản bị khóa do vi phạm quá số lần','bad');liveFlash(x.user_id)}
    }
    LIVE.prev.set(x.user_id,{status:x.status,online:x.online,locked:x.locked});
  }
  for(const v of d.events){
    if(LIVE.seen.has(v.id))continue;LIVE.seen.add(v.id);
    if(!LIVE.first){liveFlash(v.user_id);liveBeep();toast(`⚠ ${v.name}: ${VK[v.kind]||v.kind} (${v.n}/${d.exam.max})`)}
  }
  LIVE.first=false}
function liveApply(d){
  d._old=!d.events;d.events=d.events||[];d.exam=d.exam||{};d.exam.max=d.exam.max||3;d.rows=d.rows||[];
  d._rx=Date.now();LIVE.lastRx=d._rx;LIVE.max=d.exam.max;
  const tb=$('#lvbody');if(!tb)return;
  liveDetect(d);
  const sEl=$('#lvstats'),sh=liveStats(d);if(sEl&&sEl.dataset.h!=sh){sEl.innerHTML=sh;sEl.dataset.h=sh}
  const ids=d.rows.map(x=>x.user_id).join(',');
  if(tb.dataset.ids!=ids){tb.innerHTML=d.rows.map(x=>liveRow(x,d)).join('');tb.dataset.ids=ids;d.rows.forEach(x=>LIVE.sig.set(x.user_id,liveSig(x)))}
  else d.rows.forEach(x=>{
    const tr=document.getElementById('lvr'+x.user_id);if(!tr)return;const s=liveSig(x);
    if(LIVE.sig.get(x.user_id)!==s){const had=tr.classList.contains('newv');LIVE.sig.set(x.user_id,s);tr.outerHTML=liveRow(x,d);if(had)liveFlash(x.user_id)}   // chỉ thay đúng dòng có thay đổi
    else{const l=tr.querySelector('.lvleft');if(l)l.dataset.end=d._rx+x.left*1000;const g=tr.querySelector('.lvago');if(g&&x.last_seen)g.dataset.ls=d._rx-(d.now-x.last_seen)}});
  const fe=$('#lvfeed'),fh=liveFeed(d);if(fe&&fe.dataset.h!=fh){fe.innerHTML=fh;fe.dataset.h=fh}
  const nb=d.rows.filter(liveBad).length,bb=$('#lvbadn');if(bb)bb.textContent=nb}
function liveConn(s,msg){const el=$('#lvconn');if(!el)return;
  el.innerHTML=s=='ok'?'<span class="lvdot"></span> Trực tiếp':s=='old'?'<span class="hard">⚠ Máy chủ đang chạy bản cũ – hãy thay <b>extra.js</b> và <b>server.js</b> mới rồi khởi động lại máy chủ</span>':s=='err'?`<span class="hard">✖ ${esc(msg||'Không kết nối được')}</span>`:'<span class="hard">⚠ Mất kết nối máy chủ – đang thử lại…</span>'}
function liveStop(){LIVE.gen++;clearInterval(LIVE.timer);LIVE.timer=null;if(LIVE.abort)try{LIVE.abort.abort()}catch{}}
async function liveConnect(id){                      // hỏi máy chủ mỗi ~1.5 giây (HTTP thường) – chạy qua mọi mạng / tunnel
  const my=++LIVE.gen;
  while(tab=='live:'+id&&LIVE.gen==my){
    const ac=new AbortController();LIVE.abort=ac;LIVE.stale=false;
    const to=setTimeout(()=>{LIVE.stale=true;ac.abort()},8000);        // yêu cầu treo quá 8 giây → hủy và hỏi lại
    try{
      const r=await fetch(`/api/exams/${id}/live?_=${Date.now()}`,{headers:{Authorization:'Bearer '+token},signal:ac.signal,cache:'no-store'});
      clearTimeout(to);
      if(r.status==401||r.status==403){liveConn('err','Phiên đăng nhập hết hạn – hãy đăng nhập lại');return}
      const ct=r.headers.get('content-type')||'';
      if(!r.ok||!ct.includes('json')){ if(r.status==404&&ct.includes('json')){liveConn('err','Không tìm thấy bài này');return} throw 0 }
      const d=await r.json();
      if(LIVE.gen!=my)return;
      liveApply(d);liveConn(d._old?'old':'ok');
    }catch(e){clearTimeout(to);if(ac.signal.aborted&&!LIVE.stale)return;if(LIVE.gen==my)liveConn('retry')}
    if(tab!='live:'+id||LIVE.gen!=my)return;
    await new Promise(r=>setTimeout(r,document.hidden?4000:1500))}}
async function livePage(id){
  liveStop();
  if(LIVE.id!==id){LIVE.id=id;LIVE.sig.clear();LIVE.seen.clear();LIVE.prev.clear();LIVE.notes=[]}
  LIVE.first=true;
  const d=await api(`/exams/${id}/live`);
  LIVE.timer=setInterval(()=>{                    // mỗi giây: đồng hồ đếm ngược chạy tại chỗ, không cần tải lại gì cả
    if(tab!='live:'+id){liveStop();return}
    const t=Date.now();
    document.querySelectorAll('#lvbody .lvleft').forEach(el=>{const s=Math.round((+el.dataset.end-t)/1000);el.textContent=mmss(s);el.classList.toggle('hard',s<300)});
    document.querySelectorAll('#lvbody .lvago').forEach(el=>{if(el.dataset.ls)el.textContent=Math.max(0,Math.round((t-el.dataset.ls)/1000))+' giây trước'});
    if(LIVE.lastRx&&t-LIVE.lastRx>20000){LIVE.stale=true;liveConn('retry');try{LIVE.abort.abort()}catch{}LIVE.lastRx=t}   // quá 35 giây không có phản hồi → nối lại
  },1000);
  setTimeout(()=>{if(tab=='live:'+id){try{liveApply(d);liveConn(d._old?'old':'ok')}catch(e){console.error(e);liveConn('err','Lỗi hiển thị: '+e.message)}liveConnect(id)}},0);
  return`<button class="ghost" onclick="go('')">← Quay lại</button> <button class="ghost" onclick="go('r:${id}')">Xem kết quả</button><h3 style="margin-top:12px">📡 Giám sát trực tiếp – ${esc(d.exam.title)}</h3>
<p><small>Lớp ${esc(d.exam.class)} · ${d.exam.minutes} phút · tối đa ${d.exam.max||3} lần vi phạm · tự cập nhật liên tục (không cần làm mới) · <span id="lvconn"><span class="lvdot"></span> Trực tiếp</span></small></p>
<div class="lvtools"><label class="lvchk"><input type="checkbox" ${LIVE.bad?'checked':''} onchange="liveOnlyBad(this.checked)"> Chỉ hiện học sinh cần chú ý (<span id="lvbadn">0</span>)</label> <button class="ghost" id="lvsnd" onclick="liveSound()">${LIVE.snd?'🔔 Âm báo: Bật':'🔕 Âm báo: Tắt'}</button></div>
<div id="lv" class="${LIVE.bad?'onlybad':''}"><div class="stats" id="lvstats"></div>
<section class="card lvfeed"><h3>🚨 Nhật ký vi phạm &amp; sự kiện trực tiếp</h3><div id="lvfeed"></div></section>
<section class="card scroll"><table><thead><tr><th>Học sinh</th><th>Trạng thái</th><th>Tiến độ</th><th>Còn lại</th><th>Vi phạm</th><th>Hoạt động</th><th></th></tr></thead><tbody id="lvbody"></tbody></table></section></div>`}
window.liveOnlyBad=v=>{LIVE.bad=v;const el=$('#lv');if(el)el.classList.toggle('onlybad',v)};
window.liveSound=()=>{LIVE.snd=!LIVE.snd;localStorage.setItem('liveSnd',LIVE.snd?'1':'0');const b=$('#lvsnd');if(b)b.textContent=LIVE.snd?'🔔 Âm báo: Bật':'🔕 Âm báo: Tắt';if(LIVE.snd)liveBeep()};
async function liveRefresh(){try{liveApply(await api(`/exams/${LIVE.id}/live`))}catch{}}   // chỉ dùng ngay sau thao tác để chắc chắn thấy kết quả, kể cả khi đường realtime đang đứt
window.liveAct=run(async(kind,aid,arg)=>{
  if(kind=='extend'){await api(`/attempts/${aid}/extend`,'POST',{minutes:arg});toast(`Đã cộng thêm ${arg} phút`)}
  else if(kind=='force'){if(!await uiConfirm('Thu bài của học sinh này ngay bây giờ? Hệ thống sẽ chấm các câu em đã làm.'))return;await api(`/attempts/${aid}/force-submit`,'POST');toast('Đã thu bài')}
  else if(kind=='reopen'){if(!await uiConfirm('Xóa bài đã nộp để học sinh này được làm lại từ đầu?'))return;await api(`/attempts/${aid}/reopen`,'POST');toast('Đã mở lại bài cho học sinh')}
  else if(kind=='unlock'){await api(`/students/${arg}/unlock`,'POST');toast('Đã mở khóa tài khoản')}
  liveRefresh()});

/* =====================================================================
   5. HỌC SINH – sổ tay lỗi
   ===================================================================== */
let MQ={qs:[],ans:{},res:null};
PAGES.hs=async()=>{
  if(tab=='mis')return misPage();
  if(tab=='mq')return mqPage();
  return _pg.hs()};
async function misPage(){
  const d=await api('/mistakes');
  const groups={};d.items.forEach(x=>(groups[x.title]=groups[x.title]||[]).push(x));
  const body=(x,i)=>x.type=='tf'?x.options.map((o,k)=>{const p=(x.text||'----')[k],g=p==x.key[k];return`<div class="opt ${g?'good':'bad'}">${'abcd'[k]}) ${esc(o)} — bạn chọn: <b>${p=='D'?'Đúng':p=='S'?'Sai':'bỏ trống'}</b> · đáp án: <b>${x.key[k]=='D'?'Đúng':'Sai'}</b></div>`}).join('')
    :x.options.map((o,k)=>`<div class="opt ${k==x.answer?'good':x.picked==k?'bad':''}">${'ABCD'[k]}. ${esc(o)}${x.picked==k?' <b>← bạn chọn</b>':''}${k==x.answer?' ✓':''}</div>`).join('')+(x.picked==null?'<small>Bạn chưa chọn đáp án.</small>':'');
  return`<div class="stats">${stat('Câu cần ôn',d.count)}</div>
<section class="card"><h3>📓 Sổ tay lỗi</h3><p><small>Những câu bạn từng làm sai hoặc bỏ trống ở bài ôn tập (và bài kiểm tra mà giáo viên cho xem đáp án). Làm đúng một câu khi luyện lại thì câu đó được gạch khỏi sổ.</small></p>
${d.count?`<div class="row"><button onclick="mqStart(10)">🎯 Luyện 10 câu ngẫu nhiên</button><button class="ghost" onclick="mqStart(30)">Luyện 30 câu</button><button class="ghost" onclick="mqStart(50)">Luyện tối đa 50 câu</button></div>`:'<p>🎉 Sổ tay đang trống – bạn không có câu sai nào cần ôn!</p>'}</section>`+
  Object.entries(groups).map(([t,L])=>`<h3>${esc(t)} <small>(${L.length} câu)</small></h3>`+L.map((x,i)=>`<section class="card rvq bad"><p><span class="tag">${TYPE[x.type]}</span> ${esc(x.content)}</p>${body(x,i)}${x.model?`<small>Gợi ý: ${esc(x.model)}</small>`:''}</section>`).join('')).join('')}
window.mqStart=run(async n=>{const d=await api('/mistakes/start','POST',{n});MQ={qs:d.questions,ans:{},res:null};tab='mq';render()});
async function mqPage(){
  if(!MQ.qs.length)return`<button class="ghost" onclick="go('mis')">← Sổ tay lỗi</button><section class="card"><p>Không có câu nào để luyện.</p></section>`;
  const R=MQ.res;
  if(R){const by=Object.fromEntries(R.results.map(x=>[x.id,x]));
    return`<button class="ghost" onclick="go('mis')">← Về sổ tay lỗi</button>`+scoreCard('Kết quả luyện câu sai',R.total?Math.round(R.cleared/R.total*100)/10:0,R.cleared,R.total,`<p><b>${R.cleared}</b> câu đã được gạch khỏi sổ tay${R.total-R.cleared?`, còn <b>${R.total-R.cleared}</b> câu cần ôn thêm`:' 🎉'}</p>`)+
      MQ.qs.map((q,i)=>{const r=by[q.id]||{},a=MQ.ans[q.id];return`<section class="card rvq ${r.ok?'ok':'bad'}"><p><b>Câu ${i+1}.</b> <span class="rvb ${r.ok?'ok':'bad'}">${r.ok?'✅ Đúng':'❌ Sai'}</span> ${esc(q.content)}</p>${q.type=='tf'?q.options.map((o,k)=>`<div class="opt ${(a||'----')[k]==r.key[k]?'good':'bad'}">${'abcd'[k]}) ${esc(o)} — bạn chọn: <b>${(a||'-')[k]=='D'?'Đúng':(a||'-')[k]=='S'?'Sai':'bỏ trống'}</b> · đáp án: <b>${r.key[k]=='D'?'Đúng':'Sai'}</b></div>`).join(''):q.options.map((o,k)=>`<div class="opt ${k==r.answer?'good':a===k?'bad':''}">${'ABCD'[k]}. ${esc(o)}${a===k?' <b>← bạn chọn</b>':''}${k==r.answer?' ✓':''}</div>`).join('')}</section>`}).join('')}
  return`<button class="ghost" onclick="go('mis')">← Sổ tay lỗi</button><h3 style="margin-top:12px">Luyện câu sai (${MQ.qs.length} câu)</h3>`+MQ.qs.map((q,i)=>`<section class="card"><p><b>Câu ${i+1}.</b> <span class="tag">${TYPE[q.type]}</span> <small>${esc(q.title)}</small><br>${esc(q.content)}</p>${q.type=='tf'?q.options.map((o,k)=>`<div class="tfrow"><span><b>${'abcd'[k]})</b> ${esc(o)}</span><span class="tfb"><label class="opt"><input type="radio" name="m${q.id}s${k}" onchange="mqTf(${q.id},${k},'D')"> Đúng</label><label class="opt"><input type="radio" name="m${q.id}s${k}" onchange="mqTf(${q.id},${k},'S')"> Sai</label></span></div>`).join(''):q.options.map((o,k)=>`<label class="opt"><input type="radio" name="m${q.id}" onchange="MQ.ans[${q.id}]=${k}"> ${'ABCD'[k]}. ${esc(o)}</label>`).join('')}</section>`).join('')+`<button onclick="mqCheck()">✅ Nộp và xem kết quả</button>`}
window.mqTf=(id,k,v)=>{const s=MQ.ans[id]||'----';MQ.ans[id]=s.slice(0,k)+v+s.slice(k+1)};
window.mqCheck=run(async()=>{const d=await api('/mistakes/check','POST',{answers:MQ.ans});MQ.res=d;render()});

/* =====================================================================
   6. GIÁO VIÊN – chia sẻ bài cho học sinh (link + mã vào bài + tin nhắn soạn sẵn)
   ===================================================================== */
const shCopyText=async t=>{try{await navigator.clipboard.writeText(t);return true}catch{}
  try{const a=document.createElement('textarea');a.value=t;a.style.cssText='position:fixed;opacity:0';document.body.append(a);a.select();const ok=document.execCommand('copy');a.remove();return ok}catch{return false}};
window.share=run(async(id,title)=>{
  const d=await api('/exams/'+id),e=d.exam,link=`${location.origin}/?e=${id}`,code=e.code||'';
  const msg=`📚 ${title||e.title}\n${e.mode=='exam'?'Bài kiểm tra':'Bài ôn tập'} · ${e.minutes} phút${e.start_at?'\nMở lúc: '+e.start_at.replace('T',' '):''}${e.deadline?'\nHạn nộp: '+e.deadline.replace('T',' '):''}\n👉 Vào làm bài: ${link}${code?'\n🔑 Mã vào bài: '+code:''}\n(Đăng nhập tài khoản của em rồi làm bài.)`;
  window._shMsg=msg;window._shLink=link;
  openModal(`<h3>🔗 Chia sẻ bài cho học sinh</h3><p><b>${esc(title||e.title)}</b></p>
<label><small>Đường dẫn bài</small></label><div class="row" style="margin:4px 0 10px"><input id="shl" readonly value="${esc(link)}" style="flex:1;min-width:0" onfocus="this.select()"><button onclick="shCopy('l')">📋 Sao chép</button></div>
${code?`<p>🔑 Mã vào bài: <b style="font-size:20px;letter-spacing:2px">${esc(code)}</b></p>`:'<p><small>Bài này không đặt mã vào bài – học sinh đúng lớp bấm link là làm được.</small></p>'}
<label><small>Tin nhắn soạn sẵn (dán vào Zalo, nhóm lớp…)</small></label><textarea id="shm" readonly rows="6" style="width:100%;margin:4px 0 10px" onfocus="this.select()">${esc(msg)}</textarea>
<div class="row" style="flex-wrap:wrap;gap:8px"><button onclick="shCopy('m')">📋 Sao chép tin nhắn</button>${navigator.share?'<button class="ghost" onclick="shNative()">📤 Gửi qua ứng dụng…</button>':''}<a class="lvbtn" target="_blank" rel="noopener" href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}">Facebook</a><a class="lvbtn" href="mailto:?subject=${encodeURIComponent(title||e.title)}&body=${encodeURIComponent(msg)}">✉️ Email</a><button class="ghost" onclick="closeM()">Đóng</button></div>
<p><small>Lưu ý: chỉ học sinh của lớp được giao bài mới thấy bài này. Nếu máy chủ chạy trong mạng nội bộ, học sinh phải truy cập cùng mạng đó.</small></p>`);
  $('#modal').onclick=ev=>{if(ev.target.id=='modal')closeM()}});
window.shCopy=async k=>{toast(await shCopyText(k=='l'?window._shLink:window._shMsg)?'Đã sao chép':'Không sao chép được, hãy bôi đen và copy thủ công')};
window.shNative=()=>navigator.share({title:'EduGDTX',text:window._shMsg,url:window._shLink}).catch(()=>{});

/* =====================================================================
   7. HỌC SINH – mở link giáo viên chia sẻ: hiện thẳng màn hình "Vào thi" của bài đó, nhập mã rồi vào
   ===================================================================== */
window.openGate=async id=>{
  let e;try{e=(await api('/my-exams')).find(x=>x.id==id)}catch{return}
  const m=$('#modal');m.className='';m._fn=null;m.onclick=null;
  const box=h=>{m.innerHTML=`<div class="mbox">${h}</div>`;m.hidden=false};
  if(!e)return box(`<h3>🚫 Không tìm thấy bài</h3><p>Bài này không có trong danh sách của bạn. Hãy kiểm tra bạn đã đăng nhập đúng tài khoản của lớp được giao chưa.</p><button onclick="closeModal()">Đã hiểu</button>`);
  const exam=e.mode=='exam',late=e.deadline&&new Date(e.deadline)<new Date(),notOpen=e.start_at&&new Date(e.start_at)>new Date();
  const info=`<h3>${exam?'📝':'📚'} ${esc(e.title)}</h3><p><span class="tag">${exam?'Kiểm tra':'Ôn tập'}</span> <small>${e.qcount} câu · ${e.minutes} phút${e.deadline?' · Hạn '+e.deadline.replace('T',' '):''}</small></p>`;
  if(exam&&e.tries>0)return box(info+`<p>Bạn đã nộp bài này rồi${e.score!=null?` – điểm <b>${e.score}</b>`:''}.</p><button onclick="closeModal()">Đóng</button>`);
  if(exam&&late)return box(info+`<p>Bài này đã quá hạn nộp.</p><button onclick="closeModal()">Đóng</button>`);
  if(exam&&notOpen)return box(info+`<p>Bài chưa đến giờ mở. Bài mở lúc <b>${fmt(e.start_at)}</b>, hãy quay lại sau.</p><button onclick="closeModal()">Đóng</button>`);
  const code=e.has_code?`<label><b>🔑 Mã vào bài</b></label><input id="gcode" placeholder="Nhập mã giáo viên đã gửi" autocomplete="off" autocapitalize="off" style="width:100%;margin:4px 0 10px" onkeydown="if(event.key=='Enter')gateGo(${id},'${e.mode}',${e.has_code?1:0})">`:'';
  const agree=exam?`<ul style="padding-left:18px;font-size:14px;line-height:1.6;margin:0 0 10px"><li>Tự làm bài, không trao đổi hay dùng tài liệu trái phép.</li><li>Bài chạy <b>toàn màn hình</b>; chuyển tab / rời cửa sổ sẽ bị ghi vi phạm, đủ số lần bài bị nộp và <b>tài khoản bị khóa</b>.</li><li>Chỉ được làm <b>một lần</b>; hết giờ tự động nộp.</li></ul>${fsTip()}<label class="chk"><input type="checkbox" id="gagr" onchange="$('#gok').disabled=!this.checked"> Tôi đã đọc và đồng ý</label>`:'';
  box(info+code+agree+`<div class="row" style="margin-top:10px"><button id="gok" ${exam?'disabled':''} onclick="gateGo(${id},'${e.mode}',${e.has_code?1:0})">${exam?'Vào thi':'Bắt đầu ôn'}</button><button class="ghost" onclick="closeModal()">Để sau</button></div>`);
  setTimeout(()=>$('#gcode')?.focus(),60)};
window.gateGo=(id,mode,hasCode)=>{
  if(mode=='exam'&&!$('#gagr')?.checked)return toast('Hãy tick đồng ý thỏa thuận làm bài');
  const c=hasCode?$('#gcode').value.trim():'';if(hasCode&&!c)return toast('Hãy nhập mã vào bài');
  if(mode=='exam')reqFs();closeModal();doStart(id,c,mode)};
