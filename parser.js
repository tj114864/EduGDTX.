// Nhận diện câu hỏi từ văn bản (Word / PDF / dán trực tiếp)
const T=s=>String(s||'').replace(/\u00a0/g,' ').trim();
const LET='A-Za-zÀ-ỹ';

// HTML (từ mammoth) → text; in đậm / gạch chân được đánh dấu bằng \u0001 ... \u0002
function htmlToText(h){
  return String(h).replace(/<\/p>|<br\s*\/?>|<\/li>|<\/tr>/gi,'\n')
    .replace(/<(strong|b|u)>/gi,'\u0001').replace(/<\/(strong|b|u)>/gi,'\u0002')
    .replace(/<[^>]+>/g,'').replace(/&nbsp;/g,' ').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&amp;/g,'&');
}
// "a-Đ b-S c-Đ d-S" | "ĐSĐS" | "a) Đúng b) Sai ..." → "DSDS"
function tfKey(s){
  s=String(s).replace(/Đúng/gi,'Đ').replace(/Sai/gi,'S');
  const o={};let m;const re=/([a-d])\s*[)\-–:=.]?\s*([ĐSđs])/gi;
  while((m=re.exec(s)))o[m[1].toLowerCase()]=m[2].toUpperCase();
  const conv=x=>x.replace(/Đ/g,'D');
  if(['a','b','c','d'].every(k=>o[k]))return conv('abcd'.split('').map(k=>o[k]).join(''));
  const c=s.replace(/[^ĐSđs]/g,'').toUpperCase();return c.length==4?conv(c):'';
}
// Word (.docx): đọc thẳng word/document.xml để nhận ra đáp án đúng được in đậm / gạch chân / tô màu / tô nền
const xmlDec=t=>t.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&');

/* ---------- Công thức Word (OMML) → LaTeX, để nhập đề .docx có công thức toán ---------- */
function xmlTree(x){
  const root={n:'#',a:{},c:[]},st=[root];
  for(const m of x.matchAll(/<(\/?)([\w:.-]+)((?:\s+[\w:.-]+\s*=\s*"[^"]*")*)\s*(\/?)>|([^<]+)/g)){
    const top=st[st.length-1];
    if(m[5]!==undefined){top.c.push(m[5]);continue}
    if(m[1]){if(st.length>1)st.pop();continue}
    const a={};for(const am of m[3].matchAll(/([\w:.-]+)\s*=\s*"([^"]*)"/g))a[am[1]]=am[2];
    const nd={n:m[2],a,c:[]};top.c.push(nd);if(!m[4])st.push(nd);
  }
  return root;
}
const OSYM={'×':'\\times ','÷':'\\div ','±':'\\pm ','∓':'\\mp ','≤':'\\leq ','≥':'\\geq ','≠':'\\neq ','≈':'\\approx ','≡':'\\equiv ','∞':'\\infty ','→':'\\to ','←':'\\leftarrow ','⇒':'\\Rightarrow ','⇔':'\\Leftrightarrow ','⇐':'\\Leftarrow ','∈':'\\in ','∉':'\\notin ','⊂':'\\subset ','⊆':'\\subseteq ','⊃':'\\supset ','∪':'\\cup ','∩':'\\cap ','∅':'\\emptyset ','∀':'\\forall ','∃':'\\exists ','∠':'\\angle ','⊥':'\\perp ','∥':'\\parallel ','°':'^\\circ ','·':'\\cdot ','⋅':'\\cdot ','…':'\\ldots ','⋯':'\\cdots ','′':"'",'∂':'\\partial ','∇':'\\nabla ','△':'\\triangle ','−':'-','∼':'\\sim ','≅':'\\cong ','∝':'\\propto ','∴':'\\therefore ','∵':'\\because ',
  'α':'\\alpha ','β':'\\beta ','γ':'\\gamma ','δ':'\\delta ','ε':'\\varepsilon ','ϵ':'\\epsilon ','θ':'\\theta ','λ':'\\lambda ','μ':'\\mu ','π':'\\pi ','ρ':'\\rho ','σ':'\\sigma ','τ':'\\tau ','φ':'\\varphi ','ϕ':'\\phi ','ω':'\\omega ','Δ':'\\Delta ','Σ':'\\Sigma ','Ω':'\\Omega ','Φ':'\\Phi ','Π':'\\Pi ','Λ':'\\Lambda ','ℝ':'\\mathbb{R}','ℕ':'\\mathbb{N}','ℤ':'\\mathbb{Z}','ℚ':'\\mathbb{Q}','ℂ':'\\mathbb{C}'};
const OESC={'{':'\\{','}':'\\}','%':'\\%','#':'\\#','&':'\\&','_':'\\_','$':'\\$'};
const OFN=new Set('sin cos tan cot sec csc arcsin arccos arctan sinh cosh tanh log ln lg exp lim max min sup inf det gcd'.split(' '));
const otext=t=>[...xmlDec(t)].map(c=>OSYM[c]??OESC[c]??c).join('');
const OCH={'(':'(',')':')','[':'[',']':']','{':'\\{','}':'\\}','|':'|','‖':'\\|','⟨':'\\langle ','⟩':'\\rangle ','⌊':'\\lfloor ','⌋':'\\rfloor ','⌈':'\\lceil ','⌉':'\\rceil '};
function omml(nd){
  if(typeof nd=='string')return '';
  const kids=nd.c.filter(k=>typeof k!='string'),k=name=>kids.find(x=>x.n==name),g=name=>{const x=k(name);return x?omml(x):''};
  const all=()=>kids.map(omml).join('');
  const val=(pr,tag)=>{const p=k(pr);const x=p&&p.c.find(y=>y.n==tag);return x?x.a['m:val']:undefined};
  const br=t=>'{'+(t||'')+'}';
  switch(nd.n){
    case'm:t':return otext(nd.c.join(''));
    case'm:r':{
      const rp=k('m:rPr'),plain=rp&&rp.c.some(y=>y.n=='m:sty'&&y.a['m:val']=='p'),nor=rp&&rp.c.some(y=>y.n=='m:nor');
      const raw=kids.filter(y=>y.n=='m:t').map(y=>xmlDec(y.c.join(''))).join('');
      if(nor&&raw.trim())return '\\text{'+raw+'}';
      if(OFN.has(raw.trim()))return '\\'+raw.trim()+' ';
      if(plain&&/^[A-Za-z]{2,}$/.test(raw))return '\\mathrm{'+raw+'}';
      return kids.filter(y=>y.n=='m:t').map(omml).join('');
    }
    case'm:f':{const type=val('m:fPr','m:type'),n=g('m:num'),d=g('m:den');return type=='lin'?br(n)+'/'+br(d):type=='noBar'?`\\binom${br(n)}${br(d)}`:`\\frac${br(n)}${br(d)}`}
    case'm:rad':{const deg=g('m:deg'),hide=val('m:radPr','m:degHide');return deg&&hide!='1'&&hide!='true'?`\\sqrt[${deg}]${br(g('m:e'))}`:`\\sqrt${br(g('m:e'))}`}
    case'm:sSup':return br(g('m:e'))+'^'+br(g('m:sup'));
    case'm:sSub':return br(g('m:e'))+'_'+br(g('m:sub'));
    case'm:sSubSup':return br(g('m:e'))+'_'+br(g('m:sub'))+'^'+br(g('m:sup'));
    case'm:sPre':return '{}_'+br(g('m:sub'))+'^'+br(g('m:sup'))+br(g('m:e'));
    case'm:nary':{
      const ch=val('m:naryPr','m:chr'),op=({'∑':'\\sum','∏':'\\prod','∫':'\\int','∬':'\\iint','∭':'\\iiint','∮':'\\oint','⋃':'\\bigcup','⋂':'\\bigcap'})[ch||'∫']||'\\int';
      const sub=g('m:sub'),sup=g('m:sup');return op+(sub?'_'+br(sub):'')+(sup?'^'+br(sup):'')+' '+br(g('m:e'));
    }
    case'm:d':{
      const pr=k('m:dPr'),beg=pr&&pr.c.find(y=>y.n=='m:begChr'),end=pr&&pr.c.find(y=>y.n=='m:endChr'),sep=pr&&pr.c.find(y=>y.n=='m:sepChr');
      const b=beg?beg.a['m:val']:'(',e=end?end.a['m:val']:')',sp=sep?sep.a['m:val']:'|';
      const L=b===''?'.':OCH[b]??b,R=e===''?'.':OCH[e]??e;
      const es=kids.filter(y=>y.n=='m:e');
      if(b=='{'&&e===''&&es.length==1&&es[0].c.some(y=>y.n=='m:eqArr'))return '\\begin{cases}'+omml(es[0].c.find(y=>y.n=='m:eqArr')).replace(/^\\begin\{aligned\}|\\end\{aligned\}$/g,'')+'\\end{cases}';
      return `\\left${L} `+es.map(omml).join(sp===','||sp===';'?sp:(OCH[sp]??sp))+` \\right${R}`;
    }
    case'm:eqArr':return '\\begin{aligned}'+kids.filter(y=>y.n=='m:e').map(omml).join(' \\\\ ')+'\\end{aligned}';
    case'm:m':return '\\begin{matrix}'+kids.filter(y=>y.n=='m:mr').map(r=>r.c.filter(y=>typeof y!='string'&&y.n=='m:e').map(omml).join(' & ')).join(' \\\\ ')+'\\end{matrix}';
    case'm:func':{const fn=g('m:fName').trim();return (OFN.has(fn)?'\\'+fn:fn)+' '+g('m:e')}
    case'm:limLow':{const e=g('m:e').trim();return (OFN.has(e)?'\\'+e:br(e))+'_'+br(g('m:lim'))}
    case'm:limUpp':return `\\overset${br(g('m:lim'))}${br(g('m:e'))}`;
    case'm:acc':{const ch=val('m:accPr','m:chr');const cmd=({'⃗':'\\vec','̂':'\\hat','^':'\\hat','̃':'\\tilde','~':'\\tilde','¯':'\\bar','̄':'\\bar','→':'\\vec','˙':'\\dot','̇':'\\dot'})[ch]||'\\hat';return cmd+br(g('m:e'))}
    case'm:bar':return (val('m:barPr','m:pos')=='bot'?'\\underline':'\\overline')+br(g('m:e'));
    case'm:oMathPara':return '\u0003'+all();
    case'm:oMath':case'm:e':case'm:num':case'm:den':case'm:sub':case'm:sup':case'm:deg':case'm:lim':case'm:fName':case'm:box':case'm:borderBox':case'm:groupChr':case'm:phant':case'm:mr':return all();
    default:return nd.n.endsWith('Pr')?'':all();
  }
}
// thay mỗi công thức Word trong một đoạn bằng văn bản $latex$ (m:oMathPara → $$...$$)
function replaceOmml(pxml){
  if(!/<m:oMath/.test(pxml))return pxml;
  const enc=t=>t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const run=t=>`<w:r><w:t xml:space="preserve">${enc(t)}</w:t></w:r>`;
  let out=pxml.replace(/<m:oMathPara\b[^>]*>([\s\S]*?)<\/m:oMathPara>/g,(_,inner)=>{
    const tex=omml(xmlTree(inner)).replace(/\u0003/g,'').replace(/\s+/g,' ').trim();return tex?run('$$'+tex+'$$'):''});
  out=out.replace(/<m:oMath\b[^>]*>([\s\S]*?)<\/m:oMath>/g,(_,inner)=>{
    const tex=omml(xmlTree(inner)).replace(/\s+/g,' ').trim();return tex?run('$'+tex+'$'):''});
  return out;
}
function docxXmlToText(xml){
  const out=[];
  for(const pm of String(xml).matchAll(/<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g)){
    let line='';
    for(const rm of replaceOmml(pm[1]).matchAll(/<(w:r|m:r)\b[^>]*>([\s\S]*?)<\/\1>/g)){
      const rpr=(rm[2].match(/<w:rPr>([\s\S]*?)<\/w:rPr>/)||[])[1]||'';
      const on=v=>!/^(0|false|none)$/i.test(v||'');
      let em=false,m;
      if((m=rpr.match(/<w:b(?:\s+w:val="([^"]*)")?\s*\/>/))&&on(m[1]))em=true;
      if((m=rpr.match(/<w:u\b[^>]*?w:val="([^"]*)"/))&&on(m[1]))em=true;
      if((m=rpr.match(/<w:color\b[^>]*?w:val="([^"]*)"/))&&!/^(auto|000000|FFFFFF|404040|262626)$/i.test(m[1])&&!/^([0-9a-f]{2})\1\1$/i.test(m[1]))em=true;   // chữ xám = đáp án không được chọn
      if((m=rpr.match(/<w:highlight\b[^>]*?w:val="([^"]*)"/))&&on(m[1]))em=true;
      if((m=rpr.match(/<w:shd\b[^>]*?w:fill="([^"]*)"/))&&!/^(auto|FFFFFF)$/i.test(m[1]))em=true;
      let t='';
      for(const tm of rm[2].matchAll(/<(?:w:t|m:t)\b[^>]*>([\s\S]*?)<\/(?:w:t|m:t)>|<w:tab\s*\/>|<w:br\b[^>]*\/>/g))t+=tm[0].startsWith('<w:tab')?' ':tm[0].startsWith('<w:br')?'\n':xmlDec(tm[1]);
      if(!t)continue;
      line+=em&&t.trim()?'\u0001'+t+'\u0002':t;
    }
    out.push(line);
  }
  return out.join('\n');
}

// tách ký tự đánh dấu \u0001 \u0002 → chuỗi sạch + mảng "được nhấn mạnh" cho từng ký tự
function splitEm(L){let clean='',em=[],d=0;for(const ch of String(L)){if(ch=='\u0001'){d++;continue}if(ch=='\u0002'){d=Math.max(0,d-1);continue}clean+=ch;em.push(d>0)}return{clean,em}}
const TICK=/\s*(?:✓|✔|✅|☑|\(\s*(?:đúng|đ|correct|\*)\s*\)|\[\s*(?:đúng|x)\s*\])\s*$/i;
const KEYLINE=/^(?:Đáp\s*án|ĐA|Lời\s*giải|Key|Answer)(?:\s*đúng)?(?:\s*là)?\s*[:：.\-]?\s*(.*)$/i;

function parseQuestions(text){
  let raw=String(text).normalize('NFC').replace(/\r/g,'').split('\n');   // chuẩn hóa dấu tiếng Việt (Word đôi khi lưu chữ ở dạng tổ hợp)
  // "D. Cần Thơ   Đáp án: B" (đáp án nằm cùng dòng) → tách thành 2 dòng
  raw=raw.flatMap(l=>{const m=l.match(/^(.*\S)\s{2,}((?:\u0001|\u0002)*(?:Đáp\s*án|ĐA)\s*[:：].*)$/i)||l.match(/^(.*[.)\]]\S*)\s+((?:Đáp\s*án|ĐA)\s*[:：].*)$/i);return m&&/^[\u0001\u0002\s]*[A-D][.)]/.test(m[1])?[m[1],m[2]]:[l]});
  const plain=l=>T(l.replace(/[\u0001\u0002]/g,''));
  const ki=raw.findIndex(l=>{const t=plain(l);return t&&(t==t.toUpperCase()&&/^(BẢNG\s+)?(ĐÁP\s*ÁN|LỜI\s*GIẢI|HƯỚNG\s*DẪN\s*GIẢI)([^:]{0,40})?:?$/.test(t)||/^(bảng\s+)?đáp\s*án(\s+và\s+(lời\s*giải|hướng\s*dẫn\s*giải))?\s*:?$/i.test(t))});
  const body=ki<0?raw:raw.slice(0,ki),keyLines=ki<0?[]:raw.slice(ki+1).map(plain).filter(Boolean),keyText=keyLines.join(' ');
  const qs=[];let cur=null,last='c';
  for(const L of body){
    const {clean,em}=splitEm(L);
    const s0=clean.search(/[^\s*]/);if(s0<0)continue;
    const star=/^\s*\*/.test(clean);
    const line0=clean.slice(s0).replace(/ /g,' '),em0=em.slice(s0),line=T(line0);if(!line)continue;
    let m=line.match(/^(?:Câu|Bài|Question)\s*(\d+)\s*[.:)\-–]?\s*(.*)$/i);
    if(m){cur={num:+m[1],content:m[2],opts:[],flags:[],stm:[],key:null};qs.push(cur);last='c';continue}
    if(!cur)continue;
    m=line.match(KEYLINE);
    if(m&&(/^(?:Đáp\s*án|ĐA|Lời\s*giải|Key|Answer)(?:\s*đúng)?(?:\s*là)?\s*[:：.\-]/i.test(line)||/^(?:Đáp\s*án|ĐA)(?:\s*đúng)?(?:\s*là)?\s+[A-Da-d]\s*\.?$/i.test(line))){cur.key=m[1];last='k';continue}
    m=line.match(/^Chọn\s*[:：]?\s*([A-D])\s*\.?$/i);
    if(m){cur.key=m[1];last='k';continue}
    if(/^[A-D][.)]\s/.test(line)){
      const cuts=[0];for(const x of line.matchAll(/\s+(?=[B-D][.)]\s)/g))cuts.push(x.index+x[0].length);
      cuts.forEach((a,i)=>{
        const b=i+1<cuts.length?cuts[i+1]:line.length,seg=line.slice(a,b),o=seg.match(/^([A-D])[.)]\s*([\s\S]*)$/);if(!o)return;
        const flags=em0.slice(a,b),nz=[...seg].map((c,k)=>/\S/.test(c)?k:-1).filter(k=>k>=0),ratio=nz.length?nz.filter(k=>flags[k]).length/nz.length:0;
        let txt=o[2].trim(),f=!!flags[0]||ratio>=.6||(i==0&&star);
        if(TICK.test(txt)){txt=txt.replace(TICK,'').trim();f=true}
        cur.opts.push(txt);cur.flags.push(f)});
      last='o';continue}
    if(/^[a-d][.)]\s/.test(line)){
      // đáp án Đúng/Sai ghi ngay cuối ý: "... [ ĐÚNG ]   [ Sai ]" – chữ IN HOA (hoặc được in đậm / tô màu) là đáp án đúng
      let st=line.replace(/^[a-d][.)]\s*/,''),tv='';
      const tail=st.match(/(?:\s*[\[(（]\s*(?:đúng|sai)\s*[\])）]){1,2}[\s.;,]*$/i);
      if(tail){
        const base=line.length-st.length+tail.index,toks=[...tail[0].matchAll(/[\[(（]\s*(đúng|sai)\s*[\])）]/gi)].map(x=>{const a=base+x.index,e=em0.slice(a,a+x[0].length);return{v:/^đ/i.test(x[1])?'D':'S',up:x[1]==x[1].toUpperCase(),em:e.filter(Boolean).length/x[0].length}});
        if(toks.length==1)tv=toks[0].v;
        else if(toks.length==2){const U=toks.filter(t=>t.up);if(U.length==1)tv=U[0].v;else if(toks[0].em!=toks[1].em)tv=(toks[0].em>toks[1].em?toks[0]:toks[1]).v}
        st=st.slice(0,tail.index).trim()}
      cur.stm.push(st);(cur.tfk=cur.tfk||[]).push(tv);last='s';continue}
    if(last=='o'&&cur.opts.length)cur.opts[cur.opts.length-1]+=' '+line;
    else if(last=='s'&&cur.stm.length)cur.stm[cur.stm.length-1]+=' '+line;
    else if(last=='k')cur.key+=' '+line;
    else cur.content+='\n'+line;
  }
  // bảng đáp án cuối đề: "1. A 2. B", "Câu 1: B", "1-A", hoặc bảng ngang (hàng số rồi hàng chữ)
  const gk={};
  if(keyText){const re=/(?:Câu\s*)?(\d{1,3})\s*[.:\-–)]\s*([^\d]*?)(?=\s*(?:Câu\s*)?\d{1,3}\s*[.:\-–)]|$)/gs;let m;while((m=re.exec(keyText)))gk[+m[1]]=m[2].trim();
    if(!Object.keys(gk).length){const tk=keyText.split(/\s+/),h=tk.length/2;if(Number.isInteger(h)&&h>0&&tk.slice(0,h).every(x=>/^\d{1,3}$/.test(x))&&tk.slice(h).every(x=>/^[A-Da-d]$/.test(x)))tk.slice(0,h).forEach((n,i)=>gk[+n]=tk[h+i].toUpperCase())}
    if(!Object.keys(gk).length){const re2=/(\d{1,3})\s+([A-Da-d])(?![A-Za-zÀ-ỹ])/g;while((m=re2.exec(keyText)))gk[+m[1]]=m[2].toUpperCase()}}
  return qs.map(q=>{
    const key=T(q.key||gk[q.num]||'');
    let content=T(q.content),points=null;
    const pm=content.match(/\(\s*(\d+(?:[.,]\d+)?)\s*điểm\s*\)/i);
    if(pm){points=+pm[1].replace(',','.');content=T(content.replace(pm[0],''))}
    const warn=[];
    if(q.stm.length>=4){
      const k=q.tfk&&q.tfk.length>=4&&q.tfk.slice(0,4).every(Boolean)?q.tfk.slice(0,4).join(''):tfKey(key);if(!k)warn.push('Chưa nhận diện được đáp án Đúng/Sai – hãy chọn Đúng/Sai cho từng ý');
      return{type:'tf',content,options:q.stm.slice(0,4),key:k||'----',answer:0,points,model:'',warn}}
    if(q.opts.length>=2){
      const o=q.opts.slice(0,4);while(o.length<4)o.push('');
      let a=-1;const Lt=(key.match(new RegExp(`(?:^|[^${LET}])([A-Da-d])(?![${LET}])`))||[])[1];
      if(Lt&&(/^[A-D]$/.test(Lt)||/^\s*[a-d]\s*[.)]?\s*$/.test(key)))a='ABCD'.indexOf(Lt.toUpperCase());
      if(a<0&&key){const kn=key.replace(/^[A-D][.)]\s*/,'').toLowerCase(),ix=q.opts.slice(0,4).findIndex(x=>x.trim()&&x.trim().toLowerCase()==kn);if(ix>=0)a=ix}
      if(a<0){const f=q.flags.slice(0,4).map((x,i)=>x?i:-1).filter(i=>i>=0);if(f.length==1)a=f[0]}
      if(a<0)warn.push('Chưa nhận diện được đáp án đúng – hãy chọn');if(q.opts.length<4)warn.push('Thiếu đáp án');
      return{type:'mc',content,options:o,answer:a,key:null,points,model:'',warn}}
    return{type:'essay',content,options:[],answer:0,key:null,points,model:key,warn:[]}
  });
}
module.exports={parseQuestions,htmlToText,tfKey,docxXmlToText,replaceOmml};
