/* =====================================================================
   Công thức toán trong bài (nạp sau mathtex.js)
   - Bật tự động hiển thị công thức $...$ / $$...$$ trên toàn bộ trang
   - Trang soạn bài: nút ∑ ở mỗi câu mở bảng chèn công thức (nút bấm + gõ LaTeX, xem trước ngay)
   - Dưới mỗi câu có công thức hiện khung "Xem trước" để giáo viên kiểm tra
   ===================================================================== */
TeXMath.auto();

const MX={target:null};
const MX_GROUPS=[
 ['Cơ bản',['\\frac{a}{b}','\\sqrt{x}','\\sqrt[n]{x}','x^{2}','x_{n}','x_{n}^{2}','\\left|x\\right|','\\left(\\frac{a}{b}\\right)','\\pm','\\times','\\div','\\cdot','\\leq','\\geq','\\neq','\\approx','\\infty','\\%','10^{-3}','2{,}5']],
 ['Hàm – giải tích',['\\sin x','\\cos x','\\tan x','\\log_{a}b','\\ln x','\\lim_{x\\to 0}','\\lim_{x\\to\\infty}','\\int_{a}^{b}f(x)\\,dx','\\sum_{i=1}^{n}','\\prod_{i=1}^{n}','\\frac{dy}{dx}',"f'(x)",'\\partial','\\Delta x','e^{x}','a^{\\frac{m}{n}}']],
 ['Chữ Hy Lạp',['\\alpha','\\beta','\\gamma','\\delta','\\varepsilon','\\theta','\\lambda','\\mu','\\pi','\\rho','\\sigma','\\tau','\\varphi','\\omega','\\Delta','\\Sigma','\\Omega','\\Phi','\\Pi','\\Lambda']],
 ['Tập hợp – logic',['x\\in A','x\\notin A','A\\subset B','A\\subseteq B','A\\cup B','A\\cap B','A\\setminus B','\\emptyset','\\mathbb{R}','\\mathbb{N}','\\mathbb{Z}','\\mathbb{Q}','\\forall','\\exists','\\Rightarrow','\\Leftrightarrow','\\to','(a;b)','[a;b]','\\{a;b\\}']],
 ['Hình học',['\\angle ABC','\\widehat{ABC}','\\vec{AB}','\\overrightarrow{AB}','\\overline{AB}','AB\\perp CD','AB\\parallel CD','\\triangle ABC','60^\\circ','\\pi r^{2}','\\Delta ABC\\sim\\Delta A\'B\'C\'','\\cong']],
 ['Hệ – ma trận',['\\begin{cases}x+y=1\\\\x-y=3\\end{cases}','\\begin{pmatrix}a&b\\\\c&d\\end{pmatrix}','\\begin{vmatrix}a&b\\\\c&d\\end{vmatrix}','\\binom{n}{k}','\\begin{aligned}a&=b\\\\&=c\\end{aligned}','\\overline{x}','\\sqrt{\\frac{a}{b}}','\\frac{-b\\pm\\sqrt{b^{2}-4ac}}{2a}']],
];
let MX_TAB=0;
const mxTabs=()=>MX_GROUPS.map((g,i)=>`<button type="button" class="ghost ${i==MX_TAB?'on':''}" onclick="mxTab(${i})">${g[0]}</button>`).join('');
const mxPal=()=>MX_GROUPS[MX_TAB][1].map(s=>`<button type="button" class="mxb" data-s="${esc(s)}" onclick="mxAdd(this.dataset.s)" title="${esc(s)}">${TeXMath.render(s)}</button>`).join('');
window.mxTab=i=>{MX_TAB=i;$('#mxTabs').innerHTML=mxTabs();$('#mxPal').innerHTML=mxPal()};
window.mxAdd=s=>{
  const t=$('#mxIn'),a=t.selectionStart??t.value.length,b=t.selectionEnd??t.value.length;
  t.value=t.value.slice(0,a)+s+t.value.slice(b);t.focus();t.selectionStart=t.selectionEnd=a+s.length;mxLive();
};
window.mxLive=()=>{const v=$('#mxIn').value.trim();$('#mxOut').innerHTML=v?TeXMath.render(v,{display:$('#mxDisp').checked}):'<small>Công thức sẽ hiện ở đây</small>'};
window.openMath=btn=>{
  const card=btn&&btn.closest?btn.closest('.qb'):null;
  MX.target=(MX.focus&&document.contains(MX.focus)&&card&&card.contains(MX.focus)?MX.focus:card&&card.querySelector('textarea'))||null;
  showModal(`<h3>∑ Chèn công thức toán</h3>
<small class="nomath">Bấm các nút để ghép công thức, hoặc gõ trực tiếp bằng LaTeX. Công thức được đặt trong dấu <b>$ … $</b> và hiện đẹp khi học sinh làm bài.</small>
<div class="mxtabs" id="mxTabs">${mxTabs()}</div><div class="mxpal" id="mxPal">${mxPal()}</div>
<textarea id="mxIn" rows="2" placeholder="Ví dụ: \\frac{a}{b} + \\sqrt{x}" oninput="mxLive()" spellcheck="false"></textarea>
<div class="mxout" id="mxOut"><small>Công thức sẽ hiện ở đây</small></div>
<label class="chk"><input type="checkbox" id="mxDisp" onchange="mxLive()"> Hiện riêng một dòng (công thức lớn, căn giữa)</label>
<div class="row"><button type="button" onclick="mxInsert()">➕ Chèn vào ${MX.target&&MX.target.tagName=='INPUT'?'ô đang chọn':'câu hỏi'}</button></div>`,'Đóng');
  setTimeout(()=>{const t=$('#mxIn');if(t)t.focus()},50);
};
window.mxInsert=()=>{
  const v=$('#mxIn').value.trim();if(!v)return toast('Hãy nhập hoặc bấm chọn một công thức');
  const t=MX.target;if(!t||!document.contains(t)){closeModal();return toast('Hãy bấm vào ô câu hỏi hoặc đáp án trước, rồi chọn ∑ lại')}
  const tex=$('#mxDisp').checked?`$$${v}$$`:`$${v}$`,a=t.selectionStart??t.value.length,b=t.selectionEnd??t.value.length;
  t.value=t.value.slice(0,a)+tex+t.value.slice(b);
  t.dispatchEvent(new Event('input',{bubbles:true}));
  closeModal();t.focus();try{t.selectionStart=t.selectionEnd=a+tex.length}catch{}
};

/* nhớ ô nhập đang chọn trong trang soạn bài */
document.addEventListener('focusin',e=>{
  const t=e.target;
  if(t&&t.matches&&t.matches('textarea,input:not([type=radio]):not([type=number]):not([type=checkbox]):not([type=datetime-local])')&&t.closest&&t.closest('.qb'))MX.focus=t;
});

/* thêm nút ∑ vào mỗi câu + dòng gợi ý trong trang soạn bài */
const _builderHTML9=builderHTML;
builderHTML=function(){
  let h=_builderHTML9();
  h=h.replace(/<a class="x" onclick="saveBank\((\d+)\)"/g,'<a class="x" onclick="openMath(this)" title="Chèn công thức toán">∑</a> <a class="x" onclick="saveBank($1)"');
  h=h.replace('<section class="card"><div class="item"><h3 style="margin:0">Câu hỏi (','<section class="card mxhint nomath"><small>∑ <b>Công thức toán:</b> bấm nút <b>∑</b> ở từng câu để chèn phân số, căn, mũ, tích phân... Công thức viết trong dấu <b>$…$</b> (vd: <code>$x^2-5x+6=0$</code>).</small></section><section class="card"><div class="item"><h3 style="margin:0">Câu hỏi (');
  return h;
};

/* khung xem trước dưới mỗi câu có công thức */
const MX_RE=/\$|\\\(|\\\[/;
function mxRefresh(){
  const cards=[...document.querySelectorAll('.card.qb')];
  if(!cards.length||typeof qb=='undefined')return;
  cards.forEach((c,i)=>{
    const q=qb[i];if(!q)return;
    const parts=[q.content];
    if(q.type=='mc')q.options.forEach((o,k)=>parts.push('ABCD'[k]+'. '+o));
    else if(q.type=='tf')q.options.forEach((o,k)=>parts.push('abcd'[k]+') '+o));
    else if(q.model)parts.push('Gợi ý: '+q.model);
    const src=parts.join('\n'),has=MX_RE.test(src);
    let box=c.querySelector(':scope > .mxprev');
    if(!has){if(box)box.remove();return}
    if(!box){box=document.createElement('div');box.className='mxprev';c.append(box)}
    if(box.dataset.src===src)return;
    box.dataset.src=src;
    box.innerHTML='<small>👁 Học sinh sẽ thấy:</small><div class="mxpv">'+parts.filter(x=>String(x).trim()).map(x=>'<div>'+esc(x)+'</div>').join('')+'</div>';
  });
}
let _mxT=null;
const mxSoon=()=>{clearTimeout(_mxT);_mxT=setTimeout(mxRefresh,150)};
document.addEventListener('input',e=>{if(e.target.closest&&e.target.closest('.qb'))mxSoon()});
new MutationObserver(mxSoon).observe($('#app'),{childList:true,subtree:true});
