const state = {
  conversation: null,
  image: null,
  file: null,
  menuConversation: null,
  settings: { apiBase: window.ZOMA_CONFIG?.API_BASE_URL || '', localSave: true, dark: true }
};
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

function toast(text) { const e=$('#toast'); e.textContent=text; e.classList.add('show'); clearTimeout(window.__toast); window.__toast=setTimeout(()=>e.classList.remove('show'),2800); }
function esc(text) { const d=document.createElement('div'); d.textContent=String(text ?? ''); return d.innerHTML; }
function renderText(text) {
  let html=esc(text);
  html=html.replace(/```(?:[\w-]+)?\n?([\s\S]*?)```/g,(_,x)=>`<pre><code>${x.trim()}</code></pre>`);
  html=html.replace(/`([^`]+)`/g,'<code class="inline-code">$1</code>');
  html=html.replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>');
  return html.replace(/\n/g,'<br>');
}
function scrollBottom(){const e=$('#chatArea'); requestAnimationFrame(()=>e.scrollTop=e.scrollHeight);}
function addBubble(role,text,opts={}) {
  $('#welcome').classList.add('hidden');
  const row=document.createElement('div'); row.className=`message ${role}`;
  row.innerHTML=`<div class="avatar">${role==='user'?'أنت':'Z'}</div><div class="message-body"><div class="bubble">${renderText(text)}</div><div class="message-tools">${role==='assistant'?'<button type="button" class="tool-icon" data-action="copy" title="نسخ الرد" aria-label="نسخ الرد">⧉</button><button type="button" class="tool-icon" data-action="regenerate" title="إعادة توليد الرد" aria-label="إعادة توليد الرد">↻</button>':'<button type="button" class="tool-icon" data-action="copy" title="نسخ الرسالة" aria-label="نسخ الرسالة">⧉</button>'}</div></div>`;
  row.querySelector('[data-action="copy"]').onclick=()=>navigator.clipboard?.writeText(String(text)).then(()=>toast('تم النسخ')).catch(()=>toast('تعذر النسخ'));
  if(role==='assistant') row.querySelector('[data-action="regenerate"]').onclick=()=>regenerate();
  $('#messages').appendChild(row); if(!opts.skipScroll)scrollBottom();
  return row;
}
async function loadConversations(filter='') {
  const list=await ZomaDB.listConversations(), q=filter.trim().toLowerCase(), box=$('#conversationList'); box.innerHTML='';
  $('#chatCount').textContent=list.length;
  const filtered=list.filter(c=>String(c.title).toLowerCase().includes(q));
  if(!filtered.length){box.innerHTML='<div class="empty-list">لا توجد محادثات</div>';return;}
  filtered.forEach(c=>{
    const e=document.createElement('div'); e.className='conversation-item'+(state.conversation?.id===c.id?' active':'');
    e.innerHTML=`<div class="conv-main"><span class="pin">${c.pinned?'★':''}</span><span>${esc(c.title)}</span></div><button class="conv-more" aria-label="خيارات المحادثة" title="خيارات المحادثة">⋯</button>`;
    e.querySelector('.conv-main').onclick=()=>openConversation(c.id);
    e.querySelector('.conv-more').onclick=(ev)=>{ev.stopPropagation();showConversationMenu(c)};
    box.appendChild(e);
  });
}
function showConversationMenu(c){
  state.menuConversation=c;
  $('#conversationMenuTitle').textContent=`خيارات «${c.title}»`;
  $('#menuPinBtn span').textContent=c.pinned?'إلغاء تثبيت المحادثة':'تثبيت المحادثة';
  $('#conversationMenu').classList.remove('hidden');
  $('#conversationMenu').setAttribute('aria-hidden','false');
}
function closeConversationMenu(){ $('#conversationMenu').classList.add('hidden'); $('#conversationMenu').setAttribute('aria-hidden','true'); state.menuConversation=null; }
async function openConversation(id){
  state.conversation=await ZomaDB.getConversation(id); if(!state.conversation)return;
  $('#messages').innerHTML=''; const msgs=await ZomaDB.getMessages(id);
  if(msgs.length){$('#welcome').classList.add('hidden');msgs.forEach(m=>addBubble(m.role==='assistant'?'assistant':'user',m.text,{skipScroll:true}));scrollBottom();}
  else $('#welcome').classList.remove('hidden');
  await loadConversations(); $('#sidebar').classList.remove('open');
}
async function newChat(){state.conversation=await ZomaDB.addConversation();$('#messages').innerHTML='';$('#welcome').classList.remove('hidden');await loadConversations();$('#promptInput').focus();}
function resize(){const e=$('#promptInput');e.style.height='auto';e.style.height=Math.min(e.scrollHeight,180)+'px';}
function setTheme(dark){state.settings.dark=dark;document.documentElement.dataset.theme=dark?'dark':'light';$('#themeToggle .switch').classList.toggle('on',dark);}
function setLocalSave(on){state.settings.localSave=on;$('#localSwitch').classList.toggle('on',on);}
function loadSettings(){try{const s=JSON.parse(localStorage.getItem('zoma_settings'));if(s)state.settings={...state.settings,...s};}catch{};if(!state.settings.apiBase)state.settings.apiBase=window.ZOMA_CONFIG?.API_BASE_URL||'';setTheme(state.settings.dark);setLocalSave(state.settings.localSave);}
function saveSettings(){localStorage.setItem('zoma_settings',JSON.stringify({localSave:state.settings.localSave,dark:state.settings.dark}));$('#settingsModal').classList.add('hidden');$('#settingsModal').setAttribute('aria-hidden','true');toast('تم حفظ الإعدادات');}
async function ensureChat(){if(!state.conversation)await newChat();}
function resize(){const e=$('#promptInput');e.style.height='auto';e.style.height=Math.min(e.scrollHeight,180)+'px';}
function setTheme(dark){state.settings.dark=dark;document.documentElement.dataset.theme=dark?'dark':'light';$('#themeToggle .switch').classList.toggle('on',dark);}
function setLocalSave(on){state.settings.localSave=on;$('#localSwitch').classList.toggle('on',on);}
function loadSettings(){try{const s=JSON.parse(localStorage.getItem('zoma_settings'));if(s)state.settings={...state.settings,...s};}catch{};if(!state.settings.apiBase)state.settings.apiBase=window.ZOMA_CONFIG?.API_BASE_URL||'';setTheme(state.settings.dark);setLocalSave(state.settings.localSave);$('#serverDisplay').textContent=state.settings.apiBase||'غير محدد';}
function saveSettings(){state.settings.apiBase=state.settings.apiBase.replace(/\/$/,'');localStorage.setItem('zoma_settings',JSON.stringify(state.settings));$('#settingsModal').classList.add('hidden');$('#settingsModal').setAttribute('aria-hidden','true');toast('تم حفظ الإعدادات');}
async function checkServer(){const b=$('#checkServerBtn');b.disabled=true;b.textContent='جاري الاختبار…';try{const r=await fetch(state.settings.apiBase+'/api/health',{cache:'no-store'});const j=await r.json();if(!r.ok)throw new Error(j.detail||'فشل الاتصال');$('#serverStatus').textContent=`متصل • ${j.model||'Gemini'}`;$('#serverStatus').classList.add('good');$('#statusDot').classList.add('online');$('#modelName').textContent=j.model||'Gemini';toast('الخادم يعمل بنجاح');}catch(e){$('#serverStatus').textContent='تعذر الاتصال';$('#serverStatus').classList.remove('good');$('#statusDot').classList.remove('online');toast('تعذر الاتصال بالخادم');}finally{b.disabled=false;b.textContent='اختبار الاتصال';}}
async function send(){
  const input=$('#promptInput'), text=input.value.trim(); if(!text&&!state.image)return;
  await ensureChat(); input.value='';resize();$('#sendBtn').disabled=true;
  const image=state.image; state.image=null; $('#imageInput').value=''; $('#attachmentPreview').classList.add('hidden');
  const shown=text || '🖼️ صورة مرفقة'; addBubble('user',shown);
  if(state.settings.localSave)await ZomaDB.addMessage(state.conversation.id,'user',text||'حلل الصورة.');
  const loading=addBubble('assistant','جاري التفكير…'); loading.classList.add('loading-message');
  try{
    let reply='';
    if(image){
      if(image.size>10*1024*1024)throw new Error('حجم الصورة أكبر من 10MB');
      const fd=new FormData();fd.append('file',image);fd.append('prompt',text||'حلل الصورة واشرحها بالتفصيل وبالعربية.');
      const r=await fetch(state.settings.apiBase+'/api/analyze-image',{method:'POST',body:fd});const j=await safeJson(r);if(!r.ok)throw new Error(j.detail||'فشل تحليل الصورة');reply=j.reply||'لم يصل رد من الخادم.';
    }else{
      const msgs=state.settings.localSave?await ZomaDB.getMessages(state.conversation.id):[{role:'user',text}];
      const payload={messages:msgs.slice(-40).map(m=>({role:m.role==='assistant'?'assistant':'user',text:String(m.text).slice(0,30000)}))};
      const r=await fetch(state.settings.apiBase+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const j=await safeJson(r);if(!r.ok)throw new Error(j.detail||'فشل الاتصال بالخادم');reply=j.reply||'لم يصل رد من الخادم.';
    }
    loading.remove();addBubble('assistant',reply);if(state.settings.localSave)await ZomaDB.addMessage(state.conversation.id,'assistant',reply);await loadConversations();
  }catch(e){loading.remove();addBubble('assistant','حدث خطأ: '+(e.message||'تعذر تنفيذ الطلب.'));}
  finally{$('#sendBtn').disabled=false;input.focus();}
}
async function safeJson(r){try{return await r.json();}catch{return {detail:`خطأ HTTP ${r.status}`};}}
async function regenerate(){
  if(!state.conversation)return;
  const msgs=await ZomaDB.getMessages(state.conversation.id); const last=[...msgs].reverse().find(m=>m.role==='user'); if(!last)return toast('لا توجد رسالة لإعادة التوليد');
  $('#promptInput').value=last.text; resize(); await send();
}
async function deleteConversation(id){if(!confirm('حذف هذه المحادثة نهائيًا من هذا الجهاز؟'))return;await ZomaDB.deleteConversation(id);if(state.conversation?.id===id){state.conversation=null;$('#messages').innerHTML='';$('#welcome').classList.remove('hidden');}await loadConversations();toast('تم حذف المحادثة');}
function openBackupModal(){ $('#backupModal').classList.remove('hidden'); $('#backupModal').setAttribute('aria-hidden','false'); }
function closeBackupModal(){ $('#backupModal').classList.add('hidden'); $('#backupModal').setAttribute('aria-hidden','true'); }
async function downloadBackup(password=''){
  try { await ZomaBackup.download(password); toast('تم إنشاء النسخة الاحتياطية'); }
  catch(e){ toast(e.message||'تعذر إنشاء النسخة'); }
}
async function restore(file){try{if(!confirm('استعادة النسخة ستستبدل المحادثات المحلية الحالية. هل تريد المتابعة؟'))return;await ZomaBackup.restore(file);state.conversation=null;$('#messages').innerHTML='';$('#welcome').classList.remove('hidden');await loadConversations();toast('تمت الاستعادة بنجاح')}catch(e){toast(e.message||'فشل الاستعادة')}}
function setAttachment(file){
  state.image=null; state.file=null;
  if(!file){$('#attachmentPreview').classList.add('hidden');return;}
  if(file.type.startsWith('image/')) state.image=file; else state.file=file;
  $('#attachmentPreview').classList.remove('hidden');
  const icon=file.type.startsWith('image/')?'🖼️':'📎';
  $('#attachmentPreview').innerHTML=`<div class="attachment-chip">${icon} <span>${esc(file.name)}</span><button type="button" id="removeAttachment" aria-label="إزالة المرفق">×</button></div>`;
  $('#removeAttachment').onclick=()=>{state.image=null;state.file=null;$('#imageInput').value='';$('#attachmentPreview').classList.add('hidden');};
}

$('#newChatBtn').onclick=newChat;
$('#composer').onsubmit=e=>{e.preventDefault();send()};
$('#promptInput').addEventListener('input',resize);
$('#promptInput').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}});
$('#imageInput').onchange=e=>setAttachment(e.target.files[0]||null);
$('#backupBtn').onclick=openBackupModal;
$('#backupPlainBtn').onclick=async()=>{closeBackupModal();await downloadBackup('');};
$('#backupPasswordBtn').onclick=()=>{$('#backupModal').classList.add('hidden');$('#backupPasswordInput').value='';$('#passwordModal').classList.remove('hidden');$('#passwordModal').setAttribute('aria-hidden','false');setTimeout(()=>$('#backupPasswordInput').focus(),100);};
$('#savePasswordBackup').onclick=async()=>{const p=$('#backupPasswordInput').value;if(!p)return toast('اكتب كلمة المرور أولًا');$('#passwordModal').classList.add('hidden');$('#passwordModal').setAttribute('aria-hidden','true');await downloadBackup(p);};
$('#cancelPasswordBackup').onclick=()=>{$('#passwordModal').classList.add('hidden');$('#passwordModal').setAttribute('aria-hidden','true');};
$('#closeBackupModal').onclick=closeBackupModal;
$('#closePasswordModal').onclick=()=>$('#cancelPasswordBackup').click();
$('#restoreInput').onchange=e=>{if(e.target.files[0])restore(e.target.files[0]);e.target.value='';};
$('#settingsBtn').onclick=()=>{loadSettings();$('#settingsModal').classList.remove('hidden');$('#settingsModal').setAttribute('aria-hidden','false');};
$('#closeSettings').onclick=()=>{$('#settingsModal').classList.add('hidden');$('#settingsModal').setAttribute('aria-hidden','true');};
$('#saveSettings').onclick=saveSettings;
$('#themeToggle').onclick=()=>setTheme(!state.settings.dark); $('#localSaveRow').onclick=()=>setLocalSave(!state.settings.localSave);
$('#searchInput').oninput=e=>loadConversations(e.target.value);
$('#clearBtn').onclick=async()=>{if(state.conversation)await deleteConversation(state.conversation.id);};
$('#menuBtn').onclick=()=>$('#sidebar').classList.add('open'); $('#closeSidebar').onclick=()=>$('#sidebar').classList.remove('open');
$('#closeConversationMenu').onclick=closeConversationMenu;
$('#menuPinBtn').onclick=async()=>{if(!state.menuConversation)return;await ZomaDB.togglePinned(state.menuConversation.id);closeConversationMenu();await loadConversations();toast('تم تحديث التثبيت');};
$('#menuDeleteBtn').onclick=async()=>{if(!state.menuConversation)return;const id=state.menuConversation.id;closeConversationMenu();await deleteConversation(id);};
$$('.suggestions button').forEach(b=>b.onclick=()=>{$('#promptInput').value=b.dataset.prompt;resize();$('#promptInput').focus();});

let transferMode='';
function openTransfer(){
  ZomaTransfer.close();
  $('#transferModal').classList.remove('hidden'); $('#transferModal').setAttribute('aria-hidden','false');
  $('#transferChoice').classList.remove('hidden'); $('#transferSendPanel').classList.add('hidden'); $('#transferReceivePanel').classList.add('hidden');
}
function closeTransfer(){ ZomaTransfer.close(); $('#transferModal').classList.add('hidden'); $('#transferModal').setAttribute('aria-hidden','true'); }
async function startTransferSend(){
  transferMode='send'; $('#transferChoice').classList.add('hidden'); $('#transferSendPanel').classList.remove('hidden');
  $('#transferSendStatus').textContent='جاري تجهيز المحادثات…';
  try{
    const data=await ZomaDB.exportAll();
    const meta=await ZomaTransfer.startSender(data);
    $('#transferSendStatus').textContent='جاهز للإرسال — امسح رمز QR من الجهاز الآخر.';
    $('#transferProgressText').textContent=`1 / ${meta.total}`;
  }catch(e){ $('#transferSendStatus').textContent=e.message||'تعذر تجهيز النقل.'; toast(e.message||'تعذر تجهيز النقل'); }
}
async function startTransferReceive(){
  transferMode='receive'; $('#transferChoice').classList.add('hidden'); $('#transferReceivePanel').classList.remove('hidden');
  $('#transferReceiveStatus').textContent='اضغط تشغيل الكاميرا ثم وجّهها إلى QR.';
  $('#transferReceiveProgressText').textContent='0 / 0'; $('#transferReceiveProgressBar').style.width='0%';
}
window.__zomaTransferOnData=async data=>{
  try{
    await ZomaDB.importAll(data); state.conversation=null; $('#messages').innerHTML=''; $('#welcome').classList.remove('hidden');
    await loadConversations(); toast('تم استقبال المحادثات بنجاح');
  }catch(e){ toast(e.message||'فشل استقبال المحادثات'); }
};
$('#transferBtn').onclick=openTransfer;
$('#closeTransferModal').onclick=closeTransfer;
$('#transferSendBtn').onclick=startTransferSend;
$('#transferReceiveBtn').onclick=startTransferReceive;
$('#transferSendStopBtn').onclick=()=>{ZomaTransfer.close();openTransfer();};
$('#transferReceiveBackBtn').onclick=()=>{ZomaTransfer.close();openTransfer();};
$('#transferStartScanBtn').onclick=async()=>{try{await ZomaTransfer.startReceiver();$('#transferReceiveStatus').textContent='الكاميرا تعمل… وجّهها إلى رمز QR.';}catch(e){$('#transferReceiveStatus').textContent=e.message||'تعذر تشغيل الكاميرا.';toast(e.message||'تعذر تشغيل الكاميرا');}};
$('#transferStopScanBtn').onclick=()=>{ZomaTransfer.stopCamera();$('#transferReceiveStatus').textContent='تم إيقاف الكاميرا.';};
(async()=>{loadSettings();try{await ZomaDB.requestPersistence();}catch{}await loadConversations();const list=await ZomaDB.listConversations();if(list[0])await openConversation(list[0].id);})();
