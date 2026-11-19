/* ===== MENU 3 GẠCH (☰) cho cả 3 vai trò: Admin / Giáo viên / Học sinh =====
   - Điện thoại / màn hình nhỏ: mở ngăn menu trượt từ bên trái, liệt kê đầy đủ tính năng theo vai trò.
   - Máy tính: bấm ☰ để thu gọn / mở rộng thanh bên (ghi nhớ lựa chọn).
   Danh sách tính năng lấy trực tiếp từ NAV nên mọi tính năng thêm sau này cũng tự xuất hiện. */
const isSmall=()=>matchMedia('(max-width:860px)').matches;
const navOn=k=>tab==k||(k==''&&/^(r:|g:|edit|live:)/.test(tab))||(k=='mis'&&tab=='mq')||(k=='res'&&tab.startsWith('rv:'));
const MENU_GROUPS={ // gom nhóm cho dễ nhìn; mục nào không có trong danh sách sẽ rơi vào nhóm "Khác"
  admin:[['Hệ thống',['','overview','attend','log']],['Thông báo & theo dõi',['broadcast','watchlist','allgrade','events']],['Tài khoản',['pw']]],
  gv:[['Giảng dạy',['','new','bank','grade','cal','stype','ai']],['Lớp học',['ann','inbox','mat','att','poll','events','leaves']],['Tài khoản',['pw']]],
  hs:[['Học tập',['','mis','res','rank','fav','ai']],['Lớp học',['ann','mat','att','poll','events','leaves']],['Tài khoản',['profile','pw']]]};
function menuHTML(){
  const items=NAV[me.role],byKey=Object.fromEntries(items.map(n=>[n[0],n])),used=new Set();
  const link=([k,i,t])=>`<a class="${navOn(k)?'on':''}" onclick="menuGo('${k}')"><span>${i}</span><em>${t}</em></a>`;
  let groups=(MENU_GROUPS[me.role]||[]).map(([name,keys])=>{const its=keys.filter(k=>byKey[k]).map(k=>(used.add(k),byKey[k]));return its.length?`<div class="dgrp"><small>${name}</small>${its.map(link).join('')}</div>`:''}).join('');
  const rest=items.filter(n=>!used.has(n[0]));
  if(rest.length)groups+=`<div class="dgrp"><small>Khác</small>${rest.map(link).join('')}</div>`;
  const av=esc((me.name.trim().split(/\s+/).pop()[0]||'?').toUpperCase());
  return`<div class="dov" onclick="menuToggle(false)"></div><aside class="drawer" role="dialog" aria-label="Menu">
<div class="dhead"><span class="av">${av}</span><div><b>${esc(me.name)}</b><small>${ROLE[me.role]}</small></div><button class="dclose" onclick="menuToggle(false)" aria-label="Đóng menu">✕</button></div>
<nav>${groups}</nav>
<div class="dfoot"><button class="ghost" onclick="menuToggle(false);theme()">${dark?'☀️ Chế độ sáng':'🌙 Chế độ tối'}</button><button class="ghost" onclick="menuToggle(false);logout()">⎋ Đăng xuất</button></div></aside>`}
function injectMenu(){
  const app=document.querySelector('.app');if(!app||!me)return;
  document.querySelectorAll('.drawer,.dov,.hamb').forEach(e=>e.remove());app.classList.remove('menu-open');
  if(app.classList.contains('focus'))return;                       // đang làm bài thi thì không hiện menu
  app.classList.remove('col');
  const top=app.querySelector('header.top');if(!top)return;
  top.insertAdjacentHTML('afterbegin','<button class="hamb" onclick="menuToggle()" aria-label="Mở menu" title="Menu"><i></i><i></i><i></i></button>');
  app.insertAdjacentHTML('beforeend',menuHTML());
}
window.menuToggle=force=>{
  const app=document.querySelector('.app');if(!app)return;
  if(!isSmall())return;   // máy tính dùng thanh bên trái, chỉ điện thoại dùng menu ☰
    const on=force===undefined?!app.classList.contains('menu-open'):force;app.classList.toggle('menu-open',on);document.body.style.overflow=on?'hidden':''};
window.menuGo=k=>{document.body.style.overflow='';go(k);window.scrollTo(0,0)};
document.addEventListener('keydown',e=>{if(e.key=='Escape')menuToggle(false)});
matchMedia('(max-width:860px)').addEventListener?.('change',()=>{document.body.style.overflow='';injectMenu()});
const _render9=render;
render=async function(){await _render9();injectMenu()};
