/* =====================================================
   NEXUS AI AGENT PLATFORM — app.js v3
   • No emojis anywhere
   • Real-time typewriter streaming animation
   • Full agent management lifecycle
   ===================================================== */

// ── CONFIG ────────────────────────────────────────────
const API_BASE_URL = 'http://localhost:8000';

// Apply stored theme IMMEDIATELY (before DOM paint) to avoid flash
(function() {
  const t = localStorage.getItem('nexus-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', t);
})();

// Streaming: characters per 15ms burst
const STREAM_CHUNK = 3;
const STREAM_INTERVAL_MS = 14;

// ── STATE ─────────────────────────────────────────────
const state = {
  view: 'chat',
  activeAgent: null,
  agents: [],
  chats: [],
  activeChatId: null,
  streaming: false,
  selectedModel: 'llama',
  attachedFile: null,
  generatedContent: null,
  generatedName: null,
  agentToDelete: null,
};

let chatCounter = 0;

// ── AGENT METADATA ────────────────────────────────────
const AGENT_META = {
  medical_report_simplifier: {
    label: 'Medical Report Simplifier',
    desc: 'Translates complex medical reports into clear, plain-language summaries.',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>`,
  },
  email_outreach_agent: {
    label: 'Email Outreach Agent',
    desc: 'Crafts professional, personalised email sequences for sales and marketing.',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>`,
  },
  healthcare_revenue_agent: {
    label: 'Healthcare Revenue Agent',
    desc: 'Analyses billing cycles, identifies revenue leaks, and recommends fixes.',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
  },
  data_analyst: {
    label: 'Data Analyst',
    desc: 'Processes structured datasets and surfaces actionable business insights.',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>`,
  },
  code_debug_agent: {
    label: 'Code Debug Agent',
    desc: 'Reviews code for bugs, security issues, and performance improvements.',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
  },
  content_writer: {
    label: 'Content Writer',
    desc: 'Generates high-quality blog posts, articles, and marketing copy.',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`,
  },
};

function getMeta(name = '') {
  return AGENT_META[name.toLowerCase()] || {
    label: name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    desc:  'A custom AI skill agent.',
    icon:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>`,
  };
}

// ── SVG ICON SNIPPETS ─────────────────────────────────
const IC = {
  check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="14" height="14"><polyline points="20 6 9 17 4 12"/></svg>`,
  copy:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
  pin:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/></svg>`,
  trash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>`,
  chat:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
  toast_success:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="15" height="15"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
  toast_error:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="15" height="15"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
  toast_info:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="15" height="15"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
  toast_warning:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="15" height="15"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>`,
};

// ── TOAST ─────────────────────────────────────────────
function showToast(title, type = 'success', desc = '') {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.innerHTML = `
    <div class="toast-icon">${IC[`toast_${type}`] || IC.toast_info}</div>
    <div class="toast-body">
      <div class="toast-title">${escHtml(title)}</div>
      ${desc ? `<div class="toast-desc">${escHtml(desc)}</div>` : ''}
    </div>
    <button class="toast-close" onclick="closeToast(this.parentElement)">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="12" height="12"><path d="M18 6L6 18M6 6l12 12"/></svg>
    </button>`;
  container.appendChild(el);
  setTimeout(() => closeToast(el), 4800);
}
function closeToast(el) {
  if (!el?.parentElement) return;
  el.classList.add('removing');
  setTimeout(() => el.remove(), 240);
}

// ── VIEW ROUTER ───────────────────────────────────────
function switchView(view) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`view-${view}`)?.classList.add('active');
  document.getElementById(`nav-${view}`)?.classList.add('active');
  state.view = view;
  if (view === 'agents')   renderAgentsGrid();
  if (view === 'settings') renderSettingsAgents();
}

// ── SIDEBAR ───────────────────────────────────────────
function openMobileSidebar()  { document.getElementById('sidebar').classList.add('mobile-open'); document.getElementById('sidebar-backdrop').classList.remove('hidden'); }
function closeMobileSidebar() { document.getElementById('sidebar').classList.remove('mobile-open'); document.getElementById('sidebar-backdrop').classList.add('hidden'); }

// ── MODEL DROPDOWN ────────────────────────────────────
function toggleModelDropdown() {
  document.getElementById('model-dropdown').classList.toggle('hidden');
}
function selectModel(id, label, e) {
  e.stopPropagation();
  state.selectedModel = id;
  document.getElementById('selected-model-label').textContent = label;
  document.querySelectorAll('.model-opt').forEach(o => o.classList.remove('active'));
  e.currentTarget.classList.add('active');
  ['llama','gpt4','claude'].forEach(m => {
    const el = document.getElementById(`check-${m}`);
    if (el) el.classList.toggle('hidden', m !== id);
  });
  document.getElementById('model-dropdown').classList.add('hidden');
  showToast(`Model: ${label}`, 'info');
}
document.addEventListener('click', e => {
  if (!e.target.closest('#model-selector-btn'))
    document.getElementById('model-dropdown')?.classList.add('hidden');
  if (!e.target.closest('.agent-picker') && !e.target.closest('#agent-picker-btn'))
    document.getElementById('agent-picker')?.classList.add('hidden');
});

function toggleProfileMenu() {
  showToast('Profile', 'info', 'Account management coming soon.');
}

// ── THEME TOGGLE ──────────────────────────────────────
function toggleTheme() {
  const html = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  const next = isDark ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  localStorage.setItem('nexus-theme', next);
  showToast(
    isDark ? 'Light mode enabled' : 'Dark mode enabled',
    'info',
    isDark ? 'Switched to light theme.' : 'Switched to dark theme.'
  );
}
function applyStoredTheme() {
  const saved = localStorage.getItem('nexus-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
}

// ── BACKEND API ───────────────────────────────────────
async function apiGetSkills() {
  const r = await fetch(`${API_BASE_URL}/skills`);
  const d = await r.json();
  if (!r.ok) throw new Error(d?.error || d?.detail || 'Failed to fetch agents');
  return Array.isArray(d?.skills) ? d.skills : [];
}
async function apiUploadSkill(file) {
  const form = new FormData(); form.append('file', file);
  const r = await fetch(`${API_BASE_URL}/upload-skill`, { method: 'POST', body: form });
  const d = await r.json();
  if (!r.ok) {
    const det = d?.detail;
    let msg = 'Upload failed';
    if (typeof det === 'string') msg = det;
    else if (det?.errors) msg = det.errors.join('; ');
    else if (d?.error) msg = d.error;
    throw new Error(msg);
  }
  return d;
}
async function apiDeleteSkill(name) {
  const r = await fetch(`${API_BASE_URL}/delete-skill/${encodeURIComponent(name)}`, { method: 'DELETE' });
  const d = await r.json();
  if (!r.ok) throw new Error(d?.error || d?.detail || 'Delete failed');
  return d;
}
async function apiRunAgent(task, agent, fileName, fileContent) {
  const body = { task, agent };
  if (fileName) body.file_name = fileName;
  if (fileContent) body.file_content = fileContent;
  const r = await fetch(`${API_BASE_URL}/run-agent`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const d = await r.json();
  if (!r.ok) {
    const msg = d?.error || d?.detail || 'Request failed';
    throw new Error(typeof msg === 'string' ? msg : 'Request failed');
  }
  return d;
}

// ── AGENT STATE ───────────────────────────────────────
async function refreshAgents(silent = false) {
  try {
    const names = await apiGetSkills();
    state.agents = [...new Set(names)].sort().map(n => ({
      name: n, active: n === state.activeAgent, meta: getMeta(n),
    }));
    document.getElementById('agent-count-total').textContent = state.agents.length;
    document.getElementById('agent-count-active').textContent = state.agents.filter(a => a.active).length;
    renderAgentPickerList();
    if (state.view === 'agents')   renderAgentsGrid();
    if (state.view === 'settings') renderSettingsAgents();
    if (!silent && !state.agents.length) showToast('No agents found', 'warning', 'Upload or create a skill file to get started.');
  } catch (e) {
    if (!silent) showToast('Could not load agents', 'error', e.message);
  }
}

// ── ACTIVE AGENT ──────────────────────────────────────
function setActiveAgent(name) {
  state.activeAgent = name;
  state.agents.forEach(a => a.active = a.name === name);

  const badge   = document.getElementById('active-agent-badge');
  const badgeName = document.getElementById('active-agent-name-topbar');
  const sb      = document.getElementById('skill-badge');
  const sbn     = document.getElementById('skill-badge-name');

  if (name) {
    const label = getMeta(name).label;
    badge.classList.remove('hidden'); badgeName.textContent = label;
    sb.classList.remove('hidden');    sbn.textContent = name;
  } else {
    badge.classList.add('hidden');
    sb.classList.add('hidden');
  }
  document.getElementById('agent-count-active').textContent = state.agents.filter(a => a.active).length;
  document.getElementById('agent-picker-btn')?.classList.toggle('active', !!name);
  renderAgentPickerList();
}
function clearActiveAgent() { setActiveAgent(null); }
function clearSkillBadge()  { setActiveAgent(null); }

// ── AGENTS GRID ───────────────────────────────────────
function renderAgentsGrid(filter = '') {
  const grid = document.getElementById('agents-grid');
  if (!grid) return;
  const filtered = state.agents.filter(a =>
    a.name.toLowerCase().includes(filter.toLowerCase()) ||
    a.meta.label.toLowerCase().includes(filter.toLowerCase())
  );
  if (!filtered.length) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;color:var(--text-3);padding:52px;font-size:14px">
      ${filter ? `No agents match "${escHtml(filter)}"` : 'No agents yet — create or upload one.'}
    </div>`;
    return;
  }
  grid.innerHTML = filtered.map(a => `
    <div class="agent-card ${a.active ? 'agent-active' : ''}" id="acard-${a.name}">
      <div class="agent-card-head">
        <div class="agent-card-icon-wrap">${a.meta.icon}</div>
        <div>
          <div class="agent-card-name">${escHtml(a.meta.label)}</div>
          <div class="agent-card-file">${a.name}.md</div>
        </div>
      </div>
      <div class="agent-card-desc">${escHtml(a.meta.desc)}</div>
      <div class="agent-card-foot">
        <div class="agent-status ${a.active ? 'on' : 'off'}">
          <div class="status-dot"></div>
          ${a.active ? 'Active' : 'Inactive'}
        </div>
        <div class="agent-card-btns">
          <button class="btn-sm accent" onclick="activateAgentGoChat('${a.name}')">Use in Chat</button>
          <button class="btn-sm danger"  onclick="openDeleteModal('${a.name}')">Delete</button>
        </div>
      </div>
    </div>
  `).join('');
}
function filterAgents(val) { renderAgentsGrid(val); }

function activateAgentGoChat(name) {
  setActiveAgent(name);
  switchView('chat');
  showToast(`${getMeta(name).label} activated`, 'success', 'Agent is ready in the chat input.');
}

// ── AGENT PICKER ──────────────────────────────────────
function toggleAgentPicker() {
  const el = document.getElementById('agent-picker');
  el.classList.toggle('hidden');
  if (!el.classList.contains('hidden')) setTimeout(() => document.getElementById('agent-picker-search')?.focus(), 60);
}
function filterAgentPicker(val) { renderAgentPickerList(val); }
function renderAgentPickerList(filter = '') {
  const list = document.getElementById('agent-picker-list');
  if (!list) return;
  const items = state.agents.filter(a =>
    a.name.toLowerCase().includes(filter.toLowerCase()) ||
    a.meta.label.toLowerCase().includes(filter.toLowerCase())
  );
  if (!items.length) {
    list.innerHTML = `<div style="text-align:center;color:var(--text-3);padding:20px;font-size:13px">
      ${filter ? 'No agents match' : 'No agents available'}
    </div>`;
    return;
  }
  list.innerHTML = items.map(a => `
    <div class="picker-item ${a.name === state.activeAgent ? 'selected' : ''}" onclick="selectAgentFromPicker('${a.name}')">
      <div class="picker-item-icon">${a.meta.icon}</div>
      <span class="picker-item-name">${escHtml(a.meta.label)}</span>
      ${a.name === state.activeAgent ? `<span class="picker-check">${IC.check}</span>` : ''}
    </div>
  `).join('');
}
function selectAgentFromPicker(name) {
  setActiveAgent(name === state.activeAgent ? null : name);
  document.getElementById('agent-picker').classList.add('hidden');
}

// ── CHAT HISTORY ──────────────────────────────────────
function createChat(title = 'New Conversation') {
  const id = `c${++chatCounter}`;
  const chat = { id, title, preview: '', pinned: false, messages: [] };
  state.chats.unshift(chat);
  return chat;
}
function newChat() {
  const chat = createChat();
  state.activeChatId = chat.id;
  clearChatUI();
  renderChatHistory();
  switchView('chat');
  document.getElementById('chat-input')?.focus();
}
function clearChatUI() {
  document.getElementById('chat-messages').innerHTML = '';
  document.getElementById('chat-welcome').style.display = '';
}
function loadChat(id) {
  const chat = state.chats.find(c => c.id === id);
  if (!chat) return;
  state.activeChatId = id;
  document.getElementById('chat-messages').innerHTML = '';
  if (chat.messages.length) {
    document.getElementById('chat-welcome').style.display = 'none';
    chat.messages.forEach(m => appendBubble(m.role, m.content, m.agent, m.ts, false));
  } else {
    document.getElementById('chat-welcome').style.display = '';
  }
  renderChatHistory();
  switchView('chat');
  closeMobileSidebar();
}
function pinChat(id) {
  const chat = state.chats.find(c => c.id === id);
  if (chat) { chat.pinned = !chat.pinned; renderChatHistory(); }
}
function deleteChatById(id) {
  state.chats = state.chats.filter(c => c.id !== id);
  if (state.activeChatId === id) { state.activeChatId = null; clearChatUI(); }
  renderChatHistory();
}
function filterChats(val) { renderChatHistory(val); }

function renderChatHistory(filter = '') {
  const pEl = document.getElementById('pinned-chats');
  const rEl = document.getElementById('recent-chats');
  if (!pEl || !rEl) return;
  const fil = state.chats.filter(c =>
    c.title.toLowerCase().includes(filter.toLowerCase()) ||
    c.preview.toLowerCase().includes(filter.toLowerCase())
  );
  const renderList = (chats) => chats.map(c => `
    <div class="chat-item ${c.id === state.activeChatId ? 'active' : ''}" data-id="${c.id}" onclick="loadChat('${c.id}')">
      <div class="chat-item-icon">${IC.chat}</div>
      <div class="chat-item-body">
        <div class="chat-item-title">${escHtml(c.title)}</div>
        <div class="chat-item-preview">${escHtml(c.preview || 'Empty conversation')}</div>
      </div>
      <div class="chat-item-actions">
        <button class="chat-act-btn" onclick="event.stopPropagation();pinChat('${c.id}')" title="${c.pinned?'Unpin':'Pin'}">${IC.pin}</button>
        <button class="chat-act-btn danger" onclick="event.stopPropagation();deleteChatById('${c.id}')" title="Delete">${IC.trash}</button>
      </div>
    </div>
  `).join('');
  pEl.innerHTML = renderList(fil.filter(c => c.pinned))  || `<div style="color:var(--text-3);font-size:12px;padding:5px 7px">No pinned chats</div>`;
  rEl.innerHTML = renderList(fil.filter(c => !c.pinned)) || `<div style="color:var(--text-3);font-size:12px;padding:5px 7px">No recent chats</div>`;
}

// ── STREAMING TYPEWRITER ──────────────────────────────
/**
 * Streams `fullText` into a pre-existing bubble element character-by-character.
 * Shows a blinking cursor during animation, removes it when done.
 * Returns a Promise that resolves when streaming completes.
 */
function streamIntoElement(bubbleEl, fullText, charsPerTick = STREAM_CHUNK, intervalMs = STREAM_INTERVAL_MS) {
  return new Promise(resolve => {
    // Clear existing
    bubbleEl.innerHTML = '';

    // The raw-text span (grows as we stream)
    const rawSpan = document.createElement('span');
    rawSpan.className = 'stream-raw';

    // Blinking cursor at end
    const cursor = document.createElement('span');
    cursor.className = 'stream-cursor';

    bubbleEl.appendChild(rawSpan);
    bubbleEl.appendChild(cursor);

    let charIndex = 0;
    const total = fullText.length;
    const msgs = document.getElementById('chat-container');

    const tick = setInterval(() => {
      if (charIndex >= total) {
        clearInterval(tick);
        cursor.remove();
        // Final render with full markdown
        bubbleEl.innerHTML = renderMarkdown(fullText);
        if (msgs) msgs.scrollTop = msgs.scrollHeight;
        resolve();
        return;
      }
      // Chunk
      const end = Math.min(charIndex + charsPerTick, total);
      const revealed = fullText.slice(0, end);
      charIndex = end;

      // Update raw span with markdown rendering of what's revealed
      rawSpan.innerHTML = renderMarkdown(revealed);

      // Keep cursor after raw
      bubbleEl.appendChild(cursor);

      // Auto-scroll
      if (msgs) msgs.scrollTop = msgs.scrollHeight;
    }, intervalMs);
  });
}

// ── APPEND BUBBLE (no stream) ─────────────────────────
function appendBubble(role, content, agent = null, ts = null, scroll = true) {
  document.getElementById('chat-welcome').style.display = 'none';
  const msgs = document.getElementById('chat-messages');
  const row = document.createElement('div');
  row.className = `msg-row ${role}`;

  const tsStr = ts ? new Date(ts).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }) : '';
  const avatarInner = role === 'user' ? 'G' : `<svg viewBox="0 0 20 20" fill="none" width="13" height="13"><polygon points="10,1 19,5.5 19,14.5 10,19 1,14.5 1,5.5" fill="url(#ag)"/><defs><linearGradient id="ag" x1="1" y1="1" x2="19" y2="19"><stop stop-color="#6366f1"/><stop offset="1" stop-color="#a855f7"/></linearGradient></defs></svg>`;

  row.innerHTML = `
    <div class="msg-avatar">${avatarInner}</div>
    <div class="msg-body">
      ${agent && role === 'ai' ? `<div class="msg-agent-tag">${getMeta(agent).icon} ${escHtml(getMeta(agent).label)}</div>` : ''}
      <div class="msg-bubble">${renderMarkdown(content)}</div>
      <div style="display:flex;align-items:center;gap:8px">
        ${tsStr ? `<div class="msg-meta">${tsStr}</div>` : ''}
        <div class="msg-actions">
          <button class="msg-act-btn" onclick="copyMsgText(this)" title="Copy">${IC.copy}</button>
        </div>
      </div>
    </div>`;
  msgs.appendChild(row);
  if (scroll) msgs.scrollTop = msgs.scrollHeight;
  return row;
}

/** Append an AI bubble and return the bubble div (for streaming into) */
function appendAiBubbleEmpty(agent = null, ts = null) {
  document.getElementById('chat-welcome').style.display = 'none';
  const msgs = document.getElementById('chat-messages');
  const row = document.createElement('div');
  row.className = 'msg-row ai';

  const agentMeta = agent ? getMeta(agent) : null;
  const avatarInner = `<svg viewBox="0 0 20 20" fill="none" width="13" height="13"><polygon points="10,1 19,5.5 19,14.5 10,19 1,14.5 1,5.5" fill="url(#ag2)"/><defs><linearGradient id="ag2" x1="1" y1="1" x2="19" y2="19"><stop stop-color="#6366f1"/><stop offset="1" stop-color="#a855f7"/></linearGradient></defs></svg>`;
  const tsStr = ts ? new Date(ts).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }) : '';

  row.innerHTML = `
    <div class="msg-avatar">${avatarInner}</div>
    <div class="msg-body">
      ${agentMeta ? `<div class="msg-agent-tag">${agentMeta.icon} ${escHtml(agentMeta.label)}</div>` : ''}
      <div class="msg-bubble" id="streaming-bubble"></div>
      <div style="display:flex;align-items:center;gap:8px">
        ${tsStr ? `<div class="msg-meta">${tsStr}</div>` : ''}
        <div class="msg-actions">
          <button class="msg-act-btn" onclick="copyMsgText(this)" title="Copy">${IC.copy}</button>
        </div>
      </div>
    </div>`;
  msgs.appendChild(row);
  msgs.scrollTop = msgs.scrollHeight;
  return row.querySelector('#streaming-bubble');
}

function copyMsgText(btn) {
  const bubble = btn.closest('.msg-body').querySelector('.msg-bubble');
  if (!bubble) return;
  navigator.clipboard.writeText(bubble.innerText).then(() => showToast('Copied', 'success'));
}

// ── SEND MESSAGE ──────────────────────────────────────
async function sendMessage() {
  const inputEl = document.getElementById('chat-input');
  const text = inputEl.value.trim();
  if (!text || state.streaming) return;

  inputEl.value = ''; autoResizeTextarea(inputEl);

  if (!state.activeChatId) {
    const chat = createChat(text.slice(0, 40) || 'New Conversation');
    state.activeChatId = chat.id;
  }
  const chat = state.chats.find(c => c.id === state.activeChatId);

  const ts = new Date().toISOString();
  chat.messages.push({ role: 'user', content: text, agent: null, ts });
  chat.preview = text.slice(0, 50);
  appendBubble('user', text, null, ts);
  renderChatHistory();

  // Lock input
  state.streaming = true;
  document.getElementById('send-btn').disabled = true;

  // Show thinking indicator
  const thinking = document.getElementById('thinking-indicator');
  thinking.classList.remove('hidden');

  try {
    let taskText = text;
    let fileName = null, fileContent = null;

    if (state.attachedFile) {
      fileName = state.attachedFile.name;
      fileContent = state.attachedFile.content;
      taskText = `${text}\n\n[Attached file: ${fileName}]\n${(fileContent || '').slice(0, 3000)}`;
    }

    const agentName = state.activeAgent;
    let output;

    if (!agentName) {
      await sleep(700);
      output = 'Please select an agent using the agent selector button in the input bar to start using AI skills. Without a skill, I can only respond in basic mode.\n\nClick the **agent selector icon** next to the input field to choose from your available agents.';
    } else {
      const result = await apiRunAgent(taskText, agentName, fileName, fileContent);
      output = result.output || 'The agent returned an empty response.';
    }

    // Hide thinking, show streaming bubble
    thinking.classList.add('hidden');

    const aiTs = new Date().toISOString();
    const bubbleEl = appendAiBubbleEmpty(agentName, aiTs);

    // Stream the response character-by-character
    await streamIntoElement(bubbleEl, output);

    // Save to history
    chat.messages.push({ role: 'ai', content: output, agent: agentName, ts: aiTs });
    if (chat.title === 'New Conversation') chat.title = text.slice(0, 35);
    renderChatHistory();
    clearFileBadge();

  } catch (err) {
    thinking.classList.add('hidden');
    const errMsg = `**Error:** ${err.message || 'Could not reach the backend.'}`;
    const aiTs = new Date().toISOString();
    chat.messages.push({ role: 'ai', content: errMsg, agent: null, ts: aiTs });
    appendBubble('ai', errMsg, null, aiTs);
    showToast('Request failed', 'error', err.message || 'Check that the backend is running on port 8000.');
  } finally {
    state.streaming = false;
    document.getElementById('send-btn').disabled = false;
    document.getElementById('thinking-indicator').classList.add('hidden');
  }
}

function handleChatKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
}
function autoResizeTextarea(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 200) + 'px';
}
function insertSuggestion(btn) {
  const el = document.getElementById('chat-input');
  el.value = btn.textContent.trim();
  el.focus(); autoResizeTextarea(el);
}

// ── FILE ATTACH ───────────────────────────────────────
async function handleChatFileAttach(file) {
  if (!file) return;
  try {
    const content = await readFileAsContent(file);
    state.attachedFile = { name: file.name, content };
    document.getElementById('file-badge-name').textContent = file.name;
    document.getElementById('file-badge').classList.remove('hidden');
    showToast(`Attached: ${file.name}`, 'success');
  } catch (e) { showToast('Cannot read file', 'error', e.message); }
}
function clearFileBadge() {
  state.attachedFile = null;
  document.getElementById('file-badge').classList.add('hidden');
  const fu = document.getElementById('file-uploader');
  if (fu) fu.value = '';
}
async function readFileAsContent(file) {
  if (/\.(pdf|png|jpe?g|webp|bmp|tiff?)$/i.test(file.name)) {
    return await toBase64(file);
  }
  const text = await file.text();
  if (!text.trim()) throw new Error('File is empty.');
  return text.trim().slice(0, 60000);
}
function toBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(new Error('Could not read file.'));
    r.readAsDataURL(file);
  });
}

// ── SKILL FILE UPLOAD ─────────────────────────────────
async function handleFileUpload(file) {
  if (!file) return;
  if (!file.name.toLowerCase().endsWith('.md')) {
    showUploadFeedback('Only .md skill files are accepted.', 'error'); return;
  }
  try {
    const data = await apiUploadSkill(file);
    showUploadFeedback(`Agent "${data?.skill || file.name}" registered successfully.`, 'success');
    await refreshAgents(true);
    showToast('Agent added', 'success', `${data?.skill || file.name} is now available.`);
  } catch (e) {
    showUploadFeedback(e.message, 'error');
    showToast('Upload failed', 'error', e.message);
  }
}
function showUploadFeedback(msg, type) {
  const el = document.getElementById('upload-feedback');
  el.className = `upload-feedback ${type}`;
  el.textContent = msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 6000);
}

// ── AI AGENT GENERATOR ────────────────────────────────
async function generateAgent() {
  const prompt = document.getElementById('agent-gen-prompt').value.trim();
  const name   = document.getElementById('agent-gen-name').value.trim();
  if (!prompt) { showToast('Describe the agent role first', 'warning'); return; }

  const agentName = name || deriveSnakeName(prompt);
  const btn = document.getElementById('generate-btn');
  btn.disabled = true;
  btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" class="spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Generating...`;

  try {
    const genPrompt = `Create a structured AI skill instruction file in Markdown for this role:

"${prompt}"

Use EXACTLY this structure:

# Agent Name: ${agentName}

## Role
One clear sentence about what this agent does.

## Instructions
1. First instruction
2. Second instruction
(5–8 numbered instructions)

## Skills
- Skill one
- Skill two
(4–6 bullets)

## Response Format
Describe how the agent should format its output.

## Constraints
- Constraint one
(3–5 strict rules — e.g. never fabricate information)

Output ONLY the Markdown. No explanation or preamble.`;

    const firstAgent = state.agents[0]?.name;
    if (!firstAgent) throw new Error('No agents available to generate. Upload at least one skill file first.');

    const result = await apiRunAgent(genPrompt, firstAgent, null, null);
    const md = result.output || '';

    state.generatedContent = md;
    state.generatedName = `${agentName.toLowerCase().replace(/\s+/g, '_')}.md`;

    document.getElementById('generated-content').textContent = md;
    document.getElementById('generated-preview').classList.remove('hidden');
    showToast('Agent generated', 'success', 'Review and save the skill file below.');
  } catch (e) {
    showToast('Generation failed', 'error', e.message || 'Backend error.');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/><path d="M19 3v4M21 5h-4"/></svg> Generate Agent`;
  }
}
function deriveSnakeName(prompt) {
  return prompt.toLowerCase().replace(/[^a-z\s]/g,'').trim().split(/\s+/).slice(0,4).join('_');
}
async function saveGeneratedAgent() {
  if (!state.generatedContent || !state.generatedName) return;
  const blob = new Blob([state.generatedContent], { type: 'text/plain' });
  const file = new File([blob], state.generatedName, { type: 'text/plain' });
  const btn = document.getElementById('save-agent-btn');
  btn.textContent = 'Saving...'; btn.disabled = true;
  try {
    const data = await apiUploadSkill(file);
    await refreshAgents(true);
    showToast(`"${data?.skill}" saved`, 'success', 'Agent is ready in the chat picker.');
    document.getElementById('generated-preview').classList.add('hidden');
    document.getElementById('agent-gen-prompt').value = '';
    document.getElementById('agent-gen-name').value = '';
    state.generatedContent = null; state.generatedName = null;
  } catch (e) {
    showToast('Save failed', 'error', e.message);
  } finally {
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13"><polyline points="20 6 9 17 4 12"/></svg> Save Agent`;
    btn.disabled = false;
  }
}
function copyGeneratedAgent() {
  if (!state.generatedContent) return;
  navigator.clipboard.writeText(state.generatedContent).then(() => showToast('Copied to clipboard', 'success'));
}

// ── DELETE MODAL ──────────────────────────────────────
function openDeleteModal(name) {
  state.agentToDelete = name;
  document.getElementById('modal-skill-name').textContent = getMeta(name).label;
  document.getElementById('delete-modal').classList.remove('hidden');
}
function closeDeleteModal() {
  state.agentToDelete = null;
  document.getElementById('delete-modal').classList.add('hidden');
}
async function confirmDelete() {
  if (!state.agentToDelete) return;
  const target = state.agentToDelete;
  try {
    await apiDeleteSkill(target);
    if (state.activeAgent === target) setActiveAgent(null);
    closeDeleteModal();
    await refreshAgents(true);
    showToast(`"${getMeta(target).label}" deleted`, 'success');
  } catch (e) {
    showToast('Delete failed', 'error', e.message);
  }
}

// ── SETTINGS ──────────────────────────────────────────
function renderSettingsAgents() {
  const list = document.getElementById('settings-agents-list');
  if (!list) return;
  if (!state.agents.length) {
    list.innerHTML = '<div style="color:var(--text-3);font-size:13px">No agents loaded.</div>';
    return;
  }
  list.innerHTML = state.agents.map(a => `
    <div class="settings-agent-row">
      <div class="settings-agent-icon">${a.meta.icon}</div>
      <div class="settings-agent-name">${a.name}.md</div>
      <label class="toggle">
        <input type="checkbox" ${a.active ? 'checked' : ''} onchange="toggleAgentActive('${a.name}',this.checked)">
        <div class="toggle-track"></div>
        <div class="toggle-thumb"></div>
      </label>
      <button class="del-icon-btn" onclick="openDeleteModal('${a.name}')" title="Delete">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/></svg>
      </button>
    </div>
  `).join('');
}
function toggleAgentActive(name, checked) {
  if (checked) setActiveAgent(name);
  else if (state.activeAgent === name) setActiveAgent(null);
}
function saveSettings() {
  showToast('Settings saved', 'success', 'Your preferences have been updated.');
}
function toggleReveal(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const isHidden = input.type === 'password';
  input.type = isHidden ? 'text' : 'password';
  // Swap icon
  btn.innerHTML = isHidden
    ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`
    : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
}

// ── MARKDOWN RENDERER ─────────────────────────────────
function renderMarkdown(text) {
  if (!text) return '';
  let h = String(text)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  // Code blocks
  h = h.replace(/```[\w]*\n?([\s\S]*?)```/g, (_,c) =>
    `<pre style="background:rgba(0,0,0,0.35);padding:10px 14px;border-radius:8px;overflow-x:auto;font-family:'JetBrains Mono',monospace;font-size:12.5px;margin:8px 0;white-space:pre-wrap;border:1px solid rgba(255,255,255,0.07)">${c.trim()}</pre>`);

  // Inline code
  h = h.replace(/`([^`]+)`/g, '<code style="background:rgba(99,102,241,0.12);padding:2px 6px;border-radius:4px;font-family:\'JetBrains Mono\',monospace;font-size:12.5px;color:#a5b4fc">$1</code>');

  // Bold / italic
  h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  h = h.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Headings
  h = h.replace(/^### (.+)$/gm, '<div style="font-size:13.5px;font-weight:700;color:#c4b5fd;margin:14px 0 4px">$1</div>');
  h = h.replace(/^## (.+)$/gm, '<div style="font-size:14.5px;font-weight:700;color:#a5b4fc;margin:14px 0 5px">$1</div>');
  h = h.replace(/^# (.+)$/gm,  '<div style="font-size:16px;font-weight:800;color:#c4b5fd;margin:16px 0 6px">$1</div>');

  // Bullets & numbered
  h = h.replace(/^[-•] (.+)$/gm, '<div style="padding-left:16px;margin:3px 0">• $1</div>');
  h = h.replace(/^\* (.+)$/gm,   '<div style="padding-left:16px;margin:3px 0">• $1</div>');
  h = h.replace(/^(\d+)\. (.+)$/gm, '<div style="padding-left:16px;margin:3px 0"><span style="color:#818cf8;font-weight:600">$1.</span> $2</div>');

  // Newlines
  h = h.replace(/\n/g, '<br>');
  return h;
}

// ── UTILS ─────────────────────────────────────────────
function escHtml(str = '') {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── INIT ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {

  // Sidebar collapse button
  document.getElementById('sidebar-collapse-btn')?.addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('collapsed');
  });

  // Dropzone
  const dz = document.getElementById('dropzone');
  if (dz) {
    dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('drag-over'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('drag-over'));
    dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('drag-over'); handleFileUpload(e.dataTransfer.files[0]); });
  }
  document.getElementById('skill-file-input')?.addEventListener('change', e => {
    handleFileUpload(e.target.files[0]); e.target.value = '';
  });

  // Delete modal outside click
  document.getElementById('delete-modal')?.addEventListener('click', e => {
    if (e.target.id === 'delete-modal') closeDeleteModal();
  });

  // Agent search
  document.getElementById('agent-search')?.addEventListener('input', e => filterAgents(e.target.value));

  // Chat search
  document.getElementById('chat-search')?.addEventListener('input', e => filterChats(e.target.value));

  // Seed sample chats
  const seeds = [
    { title: 'Medical Report Analysis', preview: 'Simplified CBC lab results...', pinned: true },
    { title: 'Email Campaign Draft', preview: 'Q2 SaaS outreach sequence...', pinned: false },
    { title: 'Revenue Cycle Review', preview: 'Hospital billing bottlenecks...', pinned: false },
  ];
  seeds.forEach(s => {
    const c = createChat(s.title);
    c.preview = s.preview;
    c.pinned = s.pinned;
  });
  state.activeChatId = state.chats[0]?.id;
  renderChatHistory();

  // Load agents from backend
  await refreshAgents();

  // Welcome toast
  setTimeout(() => showToast('Welcome back, Gobzz.', 'success', 'Your AI Agent Platform is online.'), 600);

  // Focus input
  document.getElementById('chat-input')?.focus();
});
