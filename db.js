const{DatabaseSync}=require('node:sqlite'),bcrypt=require('bcryptjs');   // SQLite có sẵn trong Node 22.13+ → không cần cài thêm/biên dịch
const db=new DatabaseSync(__dirname+'/data.db');db.exec('PRAGMA journal_mode=WAL;PRAGMA foreign_keys=ON;');
db.transaction=f=>()=>{db.exec('BEGIN');try{f();db.exec('COMMIT')}catch(e){db.exec('ROLLBACK');throw e}};
db.exec(`
CREATE TABLE IF NOT EXISTS classes(id INTEGER PRIMARY KEY,name TEXT UNIQUE NOT NULL);
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY,username TEXT UNIQUE NOT NULL,password TEXT NOT NULL,name TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN('admin','gv','hs')),class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL);
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS exams(id INTEGER PRIMARY KEY,title TEXT NOT NULL,class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,teacher_id INTEGER,minutes INTEGER NOT NULL,deadline TEXT,mode TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS questions(id INTEGER PRIMARY KEY,exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,content TEXT NOT NULL,options TEXT NOT NULL,answer INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS attempts(id INTEGER PRIMARY KEY,exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,started_at INTEGER NOT NULL,submitted_at INTEGER,score REAL,correct INTEGER,total INTEGER,violations INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS answers(attempt_id INTEGER NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,question_id INTEGER NOT NULL,picked INTEGER,PRIMARY KEY(attempt_id,question_id));
CREATE TABLE IF NOT EXISTS announcements(id INTEGER PRIMARY KEY,class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,teacher_id INTEGER NOT NULL,content TEXT NOT NULL,created_at INTEGER NOT NULL);
`);
// Nâng cấp cấu trúc cho DB cũ (thêm cột nếu chưa có)
const addCol=(t,c,def)=>{if(!db.prepare(`PRAGMA table_info(${t})`).all().some(x=>x.name==c))db.exec(`ALTER TABLE ${t} ADD COLUMN ${c} ${def}`)};
addCol('exams','start_at','TEXT');addCol('exams','show_answer','INTEGER DEFAULT 0');addCol('exams','shuffle','INTEGER DEFAULT 1');addCol('exams','show_score','INTEGER DEFAULT 1');addCol('exams','max_viol','INTEGER DEFAULT 3');addCol('exams','code','TEXT');
addCol('questions','type',"TEXT DEFAULT 'mc'");addCol('questions','key','TEXT');addCol('questions','points','REAL DEFAULT 1');addCol('questions','model','TEXT');
addCol('answers','text','TEXT');addCol('answers','earned','REAL');addCol('attempts','pending','INTEGER DEFAULT 0');
addCol('users','locked','INTEGER DEFAULT 0');addCol('users','lock_reason','TEXT');
addCol('attempts','draft','TEXT');addCol('attempts','qorder','TEXT');addCol('attempts','last_seen','INTEGER');addCol('attempts','extra_min','INTEGER DEFAULT 0');
db.exec('CREATE TABLE IF NOT EXISTS bank(id INTEGER PRIMARY KEY,teacher_id INTEGER NOT NULL,tag TEXT,type TEXT NOT NULL,content TEXT NOT NULL,options TEXT NOT NULL,answer INTEGER NOT NULL DEFAULT 0,key TEXT,points REAL DEFAULT 1,model TEXT,created_at INTEGER)');
db.exec('CREATE TABLE IF NOT EXISTS mistakes(user_id INTEGER NOT NULL,question_id INTEGER NOT NULL,cleared_at INTEGER NOT NULL,PRIMARY KEY(user_id,question_id))');
db.exec('CREATE TABLE IF NOT EXISTS feedback(id INTEGER PRIMARY KEY,exam_id INTEGER NOT NULL,question_id INTEGER NOT NULL,user_id INTEGER NOT NULL,content TEXT NOT NULL,created_at INTEGER NOT NULL,resolved INTEGER DEFAULT 0)');
db.exec('CREATE TABLE IF NOT EXISTS remarks(teacher_id INTEGER NOT NULL,student_id INTEGER NOT NULL,content TEXT NOT NULL,updated_at INTEGER NOT NULL,PRIMARY KEY(teacher_id,student_id))');
db.exec('CREATE TABLE IF NOT EXISTS favorites(user_id INTEGER NOT NULL,exam_id INTEGER NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(user_id,exam_id))');
addCol('users','goal_score','REAL');
addCol('attempts','manual','INTEGER DEFAULT 0');
addCol('attempts','note','TEXT');
addCol('attempts','predicted','REAL');
db.exec('CREATE TABLE IF NOT EXISTS materials(id INTEGER PRIMARY KEY,teacher_id INTEGER NOT NULL,class_id INTEGER NOT NULL,title TEXT NOT NULL,content TEXT,link TEXT,created_at INTEGER NOT NULL)');
db.exec('CREATE TABLE IF NOT EXISTS attendance(id INTEGER PRIMARY KEY,class_id INTEGER NOT NULL,teacher_id INTEGER NOT NULL,date TEXT NOT NULL,student_id INTEGER NOT NULL,status TEXT NOT NULL,UNIQUE(class_id,date,student_id))');
db.exec('CREATE TABLE IF NOT EXISTS polls(id INTEGER PRIMARY KEY,teacher_id INTEGER NOT NULL,class_id INTEGER NOT NULL,question TEXT NOT NULL,options TEXT NOT NULL,created_at INTEGER NOT NULL,closed INTEGER DEFAULT 0)');
db.exec('CREATE TABLE IF NOT EXISTS poll_votes(poll_id INTEGER NOT NULL,user_id INTEGER NOT NULL,choice INTEGER NOT NULL,PRIMARY KEY(poll_id,user_id))');
addCol('users','title','TEXT');
db.exec('CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY,title TEXT NOT NULL,date TEXT NOT NULL,note TEXT,created_at INTEGER NOT NULL)');
db.exec("CREATE TABLE IF NOT EXISTS leaves(id INTEGER PRIMARY KEY,student_id INTEGER NOT NULL,class_id INTEGER NOT NULL,date_from TEXT NOT NULL,date_to TEXT NOT NULL,reason TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',created_at INTEGER NOT NULL,reviewed_by INTEGER,reviewed_at INTEGER)");
addCol('leaves','photos','TEXT');addCol('leaves','review_note','TEXT');addCol('leaves','seen_at','INTEGER');addCol('leaves','seen_by','INTEGER');
db.exec('CREATE TABLE IF NOT EXISTS violations(id INTEGER PRIMARY KEY,attempt_id INTEGER NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,user_id INTEGER NOT NULL,kind TEXT NOT NULL,at INTEGER NOT NULL)');
db.exec('CREATE TABLE IF NOT EXISTS activity_log(id INTEGER PRIMARY KEY,actor_id INTEGER,actor_name TEXT,role TEXT,action TEXT NOT NULL,detail TEXT,at INTEGER NOT NULL)');
const _insLog=db.prepare('INSERT INTO activity_log(actor_id,actor_name,role,action,detail,at) VALUES(?,?,?,?,?,?)');
db.logAct=(user,action,detail)=>{try{_insLog.run(user?user.id:null,user?user.name:null,user?user.role:null,String(action).slice(0,80),detail?String(detail).slice(0,300):null,Date.now())}catch(e){}};
const h=p=>bcrypt.hashSync(p,10);
// Danh sách lớp: 10 (B-I), 11 (B-F), 12 (B-I, K, M)
const ic=db.prepare('INSERT OR IGNORE INTO classes(name) VALUES(?)');
const LOP={10:'BCDEFGHI',11:'BCDEF',12:'BCDEFGHIKM'};
for(const k in LOP)for(const ch of LOP[k])ic.run(k+ch);
// Tài khoản admin (tạo lại nếu chưa có; admin cũ bị thay thế)
if(!db.prepare("SELECT 1 FROM users WHERE username='admingdtx'").get()){
  db.prepare("DELETE FROM users WHERE role='admin'").run();
  db.prepare('INSERT INTO users(username,password,name,role,class_id) VALUES(?,?,?,?,?)').run('admingdtx',h('Admin123@'),'Quản trị viên','admin',null);
}
module.exports=db;
