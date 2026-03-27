// popup.js

const LOCAL_SERVER = 'http://127.0.0.1:3727';

// ── DOM refs ──────────────────────────────────────────────────────────────────
const serverStatusBar = document.getElementById('server-status-bar');
const processBtn      = document.getElementById('process-btn');
const fillBtn         = document.getElementById('fill-btn');
const resultsSection  = document.getElementById('results-section');
const statusDiv       = document.getElementById('status');
const fileInput       = document.getElementById('file-input');
const uploadArea      = document.getElementById('upload-area');
const fileNameDiv     = document.getElementById('file-name');
const textInput       = document.getElementById('text-input');

// ── State ─────────────────────────────────────────────────────────────────────
let selectedFile   = null;
let serverOnline   = false;

// ── Check local server on open ────────────────────────────────────────────────
async function checkServer() {
  try {
    const res = await fetch(`${LOCAL_SERVER}/health`, { signal: AbortSignal.timeout(2000) });
    if (res.ok) {
      serverOnline = true;
      serverStatusBar.textContent = '✅ 本地服务运行中';
      serverStatusBar.className = 'server-bar online';
      return;
    }
  } catch (_) {}
  serverOnline = false;
  serverStatusBar.textContent = '❌ 本地服务未启动 — 请在 server/ 目录运行 npm start';
  serverStatusBar.className = 'server-bar offline';
}

checkServer();

// ── Tab switching ─────────────────────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
  });
});

// ── File upload ───────────────────────────────────────────────────────────────
uploadArea.addEventListener('click', () => fileInput.click());

uploadArea.addEventListener('dragover', e => {
  e.preventDefault();
  uploadArea.classList.add('drag-over');
});

uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('drag-over'));

uploadArea.addEventListener('drop', e => {
  e.preventDefault();
  uploadArea.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file && file.type === 'application/pdf') handleFileSelect(file);
});

fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) handleFileSelect(fileInput.files[0]);
});

function handleFileSelect(file) {
  selectedFile = file;
  fileNameDiv.textContent = `📎 ${file.name}`;
}

// ── Process BP ────────────────────────────────────────────────────────────────
processBtn.addEventListener('click', async () => {
  await checkServer();
  if (!serverOnline) {
    setStatus('本地服务未启动，请先在 server/ 目录运行 npm start', 'error');
    return;
  }

  const activeTab = document.querySelector('.tab.active').dataset.tab;
  let payload;

  if (activeTab === 'file') {
    if (!selectedFile) {
      setStatus('请选择 PDF 文件', 'error');
      return;
    }
    try {
      const base64 = await readFileAsBase64(selectedFile);
      payload = { type: 'pdf', base64 };
    } catch (e) {
      setStatus('读取文件失败：' + e.message, 'error');
      return;
    }
  } else {
    const text = textInput.value.trim();
    if (!text) {
      setStatus('请粘贴 BP 文字内容', 'error');
      return;
    }
    payload = { type: 'text', text };
  }

  setStatus('正在解析 BP 内容...', 'loading');
  processBtn.disabled = true;

  try {
    const response = await chrome.runtime.sendMessage({ type: 'callClaude', payload });

    if (!response.success) throw new Error(response.error || '未知错误');

    populateFields(response.data);
    resultsSection.hidden = false;
    setStatus('✓ 解析完成，请检查并编辑字段后点击"填写表单"', 'success');
    resultsSection.scrollIntoView({ behavior: 'smooth' });
  } catch (e) {
    setStatus('解析失败：' + e.message, 'error');
  } finally {
    processBtn.disabled = false;
  }
});

// ── Populate extracted fields ─────────────────────────────────────────────────
function populateFields(data) {
  if (data.identity)      setSelect('f-identity', data.identity);
  if (data.name)          document.getElementById('f-name').value = data.name;
  if (data.company)       document.getElementById('f-company').value = data.company;
  if (data.position)      document.getElementById('f-position').value = data.position;
  // Always set wechat/email — show 'null' string if not found in BP
  document.getElementById('f-wechat').value = data.wechat || 'null';
  document.getElementById('f-email').value  = data.email  || 'null';
  if (data.projectName)   document.getElementById('f-project-name').value = data.projectName;
  if (data.companyIntro)  document.getElementById('f-company-intro').value = data.companyIntro;
  if (data.team)          document.getElementById('f-team').value = data.team;
  if (data.fundingGoal)   setSelect('f-funding-goal', data.fundingGoal);
  if (data.source)        setSelect('f-source', data.source);
  if (data.membership)    setSelect('f-membership', data.membership);
  if (data.memberInterest) setSelect('f-member-interest', data.memberInterest);

  if (Array.isArray(data.services)) {
    document.querySelectorAll('.f-service').forEach(cb => { cb.checked = data.services.includes(cb.value); });
  }
  if (Array.isArray(data.needs)) {
    document.querySelectorAll('.f-need').forEach(cb => { cb.checked = data.needs.includes(cb.value); });
  }
  if (Array.isArray(data.cloudServices)) {
    document.querySelectorAll('.f-cloud').forEach(cb => { cb.checked = data.cloudServices.includes(cb.value); });
  }
}

function setSelect(id, value) {
  const sel = document.getElementById(id);
  for (const opt of sel.options) {
    if (opt.value === value) { sel.value = value; return; }
  }
}

// ── Fill Form ─────────────────────────────────────────────────────────────────
fillBtn.addEventListener('click', async () => {
  const data = gatherFields();

  const tabs = await chrome.tabs.query({ url: 'https://svtrglobal.feishu.cn/share/base/form/*' });
  if (tabs.length === 0) {
    setStatus('未找到飞书表单页面，请先在浏览器中打开 SVTR 申请表单', 'error');
    return;
  }

  const tab = tabs[0];
  setStatus('正在填写表单...', 'loading');
  fillBtn.disabled = true;

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    }).catch(() => {});

    const response = await chrome.tabs.sendMessage(tab.id, { type: 'fillForm', data });

    if (response && response.success) {
      const msg = response.warning
        ? `⚠️ 填写完成，但请注意：${response.warning}`
        : '✓ 表单填写完成！请切换到飞书页面检查后手动提交';
      setStatus(msg, response.warning ? 'loading' : 'success');
      await chrome.tabs.update(tab.id, { active: true });
    } else {
      setStatus('填写遇到问题：' + (response?.error || '请刷新飞书页面后重试'), 'error');
    }
  } catch (e) {
    setStatus('填写失败：' + e.message, 'error');
  } finally {
    fillBtn.disabled = false;
  }
});

function gatherFields() {
  const services = [], needs = [], cloudServices = [];
  document.querySelectorAll('.f-service:checked').forEach(cb => services.push(cb.value));
  document.querySelectorAll('.f-need:checked').forEach(cb => needs.push(cb.value));
  document.querySelectorAll('.f-cloud:checked').forEach(cb => cloudServices.push(cb.value));
  return {
    identity:       document.getElementById('f-identity').value,
    name:           document.getElementById('f-name').value,
    company:        document.getElementById('f-company').value,
    position:       document.getElementById('f-position').value,
    wechat:         document.getElementById('f-wechat').value,
    services,
    email:          document.getElementById('f-email').value,
    projectName:    document.getElementById('f-project-name').value,
    companyIntro:   document.getElementById('f-company-intro').value,
    team:           document.getElementById('f-team').value,
    needs,
    cloudServices,
    fundingGoal:    document.getElementById('f-funding-goal').value,
    source:         document.getElementById('f-source').value,
    membership:     document.getElementById('f-membership').value,
    memberInterest: document.getElementById('f-member-interest').value,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsDataURL(file);
  });
}

function setStatus(message, type = '') {
  statusDiv.textContent = message;
  statusDiv.className = 'status ' + type;
}
