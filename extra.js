// Các chức năng mở rộng: nhập tài khoản hàng loạt, ngân hàng câu hỏi, tự lưu bài, giám sát trực tiếp, sổ tay lỗi
const xmlDec=t=>String(t).replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&');

// Đọc file Excel (.xlsx) đầu tiên → mảng các dòng (mỗi dòng là mảng ô)
async function xlsxToRows(buf){
  const Z=await require('jszip').loadAsync(buf);
  let ss=[];const sf=Z.file('xl/sharedStrings.xml');
  if(sf){const x=await sf.async('string');ss=[...x.matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m=>xmlDec([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(t=>t[1]).join('')))}
  const sn=Object.keys(Z.files).filter(n=>/^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort((a,b)=>parseInt(a.match(/\d+/g).pop())-parseInt(b.match(/\d+/g).pop()))[0];
  if(!sn)throw new Error('không thấy bảng tính');
  const x=await Z.file(sn).async('string'),rows=[];
  for(const rm of x.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)){
    const row=[];
    for(const cm of rm[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)){
      const at=cm[1],body=cm[2]||'',ref=(at.match(/\br="([A-Z]+)\d+"/)||[])[1],t=(at.match(/\bt="(\w+)"/)||[])[1];
      let v='';
      if(t=='s')v=ss[+((body.match(/<v>([\s\S]*?)<\/v>/)||[])[1])]||'';
      else if(t=='inlineStr')v=xmlDec([...body.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(m=>m[1]).join(''));
      else v=xmlDec((body.match(/<v>([\s\S]*?)<\/v>/)||[])[1]||'');
      const col=ref?ref.split('').reduce((a,c)=>a*26+c.charCodeAt(0)-64,0)-1:row.length;row[col]=v;
    }
    const out=Array.from(row,c=>c==null?'':String(c).trim());
    if(out.some(Boolean))rows.push(out);
  }
  return rows;
}

module.exports=({app,auth,fail,db,bcrypt,crypto,express,gradeAttempt,lockUser,cleanQ,parseJ})=>{
  const now=()=>Date.now();
  const strip=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D');
  const norm=s=>strip(s).toLowerCase().replace(/\s+/g,'');

  /* ================= ADMIN: nhập tài khoản hàng loạt ================= */
  app.post('/api/users/xlsx',auth('admin'),express.raw({type:'application/octet-stream',limit:'10mb'}),async(q,r)=>{
    try{r.json({rows:(await xlsxToRows(q.body)).slice(0,2000)})}catch(e){fail(r,400,'Không đọc được file Excel: '+e.message)}
  });
  // "Nguyễn Văn An" → annv (tên + chữ cái đầu họ/đệm)
  const baseUser=name=>{const w=strip(name).toLowerCase().replace(/[^a-z0-9\s]/g,'').split(/\s+/).filter(Boolean);return w.length?w[w.length-1]+w.slice(0,-1).map(x=>x[0]).join(''):'user'};
  app.post('/api/users/bulk',auth('admin'),(q,r)=>{
    const role=q.body.role=='gv'?'gv':'hs',rows=(Array.isArray(q.body.rows)?q.body.rows:[]).slice(0,60);
    const classes=db.prepare('SELECT id,name FROM classes').all(),byName=Object.fromEntries(classes.map(c=>[norm(c.name),c.id]));
    const ins=db.prepare('INSERT INTO users(username,password,name,role,class_id) VALUES(?,?,?,?,?)'),has=db.prepare('SELECT 1 FROM users WHERE username=?');
    const created=[],errors=[];
    rows.forEach((x,i)=>{
      const n=x.n??i+1,name=String(x.name||'').trim().replace(/\s+/g,' ');
      const err=m=>errors.push({row:n,name,error:m});
      if(!name)return err('Thiếu họ tên');
      let cid=null;
      if(role=='hs'){const k=norm(x.class||'');cid=k?byName[k]:(+q.body.class_id||null);if(k&&!cid)return err('Không có lớp "'+x.class+'"');if(!cid)return err('Chưa chọn lớp')}
      let u=String(x.username||'').trim().toLowerCase().replace(/[^a-z0-9._-]/g,'');
      if(u){if(has.get(u))return err('Tên đăng nhập "'+u+'" đã tồn tại')}
      else{const b=baseUser(name);u=b;for(let k=2;has.get(u);k++)u=b+k}
      const pw=String(x.password||'').trim()||('Edu'+crypto.randomInt(100000,999999));
      if(pw.length<6)return err('Mật khẩu phải từ 6 ký tự');
      try{ins.run(u,bcrypt.hashSync(pw,10),name,role,cid);created.push({name,username:u,password:pw,class:(classes.find(c=>c.id==cid)||{}).name||''})}
      catch(e){err('Không tạo được: '+e.message)}
    });
    if(created.length)db.logAct(q.user,'nhập tài khoản hàng loạt',`${created.length} ${role=='gv'?'giáo viên':'học sinh'}`+(errors.length?`, ${errors.length} dòng lỗi`:''));
    r.json({created,errors});
  });

  /* ================= GIÁO VIÊN: ngân hàng câu hỏi ================= */
  const bankRow=x=>({...x,options:JSON.parse(x.options||'[]')});
  app.get('/api/bank',auth('gv'),(q,r)=>{
    const rows=db.prepare('SELECT * FROM bank WHERE teacher_id=? ORDER BY id DESC').all(q.user.id).map(bankRow),tags={};
    rows.forEach(x=>{const t=x.tag||'';tags[t]=(tags[t]||0)+1});
    r.json({rows,tags:Object.entries(tags).map(([name,n])=>({name,n})).sort((a,b)=>a.name.localeCompare(b.name,'vi'))});
  });
  app.post('/api/bank',auth('gv'),(q,r)=>{
    const tag=String(q.body.tag||'').trim().slice(0,60),list=Array.isArray(q.body.questions)?q.body.questions.slice(0,500):[];
    const seen=new Set(db.prepare('SELECT type,content FROM bank WHERE teacher_id=?').all(q.user.id).map(x=>x.type+'|'+x.content));
    const ins=db.prepare('INSERT INTO bank(teacher_id,tag,type,content,options,answer,key,points,model,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)');
    let added=0,dup=0,bad=0;
    db.transaction(()=>{for(const x of list){
      const c=cleanQ(x);if(!c){bad++;continue}
      if(seen.has(c.type+'|'+c.content)){dup++;continue}
      seen.add(c.type+'|'+c.content);
      ins.run(q.user.id,String(x.tag??tag).trim().slice(0,60)||null,c.type,c.content,JSON.stringify(c.options),c.answer,c.key,c.points,c.model,now());added++}})();
    r.json({added,dup,bad});
  });
  app.put('/api/bank/:id',auth('gv'),(q,r)=>{db.prepare('UPDATE bank SET tag=? WHERE id=? AND teacher_id=?').run(String(q.body.tag||'').trim().slice(0,60)||null,q.params.id,q.user.id);r.json({ok:1})});
  app.delete('/api/bank/:id',auth('gv'),(q,r)=>{db.prepare('DELETE FROM bank WHERE id=? AND teacher_id=?').run(q.params.id,q.user.id);r.json({ok:1})});
  app.post('/api/bank/delete',auth('gv'),(q,r)=>{const d=db.prepare('DELETE FROM bank WHERE id=? AND teacher_id=?');(q.body.ids||[]).slice(0,500).forEach(id=>d.run(+id,q.user.id));r.json({ok:1})});

  /* ================= HỌC SINH: tự lưu bài đang làm ================= */
  app.post('/api/attempts/:id/save',auth('hs'),(q,r)=>{
    const at=db.prepare('SELECT * FROM attempts WHERE id=? AND user_id=?').get(q.params.id,q.user.id);
    if(!at||at.submitted_at)return r.json({closed:true});            // giáo viên đã thu bài / mở lại bài
    const e=db.prepare('SELECT * FROM exams WHERE id=?').get(at.exam_id);
    let draft=at.draft;const a=q.body.answers;
    if(a&&typeof a=='object'&&!Array.isArray(a)){const s=JSON.stringify(a);if(s.length<300000)draft=s}
    db.prepare('UPDATE attempts SET draft=?,last_seen=? WHERE id=?').run(draft,now(),at.id);
    r.json({saved:1,endsAt:at.started_at+(e.minutes+(at.extra_min||0))*60000});
  });

  /* ================= GIÁO VIÊN: giám sát trực tiếp ================= */
  const answered=(x,a)=>x.type=='mc'?Number.isInteger(a):x.type=='tf'?/[DS]/.test(a||''):!!(typeof a=='string'&&a.trim());
  const ownedExam=(id,uid)=>db.prepare('SELECT e.*,c.name AS class FROM exams e JOIN classes c ON c.id=e.class_id WHERE e.id=? AND e.teacher_id=?').get(id,uid);
  function liveData(e){
    const qs=db.prepare('SELECT id,type FROM questions WHERE exam_id=?').all(e.id),t=now();
    const rows=db.prepare("SELECT id,name,locked FROM users WHERE role='hs' AND class_id=? ORDER BY name").all(e.class_id).map(u=>{
      const a=db.prepare('SELECT * FROM attempts WHERE exam_id=? AND user_id=? ORDER BY (submitted_at IS NULL) DESC,id DESC LIMIT 1').get(e.id,u.id);
      const o={user_id:u.id,name:u.name,locked:!!u.locked,status:'none'};
      if(a){
        o.attempt_id=a.id;o.viol=a.violations||0;o.last_seen=a.last_seen||null;o.extra=a.extra_min||0;
        if(a.submitted_at){o.status='done';o.score=a.score;o.pending=!!a.pending;o.submitted_at=a.submitted_at}
        else{o.status='doing';const d=parseJ(a.draft);o.answered=qs.filter(x=>answered(x,d[x.id])).length;o.total=qs.length;
          o.left=Math.round((a.started_at+(e.minutes+(a.extra_min||0))*60000-t)/1000);o.online=!!a.last_seen&&t-a.last_seen<30000}
      }
      return o;
    });
    // nhật ký vi phạm mới nhất của cả bài (n = đây là lần vi phạm thứ mấy của học sinh trong lượt làm đó)
    const events=db.prepare(`SELECT v.id,v.at,v.kind,v.user_id,v.attempt_id,u.name,
        (SELECT COUNT(*) FROM violations w WHERE w.attempt_id=v.attempt_id AND w.id<=v.id) AS n
      FROM violations v JOIN attempts a ON a.id=v.attempt_id JOIN users u ON u.id=v.user_id
      WHERE a.exam_id=? ORDER BY v.id DESC LIMIT 80`).all(e.id);
    return {exam:{id:e.id,title:e.title,class:e.class,minutes:e.minutes,mode:e.mode,max:e.max_viol||3},now:t,rows,events};
  }
  /* Giám sát trực tiếp: trình duyệt giáo viên hỏi /live mỗi ~1.5 giây (HTTP thường → chạy qua mọi mạng, tunnel, proxy).
     Có cache ~0.8 giây để nhiều giáo viên / nhiều tab cùng xem 1 bài cũng không làm nặng máy chủ. */
  const liveCache=new Map();
  const liveCached=e=>{const c=liveCache.get(e.id),t=Date.now();if(c&&t-c.t<800)return c.d;const d=liveData(e);liveCache.set(e.id,{t,d});return d};
  app.locals.liveKick=()=>liveCache.clear();                 // có thay đổi (học sinh vào bài / nộp / vi phạm / giáo viên thao tác) → lần hỏi tiếp theo lấy dữ liệu mới ngay
  app.get('/api/exams/:id/live',auth('gv'),(q,r)=>{
    const e=ownedExam(q.params.id,q.user.id);if(!e)return fail(r,404,'Không có bài');
    r.set('Cache-Control','no-store');r.json(liveCached(e));
  });
  const ownAttempt=(q,r)=>{const a=db.prepare('SELECT a.* FROM attempts a JOIN exams e ON e.id=a.exam_id WHERE a.id=? AND e.teacher_id=?').get(q.params.id,q.user.id);if(!a){fail(r,404,'Không tìm thấy bài làm');return null}return a};
  app.post('/api/attempts/:id/extend',auth('gv'),(q,r)=>{
    const a=ownAttempt(q,r);if(!a)return;if(a.submitted_at)return fail(r,400,'Bài đã nộp');
    const m=Math.min(Math.max(Math.round(+q.body.minutes||0),1),120);
    db.prepare('UPDATE attempts SET extra_min=COALESCE(extra_min,0)+? WHERE id=?').run(m,a.id);r.json({ok:1,minutes:m});
  });
  app.post('/api/attempts/:id/force-submit',auth('gv'),(q,r)=>{
    const a=ownAttempt(q,r);if(!a)return;if(a.submitted_at)return fail(r,400,'Bài đã nộp');
    const e=db.prepare('SELECT * FROM exams WHERE id=?').get(a.exam_id);
    gradeAttempt(a,e,parseJ(a.draft),true);r.json({ok:1});
  });
  app.post('/api/attempts/:id/reopen',auth('gv'),(q,r)=>{       // cho làm lại: xóa bài đã nộp của học sinh này
    const a=ownAttempt(q,r);if(!a)return;
    db.prepare('DELETE FROM attempts WHERE id=?').run(a.id);r.json({ok:1});
  });
  app.post('/api/students/:id/unlock',auth('gv'),(q,r)=>{
    const c=db.prepare("UPDATE users SET locked=0,lock_reason=NULL WHERE id=? AND role='hs'").run(q.params.id);
    if(!c.changes)return fail(r,404,'Không tìm thấy học sinh');r.json({ok:1});
  });

  /* ================= HỌC SINH: sổ tay lỗi ================= */
  // Chỉ gồm câu sai ở bài ôn tập, hoặc bài kiểm tra mà giáo viên cho phép xem đáp án (show_answer)
  function myMistakes(uid){
    const rows=db.prepare(`SELECT q.id,q.type,q.content,q.options,q.answer,q.key,q.model,q.points,e.title,e.mode,e.show_answer,an.picked,an.text,an.earned,a.submitted_at
      FROM answers an JOIN attempts a ON a.id=an.attempt_id JOIN questions q ON q.id=an.question_id JOIN exams e ON e.id=a.exam_id
      WHERE a.user_id=? AND a.submitted_at IS NOT NULL AND q.type!='essay' AND (an.earned IS NULL OR an.earned<q.points)
        AND a.id=(SELECT MAX(a2.id) FROM attempts a2 JOIN answers n2 ON n2.attempt_id=a2.id WHERE a2.user_id=a.user_id AND n2.question_id=q.id AND a2.submitted_at IS NOT NULL)
        AND NOT EXISTS(SELECT 1 FROM mistakes m WHERE m.user_id=a.user_id AND m.question_id=q.id AND m.cleared_at>a.submitted_at)
      ORDER BY a.submitted_at DESC`).all(uid);
    return rows.filter(x=>x.mode=='practice'||x.show_answer).map(x=>({...x,options:JSON.parse(x.options)}));
  }
  app.get('/api/mistakes',auth('hs'),(q,r)=>{const items=myMistakes(q.user.id);r.json({count:items.length,items})});
  app.post('/api/mistakes/start',auth('hs'),(q,r)=>{
    let items=myMistakes(q.user.id);const n=Math.min(Math.max(+q.body.n||10,1),50);
    for(let i=items.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[items[i],items[j]]=[items[j],items[i]]}
    r.json({questions:items.slice(0,n).map(x=>({id:x.id,type:x.type,content:x.content,options:x.options,title:x.title}))});
  });
  app.post('/api/mistakes/check',auth('hs'),(q,r)=>{
    const ans=q.body.answers&&typeof q.body.answers=='object'?q.body.answers:{},ok=new Map(myMistakes(q.user.id).map(x=>[x.id,x])),out=[];
    const clear=db.prepare('INSERT OR REPLACE INTO mistakes(user_id,question_id,cleared_at) VALUES(?,?,?)');
    for(const [id,x] of ok){
      if(!(id in ans))continue;const a=ans[id];
      const good=x.type=='tf'?(typeof a=='string'&&a.length==4&&a==x.key):a===x.answer;
      if(good)clear.run(q.user.id,id,now());
      out.push({id,ok:!!good,answer:x.answer,key:x.key,model:x.model});
    }
    r.json({results:out,cleared:out.filter(x=>x.ok).length,total:out.length});
  });
};
module.exports.xlsxToRows=xlsxToRows;
