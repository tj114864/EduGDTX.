const parser=require('./parser');
const{askAI}=require('./ai');
const express=require('express'),crypto=require('crypto'),bcrypt=require('bcryptjs'),db=require('./db');
const app=express();app.use(express.json({limit:'1mb'}));app.use(express.static(__dirname+'/public'));
// Giám sát realtime: sau mỗi thao tác ghi dữ liệu (hoặc khi học sinh vào bài) → đẩy ngay bản cập nhật cho giáo viên đang xem
app.use('/api',(q,r,n)=>{if(q.method!='GET'||/\/exams\/\d+\/start$/.test(q.path))r.on('finish',()=>{if(app.locals.liveKick)app.locals.liveKick()});n()});
const fail=(r,c,m)=>r.status(c).json({error:m});
const parseJ=s=>{try{const v=JSON.parse(s);return v&&typeof v=='object'?v:{}}catch{return {}}};
const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
const pub=u=>({id:u.id,username:u.username,name:u.name,role:u.role,class_id:u.class_id});
const auth=(...roles)=>(q,r,n)=>{
  const t=(q.headers.authorization||'').slice(7);
  const u=t&&db.prepare('SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=?').get(t);
  if(!u)return fail(r,401,'Chưa đăng nhập');
  if(u.locked)return fail(r,403,'Tài khoản đã bị khóa. Liên hệ quản trị viên để được mở khóa.');
  if(roles.length&&!roles.includes(u.role))return fail(r,403,'Không có quyền');
  q.user=u;n();
};

/* Đăng nhập */
app.post('/api/login',(q,r)=>{
  const u=db.prepare('SELECT * FROM users WHERE username=?').get(String(q.body.username||'').trim());
  if(!u||!bcrypt.compareSync(String(q.body.password||''),u.password)||!!q.body.admin!==(u.role=='admin'))return fail(r,401,'Sai tên đăng nhập hoặc mật khẩu');
  if(u.locked)return fail(r,403,'Tài khoản đã bị khóa (đình chỉ)'+(u.lock_reason?': '+u.lock_reason:'')+'. Liên hệ quản trị viên để được mở khóa.');
  const token=crypto.randomBytes(24).toString('hex');
  db.prepare('INSERT INTO sessions VALUES(?,?)').run(token,u.id);r.json({token,user:pub(u)});
});
app.get('/api/me',auth(),(q,r)=>r.json(pub(q.user)));
app.post('/api/logout',auth(),(q,r)=>{db.prepare('DELETE FROM sessions WHERE token=?').run(q.headers.authorization.slice(7));r.json({ok:1})});

/* Admin: lớp + tài khoản */
app.get('/api/classes',auth(),(q,r)=>r.json(db.prepare('SELECT * FROM classes').all()));
app.post('/api/classes',auth('admin'),(q,r)=>{
  try{const n=String(q.body.name).trim();db.prepare('INSERT INTO classes(name) VALUES(?)').run(n);db.logAct(q.user,'tạo lớp',n);r.json({ok:1})}
  catch(e){fail(r,400,'Tên lớp đã tồn tại hoặc không hợp lệ')}
});
app.get('/api/users',auth('admin'),(q,r)=>r.json(db.prepare('SELECT u.id,u.username,u.name,u.role,u.locked,u.lock_reason,u.title,c.name AS class FROM users u LEFT JOIN classes c ON c.id=u.class_id').all()));
const TITLES=['Lớp trưởng','Lớp phó học tập','Lớp phó lao động','Bí thư Đoàn','Thủ quỹ'];
app.post('/api/users',auth('admin'),(q,r)=>{
  const{username,password,name,role,class_id}=q.body;
  if(!username||!password||!name||!['gv','hs'].includes(role))return fail(r,400,'Thiếu thông tin');
  const title=role=='hs'&&TITLES.includes(q.body.title)?q.body.title:null;
  try{db.prepare('INSERT INTO users(username,password,name,role,class_id,title) VALUES(?,?,?,?,?,?)').run(username.trim(),bcrypt.hashSync(password,10),name.trim(),role,role=='hs'?class_id||null:null,title);
    db.logAct(q.user,'tạo tài khoản',(role=='gv'?'Giáo viên':'Học sinh')+' '+username.trim()+' ('+name.trim()+')'+(title?' · '+title:''));r.json({ok:1})}
  catch(e){fail(r,400,'Tên đăng nhập đã tồn tại')}
});
app.get('/api/officer-titles',auth(),(q,r)=>r.json(TITLES));
app.put('/api/users/:id/title',auth('admin'),(q,r)=>{
  const u=db.prepare("SELECT * FROM users WHERE id=? AND role='hs'").get(q.params.id);if(!u)return fail(r,404,'Không tìm thấy học sinh');
  const title=TITLES.includes(q.body.title)?q.body.title:null;
  db.prepare('UPDATE users SET title=? WHERE id=?').run(title,u.id);
  db.logAct(q.user,'đặt chức vụ cán sự',`${u.name}${title?' → '+title:' (bỏ chức vụ)'}`);
  r.json({ok:1});
});
app.delete('/api/users/:id',auth('admin'),(q,r)=>{
  const u=db.prepare("SELECT username,name FROM users WHERE id=? AND role!='admin'").get(q.params.id);
  db.prepare("DELETE FROM users WHERE id=? AND role!='admin'").run(q.params.id);if(u)db.logAct(q.user,'xóa tài khoản',u.username+' ('+u.name+')');r.json({ok:1});
});

/* Giáo viên: giao bài */
app.get('/api/exams',auth('gv','admin'),(q,r)=>{
  const where=q.user.role=='gv'?'WHERE e.teacher_id=?':'';
  r.json(db.prepare(`SELECT e.*,c.name AS class,
  (SELECT COUNT(*) FROM questions WHERE exam_id=e.id) AS qcount,
  (SELECT COUNT(DISTINCT user_id) FROM attempts WHERE exam_id=e.id AND submitted_at IS NOT NULL) AS done
  FROM exams e JOIN classes c ON c.id=e.class_id ${where} ORDER BY e.id DESC`).all(...(q.user.role=='gv'?[q.user.id]:[])));
});
/* ---- Bài: tạo, xem, sửa ---- */
function cleanQ(x){
  const type=['mc','tf','essay'].includes(x.type)?x.type:'mc',content=String(x.content||'').trim();if(!content)return null;
  const points=Math.max(0.25,+x.points||1);
  if(type=='essay')return{type,content,options:[],answer:0,key:null,points,model:String(x.model||'').slice(0,2000)};
  const o=(x.options||[]).map(v=>String(v).trim());if(o.length!=4||o.some(v=>!v))return null;
  if(type=='mc')return Number.isInteger(x.answer)&&x.answer>=0&&x.answer<4?{type,content,options:o,answer:x.answer,key:null,points,model:null}:null;
  return /^[DS]{4}$/.test(x.key)?{type,content,options:o,answer:0,key:x.key,points,model:null}:null;
}
function insQ(examId,qs){const ins=db.prepare('INSERT INTO questions(exam_id,content,options,answer,type,key,points,model) VALUES(?,?,?,?,?,?,?,?)');qs.forEach(x=>ins.run(examId,x.content,JSON.stringify(x.options),x.answer,x.type,x.key,x.points,x.model))}
const cfg=b=>[String(b.title||'').trim(),+b.class_id,Math.max(1,+b.minutes||15),b.start_at||null,b.deadline||null,b.mode=='practice'?'practice':'exam',b.shuffle===false?0:1,b.show_score===false?0:1,Math.min(Math.max(+b.max_viol||3,1),20),String(b.code||'').trim()||null,b.show_answer?1:0];
app.post('/api/exams',auth('gv'),(q,r)=>{
  const qs=(q.body.questions||[]).map(cleanQ).filter(Boolean),c=cfg(q.body);
  if(!c[0]||!c[1]||!qs.length)return fail(r,400,'Cần tên bài, lớp và ít nhất 1 câu hợp lệ');
  let newId;
  db.transaction(()=>{
    const id=db.prepare('INSERT INTO exams(title,class_id,minutes,start_at,deadline,mode,shuffle,show_score,max_viol,code,show_answer,teacher_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(...c,q.user.id).lastInsertRowid;
    newId=Number(id);insQ(id,qs);
  })();
  const cname=db.prepare('SELECT name FROM classes WHERE id=?').get(c[1]);db.logAct(q.user,'tạo bài',c[0]+(cname?' · lớp '+cname.name:''));
  r.json({ok:1,id:newId});
});
// Giao cùng một bài cho nhiều lớp cùng lúc: mỗi lớp là một bài riêng (để chống gian lận và sửa về sau không ảnh hưởng lớp khác)
app.post('/api/exams/multi',auth('gv'),(q,r)=>{
  const ids=[...new Set((Array.isArray(q.body.class_ids)?q.body.class_ids:[]).map(Number).filter(Boolean))].slice(0,30);
  const qs=(q.body.questions||[]).map(cleanQ).filter(Boolean),c=cfg({...q.body,class_id:ids[0]});
  if(!c[0]||!ids.length||!qs.length)return fail(r,400,'Cần tên bài, ít nhất 1 lớp và ít nhất 1 câu hợp lệ');
  const have=db.prepare('SELECT id,name FROM classes WHERE id=?');
  const bad=ids.find(id=>!have.get(id));if(bad)return fail(r,404,'Không tìm thấy lớp đã chọn');
  const createdIds=[];
  db.transaction(()=>{for(const cid of ids){
    const row=[c[0],cid,...c.slice(2)];
    const id=db.prepare('INSERT INTO exams(title,class_id,minutes,start_at,deadline,mode,shuffle,show_score,max_viol,code,show_answer,teacher_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(...row,q.user.id).lastInsertRowid;
    insQ(id,qs);createdIds.push(Number(id));
  }})();
  db.logAct(q.user,'tạo bài',`${c[0]} · ${ids.length} lớp`);
  r.json({ok:1,ids:createdIds,count:createdIds.length});
});
app.get('/api/exams/:id',auth('gv'),(q,r)=>{
  const e=db.prepare('SELECT * FROM exams WHERE id=? AND teacher_id=?').get(q.params.id,q.user.id);if(!e)return fail(r,404,'Không có bài');
  const qs=db.prepare('SELECT type,content,options,answer,key,points,model FROM questions WHERE exam_id=? ORDER BY id').all(e.id).map(x=>({...x,options:JSON.parse(x.options)}));
  r.json({exam:e,questions:qs,locked:!!db.prepare('SELECT 1 FROM attempts WHERE exam_id=?').get(e.id)});
});
app.put('/api/exams/:id',auth('gv'),(q,r)=>{
  const e=db.prepare('SELECT * FROM exams WHERE id=? AND teacher_id=?').get(q.params.id,q.user.id);if(!e)return fail(r,404,'Không có bài');
  const locked=!!db.prepare('SELECT 1 FROM attempts WHERE exam_id=?').get(e.id),c=cfg(q.body);
  const qs=locked?null:(q.body.questions||[]).map(cleanQ).filter(Boolean);
  if(!c[0]||!c[1]||(!locked&&!qs.length))return fail(r,400,'Cần tên bài, lớp và ít nhất 1 câu hợp lệ');
  db.transaction(()=>{
    db.prepare('UPDATE exams SET title=?,class_id=?,minutes=?,start_at=?,deadline=?,mode=?,shuffle=?,show_score=?,max_viol=?,code=?,show_answer=? WHERE id=?').run(...c,e.id);
    if(!locked){db.prepare('DELETE FROM questions WHERE exam_id=?').run(e.id);insQ(e.id,qs)}
  })();
  r.json({ok:1,locked});
});
app.delete('/api/exams/:id',auth('gv'),(q,r)=>{
  const e=db.prepare('SELECT title FROM exams WHERE id=? AND teacher_id=?').get(q.params.id,q.user.id);if(!e)return fail(r,404,'Không có bài');
  db.prepare('DELETE FROM exams WHERE id=?').run(q.params.id);db.logAct(q.user,'xóa bài',e.title);r.json({ok:1});
});
app.get('/api/exams/:id/results',auth('gv'),(q,r)=>{
  const e=db.prepare('SELECT * FROM exams WHERE id=? AND teacher_id=?').get(q.params.id,q.user.id);if(!e)return fail(r,404,'Không có bài');
  r.json({exam:e,rows:db.prepare(`SELECT u.id,u.name,u.locked,a.id AS attempt_id,a.pending,a.score,a.correct,a.total,a.violations,a.submitted_at FROM users u
    LEFT JOIN attempts a ON a.id=(SELECT id FROM attempts WHERE exam_id=? AND user_id=u.id AND submitted_at IS NOT NULL ORDER BY id DESC LIMIT 1)
    WHERE u.role='hs' AND u.class_id=?`).all(e.id,e.class_id)});
});
app.post('/api/exams/:id/remind',auth('gv'),(q,r)=>{
  const e=db.prepare('SELECT * FROM exams WHERE id=? AND teacher_id=?').get(q.params.id,q.user.id);if(!e)return fail(r,404,'Không có bài');
  if(e.mode!='exam')return fail(r,400,'Chỉ nhắc được với bài kiểm tra');
  const left=db.prepare(`SELECT u.name FROM users u WHERE u.role='hs' AND u.class_id=? AND NOT EXISTS(SELECT 1 FROM attempts a WHERE a.exam_id=? AND a.user_id=u.id AND a.submitted_at IS NOT NULL) ORDER BY u.name`).all(e.class_id,e.id);
  if(!left.length)return fail(r,400,'Cả lớp đã nộp bài này rồi');
  const names=left.map(x=>x.name),show=names.slice(0,15).join(', ')+(names.length>15?` và ${names.length-15} bạn nữa`:'');
  const deadline=e.deadline?' Hạn nộp: '+new Date(e.deadline).toLocaleString('vi-VN')+'.':'';
  const content=`⏰ Nhắc nộp bài "${e.title}": còn ${left.length} bạn chưa làm (${show}).${deadline} Các bạn hãy vào làm sớm nhé!`;
  db.prepare('INSERT INTO announcements(class_id,teacher_id,content,created_at) VALUES(?,?,?,?)').run(e.class_id,q.user.id,content,Date.now());
  r.json({ok:1,count:left.length});
});

/* Học sinh: làm bài (đáp án đúng chỉ nằm ở server) */
app.get('/api/my-exams',auth('hs'),(q,r)=>r.json(db.prepare(`SELECT e.id,e.title,e.minutes,e.deadline,e.start_at,e.mode,(e.code IS NOT NULL AND e.code!='') AS has_code,
  (SELECT COUNT(*) FROM questions WHERE exam_id=e.id) AS qcount,
  (SELECT COUNT(*) FROM attempts WHERE exam_id=e.id AND user_id=? AND submitted_at IS NOT NULL) AS tries,
  CASE WHEN e.mode='exam' AND e.show_score=0 THEN NULL ELSE (SELECT score FROM attempts WHERE exam_id=e.id AND user_id=? AND submitted_at IS NOT NULL ORDER BY id DESC LIMIT 1) END AS score,
  (SELECT pending FROM attempts WHERE exam_id=e.id AND user_id=? AND submitted_at IS NOT NULL ORDER BY id DESC LIMIT 1) AS pending
  FROM exams e WHERE e.class_id=? ORDER BY e.id DESC`).all(q.user.id,q.user.id,q.user.id,q.user.class_id)));
app.get('/api/exams/:id/start',auth('hs'),(q,r)=>{
  const e=db.prepare('SELECT * FROM exams WHERE id=? AND class_id=?').get(q.params.id,q.user.class_id);
  if(!e)return fail(r,404,'Không tìm thấy bài');
  if(e.mode=='exam'){
    if(e.start_at&&new Date(e.start_at)>new Date())return fail(r,400,'Bài chưa đến giờ mở');
    if(e.deadline&&new Date(e.deadline)<new Date())return fail(r,400,'Bài đã quá hạn');
    if(db.prepare('SELECT 1 FROM attempts WHERE exam_id=? AND user_id=? AND submitted_at IS NOT NULL').get(e.id,q.user.id))return fail(r,400,'Bạn đã nộp bài này rồi');
  }
  if(e.code&&String(q.query.code||'')!==e.code)return fail(r,400,'Sai mã vào bài');
  let at=e.mode=='exam'?db.prepare('SELECT * FROM attempts WHERE exam_id=? AND user_id=? AND submitted_at IS NULL').get(e.id,q.user.id):null;
  let viol=0;
  if(at){   // vào lại bài đang làm dở = đã rời khỏi trang → tính 1 vi phạm
    db.prepare('INSERT INTO violations(attempt_id,user_id,kind,at) VALUES(?,?,?,?)').run(at.id,q.user.id,'reload',Date.now());
    db.prepare('UPDATE attempts SET violations=COALESCE(violations,0)+1 WHERE id=?').run(at.id);
    viol=db.prepare('SELECT violations v FROM attempts WHERE id=?').get(at.id).v;
    if(viol>=(e.max_viol||3)){gradeAttempt(at,e,parseJ(at.draft),true);lockUser(q.user.id,`rời khỏi bài thi "${e.title}" ${viol} lần`);return fail(r,403,'Bạn đã rời khỏi bài thi quá số lần cho phép. Bài đã được nộp và tài khoản bị đình chỉ, khóa.')}
  }
  if(!at){const t=Date.now();at={id:db.prepare('INSERT INTO attempts(exam_id,user_id,started_at) VALUES(?,?,?)').run(e.id,q.user.id,t).lastInsertRowid,started_at:t,extra_min:0}}
  let qs=db.prepare('SELECT id,type,content,options,points FROM questions WHERE exam_id=? ORDER BY id').all(e.id).map(x=>({...x,options:JSON.parse(x.options)}));
  const ord=at.qorder?parseJ(at.qorder):null;       // vào lại bài đang làm dở → giữ nguyên thứ tự câu hỏi
  if(Array.isArray(ord)&&ord.length==qs.length){const pos=new Map(ord.map((id,i)=>[id,i]));qs.sort((a,b)=>(pos.get(a.id)??9e9)-(pos.get(b.id)??9e9))}
  else{if(e.shuffle)shuffle(qs);db.prepare('UPDATE attempts SET qorder=? WHERE id=?').run(JSON.stringify(qs.map(x=>x.id)),at.id)}
  db.prepare('UPDATE attempts SET last_seen=? WHERE id=?').run(Date.now(),at.id);
  r.json({attempt:at.id,title:e.title,mode:e.mode,endsAt:at.started_at+(e.minutes+(at.extra_min||0))*60000,maxViol:e.max_viol||3,viol,questions:qs,draft:parseJ(at.draft)});
});
function lockUser(uid,reason){
  db.prepare("UPDATE users SET locked=1,lock_reason=? WHERE id=? AND role!='admin'").run(String(reason||'').slice(0,200)||null,uid);
  db.prepare('DELETE FROM sessions WHERE user_id=?').run(uid);
}
// Phân loại từng câu: đúng / sai / chưa làm (/ tự luận chờ chấm). Chỉ lộ đáp án đúng khi giáo viên cho phép (hoặc bài ôn tập)
function shapeReview(items,e){
  const reveal=e.mode=='practice'||!!e.show_answer;
  return items.map(x=>{
    const t=x.text||'';let status,nOk=null;
    if(x.type=='essay')status=t.trim()?(x.got==null?'wait':x.got>=x.points?'ok':'bad'):'none';
    else if(x.type=='tf'){nOk=[0,1,2,3].filter(i=>t[i]==x.key[i]).length;status=/[DS]/.test(t)?(nOk==4?'ok':'bad'):'none'}
    else status=x.picked==null?'none':x.picked===x.answer?'ok':'bad';
    const o={...x,status,nOk,self:e.mode=='practice'};
    if(!reveal){delete o.answer;delete o.key;delete o.model}
    return o;
  });
}
function gradeAttempt(at,e,ansRaw,force){
  const practice=e.mode=='practice';
  const late=!force&&Date.now()>at.started_at+(e.minutes+(at.extra_min||0))*60000+15000;            // nộp quá giờ → không tính bài làm
  const ans=late?{}:(ansRaw||{});
  const qs=db.prepare('SELECT * FROM questions WHERE exam_id=? ORDER BY id').all(e.id);
  const ia=db.prepare('INSERT OR REPLACE INTO answers(attempt_id,question_id,picked,text,earned) VALUES(?,?,?,?,?)');
  let earned=0,total=0,correct=0,pending=0;const review=[];
  db.transaction(()=>{for(const x of qs){
    const a=ans[x.id];let got=null,picked=null,text=null;
    if(x.type=='essay'){text=typeof a=='string'?a.slice(0,5000):'';if(!practice){total+=x.points;pending=1}}   // tự luận: chờ giáo viên chấm
    else if(x.type=='tf'){text=typeof a=='string'&&/^[DS-]{4}$/.test(a)?a:'----';let n=0;for(let i=0;i<4;i++)if(text[i]==x.key[i])n++;
      got=x.points*[0,.1,.25,.5,1][n];total+=x.points;if(n==4)correct++}                                       // đúng sai: 1/2/3/4 ý đúng = 10%/25%/50%/100%
    else{picked=Number.isInteger(a)?a:null;got=picked===x.answer?x.points:0;total+=x.points;if(got)correct++}
    if(got!=null)earned+=got;
    ia.run(at.id,x.id,picked,text,got);
    review.push({id:x.id,type:x.type,content:x.content,options:JSON.parse(x.options),answer:x.answer,key:x.key,points:x.points,model:x.model,picked,text,got});
  }})();
  const score=total?Math.round(earned/total*1000)/100:0;
  db.prepare('UPDATE attempts SET submitted_at=?,score=?,correct=?,total=?,pending=? WHERE id=?').run(Date.now(),score,correct,qs.length,pending,at.id);
  const out={late,pending:!!pending};
  if(!practice&&!e.show_score)out.hidden=true;else Object.assign(out,{score,correct,total:qs.length});
  if(!out.hidden){out.review=shapeReview(review,e);out.reveal=practice||!!e.show_answer}
  return out;
}
app.post('/api/attempts/:id/submit',auth('hs'),(q,r)=>{
  const at=db.prepare('SELECT * FROM attempts WHERE id=? AND user_id=?').get(q.params.id,q.user.id);
  if(!at||at.submitted_at)return fail(r,400,'Bài đã nộp hoặc không hợp lệ');
  const p=+q.body.predicted;if(p>=0&&p<=10)db.prepare('UPDATE attempts SET predicted=? WHERE id=?').run(Math.round(p*100)/100,at.id);
  const out=gradeAttempt(at,db.prepare('SELECT * FROM exams WHERE id=?').get(at.exam_id),q.body.answers);
  if(p>=0&&p<=10)out.predicted=Math.round(p*100)/100;
  r.json(out);
});
// Chống gian lận: ghi nhận vi phạm (chuyển tab, rời cửa sổ, thoát toàn màn hình). Đủ số lần → nộp bài + đình chỉ + khóa tài khoản
app.post('/api/attempts/:id/violation',auth('hs'),(q,r)=>{
  const at=db.prepare('SELECT * FROM attempts WHERE id=? AND user_id=? AND submitted_at IS NULL').get(q.params.id,q.user.id);
  const e=at&&db.prepare('SELECT * FROM exams WHERE id=?').get(at.exam_id);
  if(!at||e.mode!='exam')return r.json({ignored:true});
  const kind=['tab','blur','fullscreen'].includes(q.body.kind)?q.body.kind:'tab',max=e.max_viol||3;
  db.prepare('INSERT INTO violations(attempt_id,user_id,kind,at) VALUES(?,?,?,?)').run(at.id,q.user.id,kind,Date.now());
  db.prepare('UPDATE attempts SET violations=COALESCE(violations,0)+1 WHERE id=?').run(at.id);
  const n=db.prepare('SELECT violations v FROM attempts WHERE id=?').get(at.id).v;
  if(n>=max){gradeAttempt(at,e,q.body.answers||parseJ(at.draft),true);lockUser(q.user.id,`rời khỏi bài thi "${e.title}" ${n} lần`);return r.json({locked:true,count:n,max})}
  r.json({count:n,max});
});
// Admin: khóa / mở khóa tài khoản
app.post('/api/users/:id/lock',auth('admin'),(q,r)=>{
  const u=db.prepare("SELECT * FROM users WHERE id=? AND role!='admin'").get(q.params.id);if(!u)return fail(r,404,'Không tìm thấy tài khoản');
  db.logAct(q.user,q.body.locked?'khóa tài khoản':'mở khóa tài khoản',u.username+' ('+u.name+')'+(q.body.locked&&q.body.reason?' – '+q.body.reason:''));
  if(q.body.locked)lockUser(u.id,String(q.body.reason||'Bị quản trị viên khóa'));
  else db.prepare('UPDATE users SET locked=0,lock_reason=NULL WHERE id=?').run(u.id);
  r.json({ok:1});
});

/* ===== Tính năng mở rộng ===== */
app.post('/api/password',auth(),(q,r)=>{
  const{old,pw}=q.body;
  if(!bcrypt.compareSync(String(old||''),q.user.password))return fail(r,400,'Mật khẩu hiện tại không đúng');
  if(String(pw||'').length<6)return fail(r,400,'Mật khẩu mới phải từ 6 ký tự');
  db.prepare('UPDATE users SET password=? WHERE id=?').run(bcrypt.hashSync(pw,10),q.user.id);r.json({ok:1});
});
// Admin
app.get('/api/stats',auth('admin'),(q,r)=>r.json({exams:db.prepare('SELECT COUNT(*) n FROM exams').get().n,attempts:db.prepare('SELECT COUNT(*) n FROM attempts WHERE submitted_at IS NOT NULL').get().n}));
app.post('/api/users/:id/reset',auth('admin'),(q,r)=>{
  const pw='Edu'+crypto.randomInt(100000,999999);
  const c=db.prepare("UPDATE users SET password=? WHERE id=? AND role!='admin'").run(bcrypt.hashSync(pw,10),q.params.id);
  if(!c.changes)return fail(r,404,'Không tìm thấy tài khoản');
  db.prepare('DELETE FROM sessions WHERE user_id=?').run(q.params.id);r.json({password:pw});
});
app.delete('/api/classes/:id',auth('admin'),(q,r)=>{
  const c=db.prepare('SELECT name FROM classes WHERE id=?').get(q.params.id);
  db.prepare('DELETE FROM classes WHERE id=?').run(q.params.id);if(c)db.logAct(q.user,'xóa lớp',c.name);r.json({ok:1});
});
// Giáo viên
app.post('/api/exams/:id/duplicate',auth('gv'),(q,r)=>{
  const e=db.prepare('SELECT * FROM exams WHERE id=? AND teacher_id=?').get(q.params.id,q.user.id);
  if(!e||!db.prepare('SELECT 1 FROM classes WHERE id=?').get(q.body.class_id))return fail(r,404,'Không tìm thấy bài hoặc lớp');
  db.transaction(()=>{
    const id=db.prepare('INSERT INTO exams(title,class_id,teacher_id,minutes,start_at,deadline,mode,shuffle,show_score,max_viol,code,show_answer) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(e.title,q.body.class_id,q.user.id,e.minutes,e.start_at,e.deadline,e.mode,e.shuffle,e.show_score,e.max_viol,e.code,e.show_answer).lastInsertRowid;
    db.prepare('INSERT INTO questions(exam_id,content,options,answer,type,key,points,model) SELECT ?,content,options,answer,type,key,points,model FROM questions WHERE exam_id=?').run(id,e.id);
  })();r.json({ok:1});
});
app.get('/api/exams/:id/stats',auth('gv'),(q,r)=>{
  if(!db.prepare('SELECT 1 FROM exams WHERE id=? AND teacher_id=?').get(q.params.id,q.user.id))return fail(r,404,'Không có bài');
  r.json(db.prepare(`SELECT q.id,q.type,q.content,COUNT(a.attempt_id) n,COALESCE(SUM(CASE WHEN a.earned IS NOT NULL AND a.earned>=q.points THEN 1 ELSE 0 END),0) ok
  FROM questions q LEFT JOIN (SELECT an.attempt_id,an.question_id,an.picked,an.earned FROM answers an JOIN attempts t ON t.id=an.attempt_id WHERE t.submitted_at IS NOT NULL) a ON a.question_id=q.id
  WHERE q.exam_id=? GROUP BY q.id ORDER BY q.id`).all(q.params.id));
});
app.get('/api/announcements',auth('gv','hs'),(q,r)=>r.json(q.user.role=='gv'
  ?db.prepare('SELECT n.*,c.name AS class FROM announcements n JOIN classes c ON c.id=n.class_id WHERE n.teacher_id=? ORDER BY n.id DESC').all(q.user.id)
  :db.prepare('SELECT n.*,u.name AS teacher FROM announcements n JOIN users u ON u.id=n.teacher_id WHERE n.class_id=? ORDER BY n.id DESC').all(q.user.class_id)));
app.post('/api/announcements',auth('gv'),(q,r)=>{
  const c=String(q.body.content||'').trim();if(!c||!q.body.class_id)return fail(r,400,'Nhập nội dung và chọn lớp');
  db.prepare('INSERT INTO announcements(class_id,teacher_id,content,created_at) VALUES(?,?,?,?)').run(q.body.class_id,q.user.id,c.slice(0,1000),Date.now());r.json({ok:1});
});
app.delete('/api/announcements/:id',auth('gv'),(q,r)=>{db.prepare('DELETE FROM announcements WHERE id=? AND teacher_id=?').run(q.params.id,q.user.id);r.json({ok:1})});
// Học sinh
app.get('/api/my-history',auth('hs'),(q,r)=>r.json(db.prepare(`SELECT a.id,e.title,e.mode,a.pending,
  CASE WHEN e.mode='exam' AND e.show_score=0 THEN NULL ELSE a.score END AS score,CASE WHEN e.mode='exam' AND e.show_score=0 THEN NULL ELSE a.correct END AS correct,a.total,a.submitted_at
  FROM attempts a JOIN exams e ON e.id=a.exam_id WHERE a.user_id=? AND a.submitted_at IS NOT NULL ORDER BY a.id DESC`).all(q.user.id)));
app.get('/api/attempts/:id/review',auth('hs'),(q,r)=>{
  const a=db.prepare('SELECT a.*,e.title,e.mode,e.show_score,e.show_answer FROM attempts a JOIN exams e ON e.id=a.exam_id WHERE a.id=? AND a.user_id=? AND a.submitted_at IS NOT NULL').get(q.params.id,q.user.id);
  if(!a)return fail(r,404,'Không tìm thấy bài làm');
  if(a.mode!='practice'&&!a.show_score)return fail(r,403,'Giáo viên chưa công bố kết quả bài này');
  const items=db.prepare('SELECT q.id,q.type,q.content,q.options,q.answer,q.key,q.points,q.model,an.picked,an.text,an.earned AS got FROM questions q LEFT JOIN answers an ON an.question_id=q.id AND an.attempt_id=? WHERE q.exam_id=? ORDER BY q.id').all(a.id,a.exam_id).map(x=>({...x,options:JSON.parse(x.options)}));
  r.json({title:a.title,score:a.score,correct:a.correct,total:a.total,reveal:a.mode=='practice'||!!a.show_answer,items:shapeReview(items,a)});
});
app.get('/api/leaderboard',auth('hs'),(q,r)=>r.json(db.prepare(`SELECT u.id,u.name,ROUND(AVG(a.score),1) avg,COUNT(a.id) n FROM users u LEFT JOIN attempts a ON a.user_id=u.id AND a.submitted_at IS NOT NULL WHERE u.role='hs' AND u.class_id=? GROUP BY u.id ORDER BY avg IS NULL,avg DESC,n DESC`).all(q.user.class_id)));

// Giáo viên: chấm bài tự luận
app.get('/api/attempts/:id/grading',auth('gv'),(q,r)=>{
  const a=db.prepare('SELECT a.*,u.name,e.title FROM attempts a JOIN users u ON u.id=a.user_id JOIN exams e ON e.id=a.exam_id WHERE a.id=? AND a.submitted_at IS NOT NULL AND e.teacher_id=?').get(q.params.id,q.user.id);
  if(!a)return fail(r,404,'Không tìm thấy bài làm');
  const items=db.prepare('SELECT qu.id,qu.type,qu.content,qu.options,qu.key,qu.answer,qu.points,qu.model,an.picked,an.text,an.earned FROM questions qu LEFT JOIN answers an ON an.question_id=qu.id AND an.attempt_id=? WHERE qu.exam_id=? ORDER BY qu.id').all(a.id,a.exam_id).map(x=>({...x,options:JSON.parse(x.options)}));
  r.json({attempt:{id:a.id,exam_id:a.exam_id,name:a.name,title:a.title,score:a.score,pending:a.pending},items,viol:db.prepare('SELECT kind,at FROM violations WHERE attempt_id=? ORDER BY id').all(a.id)});
});
app.post('/api/attempts/:id/grade',auth('gv'),(q,r)=>{
  const a=db.prepare('SELECT a.* FROM attempts a JOIN exams e ON e.id=a.exam_id WHERE a.id=? AND e.teacher_id=?').get(q.params.id,q.user.id);if(!a)return fail(r,404,'Không tìm thấy bài làm');
  const up=db.prepare('UPDATE answers SET earned=? WHERE attempt_id=? AND question_id=?');
  (q.body.grades||[]).forEach(g=>{const p=db.prepare("SELECT points FROM questions WHERE id=? AND exam_id=? AND type='essay'").get(g.question_id,a.exam_id);if(p)up.run(Math.min(Math.max(+g.earned||0,0),p.points),a.id,g.question_id)});
  const tp=db.prepare('SELECT COALESCE(SUM(points),0) t FROM questions WHERE exam_id=?').get(a.exam_id).t;
  const s=db.prepare('SELECT COALESCE(SUM(earned),0) e,COALESCE(SUM(CASE WHEN earned IS NULL THEN 1 ELSE 0 END),0) np FROM answers WHERE attempt_id=?').get(a.id);
  const score=tp?Math.round(s.e/tp*1000)/100:0;
  db.prepare('UPDATE attempts SET score=?,pending=? WHERE id=?').run(score,s.np>0?1:0,a.id);r.json({score,pending:s.np>0});
});
// Giáo viên: nhập đề từ Word / PDF / văn bản
app.post('/api/parse',auth('gv'),(q,r)=>{
  const qs=parser.parseQuestions(String(q.body.text||''));
  if(!qs.length)return fail(r,400,'Không nhận diện được câu hỏi. Mỗi câu cần bắt đầu bằng "Câu 1."');r.json(qs);
});
app.post('/api/import',auth('gv'),express.raw({type:'application/octet-stream',limit:'20mb'}),async(q,r)=>{
  try{
    const name=String(q.query.name||'').toLowerCase();let text;
    if(name.endsWith('.docx')){
      // ưu tiên đọc thẳng XML của Word để nhận đáp án được in đậm / gạch chân / tô màu / tô nền; lỗi thì dùng mammoth
      try{const Z=await require('jszip').loadAsync(q.body),x=await Z.file('word/document.xml').async('string');text=parser.docxXmlToText(x);if(!parser.parseQuestions(text).length)text=null}catch{text=null}
      if(!text)text=parser.htmlToText((await require('mammoth').convertToHtml({buffer:q.body},{styleMap:['u => u']})).value)}
    else if(name.endsWith('.pdf'))text=(await require('pdf-parse/lib/pdf-parse.js')(q.body)).text;
    else if(name.endsWith('.txt')||name.endsWith('.md'))text=Buffer.from(q.body).toString('utf8');
    else return fail(r,400,'Chỉ hỗ trợ .docx, .pdf, .txt (file .doc cũ hãy lưu lại thành .docx)');
    const qs=parser.parseQuestions(text);
    if(!qs.length)return fail(r,400,'Không nhận diện được câu hỏi trong file. Kiểm tra mỗi câu bắt đầu bằng "Câu 1." (PDF dạng ảnh quét chưa đọc được)');
    r.json({questions:qs,count:qs.length});
  }catch(e){fail(r,400,'Không đọc được file: '+e.message)}
});

require('./extra')({app,auth,fail,db,bcrypt,crypto,express,gradeAttempt,lockUser,cleanQ,parseJ});
require('./extra2')({app,auth,fail,db});
require('./extra3')({app,auth,fail,db});
require('./extra4')({app,auth,fail,db});
require('./extra5')({app,auth,fail,db});
require('./extra6')({app,auth,fail,db});
require('./extra7')({app,auth,fail,db,askAI});

const PORT=process.env.PORT||8000;
app.listen(PORT,()=>console.log('Chạy tại http://localhost:'+PORT));
