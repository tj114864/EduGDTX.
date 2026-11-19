// Chức năng mở rộng (phần 3): Admin - chuyển lớp & tổng quan theo lớp · Học sinh - hồ sơ cá nhân & góp ý câu hỏi · Giáo viên - xem góp ý
module.exports=({app,auth,fail,db})=>{
  /* ================= ADMIN: chuyển lớp cho học sinh ================= */
  app.post('/api/users/:id/class',auth('admin'),(q,r)=>{
    const u=db.prepare("SELECT * FROM users WHERE id=? AND role='hs'").get(q.params.id);if(!u)return fail(r,404,'Không tìm thấy học sinh');
    const c=db.prepare('SELECT * FROM classes WHERE id=?').get(q.body.class_id);if(!c)return fail(r,404,'Không tìm thấy lớp');
    db.prepare('UPDATE users SET class_id=? WHERE id=?').run(c.id,u.id);
    db.logAct(q.user,'chuyển lớp',`${u.username} (${u.name}) → ${c.name}`);
    r.json({ok:1});
  });
  /* ================= ADMIN: tổng quan theo lớp ================= */
  app.get('/api/admin/classes-overview',auth('admin'),(q,r)=>{
    const rows=db.prepare('SELECT * FROM classes ORDER BY name').all().map(c=>{
      const students=db.prepare("SELECT COUNT(*) n FROM users WHERE role='hs' AND class_id=?").get(c.id).n;
      const exams=db.prepare("SELECT COUNT(*) n FROM exams WHERE class_id=? AND mode='exam'").get(c.id).n;
      const sc=db.prepare(`SELECT AVG(a.score) v FROM attempts a JOIN exams e ON e.id=a.exam_id WHERE e.class_id=? AND e.mode='exam' AND a.submitted_at IS NOT NULL`).get(c.id).v;
      return{id:c.id,name:c.name,students,exams,avg:sc!=null?Math.round(sc*100)/100:null};
    });
    r.json(rows);
  });

  /* ================= HỌC SINH: hồ sơ cá nhân ================= */
  app.get('/api/profile',auth('hs'),(q,r)=>{
    const cls=db.prepare('SELECT name FROM classes WHERE id=?').get(q.user.class_id);
    const ex=db.prepare(`SELECT COUNT(*) n,AVG(score) v,MAX(score) m FROM attempts a JOIN exams e ON e.id=a.exam_id WHERE a.user_id=? AND e.mode='exam' AND a.submitted_at IS NOT NULL`).get(q.user.id);
    const pr=db.prepare(`SELECT COUNT(*) n FROM attempts a JOIN exams e ON e.id=a.exam_id WHERE a.user_id=? AND e.mode='practice' AND a.submitted_at IS NOT NULL`).get(q.user.id);
    const rank=db.prepare(`SELECT COUNT(*)+1 r FROM (SELECT user_id,AVG(score) v FROM attempts a JOIN exams e ON e.id=a.exam_id WHERE e.class_id=? AND e.mode='exam' AND a.submitted_at IS NOT NULL GROUP BY user_id HAVING v>?) t`)
      .get(q.user.class_id,ex.v??-1);
    r.json({name:q.user.name,username:q.user.username,class:cls?cls.name:'',examCount:ex.n,avg:ex.v!=null?Math.round(ex.v*100)/100:null,best:ex.m,practiceCount:pr.n,rank:ex.n?rank.r:null,goal:db.prepare('SELECT goal_score FROM users WHERE id=?').get(q.user.id).goal_score});
  });

  /* ================= HỌC SINH: góp ý về câu hỏi · GIÁO VIÊN: xem & xử lý ================= */
  app.post('/api/feedback',auth('hs'),(q,r)=>{
    const content=String(q.body.content||'').trim().slice(0,500),qid=+q.body.question_id;
    if(!content)return fail(r,400,'Nhập nội dung góp ý');
    // chỉ cho góp ý về câu hỏi thuộc bài mà chính học sinh này đã nộp
    const ok=db.prepare(`SELECT q.exam_id FROM questions q JOIN attempts a ON a.exam_id=q.exam_id WHERE q.id=? AND a.user_id=? AND a.submitted_at IS NOT NULL LIMIT 1`).get(qid,q.user.id);
    if(!ok)return fail(r,404,'Không tìm thấy câu hỏi này trong bài bạn đã làm');
    db.prepare('INSERT INTO feedback(exam_id,question_id,user_id,content,created_at) VALUES(?,?,?,?,?)').run(ok.exam_id,qid,q.user.id,content,Date.now());
    r.json({ok:1});
  });
  app.get('/api/feedback',auth('gv'),(q,r)=>r.json(db.prepare(`SELECT f.id,f.exam_id,e.title AS exam,f.content,f.created_at,f.resolved,u.name AS student,qu.content AS question
    FROM feedback f JOIN exams e ON e.id=f.exam_id JOIN users u ON u.id=f.user_id JOIN questions qu ON qu.id=f.question_id
    WHERE e.teacher_id=? ORDER BY f.resolved,f.id DESC`).all(q.user.id)));
  app.get('/api/exams/:id/feedback',auth('gv'),(q,r)=>{
    if(!db.prepare('SELECT 1 FROM exams WHERE id=? AND teacher_id=?').get(q.params.id,q.user.id))return fail(r,404,'Không có bài');
    r.json(db.prepare(`SELECT f.id,f.content,f.created_at,f.resolved,u.name AS student,qu.content AS question FROM feedback f
      JOIN users u ON u.id=f.user_id JOIN questions qu ON qu.id=f.question_id WHERE f.exam_id=? ORDER BY f.resolved,f.id DESC`).all(q.params.id));
  });
  app.post('/api/feedback/:id/resolve',auth('gv'),(q,r)=>{
    const c=db.prepare('UPDATE feedback SET resolved=1 WHERE id=? AND exam_id IN (SELECT id FROM exams WHERE teacher_id=?)').run(q.params.id,q.user.id);
    if(!c.changes)return fail(r,404,'Không tìm thấy góp ý');r.json({ok:1});
  });
};
