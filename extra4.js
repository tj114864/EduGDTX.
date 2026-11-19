// Chức năng mở rộng (phần 4 backend): mỗi vai trò thêm 4 tính năng
// Admin: thông báo toàn trường · học sinh cần quan tâm · bảng điểm toàn trường · (in danh sách lớp: thuần client)
// Giáo viên: nhận xét học sinh · trộn đề ngẫu nhiên từ ngân hàng · nhập điểm thủ công · so sánh các lớp cùng đề
// Học sinh: xem nhận xét giáo viên · đề yêu thích · (in bảng điểm cá nhân: thuần client) · mục tiêu điểm số
module.exports=({app,auth,fail,db})=>{
  /* ================= ADMIN ================= */
  // A1. Thông báo toàn trường
  app.post('/api/broadcast',auth('admin'),(q,r)=>{
    const content=String(q.body.content||'').trim().slice(0,1000);if(!content)return fail(r,400,'Nhập nội dung thông báo');
    const all=q.body.class_ids=='all';
    const ids=all?db.prepare('SELECT id FROM classes').all().map(x=>x.id):[...new Set((Array.isArray(q.body.class_ids)?q.body.class_ids:[]).map(Number).filter(Boolean))];
    if(!ids.length)return fail(r,400,'Chưa chọn lớp nào');
    const ins=db.prepare('INSERT INTO announcements(class_id,teacher_id,content,created_at) VALUES(?,?,?,?)'),t=Date.now();
    db.transaction(()=>{ids.forEach(cid=>ins.run(cid,q.user.id,content,t))})();
    db.logAct(q.user,'thông báo toàn trường',content.slice(0,100)+` (${ids.length} lớp)`);
    r.json({ok:1,count:ids.length});
  });
  // A2. Học sinh cần quan tâm (điểm thấp)
  app.get('/api/admin/watchlist',auth('admin'),(q,r)=>{
    const students=db.prepare(`SELECT u.id,u.name,c.name AS class FROM users u LEFT JOIN classes c ON c.id=u.class_id WHERE u.role='hs'`).all();
    const scoresOf=db.prepare(`SELECT a.score FROM attempts a JOIN exams e ON e.id=a.exam_id WHERE a.user_id=? AND e.mode='exam' AND a.submitted_at IS NOT NULL ORDER BY a.id DESC LIMIT 3`);
    const out=students.map(s=>{
      const sc=scoresOf.all(s.id).map(x=>x.score);if(!sc.length)return null;
      const avg=Math.round(sc.reduce((a,b)=>a+b,0)/sc.length*100)/100;
      return avg<5?{id:s.id,name:s.name,class:s.class,avg,count:sc.length}:null;
    }).filter(Boolean).sort((a,b)=>a.avg-b.avg);
    r.json(out);
  });
  // A3. Bảng điểm toàn trường (mọi lớp, mọi giáo viên)
  app.get('/api/admin/full-gradebook',auth('admin'),(q,r)=>{
    const classes=db.prepare('SELECT * FROM classes ORDER BY name').all();
    const score=db.prepare('SELECT score FROM attempts WHERE exam_id=? AND user_id=? AND submitted_at IS NOT NULL ORDER BY id DESC LIMIT 1');
    const out=classes.map(c=>{
      const exams=db.prepare(`SELECT e.id,e.title,u.name AS teacher FROM exams e LEFT JOIN users u ON u.id=e.teacher_id WHERE e.class_id=? AND e.mode='exam' ORDER BY e.id`).all(c.id);
      const students=db.prepare("SELECT id,name FROM users WHERE role='hs' AND class_id=? ORDER BY name").all(c.id);
      const rows=students.map(s=>{const scores=exams.map(e=>{const v=score.get(e.id,s.id);return v?v.score:null});const got=scores.filter(x=>x!=null);
        return{name:s.name,scores,avg:got.length?Math.round(got.reduce((a,b)=>a+b,0)/got.length*100)/100:null}});
      return{class:c.name,exams,rows};
    }).filter(c=>c.exams.length);
    r.json(out);
  });

  /* ================= GIÁO VIÊN ================= */
  const classOf=(uid)=>db.prepare("SELECT class_id FROM users WHERE id=? AND role='hs'").get(uid);
  const mayRemark=(gid,uid)=>{const c=classOf(uid);return c&&db.prepare('SELECT 1 FROM exams WHERE teacher_id=? AND class_id=? LIMIT 1').get(gid,c.class_id)};
  // B1. Nhận xét học sinh
  app.get('/api/remarks/:sid',auth('gv'),(q,r)=>{
    if(!mayRemark(q.user.id,q.params.sid))return fail(r,404,'Không tìm thấy học sinh thuộc lớp bạn dạy');
    const row=db.prepare('SELECT content,updated_at FROM remarks WHERE teacher_id=? AND student_id=?').get(q.user.id,q.params.sid);
    r.json(row||{content:'',updated_at:null});
  });
  app.post('/api/remarks/:sid',auth('gv'),(q,r)=>{
    if(!mayRemark(q.user.id,q.params.sid))return fail(r,404,'Không tìm thấy học sinh thuộc lớp bạn dạy');
    const content=String(q.body.content||'').trim().slice(0,500);
    if(!content)db.prepare('DELETE FROM remarks WHERE teacher_id=? AND student_id=?').run(q.user.id,q.params.sid);
    else db.prepare('INSERT INTO remarks(teacher_id,student_id,content,updated_at) VALUES(?,?,?,?) ON CONFLICT(teacher_id,student_id) DO UPDATE SET content=excluded.content,updated_at=excluded.updated_at')
      .run(q.user.id,q.params.sid,content,Date.now());
    r.json({ok:1});
  });
  // B2. Thống kê theo dạng câu hỏi (trắc nghiệm / đúng-sai / tự luận) qua toàn bộ bài của giáo viên
  app.get('/api/stats-by-type',auth('gv'),(q,r)=>{
    const rows=db.prepare(`SELECT qu.type,COUNT(DISTINCT qu.id) qcount,COUNT(an.attempt_id) n,
        COALESCE(SUM(CASE WHEN an.earned IS NOT NULL AND an.earned>=qu.points THEN 1 ELSE 0 END),0) ok
      FROM questions qu JOIN exams e ON e.id=qu.exam_id
      LEFT JOIN (SELECT an.attempt_id,an.question_id,an.earned FROM answers an JOIN attempts t ON t.id=an.attempt_id WHERE t.submitted_at IS NOT NULL) an ON an.question_id=qu.id
      WHERE e.teacher_id=? GROUP BY qu.type`).all(q.user.id);
    r.json(rows.map(x=>({type:x.type,qcount:x.qcount,n:x.n,rate:x.n?Math.round(x.ok/x.n*1000)/10:null})));
  });
  // B3. Nhập điểm thủ công (học sinh vắng / làm bài giấy)
  app.post('/api/exams/:id/manual-score',auth('gv'),(q,r)=>{
    const e=db.prepare('SELECT * FROM exams WHERE id=? AND teacher_id=?').get(q.params.id,q.user.id);if(!e)return fail(r,404,'Không có bài');
    const u=db.prepare("SELECT * FROM users WHERE id=? AND role='hs' AND class_id=?").get(q.body.student_id,e.class_id);if(!u)return fail(r,404,'Học sinh không thuộc lớp của bài này');
    const score=Math.round(Math.min(Math.max(+q.body.score,0),10)*100)/100,note=String(q.body.note||'').trim().slice(0,200)||'Nhập điểm thủ công',total=db.prepare('SELECT COUNT(*) n FROM questions WHERE exam_id=?').get(e.id).n;
    const old=db.prepare('SELECT id FROM attempts WHERE exam_id=? AND user_id=?').get(e.id,u.id);
    if(old)db.prepare('UPDATE attempts SET score=?,submitted_at=?,pending=0,manual=1,note=?,correct=NULL,total=? WHERE id=?').run(score,Date.now(),note,total,old.id);
    else db.prepare('INSERT INTO attempts(exam_id,user_id,started_at,submitted_at,score,correct,total,violations,manual,note) VALUES(?,?,?,?,?,?,?,0,1,?)').run(e.id,u.id,Date.now(),Date.now(),score,null,total,note);
    db.logAct(q.user,'nhập điểm thủ công',`${u.name} · ${e.title} · ${score} điểm`);
    r.json({ok:1});
  });
  // B4. So sánh các lớp cùng một đề (áp dụng khi giao nhiều lớp)
  app.get('/api/exams/:id/compare',auth('gv'),(q,r)=>{
    const e=db.prepare('SELECT * FROM exams WHERE id=? AND teacher_id=?').get(q.params.id,q.user.id);if(!e)return fail(r,404,'Không có bài');
    const sibs=db.prepare('SELECT * FROM exams WHERE title=? AND teacher_id=? ORDER BY id').all(e.title,q.user.id);
    r.json(sibs.map(s=>{
      const cls=db.prepare('SELECT name FROM classes WHERE id=?').get(s.class_id);
      const st=db.prepare("SELECT COUNT(*) n FROM users WHERE role='hs' AND class_id=?").get(s.class_id).n;
      const sc=db.prepare('SELECT score FROM attempts WHERE exam_id=? AND submitted_at IS NOT NULL').all(s.id).map(x=>x.score);
      return{id:s.id,class:cls?cls.name:'',students:st,done:sc.length,avg:sc.length?Math.round(sc.reduce((a,b)=>a+b,0)/sc.length*100)/100:null,self:s.id==e.id};
    }));
  });

  /* ================= HỌC SINH ================= */
  // C1. Xem nhận xét từ giáo viên
  app.get('/api/remarks-me',auth('hs'),(q,r)=>r.json(db.prepare(`SELECT r.content,r.updated_at,u.name AS teacher FROM remarks r JOIN users u ON u.id=r.teacher_id WHERE r.student_id=? ORDER BY r.updated_at DESC`).all(q.user.id)));
  // C2. Đề yêu thích
  app.get('/api/favorites',auth('hs'),(q,r)=>r.json(db.prepare(`SELECT f.exam_id AS id,e.title,e.mode,e.minutes,(e.class_id=?) AS same_class FROM favorites f JOIN exams e ON e.id=f.exam_id WHERE f.user_id=? ORDER BY f.created_at DESC`).all(q.user.class_id,q.user.id)));
  app.post('/api/favorites/:eid',auth('hs'),(q,r)=>{
    const e=db.prepare('SELECT id FROM exams WHERE id=? AND class_id=?').get(q.params.eid,q.user.class_id);if(!e)return fail(r,404,'Không tìm thấy bài');
    db.prepare('INSERT OR IGNORE INTO favorites(user_id,exam_id,created_at) VALUES(?,?,?)').run(q.user.id,q.params.eid,Date.now());r.json({ok:1});
  });
  app.delete('/api/favorites/:eid',auth('hs'),(q,r)=>{db.prepare('DELETE FROM favorites WHERE user_id=? AND exam_id=?').run(q.user.id,q.params.eid);r.json({ok:1})});
  // C4. Mục tiêu điểm số
  app.put('/api/profile/goal',auth('hs'),(q,r)=>{
    const g=q.body.goal===null||q.body.goal===''?null:Math.round(Math.min(Math.max(+q.body.goal,0),10)*100)/100;
    if(g!=null&&Number.isNaN(g))return fail(r,400,'Mục tiêu không hợp lệ');
    db.prepare('UPDATE users SET goal_score=? WHERE id=?').run(g,q.user.id);r.json({ok:1,goal:g});
  });
};
