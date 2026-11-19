/* =====================================================================
   Chức năng mở rộng (phần 8, nạp sau features7.js)
   T. Trợ lý AI: ôn tập cho học sinh · gợi ý nhận xét · soạn câu hỏi từ văn bản
   U. Tính năng riêng: dự đoán điểm trước khi nộp bài · chuỗi ngày học liên tục
   ===================================================================== */

/* ---------- ADMIN: trạng thái AI trên trang Quản lý ---------- */
const _pgAdmin8=PAGES.admin;
PAGES.admin=async()=>{
  let h=await _pgAdmin8();
  if(tab=='')try{const s=await api('/ai/status');
    h=`<section class="card aistat"><div class="aihd"><div class="aiav">🤖</div><div style="flex:1"><b>Trợ lý AI</b> ${s.enabled?'<span class="tag" style="color:var(--ok)">Đã bật</span>':'<span class="tag hard">Chưa cấu hình</span>'}<br><small>${s.enabled?`Model: <b>${esc(s.model||'')}</b>`:'Đặt biến môi trường ANTHROPIC_API_KEY trên máy chủ để bật. Mỗi lượt gọi sẽ tính phí trên tài khoản API của trung tâm.'}</small></div></div>
${s.enabled?`<div class="aistats"><div><b>${s.today}</b><small>lượt hôm nay</small></div><div><b>${s.week}</b><small>lượt 7 ngày qua</small></div><div><b>${s.hs}</b><small>của học sinh</small></div><div><b>${s.gv}</b><small>của giáo viên</small></div></div><small>Giới hạn: học sinh 30 lượt/giờ, giáo viên 60 lượt/giờ.</small>`:''}</section>`+h}catch(e){}
  return h;
};

/* ---------- GIÁO VIÊN: AI gợi ý nhận xét + AI soạn câu hỏi ---------- */
const _editRemark8=window.editRemark;
window.editRemark=run(async(sid,name)=>{
  await _editRemark8(sid,name);
  const box=$('#modal');box.innerHTML=box.innerHTML.replace('<div class="row"><button onclick="saveRemark('+sid+')">Lưu</button></div>',
    `<div class="row"><input id="remNotes" placeholder="Ghi chú nhanh để AI gợi ý (vd: hay quên bài tập)" style="flex:1"><button class="ghost" onclick="aiRemark('${esc(name).replace(/'/g,"\\'")}')">🤖 AI gợi ý</button></div><div class="row"><button onclick="saveRemark(${sid})">Lưu</button></div>`);
});
window.aiRemark=run(async name=>{
  const notes=$('#remNotes').value.trim();if(!notes)return toast('Nhập ghi chú ngắn để AI gợi ý');
  const d=await api('/ai/remark-suggest','POST',{name,notes});
  $('#remtx').value=d.suggestion;toast('AI đã gợi ý, bạn có thể sửa lại trước khi lưu');
});
const _builderHTML8=builderHTML;
builderHTML=function(){
  const h=_builderHTML8();
  return h.replace('<button class="ghost" onclick="openPicker()">📚 Thêm từ ngân hàng</button>',
    '<button class="ghost" onclick="openPicker()">📚 Thêm từ ngân hàng</button><button class="ghost" onclick="openAiGen()">🤖 AI soạn câu hỏi</button>');
};
window.openAiGen=()=>{
  showModal(`<h3>🤖 AI soạn câu hỏi trắc nghiệm</h3><p><small>Dán một đoạn bài học, AI sẽ soạn thử câu hỏi trắc nghiệm. Bạn nên kiểm tra và sửa lại trước khi giao bài.</small></p>
<textarea id="aiTxt" rows="6" placeholder="Dán nội dung bài học vào đây..."></textarea><div class="row"><input id="aiN" type="number" min="1" max="15" value="5" style="width:90px"><span>câu</span><button onclick="genAiQ()">Soạn câu hỏi</button></div><div id="aiMsg"></div>`,'Đóng');
};
window.genAiQ=run(async()=>{
  const text=$('#aiTxt').value.trim();if(text.length<30)return toast('Dán đoạn văn dài hơn một chút để AI soạn câu hỏi');
  $('#aiMsg').innerHTML='<small>⏳ AI đang soạn câu hỏi...</small>';
  const qs=await api('/ai/generate-questions','POST',{text,count:+$('#aiN').value||5});
  qs.forEach(q=>qb.push({...newQ('mc'),...q,warn:['Do AI soạn — hãy kiểm tra lại đáp án trước khi giao bài']}));
  $('#modal').hidden=true;toast(`AI đã soạn ${qs.length} câu — hãy kiểm tra lại trước khi giao bài`);render();
});

/* ---------- TRỢ LÝ AI: khung trò chuyện dùng chung cho học sinh & giáo viên ---------- */
NAV.hs.splice(NAV.hs.length-1,0,['ai','🤖','Hỏi AI']);
NAV.gv.splice(NAV.gv.length-1,0,['ai','🤖','Trợ lý AI']);
const _pgHs8=PAGES.hs,_pgGv8=PAGES.gv;
PAGES.hs=async()=>{if(tab=='ai')return aiPage();return _pgHs8()};
PAGES.gv=async()=>{if(tab=='ai')return aiPage();return _pgGv8()};

let AI_LOG=null,AI_MODE='explain',AI_BUSY=false,AI_T='chat';
const aiKey=()=>'aiLog:'+me.id;
const aiLog=()=>AI_LOG&&AI_LOG.uid==me.id?AI_LOG.list:(AI_LOG={uid:me.id,list:(()=>{try{return JSON.parse(sessionStorage.getItem(aiKey())||'[]')}catch{return[]}})()}).list;
const aiSave=()=>{try{sessionStorage.setItem(aiKey(),JSON.stringify(aiLog().slice(-40)))}catch{}};
/* chuyển đoạn trả lời của AI (markdown đơn giản) sang HTML an toàn */
function aiMd(t){
  const inl=x=>esc(x).replace(/`([^`]+)`/g,'<code>$1</code>').replace(/\*\*([^*]+)\*\*/g,'<b>$1</b>').replace(/(^|[\s(])\*([^*\s][^*]*)\*/g,'$1<i>$2</i>');
  const out=[];let list=null,code=null;
  const close=()=>{if(list){out.push(`</${list}>`);list=null}};
  for(const raw of String(t).split('\n')){
    if(/^```/.test(raw.trim())){if(code===null){close();code=[]}else{out.push('<pre>'+esc(code.join('\n'))+'</pre>');code=null}continue}
    if(code!==null){code.push(raw);continue}
    const l=raw.trim(),ul=l.match(/^[-*•]\s+(.*)/),ol=l.match(/^\d+[.)]\s+(.*)/),h=l.match(/^#{1,4}\s+(.*)/);
    if(ul||ol){const k=ul?'ul':'ol';if(list!=k){close();out.push(`<${k}>`);list=k}out.push('<li>'+inl((ul||ol)[1])+'</li>');continue}
    close();
    if(h)out.push('<h5>'+inl(h[1])+'</h5>');else if(l)out.push('<p>'+inl(l)+'</p>');
  }
  if(code!==null)out.push('<pre>'+esc(code.join('\n'))+'</pre>');close();
  return out.join('');
}
const aiBubble=(m,i)=>m.role=='user'?`<div class="aimsg user"><div class="aib">${esc(m.text).replace(/\n/g,'<br>')}</div></div>`
  :`<div class="aimsg ai"><div class="aiav sm">🤖</div><div class="aib">${m.text.startsWith('⚠')?`<p class="aierr">${esc(m.text)}</p>`:aiMd(m.text)}${m.text.startsWith('⚠')?'':`<button class="aicp" title="Sao chép" onclick="aiCopy(${i})">📋 Sao chép</button>`}</div></div>`;
const AI_SUG={
  hs:['Giải thích định luật Ôm bằng ví dụ dễ hiểu','Tóm tắt nguyên nhân dẫn đến Chiến tranh thế giới thứ nhất','Cách giải phương trình bậc hai, có ví dụ','Phân biệt "its" và "it\'s" trong tiếng Anh'],
  gv:['Gợi ý hoạt động khởi động 5 phút cho tiết Toán lớp 10','Cách giải thích phân số cho học sinh yếu','Soạn rubric chấm bài văn nghị luận 10 điểm','Gợi ý 5 câu hỏi thảo luận cho bài Quang hợp']};
window.aiPick=i=>askAI(AI_SUG[me.role][i]);
const aiWelcome=()=>`<div class="aiwel"><div class="aiav big">🤖</div><h4>${me.role=='gv'?'Trợ lý giảng dạy':'Xin chào, mình là trợ lý ôn tập!'}</h4><p>${me.role=='gv'?'Hỏi mình về giáo án, cách giải thích, bài tập và cách chấm.':'Bạn cứ hỏi bất cứ điều gì về bài học, mình sẽ giải thích thật dễ hiểu.'}</p><div class="aisug">${AI_SUG[me.role].map((t,i)=>`<button class="ghost" onclick="aiPick(${i})">${esc(t)}</button>`).join('')}</div></div>`;
const aiModes=[['explain','💡','Giải thích'],['summary','📝','Tóm tắt'],['example','🧩','Ví dụ'],['quiz','🎯','Luyện tập']];
window.aiMode=m=>{AI_MODE=m;document.querySelectorAll('.aimodes button').forEach(b=>b.classList.toggle('on',b.dataset.m==m));const ph={explain:'Nhập câu hỏi ôn tập...',summary:'Dán nội dung cần tóm tắt...',example:'Bạn muốn xem ví dụ về điều gì?',quiz:'Nhập chủ đề để mình đố bạn...'};$('#aiQ').placeholder=ph[m]};
function aiChatHTML(){
  const log=aiLog();
  return`<section class="card aichat"><div class="aihd"><div class="aiav">🤖</div><div style="flex:1"><b>${me.role=='gv'?'Trợ lý giảng dạy':'Trợ lý ôn tập'}</b><br><small>Luôn sẵn sàng · nhớ nội dung đang trò chuyện</small></div><button class="ghost" onclick="aiClear()">🗑 Cuộc mới</button></div>
${me.role=='hs'?`<div class="aimodes">${aiModes.map(([k,i,t])=>`<button class="ghost ${AI_MODE==k?'on':''}" data-m="${k}" onclick="aiMode('${k}')">${i} ${t}</button>`).join('')}</div>`:''}
<div id="aiChat">${log.length?log.map(aiBubble).join(''):aiWelcome()}</div>
<div class="aiin"><textarea id="aiQ" rows="1" maxlength="1000" placeholder="${me.role=='gv'?'Hỏi trợ lý về giảng dạy...':'Nhập câu hỏi ôn tập...'}" oninput="this.style.height='auto';this.style.height=Math.min(this.scrollHeight,120)+'px'" onkeydown="if(event.key=='Enter'&&!event.shiftKey){event.preventDefault();askAI()}"></textarea><button id="aiSend" onclick="askAI()" aria-label="Gửi">➤</button></div>
<small class="aihint">AI có thể nhầm lẫn, hãy kiểm tra lại với sách giáo khoa hoặc thầy cô.${me.role=='hs'?' Trợ lý tạm ngưng khi bạn đang làm bài kiểm tra.':''}</small></section>`;
}
const aiScroll=()=>{const c=$('#aiChat');if(c)c.scrollTop=c.scrollHeight};
window.aiCopy=async i=>{try{await navigator.clipboard.writeText(aiLog()[i].text);toast('Đã sao chép')}catch{toast('Trình duyệt không cho sao chép tự động')}};
window.aiClear=()=>{AI_LOG={uid:me.id,list:[]};aiSave();$('#aiChat').innerHTML=aiWelcome()};
window.askAI=async txt=>{
  const inp=$('#aiQ');if(!inp||AI_BUSY)return;
  const q=String(typeof txt=='string'?txt:inp.value).trim();if(!q)return;
  const log=aiLog(),box=$('#aiChat'),btn=$('#aiSend');
  AI_BUSY=true;btn.disabled=true;inp.value='';inp.style.height='auto';
  const history=log.slice(-10);
  if(!log.length)box.innerHTML='';
  log.push({role:'user',text:q});box.insertAdjacentHTML('beforeend',aiBubble(log[log.length-1],log.length-1));
  box.insertAdjacentHTML('beforeend','<div class="aimsg ai" id="aiTyping"><div class="aiav sm">🤖</div><div class="aib"><span class="dots"><i></i><i></i><i></i></span></div></div>');aiScroll();
  let text;
  try{text=(await api('/ai/ask','POST',{question:q,history,mode:AI_MODE})).answer||'⚠ Trợ lý chưa trả lời được, hãy thử lại.'}
  catch(e){text='⚠ '+(e.message||'Không gửi được câu hỏi')}
  const t=$('#aiTyping');if(t)t.remove();
  if(!$('#aiChat'))return;                                   // đã chuyển sang trang khác trong lúc chờ
  log.push({role:'ai',text});aiSave();
  box.insertAdjacentHTML('beforeend',aiBubble(log[log.length-1],log.length-1));aiScroll();
  AI_BUSY=false;btn.disabled=false;inp.focus();
};
const aiOffBanner=s=>s.enabled?'':`<section class="card aioff">🔌 <b>Trợ lý AI chưa được bật.</b> ${me.role=='gv'?'Nhờ quản trị viên cấu hình khóa API trên máy chủ':'Hãy báo thầy cô hoặc quản trị viên để bật tính năng này'}.</section>`;
async function aiPage(){
  let s={enabled:true};try{s=await api('/ai/status')}catch{}
  setTimeout(aiScroll,0);
  if(me.role=='hs')return`<h3>🤖 Trợ lý ôn tập AI</h3>${aiOffBanner(s)}${aiChatHTML()}`;
  const T=[['chat','💬','Trò chuyện'],['gen','✍️','Soạn câu hỏi'],['rem','📝','Nhận xét học sinh'],['ann','📢','Soạn thông báo']];
  const body=AI_T=='gen'?aiGenHTML():AI_T=='rem'?aiRemHTML():AI_T=='ann'?await aiAnnHTML():aiChatHTML();
  return`<h3>🤖 Trợ lý AI cho giáo viên</h3>${aiOffBanner(s)}<div class="aitabs">${T.map(([k,i,t])=>`<button class="ghost ${AI_T==k?'on':''}" onclick="aiTab('${k}')">${i} ${t}</button>`).join('')}</div>${body}`;
}
window.aiTab=k=>{AI_T=k;render()};
const aiCopyText=t=>{try{navigator.clipboard.writeText(t);toast('Đã sao chép')}catch{toast('Trình duyệt không cho sao chép tự động')}};

/* ----- giáo viên: soạn câu hỏi ----- */
let AI_F={text:'',topic:'',n:5,kind:'mc',level:'medium'},AI_GEN=[];
const aiKindName={mc:'Trắc nghiệm',tf:'Đúng / Sai',essay:'Tự luận'};
function aiGenHTML(){
  const opt=(o,v)=>o.map(([k,t])=>`<option value="${k}" ${v==k?'selected':''}>${t}</option>`).join('');
  return`<section class="card"><p><small>Dán nội dung bài học (hoặc chỉ nhập chủ đề), chọn loại câu và mức độ. Các câu AI soạn là bản nháp — bạn xem lại rồi mới thêm vào bài.</small></p>
<textarea rows="6" placeholder="Dán nội dung bài học vào đây..." oninput="AI_F.text=this.value">${esc(AI_F.text)}</textarea>
<div class="row"><input placeholder="…hoặc nhập chủ đề, ví dụ: Phương trình bậc hai" value="${esc(AI_F.topic)}" oninput="AI_F.topic=this.value" style="flex:1;min-width:220px"></div>
<div class="row"><select onchange="AI_F.kind=this.value">${opt([['mc','Trắc nghiệm'],['tf','Đúng / Sai'],['essay','Tự luận']],AI_F.kind)}</select>
<select onchange="AI_F.level=this.value">${opt([['easy','Mức dễ'],['medium','Mức vừa'],['hard','Mức khó']],AI_F.level)}</select>
<input type="number" min="1" max="15" value="${AI_F.n}" style="width:80px" oninput="AI_F.n=+this.value||5"><span>câu</span>
<button id="aiGenBtn" onclick="aiGenerate()">✨ Soạn câu hỏi</button></div></section>
${AI_GEN.length?`<h4>Kết quả (${AI_GEN.length} câu)</h4>${AI_GEN.map((x,i)=>`<section class="card aiq"><label class="aiqh"><input type="checkbox" class="aiSel" data-i="${i}" checked><b>Câu ${i+1}</b> <span class="tag">${aiKindName[x.type]}</span></label><p>${esc(x.content)}</p>
${x.type=='mc'?`<ol type="A" class="aiopts">${x.options.map((o,k)=>`<li class="${k==x.answer?'ok':''}">${esc(o)}${k==x.answer?' ✓':''}</li>`).join('')}</ol>`:''}
${x.type=='tf'?`<ul class="aiopts">${x.options.map((o,k)=>`<li>${'abcd'[k]}) ${esc(o)} — <b class="${x.key[k]=='D'?'okt':'bad'}">${x.key[k]=='D'?'Đúng':'Sai'}</b></li>`).join('')}</ul>`:''}
${x.type=='essay'&&x.model?`<p class="aimodel"><b>Đáp án gợi ý:</b> ${esc(x.model)}</p>`:''}</section>`).join('')}
<div class="row"><button onclick="aiAddQs()">➕ Thêm các câu đã chọn vào bài đang soạn</button><button class="ghost" onclick="aiGenerate()">🔄 Soạn lại</button></div>`:''}`;
}
window.aiGenerate=async()=>{
  const btn=$('#aiGenBtn');
  if(AI_F.text.trim().length<30&&AI_F.topic.trim().length<3)return toast('Dán nội dung bài học hoặc nhập chủ đề để AI soạn câu hỏi');
  document.querySelectorAll('#aiGenBtn').forEach(b=>{b.disabled=true;b.textContent='⏳ AI đang soạn...'});
  try{AI_GEN=await api('/ai/generate-questions','POST',{text:AI_F.text,topic:AI_F.topic,count:AI_F.n,kind:AI_F.kind,level:AI_F.level})}
  catch(e){toast(e.message||'AI chưa soạn được')}
  render();
};
window.aiAddQs=()=>{
  const pick=[...document.querySelectorAll('.aiSel:checked')].map(c=>AI_GEN[+c.dataset.i]);
  if(!pick.length)return toast('Hãy tick ít nhất một câu');
  pick.forEach(x=>qb.push({...newQ(x.type),...x,options:x.options.length?x.options:['','','',''],warn:['Do AI soạn — hãy kiểm tra lại đáp án trước khi giao bài']}));
  AI_GEN=[];toast(`Đã thêm ${pick.length} câu vào bài đang soạn — hãy kiểm tra lại trước khi giao`);tab='new';render();
};

/* ----- giáo viên: nhận xét học sinh ----- */
let AI_R={name:'',notes:'',tone:'warm',out:''};
const aiTones=[['warm','Ấm áp, động viên'],['encourage','Khích lệ mạnh'],['serious','Nghiêm túc, thẳng thắn'],['concise','Rất ngắn gọn']];
function aiRemHTML(){
  return`<section class="card"><p><small>Ghi vài ý ngắn về học sinh, AI sẽ viết thành đoạn nhận xét hoàn chỉnh. Bạn có thể sửa lại rồi dán vào sổ điểm.</small></p>
<div class="row"><input placeholder="Tên học sinh (không bắt buộc)" value="${esc(AI_R.name)}" oninput="AI_R.name=this.value" style="flex:1;min-width:200px"><select onchange="AI_R.tone=this.value">${aiTones.map(([k,t])=>`<option value="${k}" ${AI_R.tone==k?'selected':''}>${t}</option>`).join('')}</select></div>
<textarea rows="3" placeholder="Ghi chú, ví dụ: tiến bộ môn Toán, hay quên bài tập, hòa đồng với bạn bè" oninput="AI_R.notes=this.value">${esc(AI_R.notes)}</textarea>
<div class="row"><button id="aiRemBtn" onclick="aiRemWrite()">✨ Viết nhận xét</button></div></section>
${AI_R.out?`<section class="card aiout"><b>Nhận xét gợi ý</b><textarea id="aiRemOut" rows="4" oninput="AI_R.out=this.value">${esc(AI_R.out)}</textarea><div class="row"><button class="ghost" onclick="aiCopyText($('#aiRemOut').value)">📋 Sao chép</button><button class="ghost" onclick="aiRemWrite()">🔄 Viết lại</button></div></section>`:''}`;
}
window.aiRemWrite=async()=>{
  if(!AI_R.notes.trim())return toast('Nhập ghi chú ngắn để AI viết nhận xét');
  document.querySelectorAll('#aiRemBtn').forEach(b=>{b.disabled=true;b.textContent='⏳ Đang viết...'});
  try{AI_R.out=(await api('/ai/remark-suggest','POST',{name:AI_R.name,notes:AI_R.notes,tone:AI_R.tone})).suggestion}catch(e){toast(e.message||'AI chưa viết được')}
  render();
};

/* ----- giáo viên: soạn thông báo cho lớp (có thể đăng thẳng) ----- */
let AI_A={topic:'',tone:'warm',out:'',cls:''};
async function aiAnnHTML(){
  const cs=await api('/classes');
  return`<section class="card"><p><small>Ghi nội dung chính (việc gì, khi nào, ở đâu, cần chuẩn bị gì). AI sẽ viết thành thông báo gọn gàng, bạn xem lại rồi đăng cho lớp.</small></p>
<textarea rows="3" placeholder="Ví dụ: Thứ Sáu 22/11 kiểm tra 15 phút môn Toán chương 2, mang máy tính cầm tay" oninput="AI_A.topic=this.value">${esc(AI_A.topic)}</textarea>
<div class="row"><select onchange="AI_A.tone=this.value">${aiTones.map(([k,t])=>`<option value="${k}" ${AI_A.tone==k?'selected':''}>${t}</option>`).join('')}</select><button id="aiAnnBtn" onclick="aiAnnWrite()">✨ Soạn thông báo</button></div></section>
${AI_A.out?`<section class="card aiout"><b>Thông báo gợi ý</b><textarea id="aiAnnOut" rows="5" oninput="AI_A.out=this.value">${esc(AI_A.out)}</textarea>
<div class="row"><select id="aiAnnCls" onchange="AI_A.cls=this.value"><option value="">— Chọn lớp để đăng —</option>${cs.map(c=>`<option value="${c.id}" ${AI_A.cls==c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select><button onclick="aiAnnPost()">📢 Đăng cho lớp</button><button class="ghost" onclick="aiCopyText($('#aiAnnOut').value)">📋 Sao chép</button><button class="ghost" onclick="aiAnnWrite()">🔄 Viết lại</button></div></section>`:''}`;
}
window.aiAnnWrite=async()=>{
  if(AI_A.topic.trim().length<5)return toast('Nhập nội dung chính cần thông báo');
  document.querySelectorAll('#aiAnnBtn').forEach(b=>{b.disabled=true;b.textContent='⏳ Đang soạn...'});
  try{AI_A.out=(await api('/ai/announce-draft','POST',{topic:AI_A.topic,tone:AI_A.tone})).text}catch(e){toast(e.message||'AI chưa soạn được')}
  render();
};
window.aiAnnPost=async()=>{
  const cls=$('#aiAnnCls').value,content=$('#aiAnnOut').value.trim();
  if(!cls)return toast('Chọn lớp cần đăng thông báo');if(!content)return;
  try{await api('/announcements','POST',{class_id:+cls,content});toast('Đã đăng thông báo cho lớp');AI_A={topic:'',tone:AI_A.tone,out:'',cls:''};render()}catch(e){toast(e.message||'Không đăng được')}
};

/* ---------- HỌC SINH: dự đoán điểm khi nộp bài kiểm tra ---------- */
const _askSubmit8=window.askSubmit;
window.askSubmit=()=>{
  _askSubmit8();
  if(cur&&cur.mode=='exam'){
    const m=$('#modal');
    m.innerHTML=m.innerHTML.replace('<div class="sbtns">',
      '<div class="predict"><label for="predIn">🔮 Trước khi biết điểm, bạn đoán mình được bao nhiêu?</label><input id="predIn" type="number" min="0" max="10" step="0.5" placeholder="0–10 (có thể bỏ trống)"></div><div class="sbtns">');
  }
};
window.submit=run(async()=>{
  const c=cur,predEl=$('#predIn'),predicted=predEl&&predEl.value!==''?+predEl.value:null;
  if(!c||c.ending)return;c.ending=true;clearInterval(timer);
  try{
    const body={answers:c.ans};if(predicted!=null&&!Number.isNaN(predicted))body.predicted=predicted;
    const d=await api(`/attempts/${c.attempt}/submit`,'POST',body);
    done={...d,title:c.title};try{localStorage.removeItem('draft:'+c.attempt)}catch{}clearInterval(window._svI);rvTab=null;cur=null;exitFs();render();
  }catch(e){c.ending=false;timer=setInterval(tick,1000);throw e}
});

/* ---------- HỌC SINH: dự đoán điểm & chuỗi ngày học (gắn vào hồ sơ) ---------- */
const _loadProfileMore8=loadProfileMore;
loadProfileMore=async function(){
  await _loadProfileMore8();
  try{
    const[ps,st]=await Promise.all([api('/predict-stats'),api('/streak')]);
    const extra=`<section class="card"><h3>🔥 Chuỗi ngày học</h3><p>${st.streak>0?`Bạn đang duy trì <b>${st.streak} ngày</b> liên tục làm bài!${st.today?' Hôm nay đã tính rồi 🎉':' Làm 1 bài hôm nay để tiếp tục chuỗi nhé.'}`:'Chưa có chuỗi ngày học nào. Làm một bài hôm nay để bắt đầu!'}</p></section>
${ps.count?`<section class="card"><h3>🔮 Độ chính xác dự đoán điểm</h3><p>Qua ${ps.count} bài gần nhất, bạn dự đoán lệch trung bình <b>${ps.avgDiff}</b> điểm so với điểm thật.${ps.last?` Lần gần nhất: dự đoán <b>${ps.last.predicted}</b>, đạt <b>${ps.last.score}</b>.`:''}</p></section>`:''}`;
    const el=document.getElementById('pmore');if(el)el.innerHTML+=extra;
  }catch(e){}
};
