// Chức năng mở rộng (phần 2): Admin - nhật ký hoạt động + tổng quan bài thi · Giáo viên - sổ điểm theo lớp
module.exports=({app,auth,fail,db})=>{
  /* ================= ADMIN: nhật ký hoạt động ================= */
  app.get('/api/admin/log',auth('admin'),(q,r)=>{
    const limit=Math.min(Math.max(+q.query.limit||150,1),500),action=String(q.query.action||'').trim();
    const rows=action
      ?db.prepare('SELECT * FROM activity_log WHERE action=? ORDER BY id DESC LIMIT ?').all(action,limit)
      :db.prepare('SELECT * FROM activity_log ORDER BY id DESC LIMIT ?').all(limit);
    const actions=db.prepare('SELECT DISTINCT action FROM activity_log ORDER BY action').all().map(x=>x.action);
    r.json({rows,actions,total:db.prepare('SELECT COUNT(*) n FROM activity_log').get().n});
  });
  /* ================= ADMIN: tổng quan bài thi toàn hệ thống (để xuất dữ liệu dự phòng) ================= */
  app.get('/api/admin/exams',auth('admin'),(q,r)=>r.json(db.prepare(`SELECT e.id,e.title,e.mode,e.minutes,e.start_at,e.deadline,c.name AS class,u.name AS teacher,
    (SELECT COUNT(*) FROM questions WHERE exam_id=e.id) AS qcount,
    (SELECT COUNT(*) FROM attempts WHERE exam_id=e.id AND submitted_at IS NOT NULL) AS done
    FROM exams e JOIN classes c ON c.id=e.class_id LEFT JOIN users u ON u.id=e.teacher_id ORDER BY e.id DESC`).all()));

  /* ================= GIÁO VIÊN: sổ điểm theo lớp (tổng hợp điểm mọi bài kiểm tra) ================= */
  app.get('/api/classes/:id/gradebook',auth('gv'),(q,r)=>{
    const cls=db.prepare('SELECT * FROM classes WHERE id=?').get(q.params.id);if(!cls)return fail(r,404,'Không có lớp');
    const exams=db.prepare("SELECT id,title,mode FROM exams WHERE class_id=? AND teacher_id=? ORDER BY id").all(cls.id,q.user.id);
    const students=db.prepare("SELECT id,name FROM users WHERE role='hs' AND class_id=? ORDER BY name").all(cls.id);
    const score=db.prepare('SELECT score FROM attempts WHERE exam_id=? AND user_id=? AND submitted_at IS NOT NULL ORDER BY id DESC LIMIT 1');
    const rows=students.map(s=>{
      const scores=exams.map(e=>{const v=score.get(e.id,s.id);return v?v.score:null});
      const got=scores.filter(x=>x!=null);
      return{id:s.id,name:s.name,scores,avg:got.length?Math.round(got.reduce((a,b)=>a+b,0)/got.length*100)/100:null};
    });
    r.json({class:cls.name,exams,rows});
  });
};
