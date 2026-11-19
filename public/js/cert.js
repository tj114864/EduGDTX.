/* ===== GIẤY KHEN (mẫu A4 ngang, giống giấy khen của Trung tâm) =====
   Sửa thông tin Trung tâm / người ký ngay trong CERT_CFG bên dưới.
   Muốn dùng logo thật: chép file logo vào  public/img/logo-trungtam.png  (tự được dùng thay cho logo vẽ sẵn). */
const CERT_CFG={
  nation:'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM',motto:'Độc lập - Tự do - Hạnh phúc',
  center:'TRUNG TÂM GDNN - GDTX DẦU TIẾNG',
  province:'Thành phố Hồ Chí Minh',
  signTitle:'PHÓ GIÁM ĐỐC',signName:'Nguyễn Văn Giáp',
  decisionNo:'',decisionSuffix:'/QĐ-GDNNGDTXDT',      // để trống số quyết định thì in dấu chấm để viết tay
  logo:'/img/logo-trungtam.png'
};
const CERT_FONTS='https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,600;0,700;1,500;1,600&family=Be+Vietnam+Pro:wght@700;800&family=Dancing+Script:wght@600&display=swap';
const certNFC=s=>String(s??'').normalize('NFC');
const certUp=s=>certNFC(s).toLocaleUpperCase('vi-VN');

const certRosette=()=>{
  const pts=[...Array(56)].map((_,i)=>{const a=i/56*2*Math.PI,r=i%2?41:45.5;return(50+r*Math.cos(a)).toFixed(1)+','+(50+r*Math.sin(a)).toFixed(1)}).join(' ');
  const rays=[...Array(40)].map((_,i)=>{const a=i/40*2*Math.PI;return`<line x1="${(50+7*Math.cos(a)).toFixed(1)}" y1="${(50+7*Math.sin(a)).toFixed(1)}" x2="${(50+33*Math.cos(a)).toFixed(1)}" y2="${(50+33*Math.sin(a)).toFixed(1)}"/>`}).join('');
  return`<svg viewBox="0 0 100 138" xmlns="http://www.w3.org/2000/svg"><defs>
<radialGradient id="cgA" cx="38%" cy="32%" r="80%"><stop offset="0" stop-color="#fbeaa8"/><stop offset=".5" stop-color="#dcab42"/><stop offset="1" stop-color="#9c6c18"/></radialGradient>
<linearGradient id="cgR" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f2d27a"/><stop offset="1" stop-color="#b98524"/></linearGradient></defs>
<path d="M33 78 22 134 38 124 47 136 57 84Z" fill="url(#cgR)"/><path d="M67 78 78 134 62 124 53 136 43 84Z" fill="url(#cgR)" opacity=".92"/>
<polygon points="${pts}" fill="url(#cgA)"/><circle cx="50" cy="50" r="37" fill="none" stroke="#fff7d6" stroke-width="1.4" opacity=".8"/>
<g stroke="#fff4c4" stroke-width=".7" opacity=".55">${rays}</g><circle cx="50" cy="50" r="31" fill="url(#cgA)" stroke="#a97a22" stroke-width="1"/><circle cx="50" cy="50" r="7" fill="#f6e0a0" stroke="#b98524" stroke-width=".8"/></svg>`};

const certCorner=()=>`<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="cgM" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#651524"/><stop offset="1" stop-color="#b6525c"/></linearGradient></defs>
<path d="M0 0H196C158 10 116 30 84 60 54 88 22 132 0 198Z" fill="url(#cgM)"/>
<path d="M0 0H150C116 14 80 38 56 66 34 92 14 128 0 160Z" fill="#8c2635" opacity=".9"/>
<path d="M0 0H98C72 14 50 36 34 60 18 84 6 106 0 124Z" fill="#661626"/>
<path d="M5 5H190C154 15 112 35 80 65 50 93 18 134 5 190" fill="none" stroke="#dcbc72" stroke-width="1.4"/>
<path d="M13 13H170C140 22 106 42 78 70 50 98 24 134 13 172" fill="none" stroke="#dcbc72" stroke-width=".7" opacity=".8"/></svg>`;

const certEmblem=()=>{
  let leaves='';
  for(let i=0;i<10;i++){const th=(104+i*14)*Math.PI/180,R=50;
    for(const [off,fill] of [[-5,'#c99a35'],[6,'#e2bd62']]){
      const x=110+(R+off)*Math.cos(th),y=88+(R+off)*Math.sin(th),rot=th*180/Math.PI+90+(off<0?-22:22);
      leaves+=`<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="3.6" ry="9" fill="${fill}" transform="rotate(${rot.toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})"/>`;
      const x2=220-x,rot2=-rot;leaves+=`<ellipse cx="${x2.toFixed(1)}" cy="${y.toFixed(1)}" rx="3.6" ry="9" fill="${fill}" transform="rotate(${rot2.toFixed(0)} ${x2.toFixed(1)} ${y.toFixed(1)})"/>`}}
  return`<svg viewBox="0 0 220 150" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="cgB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4dc92"/><stop offset="1" stop-color="#c39228"/></linearGradient></defs>
${leaves}
<path d="M110 118C92 103 64 101 42 109V64C66 57 94 59 110 74Z" fill="url(#cgB)" stroke="#9c6c18" stroke-width="1.2"/>
<path d="M110 118C128 103 156 101 178 109V64C154 57 126 59 110 74Z" fill="url(#cgB)" stroke="#9c6c18" stroke-width="1.2"/>
<g stroke="#a97a22" stroke-width=".9" fill="none" opacity=".75"><path d="M52 76C68 72 88 74 102 84M52 87C68 83 88 85 102 95M52 98C68 94 88 96 102 106"/><path d="M168 76C152 72 132 74 118 84M168 87C152 83 132 85 118 95M168 98C152 94 132 96 118 106"/></g>
<path d="M36 112C64 104 92 108 110 124 128 108 156 104 184 112" fill="none" stroke="#9c6c18" stroke-width="2"/>
<path d="M110 70C99 56 105 44 110 30 115 44 121 56 110 70Z" fill="#d4382c"/><path d="M110 66C104 58 107 50 110 42 113 50 116 58 110 66Z" fill="#f7a83c"/></svg>`};

const certLogoSVG=()=>`<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><defs><path id="cgT" d="M21 82.5A45 45 0 1 1 99 82.5"/></defs>
<circle cx="60" cy="60" r="58" fill="#1f3f86"/><circle cx="60" cy="60" r="54.5" fill="#fff"/><circle cx="60" cy="60" r="38" fill="#1f3f86"/>
<text font-family="Be Vietnam Pro,Arial,sans-serif" font-size="7.3" font-weight="800" fill="#1f3f86" letter-spacing=".25"><textPath href="#cgT" startOffset="50%" text-anchor="middle">TRUNG TÂM GDNN ✹ GDTX DẦU TIẾNG</textPath></text>
<g fill="#ee9a4c"><circle cx="40" cy="62" r="3.4"/><circle cx="48" cy="60" r="3.4"/><circle cx="35" cy="66" r="3"/><rect x="33" y="65" width="20" height="16" rx="6"/>
<circle cx="80" cy="62" r="3.4"/><circle cx="72" cy="60" r="3.4"/><circle cx="85" cy="66" r="3"/><rect x="67" y="65" width="20" height="16" rx="6"/></g>
<path d="M60 42C51 36 53 29 60 22 67 29 69 36 60 42Z" fill="#e5392e"/><path d="M60 40C56 36 57 32 60 28 63 32 64 36 60 40Z" fill="#f8c040"/>
<path d="M30 80C45 84 55 82 60 78 65 82 75 84 90 80" fill="none" stroke="#fff" stroke-width="1.6"/>
<rect x="33" y="85" width="54" height="11" rx="2" fill="#fff"/><text x="60" y="93.2" text-anchor="middle" font-family="Be Vietnam Pro,Arial,sans-serif" font-size="6.4" font-weight="800" fill="#d62828">TP. HỒ CHÍ MINH</text></svg>`;

const certDate=(d=new Date())=>({long:`${certNFC(CERT_CFG.province)}, ngày ${d.getDate()} tháng ${d.getMonth()+1} năm ${d.getFullYear()}`,short:d.toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric'}),
  year:d.getMonth()>=7?`${d.getFullYear()} - ${d.getFullYear()+1}`:`${d.getFullYear()-1} - ${d.getFullYear()}`});

/* name, cls: tên + lớp · title, score: bài kiểm tra + điểm · extra: {avg,n} khi học sinh tự in theo điểm trung bình */
function certHTML(name,cls,title,score,extra){
  const dt=certDate(),C=CERT_CFG,nm=certNFC(name)+(cls?` - Lớp ${certNFC(cls)}`:'');
  const a1=extra?`ĐẠT ĐIỂM TRUNG BÌNH ${score}`:`ĐẠT ĐIỂM ${score} TRONG BÀI ${certUp(title)}`;
  const a2=extra?`QUA ${extra.n} BÀI KIỂM TRA - THÀNH TÍCH HỌC TẬP TỐT`:'ĐẠT THÀNH TÍCH TỐT TRONG HỌC TẬP';
  const no=C.decisionNo?esc(C.decisionNo):'&nbsp;.&nbsp;.&nbsp;.&nbsp;.&nbsp;.&nbsp;.';
  return`<section class="cpage"><div class="cf1"></div><div class="cf2"></div>
<div class="cc c-tl">${certCorner()}</div><div class="cc c-tr">${certCorner()}</div><div class="cc c-bl">${certCorner()}</div><div class="cc c-br">${certCorner()}</div>
<div class="cmed m-l">${certRosette()}</div><div class="cmed m-r">${certRosette()}</div>
<div class="cin">
 <div class="clogo">${certLogoSVG()}<img src="${location.origin}${C.logo}" alt="" onload="this.previousElementSibling.style.display='none';this.style.display='block'" onerror="this.remove()"></div>
 <div class="t1">${esc(certNFC(C.nation))}</div><div class="t2">${esc(certNFC(C.motto))}</div><div class="t3">${esc(certNFC(C.center))}</div>
 <h1>GIẤY KHEN</h1><div class="tang">Tặng</div><h2 class="nm">${esc(nm)}</h2>
 <div class="a1">${esc(a1)}</div><div class="a2">${esc(a2)}</div><div class="yr">Năm học ${dt.year}</div></div>
<div class="cdec">Số Quyết định: ${no}${esc(C.decisionSuffix)}<br>Ngày ${dt.short}</div>
<div class="cemb">${certEmblem()}</div>
<div class="csig"><div class="sd">${esc(dt.long)}</div><div class="st">${esc(certNFC(C.signTitle))}</div><div class="sn">${esc(certNFC(C.signName))}</div></div></section>`}

function certStyle(){return`<style>
@page{size:A4 landscape;margin:0}
*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
html,body{margin:0;padding:0}body{background:#e6eaf3;font-family:'Playfair Display','Times New Roman','DejaVu Serif',serif;color:#2b2b2b}
.tb{position:sticky;top:0;z-index:9;display:flex;gap:14px;align-items:center;justify-content:center;padding:10px;background:#1f3f86;color:#fff;font:14px 'Be Vietnam Pro',Arial,sans-serif}
.tb button{border:0;border-radius:10px;padding:8px 16px;font-weight:700;background:#fff;color:#1f3f86;cursor:pointer;font-size:14px}
.cpage{position:relative;width:297mm;height:210mm;margin:14px auto;background:#fff;overflow:hidden;box-shadow:0 8px 30px #0003;break-after:page;page-break-after:always}
.cpage:last-of-type{break-after:auto;page-break-after:auto}
.cf1{position:absolute;inset:6mm;border:.35mm solid #d8b865}.cf2{position:absolute;inset:8.2mm;border:.18mm solid #e6cf91}
.cc{position:absolute;width:33mm;height:33mm}.cc svg{width:100%;height:100%;display:block}
.c-tl{left:0;top:0}.c-tr{right:0;top:0;transform:scaleX(-1)}.c-bl{left:0;bottom:0;width:40mm;height:40mm;transform:scaleY(-1)}.c-br{right:0;bottom:0;width:40mm;height:40mm;transform:scale(-1,-1)}
.cmed{position:absolute;top:24mm;width:26mm}.cmed svg{width:100%;display:block}.m-l{left:36mm}.m-r{right:36mm}
.cin{position:absolute;left:0;right:0;top:11mm;text-align:center}
.clogo{width:33mm;height:33mm;margin:0 auto}.clogo svg,.clogo img{width:100%;height:100%;display:block;object-fit:contain}.clogo img{display:none}
.t1{margin-top:4.5mm;font-size:17pt;font-weight:600;letter-spacing:.02em;line-height:1.2}
.t2{margin-top:2mm;font-size:12.5pt;font-weight:600;line-height:1.2}
.t3{margin-top:4.6mm;font-size:23pt;font-weight:500;letter-spacing:.02em;line-height:1.2}
.cin h1{margin:5mm 0 0;font-family:'Be Vietnam Pro','Segoe UI',Arial,sans-serif;font-size:36pt;font-weight:800;letter-spacing:.13em;color:#d44a5b;line-height:1.15}
.tang{margin-top:1.6mm;font-size:13pt;font-style:italic;line-height:1.2}
.nm{margin:2.4mm 18mm 0;font-size:31pt;font-weight:500;font-style:italic;line-height:1.25;color:#333}
.a1{margin:3.4mm 20mm 0;font-size:16pt;font-weight:700;color:#e0583f;line-height:1.3}
.a2{margin:1.2mm 20mm 0;font-size:15.5pt;font-weight:700;color:#e0583f;line-height:1.3}
.yr{margin-top:2.4mm;font-size:12.5pt;font-style:italic;line-height:1.3}
.cdec{position:absolute;left:21mm;bottom:38mm;font-size:11.5pt;font-style:italic;line-height:1.5;text-align:left}
.cemb{position:absolute;left:50%;bottom:13mm;width:60mm;transform:translateX(-50%)}.cemb svg{width:100%;display:block}
.csig{position:absolute;right:20mm;bottom:12mm;width:96mm;text-align:center}
.sd{font-size:12pt;font-style:italic;text-align:right;line-height:1.3}
.st{margin-top:5.5mm;font-size:15pt;font-weight:700;letter-spacing:.02em}
.sn{margin-top:21mm;font-family:'Dancing Script','Segoe Script','Brush Script MT',cursive;font-size:24pt;font-weight:600;line-height:1.1}
@media print{body{background:#fff}.tb{display:none}.cpage{margin:0;box-shadow:none}}
</style>`}

/* mở cửa sổ xem trước, đợi phông chữ tải xong rồi mới in (tránh lỗi dấu tiếng Việt bị lệch) */
window.openCert=(pagesHtml,title)=>{
  const w=window.open('','_blank');if(!w)return toast('Trình duyệt chặn cửa sổ in, hãy cho phép pop-up cho trang này');
  w.document.write(`<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"><title>${esc(certNFC(title))}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="${CERT_FONTS}">${certStyle()}</head>
<body><div class="tb"><button onclick="print()">🖨 In giấy khen</button><span>Chọn khổ giấy <b>A4 ngang</b> khi in.</span></div>${pagesHtml}
<script>
(function(){var t='Ạ Ế Ữ Ờ Ộ ặ ề ữ';var f=['italic 500 29pt "Playfair Display"','600 16pt "Playfair Display"','500 22pt "Playfair Display"','800 34pt "Be Vietnam Pro"','600 24pt "Dancing Script"'];
Promise.race([Promise.all(f.map(function(x){return document.fonts.load(x,t)})),new Promise(function(r){setTimeout(r,3500)})]).then(function(){setTimeout(function(){window.focus();window.print()},400)})})();
<\/script></body></html>`);
  w.document.close();
};
