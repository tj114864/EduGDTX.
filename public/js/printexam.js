/* =====================================================================
   IN ĐỀ – bản làm lại
   - Đề trình bày theo mẫu đề kiểm tra A4 (tiêu đề trung tâm, thông tin học sinh,
     chia PHẦN I / II / III theo dạng câu hỏi)
   - Tuỳ chọn ngay trong cửa sổ xem trước: mã đề (đảo câu & đáp án), phiếu trả lời,
     đáp án cho giáo viên, hiện điểm từng câu, cỡ chữ
   - Ghi đè window.printExam cũ trong app.js
   ===================================================================== */

/* Hàm này chạy BÊN TRONG cửa sổ in (được chép sang bằng toString), nên chỉ dùng biến cục bộ */
function paperApp(D){
  const $=s=>document.querySelector(s);
  const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const pts=n=>String(+(+n||0).toFixed(2)).replace('.',',');
  const rng=seed=>()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
  const shuf=(a,r)=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
  const L='ABCDEFGH';
  const ROMAN=['I','II','III'];

  /* Dựng đề theo mã: không có mã = đề gốc (giữ nguyên thứ tự) */
  function build(code){
    const r=code?rng(+code):null;
    const sec={mc:[],tf:[],essay:[]};
    D.questions.forEach(q=>{(sec[q.type]||sec.mc).push(q)});
    if(r){sec.mc=shuf(sec.mc,r);sec.tf=shuf(sec.tf,r)}
    sec.mc=sec.mc.map(q=>{
      let o=q.options.map((t,i)=>({t,i}));
      if(r)o=shuf(o,r);
      return{q,o,ans:o.findIndex(x=>x.i==q.answer)};
    });
    sec.tf=sec.tf.map(q=>({q,o:q.options.map((t,i)=>({t,i})),key:q.key||''}));
    sec.essay=sec.essay.map(q=>({q}));
    return sec;
  }

  /* chọn cách xếp đáp án: 4 cột / 2 cột / mỗi đáp án một dòng */
  const optLayout=o=>{const m=Math.max(...o.map(x=>String(x.t).length));return m<=14&&o.length<=4?'o4':m<=38?'o2':'o1'};

  function render(){
    const code=$('#code').value,withPts=$('#wpts').checked,withSheet=$('#wsheet').checked,withKey=$('#wkey').checked;
    document.documentElement.style.setProperty('--fs',$('#fs').value+'pt');
    const S=build(code);
    let n=0,html='';
    const total=D.questions.reduce((s,q)=>s+(+q.points||0),0);
    const tag=q=>withPts?` <i class="pt">(${pts(q.points)} điểm)</i>`:'';
    const content=q=>`<span class="qc">${esc(q.content)}</span>`;

    /* ---- tiêu đề ---- */
    html+=`<header class="hd">
      <div class="hl"><img src="${D.logo}" alt="" onerror="this.style.display='none'"><div><div>TRUNG TÂM GDNN – GDTX DẦU TIẾNG</div><b>ĐỀ CHÍNH THỨC</b></div></div>
      <div class="hr"><h1>${esc(D.exam.title)}</h1>
        <div>Thời gian làm bài: <b>${esc(D.exam.minutes)} phút</b> (không kể thời gian phát đề)</div>
        <div>Đề gồm <b>${D.questions.length}</b> câu${withPts?' · Tổng điểm: <b>'+pts(total)+'</b>':''}${code?' · <span class="mdbox">Mã đề: '+esc(code)+'</span>':''}</div></div>
    </header>
    <div class="stu"><span>Họ và tên: <u></u></span><span>Lớp: <u class="s"></u></span><span>SBD: <u class="s"></u></span></div>`;

    let part=0;
    /* ---- PHẦN trắc nghiệm ---- */
    if(S.mc.length){
      const sum=S.mc.reduce((s,x)=>s+(+x.q.points||0),0);
      html+=`<h2 class="ph">PHẦN ${ROMAN[part++]}. TRẮC NGHIỆM <small>(${S.mc.length} câu${withPts?' – '+pts(sum)+' điểm':''}). Mỗi câu chỉ chọn một đáp án đúng.</small></h2>`;
      S.mc.forEach(x=>{n++;x.n=n;
        html+=`<div class="pq"><p><b>Câu ${n}.</b>${tag(x.q)} ${content(x.q)}</p><div class="opts ${optLayout(x.o)}">${x.o.map((o,k)=>`<div><b>${L[k]}.</b> ${esc(o.t)}</div>`).join('')}</div></div>`});
    }
    /* ---- PHẦN đúng / sai ---- */
    if(S.tf.length){
      const sum=S.tf.reduce((s,x)=>s+(+x.q.points||0),0);
      html+=`<h2 class="ph">PHẦN ${ROMAN[part++]}. ĐÚNG / SAI <small>(${S.tf.length} câu${withPts?' – '+pts(sum)+' điểm':''}). Trong mỗi ý a), b), c), d) thí sinh chọn Đúng hoặc Sai.</small></h2>`;
      S.tf.forEach(x=>{n++;x.n=n;
        html+=`<div class="pq"><p><b>Câu ${n}.</b>${tag(x.q)} ${content(x.q)}</p>${x.o.map((o,k)=>`<div class="tfr"><span><b>${'abcd'[k]})</b> ${esc(o.t)}</span><span class="ds">Đúng ☐ &nbsp; Sai ☐</span></div>`).join('')}</div>`});
    }
    /* ---- PHẦN tự luận ---- */
    if(S.essay.length){
      const sum=S.essay.reduce((s,x)=>s+(+x.q.points||0),0);
      html+=`<h2 class="ph">PHẦN ${ROMAN[part++]}. TỰ LUẬN <small>(${S.essay.length} câu${withPts?' – '+pts(sum)+' điểm':''}). Trình bày lời giải đầy đủ vào phần bên dưới mỗi câu.</small></h2>`;
      S.essay.forEach(x=>{n++;x.n=n;
        const lines=Math.max(3,Math.min(14,Math.ceil((+x.q.points||1)*3)));
        html+=`<div class="pq es"><p><b>Câu ${n}.</b>${tag(x.q)} ${content(x.q)}</p>${'<div class="ln"></div>'.repeat(lines)}</div>`});
    }
    html+=`<p class="end">——— HẾT ———</p><p class="note">Thí sinh không được sử dụng tài liệu. Cán bộ coi thi không giải thích gì thêm.</p>`;

    /* ---- phiếu trả lời ---- */
    if(withSheet&&(S.mc.length||S.tf.length)){
      html+=`<div class="newpage"><header class="hd sh"><div class="hl"><img src="${D.logo}" alt="" onerror="this.style.display='none'"><div>TRUNG TÂM GDNN – GDTX DẦU TIẾNG</div></div><div class="hr"><h1>PHIẾU TRẢ LỜI</h1><div>${esc(D.exam.title)}${code?' · <b>Mã đề '+esc(code)+'</b>':''}</div></div></header>
      <div class="stu"><span>Họ và tên: <u></u></span><span>Lớp: <u class="s"></u></span><span>SBD: <u class="s"></u></span></div>
      <p class="note l">Tô kín ô tròn bằng bút mực / bút chì đen. Tô sai thì gạch chéo rồi ghi lại bên cạnh.</p>`;
      if(S.mc.length)html+=`<h3 class="sht">Phần trắc nghiệm</h3><div class="grid">${S.mc.map(x=>`<div class="bub"><b>${x.n}</b>${[...Array(Math.min(x.o.length,8))].map((_,k)=>`<span class="c">${L[k]}</span>`).join('')}</div>`).join('')}</div>`;
      if(S.tf.length)html+=`<h3 class="sht">Phần đúng / sai</h3><div class="grid tfg">${S.tf.map(x=>`<table class="tft"><tr><th>Câu ${x.n}</th><th>Đúng</th><th>Sai</th></tr>${'abcd'.split('').map(l=>`<tr><td>${l})</td><td><span class="c"></span></td><td><span class="c"></span></td></tr>`).join('')}</table>`).join('')}</div>`;
      html+=`</div>`;
    }

    /* ---- đáp án (giáo viên) ---- */
    if(withKey){
      html+=`<div class="newpage key"><h2 class="ph">ĐÁP ÁN – ${esc(D.exam.title)}${code?' – MÃ ĐỀ '+esc(code):''} <small>(bản dành cho giáo viên, không phát cho học sinh)</small></h2>`;
      if(S.mc.length)html+=`<h3 class="sht">Trắc nghiệm</h3><div class="kg">${S.mc.map(x=>`<div><b>${x.n}</b> ${x.ans>=0?L[x.ans]:'?'}</div>`).join('')}</div>`;
      if(S.tf.length)html+=`<h3 class="sht">Đúng / Sai</h3><div class="kg tfk">${S.tf.map(x=>`<div><b>Câu ${x.n}</b> ${'abcd'.split('').map((l,k)=>l+'-'+((x.key||'')[k]=='D'?'Đ':(x.key||'')[k]=='S'?'S':'?')).join(' · ')}</div>`).join('')}</div>`;
      if(S.essay.length)html+=`<h3 class="sht">Tự luận</h3>${S.essay.map(x=>`<div class="pq"><p><b>Câu ${x.n}.</b>${tag(x.q)}</p><p class="qc">${x.q.model&&String(x.q.model).trim()?esc(x.q.model):'<i>Chưa có đáp án mẫu – giáo viên chấm theo thang điểm.</i>'}</p></div>`).join('')}`;
      html+=`</div>`;
    }
    $('#paper').innerHTML=html;
    if(window.TeXMath)TeXMath.typeset($('#paper'));      // công thức $...$ → MathML
    $('#hint').style.display=code?'':'none';
  }
  ['code','wpts','wsheet','wkey','fs'].forEach(i=>$('#'+i).addEventListener('change',render));
  document.querySelector('#pr').addEventListener('click',()=>{window.focus();window.print()});
  render();
}

const PAPER_CSS=`
@page{size:A4;margin:14mm 14mm 16mm;@bottom-center{content:"Trang " counter(page) " / " counter(pages);font:9pt 'Times New Roman',serif;color:#555}}
:root{--fs:12pt;--blue:#1f4fb2}
*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
html,body{margin:0}
math{font-family:'Cambria Math','Latin Modern Math','STIX Two Math','Noto Sans Math',serif}math.mxd{display:block;width:fit-content;max-width:100%;margin:.4em auto}.mxerr{color:#c0392b}
body{background:#e6eaf3;font-family:'Times New Roman','Liberation Serif','DejaVu Serif',serif;color:#111;font-size:var(--fs);line-height:1.45}
.tb{position:sticky;top:0;z-index:9;display:flex;flex-wrap:wrap;gap:10px 18px;align-items:center;justify-content:center;padding:10px 12px;background:#1f3f86;color:#fff;font:13px 'Segoe UI',Arial,sans-serif}
.tb label{display:flex;align-items:center;gap:6px;cursor:pointer}
.tb select{padding:5px 8px;border-radius:8px;border:0;font:inherit}
.tb button{border:0;border-radius:10px;padding:8px 18px;font-weight:700;background:#fff;color:#1f3f86;cursor:pointer;font-size:14px}
#hint{flex-basis:100%;text-align:center;font-size:12px;opacity:.85}
#paper{width:210mm;min-height:297mm;margin:14px auto;background:#fff;padding:14mm;box-shadow:0 8px 30px #0003}
.hd{display:grid;grid-template-columns:42% 1fr;gap:10px;align-items:start;border-bottom:2px solid var(--blue);padding-bottom:8px}
.hl{display:flex;gap:8px;align-items:center;font-size:.8em;text-align:center;font-weight:700;line-height:1.3;color:var(--blue)}
.hl img{width:46px;height:46px;flex:none}.hl b{display:block;margin-top:2px;color:#111}
.hr{text-align:center;font-size:.9em}.hr h1{margin:0 0 3px;font-size:1.3em;text-transform:uppercase;color:var(--blue);line-height:1.2}
.mdbox{display:inline-block;border:1.5px solid #111;padding:0 8px;font-weight:700}
.stu{display:flex;gap:14px;margin:12px 0 4px;font-weight:700}.stu span:first-child{flex:1}.stu u{display:inline-block;border-bottom:1px dotted #333;width:calc(100% - 78px);height:1em;vertical-align:baseline;text-decoration:none}.stu u.s{width:64px}
.ph{font-size:1.05em;text-transform:uppercase;margin:16px 0 8px;padding:3px 8px;background:#e8eefb;border-left:4px solid var(--blue);break-after:avoid}
.ph small{text-transform:none;font-weight:400;font-style:italic}
.pq{margin:0 0 10px;break-inside:avoid}.pq p{margin:0 0 3px}
.qc{white-space:pre-wrap}.pt{font-size:.85em;color:#444}
.opts{display:grid;gap:2px 14px;margin-left:18px}
.opts.o4{grid-template-columns:repeat(4,1fr)}.opts.o2{grid-template-columns:1fr 1fr}.opts.o1{grid-template-columns:1fr}
.opts div{white-space:pre-wrap}
.tfr{display:flex;justify-content:space-between;gap:10px;margin:2px 0 2px 18px}.tfr .ds{flex:none;white-space:nowrap}
.es .ln{border-bottom:1px dotted #777;height:8.2mm}
.end{text-align:center;font-weight:700;margin:18px 0 2px}.note{text-align:center;font-style:italic;font-size:.85em;margin:0}.note.l{text-align:left;margin:8px 0}
.newpage{break-before:page;page-break-before:always;margin-top:0}
.sh{margin-bottom:0}.sht{margin:14px 0 6px;font-size:1em;text-transform:uppercase;color:var(--blue)}
.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:5px 22px}
.bub{display:flex;align-items:center;gap:6px;break-inside:avoid}.bub b{width:24px;text-align:right;font-size:.9em}
.c{display:inline-grid;place-items:center;width:5.6mm;height:5.6mm;border:1px solid #111;border-radius:50%;font:700 7.5pt Arial,sans-serif;color:#555}
.grid.tfg{grid-template-columns:repeat(3,1fr);gap:10px 14px}
.tft{border-collapse:collapse;width:100%;font-size:.85em;break-inside:avoid}.tft th,.tft td{border:1px solid #444;text-align:center;padding:1px 4px}.tft td .c{width:4.6mm;height:4.6mm}
.key .kg{display:grid;grid-template-columns:repeat(5,1fr);gap:3px 12px}.key .kg.tfk{grid-template-columns:repeat(2,1fr)}.key .kg b{display:inline-block;min-width:22px}
@media print{body{background:#fff}.tb{display:none}#paper{margin:0;padding:0;width:auto;min-height:0;box-shadow:none}}
`;

window.printExam=run(async id=>{
  const d=await api('/exams/'+id);
  if(!d.questions.length)return toast('Bài này chưa có câu hỏi nào để in');
  const w=window.open('','_blank');if(!w)return toast('Trình duyệt chặn cửa sổ in, hãy cho phép pop-up cho trang này');
  const data={exam:{title:d.exam.title,minutes:d.exam.minutes},questions:d.questions,logo:location.origin+'/img/logo.svg'};
  const json=JSON.stringify(data).replace(/</g,'\\u003c').replace(/\u2028|\u2029/g,'');
  w.document.write(`<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"><title>${esc(d.exam.title)}</title><style>${PAPER_CSS}</style></head>
<body><div class="tb">
<button id="pr">🖨 In đề</button>
<label>Mã đề <select id="code"><option value="">Đề gốc</option><option>101</option><option>102</option><option>103</option><option>104</option></select></label>
<label><input type="checkbox" id="wpts" checked> Hiện điểm từng câu</label>
<label><input type="checkbox" id="wsheet"> Kèm phiếu trả lời</label>
<label><input type="checkbox" id="wkey"> Kèm đáp án (cho giáo viên)</label>
<label>Cỡ chữ <select id="fs"><option>11</option><option selected>12</option><option>13</option><option>14</option></select></label>
<span id="hint" style="display:none">Đề đảo thứ tự câu và đáp án: hãy kiểm tra lại các câu kiểu “cả A và B đều đúng” vì vị trí đáp án đã thay đổi. In từng mã đề kèm đáp án riêng.</span>
</div><div id="paper"></div>
<script src="${location.origin}/js/mathtex.js"><\/script>
<script>(${paperApp.toString()})(${json});<\/script></body></html>`);
  w.document.close();w.focus();
});
