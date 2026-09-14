const ZomaDB = (() => {
  const DB_NAME = 'zoma_ai_db';
  const VERSION = 3;
  let dbPromise;
  const makeId = () => crypto.randomUUID();

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('conversations')) {
          const s = db.createObjectStore('conversations', { keyPath: 'id' });
          s.createIndex('updatedAt', 'updatedAt');
        }
        if (!db.objectStoreNames.contains('messages')) {
          const s = db.createObjectStore('messages', { keyPath: 'id' });
          s.createIndex('conversationId', 'conversationId');
        }
        if (!db.objectStoreNames.contains('attachments')) {
          const s = db.createObjectStore('attachments', { keyPath: 'id' });
          s.createIndex('conversationId', 'conversationId');
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  async function request(storeNames, mode, work) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeNames, mode);
      const stores = Array.isArray(storeNames) ? storeNames.map(n => tx.objectStore(n)) : tx.objectStore(storeNames);
      let result;
      try { result = work(stores, tx); } catch (e) { reject(e); return; }
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error || new Error('فشلت عملية قاعدة البيانات'));
      tx.onabort = () => reject(tx.error || new Error('تم إلغاء عملية قاعدة البيانات'));
    });
  }

  async function addConversation(title = 'محادثة جديدة') {
    const now = Date.now();
    const c = { id: makeId(), title, createdAt: now, updatedAt: now, pinned: false };
    await request('conversations', 'readwrite', s => s.put(c));
    return c;
  }

  async function listConversations() {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('conversations', 'readonly');
      const req = tx.objectStore('conversations').getAll();
      req.onsuccess = () => resolve(req.result.sort((a,b) => (b.pinned-a.pinned) || (b.updatedAt-a.updatedAt)));
      req.onerror = () => reject(req.error);
    });
  }

  async function getConversation(id) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const req = db.transaction('conversations', 'readonly').objectStore('conversations').get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async function updateConversation(c) {
    c.updatedAt = Date.now();
    await request('conversations', 'readwrite', s => s.put(c));
    return c;
  }

  async function addMessage(conversationId, role, text, meta = {}) {
    const m = { id: makeId(), conversationId, role, text: String(text || ''), createdAt: Date.now(), ...meta };
    await request('messages', 'readwrite', s => s.put(m));
    const c = await getConversation(conversationId);
    if (c) {
      if (role === 'user' && (!c.title || c.title === 'محادثة جديدة')) c.title = String(text || '').replace(/\s+/g, ' ').slice(0, 48) || 'محادثة جديدة';
      await updateConversation(c);
    }
    return m;
  }

  async function getMessages(conversationId) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const req = db.transaction('messages', 'readonly').objectStore('messages').index('conversationId').getAll(conversationId);
      req.onsuccess = () => resolve(req.result.sort((a,b) => a.createdAt-b.createdAt));
      req.onerror = () => reject(req.error);
    });
  }

  async function addAttachment(conversationId, file) {
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error || new Error('تعذر حفظ الملف'));
      reader.readAsDataURL(file);
    });
    const item = { id: makeId(), conversationId, name: file.name, type: file.type || 'application/octet-stream', size: file.size, dataUrl, createdAt: Date.now() };
    await request('attachments', 'readwrite', s => s.put(item));
    return item;
  }

  async function getAttachment(id) {
    if (!id) return null;
    const db = await open();
    return new Promise((resolve, reject) => {
      const req = db.transaction('attachments', 'readonly').objectStore('attachments').get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async function getAttachments(conversationId) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const req = db.transaction('attachments', 'readonly').objectStore('attachments').index('conversationId').getAll(conversationId);
      req.onsuccess = () => resolve(req.result.sort((a,b) => a.createdAt-b.createdAt));
      req.onerror = () => reject(req.error);
    });
  }

  async function deleteConversation(conversationId) {
    const db = await open();
    const messages = await getMessages(conversationId);
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['conversations','messages','attachments'], 'readwrite');
      tx.objectStore('conversations').delete(conversationId);
      for (const m of messages) tx.objectStore('messages').delete(m.id);
      const aReq = tx.objectStore('attachments').index('conversationId').getAllKeys(conversationId);
      aReq.onsuccess = () => aReq.result.forEach(k => tx.objectStore('attachments').delete(k));
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }

  async function clearAll() { return request(['conversations','messages','attachments'], 'readwrite', stores => stores.forEach(s => s.clear())); }

  async function exportAll() {
    const db = await open();
    const read = name => new Promise((resolve,reject) => {
      const req = db.transaction(name,'readonly').objectStore(name).getAll();
      req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
    });
    const [conversations,messages,attachments] = await Promise.all(['conversations','messages','attachments'].map(read));
    return { format:'ZOMA_BACKUP', version:3, exportedAt:new Date().toISOString(), conversations, messages, attachments };
  }

  async function importAll(data, merge = false) {
    if (!data || data.format !== 'ZOMA_BACKUP') throw new Error('ملف النسخة غير صالح');
    if (!merge) await clearAll();
    const db = await open();
    return new Promise((resolve,reject) => {
      const tx = db.transaction(['conversations','messages','attachments'],'readwrite');
      (data.conversations || []).forEach(x => tx.objectStore('conversations').put(x));
      (data.messages || []).forEach(x => tx.objectStore('messages').put(x));
      (data.attachments || []).forEach(x => tx.objectStore('attachments').put(x));
      tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
    });
  }

  async function importConversation(data) {
    if (!data || data.type !== 'zoma-conversation' || !data.conversation) throw new Error('ملف المحادثة غير صالح');
    const oldId = data.conversation.id;
    const created = await addConversation(data.conversation.title || 'محادثة مستعادة');
    const attachmentMap = new Map();
    for (const a of (data.attachments || [])) {
      const id = makeId();
      attachmentMap.set(a.id, id);
      await request('attachments', 'readwrite', s => s.put({...a, id, conversationId: created.id}));
    }
    for (const m of (data.messages || [])) {
      const meta = {...m};
      delete meta.id; delete meta.conversationId;
      if (meta.attachmentId && attachmentMap.has(meta.attachmentId)) meta.attachmentId = attachmentMap.get(meta.attachmentId);
      await addMessage(created.id, m.role, m.text, meta);
    }
    created.pinned = !!data.conversation.pinned;
    created.createdAt = data.conversation.createdAt || created.createdAt;
    await updateConversation(created);
    return created;
  }

  async function togglePinned(id) { const c = await getConversation(id); if (!c) return null; c.pinned = !c.pinned; return updateConversation(c); }
  async function requestPersistence() { try { return await navigator.storage?.persist?.() || false; } catch { return false; } }

  return { addConversation, listConversations, getConversation, updateConversation, addMessage, getMessages, addAttachment, getAttachment, getAttachments, deleteConversation, clearAll, exportAll, importAll, importConversation, togglePinned, requestPersistence };
})();
