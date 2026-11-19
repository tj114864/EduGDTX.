// Chức năng mở rộng (phần 7 backend) — Trợ lý AI (3 tính năng) + 2 tính năng chưa nơi nào có:
// dự đoán điểm trước khi nộp bài · chuỗi ngày học liên tục
module.exports=({app,auth,fail,db,askAI})=>{
  const aiErr=(r,e)=>fail(r,e.code||500,e.message||'Lỗi không xác định khi gọi AI');
  const MODEL=process.env.ANTHROPIC_MODEL||'claude-sonnet-5-5';
  db.exec('CREATE TABLE IF NOT EXISTS ai_usage(id INTEGER PRIMARY KEY,user_id INTEGER NOT NULL,role TEXT,kind TEXT,created_at INTEGER NOT NULL)');
  db.exec('CREATE INDEX IF NOT EXISTS ai_usage_u ON ai_usage(user_id,created_at)');
  /* giới hạn số lượt / giờ để tránh tốn phí ngoài ý muốn: học sinh 30, giáo viên 60 */
  const CAP={hs:30,gv:60};
  const gate=(q,r,kind)=>{
    const cap=CAP[q.user.role]||30,n=db.prepare('SELECT COUNT(*) c FROM ai_usage WHERE user_id=? AND created_at>?').get(q.user.id,Date.now()-3600000).c;
    if(n>=cap){fail(r,429,`Bạn đã dùng hết ${cap} lượt hỏi AI trong 1 giờ qua. Hãy nghỉ một lát rồi quay lại nhé.`);return false}
    db.prepare('INSERT INTO ai_usage(user_id,role,kind,created_at) VALUES(?,?,?,?)').run(q.user.id,q.user.role,kind,Date.now());return true;
  };
  app.get('/api/ai/status',auth(),(q,r)=>{
    const out={enabled:!!process.env.ANTHROPIC_API_KEY};
    if(q.user.role=='admin'){
      const c=t=>db.prepare('SELECT COUNT(*) c FROM ai_usage WHERE created_at>?').get(t).c,d0=new Date();d0.setHours(0,0,0,0);
      Object.assign(out,{model:MODEL,today:c(d0.getTime()),week:c(Date.now()-7*864e5),
        hs:db.prepare("SELECT COUNT(*) c FROM ai_usage WHERE role='hs' AND created_at>?").get(Date.now()-7*864e5).c,
        gv:db.prepare("SELECT COUNT(*) c FROM ai_usage WHERE role='gv' AND created_at>?").get(Date.now()-7*864e5).c});
    }
    r.json(out);
  });

  /* ================= TRỢ LÝ AI: trò chuyện (học sinh & giáo viên), có nhớ ngữ cảnh ================= */
  const FMT='Định dạng: tiếng Việt, câu ngắn; dùng **in đậm** cho ý chính, gạch đầu dòng "- " cho danh sách, đánh số "1." cho các bước. KHÔNG dùng bảng. Công thức toán/lý/hóa viết bằng LaTeX đặt trong dấu đô la: $x^2$, $\\frac{a}{b}$, $\\sqrt{x}$, $\\Delta=b^2-4ac$; công thức dài đặt riêng một dòng trong $$ ... $$. Không dùng \\( \\) hay \\[ \\].';
  const HS_BASE='Bạn là "Trợ lý ôn tập" của EduGDTX, giúp học sinh một trung tâm GDNN-GDTX ở Việt Nam (trình độ THPT, nhiều bạn vừa đi làm vừa học). Xưng "mình", gọi học sinh là "bạn", giọng thân thiện, khích lệ. Chỉ hỗ trợ học tập và kiến thức chung; không làm hộ bài kiểm tra; khi bạn nhờ giải bài tập thì hướng dẫn từng bước để bạn tự hiểu thay vì chỉ đưa đáp án. Nếu không chắc chắn thì nói thẳng là không chắc. Nếu câu hỏi không liên quan đến học tập, nhẹ nhàng đưa bạn về chủ đề học. '+FMT;
  const HS_MODE={
    explain:'',
    summary:' Chế độ TÓM TẮT: gom nội dung thành tối đa 6 ý chính dễ nhớ và thêm một mẹo ghi nhớ nếu có.',
    example:' Chế độ VÍ DỤ: đưa 2 ví dụ cụ thể, gần gũi đời sống, kèm lời giải ngắn.',
    quiz:' Chế độ LUYỆN TẬP: hãy đố bạn học sinh. Mỗi lượt CHỈ đưa MỘT câu hỏi ngắn (có thể trắc nghiệm A-D) về chủ đề bạn ấy nêu rồi chờ trả lời. Khi bạn trả lời, nhận xét đúng/sai, giải thích ngắn rồi đưa câu tiếp theo.'};
  const GV_BASE='Bạn là trợ lý của giáo viên tại một trung tâm GDNN-GDTX ở Việt Nam. Hỗ trợ soạn giáo án, ý tưởng hoạt động trên lớp, cách giải thích dễ hiểu cho học sinh yếu, gợi ý bài tập và rubric chấm. Trả lời thực tế, súc tích, có thể áp dụng ngay. '+FMT;
  app.post('/api/ai/ask',auth('hs','gv'),async(q,r)=>{
    if(q.user.role=='hs'){
      const doing=db.prepare(`SELECT 1 FROM attempts a JOIN exams e ON e.id=a.exam_id WHERE a.user_id=? AND a.submitted_at IS NULL AND e.mode='exam' LIMIT 1`).get(q.user.id);
      if(doing)return fail(r,403,'Không thể dùng trợ lý AI khi đang làm bài kiểm tra.');
    }
    const question=String(q.body.question||'').trim().slice(0,1000);if(!question)return fail(r,400,'Nhập câu hỏi cho trợ lý AI');
    const msgs=[];
    for(const m of (Array.isArray(q.body.history)?q.body.history:[]).slice(-10)){
      if(!m||typeof m.text!='string'||m.text.startsWith('⚠'))continue;
      const x={role:m.role=='user'?'user':'assistant',content:m.text.slice(0,1500)};
      if(msgs.length&&msgs[msgs.length-1].role==x.role)msgs[msgs.length-1]=x;else msgs.push(x);
    }
    while(msgs.length&&msgs[0].role!='user')msgs.shift();
    if(msgs.length&&msgs[msgs.length-1].role=='user')msgs.pop();
    msgs.push({role:'user',content:question});
    const system=q.user.role=='gv'?GV_BASE:HS_BASE+(HS_MODE[q.body.mode]||'');
    if(!gate(q,r,'chat'))return;
    try{r.json({answer:await askAI(system,msgs,900)})}catch(e){aiErr(r,e)}
  });

  /* ================= GIÁO VIÊN: nhận xét học sinh ================= */
  const TONE={warm:'ấm áp, động viên',serious:'nghiêm túc, thẳng thắn nhưng lịch sự',encourage:'khích lệ mạnh, nhấn vào điểm tiến bộ',concise:'rất ngắn gọn (1-2 câu)'};
  app.post('/api/ai/remark-suggest',auth('gv'),async(q,r)=>{
    const name=String(q.body.name||'').trim().slice(0,100),notes=String(q.body.notes||'').trim().slice(0,500),tone=TONE[q.body.tone]||TONE.warm;
    if(!notes)return fail(r,400,'Nhập vài ghi chú ngắn về học sinh để AI gợi ý');
    if(!gate(q,r,'remark'))return;
    try{
      const text=await askAI(`Bạn giúp giáo viên Việt Nam viết nhận xét học sinh (2-3 câu), mang tính xây dựng, giọng ${tone}, dựa đúng vào ghi chú của giáo viên, không bịa thêm sự việc. Chỉ trả về đúng đoạn nhận xét, không thêm lời dẫn, không dùng định dạng markdown.`,
        `Học sinh: ${name||'(chưa rõ tên)'}\nGhi chú của giáo viên: ${notes}`,350);
      r.json({suggestion:text});
    }catch(e){aiErr(r,e)}
  });

  /* ================= GIÁO VIÊN: soạn thông báo cho lớp ================= */
  app.post('/api/ai/announce-draft',auth('gv'),async(q,r)=>{
    const topic=String(q.body.topic||'').trim().slice(0,400),tone=TONE[q.body.tone]||TONE.warm;
    if(topic.length<5)return fail(r,400,'Nhập nội dung chính cần thông báo (ngày giờ, việc cần làm...)');
    if(!gate(q,r,'announce'))return;
    try{
      const text=await askAI(`Bạn giúp giáo viên Việt Nam soạn thông báo gửi lớp học: rõ ràng, đủ thông tin (việc gì, khi nào, ở đâu, cần chuẩn bị gì nếu có), giọng ${tone}, tối đa 6 câu. Chỉ dùng thông tin giáo viên đưa, không tự thêm ngày giờ hay địa điểm. Chỉ trả về nội dung thông báo, văn bản thuần, không markdown.`,topic,450);
      r.json({text});
    }catch(e){aiErr(r,e)}
  });

  /* ================= GIÁO VIÊN: soạn câu hỏi (trắc nghiệm / đúng-sai / tự luận) ================= */
  const LEVEL={easy:'dễ (nhận biết – thông hiểu)',medium:'vừa (thông hiểu – vận dụng)',hard:'khó (vận dụng – vận dụng cao)'};
  /* đọc JSON do AI trả về, chịu được công thức LaTeX bị viết sai dấu gạch chéo (\frac, \sqrt, \times...) */
  const parseQJson=out=>{
    const i=out.indexOf('['),j=out.lastIndexOf(']'),raw=out.slice(i,j+1);
    const fixCtl=v=>typeof v=='string'?v.replace(/\x0c/g,'\\f').replace(/\x08/g,'\\b').replace(/\t(?=(imes|heta|ext|au|an|riangle|o\b))/g,'\\t').replace(/\r(?=(ightarrow|ho|angle))/g,'\\r'):Array.isArray(v)?v.map(fixCtl):v&&typeof v=='object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,fixCtl(x)])):v;
    try{return fixCtl(JSON.parse(raw))}
    catch(e){return fixCtl(JSON.parse(raw.replace(/\\(?!["\\\/]|u[0-9a-fA-F]{4})/g,'\\\\')))}
  };
  const strip=o=>String(o).replace(/^\s*[A-Da-d][.)]\s+/,'').slice(0,200);
  app.post('/api/ai/generate-questions',auth('gv'),async(q,r)=>{
    const text=String(q.body.text||'').trim().slice(0,6000),topic=String(q.body.topic||'').trim().slice(0,200),count=Math.min(Math.max(+q.body.count||5,1),15);
    const kind=['mc','tf','essay'].includes(q.body.kind)?q.body.kind:'mc',level=LEVEL[q.body.level]||LEVEL.medium;
    if(text.length<30&&topic.length<3)return fail(r,400,'Dán một đoạn nội dung bài học (hoặc nhập chủ đề) để AI soạn câu hỏi');
    const src=text.length>=30?`nội dung sau:\n\n${text}`:`chủ đề: ${topic} (theo chương trình GDTX Việt Nam)`;
    const SHAPE={
      mc:{sys:'Mỗi phần tử: {"content":"...","options":["...","...","...","..."],"answer":0}. "options" gồm đúng 4 đáp án KHÔNG kèm chữ A/B/C/D ở đầu, chỉ MỘT đáp án đúng, các đáp án sai phải hợp lý, không dùng "tất cả các đáp án trên". "answer" là chỉ số 0-3 của đáp án đúng; hãy phân bố đáp án đúng ngẫu nhiên giữa các vị trí.',ask:`${count} câu trắc nghiệm (4 đáp án mỗi câu)`},
      tf:{sys:'Mỗi phần tử: {"content":"câu dẫn / ngữ cảnh chung","statements":["ý a","ý b","ý c","ý d"],"key":"DSDS"}. "statements" gồm đúng 4 phát biểu, trộn lẫn đúng và sai. "key" gồm đúng 4 ký tự, mỗi ký tự là D (phát biểu đúng) hoặc S (phát biểu sai), theo đúng thứ tự các phát biểu.',ask:`${count} câu đúng/sai (mỗi câu 4 ý a, b, c, d)`},
      essay:{sys:'Mỗi phần tử: {"content":"đề bài","model":"đáp án gợi ý và thang điểm ngắn gọn"}.',ask:`${count} câu tự luận`}}[kind];
    if(!gate(q,r,'questions'))return;
    try{
      const out=await askAI(`Bạn soạn câu hỏi kiểm tra bằng tiếng Việt cho giáo viên, mức độ ${level}, bám sát nội dung được cung cấp, không bịa kiến thức ngoài nội dung. CHỈ trả lời bằng một mảng JSON hợp lệ, không thêm chữ nào khác, không dùng markdown code fence. Công thức toán/lý/hóa viết bằng LaTeX đặt trong dấu đô la, ví dụ $x^2-5x+6=0$ hoặc $\\frac{1}{2}$; vì là chuỗi JSON nên mỗi dấu gạch chéo ngược phải viết thành HAI dấu (ví dụ "$\\\\frac{1}{2}$"). ${SHAPE.sys}`,`Soạn đúng ${SHAPE.ask} từ ${src}`,3500);
      let qs;try{qs=parseQJson(out)}catch(e){return fail(r,502,'AI trả về dữ liệu không đọc được, hãy thử lại')}
      if(!Array.isArray(qs))return fail(r,502,'AI trả về dữ liệu không đúng định dạng');
      let clean=[];
      if(kind=='mc')clean=qs.filter(x=>x&&x.content&&Array.isArray(x.options)&&x.options.length==4&&Number.isInteger(x.answer)&&x.answer>=0&&x.answer<4)
        .map(x=>({type:'mc',content:String(x.content).slice(0,500),options:x.options.map(strip),answer:x.answer,points:1}));
      else if(kind=='tf')clean=qs.filter(x=>x&&x.content&&Array.isArray(x.statements)&&x.statements.length==4&&/^[DS]{4}$/.test(String(x.key||'').toUpperCase()))
        .map(x=>({type:'tf',content:String(x.content).slice(0,500),options:x.statements.map(s=>String(s).replace(/^\s*[a-d][.)]\s+/i,'').slice(0,300)),key:String(x.key).toUpperCase(),answer:0,points:1}));
      else clean=qs.filter(x=>x&&x.content).map(x=>({type:'essay',content:String(x.content).slice(0,800),options:[],answer:0,model:String(x.model||'').slice(0,1200),points:2}));
      if(!clean.length)return fail(r,502,'AI không tạo được câu hỏi hợp lệ nào, hãy thử lại với nội dung khác');
      r.json(clean);
    }catch(e){aiErr(r,e)}
  });

  /* ================= TÍNH NĂNG RIÊNG: dự đoán điểm & chuỗi ngày học ================= */
  app.get('/api/predict-stats',auth('hs'),(q,r)=>{
    const rows=db.prepare(`SELECT a.predicted,a.score FROM attempts a JOIN exams e ON e.id=a.exam_id WHERE a.user_id=? AND e.mode='exam' AND a.submitted_at IS NOT NULL AND a.predicted IS NOT NULL ORDER BY a.id DESC LIMIT 10`).all(q.user.id);
    if(!rows.length)return r.json({count:0});
    const diffs=rows.map(x=>Math.abs(x.predicted-x.score));
    r.json({count:rows.length,avgDiff:Math.round(diffs.reduce((a,b)=>a+b,0)/diffs.length*100)/100,last:rows[0]});
  });
  app.get('/api/streak',auth('hs'),(q,r)=>{
    const days=[...new Set(db.prepare(`SELECT submitted_at FROM attempts WHERE user_id=? AND submitted_at IS NOT NULL`).all(q.user.id)
      .map(x=>new Date(x.submitted_at).toISOString().slice(0,10)))].sort().reverse();
    if(!days.length)return r.json({streak:0,today:false});
    const DAY=86400000,today=new Date().toISOString().slice(0,10),todayDone=days[0]==today;
    let streak=0,cursor=new Date(todayDone?today:new Date(Date.now()-DAY).toISOString().slice(0,10));
    for(const d of days){const want=cursor.toISOString().slice(0,10);if(d==want){streak++;cursor=new Date(cursor.getTime()-DAY)}else if(d<want)break}
    r.json({streak:todayDone||days[0]==new Date(Date.now()-DAY).toISOString().slice(0,10)?streak:0,today:todayDone});
  });
};
