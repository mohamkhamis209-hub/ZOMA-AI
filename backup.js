const ZomaBackup = (() => {
  const enc = new TextEncoder(), dec = new TextDecoder();
  async function derive(password, salt) {
    const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:180000,hash:'SHA-256'}, base, {name:'AES-GCM',length:256}, false, ['encrypt','decrypt']);
  }
  function b64(buf) { let s=''; for (const b of new Uint8Array(buf)) s += String.fromCharCode(b); return btoa(s); }
  function unb64(s) { return Uint8Array.from(atob(s), c => c.charCodeAt(0)); }
  async function download(password='') {
    const data = JSON.stringify(await ZomaDB.exportAll());
    let out;
    if (password) {
      const salt=crypto.getRandomValues(new Uint8Array(16)), iv=crypto.getRandomValues(new Uint8Array(12));
      const key=await derive(password,salt), cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,enc.encode(data));
      out={format:'ZOMA_ENCRYPTED',version:2,salt:b64(salt),iv:b64(iv),data:b64(cipher)};
    } else out={format:'ZOMA_PLAIN',version:2,data};
    const blob=new Blob([JSON.stringify(out)],{type:'application/octet-stream'}), url=URL.createObjectURL(blob), a=document.createElement('a');
    a.href=url; a.download=`zoma-backup-${new Date().toISOString().slice(0,10)}.zoma`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  async function restore(file) {
    const raw=JSON.parse(await file.text()); let data;
    if(raw.format==='ZOMA_ENCRYPTED'){
      const password=prompt('أدخل كلمة مرور النسخة الاحتياطية:'); if(password===null)return false;
      try{const key=await derive(password,unb64(raw.salt));const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(raw.iv)},key,unb64(raw.data));data=JSON.parse(dec.decode(plain));}
      catch{throw new Error('كلمة المرور غير صحيحة أو الملف تالف');}
    } else if(raw.format==='ZOMA_PLAIN') data=JSON.parse(raw.data);
    else if(raw.format==='ZOMA_BACKUP') data=raw.data?JSON.parse(raw.data):raw;
    else throw new Error('نوع ملف النسخة غير معروف');
    await ZomaDB.importAll(data); return true;
  }
  return {download,restore};
})();
