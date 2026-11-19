// Cầu nối gọi AI (Anthropic Claude). CẦN admin tự cấu hình biến môi trường ANTHROPIC_API_KEY trên máy chủ.
// Đây KHÔNG kèm sẵn khóa API nào — mỗi lần gọi AI sẽ tốn chi phí trên tài khoản API của chính trung tâm.
const MODEL=process.env.ANTHROPIC_MODEL||'claude-sonnet-5-5';   // đổi model bằng biến môi trường ANTHROPIC_MODEL nếu cần
async function askAI(system,user,maxTokens){
  const key=process.env.ANTHROPIC_API_KEY;
  if(!key){const e=new Error('Chưa cấu hình khóa API AI trên máy chủ (biến môi trường ANTHROPIC_API_KEY). Liên hệ người quản trị kỹ thuật để bật tính năng này.');e.code=503;throw e}
  let res;
  try{res=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'x-api-key':key,'anthropic-version':'2023-06-01','content-type':'application/json'},
    body:JSON.stringify({model:MODEL,max_tokens:maxTokens||700,system,messages:Array.isArray(user)?user:[{role:'user',content:user}]})});}
  catch(e){const err=new Error('Không kết nối được tới máy chủ AI.');err.code=502;throw err}
  if(!res.ok){const err=new Error('Máy chủ AI từ chối yêu cầu (mã '+res.status+').');err.code=502;throw err}
  const data=await res.json();
  return(data.content||[]).map(c=>c.text||'').join('').trim();
}
module.exports={askAI,MODEL};
