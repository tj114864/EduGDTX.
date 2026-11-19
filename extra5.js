// Chức năng mở rộng (phần 5 backend) — 3 khu vực hoàn toàn mới, chưa từng có trong bản trước:
// 1) Tài liệu học tập (giáo viên đăng, học sinh xem) 2) Điểm danh theo buổi 3) Khảo sát nhanh (poll, không chấm điểm)
module.exports=({app,auth,fail,db})=>{
  /* ================= 1. TÀI LIỆU HỌC TẬP ================= */
  app.post('/api/materials',auth('gv'),(q,r)=>{
    const title=String(q.body.title||'').trim().slice(0,150),content=String(q.body.content||'').trim().slice(0,5000),link=String(q.body.link||'').trim().slice(0,500);
    if(!title||!q.body.class_id)return fail(r,400,'Nhập tên tài liệu và chọn lớp');
    if(!db.prepare('SELECT 1 FROM classes WHERE id=?').get(q.body.class_id))return fail(r,404,'Không tìm thấy lớp');
    db.prepare('INSERT INTO materials(teacher_id,class_id,title,content,link,created_at) VALUES(?,?,?,?,?,?)').run(q.user.id,q.body.class_id,title,content||null,link||null,Date.now());
    r.json({ok:1});
  });
  app.get('/api/materials',auth('gv'),(q,r)=>r.json(db.prepare('SELECT m.*,c.name AS class FROM materials m JOIN classes c ON c.id=m.class_id WHERE m.teacher_id=? ORDER BY m.id DESC').all(q.user.id)));
  app.delete('/api/materials/:id',auth('gv'),(q,r)=>{const c=db.prepare('DELETE FROM materials WHERE id=? AND teacher_id=?').run(q.params.id,q.user.id);if(!c.changes)return fail(r,404,'Không tìm thấy tài liệu');r.json({ok:1})});
  app.get('/api/my-materials',auth('hs'),(q,r)=>r.json(db.prepare('SELECT m.id,m.title,m.content,m.link,m.created_at,u.name AS teacher FROM materials m JOIN users u ON u.id=m.teacher_id WHERE m.class_id=? ORDER BY m.id DESC').all(q.user.class_id)));

  /* ================= 2. ĐIỂM DANH ================= */
  app.post('/api/attendance',auth('gv'),(q,r)=>{
    const date=String(q.body.date||'').slice(0,10),recs=Array.isArray(q.body.records)?q.body.records:[];
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!q.body.class_id||!recs.length)return fail(r,400,'Thiếu ngày, lớp hoặc danh sách điểm danh');
    if(!db.prepare('SELECT 1 FROM classes WHERE id=?').get(q.body.class_id))return fail(r,404,'Không tìm thấy lớp');
    const ok=['present','absent','late','excused'];
    const ins=db.prepare('INSERT OR REPLACE INTO attendance(class_id,teacher_id,date,student_id,status) VALUES(?,?,?,?,?)');
    db.transaction(()=>{recs.forEach(x=>{if(ok.includes(x.status)&&db.prepare("SELECT 1 FROM users WHERE id=? AND role='hs' AND class_id=?").get(x.student_id,q.body.class_id))ins.run(q.body.class_id,q.user.id,date,x.student_id,x.status)})})();
    r.json({ok:1});
  });
  app.get('/api/attendance/:classId',auth('gv'),(q,r)=>{
    const date=String(q.query.date||'').slice(0,10);
    const students=db.prepare("SELECT id,name FROM users WHERE role='hs' AND class_id=? ORDER BY name").all(q.params.classId);
    const st=db.prepare('SELECT status FROM attendance WHERE class_id=? AND date=? AND student_id=?');
    r.json(students.map(s=>({id:s.id,name:s.name,status:(st.get(q.params.classId,date,s.id)||{}).status||null})));
  });
  app.get('/api/attendance-me',auth('hs'),(q,r)=>{
    const rows=db.prepare('SELECT date,status FROM attendance WHERE student_id=? ORDER BY date DESC').all(q.user.id);
    const n=rows.length,present=rows.filter(x=>x.status=='present').length;
    r.json({rows,rate:n?Math.round(present/n*1000)/10:null});
  });
  app.get('/api/admin/attendance-overview',auth('admin'),(q,r)=>{
    r.json(db.prepare(`SELECT c.name AS class,COUNT(*) n,SUM(CASE WHEN a.status='present' THEN 1 ELSE 0 END) present
      FROM attendance a JOIN classes c ON c.id=a.class_id GROUP BY c.id ORDER BY c.name`).all()
      .map(x=>({class:x.class,rate:x.n?Math.round(x.present/x.n*1000)/10:null,count:x.n})));
  });

  /* ================= 3. KHẢO SÁT NHANH ================= */
  app.post('/api/polls',auth('gv'),(q,r)=>{
    const question=String(q.body.question||'').trim().slice(0,300),options=(q.body.options||[]).map(x=>String(x).trim().slice(0,100)).filter(Boolean).slice(0,8);
    if(!question||options.length<2||!q.body.class_id)return fail(r,400,'Nhập câu hỏi, ít nhất 2 lựa chọn và chọn lớp');
    if(!db.prepare('SELECT 1 FROM classes WHERE id=?').get(q.body.class_id))return fail(r,404,'Không tìm thấy lớp');
    db.prepare('INSERT INTO polls(teacher_id,class_id,question,options,created_at) VALUES(?,?,?,?,?)').run(q.user.id,q.body.class_id,question,JSON.stringify(options),Date.now());
    r.json({ok:1});
  });
  app.get('/api/polls',auth('gv'),(q,r)=>r.json(db.prepare('SELECT p.*,c.name AS class FROM polls p JOIN classes c ON c.id=p.class_id WHERE p.teacher_id=? ORDER BY p.id DESC').all(q.user.id).map(x=>({...x,options:JSON.parse(x.options)}))));
  app.post('/api/polls/:id/close',auth('gv'),(q,r)=>{const c=db.prepare('UPDATE polls SET closed=1-closed WHERE id=? AND teacher_id=?').run(q.params.id,q.user.id);if(!c.changes)return fail(r,404,'Không tìm thấy khảo sát');r.json({ok:1})});
  const pollResults=(id)=>{
    const p=db.prepare('SELECT * FROM polls WHERE id=?').get(id);if(!p)return null;
    const opts=JSON.parse(p.options),counts=opts.map((o,i)=>db.prepare('SELECT COUNT(*) n FROM poll_votes WHERE poll_id=? AND choice=?').get(id,i).n);
    return{question:p.question,options:opts,counts,total:counts.reduce((a,b)=>a+b,0),closed:!!p.closed};
  };
  app.get('/api/polls/:id/results',auth('gv'),(q,r)=>{
    if(!db.prepare('SELECT 1 FROM polls WHERE id=? AND teacher_id=?').get(q.params.id,q.user.id))return fail(r,404,'Không tìm thấy khảo sát');
    r.json(pollResults(q.params.id));
  });
  app.get('/api/my-polls',auth('hs'),(q,r)=>r.json(db.prepare('SELECT p.id,p.question,p.options,p.created_at,p.closed FROM polls p WHERE p.class_id=? ORDER BY p.id DESC').all(q.user.class_id)
    .map(x=>({...x,options:JSON.parse(x.options),voted:db.prepare('SELECT choice FROM poll_votes WHERE poll_id=? AND user_id=?').get(x.id,q.user.id)?.choice??null}))));
  app.post('/api/polls/:id/vote',auth('hs'),(q,r)=>{
    const p=db.prepare('SELECT * FROM polls WHERE id=? AND class_id=?').get(q.params.id,q.user.class_id);if(!p)return fail(r,404,'Không tìm thấy khảo sát');
    if(p.closed)return fail(r,400,'Khảo sát đã đóng');
    const opts=JSON.parse(p.options),choice=+q.body.choice;if(!(choice>=0&&choice<opts.length))return fail(r,400,'Lựa chọn không hợp lệ');
    db.prepare('INSERT INTO poll_votes(poll_id,user_id,choice) VALUES(?,?,?) ON CONFLICT(poll_id,user_id) DO UPDATE SET choice=excluded.choice').run(q.params.id,q.user.id,choice);
    r.json({ok:1});
  });
  app.get('/api/polls/:id/results-hs',auth('hs'),(q,r)=>{
    if(!db.prepare('SELECT 1 FROM polls WHERE id=? AND class_id=?').get(q.params.id,q.user.class_id))return fail(r,404,'Không tìm thấy khảo sát');
    r.json(pollResults(q.params.id));
  });
};
