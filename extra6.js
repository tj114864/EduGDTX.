// Chức năng mở rộng (phần 6 backend) — 2 mảng mới: Lịch nghỉ/sự kiện chung · Đơn xin nghỉ học
// (Chức vụ cán sự lớp được xử lý trực tiếp trong server.js vì gắn với tạo tài khoản)
module.exports=({app,auth,fail,db})=>{
  /* ================= LỊCH NGHỈ / SỰ KIỆN CHUNG (ai đã đăng nhập cũng xem được) ================= */
  app.post('/api/events',auth('admin'),(q,r)=>{
    const title=String(q.body.title||'').trim().slice(0,150),date=String(q.body.date||'').slice(0,10),note=String(q.body.note||'').trim().slice(0,500);
    if(!title||!/^\d{4}-\d{2}-\d{2}$/.test(date))return fail(r,400,'Nhập tên sự kiện và ngày hợp lệ');
    db.prepare('INSERT INTO events(title,date,note,created_at) VALUES(?,?,?,?)').run(title,date,note||null,Date.now());
    db.logAct(q.user,'thêm sự kiện',title+' · '+date);
    r.json({ok:1});
  });
  app.get('/api/events',auth(),(q,r)=>r.json(db.prepare('SELECT * FROM events ORDER BY date').all()));
  app.delete('/api/events/:id',auth('admin'),(q,r)=>{
    const e=db.prepare('SELECT title FROM events WHERE id=?').get(q.params.id);
    db.prepare('DELETE FROM events WHERE id=?').run(q.params.id);if(e)db.logAct(q.user,'xóa sự kiện',e.title);r.json({ok:1});
  });

  /* ================= ĐƠN XIN NGHỈ HỌC (có ảnh đính kèm, giáo viên xem theo lớp) ================= */
  const fs=require('fs'),path=require('path'),expressLib=require('express');
  const LDIR=path.join(__dirname,'uploads','leaves');fs.mkdirSync(LDIR,{recursive:true});   // nằm ngoài thư mục public nên không ai mở trực tiếp được
  const MAXPH=3;
  const pj=s=>{try{return JSON.parse(s)||[]}catch{return[]}};
  const pub=l=>{const{photos,...x}=l;return{...x,photo_count:pj(photos).length}};
  const imgExt=b=>b&&b.length>12?(b[0]==0xFF&&b[1]==0xD8?'jpg':b[0]==0x89&&b[1]==0x50&&b[2]==0x4E&&b[3]==0x47?'png':b.slice(0,4).toString('latin1')=='RIFF'&&b.slice(8,12).toString('latin1')=='WEBP'?'webp':null):null;
  const dropFiles=l=>pj(l.photos).forEach(f=>fs.unlink(path.join(LDIR,path.basename(f)),()=>{}));

  app.post('/api/leaves',auth('hs'),(q,r)=>{
    const from=String(q.body.date_from||'').slice(0,10),to=String(q.body.date_to||'').slice(0,10),reason=String(q.body.reason||'').trim().slice(0,300);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to)||!reason)return fail(r,400,'Nhập đầy đủ ngày nghỉ và lý do');
    if(to<from)return fail(r,400,'Ngày kết thúc phải sau ngày bắt đầu');
    if(!q.user.class_id)return fail(r,400,'Bạn chưa thuộc lớp nào nên không gửi được đơn');
    const info=db.prepare('INSERT INTO leaves(student_id,class_id,date_from,date_to,reason,status,created_at,photos) VALUES(?,?,?,?,?,?,?,?)').run(q.user.id,q.user.class_id,from,to,reason,'pending',Date.now(),'[]');
    r.json({ok:1,id:Number(info.lastInsertRowid)});
  });
  /* tải ảnh lên (mỗi ảnh một lượt, tối đa 3 ảnh / đơn, chỉ khi đơn còn chờ duyệt) */
  app.post('/api/leaves/:id/photo',auth('hs'),expressLib.raw({type:'application/octet-stream',limit:'6mb'}),(q,r)=>{
    const l=db.prepare('SELECT * FROM leaves WHERE id=? AND student_id=?').get(q.params.id,q.user.id);if(!l)return fail(r,404,'Không tìm thấy đơn xin nghỉ');
    if(l.status!='pending')return fail(r,400,'Đơn đã được xử lý, không thêm ảnh được nữa');
    const list=pj(l.photos);if(list.length>=MAXPH)return fail(r,400,`Mỗi đơn đính kèm tối đa ${MAXPH} ảnh`);
    const ext=imgExt(q.body);if(!ext)return fail(r,400,'Chỉ nhận ảnh JPG, PNG hoặc WEBP');
    const name=`${l.id}-${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
    fs.writeFileSync(path.join(LDIR,name),q.body);list.push(name);
    db.prepare('UPDATE leaves SET photos=? WHERE id=?').run(JSON.stringify(list),l.id);
    r.json({ok:1,count:list.length});
  });
  /* xem ảnh: học sinh chỉ xem đơn của mình, giáo viên / admin xem được tất cả */
  app.get('/api/leaves/:id/photo/:n',auth(),(q,r)=>{
    const l=db.prepare('SELECT * FROM leaves WHERE id=?').get(q.params.id);if(!l)return fail(r,404,'Không tìm thấy đơn xin nghỉ');
    if(q.user.role=='hs'&&l.student_id!=q.user.id)return fail(r,403,'Không có quyền');
    const f=pj(l.photos)[+q.params.n];if(!f)return fail(r,404,'Không có ảnh');
    r.set('Cache-Control','private, max-age=3600');r.sendFile(path.join(LDIR,path.basename(f)));
  });
  app.get('/api/my-leaves',auth('hs'),(q,r)=>r.json(db.prepare('SELECT l.*,u.name AS reviewer FROM leaves l LEFT JOIN users u ON u.id=l.reviewed_by WHERE l.student_id=? ORDER BY l.id DESC').all(q.user.id).map(pub)));
  app.delete('/api/leaves/:id',auth('hs'),(q,r)=>{
    const l=db.prepare('SELECT * FROM leaves WHERE id=? AND student_id=?').get(q.params.id,q.user.id);if(!l)return fail(r,404,'Không tìm thấy đơn xin nghỉ');
    if(l.status!='pending')return fail(r,400,'Đơn đã được xử lý, không rút lại được');
    dropFiles(l);db.prepare('DELETE FROM leaves WHERE id=?').run(l.id);r.json({ok:1});
  });
  /* giáo viên: toàn bộ đơn, kèm tên lớp; giao diện sẽ chia theo lớp */
  app.get('/api/leaves',auth('gv'),(q,r)=>{
    const status=['pending','approved','rejected'].includes(q.query.status)?q.query.status:null;
    const sql=`SELECT l.*,u.name AS student,c.name AS class,rv.name AS reviewer FROM leaves l JOIN users u ON u.id=l.student_id JOIN classes c ON c.id=l.class_id LEFT JOIN users rv ON rv.id=l.reviewed_by ${status?'WHERE l.status=?':''} ORDER BY l.status='pending' DESC,l.id DESC`;
    r.json((status?db.prepare(sql).all(status):db.prepare(sql).all()).map(pub));
  });
  app.post('/api/leaves/:id/seen',auth('gv'),(q,r)=>{
    db.prepare('UPDATE leaves SET seen_at=?,seen_by=? WHERE id=? AND seen_at IS NULL').run(Date.now(),q.user.id,q.params.id);r.json({ok:1});
  });
  app.post('/api/leaves/:id/review',auth('gv'),(q,r)=>{
    const l=db.prepare('SELECT * FROM leaves WHERE id=?').get(q.params.id);if(!l)return fail(r,404,'Không tìm thấy đơn xin nghỉ');
    if(!['approved','rejected'].includes(q.body.status))return fail(r,400,'Trạng thái không hợp lệ');
    const note=String(q.body.note||'').trim().slice(0,300)||null;
    db.prepare('UPDATE leaves SET status=?,reviewed_by=?,reviewed_at=?,review_note=?,seen_at=COALESCE(seen_at,?),seen_by=COALESCE(seen_by,?) WHERE id=?').run(q.body.status,q.user.id,Date.now(),note,Date.now(),q.user.id,l.id);
    r.json({ok:1});
  });

  /* ================= CÁN SỰ LỚP: học sinh xem ban cán sự lớp mình ================= */
  app.get('/api/my-officers',auth('hs'),(q,r)=>r.json(db.prepare("SELECT name,title FROM users WHERE role='hs' AND class_id=? AND title IS NOT NULL ORDER BY title").all(q.user.class_id)));
};
