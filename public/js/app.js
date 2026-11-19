const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const ROLE={admin:'Admin',gv:'Giáo viên',hs:'Học sinh'};
const NAV={
  admin:[['','👥','Quản lý'],['pw','🔑','Đổi mật khẩu']],
  gv:[['','📋','Bài đã giao'],['new','➕','Giao bài mới'],['ann','📢','Thông báo'],['pw','🔑','Đổi mật khẩu']],
  hs:[['','📝','Bài của tôi'],['res','📊','Lịch sử'],['rank','🏆','Xếp hạng'],['ann','📢','Thông báo'],['pw','🔑','Đổi mật khẩu']]};
let want=+new URLSearchParams(location.search).get('e')||null,token=localStorage.getItem('token'),me=null,tab='',cur=null,done=null,timer=null,hid=false,adminMode=false,_rows=[],_exam={};
let dark=localStorage.getItem('theme')?localStorage.getItem('theme')=='dark':matchMedia('(prefers-color-scheme:dark)').matches;
const applyTheme=()=>{document.documentElement.dataset.theme=dark?'dark':'light'};applyTheme();
const tbtn=()=>`<button class="ghost" onclick="theme()" title="Chế độ sáng / tối">${dark?'☀️ Sáng':'🌙 Tối'}</button>`;

async function api(p,m='GET',b){
  const r=await fetch('/api'+p,{method:m,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:b?JSON.stringify(b):undefined});
  const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Lỗi '+r.status);return d}
function toast(t){const d=document.createElement('div');d.className='t';d.textContent=t;$('#toast').append(d);setTimeout(()=>d.remove(),3200)}
const run=f=>async(...a)=>{try{await f(...a)}catch(e){
  if(/bị khóa|đình chỉ/i.test(e.message)){clearInterval(timer);cur=null;done=null;if(me){token=null;me=null;localStorage.removeItem('token');exitFs();render()}showModal(`<h3>🔒 Tài khoản bị khóa</h3><p>${esc(e.message)}</p>`,'Đã hiểu')}
  else toast(e.message)}};
const fmt=t=>t?new Date(t).toLocaleString('vi-VN'):'';
const clsOpts=cs=>cs.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('');
const SI={'Giáo viên':'👩‍🏫','Học sinh':'🎓','Lớp học':'🏫','Bài đã giao':'📋','Lượt nộp bài':'📥','Đang bị khóa':'🔒','Đã nộp':'✅','Điểm TB':'⭐','Cao nhất':'🏆','Chờ chấm':'⏳','Cần làm':'📝','Đã làm':'✔️'};
const stat=(l,v)=>`<div class="card stat"><i>${SI[l]||'📊'}</i><div><small>${l}</small><b ${typeof v=='number'?`data-count="${v}"`:''}>${typeof v=='number'?0:v==null?'–':v}</b></div></div>`;
const annHTML=(a,del)=>`<section class="card ann"><div class="item"><div><span class="tag">${esc(a.class||a.teacher)}</span> <small>${fmt(a.created_at)}</small></div>${del?`<button class="ghost" onclick="delAnn(${a.id})">Xóa</button>`:''}</div><p>${esc(a.content)}</p></section>`;
const scoreCard=(t,s,c,n,extra='')=>`<section class="card" style="text-align:center"><p>${esc(t)}</p><div class="ring" style="--p:${s*10}"><b data-count="${s}">0</b></div><p>Đúng ${c}/${n} câu</p>${extra}</section>`;
/* ===== KẾT QUẢ SAU KHI NỘP: 3 MỤC ĐÚNG / SAI / CHƯA LÀM ===== */
let rvTab=null,RVI=[],RVR=true;
const RVT=[['ok','✅','Đúng'],['bad','❌','Sai'],['none','⬜','Chưa làm']];
const rvGroups=()=>{const g={ok:[],bad:[],none:[],wait:[]};RVI.forEach((x,i)=>g[x.status||'none'].push([x,i]));return g};
const tfWord=c=>c=='D'?'Đúng':c=='S'?'Sai':'bỏ trống';
const rvCard=(x,i)=>{
  const st=x.status||'none',pts=x.got!=null?`<small class="pts">Điểm: ${+(+x.got).toFixed(2)}/${x.points}</small>`:'';let body;
  if(x.type=='essay')body=`<div class="ans">${esc(x.text||'(Bỏ trống)')}</div>${x.model?`<small>Gợi ý đáp án: ${esc(x.model)}</small>`:''}${st=='wait'?`<br><small>${x.self?'Tự đối chiếu bài làm với gợi ý ở trên.':'⏳ Chờ giáo viên chấm điểm.'}</small>`:''}`;
  else if(x.type=='tf'){const t=x.text||'----';
    body=x.options.map((o,k)=>{const p=t[k],hk=x.key!=null,good=hk&&p==x.key[k];
      return`<div class="opt ${hk?(good?'good':'bad'):''}">${'abcd'[k]}) ${esc(o)} — bạn chọn: <b>${tfWord(p)}</b>${hk?` · đáp án: <b>${tfWord(x.key[k])}</b> ${good?'✓':'✗'}`:''}</div>`}).join('')+`<small>Đúng ${x.nOk}/4 ý</small>`}
  else body=x.options.map((o,k)=>{const hk=x.answer!=null,pick=x.picked==k,cls=hk?(k==x.answer?'good':pick?'bad':''):(pick?(st=='ok'?'good':'bad'):'');
      return`<div class="opt ${cls}">${'ABCD'[k]}. ${esc(o)}${pick?' <b>← bạn chọn</b>':''}${hk&&k==x.answer?' ✓':''}</div>`}).join('')+(st=='none'?'<small>Bạn chưa chọn đáp án.</small>':'');
  const lb={ok:'✅ Đúng',bad:'❌ Sai',none:'⬜ Chưa làm',wait:x.self?'✍ Tự luận':'⏳ Chờ chấm'}[st];
  return`<section class="card rvq ${st}" id="rq${i}"><p><b>Câu ${i+1}.</b> <span class="tag">${TYPE[x.type||'mc']}</span> <span class="rvb ${st}">${lb}</span> ${esc(x.content)}</p>${body}${pts}${x.id?`<button class="ghost fbbtn" onclick="fbForm(${x.id})">💬 Góp ý câu này</button>`:''}</section>`};
const rvInner=()=>{const g=rvGroups(),tabs=RVT.concat(g.wait.length?[['wait','✍','Tự luận']]:[]);
  return`<div class="rvsum">${tabs.map(([k,i,t])=>`<button class="rvtab ${k} ${rvTab==k?'on':''}" onclick="setRv('${k}')"><span>${i}</span><b>${g[k].length}</b><small>${t}</small></button>`).join('')}</div>
<div class="rvgrid">${RVI.map((x,i)=>`<a class="${x.status||'none'}" onclick="jumpQ(${i})" title="Câu ${i+1}">${i+1}</a>`).join('')}</div>
${RVR?'':'<p class="rvnote"><small>🔒 Giáo viên không công bố đáp án đúng của bài này – bạn chỉ xem được câu nào đúng, sai, chưa làm.</small></p>'}
${g[rvTab].length?g[rvTab].map(([x,i])=>rvCard(x,i)).join(''):'<section class="card" style="text-align:center"><small>Không có câu nào ở mục này.</small></section>'}`};
function reviewHTML(items,reveal){RVI=items;RVR=reveal!==false;const g=rvGroups();
  if(!rvTab)rvTab=g.bad.length?'bad':g.none.length?'none':g.ok.length?'ok':'wait';
  return`<div id="rv">${rvInner()}</div>`}
window.setRv=k=>{rvTab=k;$('#rv').innerHTML=rvInner()};
window.jumpQ=i=>{rvTab=RVI[i].status||'none';$('#rv').innerHTML=rvInner();const el=document.getElementById('rq'+i);if(el)el.scrollIntoView({behavior:'smooth',block:'center'})};
const pwHTML=()=>`<section class="card pwbox" style="max-width:420px"><h3>Đổi mật khẩu</h3><input id="po" type="password" placeholder="Mật khẩu hiện tại"><input id="pn" type="password" placeholder="Mật khẩu mới (từ 6 ký tự)"><input id="pn2" type="password" placeholder="Nhập lại mật khẩu mới"><button onclick="changePw()">Cập nhật</button></section>`;

const loginHTML=()=>{const A=adminMode;return`<div class="auth ${A?'adm':''}"><div class="corner">${tbtn()}<button class="ghost" onclick="toggleAdmin()">${A?'← Học sinh / Giáo viên':'🔐 Quản trị viên'}</button></div>
<div class="hero"><div class="bg"><i class="orb o1"></i><i class="orb o2"></i><i class="orb o3"></i><div class="grid"></div></div>
<div class="floaters"><span style="--x:84%;--y:8%;--s:34px;--d:-1.5s">✏️</span><span style="--x:80%;--y:26%;--s:44px;--d:-3s">🎓</span><span style="--x:90%;--y:48%;--s:30px;--d:-4.5s">🧪</span><span style="--x:82%;--y:66%;--s:38px;--d:0s">📚</span><span style="--x:68%;--y:86%;--s:30px;--d:-5s">💡</span><span style="--x:4%;--y:88%;--s:30px;--d:-2s">📐</span></div>
<div class="hcontent"><span class="badge"><i></i>${A?'Khu vực dành cho quản trị viên':'Nền tảng học &amp; thi trực tuyến GDTX'}</span>
<h1>${A?'Quản lý lớp học<br>gọn gàng, an toàn':'Giao bài &amp; kiểm tra<span class="rot"><span><b>trực tuyến</b><b>chấm tự động</b><b>chống gian lận</b><b>trực tuyến</b></span></span>'}</h1>
<p class="lead">${A?'Quản lý lớp học, tài khoản giáo viên và học sinh tại một nơi.':'Tạo đề nhanh từ Word / PDF, giao bài cho lớp, chấm điểm tự động và theo dõi tiến độ học sinh theo thời gian thực.'}</p>
<div class="feats"><div><em>⚡</em><span><b>Tạo đề trong vài giây</b><small>Nhập từ Word, PDF hoặc dán văn bản</small></span></div><div><em>🛡️</em><span><b>Thi nghiêm túc, công bằng</b><small>Toàn màn hình, ghi nhận mọi lần rời bài</small></span></div><div><em>📊</em><span><b>Kết quả tức thì</b><small>Điểm, phổ điểm và bảng xếp hạng lớp</small></span></div></div>
<div class="mock"><div class="score">9.5<small>điểm</small></div><div class="mh">Kiểm tra Tin Học</div><div class="pb"><i></i></div><div class="qs"><i>1</i><i>2</i><i>3</i><i>4</i><i>5</i></div></div></div>
<svg class="wave" viewBox="0 0 1440 80" preserveAspectRatio="none"><path fill="#fff" d="M0 40c120 30 240 30 360 0s240-30 360 0 240 30 360 0 240-30 360 0v40H0z"/></svg>
<svg class="wave w2" viewBox="0 0 1440 80" preserveAspectRatio="none"><path fill="#fff" d="M0 50c120-30 240-30 360 0s240 30 360 0 240-30 360 0 240 30 360 0v30H0z"/></svg></div>
<div class="box"><div class="card"><div class="lgo"><img src="img/logo.svg" alt=""><b>Edu<em>GDTX</em></b></div>
<h3>${A?'Đăng nhập quản trị':'Chào mừng trở lại 👋'}</h3><p class="sub">${A?'Nhập tài khoản quản trị viên để tiếp tục.':'Đăng nhập để vào lớp học của bạn.'}</p>
<div class="fld"><span>👤</span><input id="lu" placeholder="Tên đăng nhập" autocomplete="username" autocapitalize="off"></div>
<div class="fld"><span>🔒</span><input id="lp" type="password" placeholder="Mật khẩu" autocomplete="current-password" onkeydown="if(event.key=='Enter')login()"><button type="button" class="eye" onclick="togglePw(this)" title="Hiện / ẩn mật khẩu">👁️</button></div>
<button class="btn-login" onclick="login()">Đăng nhập</button>
<p class="hint">Quên mật khẩu? Hãy liên hệ giáo viên hoặc quản trị viên để được đặt lại.</p></div></div></div>`};
window.togglePw=b=>{const i=$('#lp');i.type=i.type=='password'?'text':'password';b.textContent=i.type=='password'?'👁️':'🙈'};

const hello=()=>{const h=new Date().getHours(),g=h<11?'Chào buổi sáng':h<14?'Chào buổi trưa':h<18?'Chào buổi chiều':'Chào buổi tối',sub={admin:'Quản lý lớp học, giáo viên và học sinh trong hệ thống.',gv:'Giao bài, chấm điểm và theo dõi tiến độ của lớp bạn.',hs:'Hôm nay bạn muốn học gì? Cùng làm bài nào!'}[me.role];
  return`<section class="welcome"><div><small>${new Date().toLocaleDateString('vi-VN',{weekday:'long',day:'numeric',month:'numeric'})}</small><h2>${g}, ${esc(me.name)} 👋</h2><p>${sub}</p></div><div class="wdeco"><i></i><i></i><i></i></div></section>`};
async function render(){
  const app=$('#app');if(!me){app.innerHTML=loginHTML();return}
  let body;try{body=cur?examHTML():await page()}catch(e){body=`<p>${esc(e.message)}</p>`}
  const focus=!!(cur||done),lg=`<span class="logo"><img src="img/logo.svg" alt=""><span>Edu<em>GDTX</em></span></span>`;
  const nav=focus?'':'<aside class="side">'+lg.replace('class="logo"','class="logo"')+'<nav>'+NAV[me.role].map(([k,i,t])=>`<a class="${tab==k||(k==''&&/^(r:|g:|edit|live:)/.test(tab))||(k=='mis'&&tab=='mq')||(k=='res'&&tab.startsWith('rv:'))?'on':''}" onclick="go('${k}')"><span>${i}</span><em>${t}</em></a>`).join('')+'</nav><button class="ghost lo" onclick="logout()">⎋ Đăng xuất</button></aside>';
  const TT={'r:':'Kết quả bài','g:':'Chấm bài','edit':'Sửa bài','rv:':'Xem lại bài','li':'Giám sát bài thi','mq':'Luyện câu sai'},nv=NAV[me.role].find(n=>n[0]==tab),title=focus?'':(nv?nv[2]:TT[tab.slice(0,2)]||TT[tab]||'');
  app.innerHTML=`<div class="app ${focus?'focus':''}" data-role="${me.role}">${nav}<div class="content"><header class="top">${lg.replace('class="logo"','class="logo mlogo"')}<h2 class="ttl">${esc(title)}</h2><span class="tr">${tbtn()}<span class="av">${esc((me.name.trim().split(/\s+/).pop()[0]||'?').toUpperCase())}</span><span class="un"><b>${esc(me.name)}</b><small>${ROLE[me.role]}</small></span><button class="ghost mlo" onclick="logout()">Đăng xuất</button></span></header><main>${!focus&&tab==''?hello():''}${body}</main></div></div>`;
  if(want&&me.role=='hs'){const w=want;want=null;setTimeout(()=>{const el=$('#ex'+w);if(el)el.scrollIntoView({block:'center'});openGate(w)},80)}
  document.querySelectorAll('main .card').forEach((c,i)=>c.style.animationDelay=Math.min(i,12)*60+'ms');
  document.querySelectorAll('[data-count]').forEach(el=>{const to=+el.dataset.count,t0=performance.now();(function f(t){const k=Math.min(1,(t-t0)/900);el.textContent=(to*k).toFixed(1).replace('.0','');if(k<1)requestAnimationFrame(f)})(t0)});
}
const PAGES={};
async function page(){if(done)return resultHTML();if(tab=='pw')return pwHTML();return PAGES[me.role]()}

/* ADMIN */
PAGES.admin=async()=>{
  const[us,cs,st]=await Promise.all([api('/users'),api('/classes'),api('/stats')]);const n=r=>us.filter(u=>u.role==r).length;
  return`<div class="stats">${stat('Giáo viên',n('gv'))}${stat('Học sinh',n('hs'))}${stat('Lớp học',cs.length)}${stat('Bài đã giao',st.exams)}${stat('Lượt nộp bài',st.attempts)}${stat('Đang bị khóa',us.filter(u=>u.locked).length)}</div>
<section class="card"><h3>Tạo tài khoản</h3><div class="row"><input id="nn" placeholder="Họ tên"><input id="nu" placeholder="Tên đăng nhập"><input id="np" placeholder="Mật khẩu"><select id="nr" onchange="$('#ntt').hidden=this.value!='hs'"><option value="hs">Học sinh</option><option value="gv">Giáo viên</option></select><select id="nc">${clsOpts(cs)}</select><select id="ntt"><option value="">Không có chức vụ</option></select><button onclick="addUser()">Thêm</button></div></section>
<section class="card"><h3>Lớp học</h3><div class="row"><input id="ncl" placeholder="Tên lớp mới"><button onclick="addClass()">Thêm lớp</button></div>${cs.map(c=>`<span class="tag">${esc(c.name)} <a class="x" title="Xóa lớp" onclick="delClass(${c.id},'${esc(c.name)}')">✕</a></span>`).join('')}</section>
<section class="card scroll"><h3>Tài khoản</h3><div class="row"><input id="fs" placeholder="🔍 Tìm theo tên, tên đăng nhập, lớp" oninput="filterUsers()" style="flex:1;min-width:200px"><select id="fr" onchange="filterUsers()"><option value="">Tất cả vai trò</option><option value="gv">Giáo viên</option><option value="hs">Học sinh</option><option value="admin">Admin</option><option value="locked">🔒 Đang bị khóa</option></select></div>
<table><tr><th>Họ tên</th><th>Đăng nhập</th><th>Vai trò</th><th>Lớp</th><th></th></tr>${us.map(u=>`<tr data-s="${esc((u.name+' '+u.username+' '+(u.class||'')).toLowerCase())}" data-r="${u.role}" data-l="${u.locked?1:0}"><td>${esc(u.name)}${u.title?` <span class="tag">${esc(u.title)}</span>`:''}${u.locked?` <span class="tag" title="${esc(u.lock_reason||'')}">🔒 Bị khóa</span>`:''}</td><td>${esc(u.username)}</td><td>${ROLE[u.role]}</td><td>${esc(u.class||'')}</td><td>${u.role!='admin'?`${u.locked?`<button onclick="setLock(${u.id},0)">Mở khóa</button>`:`<button class="ghost" onclick="setLock(${u.id},1)">Khóa</button>`}${u.role=='hs'?` <button class="ghost" onclick="setTitle(${u.id},'${esc(u.title||'').replace(/'/g,"\\'")}')">✎ Chức vụ</button>`:''} <button class="ghost" onclick="resetPw(${u.id})">Đặt lại MK</button> <button class="ghost" onclick="delUser(${u.id})">Xóa</button>`:''}</td></tr>`).join('')}</table></section>`};

/* GIÁO VIÊN */
const TYPE={mc:'Trắc nghiệm',tf:'Đúng / Sai',essay:'Tự luận'};
const EX0=()=>({title:'',class_id:'',class_ids:[],minutes:45,start_at:'',deadline:'',mode:'exam',code:'',max_viol:3,shuffle:true,show_score:true,show_answer:true});
let ex=EX0(),qb=[],editId=null,locked=false,CLS=[];
const newQ=t=>({type:t,content:'',options:['','','',''],answer:-1,key:t=='tf'?'----':'DDDD',points:t=='essay'?2:1,model:''});
const qHTML=(q,i)=>`<section class="card qb"><div class="item"><b>Câu ${i+1} <span class="tag">${TYPE[q.type]}</span></b><span><label class="pt">Điểm <input type="number" step="0.25" min="0" value="${q.points}" oninput="qb[${i}].points=this.value" style="width:72px"></label> <a class="x" onclick="saveBank(${i})" title="Lưu câu này vào ngân hàng">💾</a> <a class="x" onclick="mv(${i},-1)" title="Lên">↑</a> <a class="x" onclick="mv(${i},1)" title="Xuống">↓</a> <a class="x" onclick="rmq(${i})" title="Xóa câu">🗑</a></span></div>
<textarea rows="2" placeholder="Nội dung câu hỏi" oninput="qb[${i}].content=this.value">${esc(q.content)}</textarea>`+
(q.type=='mc'?q.options.map((o,k)=>`<div class="orow"><input type="radio" name="a${i}" ${q.answer==k?'checked':''} onchange="qb[${i}].answer=${k};okAns(this)"><b>${'ABCD'[k]}.</b><input value="${esc(o)}" placeholder="Đáp án ${'ABCD'[k]}" oninput="qb[${i}].options[${k}]=this.value"></div>`).join('')+'<small>Chọn nút tròn ở đáp án đúng</small>'
:q.type=='tf'?q.options.map((o,k)=>`<div class="orow"><b>${'abcd'[k]})</b><input value="${esc(o)}" placeholder="Phát biểu ${'abcd'[k]}" oninput="qb[${i}].options[${k}]=this.value"><select onchange="setKey(${i},${k},this.value);okAns(this,${i})">${q.key[k]=='-'?'<option value="-" selected>— Chọn —</option>':''}<option value="D" ${q.key[k]=='D'?'selected':''}>Đúng</option><option value="S" ${q.key[k]=='S'?'selected':''}>Sai</option></select></div>`).join('')+'<small>Chấm: đúng 1 ý = 10%, 2 ý = 25%, 3 ý = 50%, đủ 4 ý = 100% số điểm</small>'
:`<textarea rows="2" placeholder="Gợi ý đáp án để chấm (tùy chọn, học sinh không thấy khi làm bài)" oninput="qb[${i}].model=this.value">${esc(q.model||'')}</textarea><small>Bài tự luận do giáo viên chấm tay sau khi học sinh nộp</small>`)+
(q.warn&&q.warn.length?'<br>'+q.warn.map(w=>`<small class="hard" ${/chọn/.test(w)?'data-a':''}>⚠ ${esc(w)}</small>`).join(' · '):'')+`</section>`;
function builderHTML(){
  const tot=qb.reduce((a,q)=>a+(+q.points||0),0),sel=(v,o)=>v==o?'selected':'';
  return`<h3>${editId?'Sửa bài':'Soạn bài mới'}</h3><section class="card"><h3>Cài đặt bài</h3><div class="row">
<label>Tên bài<input value="${esc(ex.title)}" oninput="ex.title=this.value"></label>
${editId?`<label>Lớp<select onchange="ex.class_id=this.value">${CLS.map(c=>`<option value="${c.id}" ${c.id==ex.class_id?'selected':''}>${esc(c.name)}</option>`).join('')}</select></label>`:`<div class="lbl">Giao cho lớp (chọn được nhiều lớp)<span class="clschips">${CLS.map(c=>`<label class="chk cc"><input type="checkbox" ${(ex.class_ids||[]).includes(c.id)?'checked':''} onchange="togCls(${c.id},this.checked)"> ${esc(c.name)}</label>`).join('')}</span></div>`}
<label>Thời gian (phút)<input type="number" min="1" style="width:100px" value="${ex.minutes}" oninput="ex.minutes=this.value"></label>
<label>Mở lúc<input type="datetime-local" value="${esc(ex.start_at||'')}" oninput="ex.start_at=this.value"></label>
<label>Hạn nộp<input type="datetime-local" value="${esc(ex.deadline||'')}" oninput="ex.deadline=this.value"></label>
<label>Loại<select onchange="ex.mode=this.value"><option value="exam" ${sel(ex.mode,'exam')}>Kiểm tra (làm 1 lần)</option><option value="practice" ${sel(ex.mode,'practice')}>Ôn tập (làm nhiều lần)</option></select></label>
<label>Mã vào bài (tùy chọn)<input style="width:130px" value="${esc(ex.code||'')}" oninput="ex.code=this.value"></label>
<label>Rời tab tối đa (lần)<input type="number" min="1" max="20" style="width:110px" value="${ex.max_viol}" oninput="ex.max_viol=this.value"></label></div>
<label class="chk"><input type="checkbox" ${ex.shuffle?'checked':''} onchange="ex.shuffle=this.checked"> Xáo trộn thứ tự câu hỏi</label><label class="chk"><input type="checkbox" ${ex.show_score?'checked':''} onchange="ex.show_score=this.checked"> Cho học sinh xem điểm ngay sau khi nộp (bài kiểm tra)</label><label class="chk"><input type="checkbox" ${ex.show_answer?'checked':''} onchange="ex.show_answer=this.checked"> Cho xem đáp án đúng sau khi nộp</label></section>`+
(locked?'<section class="card"><small>Đã có học sinh nộp bài nên chỉ sửa được phần cài đặt, không đổi được câu hỏi.</small></section>':
`<section class="card"><h3>Nhập đề từ file</h3><p><small>Hỗ trợ Word (.docx), PDF (dạng chữ, không phải ảnh quét) và .txt. Mỗi câu bắt đầu bằng "Câu 1." – đáp án A, B, C, D xuống dòng; câu Đúng/Sai dùng a) b) c) d); câu không có đáp án là tự luận. Hệ thống tự nhận đáp án đúng: ghi sau câu ("Đáp án: B", "a-Đ b-S c-Đ d-S"), ở bảng đáp án cuối đề, hoặc đáp án đúng được in đậm / gạch chân / tô màu / tô nền trong Word, hay đánh dấu *A. , (đúng), ✓. Câu nào chưa nhận được sẽ có cảnh báo đỏ để bạn chọn tay.</small></p><div class="row"><input type="file" id="fi" accept=".docx,.pdf,.txt" onchange="importFile(this)"><button class="ghost" onclick="$('#pt').hidden=!$('#pt').hidden">Dán văn bản</button></div><div id="pt" hidden><textarea id="ptx" rows="6" placeholder="Dán nội dung đề từ Word / PDF vào đây"></textarea><button onclick="parseText()">Phân tích</button></div></section>
<section class="card"><div class="item"><h3 style="margin:0">Câu hỏi (${qb.length}) · tổng ${+tot.toFixed(2)} điểm → quy về thang 10</h3><span><button class="ghost" onclick="addQ('mc')">+ Trắc nghiệm</button> <button class="ghost" onclick="addQ('tf')">+ Đúng/Sai</button> <button class="ghost" onclick="addQ('essay')">+ Tự luận</button></span></div><div class="row" style="margin-top:8px"><button class="ghost" onclick="openPicker()">📚 Thêm từ ngân hàng</button><input id="btag" placeholder="Thẻ khi lưu vào ngân hàng" style="min-width:200px"><button class="ghost" onclick="saveBank('all')">💾 Lưu cả đề vào ngân hàng</button></div></section>`+qb.map(qHTML).join(''))+
`<div class="giaobar"><div class="gbi"><b>${qb.length} câu · ${+tot.toFixed(2)} điểm</b><small id="gbc">${editId?'Lớp: '+esc((CLS.find(c=>c.id==ex.class_id)||{}).name||''):clsNames()}</small></div><div><button onclick="saveExam()">${editId?'💾 Lưu thay đổi':'📤 Giao bài về lớp'}</button> <button class="ghost" onclick="go('')">Hủy</button></div></div>`}
const clsNames=()=>{const n=(ex.class_ids||[]).map(id=>(CLS.find(c=>c.id==id)||{}).name).filter(Boolean);return n.length?'Giao cho: '+esc(n.join(', ')):'⚠ Chưa chọn lớp'};
window.togCls=(id,on)=>{const a=new Set(ex.class_ids||[]);on?a.add(id):a.delete(id);ex.class_ids=[...a];const g=$('#gbc');if(g)g.innerHTML=clsNames()};
const gradeItem=(x,i)=>`<section class="card"><p><b>Câu ${i+1}</b> <span class="tag">${TYPE[x.type||'mc']}</span> <small>${x.points} điểm</small></p><p>${esc(x.content)}</p>`+
(x.type=='essay'?`<div class="ans">${esc(x.text||'(Bỏ trống)')}</div>${x.model?`<small>Gợi ý đáp án: ${esc(x.model)}</small><br>`:''}<label>Điểm <input type="number" class="gi" data-q="${x.id}" step="0.25" min="0" max="${x.points}" value="${x.earned??''}" style="width:90px"> / ${x.points}</label>`
:`<small>${x.type=='tf'?`Bài làm: ${esc(x.text||'')} · Đáp án: ${esc(x.key)}`:`Chọn: ${x.picked==null?'–':'ABCD'[x.picked]} · Đáp án: ${'ABCD'[x.answer]}`} · Được ${+(x.earned??0).toFixed(2)}/${x.points} điểm</small>`)+`</section>`;
const VK={tab:'Chuyển tab / thu nhỏ trình duyệt',blur:'Chuyển sang cửa sổ / ứng dụng khác',fullscreen:'Thoát chế độ toàn màn hình',reload:'Tải lại / thoát rồi vào lại bài'};
const vlog=v=>v&&v.length?`<section class="card"><h3>⚠ Nhật ký vi phạm (${v.length} lần)</h3>${v.map(x=>`<div>${fmt(x.at)} — ${VK[x.kind]||x.kind}</div>`).join('')}</section>`:'';
PAGES.gv=async()=>{
  if(tab=='new'||tab=='edit'){CLS=await api('/classes');if(!ex.class_id&&CLS[0])ex.class_id=CLS[0].id;if(!editId&&!(ex.class_ids||[]).length&&CLS[0])ex.class_ids=[CLS[0].id];return builderHTML()}
  if(tab=='ann'){const[cs,as]=await Promise.all([api('/classes'),api('/announcements')]);return`<section class="card"><h3>Đăng thông báo cho lớp</h3><div class="lbl" style="margin-bottom:8px">Gửi tới lớp (chọn được nhiều lớp) <a class="x" style="opacity:1;color:var(--pr)" onclick="allCls(true)">Chọn tất cả</a> · <a class="x" style="opacity:1;color:var(--pr)" onclick="allCls(false)">Bỏ chọn</a><span class="clschips" id="acs">${cs.map((c,i)=>`<label class="chk cc"><input type="checkbox" value="${c.id}" ${i==0?'checked':''}> ${esc(c.name)}</label>`).join('')}</span></div><textarea id="at" rows="3" placeholder="Nội dung thông báo (lịch kiểm tra, nhắc nộp bài...)"></textarea><button onclick="addAnn()">📢 Đăng thông báo về lớp</button></section>`+(as.map(a=>annHTML(a,true)).join('')||'<small>Chưa có thông báo nào.</small>')}
  if(tab.startsWith('g:')){const d=await api(`/attempts/${tab.slice(2)}/grading`),a=d.attempt;
    return`<button class="ghost" onclick="go('r:${a.exam_id}')">← Quay lại</button><h3 style="margin-top:12px">${esc(a.name)} · ${esc(a.title)}</h3><p>Điểm hiện tại: <b>${a.score??'–'}</b> ${a.pending?'<span class="tag">Chờ chấm tự luận</span>':''}</p>${vlog(d.viol)}`+d.items.map(gradeItem).join('')+`<button onclick="saveGrade(${a.id},${a.exam_id})">Lưu điểm</button>`}
  if(tab.startsWith('r:')){
    const id=tab.slice(2);const[{exam,rows},qs,cs,fb]=await Promise.all([api(`/exams/${id}/results`),api(`/exams/${id}/stats`),api('/classes'),api(`/exams/${id}/feedback`).catch(()=>[])]);_rows=rows;_exam=exam;_fb=fb;
    const ok=rows.filter(x=>x.score!=null),avg=ok.length?+(ok.reduce((a,x)=>a+x.score,0)/ok.length).toFixed(1):null;
    const B=[['Dưới 5',0,5],['5 – dưới 7',5,7],['7 – dưới 9',7,9],['9 – 10',9,11]].map(([l,a,b])=>[l,ok.filter(x=>x.score>=a&&x.score<b).length]),mx=Math.max(1,...B.map(b=>b[1]));
    return`<button class="ghost" onclick="go('')">← Quay lại</button><h3 style="margin-top:12px">${esc(exam.title)}</h3><div class="stats">${stat('Đã nộp',ok.length+'/'+rows.length)}${stat('Điểm TB',avg)}${stat('Cao nhất',ok.length?Math.max(...ok.map(x=>x.score)):null)}${stat('Chờ chấm',rows.filter(x=>x.pending).length)}</div>
<section class="card"><div class="row" style="align-items:center"><button onclick="exportXls()">⬇ Xuất bảng điểm (Excel)</button><button class="ghost" onclick="exportCsv()">⬇ CSV</button><span>Giao lại cho lớp:</span><select id="dc">${clsOpts(cs)}</select><button onclick="dup(${exam.id})">Giao lại</button>${exam.mode=='exam'&&rows.some(x=>x.score==null)?`<button class="ghost" onclick="remind(${exam.id})">✉ Nhắc học sinh chưa nộp</button>`:''}<button class="ghost" onclick="printExam(${exam.id})">🖨 In đề</button><button class="ghost" onclick="printCert(${exam.id})">🏅 In giấy khen (≥8 điểm)</button><button class="ghost" onclick="manualScoreForm(${exam.id})">✍ Nhập điểm thủ công</button>${exam.mode=="exam"?`<button class="ghost" onclick="compareClasses(${exam.id})">📊 So sánh các lớp</button>`:""}</div></section>${fb.length?`<section class="card"><h3>💬 Góp ý về câu hỏi ${fb.filter(x=>!x.resolved).length?`<span class="tag hard">${fb.filter(x=>!x.resolved).length} chưa xử lý</span>`:''}</h3>${fb.map(x=>`<div class="fbrow ${x.resolved?'done':''}"><div><b>${esc(x.student)}</b> <small>${fmt(x.created_at)}</small><p class="q">${esc(x.question)}</p><p>${esc(x.content)}</p></div>${x.resolved?'<span class="tag">✓ Đã xử lý</span>':`<button class="ghost" onclick="resolveFb(${x.id},${exam.id})">Đánh dấu đã xử lý</button>`}</div>`).join('')}</section>`:''}
<section class="card"><h3>Phổ điểm</h3>${B.map(([l,c])=>`<div class="hb"><span>${l}</span><div><i style="width:${c/mx*100}%"></i></div><b>${c}</b></div>`).join('')}</section>
<section class="card scroll"><h3>Thống kê từng câu</h3><table><tr><th>#</th><th>Loại</th><th>Câu hỏi</th><th>Làm đủ điểm</th><th>Tỉ lệ</th></tr>${qs.map((q,i)=>{const p=q.n&&q.type!='essay'?Math.round(q.ok/q.n*100):null;return`<tr><td>${i+1}</td><td>${TYPE[q.type||'mc']}</td><td>${esc(q.content)}</td><td>${q.type=='essay'?'–':q.ok+'/'+q.n}</td><td class="${p!=null&&p<40?'hard':''}">${p==null?'–':p+'%'}${p!=null&&p<40?' · Câu khó':''}</td></tr>`}).join('')}</table></section>
<section class="card scroll"><h3>Kết quả học sinh</h3><table><tr><th>Học sinh</th><th>Điểm</th><th>Câu đúng</th><th>Rời tab</th><th>Nộp lúc</th><th></th></tr>${rows.map(x=>`<tr><td>${esc(x.name)}${x.locked?' <span class="tag">🔒 Bị khóa</span>':''}</td><td>${x.score??'Chưa làm'}${x.pending?' <small>(chờ chấm)</small>':''}</td><td>${x.score!=null?x.correct+'/'+x.total:''}</td><td>${x.violations??''}</td><td>${fmt(x.submitted_at)}</td><td>${x.attempt_id?`<button class="ghost" onclick="go('g:${x.attempt_id}')">${x.pending?'Chấm bài':'Xem bài'}</button>`:''}</td></tr>`).join('')}</table></section>`}
  const es=await api('/exams');
  return`<div class="stats">${stat('Bài đã giao',es.length)}${stat('Lượt nộp bài',es.reduce((a,e)=>a+e.done,0))}</div><h3>Bài đã giao</h3>`+(es.map(e=>`<section class="card item"><div><b>${esc(e.title)}</b> <span class="tag">${e.mode=='exam'?'Kiểm tra':'Ôn tập'}</span>${e.code?' <span class="tag">Mã: '+esc(e.code)+'</span>':''}<br><small>${esc(e.class)} · ${e.qcount} câu · ${e.minutes} phút${e.start_at?' · Mở '+e.start_at.replace('T',' '):''}${e.deadline?' · Hạn '+e.deadline.replace('T',' '):''} · ${e.done} bài nộp</small></div><div>${e.mode=='exam'?`<button class="ghost" onclick="go('live:${e.id}')">📡 Giám sát</button> `:''}<button class="ghost" onclick="go('r:${e.id}')">Kết quả</button> <button class="ghost" data-t="${esc(e.title)}" onclick="share(${e.id},this.dataset.t)">🔗 Chia sẻ</button> <button class="ghost" onclick="edit(${e.id})">Sửa</button> <button class="ghost" onclick="delExam(${e.id})">Xóa</button></div></section>`).join('')||'<small>Chưa giao bài nào.</small>')};

/* HỌC SINH */
PAGES.hs=async()=>{
  if(tab=='res'){const h=await api('/my-history');return`<h3>Lịch sử làm bài</h3><section class="card scroll"><table><tr><th>Bài</th><th>Loại</th><th>Điểm</th><th>Đúng</th><th>Nộp lúc</th><th></th></tr>${h.map(x=>`<tr><td>${esc(x.title)}</td><td>${x.mode=='exam'?'Kiểm tra':'Ôn tập'}</td><td><b>${x.score??'–'}</b>${x.pending?' <small>(tạm tính)</small>':''}</td><td>${x.correct!=null?x.correct+'/'+x.total:''}</td><td>${fmt(x.submitted_at)}</td><td>${x.score!=null?`<button class="ghost" onclick="go('rv:${x.id}')">Xem lại</button>`:''}</td></tr>`).join('')||'<tr><td colspan=6><small>Chưa có kết quả.</small></td></tr>'}</table></section>`}
  if(tab.startsWith('rv:')){const d=await api('/attempts/'+tab.slice(3)+'/review');return`<button class="ghost" onclick="go('res')">← Quay lại</button>`+scoreCard(d.title,d.score,d.correct,d.total)+reviewHTML(d.items,d.reveal)}
  if(tab=='rank'){const rk=await api('/leaderboard'),med=['🥇','🥈','🥉'];return`<h3>Bảng xếp hạng lớp</h3><section class="card scroll"><table><tr><th>Hạng</th><th>Học sinh</th><th>Điểm TB</th><th>Số bài</th></tr>${rk.map((u,i)=>`<tr class="${u.id==me.id?'me':''}"><td>${u.avg==null?'–':med[i]||i+1}</td><td>${esc(u.name)}${u.id==me.id?' (bạn)':''}</td><td>${u.avg??'–'}</td><td>${u.n}</td></tr>`).join('')}</table></section>`}
  if(tab=='ann'){const as=await api('/announcements');return`<h3>Thông báo từ giáo viên</h3>`+(as.map(a=>annHTML(a,false)).join('')||'<small>Chưa có thông báo nào.</small>')}
  const[es,favRaw]=[await api('/my-exams'),await api('/favorites').catch(()=>[])],favs=new Set(favRaw.map(x=>x.id));
  const sub=e=>e.tries>0,late=e=>e.deadline&&new Date(e.deadline)<new Date(),notOpen=e=>e.start_at&&new Date(e.start_at)>new Date();
  const dn=es.filter(sub),sc=es.filter(e=>e.score!=null),todo=es.filter(e=>!sub(e)&&(e.mode=='practice'||!late(e))).length,avg=sc.length?+(sc.reduce((a,e)=>a+e.score,0)/sc.length).toFixed(1):null;
  return`<div class="stats">${stat('Cần làm',todo)}${stat('Đã làm',dn.length)}${stat('Điểm TB',avg)}</div><h3>Bài của tôi</h3>`+(es.map(e=>{
    const go1=`<button onclick="start(${e.id},${e.has_code?1:0},'${e.mode}')">`;
    const act=e.mode=='practice'?`${go1}${sub(e)?'Ôn lại':'Bắt đầu ôn'}</button>`:sub(e)?(e.score!=null?`<b>Điểm: ${e.score}</b>${e.pending?' <small>(tạm tính)</small>':''}`:'<i>Đã nộp</i>'):late(e)?'<i>Đã quá hạn</i>':notOpen(e)?`<i>Mở lúc ${fmt(e.start_at)}</i>`:`${go1}Làm bài</button>`;
    return`<section class="card item${e.id==want?' hl':''}" id="ex${e.id}"><div><b>${esc(e.title)}</b> <a class="starb ${favs.has(e.id)?'on':''}" onclick="toggleFav(${e.id},this)" title="Đánh dấu yêu thích">${favs.has(e.id)?'★':'☆'}</a> <span class="tag">${e.mode=='exam'?'Kiểm tra':'Ôn tập'}</span>${e.has_code?' <span class="tag">🔒 Cần mã</span>':''}<br><small>${e.qcount} câu · ${e.minutes} phút${e.deadline?' · Hạn '+e.deadline.replace('T',' '):''}</small></div>${act}</section>`}).join('')||'<small>Chưa có bài nào được giao.</small>')};

/* Làm bài */
const answered=q=>{const a=cur.ans[q.id];return q.type=='mc'?a!=null:q.type=='tf'?/[DS]/.test(a||''):!!(a&&a.trim())};
const qInput=q=>q.type=='essay'?`<textarea class="essay" rows="5" placeholder="Nhập bài làm của bạn..." ${cur.mode=='exam'?'onpaste="return false"':''} oninput="setEssay(${q.id},this.value)"></textarea>`
:q.type=='tf'?'<small>Chọn Đúng hoặc Sai cho từng phát biểu:</small>'+q.options.map((o,k)=>`<div class="tfrow"><span><b>${'abcd'[k]})</b> ${esc(o)}</span><span class="tfb"><label class="opt"><input type="radio" name="q${q.id}s${k}" onchange="pickTf(${q.id},${k},'D')"> Đúng</label><label class="opt"><input type="radio" name="q${q.id}s${k}" onchange="pickTf(${q.id},${k},'S')"> Sai</label></span></div>`).join('')
:q.options.map((o,k)=>`<label class="opt"><input type="radio" name="q${q.id}" onchange="pick(${q.id},${k})"> ${'ABCD'[k]}. ${esc(o)}</label>`).join('');
function examHTML(){return`<div class="bar"><b>${esc(cur.title)}</b><span><span id="vc">${cur.viol?`⚠ ${cur.viol}/${cur.maxViol}  `:''}</span><span id="sv" class="svi"></span><span id="clock"></span><button class="subbtn" onclick="askSubmit()" title="Nộp bài">📤 Nộp bài</button></span></div><div class="prog"><i id="pb"></i></div><div class="chips">${cur.questions.map((q,i)=>`<a id="c${q.id}" onclick="document.getElementById('q${q.id}').scrollIntoView({behavior:'smooth',block:'center'})">${i+1}</a>`).join('')}</div>${cur.mode=='exam'?`<div class="rules">🔒 <b>Chế độ chống gian lận:</b> bài thi chạy toàn màn hình. Chuyển tab, chuyển sang cửa sổ / ứng dụng khác hoặc thoát toàn màn hình đều bị tính <b>1 lần vi phạm</b>. Vi phạm đủ <b>${cur.maxViol} lần</b>, bài bị nộp ngay và <b>tài khoản bị đình chỉ, khóa</b>.</div>`:''}<p><small>🚩 Bấm cờ để đánh dấu câu cần xem lại.</small></p><div class="noselect" oncopy="return false" oncontextmenu="return false">${cur.questions.map((q,n)=>`<section class="card" id="q${q.id}"><p><a class="flagb" id="f${q.id}" onclick="flag(${q.id})">🚩</a><b>Câu ${n+1}.</b> <span class="tag">${TYPE[q.type]}</span> ${esc(q.content)}</p>${qInput(q)}</section>`).join('')}</div>`}
function upd(id){if(window.touch)touch();const q=cur.questions.find(q=>q.id==id);$('#c'+id).classList.toggle('on',answered(q));$('#pb').style.width=cur.questions.filter(answered).length/cur.questions.length*100+'%'}
function pick(id,k){cur.ans[id]=k;upd(id)}
function pickTf(id,k,v){const s=cur.ans[id]||'----';cur.ans[id]=s.slice(0,k)+v+s.slice(k+1);upd(id)}
function setEssay(id,t){cur.ans[id]=t;upd(id)}
function tick(){if(!cur)return;const r=Math.max(0,Math.round((cur.endsAt-Date.now())/1000)),c=$('#clock');if(c)c.textContent='⏱ '+String(Math.floor(r/60)).padStart(2,'0')+':'+String(r%60).padStart(2,'0');if(r<=0){toast('Hết giờ, bài được tự động nộp');submit()}}
function resultHTML(){const d=done,btn='<button onclick="done=null;render()">Về danh sách bài</button>';
  const head=d.hidden?`<section class="card" style="text-align:center"><p>${esc(d.title)}</p><div class="big">✅</div><p>Bài đã được nộp. Điểm sẽ do giáo viên công bố.</p>${d.pending?'<p><small>Có câu tự luận chờ giáo viên chấm.</small></p>':''}${btn}</section>`
   :scoreCard(d.title,d.score,d.correct,d.total,(d.pending?'<p><small>⏳ Điểm tạm tính – còn câu tự luận chờ giáo viên chấm</small></p>':'')+(d.late?'<p><small>(nộp trễ, không tính bài làm)</small></p>':'')+btn);
  return head+(d.review?reviewHTML(d.review,d.reveal):'')}

/* Hành động */
window.theme=()=>{dark=!dark;localStorage.setItem('theme',dark?'dark':'light');applyTheme();render()};
window.login=run(async()=>{const d=await api('/login','POST',{username:$('#lu').value,password:$('#lp').value,admin:adminMode});token=d.token;localStorage.setItem('token',token);me=d.user;tab='';render()});
window.logout=run(async()=>{if(cur&&!await uiConfirm('Đang làm bài, thoát sẽ mất bài?'))return;clearInterval(timer);cur=null;done=null;try{await api('/logout','POST')}catch{}adminMode=false;token=null;me=null;localStorage.removeItem('token');render()});
window.toggleAdmin=()=>{adminMode=!adminMode;render()};
window.go=k=>{if(k.startsWith('rv:'))rvTab=null;if(k=='new'){ex=EX0();qb=[];editId=null;locked=false}tab=k;done=null;render()};
window.flag=id=>{$('#f'+id).classList.toggle('flag');$('#c'+id).classList.toggle('flag')};
window.changePw=run(async()=>{if($('#pn').value!==$('#pn2').value)throw new Error('Hai mật khẩu mới không khớp');await api('/password','POST',{old:$('#po').value,pw:$('#pn').value});toast('Đã đổi mật khẩu');render()});
window.addUser=run(async()=>{await api('/users','POST',{name:$('#nn').value,username:$('#nu').value,password:$('#np').value,role:$('#nr').value,class_id:+$('#nc').value||null,title:$('#ntt').value||null});toast('Đã thêm tài khoản');render()});
window.delUser=run(async id=>{if(await uiConfirm('Xóa tài khoản này?')){await api('/users/'+id,'DELETE');render()}});
window.resetPw=run(async id=>{if(!await uiConfirm('Đặt lại mật khẩu cho tài khoản này?'))return;const d=await api(`/users/${id}/reset`,'POST');await uiPrompt('Hãy gửi mật khẩu này cho người dùng. Họ nên đổi lại sau khi đăng nhập.',d.password,{title:'Đã đặt lại mật khẩu',copy:true,hideCancel:true,okText:'Xong'})});
window.addClass=run(async()=>{await api('/classes','POST',{name:$('#ncl').value});render()});
window.delClass=run(async(id,name)=>{if(await uiConfirm(`Xóa lớp ${name}? Các bài đã giao cho lớp này cũng bị xóa.`)){await api('/classes/'+id,'DELETE');render()}});
window.filterUsers=()=>{const q=$('#fs').value.toLowerCase().trim(),r=$('#fr').value;document.querySelectorAll('tr[data-s]').forEach(t=>t.style.display=(!q||t.dataset.s.includes(q))&&(!r||t.dataset.r==r||(r=='locked'&&t.dataset.l=='1'))?'':'none')};
/* Thỏa thuận làm bài kiểm tra: phải tick đồng ý rồi mới bấm vào thi */
const fsTip=()=>matchMedia('(pointer:coarse)').matches&&document.fullscreenEnabled?'<p class="fstip">📱 Khi vào thi, trình duyệt sẽ hiện dòng <i>“Kéo từ trên xuống và vuốt từ mép trái hoặc mép phải để thoát khỏi chế độ toàn màn hình”</i>. <b>Đừng làm theo</b> – thoát toàn màn hình bị tính 1 lần vi phạm. Làm xong chỉ cần bấm nút <b>Nộp bài</b>.</p>':'';
window.start=(id,hasCode,mode)=>{
  if(mode!='exam')return hasCode?askCode(id,mode):doStart(id,'',mode);
  const m=$('#modal');m.className='';m._fn=null;
  m.innerHTML=`<div class="mbox"><h3>📜 Thỏa thuận làm bài kiểm tra</h3><p>Trước khi vào thi, bạn cần đọc và đồng ý:</p><ul style="padding-left:18px;font-size:14px;line-height:1.6;margin:0 0 12px"><li>Tự làm bài bằng sức mình, không trao đổi, không dùng tài liệu hay công cụ trái phép.</li><li>Bài thi chạy ở chế độ <b>toàn màn hình</b>; không chuyển tab, không chuyển sang cửa sổ / ứng dụng khác, không thoát toàn màn hình.</li><li>Mỗi lần vi phạm đều được ghi lại. Vi phạm đủ số lần quy định, bài bị <b>nộp ngay</b> và <b>tài khoản bị đình chỉ, khóa</b>.</li><li>Bài kiểm tra chỉ được làm <b>một lần</b>; hết giờ bài tự động nộp.</li></ul>${fsTip()}<label class="chk"><input type="checkbox" id="agr" onchange="$('#agok').disabled=!this.checked"> Tôi đã đọc và đồng ý với thỏa thuận trên</label><div class="row" style="margin-top:8px"><button id="agok" disabled onclick="agreeStart(${id},${hasCode?1:0},'${mode}')">Đồng ý và vào thi</button><button class="ghost" onclick="closeModal()">Hủy</button></div></div>`;
  m.hidden=false};
const reqFs=()=>{const d=document.documentElement,f=d.requestFullscreen||d.webkitRequestFullscreen;if(f&&!document.fullscreenElement&&!document.webkitFullscreenElement)try{const r=f.call(d);if(r&&r.catch)r.catch(()=>{})}catch{}};
window.agreeStart=(id,hasCode,mode)=>{if(!$('#agr')?.checked)return;reqFs();hasCode?askCode(id,mode):(closeModal(),doStart(id,'',mode))};
/* hộp nhập mã vào bài ngay trong trang (không dùng prompt để không bị thoát toàn màn hình, chạy được trên điện thoại) */
window.askCode=(id,mode)=>{const m=$('#modal');m.className='';m._fn=null;
  m.innerHTML=`<div class="mbox"><h3>🔑 Nhập mã vào bài</h3><p><small>Nhập mã do giáo viên cung cấp.</small></p><input id="cin" placeholder="Mã vào bài" autocomplete="off" autocapitalize="off" style="width:100%;margin-bottom:10px" onkeydown="if(event.key=='Enter')submitCode(${id},'${mode}')"><div class="row"><button onclick="submitCode(${id},'${mode}')">Vào thi</button><button class="ghost" onclick="cancelCode()">Hủy</button></div></div>`;
  m.hidden=false;setTimeout(()=>$('#cin')?.focus(),50)};
window.submitCode=(id,mode)=>{const c=$('#cin').value.trim();if(!c)return toast('Hãy nhập mã vào bài');closeModal();doStart(id,c,mode)};
window.cancelCode=()=>{closeModal();exitFs()};
const doStart=run(async(id,code,mode)=>{
  const fsp=mode=='exam'&&document.fullscreenEnabled&&!document.fullscreenElement?(reqFs(),null):null;   // vào toàn màn hình ngay khi bấm nút
  try{const d=await api(`/exams/${id}/start?code=${encodeURIComponent(code)}`);cur={...d,ans:{},viol:d.viol||0,fs:false};await fsp;cur.fs=!!document.fullscreenElement;
    cur.ans=d.draft?{...d.draft}:{};try{const l=JSON.parse(localStorage.getItem('draft:'+d.attempt)||'null');if(l)for(const k in l)if(cur.ans[k]==null)cur.ans[k]=l[k]}catch{}
    timer=setInterval(tick,1000);await render();if(window.restoreAns)restoreAns();if(window.startSave)startSave();tick();
    if(cur.viol)showWarn('reload',{count:cur.viol,max:cur.maxViol})}
  catch(e){exitFs();throw e}});
window.submit=run(async()=>{const c=cur;if(!c||c.ending)return;c.ending=true;clearInterval(timer);
  try{const d=await api(`/attempts/${c.attempt}/submit`,'POST',{answers:c.ans});done={...d,title:c.title};try{localStorage.removeItem('draft:'+c.attempt)}catch{}clearInterval(window._svI);rvTab=null;cur=null;exitFs();render()}
  catch(e){c.ending=false;timer=setInterval(tick,1000);throw e}});
/* soạn đề */
window.addQ=t=>{qb.push(newQ(t));render()};
window.rmq=async i=>{if(await uiConfirm('Xóa câu này?')){qb.splice(i,1);render()}};
window.mv=(i,d)=>{const j=i+d;if(j<0||j>=qb.length)return;[qb[i],qb[j]]=[qb[j],qb[i]];render()};
window.okAns=(el,i)=>{if(i!=null&&/-/.test(qb[i].key))return;el.closest('.qb').querySelectorAll('[data-a]').forEach(e=>e.remove())};
window.setKey=(i,k,v)=>{qb[i].key=qb[i].key.slice(0,k)+v+qb[i].key.slice(k+1)};
const addParsed=qs=>{qb.push(...qs.map(q=>({...newQ(q.type),...q,options:q.options.length?q.options:['','','',''],points:q.points??(q.type=='essay'?2:1)})));toast(`Đã nhận diện ${qs.length} câu – hãy kiểm tra lại đáp án trước khi giao`);render()};
window.importFile=run(async inp=>{const f=inp.files[0];if(!f)return;toast('Đang đọc file...');
  const r=await fetch('/api/import?name='+encodeURIComponent(f.name),{method:'POST',headers:{'Content-Type':'application/octet-stream',Authorization:'Bearer '+token},body:f});
  const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Lỗi '+r.status);addParsed(d.questions)});
window.parseText=run(async()=>{addParsed(await api('/parse','POST',{text:$('#ptx').value}))});
const chk=q=>!q.content.trim()?'thiếu nội dung':q.type=='essay'?'':q.options.some(o=>!String(o).trim())?'có đáp án / phát biểu còn trống':q.type=='mc'&&!(q.answer>=0)?'chưa chọn đáp án đúng':q.type=='tf'&&!/^[DS]{4}$/.test(q.key)?'chưa chọn Đúng/Sai cho đủ 4 ý':'';
window.saveExam=run(async()=>{
  if(!ex.title.trim())throw new Error('Nhập tên bài');
  if(!locked){if(!qb.length)throw new Error('Chưa có câu hỏi nào');for(let i=0;i<qb.length;i++){const m=chk(qb[i]);if(m)throw new Error(`Câu ${i+1}: ${m}`)}}
  const cq=locked?undefined:qb.map(({warn,...q})=>({...q,answer:+q.answer,points:+q.points||1}));
  if(editId){await api('/exams/'+editId,'PUT',{...ex,class_id:+ex.class_id,questions:cq});toast('Đã lưu bài');editId=null;qb=[];ex=EX0();tab='';return render()}
  const ids=ex.class_ids||[];if(!ids.length)throw new Error('Hãy chọn ít nhất một lớp để giao bài');
  if(ids.length>1)await api('/exams/multi','POST',{...ex,class_ids:ids.map(Number),questions:cq});
  else await api('/exams','POST',{...ex,class_id:+ids[0],questions:cq});
  toast(ids.length>1?`Đã giao bài cho ${ids.length} lớp`:'Đã giao bài về lớp');qb=[];ex=EX0();tab='';render()});
window.edit=run(async id=>{const d=await api('/exams/'+id),e=d.exam;
  ex={title:e.title,class_id:e.class_id,minutes:e.minutes,start_at:e.start_at||'',deadline:e.deadline||'',mode:e.mode,code:e.code||'',max_viol:e.max_viol||3,shuffle:!!e.shuffle,show_score:!!e.show_score,show_answer:!!e.show_answer};
  qb=d.questions.map(q=>({...q,key:q.key||'DDDD'}));editId=id;locked=d.locked;tab='edit';render()});
window.saveGrade=run(async(id,eid)=>{const grades=[...document.querySelectorAll('.gi')].filter(i=>i.value!=='').map(i=>({question_id:+i.dataset.q,earned:+i.value}));await api(`/attempts/${id}/grade`,'POST',{grades});toast('Đã lưu điểm');go('r:'+eid)});
window.delExam=run(async id=>{if(await uiConfirm('Xóa bài này và kết quả của nó?')){await api('/exams/'+id,'DELETE');render()}});
window.dup=run(async id=>{await api(`/exams/${id}/duplicate`,'POST',{class_id:+$('#dc').value});toast('Đã giao lại bài cho lớp được chọn')});
window.remind=run(async id=>{if(!await uiConfirm('Gửi thông báo nhắc các bạn chưa nộp bài này?'))return;const d=await api(`/exams/${id}/remind`,'POST');toast(`Đã nhắc ${d.count} bạn chưa nộp bài`);render()});
window.resolveFb=run(async(fid,eid)=>{await api(`/feedback/${fid}/resolve`,'POST');toast('Đã đánh dấu xử lý');go('r:'+eid)});
window.allCls=on=>document.querySelectorAll('#acs input').forEach(i=>i.checked=on);
window.addAnn=run(async()=>{const ids=[...document.querySelectorAll('#acs input:checked')].map(i=>+i.value);if(!ids.length)throw new Error('Hãy chọn ít nhất một lớp');const content=$('#at').value;if(!content.trim())throw new Error('Nhập nội dung thông báo');
  for(const id of ids)await api('/announcements','POST',{class_id:id,content});toast(ids.length>1?`Đã đăng thông báo cho ${ids.length} lớp`:'Đã đăng thông báo');render()});
window.delAnn=run(async id=>{await api('/announcements/'+id,'DELETE');render()});
window.exportXls=()=>{
  const rows=_rows,ok=rows.filter(x=>x.score!=null),sc=ok.map(x=>+x.score),avg=sc.length?(sc.reduce((a,b)=>a+b,0)/sc.length):null;
  const xl=v=>v==null?'–':v,H=v=>esc(v),rank=v=>v==null?['Chưa làm','#eceff4','#5b6b8c']:v>=8?['Giỏi','#d8f3e3','#0f6b3a']:v>=6.5?['Khá','#dbeafe','#1d4fa8']:v>=5?['Trung bình','#fff1cc','#8a5a00']:['Yếu','#fde0e0','#a61e1e'];
  const sorted=[...rows].sort((a,b)=>(b.score??-1)-(a.score??-1)||a.name.localeCompare(b.name,'vi'));
  const cnt=g=>ok.filter(x=>rank(x.score)[0]==g).length;
  const th=t=>`<th style="background:#1d5fd6;color:#fff;font-weight:bold;border:1px solid #14459c;padding:8px;text-align:center">${t}</th>`;
  const td=(v,st='')=>`<td style="border:1px solid #c9d6ee;padding:6px 8px;${st}">${v}</td>`;
  const sum=(l,v,bg)=>`<td style="border:1px solid #c9d6ee;background:${bg};padding:8px;text-align:center"><div style="font-size:11px;color:#5b6b8c">${l}</div><div style="font-size:18px;font-weight:bold;color:#14213d">${v}</div></td>`;
  const body=sorted.map((x,i)=>{const [g,bg,fg]=rank(x.score),top=x.score!=null&&i<3?['#ffd54f','#cfd8dc','#e0a96d'][i]:null;
    return`<tr>${td(i+1,'text-align:center;font-weight:bold'+(top?`;background:${top}`:''))}${td(H(x.name),'font-weight:bold')}${td(x.score!=null?x.score:'Chưa làm','text-align:center;font-weight:bold;font-size:14px;background:'+bg+';color:'+fg)}${td(x.score!=null?x.correct+'/'+x.total:'','text-align:center')}${td(`<span style="color:${fg};font-weight:bold">${g}</span>`,'text-align:center;background:'+bg)}${td(x.violations||0,'text-align:center;'+((x.violations||0)>0?'color:#a61e1e;font-weight:bold':''))}${td(H(fmt(x.submitted_at)),'text-align:center')}${td(x.pending?'Chờ chấm tự luận':x.locked?'Bị khóa':x.score!=null?'Đã chấm':'Chưa nộp','text-align:center')}</tr>`}).join('');
  const html=`<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Bảng điểm</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head><body style="font-family:Calibri,Arial,sans-serif"><table style="border-collapse:collapse">
<tr><td colspan="8" style="font-size:22px;font-weight:bold;color:#fff;background:#14459c;padding:14px;text-align:center">BẢNG ĐIỂM – ${H(_exam.title||'')}</td></tr>
<tr><td colspan="8" style="background:#e3edff;color:#14213d;padding:6px;text-align:center">${_exam.class?'Lớp: '+H(_exam.class)+' · ':''}Xuất ngày ${new Date().toLocaleDateString('vi-VN')} lúc ${new Date().toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'})} · Hệ thống EduGDTX</td></tr>
<tr><td colspan="8" style="height:8px"></td></tr>
<tr>${sum('Đã nộp',ok.length+'/'+rows.length,'#eef4ff')}${sum('Điểm TB',avg==null?'–':avg.toFixed(2),'#eef4ff')}${sum('Cao nhất',sc.length?Math.max(...sc):'–','#d8f3e3')}${sum('Thấp nhất',sc.length?Math.min(...sc):'–','#fde0e0')}${sum('Giỏi (≥8)',cnt('Giỏi'),'#d8f3e3')}${sum('Khá (6.5–<8)',cnt('Khá'),'#dbeafe')}${sum('TB (5–<6.5)',cnt('Trung bình'),'#fff1cc')}${sum('Yếu (<5)',cnt('Yếu'),'#fde0e0')}</tr>
<tr><td colspan="8" style="height:10px"></td></tr>
<tr>${th('Hạng')}${th('Họ và tên')}${th('Điểm')}${th('Số câu đúng')}${th('Xếp loại')}${th('Số lần rời tab')}${th('Nộp lúc')}${th('Trạng thái')}</tr>${body}</table></body></html>`;
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['﻿'+html],{type:'application/vnd.ms-excel;charset=utf-8'}));a.download='Bang-diem-'+(_exam.title||'bai').replace(/[\\/:*?"<>|]+/g,'-')+'.xls';document.body.append(a);a.click();setTimeout(()=>{a.remove();URL.revokeObjectURL(a.href)},1500)};
window.exportCsv=()=>{const rows=[['Học sinh','Điểm','Số câu đúng','Tổng câu','Số lần rời tab','Nộp lúc'],..._rows.map(x=>[x.name,x.score??'',x.correct??'',x.total??'',x.violations??'',fmt(x.submitted_at)])];
  const csv='\ufeff'+rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download=(_exam.title||'ket-qua')+'.csv';a.click()};

/* ===== CHỐNG GIAN LẬN ===== */
function showModal(h,btn,fn,solid){const m=$('#modal');m.onclick=null;m.className=solid?'solid':'';m.innerHTML=`<div class="mbox">${h}<button onclick="closeModal()">${btn}</button></div>`;m.hidden=false;m._fn=fn}
window.closeModal=()=>{const m=$('#modal');m.hidden=true;const f=m._fn;m._fn=null;if(f)f()};
window.fbForm=qid=>{const m=$('#modal');m.onclick=e=>{if(e.target===m)m.hidden=true};m.className='';m._fn=null;
  m.innerHTML=`<div class="mbox"><h3>💬 Góp ý về câu hỏi</h3><p><small>Gửi cho giáo viên nếu bạn thấy câu này có vấn đề (sai đáp án, đề chưa rõ...).</small></p><textarea id="fbtx" rows="3" placeholder="Góp ý của bạn..."></textarea><div class="row"><button class="ghost" onclick="$('#modal').hidden=true">Hủy</button><button onclick="sendFb(${qid})">Gửi góp ý</button></div></div>`;
  m.hidden=false};
window.sendFb=run(async qid=>{const t=$('#fbtx').value.trim();if(!t)return toast('Nhập nội dung góp ý');await api('/feedback','POST',{question_id:qid,content:t});$('#modal').hidden=true;toast('Đã gửi góp ý, cảm ơn bạn!')});
function enterFs(){if(cur&&cur.mode=='exam'&&document.fullscreenEnabled&&!document.fullscreenElement)document.documentElement.requestFullscreen().then(()=>{if(cur)cur.fs=true}).catch(()=>{})}
function exitFs(){if(document.fullscreenElement)document.exitFullscreen().catch(()=>{})}
function showWarn(kind,d){
  const why={tab:'rời khỏi tab làm bài',blur:'chuyển sang cửa sổ / ứng dụng khác',fullscreen:'thoát chế độ toàn màn hình',reload:'tải lại hoặc thoát rồi vào lại bài'}[kind];
  const v=$('#vc');if(v)v.textContent=`⚠ ${d.count}/${d.max}  `;
  showModal(`<h3>⚠ Vi phạm lần ${d.count}/${d.max}</h3><p>Bạn vừa ${why}. Nếu vi phạm đủ ${d.max} lần, bài sẽ bị nộp ngay và <b>tài khoản bị đình chỉ, khóa</b>.</p>`,'Tiếp tục làm bài',enterFs,true)}
function suspend(d){
  clearInterval(timer);const t=cur.title;cur=null;done=null;token=null;me=null;localStorage.removeItem('token');exitFs();render();
  showModal(`<h3>🚫 Tài khoản bị đình chỉ</h3><p>Bạn đã vi phạm quy chế thi ${d.max} lần (rời khỏi bài thi). Bài "${esc(t)}" đã được tự động nộp và tài khoản của bạn đã bị khóa.</p><p><small>Hãy liên hệ quản trị viên hoặc giáo viên để được xem xét mở khóa.</small></p>`,'Đã hiểu')}
let lastV=0;
async function violation(kind){
  if(!cur||cur.mode!='exam'||cur.ending||cur.quiet)return;
  const now=Date.now();if(now-lastV<1500)return;lastV=now;         // chuyển tab thường kích hoạt nhiều sự kiện cùng lúc → chỉ tính 1 lần
  const c=cur;
  try{const d=await api(`/attempts/${c.attempt}/violation`,'POST',{kind,answers:c.ans});
    if(cur!==c)return;if(d.locked)suspend(d);else if(!d.ignored){c.viol=d.count;showWarn(kind,d)}}
  catch(e){toast(e.message)}}
/* Hộp thoại xác nhận nộp bài (thay cho confirm() của trình duyệt) */
window.askSubmit=()=>{
  if(!cur||cur.ending)return;
  const qs=cur.questions,total=qs.length,left=qs.filter(q=>!answered(q)),done=total-left.length,pct=Math.round(done/total*100);
  const flagged=document.querySelectorAll('.flagb.flag').length,r=Math.max(0,Math.round((cur.endsAt-Date.now())/1000)),mm=String(Math.floor(r/60)).padStart(2,'0')+':'+String(r%60).padStart(2,'0');
  const m=$('#modal');m.className='';m._fn=null;
  m.innerHTML=`<div class="mbox sbox"><div class="sico">${left.length?'⚠️':'✅'}</div>
<h3>${left.length?'Bạn chưa làm hết bài':'Sẵn sàng nộp bài?'}</h3>
<p class="ssub">${left.length?`Còn <b>${left.length}</b> câu chưa làm. Sau khi nộp bạn <b>không thể sửa</b> bài.`:'Bạn đã trả lời tất cả các câu hỏi. Sau khi nộp bạn <b>không thể sửa</b> bài.'}</p>
<div class="sstat"><div class="sring" style="--p:${pct}"><b>${pct}%</b></div><div class="sgrid"><div class="g ok"><b>${done}</b><small>Đã làm</small></div><div class="g none"><b>${left.length}</b><small>Chưa làm</small></div><div class="g flag"><b>${flagged}</b><small>Đã đánh dấu 🚩</small></div><div class="g time"><b>${mm}</b><small>Thời gian còn lại</small></div></div></div>
${left.length?`<div class="sleft"><small>Các câu chưa làm – bấm số để đi tới câu đó:</small><div class="schips">${left.map(q=>`<a onclick="goQ(${q.id})">${qs.indexOf(q)+1}</a>`).join('')}</div></div>`:''}
<div class="sbtns"><button class="ghost" onclick="closeSubmit()">← Quay lại làm bài</button><button class="go" onclick="confirmSubmit()">📤 Nộp bài</button></div></div>`;
  m.hidden=false;m.onclick=e=>{if(e.target===m)closeSubmit()}};
window.closeSubmit=()=>{const m=$('#modal');m.hidden=true;m.onclick=null};
window.confirmSubmit=()=>{closeSubmit();submit()};
window.goQ=id=>{closeSubmit();const el=document.getElementById('q'+id);if(el)el.scrollIntoView({behavior:'smooth',block:'center'})};
document.addEventListener('visibilitychange',()=>{if(document.hidden)violation('tab')});
window.addEventListener('blur',()=>setTimeout(()=>{if(!document.hidden&&!document.hasFocus())violation('blur')},300));
document.addEventListener('fullscreenchange',()=>{if(cur&&cur.mode=='exam'&&cur.fs&&!document.fullscreenElement)violation('fullscreen')});
window.setLock=run(async(id,v)=>{let reason='';if(v){reason=await uiPrompt('Lý do khóa (có thể bỏ trống):','',{title:'Khóa tài khoản',icon:'🔒',okText:'Khóa',placeholder:'Ví dụ: vi phạm quy chế thi'});if(reason===null)return}else if(!await uiConfirm('Mở khóa tài khoản này?'))return;
  await api(`/users/${id}/lock`,'POST',{locked:!!v,reason});toast(v?'Đã khóa tài khoản':'Đã mở khóa tài khoản');render()});

(async()=>{if(token){try{me=await api('/me')}catch{token=null;localStorage.removeItem('token')}}render()})();
