/* =====================================================================
   mathtex.js – hiển thị công thức toán (LaTeX) KHÔNG cần mạng, không cần thư viện ngoài.
   - Chuyển LaTeX → MathML (trình duyệt tự vẽ). Dùng được trong web, Electron, Android WebView mới.
   - Viết công thức trong nội dung bằng  $...$  (cùng dòng)  hoặc  $$...$$  (riêng một dòng).
       ví dụ:  Giải phương trình $x^2-5x+6=0$ ;  $$\frac{-b\pm\sqrt{b^2-4ac}}{2a}$$
   - TeXMath.typeset(root)  : thay mọi công thức trong root bằng MathML
   - TeXMath.auto()         : tự động xử lý mọi nội dung mới xuất hiện trong trang
   - TeXMath.render(tex,{display}) : trả về chuỗi HTML <math>
   ===================================================================== */
(function(g){
'use strict';
const X=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

/* ---------- bảng ký hiệu ---------- */
const GL={alpha:'α',beta:'β',gamma:'γ',delta:'δ',epsilon:'ϵ',varepsilon:'ε',zeta:'ζ',eta:'η',theta:'θ',vartheta:'ϑ',iota:'ι',kappa:'κ',lambda:'λ',mu:'μ',nu:'ν',xi:'ξ',pi:'π',varpi:'ϖ',rho:'ρ',varrho:'ϱ',sigma:'σ',varsigma:'ς',tau:'τ',upsilon:'υ',phi:'ϕ',varphi:'φ',chi:'χ',psi:'ψ',omega:'ω'};
const GU={Gamma:'Γ',Delta:'Δ',Theta:'Θ',Lambda:'Λ',Xi:'Ξ',Pi:'Π',Sigma:'Σ',Upsilon:'Υ',Phi:'Φ',Psi:'Ψ',Omega:'Ω'};
const OP={cdot:'⋅',times:'×',div:'÷',pm:'±',mp:'∓',leq:'≤',le:'≤',geq:'≥',ge:'≥',neq:'≠',ne:'≠',approx:'≈',equiv:'≡',sim:'∼',simeq:'≃',cong:'≅',propto:'∝',ll:'≪',gg:'≫',
  to:'→',rightarrow:'→',leftarrow:'←',gets:'←',Rightarrow:'⇒',Leftarrow:'⇐',Leftrightarrow:'⇔',iff:'⇔',leftrightarrow:'↔',mapsto:'↦',uparrow:'↑',downarrow:'↓',implies:'⇒',
  in:'∈',notin:'∉',ni:'∋',subset:'⊂',subseteq:'⊆',supset:'⊃',supseteq:'⊇',cup:'∪',cap:'∩',setminus:'∖',emptyset:'∅',varnothing:'∅',
  forall:'∀',exists:'∃',nexists:'∄',neg:'¬',lnot:'¬',land:'∧',wedge:'∧',lor:'∨',vee:'∨',perp:'⊥',parallel:'∥',nparallel:'∦',angle:'∠',measuredangle:'∡',triangle:'△',circ:'∘',bullet:'•',star:'⋆',ast:'∗',oplus:'⊕',otimes:'⊗',
  partial:'∂',nabla:'∇',ldots:'…',dots:'…',cdots:'⋯',vdots:'⋮',ddots:'⋱',prime:'′',hbar:'ℏ',ell:'ℓ',infty:'∞',mid:'∣',nmid:'∤',because:'∵',therefore:'∴',degree:'°',
  lfloor:'⌊',rfloor:'⌋',lceil:'⌈',rceil:'⌉',langle:'⟨',rangle:'⟩',lbrace:'{',rbrace:'}',Re:'ℜ',Im:'ℑ',aleph:'ℵ',square:'□',checkmark:'✓',
  'lt':'<','gt':'>','|':'‖','{':'{','}':'}','%':'%','$':'$','&':'&','#':'#','_':'_','-':'-'};
const BIG={sum:'∑',prod:'∏',coprod:'∐',bigcup:'⋃',bigcap:'⋂',bigoplus:'⨁',bigvee:'⋁',bigwedge:'⋀'};
const INT={int:'∫',iint:'∬',iiint:'∭',oint:'∮'};
const FN=new Set('sin cos tan cot sec csc arcsin arccos arctan sinh cosh tanh coth log ln lg exp det gcd deg dim ker arg hom Pr lim max min sup inf limsup liminf'.split(' '));
const FNLIM=new Set('lim max min sup inf limsup liminf det gcd Pr'.split(' '));
const SPACE={',':'0.17em',':':'0.22em',';':'0.28em','!':'-0.17em',' ':'0.28em',quad:'1em',qquad:'2em','~':'0.28em'};
/* chữ in đặc biệt: dùng bảng Unicode "Mathematical Alphanumeric" */
const ALPHA={
  bb:{up:0x1D538,lo:0x1D552,ex:{C:'ℂ',H:'ℍ',N:'ℕ',P:'ℙ',Q:'ℚ',R:'ℝ',Z:'ℤ'},dg:0x1D7D8},
  cal:{up:0x1D49C,lo:0x1D4B6,ex:{B:'ℬ',E:'ℰ',F:'ℱ',H:'ℋ',I:'ℐ',L:'ℒ',M:'ℳ',R:'ℛ',e:'ℯ',g:'ℊ',o:'ℴ'}},
  bf:{up:0x1D400,lo:0x1D41A,ex:{},dg:0x1D7CE},
  frak:{up:0x1D504,lo:0x1D51E,ex:{C:'ℭ',H:'ℌ',I:'ℑ',R:'ℜ',Z:'ℨ'}},
  sf:{up:0x1D5A0,lo:0x1D5BA,ex:{},dg:0x1D7E2},
  tt:{up:0x1D670,lo:0x1D68A,ex:{},dg:0x1D7F6}};
function styled(txt,k){
  const a=ALPHA[k];if(!a)return txt;
  return[...txt].map(c=>{
    if(a.ex[c])return a.ex[c];
    const u=c.charCodeAt(0);
    if(u>=65&&u<=90)return String.fromCodePoint(a.up+u-65);
    if(u>=97&&u<=122)return String.fromCodePoint(a.lo+u-97);
    if(u>=48&&u<=57&&a.dg)return String.fromCodePoint(a.dg+u-48);
    return c}).join('');
}
const STYLE_CMD={mathbb:'bb',Bbb:'bb',mathcal:'cal',mathscr:'cal',mathbf:'bf',boldsymbol:'bf',bm:'bf',mathfrak:'frak',mathsf:'sf',mathtt:'tt'};
const ACC={vec:'→',overrightarrow:'→',overleftarrow:'←',hat:'^',widehat:'^',bar:'¯',overline:'¯',tilde:'~',widetilde:'~',dot:'˙',ddot:'¨',check:'ˇ',acute:'´',grave:'`'};
const ENV_FENCE={pmatrix:['(',')'],bmatrix:['[',']'],Bmatrix:['{','}'],vmatrix:['|','|'],Vmatrix:['‖','‖'],cases:['{',''],matrix:['',''],smallmatrix:['',''],array:['',''],aligned:['',''],align:['',''],'align*':['',''],split:['',''],gathered:['',''],gather:['',''],'gather*':['',''],eqnarray:['',''],'eqnarray*':['','']};
const ALIGNED=new Set(['aligned','align','align*','split','eqnarray','eqnarray*']);

const OPEN='([{⟨⌊⌈',CLOSE=')]}⟩⌋⌉';
const mo=(c,a)=>{
  a=a||'';
  const plain=!/ stretchy=/.test(a);              // ngoặc thường không kéo giãn; \left \right thì truyền stretchy="true"
  if(!/ form=/.test(a)){
    if(c&&OPEN.includes(c))a+=' form="prefix" lspace="0" rspace="0"'+(plain?' stretchy="false"':'');
    else if(c&&CLOSE.includes(c))a+=' form="postfix" lspace="0" rspace="0"'+(plain?' stretchy="false"':'');
    else if(c=='|'||c=='‖')a+=' lspace="0.1em" rspace="0.1em"'+(plain?' stretchy="false"':'');
  }
  return`<mo${a}>${X(c)}</mo>`;
};
const mi=c=>`<mi>${X(c)}</mi>`;
const mrow=a=>`<mrow>${Array.isArray(a)?a.join(''):a}</mrow>`;

/* ---------- bộ phân tích LaTeX ---------- */
function parse(s,display){
  let i=0,n=s.length,bad=false;
  const ws=()=>{while(i<n&&/\s/.test(s[i]))i++};
  const readName=()=>{ // sau dấu \
    const m=/^[A-Za-z]+\*?/.exec(s.slice(i,i+30));
    if(m&&!(m[0].endsWith('*')&&!/^(align|gather|eqnarray)/.test(m[0]))){i+=m[0].length;return m[0]}
    if(m){i+=m[0].length-1;return m[0].slice(0,-1)}
    const c=s[i]||'';i+=c?1:0;return c;
  };
  const rawGroup=()=>{ // đọc nguyên văn {...} (cho \text, tên môi trường)
    ws();if(s[i]!='{'){const c=s[i]||'';i++;return c}
    let d=0,st=++i;
    for(;i<n;i++){if(s[i]=='\\'){i++;continue}if(s[i]=='{')d++;else if(s[i]=='}'){if(d==0)break;d--}}
    const out=s.slice(st,i);i++;return out;
  };
  function seq(stopBracket){
    const out=[];
    while(i<n){
      const c=s[i];
      if(c=='}'||c=='&')break;
      if(stopBracket&&c==']')break;
      if(c=='\\'){
        if(s[i+1]=='\\')break;
        const m=/^\\(right|end)(?![A-Za-z])/.exec(s.slice(i,i+8));if(m)break;
      }
      if(/\s/.test(c)){i++;continue}
      let a=scripts(atom());
      if(a){
        // dấu − + ± đứng đầu hoặc ngay sau một toán tử (vd x=-2) là dấu âm/dương, không phải phép trừ/cộng hai ngôi
        if(/^<mo>[−+±∓]<\/mo>$/.test(a)){
          const prev=out[out.length-1];
          if(prev===undefined||(/^<mo[ >]/.test(prev)&&!/form="postfix"/.test(prev)))a=a.replace('<mo>','<mo form="prefix">');
        }
        out.push(a);
      }
    }
    return out;
  }
  function group(){ // đang đứng tại '{'
    i++;const items=seq();if(s[i]=='}')i++;
    return items;
  }
  function arg(){ // một đối số của lệnh
    ws();
    if(s[i]=='{')return mrow(group());
    if(i>=n)return mrow('');
    if(s[i]=='\\'){const a=atom();return a?a.ml:mrow('')}
    const c=s[i++];return /\d/.test(c)?`<mn>${c}</mn>`:/\p{L}/u.test(c)?mi(c):mo(c);
  }
  function scripts(a){
    if(a==null)return null;
    let base=a.ml,sub=null,sup=null,primes='';
    for(;;){
      ws();
      const c=s[i];
      if(c=='^'){i++;ws();sup=sup?`<mrow>${sup}${arg()}</mrow>`:arg()}
      else if(c=='_'){i++;ws();sub=arg()}
      else if(c=="'"){i++;primes+='′'}
      else break;
    }
    if(primes){const p=mo(primes);sup=sup?`<mrow>${p}${sup}</mrow>`:p}
    if(!sub&&!sup)return base;
    if(a.limits&&(a.always||display)){
      return sub&&sup?`<munderover>${base}${sub}${sup}</munderover>`:sub?`<munder>${base}${sub}</munder>`:`<mover>${base}${sup}</mover>`;
    }
    return sub&&sup?`<msubsup>${base}${sub}${sup}</msubsup>`:sub?`<msub>${base}${sub}</msub>`:`<msup>${base}${sup}</msup>`;
  }
  function delim(){ // ký tự sau \left \right \middle
    ws();let c=s[i];
    if(c=='\\'){i++;const nm=readName();return nm=='{'||nm=='lbrace'?'{':nm=='}'||nm=='rbrace'?'}':nm=='|'?'‖':OP[nm]||nm}
    i++;return c=='.'?'':c;
  }
  function env(){
    const name=rawGroup().trim(),fence=ENV_FENCE[name]||['',''];
    if(name=='array'||name=='tabular'){ws();if(s[i]=='{')rawGroup()}
    const rows=[[]];let cell=[];
    for(;;){
      cell=seq();rows[rows.length-1].push(cell);
      if(i>=n)break;
      if(s[i]=='&'){i++;continue}
      if(s[i]=='\\'&&s[i+1]=='\\'){i+=2;if(s[i]=='['){const j=s.indexOf(']',i);if(j>0)i=j+1}rows.push([]);continue}
      if(s[i]=='\\'){const m=/^\\end\s*\{[^}]*\}/.exec(s.slice(i));if(m){i+=m[0].length}break}
      if(s[i]=='}'){i++;continue}
      break;
    }
    while(rows.length>1&&rows[rows.length-1].every(c=>!c.length))rows.pop();
    const al=ALIGNED.has(name)?' columnalign="right left"':name=='cases'?' columnalign="left left"':'';
    const sp=ALIGNED.has(name)?' columnspacing="0em"':' columnspacing="1em"';
    const tbl=`<mtable${al}${sp} rowspacing="0.4em">${rows.map(r=>`<mtr>${r.map(c=>`<mtd>${c.join('')}</mtd>`).join('')}</mtr>`).join('')}</mtable>`;
    if(!fence[0]&&!fence[1])return tbl;
    return mrow((fence[0]?mo(fence[0],' fence="true" stretchy="true"'):'')+tbl+(fence[1]?mo(fence[1],' fence="true" stretchy="true"'):''));
  }
  function command(){
    i++;                       // bỏ dấu \
    const nm=readName();
    if(GL[nm])return{ml:mi(GL[nm])};
    if(GU[nm])return{ml:`<mi mathvariant="normal">${GU[nm]}</mi>`};
    if(BIG[nm])return{ml:mo(BIG[nm]),limits:true,always:true};
    if(INT[nm])return{ml:mo(INT[nm])};
    if(FN.has(nm)){return{ml:`<mi>${nm}</mi>`,limits:FNLIM.has(nm)}}
    if(nm in SPACE)return{ml:`<mspace width="${SPACE[nm]}"/>`};
    if(OP[nm]!==undefined)return{ml:mo(OP[nm])};
    switch(nm){
      case'frac':case'dfrac':case'tfrac':case'cfrac':{const a=arg(),b=arg();return{ml:`<mfrac>${a}${b}</mfrac>`}}
      case'binom':case'dbinom':case'tbinom':{const a=arg(),b=arg();return{ml:mrow(mo('(')+`<mfrac linethickness="0">${a}${b}</mfrac>`+mo(')'))}}
      case'sqrt':{ws();let idx=null;if(s[i]=='['){i++;idx=mrow(seq(true));if(s[i]==']')i++}const a=arg();return{ml:idx?`<mroot>${a}${idx}</mroot>`:`<msqrt>${a}</msqrt>`}}
      case'text':case'textrm':case'textit':case'textbf':case'mbox':case'hbox':case'mathrm':case'operatorname':case'mathit':case'textnormal':case'textsf':{
        ws();
        if(s[i]!='{'){return{ml:arg()}}
        const save=i,raw=rawGroup();
        if(nm=='mathrm'||nm=='operatorname'){ // chữ đứng trong chế độ toán
          return{ml:!/[\\{}^_]/.test(raw)?(raw.length==1?`<mi mathvariant="normal">${X(raw)}</mi>`:`<mi>${X(raw.replace(/ /g,''))}</mi>`):(()=>{i=save;return mrow(group())})(),limits:nm=='operatorname'&&FNLIM.has(raw)}
        }
        const t=X(raw).replace(/^ /,'&#160;').replace(/ $/,'&#160;');
        return{ml:`<mtext${nm=='textbf'?' style="font-weight:bold"':nm=='textit'||nm=='mathit'?' style="font-style:italic"':''}>${t}</mtext>`};
      }
      case'left':{const l=delim(),inner=seq();
        let r='';const m=/^\\right/.exec(s.slice(i,i+6));if(m){i+=6;r=delim()}
        return{ml:mrow((l?mo(l,' fence="true" stretchy="true"'):'')+inner.join('')+(r?mo(r,' fence="true" stretchy="true"'):''))}}
      case'middle':{const d=delim();return{ml:mo(d,' fence="true" stretchy="true"')}}
      case'right':{const d=delim();return{ml:d?mo(d):''}}
      case'begin':return{ml:env()};
      case'end':rawGroup();return{ml:''};
      case'overset':case'stackrel':{const t=arg(),b=arg();return{ml:`<mover>${b}${t}</mover>`}}
      case'underset':{const t=arg(),b=arg();return{ml:`<munder>${b}${t}</munder>`}}
      case'xrightarrow':case'xleftarrow':{ws();let lo=null;if(s[i]=='['){i++;lo=mrow(seq(true));if(s[i]==']')i++}const up=arg();const ar=mo(nm=='xrightarrow'?'→':'←',' stretchy="true"');return{ml:lo?`<munderover>${ar}${lo}${up}</munderover>`:`<mover>${ar}${up}</mover>`}}
      case'underline':{const a=arg();return{ml:`<munder>${a}${mo('_',' stretchy="true"')}</munder>`}}
      case'overbrace':{const a=arg();return{ml:`<mover>${a}${mo('⏞',' stretchy="true"')}</mover>`}}
      case'underbrace':{const a=arg();return{ml:`<munder>${a}${mo('⏟',' stretchy="true"')}</munder>`}}
      case'boxed':{const a=arg();return{ml:`<mrow style="border:1px solid currentColor;padding:2px 4px">${a}</mrow>`}}
      case'cancel':case'bcancel':case'xcancel':case'phantom':case'vphantom':case'hphantom':case'mathstrut':return{ml:nm.endsWith('phantom')||nm=='mathstrut'?'':arg()};
      case'not':{ws();const a=atom();return{ml:a&&a.ml.includes('=')?mo('≠'):a?a.ml:''}}
      case'pmod':{const a=arg();return{ml:mrow(mo('(')+`<mi>mod</mi><mspace width="0.3em"/>`+a+mo(')'))}}
      case'bmod':case'mod':return{ml:`<mspace width="0.3em"/><mi>mod</mi><mspace width="0.3em"/>`};
      case'displaystyle':case'textstyle':case'scriptstyle':case'limits':case'nolimits':case'big':case'Big':case'bigg':case'Bigg':case'bigl':case'bigr':case'Bigl':case'Bigr':case'biggl':case'biggr':case'protect':case'hline':case'noindent':return{ml:''};
      case'color':case'textcolor':{rawGroup();return nm=='textcolor'?{ml:arg()}:{ml:''}}
      case'ge':return{ml:mo('≥')};
      case'dots':return{ml:mo('…')};
      case'\n':case'\t':return{ml:''};
    }
    if(STYLE_CMD[nm]){
      ws();const save=i;
      if(s[i]=='{'){const raw=rawGroup();if(/^[A-Za-z0-9]+$/.test(raw))return{ml:`<mi mathvariant="normal">${styled(raw,STYLE_CMD[nm])}</mi>`};i=save}
      return{ml:arg()};
    }
    if(ACC[nm]){const a=arg(),wide=/^(overrightarrow|overleftarrow|widehat|widetilde|overline)$/.test(nm);return{ml:`<mover accent="true">${a}${mo(ACC[nm],wide?' stretchy="true"':'')}</mover>`}}
    bad=true;return{ml:`<mtext style="color:#c0392b">\\${X(nm)}</mtext>`};
  }
  function atom(){
    if(i>=n)return null;
    const c=s[i];
    if(c=='{'){
      if(/^\{,\}/.test(s.slice(i,i+3))){i+=3;return{ml:mo(',',' lspace="0" rspace="0"')}}
      return{ml:mrow(group())};
    }
    if(c=='\\')return command();
    if(/[0-9]/.test(c)){const m=/^[0-9]+(?:\.[0-9]+)?/.exec(s.slice(i));i+=m[0].length;return{ml:`<mn>${m[0]}</mn>`}}
    if(c=='^'||c=='_')return{ml:'<mrow></mrow>'};            // không có cơ sở: ^{14}C
    i++;
    if(/\p{L}/u.test(c))return{ml:mi(c)};
    switch(c){
      case'-':return{ml:mo('−')};
      case'*':return{ml:mo('∗')};
      case'~':return{ml:`<mspace width="0.28em"/>`};
      case"'":return{ml:mo('′')};
      case'|':return{ml:mo('|')};
      case'.':return{ml:mo('.')};
      case'{':case'}':return{ml:''};
    }
    return{ml:mo(c)};
  }
  let out=[];
  while(i<n){
    out=out.concat(seq());
    if(i<n)i++;                                             // bỏ qua } hoặc & lạc
  }
  return{ml:out.join(''),bad};
}

function render(tex,opt){
  opt=opt||{};
  const display=!!opt.display;
  let r;
  try{r=parse(String(tex),display)}catch(e){r={ml:'',bad:true,err:true}}
  if(r.err)return`<code class="mxerr" title="Công thức bị lỗi">${X(tex)}</code>`;
  return`<math xmlns="http://www.w3.org/1998/Math/MathML" display="${display?'block':'inline'}" class="mx${display?' mxd':''}"><semantics><mrow>${r.ml}</mrow><annotation encoding="application/x-tex">${X(tex)}</annotation></semantics></math>`;
}

/* ---------- tách văn bản thành đoạn chữ / công thức ---------- */
function split(str){
  const out=[];let buf='',i=0;const n=str.length;
  const flush=()=>{if(buf){out.push({t:buf});buf=''}};
  while(i<n){
    const c=str[i];
    if(c=='\\'&&str[i+1]=='$'){buf+='$';i+=2;continue}
    if(c=='\\'&&(str[i+1]=='('||str[i+1]=='[')){
      const close=str[i+1]=='('?'\\)':'\\]',j=str.indexOf(close,i+2);
      if(j>0){flush();out.push({m:str.slice(i+2,j),d:str[i+1]=='['});i=j+2;continue}
    }
    if(c=='$'){
      if(str[i+1]=='$'){const j=str.indexOf('$$',i+2);if(j>0&&str.slice(i+2,j).trim()){flush();out.push({m:str.slice(i+2,j),d:true});i=j+2;continue}}
      else if(i+1<n&&!/\s/.test(str[i+1])){
        let j=i+1,found=-1;
        while(j<n){
          if(str[j]=='\\'){j+=2;continue}
          if(str[j]=='$'){if(!/\s/.test(str[j-1])&&!/\d/.test(str[j+1]||'')){found=j}break}
          j++;
        }
        if(found>0){flush();out.push({m:str.slice(i+1,found),d:false});i=found+1;continue}
      }
    }
    buf+=c;i++;
  }
  flush();return out;
}
const SKIP=new Set(['TEXTAREA','INPUT','SCRIPT','STYLE','CODE','PRE','MATH','OPTION','SELECT','NOSCRIPT']);
const skipEl=el=>{for(;el&&el.nodeType==1;el=el.parentNode){if(SKIP.has(el.tagName)||el.isContentEditable||(el.classList&&el.classList.contains('nomath')))return true}return false};
function typeset(root){
  if(!root)return;
  if(root.nodeType==3)root=root.parentNode;
  if(!root||root.nodeType!=1&&root.nodeType!=11&&root.nodeType!=9)return;
  const doc=root.ownerDocument||document;
  const w=doc.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode:t=>/\$|\\\(|\\\[/.test(t.nodeValue)&&!skipEl(t.parentNode)?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT});
  const list=[];while(w.nextNode())list.push(w.currentNode);
  for(const t of list){
    const parts=split(t.nodeValue);
    if(!parts.some(p=>p.m!==undefined))continue;
    const frag=doc.createDocumentFragment();
    for(const p of parts){
      if(p.m===undefined){frag.append(doc.createTextNode(p.t));continue}
      const tpl=doc.createElement('template');tpl.innerHTML=render(p.m,{display:p.d});
      frag.append(tpl.content);
    }
    t.parentNode.replaceChild(frag,t);
  }
}
let obs=null,queue=new Set(),pend=false;
function auto(){
  if(obs||!g.MutationObserver)return;
  const run=()=>{pend=false;const q=[...queue];queue.clear();q.forEach(n=>{if(n.isConnected)typeset(n)})};
  obs=new MutationObserver(recs=>{
    for(const r of recs){
      if(r.type=='characterData'){if(!skipEl(r.target.parentNode))queue.add(r.target.parentNode);continue}
      r.addedNodes.forEach(n=>{if(n.nodeType==1&&n.tagName=='MATH')return;if(n.nodeType==1||n.nodeType==3)queue.add(n)});
    }
    if(queue.size&&!pend){pend=true;requestAnimationFrame(run)}
  });
  obs.observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  typeset(document.body);
}
g.TeXMath={render,typeset,auto,split};
})(window);
