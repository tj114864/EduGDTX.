/* ===== HỘP THOẠI ĐẸP — thay cho confirm()/prompt() mặc định của trình duyệt =====
   uiConfirm(nội dung, {title, okText, cancelText, danger, icon})  -> Promise<boolean>
   uiPrompt(nội dung, giáTrịMặcĐịnh, {title, okText, copy, hideCancel, placeholder}) -> Promise<string|null> */
(()=>{
  const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function open({kind,msg,def,o}){
    return new Promise(resolve=>{
      document.getElementById('dlg')?.remove();
      const danger=o.danger??/^(xóa|thu bài|đang làm bài)/i.test(msg);
      const icon=o.icon||(kind=='prompt'?(o.copy?'🔑':'✏️'):danger?'🗑️':'❓');
      const title=o.title||(kind=='prompt'?'Nhập thông tin':danger?'Bạn chắc chắn chứ?':'Xác nhận');
      const okText=o.okText||(danger?(/^xóa/i.test(msg)?'Xóa':'Đồng ý'):'Đồng ý');
      const d=document.createElement('div');d.id='dlg';
      const app=document.querySelector('.app');                       // mượn màu theo vai trò (admin / giáo viên / học sinh)
      if(app){const cs=getComputedStyle(app);['--pr','--pr2','--g1','--g2'].forEach(v=>d.style.setProperty(v,cs.getPropertyValue(v)))}
      d.innerHTML=`<div class="dbox${danger?' danger':''}" role="alertdialog" aria-modal="true" aria-labelledby="dlgT">
<div class="dico">${icon}</div><h3 id="dlgT">${E(title)}</h3><p>${E(msg)}</p>
${kind=='prompt'?`<div class="dinw"><input id="dlgIn" type="text" autocomplete="off" placeholder="${E(o.placeholder||'')}" value="${E(def)}">${o.copy?'<button type="button" class="ghost dcopy">📋 Sao chép</button>':''}</div>`:''}
<div class="dact">${o.hideCancel?'':`<button type="button" class="ghost dno">${E(o.cancelText||'Hủy')}</button>`}<button type="button" class="dok">${E(okText)}</button></div></div>`;
      document.body.appendChild(d);
      const inp=d.querySelector('#dlgIn'),ok=d.querySelector('.dok'),no=d.querySelector('.dno');
      let closed=false;
      const close=v=>{if(closed)return;closed=true;document.removeEventListener('keydown',key,true);d.classList.add('out');setTimeout(()=>d.remove(),160);resolve(v)};
      const accept=()=>close(kind=='prompt'?inp.value:true),cancel=()=>close(kind=='prompt'?null:false);
      function key(e){
        if(e.key=='Escape'){e.preventDefault();e.stopPropagation();(o.hideCancel?accept:cancel)()}
        else if(e.key=='Enter'&&inp&&document.activeElement==inp){e.preventDefault();accept()}
        else if(e.key=='Tab'){const f=[...d.querySelectorAll('input,button')];const i=f.indexOf(document.activeElement);e.preventDefault();f[(i+(e.shiftKey?-1:1)+f.length)%f.length].focus()}}
      document.addEventListener('keydown',key,true);
      ok.onclick=accept;if(no)no.onclick=cancel;
      d.addEventListener('mousedown',e=>{if(e.target===d&&!o.hideCancel)cancel()});
      d.querySelector('.dcopy')?.addEventListener('click',async e=>{try{await navigator.clipboard.writeText(inp.value)}catch{inp.select();document.execCommand('copy')}e.target.textContent='✅ Đã chép'});
      setTimeout(()=>{if(inp){inp.focus();inp.select()}else(danger&&no?no:ok).focus()},30);
    });
  }
  window.uiConfirm=(msg,o={})=>open({kind:'confirm',msg,o});
  window.uiPrompt=(msg,def='',o={})=>open({kind:'prompt',msg,def,o});
})();
