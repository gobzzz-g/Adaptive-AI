/* =====================================================
   ADAPTIVE AI AGENT — App Logic (Plug-In Workspace)
   ===================================================== */

// =====================================================
// AGENT META — Rich metadata keyed by backend skill name (no .md)
// Add entries here for any new backend skill to get a custom card.
// =====================================================
const AGENT_META = {
  healthcare_revenue: {
    name: 'Healthcare Revenue Optimization AI',
    description: 'Analyzes revenue cycles, billing inefficiencies, and payer contracts to maximize healthcare organization profitability.',
    icon: '🏥', color: 'indigo', tag: 'Healthcare',
  },
  sales_intelligence: {
    name: 'Sales Intelligence AI',
    description: 'Discovers high-value leads, analyzes pipeline health, and generates targeted outreach strategies to accelerate deal velocity.',
    icon: '📊', color: 'cyan', tag: 'Sales',
  },
  content_strategy: {
    name: 'Content Strategy AI',
    description: 'Creates data-driven content plans, SEO frameworks, and multi-channel distribution strategies aligned with business goals.',
    icon: '✍️', color: 'purple', tag: 'Marketing',
  },
  content_writer: {
    name: 'Content Writer AI',
    description: 'Crafts compelling, on-brand content — blog posts, ad copy, social media, and long-form articles — at scale.',
    icon: '✍️', color: 'purple', tag: 'Marketing',
  },
  data_analyst: {
    name: 'Data Analytics AI',
    description: 'Processes complex datasets, identifies patterns, and delivers executive-ready insights with actionable business recommendations.',
    icon: '🔬', color: 'green', tag: 'Analytics',
  },
  legal_compliance: {
    name: 'Legal Compliance AI',
    description: 'Reviews contracts, assesses regulatory risk, and generates compliance frameworks to protect your organization from legal exposure.',
    icon: '⚖️', color: 'pink', tag: 'Legal',
  },
  ai_lead_agent: {
    name: 'AI Lead Discovery Agent',
    description: 'Automatically scouts the internet for high-potential business leads, scores them by opportunity, and prepares outreach-ready profiles.',
    icon: '🎯', color: 'cyan', tag: 'Lead Gen',
  },
  code_debug_agent: {
    name: 'Code Debug Agent',
    description: 'Intelligently detects bugs, explains root causes, and suggests precise code fixes across any language or tech stack.',
    icon: '🐛', color: 'indigo', tag: 'Engineering',
  },
  email_outreach_agent: {
    name: 'Email Outreach Agent',
    description: 'Generates highly personalized, conversion-optimized outreach emails tailored to each prospect\'s profile and pain points.',
    icon: '📧', color: 'green', tag: 'Sales',
  },
  marketing_strategy_agent: {
    name: 'Marketing Strategy Agent',
    description: 'Builds full go-to-market strategies, competitive positioning, and campaign blueprints aligned to your growth objectives.',
    icon: '📣', color: 'pink', tag: 'Marketing',
  },
  research_agent: {
    name: 'Research Agent',
    description: 'Deep-dives into any topic, synthesizes information from multiple sources, and delivers structured, citation-ready research reports.',
    icon: '🔍', color: 'purple', tag: 'Research',
  },
};

// Colour palette cycling for skills without a meta entry
const AUTO_COLORS = ['indigo','cyan','purple','green','pink'];
const AUTO_ICONS  = ['🤖','⚡','🧠','🔮','💡','🛠️','📡'];

function skillToAgentCard(skillName, index) {
  const meta = AGENT_META[skillName];
  const displayName = meta
    ? meta.name
    : skillName.replace(/_/g,' ').replace(/\b\w/g, c => c.toUpperCase()) + ' AI';
  return {
    id: skillName,
    name: displayName,
    description: meta ? meta.description : `Execute intelligent tasks using the ${displayName} module.`,
    icon: meta ? meta.icon : AUTO_ICONS[index % AUTO_ICONS.length],
    color: meta ? meta.color : AUTO_COLORS[index % AUTO_COLORS.length],
    tag: meta ? meta.tag : 'Agent',
    status: 'active',
    skillName,
  };
}

// =====================================================
// AGENT MODULE DEFINITIONS (fallback when backend offline)
// =====================================================
const AGENTS = [
  {
    id: 'healthcare_revenue',
    name: 'Healthcare Revenue Optimization AI',
    description: 'Analyzes revenue cycles, billing inefficiencies, and payer contracts to maximize healthcare organization profitability.',
    icon: '🏥',
    color: 'indigo',
    tag: 'Healthcare',
    status: 'active',
    skillName: 'healthcare_revenue',
  },
  {
    id: 'sales_intelligence',
    name: 'Sales Intelligence AI',
    description: 'Discovers high-value leads, analyzes pipeline health, and generates targeted outreach strategies to accelerate deal velocity.',
    icon: '📊',
    color: 'cyan',
    tag: 'Sales',
    status: 'active',
    skillName: 'sales_intelligence',
  },
  {
    id: 'content_strategy',
    name: 'Content Strategy AI',
    description: 'Creates data-driven content plans, SEO frameworks, and multi-channel distribution strategies aligned with business goals.',
    icon: '✍️',
    color: 'purple',
    tag: 'Marketing',
    status: 'active',
    skillName: 'content_strategy',
  },
  {
    id: 'data_analyst',
    name: 'Data Analytics AI',
    description: 'Processes complex datasets, identifies patterns, and delivers executive-ready insights with actionable business recommendations.',
    icon: '🔬',
    color: 'green',
    tag: 'Analytics',
    status: 'active',
    skillName: 'data_analyst',
  },
  {
    id: 'legal_compliance',
    name: 'Legal Compliance AI',
    description: 'Reviews contracts, assesses regulatory risk, and generates compliance frameworks to protect your organization from legal exposure.',
    icon: '⚖️',
    color: 'pink',
    tag: 'Legal',
    status: 'active',
    skillName: 'legal_compliance',
  },
];

// =====================================================
// STATE
// =====================================================
const state = {
  currentPage: 'dashboard',
  theme: 'dark',
  skills: [],
  agentCards: [],          // dynamic list rendered on dashboard
  activeAgent: null,
  currentSkillFilter: '',
  agentRunning: false,
  skillToDelete: null,
  charts: {},
  loadingMessageTimer: null,
};

const recentActivity = [
  { type: 'run', icon: 'play', color: 'blue', title: 'Agent run completed', desc: 'Healthcare Revenue AI — 847 tokens, 0.9s', time: '2m ago' },
  { type: 'skill', icon: 'star', color: 'purple', title: 'New skill uploaded', desc: 'sales_intelligence.md loaded', time: '14m ago' },
  { type: 'success', icon: 'check', color: 'green', title: 'Batch job finished', desc: 'Data Analytics AI — 24 items processed', time: '1h ago' },
  { type: 'run', icon: 'play', color: 'blue', title: 'Agent run completed', desc: 'Content Strategy AI — 1,243 tokens, 1.2s', time: '2h ago' },
  { type: 'warning', icon: 'alert', color: 'orange', title: 'Rate limit warning', desc: 'Approaching 80% of monthly token quota', time: '3h ago' },
];

const ICON_MAP = {
  play: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>`,
  star: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`,
  check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`,
  alert: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  trash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>`,
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

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const page = document.getElementById(`page-${pageId}`);
  const navItem = document.getElementById(`nav-${pageId}`);
  if (page) page.classList.add('active');
  if (navItem) navItem.classList.add('active');

  const labels = {
    dashboard: 'Dashboard',
    workspace: 'Agent Workspace',
    skills: 'Skills Manager',
    analytics: 'Agent Analytics',
    settings: 'Settings',
  };
  document.getElementById('breadcrumb-current').textContent = labels[pageId] || pageId;
  state.currentPage = pageId;

  if (pageId === 'analytics') initAnalyticsCharts();
  closeMobileSidebar();
}

// =====================================================
// AGENT CARD RENDERING
// =====================================================
function renderAgentCards(cards) {
  const grid = document.getElementById('agents-grid');
  if (!grid) return;

  const list = cards || state.agentCards;

  if (!list.length) {
    grid.innerHTML = `
      <div class="glass-card" style="padding:48px 24px;text-align:center;grid-column:1/-1">
        <div style="font-size:36px;margin-bottom:12px">🔌</div>
        <p style="font-size:15px;font-weight:600;color:var(--text-primary);margin-bottom:6px">No Agent Modules Found</p>
        <p style="font-size:13px;color:var(--text-muted)">Upload skill files in the Skills Manager or ensure the backend is running.</p>
      </div>`;
    return;
  }

  const countBadge = document.getElementById('agents-count-badge');
  if (countBadge) countBadge.textContent = list.length;

  grid.innerHTML = list.map(agent => `
    <div class="agent-card" data-color="${agent.color}" data-agent-id="${agent.id}">
      <div class="agent-card-top">
        <div class="agent-card-icon agent-card-icon--${agent.color}">${agent.icon}</div>
        <span class="agent-status-badge ${agent.status}">
          <span class="status-pulse"></span>
          ${agent.status === 'active' ? 'Active' : 'Inactive'}
        </span>
      </div>
      <div>
        <div class="agent-card-name">${agent.name}</div>
        <div class="agent-card-desc">${agent.description}</div>
      </div>
      <div class="agent-card-footer">
        <span class="agent-tag">${agent.tag}</span>
        <button class="btn-activate" onclick="activateAgent('${agent.id}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          Activate Agent
        </button>
      </div>
    </div>
  `).join('');
}

// =====================================================
// AGENT ACTIVATION FLOW
// =====================================================
function activateAgent(agentId) {
  // Look up in the live dynamic card list first, then fallback hardcoded AGENTS
  const agent = state.agentCards.find(a => a.id === agentId)
             || AGENTS.find(a => a.id === agentId);
  if (!agent) return;

  const overlay = document.getElementById('activation-overlay');
  const orbIcon = document.getElementById('activation-orb-icon');
  const mainMsg = document.getElementById('activation-main-msg');
  const subMsg  = document.getElementById('activation-sub-msg');
  const agentNameEl = document.getElementById('activation-agent-name');
  const progressBar = document.getElementById('activation-progress-bar');

  // Reset
  progressBar.style.width = '0%';
  orbIcon.textContent = agent.icon;
  agentNameEl.textContent = `→ ${agent.name}`;
  mainMsg.textContent = '⚡ Initializing AI Module...';
  subMsg.textContent = 'Establishing secure connection';

  // Show overlay
  overlay.classList.add('visible');

  const messages = [
    { main: '⚡ Initializing AI Module...', sub: 'Establishing secure connection' },
    { main: '🔌 Activating Agent...', sub: 'Loading execution parameters' },
    { main: '🧠 Preparing Execution Environment...', sub: 'Agent workspace ready' },
  ];

  let step = 0;
  const totalDuration = 2600;
  const stepInterval = totalDuration / messages.length;

  // Animate progress bar
  let startTime = Date.now();
  const progressInterval = setInterval(() => {
    const elapsed = Date.now() - startTime;
    const pct = Math.min((elapsed / totalDuration) * 100, 100);
    progressBar.style.width = pct + '%';
    if (elapsed >= totalDuration) clearInterval(progressInterval);
  }, 30);

  // Cycle messages
  const msgInterval = setInterval(() => {
    step++;
    if (step < messages.length) {
      mainMsg.style.opacity = '0';
      subMsg.style.opacity = '0';
      setTimeout(() => {
        mainMsg.textContent = messages[step].main;
        subMsg.textContent = messages[step].sub;
        mainMsg.style.opacity = '1';
        subMsg.style.opacity = '1';
      }, 200);
    }
  }, stepInterval);

  // Transition to workspace
  setTimeout(() => {
    clearInterval(msgInterval);
    clearInterval(progressInterval);

    // Fade out overlay, then show workspace
    overlay.style.opacity = '0';
    setTimeout(() => {
      overlay.classList.remove('visible');
      overlay.style.opacity = '';
      openWorkspace(agent);
    }, 400);
  }, totalDuration + 200);
}

function openWorkspace(agent) {
  state.activeAgent = agent;

  // Populate workspace UI
  document.getElementById('workspace-icon').textContent = agent.icon;
  document.getElementById('workspace-title').textContent = `${agent.icon} ${agent.name}`;
  document.getElementById('workspace-subtitle').textContent = '🔌 Module Active • Ready for Execution';

  // Clear previous output
  document.getElementById('workspace-input').value = '';
  document.getElementById('workspace-char-count').textContent = '0';
  resetOutputPanel();

  // Navigate
  showPage('workspace');
  // Highlight dashboard nav since workspace doesn't have a direct nav entry
  document.getElementById('nav-dashboard').classList.remove('active');
}

// =====================================================
// UNPLUG AGENT
// =====================================================
function unplugAgent() {
  if (state.agentRunning) {
    showToast('Agent is running', 'warning', 'Please wait for execution to finish.');
    return;
  }
  state.activeAgent = null;
  showPage('dashboard');
  showToast('Agent unplugged', 'info', 'Returned to dashboard.');
}

// =====================================================
// RESET OUTPUT PANEL
// =====================================================
function resetOutputPanel() {
  document.getElementById('output-empty-state').style.display = '';
  const resultsEl = document.getElementById('output-results');
  resultsEl.innerHTML = '';
  resultsEl.style.display = 'none';
  document.getElementById('output-meta-bar').classList.add('hidden');
}

// =====================================================
// RUN ANALYSIS (AGENT EXECUTION)
// =====================================================
async function runAnalysis() {
  if (state.agentRunning) return;
  if (!state.activeAgent) { showToast('No agent active', 'warning', 'Please activate an agent first.'); return; }

  const inputEl = document.getElementById('workspace-input');
  const task = inputEl.value.trim();
  if (!task) { showToast('Enter a task', 'warning', 'Task input cannot be empty.'); return; }

  state.agentRunning = true;
  const runBtn = document.getElementById('run-analysis-btn');
  runBtn.disabled = true;
  runBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation:spin 1s linear infinite"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Executing...`;

  // Show loading overlay
  document.getElementById('loading-overlay').classList.remove('hidden');
  document.getElementById('loading-main-text').textContent = '⚡ Executing Agent Task...';
  startExecutionLoadingMessages();

  // Hide old output
  document.getElementById('output-empty-state').style.display = 'none';
  document.getElementById('output-results').style.display = 'none';
  document.getElementById('output-meta-bar').classList.add('hidden');

  const startTime = Date.now();
  try {
    const response = await fetch(`${API_BASE_URL}/run-agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task, agent: state.activeAgent.skillName }),
    });

    const payload = await response.json();
    if (!response.ok) {
      const message = payload?.error || payload?.detail || 'Agent request failed';
      throw new Error(typeof message === 'string' ? message : 'Agent request failed');
    }

    const rawResult = payload?.output || '';
    const elapsed = Date.now() - startTime;
    renderStructuredOutput(rawResult);

    document.getElementById('meta-time').textContent = `${(elapsed / 1000).toFixed(1)}s`;
    document.getElementById('meta-tokens').textContent = `${Math.max(1, Math.floor(rawResult.length / 4))} tokens (est.)`;
    document.getElementById('output-meta-bar').classList.remove('hidden');
    showToast('Analysis complete', 'success', `Agent: ${state.activeAgent.name}`);

  } catch (err) {
    // Show error as structured output fallback
    const errMsg = err.message || 'Could not connect to backend.';
    renderErrorOutput(errMsg);
    showToast('Execution failed', 'error', errMsg);
  } finally {
    document.getElementById('loading-overlay').classList.add('hidden');
    stopExecutionLoadingMessages();
    runBtn.disabled = false;
    runBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg> ⚡ Run Analysis`;
    state.agentRunning = false;
  }
}

// =====================================================
// STRUCTURED OUTPUT RENDERER
// =====================================================
const OUTPUT_SECTIONS = [
  { key: 'Problem Identified',   pattern: /(problem identified|problem statement|challenge|issue)/i },
  { key: 'Business Impact',      pattern: /(business impact|impact|consequence|risk)/i },
  { key: 'AI Solution',          pattern: /(ai solution|solution|recommendation|approach)/i },
  { key: 'Implementation Plan',  pattern: /(implementation plan|execution plan|rollout|implementation|next steps)/i },
  { key: 'Expected ROI',         pattern: /(expected roi|roi|return on investment|outcome|value)/i },
];

function parseStructuredOutput(rawText) {
  const cleaned = rawText
    .replace(/\*\*/g, '').replace(/^#{1,6}\s+/gm, '').replace(/\r/g, '').trim();

  const sections = Object.fromEntries(OUTPUT_SECTIONS.map(s => [s.key, []]));
  let current = 'Problem Identified';

  cleaned.split('\n').forEach(line => {
    const l = line.trim().replace(/^[-*•]\s*/, '');
    if (!l) return;
    const matched = OUTPUT_SECTIONS.find(s => s.pattern.test(l));
    if (matched) {
      current = matched.key;
      const rest = l.replace(matched.pattern, '').replace(/^\s*[:\-]\s*/, '').trim();
      if (rest) sections[current].push(rest);
    } else {
      sections[current].push(l);
    }
  });

  return sections;
}

function renderStructuredOutput(rawText) {
  const sections = parseStructuredOutput(rawText);
  const resultsEl = document.getElementById('output-results');

  resultsEl.innerHTML = OUTPUT_SECTIONS.map(({ key }) => {
    const body = sections[key].join(' ').replace(/\s+/g, ' ').trim()
      || 'Not explicitly addressed in the model response.';
    return `
      <div class="output-section">
        <div class="output-section-title">${key}</div>
        <div class="output-section-body">${escapeHtml(body)}</div>
      </div>
    `;
  }).join('');

  document.getElementById('output-empty-state').style.display = 'none';
  resultsEl.style.display = 'flex';
}

function renderErrorOutput(message) {
  const resultsEl = document.getElementById('output-results');
  resultsEl.innerHTML = `
    <div class="output-section" style="--section-accent:#f87171">
      <div class="output-section-title">Execution Error</div>
      <div class="output-section-body">${escapeHtml(message)}\n\nPlease ensure the backend is running at ${API_BASE_URL} and the agent skill file is available.</div>
    </div>
  `;
  document.getElementById('output-empty-state').style.display = 'none';
  resultsEl.style.display = 'flex';
}

// =====================================================
// LOADING MESSAGES
// =====================================================
function startExecutionLoadingMessages() {
  const phaseEl = document.getElementById('loading-phase-text');
  if (!phaseEl) return;
  const messages = ['Analyzing problem...', 'Applying AI model...', 'Generating solution...'];
  let index = 0;
  phaseEl.textContent = messages[0];
  if (state.loadingMessageTimer) clearInterval(state.loadingMessageTimer);
  state.loadingMessageTimer = setInterval(() => {
    index = (index + 1) % messages.length;
    phaseEl.textContent = messages[index];
  }, 1400);
}
function stopExecutionLoadingMessages() {
  if (state.loadingMessageTimer) {
    clearInterval(state.loadingMessageTimer);
    state.loadingMessageTimer = null;
  }
}

// =====================================================
// SIDEBAR MOBILE
// =====================================================
function openMobileSidebar() {
  document.getElementById('sidebar').classList.add('mobile-open');
  const backdrop = document.getElementById('sidebar-backdrop');
  backdrop.classList.remove('hidden');
  setTimeout(() => backdrop.classList.add('visible'), 10);
}
function closeMobileSidebar() {
  document.getElementById('sidebar').classList.remove('mobile-open');
  const backdrop = document.getElementById('sidebar-backdrop');
  backdrop.classList.remove('visible');
  setTimeout(() => backdrop.classList.add('hidden'), 250);
}

// =====================================================
// THEME
// =====================================================
function toggleTheme() {
  document.body.classList.toggle('light-theme');
  state.theme = document.body.classList.contains('light-theme') ? 'light' : 'dark';
  const dmToggle = document.getElementById('dark-mode-toggle');
  if (dmToggle) dmToggle.checked = state.theme === 'dark';
  showToast(`Switched to ${state.theme} mode`, 'info');
}
function handleDarkModeToggle(checkbox) {
  if (checkbox.checked) document.body.classList.remove('light-theme');
  else document.body.classList.add('light-theme');
  state.theme = checkbox.checked ? 'dark' : 'light';
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
      const progress = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.floor(ease * target).toLocaleString();
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  });
}

// =====================================================
// CHART HELPERS
// =====================================================
function chartDefaults() {
  return {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { backgroundColor: 'rgba(15,23,42,0.9)', titleColor: '#f1f5f9', bodyColor: '#94a3b8', borderColor: 'rgba(99,102,241,0.3)', borderWidth: 1, cornerRadius: 10, padding: 12 }
    },
    scales: {
      x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#4b5563', font: { size: 11, family: 'Inter' } } },
      y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#4b5563', font: { size: 11, family: 'Inter' } } }
    }
  };
}
function last14Days() {
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    days.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
  }
  return days;
}

// =====================================================
// ANALYTICS CHARTS
// =====================================================
function initAnalyticsCharts() {
  if (state.charts.analyticsInitialized) return;
  state.charts.analyticsInitialized = true;

  const rtCtx = document.getElementById('response-time-chart');
  if (rtCtx) {
    const grad = rtCtx.getContext('2d').createLinearGradient(0, 0, 0, 250);
    grad.addColorStop(0, 'rgba(6,182,212,0.25)'); grad.addColorStop(1, 'rgba(6,182,212,0)');
    state.charts.responseTime = new Chart(rtCtx, {
      type: 'line',
      data: {
        labels: last14Days(),
        datasets: [
          { label: 'Avg Latency (s)', data: [1.8,1.6,1.5,1.7,1.4,1.3,1.5,1.2,1.4,1.1,1.3,1.2,1.0,1.2], borderColor: '#06b6d4', backgroundColor: grad, borderWidth: 2.5, tension: 0.45, fill: true, pointRadius: 0, pointHoverRadius: 5, pointHoverBackgroundColor: '#06b6d4' },
          { label: 'P95 Latency (s)', data: [2.8,2.5,2.4,2.6,2.3,2.1,2.4,2.0,2.2,1.9,2.1,2.0,1.8,2.0], borderColor: '#a78bfa', borderDash: [6,3], borderWidth: 1.5, tension: 0.45, fill: false, pointRadius: 0 }
        ]
      },
      options: { ...chartDefaults(), plugins: { ...chartDefaults().plugins, legend: { display: true, labels: { color: '#94a3b8', font: { family: 'Inter', size: 12 }, boxWidth: 12, padding: 16 } } }, interaction: { intersect: false, mode: 'index' } }
    });
  }

  const pieCtx = document.getElementById('skill-pie-chart');
  if (pieCtx) {
    const pieColors = ['#6366f1','#06b6d4','#8b5cf6','#10b981','#ec4899'];
    const pieLabels = ['Healthcare','Sales Intel','Content','Analytics','Legal'];
    const pieData   = [3200, 2800, 2100, 2600, 1400];
    state.charts.pie = new Chart(pieCtx, {
      type: 'doughnut',
      data: { labels: pieLabels, datasets: [{ data: pieData, backgroundColor: pieColors, borderColor: 'transparent', borderWidth: 0, hoverOffset: 10 }] },
      options: { responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { display: false }, tooltip: { backgroundColor: 'rgba(15,23,42,0.9)', titleColor: '#f1f5f9', bodyColor: '#94a3b8', borderColor: 'rgba(99,102,241,0.3)', borderWidth: 1, cornerRadius: 10, padding: 12 } } }
    });
    const legend = document.getElementById('pie-legend');
    if (legend) {
      const total = pieData.reduce((a,b) => a+b, 0);
      legend.innerHTML = pieLabels.map((label, i) =>
        `<div class="legend-item"><div class="legend-dot" style="background:${pieColors[i]}"></div>${label} (${Math.round(pieData[i]/total*100)}%)</div>`
      ).join('');
    }
  }
}

// =====================================================
// SKILLS MANAGER
// =====================================================
async function apiGetSkills() {
  const response = await fetch(`${API_BASE_URL}/skills`);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error || 'Failed to fetch skills');
  return Array.isArray(payload?.skills) ? payload.skills : [];
}
async function apiUploadSkill(file) {
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch(`${API_BASE_URL}/upload-skill`, { method: 'POST', body: formData });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error || payload?.detail?.message || 'Upload failed');
  return payload;
}
async function apiDeleteSkill(skillName) {
  const response = await fetch(`${API_BASE_URL}/delete-skill/${encodeURIComponent(skillName)}`, { method: 'DELETE' });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error || 'Delete failed');
  return payload;
}

function buildSkillModel(name) {
  const pseudo = Math.max(1, name.length * 37);
  return {
    name,
    active: false,
    runs: pseudo,
    latency: `${(0.7 + (name.length % 9) / 10).toFixed(1)}s`,
    success: Math.min(99, 92 + (name.length % 8)),
  };
}

async function refreshSkills(options = {}) {
  const { silent = false } = options;
  try {
    const skillNames = await apiGetSkills();
    const uniqueNames = [...new Set(skillNames)].sort((a,b) => a.localeCompare(b));
    state.skills = uniqueNames.map(buildSkillModel);

    // Build dynamic agent cards from backend skills
    state.agentCards = uniqueNames.map((name, i) => skillToAgentCard(name, i));
    renderAgentCards();

    renderSkills(state.currentSkillFilter);
    renderAnalyticsTable();
    const pill = document.getElementById('skills-count-pill');
    if (pill) pill.textContent = state.skills.length;
    if (!silent && !state.skills.length) showToast('No skills found', 'warning', 'Upload a .md skill file to the backend/skills folder.');
  } catch (err) {
    // Backend offline — fall back to hardcoded AGENTS so dashboard isn't empty
    if (state.agentCards.length === 0) {
      state.agentCards = AGENTS;
      renderAgentCards();
    }
    if (!silent) showToast('Could not load skills', 'error', err.message || 'Backend unavailable.');
  }
}

function renderSkills(filter = '') {
  const grid = document.getElementById('skills-grid');
  if (!grid) return;
  state.currentSkillFilter = filter;
  const filtered = state.skills.filter(s => s.name.toLowerCase().includes(filter.toLowerCase()));
  if (!filtered.length) {
    grid.innerHTML = `<div class="glass-card" style="padding:48px;text-align:center;grid-column:1/-1"><p style="color:var(--text-muted)">${filter ? `No skills match "${filter}"` : 'No skills yet. Upload a skill.md file to get started.'}</p></div>`;
    return;
  }
  grid.innerHTML = filtered.map(skill => `
    <div class="glass-card skill-card">
      <div class="skill-card-header">
        <div class="skill-card-icon" style="background:rgba(99,102,241,0.1)">.md</div>
        <div class="skill-card-info">
          <div class="skill-card-name">${skill.name}</div>
          <div class="skill-card-desc">Backend skill file</div>
        </div>
      </div>
      <div class="skill-card-footer">
        <div class="skill-status ${skill.active ? 'active' : 'inactive'}">
          <div class="dot"></div>${skill.active ? 'Active' : 'Inactive'}
        </div>
        <div class="skill-actions">
          <button class="skill-btn skill-btn-delete" onclick="openDeleteModal('${skill.name}')">Delete</button>
        </div>
      </div>
    </div>
  `).join('');
}

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

async function handleFileUpload(file) {
  if (!file) return;
  if (!file.name.toLowerCase().endsWith('.md')) { showToast('Invalid file type', 'error', 'Please upload a .md file.'); return; }
  showToast('Uploading skill...', 'info', file.name);
  try {
    const payload = await apiUploadSkill(file);
    await refreshSkills({ silent: true });
    showToast(`"${payload?.skill || file.name}" uploaded`, 'success', 'Skill is now available.');
  } catch (err) {
    showToast('Upload failed', 'error', err.message || 'Could not upload skill file.');
  }
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
    closeModal();
    await refreshSkills({ silent: true });
    showToast(`"${target}" deleted`, 'success', 'Skill removed.');
  } catch (err) {
    showToast('Delete failed', 'error', err.message || 'Unable to delete skill.');
  }
}

// =====================================================
// SETTINGS
// =====================================================
function saveSettings() {
  showToast('Settings saved', 'success', 'Your preferences have been updated.');
}
function toggleReveal(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  input.type = input.type === 'password' ? 'text' : 'password';
}

// =====================================================
// TOAST
// =====================================================
function showToast(title, type = 'success', desc = '') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  const iconSvg = ICON_MAP[`${type}_toast`] || ICON_MAP.info_toast;
  toast.innerHTML = `
    <div class="toast-icon">${iconSvg}</div>
    <div class="toast-content">
      <div class="toast-title">${escapeHtml(title)}</div>
      ${desc ? `<div class="toast-desc">${escapeHtml(desc)}</div>` : ''}
    </div>
    <button class="toast-close" onclick="this.closest('.toast').remove()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
  `;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 250);
  }, 4000);
}

// =====================================================
// UTILITY
// =====================================================
function escapeHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

// =====================================================
// INIT
// =====================================================
document.addEventListener('DOMContentLoaded', () => {
  // Seed with fallback agents so dashboard isn't blank before backend responds
  state.agentCards = [...AGENTS];
  renderAgentCards();

  // Counter animation
  animateCounters();

  // Sidebar nav click routing
  document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      showPage(item.dataset.page);
    });
  });

  // Mobile sidebar
  document.getElementById('sidebar-open-btn')?.addEventListener('click', openMobileSidebar);
  document.getElementById('sidebar-close-btn')?.addEventListener('click', closeMobileSidebar);
  document.getElementById('sidebar-backdrop')?.addEventListener('click', closeMobileSidebar);

  // Theme toggle
  document.getElementById('theme-toggle')?.addEventListener('click', toggleTheme);

  // Workspace char count
  document.getElementById('workspace-input')?.addEventListener('input', function() {
    document.getElementById('workspace-char-count').textContent = Math.min(this.value.length, 2000);
    if (this.value.length > 2000) this.value = this.value.slice(0, 2000);
  });

  // Copy output
  document.getElementById('copy-output-btn')?.addEventListener('click', () => {
    const text = document.getElementById('output-results')?.innerText;
    if (!text) { showToast('Nothing to copy', 'warning'); return; }
    navigator.clipboard.writeText(text).then(() => showToast('Copied!', 'success'));
  });

  // Clear output
  document.getElementById('clear-output-btn')?.addEventListener('click', () => {
    resetOutputPanel();
    document.getElementById('workspace-input').value = '';
    document.getElementById('workspace-char-count').textContent = '0';
  });

  // Skills search
  document.getElementById('skills-search')?.addEventListener('input', e => renderSkills(e.target.value));

  // File upload
  const skillInput = document.getElementById('skill-file-input');
  skillInput?.addEventListener('change', e => handleFileUpload(e.target.files[0]));

  // Dropzone drag & drop
  const dropzone = document.getElementById('dropzone');
  if (dropzone) {
    dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('drag-over'); });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
    dropzone.addEventListener('drop', e => {
      e.preventDefault();
      dropzone.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file) handleFileUpload(file);
    });
    dropzone.addEventListener('click', () => skillInput?.click());
  }

  // Delete modal confirm
  document.getElementById('confirm-delete-btn')?.addEventListener('click', confirmDelete);

  // Analytics date range chips
  document.querySelectorAll('[data-range]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-range]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Load skills from backend (silent — no error shown if backend offline)
  refreshSkills({ silent: true });
});
