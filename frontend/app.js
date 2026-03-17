/* =====================================================
   ADAPTIVE AI AGENT — App Logic
   ===================================================== */

// =====================================================
// STATE
// =====================================================
const state = {
  currentPage: 'dashboard',
  theme: 'dark',
  skills: [],
  activeSkill: null,
  currentSkillFilter: '',
  outputMessages: [],
  agentRunning: false,
  skillToDelete: null,
  charts: {},
};

const recentActivity = [
  { type: 'run', icon: 'play', color: 'blue', title: 'Agent run completed', desc: 'Code Review Agent — 847 tokens, 0.9s', time: '2m ago' },
  { type: 'skill', icon: 'star', color: 'purple', title: 'New skill uploaded', desc: 'research-v2.md successfully loaded', time: '14m ago' },
  { type: 'success', icon: 'check', color: 'green', title: 'Batch job finished', desc: 'Document Summarizer — 24 files processed', time: '1h ago' },
  { type: 'run', icon: 'play', color: 'blue', title: 'Agent run completed', desc: 'Content Writer — 1,243 tokens, 1.2s', time: '2h ago' },
  { type: 'warning', icon: 'alert', color: 'orange', title: 'Rate limit warning', desc: 'Approaching 80% of monthly token quota', time: '3h ago' },
  { type: 'delete', icon: 'trash', color: 'red', title: 'Skill deactivated', desc: 'legacy-agent.md moved to inactive', time: '5h ago' },
];

const ICON_MAP = {
  play: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>`,
  star: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`,
  check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`,
  alert: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  trash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>`,
  copy: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
  success_toast: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
  error_toast: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
  info_toast: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
  warning_toast: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>`,
};

const API_BASE_URL = 'http://localhost:8000';

// =====================================================
// ROUTER
// =====================================================
function showPage(pageId) {
  if (state.agentRunning) { showToast('Agent is running', 'warning', 'Please wait for the agent to finish.'); return; }

  // Deactivate current
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  // Activate target
  const page = document.getElementById(`page-${pageId}`);
  const navItem = document.getElementById(`nav-${pageId}`);
  if (page) page.classList.add('active');
  if (navItem) navItem.classList.add('active');

  // Breadcrumb
  const labels = { dashboard: 'Dashboard', playground: 'Agent Playground', skills: 'Skills Manager', analytics: 'Agent Analytics', settings: 'Settings' };
  document.getElementById('breadcrumb-current').textContent = labels[pageId] || pageId;

  state.currentPage = pageId;

  // Lazy init charts on analytics page
  if (pageId === 'analytics') initAnalyticsCharts();
  if (pageId === 'dashboard') reinitDashboardCharts();

  // Close mobile sidebar
  closeMobileSidebar();
}

// =====================================================
// SIDEBAR MOBILE
// =====================================================
function openMobileSidebar() {
  document.getElementById('sidebar').classList.add('mobile-open');
  const backdrop = document.getElementById('sidebar-backdrop');
  backdrop.classList.remove('hidden');
  backdrop.classList.add('visible');
  setTimeout(() => backdrop.classList.remove('hidden'), 10);
}
function closeMobileSidebar() {
  document.getElementById('sidebar').classList.remove('mobile-open');
  const backdrop = document.getElementById('sidebar-backdrop');
  backdrop.classList.remove('visible');
  backdrop.classList.add('hidden');
}

// =====================================================
// THEME
// =====================================================
function toggleTheme() {
  const body = document.body;
  body.classList.toggle('light-theme');
  state.theme = body.classList.contains('light-theme') ? 'light' : 'dark';

  const dmToggle = document.getElementById('dark-mode-toggle');
  if (dmToggle) dmToggle.checked = state.theme === 'dark';

  // Rebuild charts for new theme
  Object.values(state.charts).forEach(c => { if (c) c.update(); });
  showToast(`Switched to ${state.theme} mode`, 'info');
}

function handleDarkModeToggle(checkbox) {
  const body = document.body;
  if (checkbox.checked) body.classList.remove('light-theme');
  else body.classList.add('light-theme');
  state.theme = checkbox.checked ? 'dark' : 'light';
  Object.values(state.charts).forEach(c => { if (c) c.update(); });
}

function handleCompactToggle(checkbox) {
  document.getElementById('sidebar').classList.toggle('compact', checkbox.checked);
}

// =====================================================
// COUNTER ANIMATION
// =====================================================
function animateCounters() {
  document.querySelectorAll('.counter[data-target]').forEach(el => {
    const target = parseInt(el.dataset.target, 10);
    const duration = 1400;
    const start = performance.now();
    function step(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.floor(ease * target).toLocaleString();
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  });
}

// =====================================================
// CHART CONFIG HELPERS
// =====================================================
function chartDefaults() {
  return {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { backgroundColor: 'rgba(15,23,42,0.9)', titleColor: '#f1f5f9', bodyColor: '#94a3b8', borderColor: 'rgba(99,102,241,0.3)', borderWidth: 1, cornerRadius: 10, padding: 12 } },
    scales: {
      x: { grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false }, ticks: { color: '#4b5563', font: { size: 11, family: 'Inter' } } },
      y: { grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false }, ticks: { color: '#4b5563', font: { size: 11, family: 'Inter' } } }
    }
  };
}

function last14Days() {
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
  }
  return days;
}

// =====================================================
// DASHBOARD CHARTS
// =====================================================
function initDashboardCharts() {
  // Runs line chart
  const runsCtx = document.getElementById('runs-chart');
  if (!runsCtx) return;
  if (state.charts.runs) state.charts.runs.destroy();

  const runsData = [620, 780, 540, 920, 1100, 880, 1320, 970, 1150, 1400, 1080, 1560, 1240, 1690];
  const grad1 = runsCtx.getContext('2d').createLinearGradient(0, 0, 0, 200);
  grad1.addColorStop(0, 'rgba(99,102,241,0.35)');
  grad1.addColorStop(1, 'rgba(99,102,241,0)');

  state.charts.runs = new Chart(runsCtx, {
    type: 'line',
    data: {
      labels: last14Days(),
      datasets: [{ data: runsData, borderColor: '#6366f1', backgroundColor: grad1, borderWidth: 2.5, pointRadius: 0, pointHoverRadius: 5, pointHoverBackgroundColor: '#6366f1', tension: 0.45, fill: true }]
    },
    options: { ...chartDefaults(), interaction: { intersect: false, mode: 'index' } }
  });

  // Skill bar chart
  const barCtx = document.getElementById('skill-bar-chart');
  if (!barCtx) return;
  if (state.charts.skillBar) state.charts.skillBar.destroy();

  state.charts.skillBar = new Chart(barCtx, {
    type: 'bar',
    data: {
      labels: ['Code Review', 'Summarizer', 'Research', 'Writer', 'Analyst'],
      datasets: [{
        data: [42, 28, 19, 21, 16],
        backgroundColor: ['rgba(99,102,241,0.7)', 'rgba(139,92,246,0.7)', 'rgba(59,130,246,0.7)', 'rgba(16,185,129,0.7)', 'rgba(6,182,212,0.7)'],
        borderRadius: 8, borderSkipped: false
      }]
    },
    options: {
      ...chartDefaults(),
      plugins: { ...chartDefaults().plugins },
      scales: { ...chartDefaults().scales, x: { ...chartDefaults().scales.x, grid: { display: false } } }
    }
  });
}

function reinitDashboardCharts() {
  setTimeout(initDashboardCharts, 100);
}

// =====================================================
// ANALYTICS CHARTS
// =====================================================
function initAnalyticsCharts() {
  if (state.charts.analyticsInitialized) return;
  state.charts.analyticsInitialized = true;

  // Response Time Chart
  const rtCtx = document.getElementById('response-time-chart');
  if (rtCtx && !state.charts.responseTime) {
    const grad2 = rtCtx.getContext('2d').createLinearGradient(0, 0, 0, 250);
    grad2.addColorStop(0, 'rgba(6,182,212,0.25)');
    grad2.addColorStop(1, 'rgba(6,182,212,0)');
    state.charts.responseTime = new Chart(rtCtx, {
      type: 'line',
      data: {
        labels: last14Days(),
        datasets: [
          { label: 'Avg Latency (s)', data: [1.8,1.6,1.5,1.7,1.4,1.3,1.5,1.2,1.4,1.1,1.3,1.2,1.0,1.2], borderColor: '#06b6d4', backgroundColor: grad2, borderWidth: 2.5, tension: 0.45, fill: true, pointRadius: 0, pointHoverRadius: 5, pointHoverBackgroundColor: '#06b6d4' },
          { label: 'P95 Latency (s)',  data: [2.8,2.5,2.4,2.6,2.3,2.1,2.4,2.0,2.2,1.9,2.1,2.0,1.8,2.0], borderColor: '#a78bfa', borderDash: [6,3], borderWidth: 1.5, tension: 0.45, fill: false, pointRadius: 0 }
        ]
      },
      options: {
        ...chartDefaults(),
        plugins: { ...chartDefaults().plugins, legend: { display: true, labels: { color: '#94a3b8', font: { family: 'Inter', size: 12 }, boxWidth: 12, padding: 16 } } },
        interaction: { intersect: false, mode: 'index' }
      }
    });
  }

  // Pie Chart
  const pieCtx = document.getElementById('skill-pie-chart');
  if (pieCtx && !state.charts.pie) {
    const pieColors = ['#6366f1','#8b5cf6','#3b82f6','#10b981','#06b6d4'];
    const pieLabels = ['Code Review','Summarizer','Research','Writer','Analyst'];
    const pieData   = [4312, 2841, 1987, 2103, 1604];

    state.charts.pie = new Chart(pieCtx, {
      type: 'doughnut',
      data: { labels: pieLabels, datasets: [{ data: pieData, backgroundColor: pieColors, borderColor: 'transparent', borderWidth: 0, hoverOffset: 10 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: { display: false },
          tooltip: { backgroundColor: 'rgba(15,23,42,0.9)', titleColor: '#f1f5f9', bodyColor: '#94a3b8', borderColor: 'rgba(99,102,241,0.3)', borderWidth: 1, cornerRadius: 10, padding: 12 }
        }
      }
    });

    // Build legend
    const legend = document.getElementById('pie-legend');
    if (legend) {
      legend.innerHTML = pieLabels.map((label, i) =>
        `<div class="legend-item"><div class="legend-dot" style="background:${pieColors[i]}"></div>${label} (${((pieData[i]/pieData.reduce((a,b)=>a+b,0))*100).toFixed(0)}%)</div>`
      ).join('');
    }
  }
}

// =====================================================
// ACTIVITY FEED
// =====================================================
function renderActivityFeed() {
  const list = document.getElementById('activity-list');
  if (!list) return;
  list.innerHTML = recentActivity.map(a => `
    <div class="activity-item">
      <div class="activity-dot activity-dot--${a.color}">${ICON_MAP[a.icon] || ''}</div>
      <div class="activity-body">
        <div class="activity-title">${a.title}</div>
        <div class="activity-desc">${a.desc}</div>
      </div>
      <div class="activity-time">${a.time}</div>
    </div>
  `).join('');
}

// =====================================================
// ANALYTICS TABLE
// =====================================================
function renderAnalyticsTable() {
  const tbody = document.getElementById('analytics-table-body');
  if (!tbody) return;
  if (!state.skills.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:20px;">No skills available</td></tr>';
    return;
  }

  tbody.innerHTML = state.skills.map(s => `
    <tr>
      <td>${s.name}</td>
      <td>${s.runs.toLocaleString()}</td>
      <td>${s.latency}</td>
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          <div class="perf-bar"><div class="perf-bar-fill" style="width:${s.success}%"></div></div>
          <span>${s.success}%</span>
        </div>
      </td>
      <td><span class="badge badge--${s.active ? 'active' : 'inactive'}">${s.active ? '● Active' : '○ Inactive'}</span></td>
    </tr>
  `).join('');
}

// =====================================================
// SKILLS MANAGER
// =====================================================
async function apiGetSkills() {
  const response = await fetch(`${API_BASE_URL}/skills`);
  const payload = await response.json();
  if (!response.ok) {
    const message = payload?.error || payload?.detail || 'Failed to fetch skills';
    throw new Error(typeof message === 'string' ? message : 'Failed to fetch skills');
  }
  return Array.isArray(payload?.skills) ? payload.skills : [];
}

async function apiUploadSkill(file) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE_URL}/upload-skill`, {
    method: 'POST',
    body: formData,
  });
  const payload = await response.json();
  if (!response.ok) {
    const message = payload?.error || payload?.detail?.message || payload?.detail || 'Upload failed';
    throw new Error(typeof message === 'string' ? message : 'Upload failed');
  }
  return payload;
}

async function apiDeleteSkill(skillName) {
  const response = await fetch(`${API_BASE_URL}/delete-skill/${encodeURIComponent(skillName)}`, {
    method: 'DELETE',
  });
  const payload = await response.json();
  if (!response.ok) {
    const message = payload?.error || payload?.detail || 'Delete failed';
    throw new Error(typeof message === 'string' ? message : 'Delete failed');
  }
  return payload;
}

function buildSkillModel(name) {
  const existing = state.skills.find(s => s.name === name);
  const pseudo = Math.max(1, name.length * 37);
  return {
    name,
    active: state.activeSkill === name,
    runs: existing?.runs ?? pseudo,
    latency: existing?.latency ?? `${(0.7 + (name.length % 9) / 10).toFixed(1)}s`,
    success: existing?.success ?? Math.min(99, 92 + (name.length % 8)),
  };
}

function populateSkillDropdown() {
  const skillSelect = getRequiredEl('skillSelect', 'skill-select');
  if (!skillSelect) return;

  const selectedBefore = skillSelect.value;
  skillSelect.innerHTML = '<option value="">- Select a Skill -</option>';

  state.skills.forEach((skill) => {
    const option = document.createElement('option');
    option.value = skill.name;
    option.textContent = skill.name;
    skillSelect.appendChild(option);
  });

  if (state.activeSkill && state.skills.some(s => s.name === state.activeSkill)) {
    skillSelect.value = state.activeSkill;
  } else if (selectedBefore && state.skills.some(s => s.name === selectedBefore)) {
    skillSelect.value = selectedBefore;
    state.activeSkill = selectedBefore;
  }
}

function syncSkillsState(skillNames) {
  const uniqueNames = [...new Set(skillNames)].sort((a, b) => a.localeCompare(b));
  state.skills = uniqueNames.map(buildSkillModel);

  if (state.activeSkill && !state.skills.some(s => s.name === state.activeSkill)) {
    state.activeSkill = null;
  }

  state.skills.forEach((skill) => {
    skill.active = skill.name === state.activeSkill;
  });
}

async function refreshSkills(options = {}) {
  const { silent = false } = options;

  try {
    const skillNames = await apiGetSkills();
    syncSkillsState(skillNames);
    renderSkills(state.currentSkillFilter);
    renderAnalyticsTable();
    populateSkillDropdown();
    document.querySelector('.nav-pill').textContent = state.skills.length;

    if (!silent && !state.skills.length) {
      showToast('No skills found', 'warning', 'Upload a skill file in backend/skills to run the agent.');
    }
  } catch (error) {
    if (!silent) {
      showToast('Could not load skills', 'error', error.message || 'Backend is unavailable.');
    }
  }
}

function renderSkills(filter = '') {
  const grid = document.getElementById('skills-grid');
  if (!grid) return;
  state.currentSkillFilter = filter;

  const filtered = state.skills.filter(s =>
    s.name.toLowerCase().includes(filter.toLowerCase())
  );

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="skills-empty glass-card" style="padding:48px;text-align:center">
        <div class="empty-icon" style="margin-bottom:12px">
          <svg viewBox="0 0 64 64" fill="none" width="56" height="56"><circle cx="32" cy="32" r="28" stroke="#374151" stroke-width="2"/><path d="M32 20v12M32 38v2" stroke="#6B7280" stroke-width="2.5" stroke-linecap="round"/></svg>
        </div>
        <p class="empty-title">No skills found</p>
        <p class="empty-desc">${filter ? `No skills match "${filter}"` : 'Upload a skill.md file to get started.'}</p>
      </div>`;
    return;
  }

  grid.innerHTML = filtered.map(skill => `
    <div class="glass-card skill-card" id="skill-card-${skill.name}">
      <div class="skill-card-header">
        <div class="skill-card-icon" style="background:rgba(99,102,241,0.1)">.md</div>
        <div class="skill-card-info">
          <div class="skill-card-name">${skill.name}</div>
          <div class="skill-card-desc">Dynamic backend skill file</div>
        </div>
      </div>
      <div class="skill-card-footer">
        <div class="skill-status ${skill.active ? 'active' : 'inactive'}">
          <div class="dot"></div>
          ${skill.active ? 'Active' : 'Inactive'}
        </div>
        <div class="skill-actions">
          <button class="skill-btn ${skill.active ? 'skill-btn-active' : 'skill-btn-activate'}"
            onclick="activateSkill('${skill.name}')" ${skill.active ? '' : ''}>
            ${skill.active ? '✓ Active' : 'Activate'}
          </button>
          <button class="skill-btn skill-btn-delete" onclick="openDeleteModal('${skill.name}')">Delete</button>
        </div>
      </div>
    </div>
  `).join('');
}

function activateSkill(skillName) {
  const skill = state.skills.find(s => s.name === skillName);
  if (!skill) return;

  state.activeSkill = skillName;
  state.skills.forEach(s => {
    s.active = s.name === skillName;
  });
  populateSkillDropdown();
  renderSkills(state.currentSkillFilter);
  renderAnalyticsTable();
  showToast(`"${skill.name}" is now active`, 'success');
}

function openDeleteModal(skillName) {
  state.skillToDelete = skillName;
  document.getElementById('modal-skill-name').textContent = skillName || 'this skill';
  document.getElementById('delete-modal').classList.remove('hidden');
}

function closeModal() {
  state.skillToDelete = null;
  document.getElementById('delete-modal').classList.add('hidden');
}

async function confirmDelete() {
  if (!state.skillToDelete) return;
  const target = state.skillToDelete;
  try {
    await apiDeleteSkill(target);
    if (state.activeSkill === target) {
      state.activeSkill = null;
    }
    closeModal();
    await refreshSkills({ silent: true });
    showToast(`"${target}" deleted`, 'success', 'Skill has been removed.');
  } catch (error) {
    showToast('Delete failed', 'error', error.message || 'Unable to delete skill.');
  }
}

// File Upload
async function handleFileUpload(file) {
  if (!file) return;
  if (!file.name.toLowerCase().endsWith('.md')) {
    showToast('Invalid file type', 'error', 'Please upload a .md file.');
    return;
  }

  showToast('Uploading skill...', 'info', file.name);
  try {
    const payload = await apiUploadSkill(file);
    await refreshSkills({ silent: true });
    showToast(`"${payload?.skill || file.name}" uploaded`, 'success', 'Skill is now available everywhere.');
  } catch (error) {
    showToast('Upload failed', 'error', error.message || 'Could not upload skill file.');
  }
}

// =====================================================
// AGENT RUNNER
// =====================================================
function getRequiredEl(primaryId, fallbackId = '') {
  return document.getElementById(primaryId) || (fallbackId ? document.getElementById(fallbackId) : null);
}

function setAgentStatus(isRunning) {
  const statusPill = document.getElementById('agent-status');
  if (!statusPill) return;
  statusPill.classList.toggle('running', isRunning);
  statusPill.innerHTML = isRunning
    ? `<div class="pulse-dot"></div><span>Agent Running...</span>`
    : `<div class="pulse-dot"></div><span>Agent Ready</span>`;
}

function setRunButtonState(isRunning) {
  const runBtn = document.getElementById('run-agent-btn');
  if (!runBtn) return;
  runBtn.disabled = isRunning;
  runBtn.innerHTML = isRunning
    ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18" style="animation:spin 1s linear infinite"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Running...`
    : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><polygon points="5 3 19 12 5 21 5 3"/></svg> Run Agent`;
}

async function fetchSkills() {
  await refreshSkills();
}

async function runAgent() {
  if (state.agentRunning) return;
  const inputEl = getRequiredEl('userInput', 'agent-query');
  const skillEl = getRequiredEl('skillSelect', 'skill-select');
  const outputEl = getRequiredEl('output', 'output-messages');

  if (!inputEl || !skillEl || !outputEl) {
    showToast('UI configuration issue', 'error', 'Required playground elements are missing.');
    return;
  }

  const query = inputEl.value.trim();
  const skillVal = skillEl.value || state.activeSkill;

  if (!query) { showToast('Please enter a query', 'warning', 'The query cannot be empty.'); return; }
  if (!skillVal) { showToast('Select a skill', 'warning', 'Choose a skill before running the agent.'); return; }

  state.agentRunning = true;
  setRunButtonState(true);
  setAgentStatus(true);

  document.getElementById('loading-overlay').classList.remove('hidden');
  document.getElementById('output-empty').classList.add('hidden');
  document.getElementById('output-meta').classList.add('hidden');
  outputEl.innerHTML = '<div class="message message-agent"><div class="message-agent-label">AI Agent</div><div class="message-agent-text">Running...</div></div>';

  const startTime = Date.now();
  try {
    const response = await fetch(`${API_BASE_URL}/run-agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_input: query, skill: skillVal }),
    });

    const payload = await response.json();
    if (!response.ok) {
      const message = payload?.error || payload?.detail || 'Agent request failed';
      throw new Error(typeof message === 'string' ? message : 'Agent request failed');
    }

    const result = payload?.output || '';
    const elapsed = Date.now() - startTime;

    outputEl.innerHTML = `<div class="message message-agent"><div class="message-agent-label">AI Agent (${escapeHtml(skillVal)})</div><div class="message-agent-text">${escapeHtml(result)}</div></div>`;

    document.getElementById('meta-time').textContent = `${(elapsed / 1000).toFixed(1)}s`;
    document.getElementById('meta-tokens').textContent = `${Math.max(1, Math.floor(result.length / 4))} tokens (est.)`;
    document.getElementById('output-meta').classList.remove('hidden');

    recentActivity.unshift({
      type: 'run',
      icon: 'play',
      color: 'blue',
      title: 'Agent run completed',
      desc: `${skillVal} — ${(elapsed / 1000).toFixed(1)}s`,
      time: 'just now',
    });
    renderActivityFeed();
    state.activeSkill = skillVal;
    state.skills.forEach(s => {
      s.active = s.name === skillVal;
    });
    renderSkills(state.currentSkillFilter);
    showToast('Agent run complete', 'success', `Skill: ${skillVal}`);
  } catch (error) {
    outputEl.innerHTML = `<div class="message message-agent"><div class="message-agent-label">Error</div><div class="message-agent-text">${escapeHtml(error.message || 'Could not connect to backend.')}</div></div>`;
    showToast('Agent failed', 'error', error.message || 'Backend error');
  } finally {
    document.getElementById('loading-overlay').classList.add('hidden');
    setRunButtonState(false);
    setAgentStatus(false);
    state.agentRunning = false;
  }
}

// =====================================================
// TOAST
// =====================================================
function showToast(title, type = 'success', desc = '') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  const iconSvg = ICON_MAP[type + '_toast'] || ICON_MAP.info_toast;
  toast.innerHTML = `
    <div class="toast-icon">${iconSvg}</div>
    <div class="toast-body">
      <div class="toast-title">${title}</div>
      ${desc ? `<div class="toast-desc">${desc}</div>` : ''}
    </div>
    <button class="toast-close" onclick="closeToast(this.parentElement)" aria-label="Dismiss">${ICON_MAP.play.replace('polygon', 'path d="M18 6L6 18M6 6l12 12"').replace('points="5 3 19 12 5 21 5 3"', '')}<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
  `;
  // Fix close button
  toast.querySelector('.toast-close').innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M18 6L6 18M6 6l12 12"/></svg>`;
  container.appendChild(toast);
  setTimeout(() => closeToast(toast), 4500);
}

function closeToast(el) {
  if (!el || !el.parentElement) return;
  el.classList.add('removing');
  setTimeout(() => el.remove(), 260);
}

// =====================================================
// SETTINGS
// =====================================================
function saveSettings() {
  showToast('Settings saved!', 'success', 'Your preferences have been updated.');
}

function toggleReveal(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const isPassword = input.type === 'password';
  input.type = isPassword ? 'text' : 'password';
  btn.style.color = isPassword ? 'var(--indigo)' : '';
}

// =====================================================
// UTILS
// =====================================================
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;')
    .replace(/\n/g, '<br>');
}

// =====================================================
// INIT
// =====================================================
document.addEventListener('DOMContentLoaded', async () => {

  // Nav click
  document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      showPage(item.dataset.page);
    });
  });

  // Sidebar mobile
  document.getElementById('sidebar-open-btn')?.addEventListener('click', openMobileSidebar);
  document.getElementById('sidebar-close-btn')?.addEventListener('click', closeMobileSidebar);
  document.getElementById('sidebar-backdrop')?.addEventListener('click', closeMobileSidebar);

  // Theme toggle (topnav)
  document.getElementById('theme-toggle')?.addEventListener('click', toggleTheme);

  // Dashboard: run agent btn shortcut
  document.getElementById('run-agent-btn')?.addEventListener('click', runAgent);

  // Keep active skill in sync with dropdown selection
  getRequiredEl('skillSelect', 'skill-select')?.addEventListener('change', (e) => {
    if (!e.target.value) return;
    state.activeSkill = e.target.value;
    state.skills.forEach(s => {
      s.active = s.name === state.activeSkill;
    });
    renderSkills(state.currentSkillFilter);
  });

  // Output copy
  document.getElementById('copy-output-btn')?.addEventListener('click', () => {
    const messages = getRequiredEl('output', 'output-messages');
    if (!messages || !messages.textContent.trim()) { showToast('Nothing to copy', 'warning'); return; }
    navigator.clipboard.writeText(messages.innerText).then(() => showToast('Copied output', 'success'));
  });

  // Clear output
  document.getElementById('clear-output-btn')?.addEventListener('click', () => {
    const output = getRequiredEl('output', 'output-messages');
    if (output) output.innerHTML = '';
    document.getElementById('output-empty').classList.remove('hidden');
    document.getElementById('output-meta').classList.add('hidden');
    showToast('Output cleared', 'info');
  });

  // Agent query char count
  const query = getRequiredEl('userInput', 'agent-query');
  if (query) {
    query.addEventListener('input', () => {
      document.getElementById('char-count').textContent = query.value.length;
    });
  }

  // Sliders
  const tempSlider = document.getElementById('temp-slider');
  const tempVal = document.getElementById('temp-val');
  if (tempSlider && tempVal) {
    tempSlider.addEventListener('input', () => tempVal.textContent = tempSlider.value);
  }
  const maxSlider = document.getElementById('maxtoken-slider');
  const maxVal = document.getElementById('maxtoken-val');
  if (maxSlider && maxVal) {
    maxSlider.addEventListener('input', () => maxVal.textContent = maxSlider.value);
  }

  // Skill search
  document.getElementById('skills-search')?.addEventListener('input', e => {
    renderSkills(e.target.value);
  });

  // Upload button (sidebar)
  document.getElementById('upload-skill-btn')?.addEventListener('click', () => {
    document.getElementById('skill-file-input').click();
  });

  // File input change
  document.getElementById('skill-file-input')?.addEventListener('change', e => {
    handleFileUpload(e.target.files[0]);
    e.target.value = '';
  });

  // Dropzone
  const dropzone = document.getElementById('dropzone');
  if (dropzone) {
    dropzone.addEventListener('click', () => document.getElementById('skill-file-input').click());
    dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('drag-over'); });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
    dropzone.addEventListener('drop', e => {
      e.preventDefault(); dropzone.classList.remove('drag-over');
      handleFileUpload(e.dataTransfer.files[0]);
    });
  }

  // Delete modal confirm
  document.getElementById('confirm-delete-btn')?.addEventListener('click', confirmDelete);
  document.getElementById('delete-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'delete-modal') closeModal();
  });

  // Period chips (dashboard)
  document.querySelectorAll('[data-period]').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('.card-actions').querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Date range chips (analytics)
  document.querySelectorAll('[data-range]').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('.date-range-selector').querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Notification btn
  document.getElementById('notif-btn')?.addEventListener('click', () => {
    showToast('You have 3 new notifications', 'info', 'Check your analytics for recent activity.');
    document.querySelector('.notif-dot')?.remove();
  });

  // Add spin animation for run button loader
  const style = document.createElement('style');
  style.textContent = '@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }';
  document.head.appendChild(style);

  // Initial renders
  renderActivityFeed();
  renderSkills();
  renderAnalyticsTable();
  await fetchSkills();
  animateCounters();

  // Dashboard charts (deferred to ensure canvas is painted)
  setTimeout(initDashboardCharts, 200);

  // Welcome toast
  setTimeout(() => showToast('Welcome back, GobzzAI!', 'success', 'Agent platform is ready.'), 800);
});
