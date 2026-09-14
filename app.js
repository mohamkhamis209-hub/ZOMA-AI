const state = {
  conversation: null,
  image: null,
  settings: {
    apiBase: window.ZOMA_CONFIG?.API_BASE_URL || 'http://127.0.0.1:8000',
    localSave: true,
    dark: true
  }
};

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

function toast(t) {
  const e = $('#toast');
  e.textContent = t;
  e.classList.add('show');
  setTimeout(() => e.classList.remove('show'), 2600);
}

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function renderText(text) {
  let html = esc(text);

  html = html.replace(
    /```([\s\S]*?)```/g,
    (_, x) => `<pre><code>${x.trim()}</code></pre>`
  );

  return html
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
}

function addBubble(role, text) {
  $('#welcome').classList.add('hidden');

  const row = document.createElement('div');
  row.className = `message ${role}`;

  row.innerHTML = `
    <div class="avatar">${role === 'user' ? 'أنت' : 'Z'}</div>
    <div class="bubble">${renderText(text)}</div>
  `;

  $('#messages').appendChild(row);
  $('#chatArea').scrollTop = $('#chatArea').scrollHeight;
}

async function loadConversations(filter = '') {
  const list = await ZomaDB.listConversations();
  const box = $('#conversationList');

  box.innerHTML = '';

  list
    .filter(c =>
      c.title.toLowerCase().includes(filter.toLowerCase())
    )
    .forEach(c => {
      const e = document.createElement('div');

      e.className =
        'conversation-item' +
        (state.conversation?.id === c.id ? ' active' : '');

      e.textContent = c.title;
      e.onclick = () => openConversation(c.id);

      box.appendChild(e);
    });
}

async function openConversation(id) {
  state.conversation = await ZomaDB.getConversation(id);

  $('#messages').innerHTML = '';

  const msgs = await ZomaDB.getMessages(id);

  if (msgs.length) {
    $('#welcome').classList.add('hidden');

    msgs.forEach(m =>
      addBubble(
        m.role === 'assistant' ? 'assistant' : 'user',
        m.text
      )
    );
  } else {
    $('#welcome').classList.remove('hidden');
  }

  await loadConversations();
  $('#sidebar').classList.remove('open');
}

async function newChat() {
  state.conversation = await ZomaDB.addConversation();

  $('#messages').innerHTML = '';
  $('#welcome').classList.remove('hidden');

  await loadConversations();
  $('#promptInput').focus();
}

async function ensureChat() {
  if (!state.conversation) {
    await newChat();
  }
}

async function send() {
  const input = $('#promptInput');
  const text = input.value.trim();

  if (!text && !state.image) return;

  await ensureChat();

  input.value = '';
  resize();

  $('#sendBtn').disabled = true;

  const image = state.image;
  state.image = null;

  $('#attachmentPreview').classList.add('hidden');

  if (text) {
    addBubble('user', text);
  } else {
    addBubble('user', '[صورة مرفقة]');
  }

  if (state.settings.localSave) {
    await ZomaDB.addMessage(
      state.conversation.id,
      'user',
      text || 'حلل الصورة.'
    );
  }

  const loading = document.createElement('div');

  loading.className = 'message assistant';

  loading.innerHTML = `
    <div class="avatar">Z</div>
    <div class="bubble">جاري التفكير…</div>
  `;

  $('#messages').appendChild(loading);

  try {
    let reply;

    if (image) {
      const fd = new FormData();

      fd.append('file', image);
      fd.append(
        'prompt',
        text || 'حلل الصورة واشرحها بالتفصيل وبالعربية.'
      );

      const r = await fetch(
        state.settings.apiBase + '/api/analyze-image',
        {
          method: 'POST',
          body: fd
        }
      );

      const j = await r.json();

      if (!r.ok) {
        throw new Error(
          j.detail || 'فشل تحليل الصورة'
        );
      }

      reply = j.reply;
    } else {
      const msgs = state.settings.localSave
        ? await ZomaDB.getMessages(state.conversation.id)
        : [
            {
              role: 'user',
              text
            }
          ];

      const r = await fetch(
        state.settings.apiBase + '/api/chat',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            messages: msgs.map(m => ({
              role:
                m.role === 'assistant'
                  ? 'assistant'
                  : 'user',
              text: m.text
            }))
          })
        }
      );

      const j = await r.json();

      if (!r.ok) {
        throw new Error(
          j.detail || 'فشل الاتصال'
        );
      }

      reply = j.reply;
    }

    loading.remove();

    addBubble('assistant', reply);

    if (state.settings.localSave) {
      await ZomaDB.addMessage(
        state.conversation.id,
        'assistant',
        reply
      );
    }

    await loadConversations();

  } catch (e) {
    loading.remove();

    addBubble(
      'assistant',
      'حدث خطأ: ' + e.message
    );
  } finally {
    $('#sendBtn').disabled = false;
  }
}

function resize() {
  const e = $('#promptInput');

  e.style.height = 'auto';

  e.style.height =
    Math.min(e.scrollHeight, 180) + 'px';
}

async function backup() {
  try {
    await ZomaBackup.download();
    toast('تم تجهيز النسخة الاحتياطية');
  } catch (e) {
    toast(e.message);
  }
}

async function restore(file) {
  try {
    if (
      !confirm(
        'استعادة النسخة ستستبدل البيانات المحلية الحالية. هل تريد المتابعة؟'
      )
    ) {
      return;
    }

    await ZomaBackup.restore(file);

    state.conversation = null;

    await loadConversations();

    $('#messages').innerHTML = '';
    $('#welcome').classList.remove('hidden');

    toast('تمت الاستعادة بنجاح');

  } catch (e) {
    toast(e.message);
  }
}

function loadSettings() {
  try {
    const s = JSON.parse(
      localStorage.getItem('zoma_settings')
    );

    if (s) {
      state.settings = {
        ...state.settings,
        ...s
      };
    }
  } catch {}

  if (!state.settings.apiBase) {
    state.settings.apiBase =
      window.ZOMA_CONFIG?.API_BASE_URL ||
      'http://127.0.0.1:8000';
  }

  $('#apiBaseInput').value =
    state.settings.apiBase;

  $('#localSave').checked =
    state.settings.localSave;

  $('#darkMode').checked =
    state.settings.dark;
}

function saveSettings() {
  state.settings.apiBase =
    $('#apiBaseInput').value
      .trim()
      .replace(/\/$/, '');

  state.settings.localSave =
    $('#localSave').checked;

  state.settings.dark =
    $('#darkMode').checked;

  localStorage.setItem(
    'zoma_settings',
    JSON.stringify(state.settings)
  );

  $('#settingsModal').classList.add('hidden');

  toast('تم حفظ الإعدادات');
}

$('#newChatBtn').onclick = newChat;

$('#composer').onsubmit = e => {
  e.preventDefault();
  send();
};

$('#promptInput').addEventListener(
  'input',
  resize
);

$('#promptInput').addEventListener(
  'keydown',
  e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }
);

$('#imageInput').onchange = e => {
  state.image =
    e.target.files[0] || null;

  if (state.image) {
    $('#attachmentPreview').classList.remove(
      'hidden'
    );

    $('#attachmentPreview').innerHTML = `
      <span class="attachment-chip">
        🖼️ ${esc(state.image.name)}
        <button
          type="button"
          onclick="state.image=null;$('#attachmentPreview').classList.add('hidden')"
        >
          ×
        </button>
      </span>
    `;
  }
};

$('#backupBtn').onclick = backup;

$('#restoreInput').onchange = e => {
  if (e.target.files[0]) {
    restore(e.target.files[0]);
  }

  e.target.value = '';
};

$('#settingsBtn').onclick = () =>
  $('#settingsModal').classList.remove('hidden');

$('#closeSettings').onclick = () =>
  $('#settingsModal').classList.add('hidden');

$('#saveSettings').onclick = saveSettings;

$('#searchInput').oninput = e =>
  loadConversations(e.target.value);

$('#clearBtn').onclick = async () => {
  if (
    state.conversation &&
    !confirm('مسح هذه المحادثة؟')
  ) {
    return;
  }

  if (state.conversation) {
    await ZomaDB.deleteConversation(
      state.conversation.id
    );

    state.conversation = null;

    $('#messages').innerHTML = '';
    $('#welcome').classList.remove('hidden');

    await loadConversations();
  }
};

$('#menuBtn').onclick = () =>
  $('#sidebar').classList.toggle('open');

$$('.suggestions button').forEach(b => {
  b.onclick = () => {
    $('#promptInput').value =
      b.dataset.prompt;

    resize();
    send();
  };
});

(async () => {
  loadSettings();

  try {
    await ZomaDB.requestPersistence();
  } catch {}

  await loadConversations();

  const list =
    await ZomaDB.listConversations();

  if (list[0]) {
    await openConversation(list[0].id);
  }
})();
