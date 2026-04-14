/* =====================================================
   NEXUS AI AGENT PLATFORM — App Logic
   ===================================================== */

// ── CONFIG ────────────────────────────────────────────
const API_BASE_URL = 'http://localhost:8000';

// ── STATE ─────────────────────────────────────────────
const state = {
  currentView: 'chat',
  activeAgent: null,       // currently selected agent name
  agents: [],              // [{name, active, emoji}]
  chats: [],               // [{id, title, preview, pinned, messages:[]}]
  activeChatId: null,
  isTyping: false,
  selectedModel: 'llama',
  attachedFile: null,      // {name, content}
  generatedAgentContent: null,
  generatedAgentName: null,
  agentToDelete: null,
};

// ── AGENT EMOJI MAP ───────────────────────────────────
const AGENT_EMOJIS = {
  medical_report_simplifier: '🩺',
  email_outreach_agent:      '✉️',
  healthcare_revenue_agent:  '💰',
  data_analyst:              '📊',
  code_reviewer:             '🔍',
  legal_contract_reviewer:   '⚖️',
  default:                   '🤖',
};

function getAgentEmoji(name = '') {
  return AGENT_EMOJIS[name.toLowerCase()] || AGENT_EMOJIS.default;
}

function getAgentLabel(name = '') {
  return name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function getAgentDesc(name = '') {
  const map = {
    medical_report_simplifier: 'Explains complex medical documents in clear, simple language.',
    email_outreach_agent:      'Crafts personalised email campaigns for sales and marketing.',
    healthcare_revenue_agent:  'Analyses hospital revenue cycles and identifies optimisation opportunities.',
    data_analyst:              'Processes structured data files and draws actionable insights.',
    code_reviewer:             'Reviews code for bugs, style issues, and performance improvements.',
  };
  return map[name.toLowerCase()] || 'A custom AI skill agent.';
}

// ── ICON SET ──────────────────────────────────────────
const ICONS = {
  success: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="16" height="16"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
  error:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="16" height="16"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
  info:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="16" height="16"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
  warning: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="16" height="16"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>`,
};

// ── TOAST ─────────────────────────────────────────────
function showToast(title, type = 'success', desc = '') {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.innerHTML = `
    <div class="toast-icon">${ICONS[type] || ICONS.info}</div>
    <div class="toast-body">
      <div class="toast-title">${escapeHtml(title)}</div>
      ${desc ? `<div class="toast-desc">${escapeHtml(desc)}</div>` : ''}
    </div>
    <button class="toast-close" onclick="closeToast(this.parentElement)">✕</button>
  `;
  container.appendChild(el);
  setTimeout(() => closeToast(el), 4800);
}
function closeToast(el) {
  if (!el || !el.parentElement) return;
  el.classList.add('removing');
  setTimeout(() => el.remove(), 260);
}

// ── VIEW SWITCHING ─────────────────────────────────────
function switchView(view) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const target = document.getElementById(`view-${view}`);
  const navBtn = document.getElementById(`nav-${view}`);
  if (target) target.classList.add('active');
  if (navBtn) navBtn.classList.add('active');
  state.currentView = view;

  if (view === 'agents') renderAgentsGrid();
  if (view === 'settings') renderSettingsAgents();
}

// ── SIDEBAR COLLAPSE ───────────────────────────────────
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  sidebar.classList.toggle('collapsed');
}
function openMobileSidebar() {
  document.getElementById('sidebar').classList.add('mobile-open');
  document.getElementById('sidebar-backdrop').classList.remove('hidden');
}
function closeMobileSidebar() {
  document.getElementById('sidebar').classList.remove('mobile-open');
  document.getElementById('sidebar-backdrop').classList.add('hidden');
}

// ── MODEL SELECTOR ─────────────────────────────────────
function toggleModelDropdown() {
  document.getElementById('model-dropdown').classList.toggle('hidden');
}
function selectModel(id, label, event) {
  event.stopPropagation();
  state.selectedModel = id;
  document.getElementById('selected-model-label').textContent = label;
  document.querySelectorAll('.model-option').forEach(o => o.classList.remove('active'));
  event.currentTarget.classList.add('active');
  document.getElementById('model-dropdown').classList.add('hidden');
  showToast(`Model set to ${label}`, 'info');
}
document.addEventListener('click', (e) => {
  if (!e.target.closest('.model-selector'))
    document.getElementById('model-dropdown')?.classList.add('hidden');
  if (!e.target.closest('.agent-picker') && !e.target.closest('#agent-picker-btn'))
    document.getElementById('agent-picker')?.classList.add('hidden');
});

// ── PROFILE MENU ───────────────────────────────────────
function toggleProfileMenu() {
  showToast('Profile', 'info', 'Account settings coming soon!');
}

// ── AGENT API ──────────────────────────────────────────
async function apiGetSkills() {
  const res = await fetch(`${API_BASE_URL}/skills`);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || data?.detail || 'Failed to fetch agents');
  return Array.isArray(data?.skills) ? data.skills : [];
}

async function apiUploadSkill(file) {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_BASE_URL}/upload-skill`, { method: 'POST', body: form });
  const data = await res.json();
  if (!res.ok) {
    const d = data?.detail;
    let msg = 'Upload failed';
    if (typeof d === 'string') msg = d;
    else if (d?.errors) msg = d.errors.join('; ');
    else if (data?.error) msg = data.error;
    throw new Error(msg);
  }
  return data;
}

async function apiDeleteSkill(name) {
  const res = await fetch(`${API_BASE_URL}/delete-skill/${encodeURIComponent(name)}`, { method: 'DELETE' });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || data?.detail || 'Delete failed');
  return data;
}

async function apiRunAgent(task, agent, fileName = null, fileContent = null) {
  const body = { task, agent };
  if (fileName) body.file_name = fileName;
  if (fileContent) body.file_content = fileContent;
  const res = await fetch(`${API_BASE_URL}/run-agent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = data?.error || data?.detail || 'Agent request failed';
    throw new Error(typeof msg === 'string' ? msg : 'Agent request failed');
  }
  return data;
}

// ── AGENT STATE MANAGEMENT ────────────────────────────
async function refreshAgents(silent = false) {
  try {
    const names = await apiGetSkills();
    const unique = [...new Set(names)].sort();
    state.agents = unique.map(n => ({
      name: n,
      active: n === state.activeAgent,
      emoji: getAgentEmoji(n),
      label: getAgentLabel(n),
      desc:  getAgentDesc(n),
    }));
    // update pill
    const pill = document.querySelector('.nav-btn[id="nav-agents"] span');
    renderAgentPickerList();
    if (state.currentView === 'agents') renderAgentsGrid();
    if (state.currentView === 'settings') renderSettingsAgents();
    // update counts
    document.getElementById('agent-count-total').textContent = state.agents.length;
    document.getElementById('agent-count-active').textContent = state.agents.filter(a => a.active).length;
    if (!silent && !state.agents.length) {
      showToast('No agents found', 'warning', 'Upload a skill .md file to get started.');
    }
  } catch (e) {
    if (!silent) showToast('Could not load agents', 'error', e.message);
  }
}

// ── AGENTS GRID ────────────────────────────────────────
function renderAgentsGrid(filter = '') {
  const grid = document.getElementById('agents-grid');
  if (!grid) return;
  const filtered = state.agents.filter(a =>
    a.name.toLowerCase().includes(filter.toLowerCase()) ||
    a.label.toLowerCase().includes(filter.toLowerCase())
  );
  if (!filtered.length) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;color:var(--text-3);padding:48px">
      ${filter ? `No agents match "${filter}"` : 'No agents yet — create or upload one!'}
    </div>`;
    return;
  }
  grid.innerHTML = filtered.map(a => `
    <div class="agent-card ${a.active ? 'active-agent' : ''}" id="agent-card-${a.name}">
      <div class="agent-card-header">
        <div class="agent-card-icon">${a.emoji}</div>
        <div>
          <div class="agent-card-name">${a.label}</div>
          <div class="agent-card-file">${a.name}.md</div>
        </div>
      </div>
      <div class="agent-card-desc">${a.desc}</div>
      <div class="agent-card-footer">
        <div class="agent-status ${a.active ? 'active' : 'inactive'}">
          <div class="status-dot"></div>
          ${a.active ? 'Active' : 'Inactive'}
        </div>
        <div class="agent-card-actions">
          <button class="agent-action-btn use-btn" onclick="activateAgentFromCard('${a.name}')">
            Use in Chat
          </button>
          <button class="agent-action-btn del-btn" onclick="openDeleteModal('${a.name}')">Delete</button>
        </div>
      </div>
    </div>
  `).join('');
}

function filterAgents(val) {
  renderAgentsGrid(val);
}

function activateAgentFromCard(name) {
  setActiveAgent(name);
  switchView('chat');
  showToast(`"${getAgentLabel(name)}" selected`, 'success', 'Agent is ready in chat.');
}

// ── ACTIVE AGENT ───────────────────────────────────────
function setActiveAgent(name) {
  state.activeAgent = name;
  state.agents.forEach(a => a.active = a.name === name);

  // Update badge
  const badge = document.getElementById('active-agent-badge');
  const badgeName = document.getElementById('active-agent-name-topbar');
  if (name) {
    badge.classList.remove('hidden');
    badgeName.textContent = getAgentLabel(name);
  } else {
    badge.classList.add('hidden');
  }

  // Update skill badge above input
  const sb = document.getElementById('skill-badge');
  const sbn = document.getElementById('skill-badge-name');
  if (name) {
    sb.classList.remove('hidden');
    sbn.textContent = name;
  } else {
    sb.classList.add('hidden');
  }

  // Counts
  document.getElementById('agent-count-active').textContent = state.agents.filter(a => a.active).length;

  // Re-render picker
  renderAgentPickerList();
}

function clearActiveAgent() { setActiveAgent(null); }
function clearSkillBadge()  { setActiveAgent(null); }

// ── AGENT PICKER ───────────────────────────────────────
function toggleAgentPicker() {
  const picker = document.getElementById('agent-picker');
  picker.classList.toggle('hidden');
  if (!picker.classList.contains('hidden')) {
    document.getElementById('agent-picker-search').focus();
  }
}

function filterAgentPicker(val) {
  renderAgentPickerList(val);
}

function renderAgentPickerList(filter = '') {
  const list = document.getElementById('agent-picker-list');
  if (!list) return;
  const items = state.agents.filter(a =>
    a.name.toLowerCase().includes(filter.toLowerCase()) ||
    a.label.toLowerCase().includes(filter.toLowerCase())
  );
  if (!items.length) {
    list.innerHTML = `<div style="text-align:center;color:var(--text-3);padding:20px;font-size:13px">
      ${filter ? 'No agents match' : 'No agents available'}
    </div>`;
    return;
  }
  list.innerHTML = items.map(a => `
    <div class="picker-item ${a.name === state.activeAgent ? 'selected' : ''}" onclick="selectAgentFromPicker('${a.name}')">
      <div class="picker-item-icon">${a.emoji}</div>
      <span class="picker-item-name">${a.label}</span>
      ${a.name === state.activeAgent ? '<span class="picker-item-check">✓</span>' : ''}
    </div>
  `).join('');
}

function selectAgentFromPicker(name) {
  setActiveAgent(name === state.activeAgent ? null : name);
  document.getElementById('agent-picker').classList.add('hidden');
  document.getElementById('agent-picker-btn').classList.toggle('active', !!state.activeAgent);
}

// ── CHAT HISTORY ───────────────────────────────────────
let chatCounter = 0;
function createChat(title = 'New Conversation') {
  const id = `chat-${++chatCounter}`;
  const chat = { id, title, preview: '', pinned: false, messages: [] };
  state.chats.unshift(chat);
  return chat;
}

function newChat() {
  const chat = createChat('New Conversation');
  state.activeChatId = chat.id;
  document.getElementById('chat-messages').innerHTML = '';
  document.getElementById('chat-welcome').style.display = 'flex';
  renderChatHistory();
  switchView('chat');
  document.getElementById('chat-input').focus();
}

function loadChat(id) {
  const chat = state.chats.find(c => c.id === id);
  if (!chat) return;
  state.activeChatId = id;
  const welcome = document.getElementById('chat-welcome');
  const msgs = document.getElementById('chat-messages');
  msgs.innerHTML = '';
  if (chat.messages.length === 0) {
    welcome.style.display = 'flex';
  } else {
    welcome.style.display = 'none';
    chat.messages.forEach(m => appendMessageDOM(m.role, m.content, m.agent, m.timestamp, false));
  }
  document.querySelectorAll('.chat-item').forEach(el => {
    el.classList.toggle('active', el.dataset.id === id);
  });
  switchView('chat');
  closeMobileSidebar();
}

function pinChat(id) {
  const chat = state.chats.find(c => c.id === id);
  if (chat) chat.pinned = !chat.pinned;
  renderChatHistory();
}

function filterChats(val) {
  renderChatHistory(val);
}

function renderChatHistory(filter = '') {
  const pinned = document.getElementById('pinned-chats');
  const recent = document.getElementById('recent-chats');
  if (!pinned || !recent) return;

  const chatIcon = (title) => {
    if (/medical|health/i.test(title)) return '🩺';
    if (/email|outreach/i.test(title)) return '✉️';
    if (/revenue|billing/i.test(title)) return '💰';
    if (/code|review/i.test(title)) return '🔍';
    return '💬';
  };

  const filtered = state.chats.filter(c =>
    c.title.toLowerCase().includes(filter.toLowerCase()) ||
    c.preview.toLowerCase().includes(filter.toLowerCase())
  );

  const pinnedChats = filtered.filter(c => c.pinned);
  const recentChats = filtered.filter(c => !c.pinned);

  pinned.innerHTML = pinnedChats.map(c => `
    <div class="chat-item ${c.id === state.activeChatId ? 'active' : ''}" data-id="${c.id}" onclick="loadChat('${c.id}')">
      <div class="chat-item-icon">${chatIcon(c.title)}</div>
      <div class="chat-item-body">
        <div class="chat-item-title">${escapeHtml(c.title)}</div>
        <div class="chat-item-preview">${escapeHtml(c.preview || 'No messages yet')}</div>
      </div>
      <div class="chat-item-actions">
        <button class="chat-action-btn" onclick="event.stopPropagation();pinChat('${c.id}')" title="Unpin">📌</button>
      </div>
    </div>
  `).join('') || '<div style="color:var(--text-3);font-size:12px;padding:6px 8px">No pinned chats</div>';

  recent.innerHTML = recentChats.map(c => `
    <div class="chat-item ${c.id === state.activeChatId ? 'active' : ''}" data-id="${c.id}" onclick="loadChat('${c.id}')">
      <div class="chat-item-icon">${chatIcon(c.title)}</div>
      <div class="chat-item-body">
        <div class="chat-item-title">${escapeHtml(c.title)}</div>
        <div class="chat-item-preview">${escapeHtml(c.preview || 'No messages yet')}</div>
      </div>
      <div class="chat-item-actions">
        <button class="chat-action-btn" onclick="event.stopPropagation();pinChat('${c.id}')" title="Pin">📌</button>
        <button class="chat-action-btn" onclick="event.stopPropagation();deleteChatById('${c.id}')" title="Delete" style="color:var(--red)">🗑</button>
      </div>
    </div>
  `).join('') || '<div style="color:var(--text-3);font-size:12px;padding:6px 8px">No recent chats</div>';
}

function deleteChatById(id) {
  state.chats = state.chats.filter(c => c.id !== id);
  if (state.activeChatId === id) {
    state.activeChatId = null;
    document.getElementById('chat-messages').innerHTML = '';
    document.getElementById('chat-welcome').style.display = 'flex';
  }
  renderChatHistory();
}

// ── CHAT MESSAGES ──────────────────────────────────────
function appendMessageDOM(role, content, agent = null, timestamp = null, scroll = true) {
  const welcome = document.getElementById('chat-welcome');
  if (welcome) welcome.style.display = 'none';

  const msgs = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.className = `msg ${role}`;

  const ts = timestamp ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
  const avatar = role === 'user' ? 'G' : `<svg viewBox="0 0 16 16" fill="none" width="14" height="14"><polygon points="8,1 15,4.5 15,11.5 8,15 1,11.5 1,4.5" fill="url(#ag)"/><defs><linearGradient id="ag" x1="1" y1="1" x2="15" y2="15"><stop stop-color="#6366f1"/><stop offset="1" stop-color="#a855f7"/></linearGradient></defs></svg>`;

  div.innerHTML = `
    <div class="msg-avatar">${avatar}</div>
    <div class="msg-content">
      ${agent && role === 'ai' ? `<div class="msg-skill-tag">⚡ ${escapeHtml(getAgentLabel(agent))}</div>` : ''}
      <div class="msg-bubble">${renderMarkdown(content)}</div>
      ${ts ? `<div class="msg-meta">${ts}</div>` : ''}
    </div>
  `;
  msgs.appendChild(div);
  if (scroll) msgs.scrollTop = msgs.scrollHeight;
}

function showTypingIndicator() {
  document.getElementById('typing-indicator').classList.remove('hidden');
  const msgs = document.getElementById('chat-messages');
  msgs.scrollTop = msgs.scrollHeight;
}
function hideTypingIndicator() {
  document.getElementById('typing-indicator').classList.add('hidden');
}

// ── SEND MESSAGE ───────────────────────────────────────
async function sendMessage() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text || state.isTyping) return;

  input.value = '';
  autoResizeTextarea(input);

  // Ensure active chat
  if (!state.activeChatId) {
    const chat = createChat(text.slice(0, 40) || 'New Conversation');
    state.activeChatId = chat.id;
  }
  const chat = state.chats.find(c => c.id === state.activeChatId);

  const ts = new Date().toISOString();
  const userMsg = { role: 'user', content: text, agent: null, timestamp: ts };
  chat.messages.push(userMsg);
  chat.preview = text.slice(0, 50);
  appendMessageDOM('user', text, null, ts);
  renderChatHistory();

  // Disable send
  state.isTyping = true;
  document.getElementById('send-btn').disabled = true;
  showTypingIndicator();

  try {
    let taskText = text;
    let fileName = null, fileContent = null;

    if (state.attachedFile) {
      fileName = state.attachedFile.name;
      fileContent = state.attachedFile.content;
      taskText = `${text}\n\n[Uploaded file: ${fileName}]\n${fileContent.slice(0, 3000)}`;
    }

    const agentName = state.activeAgent;
    if (!agentName) {
      // No agent — simple echo-style fallback
      await sleep(900);
      hideTypingIndicator();
      const reply = "I'm ready to help! Please select an agent from the panel (click the agent icon in the input bar) to get started with a specialized skill.";
      const aiMsg = { role: 'ai', content: reply, agent: null, timestamp: new Date().toISOString() };
      chat.messages.push(aiMsg);
      appendMessageDOM('ai', reply, null, aiMsg.timestamp);
    } else {
      const result = await apiRunAgent(taskText, agentName, fileName, fileContent);
      hideTypingIndicator();
      const output = result.output || 'No output generated.';
      const aiMsg = { role: 'ai', content: output, agent: agentName, timestamp: new Date().toISOString() };
      chat.messages.push(aiMsg);
      chat.title = chat.title === 'New Conversation' ? text.slice(0, 35) : chat.title;
      appendMessageDOM('ai', output, agentName, aiMsg.timestamp);
      renderChatHistory();
    }

    clearFileBadge();
  } catch (err) {
    hideTypingIndicator();
    const errMsg = { role: 'ai', content: `❌ **Error:** ${err.message || 'Backend unavailable.'}`, agent: null, timestamp: new Date().toISOString() };
    chat.messages.push(errMsg);
    appendMessageDOM('ai', errMsg.content, null, errMsg.timestamp);
    showToast('Request failed', 'error', err.message || 'Check the backend is running.');
  } finally {
    state.isTyping = false;
    document.getElementById('send-btn').disabled = false;
  }
}

function handleChatKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

function autoResizeTextarea(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 200) + 'px';
}

// ── SUGGESTION CHIPS ───────────────────────────────────
function insertSuggestion(btn) {
  const input = document.getElementById('chat-input');
  input.value = btn.textContent.trim();
  input.focus();
  autoResizeTextarea(input);
}

// ── FILE ATTACH (CHAT) ─────────────────────────────────
async function handleChatFileAttach(file) {
  if (!file) return;
  try {
    const content = await readFileContent(file);
    state.attachedFile = { name: file.name, content };
    const fb = document.getElementById('file-badge');
    document.getElementById('file-badge-name').textContent = file.name;
    fb.classList.remove('hidden');
    showToast(`File attached: ${file.name}`, 'success');
  } catch (e) {
    showToast('Cannot read file', 'error', e.message);
  }
}

function clearFileBadge() {
  state.attachedFile = null;
  document.getElementById('file-badge').classList.add('hidden');
  document.getElementById('file-uploader').value = '';
}

async function readFileContent(file) {
  if (/\.(pdf|png|jpe?g|webp|bmp|tiff?)$/i.test(file.name)) {
    return await toBase64(file);
  }
  const text = await file.text();
  if (!text.trim()) throw new Error('File is empty.');
  return text.trim().slice(0, 60000);
}

function toBase64(file) {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => res(reader.result);
    reader.onerror = () => rej(new Error('Could not read file.'));
    reader.readAsDataURL(file);
  });
}

// ── SKILL FILE UPLOAD (CREATE PAGE) ───────────────────
async function handleFileUpload(file) {
  if (!file) return;
  if (!file.name.toLowerCase().endsWith('.md')) {
    showUploadFeedback('Only .md files are allowed.', 'error'); return;
  }
  try {
    const data = await apiUploadSkill(file);
    showUploadFeedback(`✅ "${data?.skill || file.name}" uploaded successfully!`, 'success');
    await refreshAgents(true);
    showToast(`Agent "${data?.skill || file.name}" added!`, 'success');
  } catch (e) {
    showUploadFeedback(`❌ ${e.message}`, 'error');
    showToast('Upload failed', 'error', e.message);
  }
}

function showUploadFeedback(msg, type) {
  const fb = document.getElementById('upload-feedback');
  fb.className = `upload-feedback ${type}`;
  fb.textContent = msg;
  fb.classList.remove('hidden');
  setTimeout(() => fb.classList.add('hidden'), 5000);
}

// ── AI AGENT GENERATOR ─────────────────────────────────
async function generateAgent() {
  const prompt = document.getElementById('agent-gen-prompt').value.trim();
  const name = document.getElementById('agent-gen-name').value.trim();

  if (!prompt) { showToast('Please describe the agent role', 'warning'); return; }

  const btn = document.getElementById('generate-btn');
  btn.disabled = true;
  btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" class="spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Generating...`;

  try {
    // Build a structured .md skill file via the backend run-agent endpoint
    const agentName = name || deriveAgentName(prompt);
    const genTask = `Create a structured AI skill instruction file in Markdown format for the following agent role:

"${prompt}"

Output a STRICT skill file with these exact sections:

# Agent Name: ${agentName}

## Role
(One clear sentence describing what this agent does)

## Instructions
(Numbered list of 5-8 specific instructions the agent must follow)

## Skills
(Bullet list of 4-6 specific capabilities)

## Response Format
(Describe exactly how the agent should structure its output)

## Constraints
(List 3-5 strict rules — e.g. "Never fabricate information")

Output ONLY the Markdown content. Do NOT include any explanation, preamble, or commentary outside the file.`;

    const result = await apiRunAgent(genTask, state.agents[0]?.name || 'medical_report_simplifier');
    const mdContent = result.output || '';

    state.generatedAgentContent = mdContent;
    state.generatedAgentName = `${agentName.toLowerCase().replace(/\s+/g, '_')}.md`;

    document.getElementById('generated-content').textContent = mdContent;
    document.getElementById('generated-preview').classList.remove('hidden');
    showToast('Agent generated!', 'success', 'Review and save the agent below.');
  } catch (e) {
    showToast('Generation failed', 'error', e.message || 'Backend error.');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> Generate Agent`;
  }
}

function deriveAgentName(prompt) {
  const words = prompt.toLowerCase().replace(/[^a-z\s]/g, '').trim().split(/\s+/);
  return words.slice(0, 4).join('_');
}

async function saveGeneratedAgent() {
  if (!state.generatedAgentContent || !state.generatedAgentName) return;
  const blob = new Blob([state.generatedAgentContent], { type: 'text/plain' });
  const file = new File([blob], state.generatedAgentName, { type: 'text/plain' });
  const btn = document.getElementById('save-agent-btn');
  btn.textContent = 'Saving...';
  btn.disabled = true;
  try {
    const data = await apiUploadSkill(file);
    await refreshAgents(true);
    showToast(`"${data?.skill}" saved!`, 'success', 'Agent is now available in chat.');
    document.getElementById('generated-preview').classList.add('hidden');
    document.getElementById('agent-gen-prompt').value = '';
    document.getElementById('agent-gen-name').value = '';
    state.generatedAgentContent = null;
    state.generatedAgentName = null;
  } catch (e) {
    showToast('Save failed', 'error', e.message);
  } finally {
    btn.textContent = 'Save as Agent';
    btn.disabled = false;
  }
}

function copyGeneratedAgent() {
  if (!state.generatedAgentContent) return;
  navigator.clipboard.writeText(state.generatedAgentContent)
    .then(() => showToast('Copied to clipboard!', 'success'));
}

// ── DELETE MODAL ───────────────────────────────────────
function openDeleteModal(name) {
  state.agentToDelete = name;
  document.getElementById('modal-skill-name').textContent = getAgentLabel(name);
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
    showToast(`"${getAgentLabel(target)}" deleted`, 'success');
  } catch (e) {
    showToast('Delete failed', 'error', e.message);
  }
}

// ── SETTINGS AGENTS ────────────────────────────────────
function renderSettingsAgents() {
  const list = document.getElementById('settings-agents-list');
  if (!list) return;
  if (!state.agents.length) {
    list.innerHTML = '<div style="color:var(--text-3);font-size:13px">No agents loaded.</div>';
    return;
  }
  list.innerHTML = state.agents.map(a => `
    <div class="settings-agent-row">
      <div style="font-size:18px">${a.emoji}</div>
      <div class="settings-agent-name">${a.name}.md</div>
      <label class="toggle-switch">
        <input type="checkbox" ${a.active ? 'checked' : ''} onchange="toggleAgentActive('${a.name}', this.checked)">
        <div class="toggle-track"></div>
        <div class="toggle-thumb"></div>
      </label>
      <button class="delete-agent-btn" onclick="openDeleteModal('${a.name}')" title="Delete">🗑</button>
    </div>
  `).join('');
}

function toggleAgentActive(name, checked) {
  if (checked) setActiveAgent(name);
  else if (state.activeAgent === name) setActiveAgent(null);
}

// ── SETTINGS ───────────────────────────────────────────
function saveSettings() {
  showToast('Settings saved', 'success', 'Your preferences have been updated.');
}
function toggleReveal(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  input.type = input.type === 'password' ? 'text' : 'password';
  btn.textContent = input.type === 'password' ? '👁' : '🙈';
}

// ── MARKDOWN RENDERER ──────────────────────────────────
function renderMarkdown(text) {
  if (!text) return '';
  let h = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Code blocks
  h = h.replace(/```[\w]*\n?([\s\S]*?)```/g, (_, c) =>
    `<pre style="background:rgba(0,0,0,0.35);padding:10px 14px;border-radius:8px;overflow-x:auto;font-family:'JetBrains Mono',monospace;font-size:12.5px;margin:8px 0;white-space:pre-wrap;border:1px solid rgba(255,255,255,0.07)">${c.trim()}</pre>`);

  // Inline code
  h = h.replace(/`([^`]+)`/g, '<code style="background:rgba(99,102,241,0.12);padding:2px 6px;border-radius:4px;font-family:\'JetBrains Mono\',monospace;font-size:12.5px;color:#a5b4fc">$1</code>');

  // Bold
  h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Italic
  h = h.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Headings
  h = h.replace(/^### (.+)$/gm, '<div style="font-size:14px;font-weight:700;color:#c4b5fd;margin:14px 0 4px">$1</div>');
  h = h.replace(/^## (.+)$/gm, '<div style="font-size:15px;font-weight:700;color:#a5b4fc;margin:14px 0 5px">$1</div>');
  h = h.replace(/^# (.+)$/gm, '<div style="font-size:17px;font-weight:800;color:#c4b5fd;margin:16px 0 6px">$1</div>');

  // Bullets
  h = h.replace(/^[-•] (.+)$/gm, '<div style="padding-left:16px;margin:3px 0">• $1</div>');
  h = h.replace(/^\* (.+)$/gm, '<div style="padding-left:16px;margin:3px 0">• $1</div>');

  // Numbered list
  h = h.replace(/^(\d+)\. (.+)$/gm, '<div style="padding-left:16px;margin:3px 0"><span style="color:var(--indigo-2);font-weight:600">$1.</span> $2</div>');

  // Newlines
  h = h.replace(/\n/g, '<br>');
  return h;
}

// ── UTILS ──────────────────────────────────────────────
function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── INIT ───────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {

  // Sidebar collapse
  document.getElementById('sidebar-collapse-btn')?.addEventListener('click', toggleSidebar);

  // Dropzone listeners
  const dropzone = document.getElementById('dropzone');
  if (dropzone) {
    dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('drag-over'); });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
    dropzone.addEventListener('drop', e => {
      e.preventDefault(); dropzone.classList.remove('drag-over');
      handleFileUpload(e.dataTransfer.files[0]);
    });
  }
  document.getElementById('skill-file-input')?.addEventListener('change', e => {
    handleFileUpload(e.target.files[0]);
    e.target.value = '';
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
  const sampleChats = [
    { title: 'Medical Report Analysis', preview: 'Simplified CBC report results...', messages: [], pinned: true },
    { title: 'Email Campaign Draft', preview: 'Q2 SaaS outreach sequence...', messages: [], pinned: false },
    { title: 'Revenue Cycle Review', preview: 'Hospital billing bottlenecks...', messages: [], pinned: false },
  ];
  sampleChats.forEach(c => {
    const chat = createChat(c.title);
    chat.preview = c.preview;
    chat.pinned = c.pinned;
  });
  state.activeChatId = state.chats[0]?.id;
  renderChatHistory();

  // Load agents
  await refreshAgents();

  // Show welcome toast
  setTimeout(() => showToast('Welcome back, Gobzz! 👋', 'success', 'Your AI agent platform is ready.'), 700);

  // Focus input
  document.getElementById('chat-input')?.focus();
});
