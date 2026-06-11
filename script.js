// ============================================
// 玻璃成本报价系统 - 核心逻辑
// 功能：向导式流程、实时计算、配置保存、历史记录、Word/PDF导出
// ============================================

// ---------- 全局状态 ----------
const STORAGE_KEYS = {
  defaults: 'glass-quote-defaults',  // 保存的默认参数
  history: 'glass-quote-history'     // 历史报价
};

const state = {
  step: 0,                  // 当前步骤索引
  totalSteps: PROCESSES.length + 3, // 0:客户信息 1:产品规格 2..N+1:17道工序 最后:结果
  customer: { name: '', project: '' },
  product: { length: 1000, width: 1000, layers: 2, quantity: 100 },
  processes: {},   // { processId: { enabled: bool, fields: { fieldId: value } } }
  results: {},     // { processId: { cost, detail } }
  showTaxAndProfit: true,  // 税金/利润是否显示给客户看
  totalCost: 0
};

// 初始化各工序的默认值
PROCESSES.forEach(p => {
  const fields = {};
  p.fields.forEach(f => { fields[f.id] = f.default; });
  state.processes[p.id] = { enabled: false, fields };
});

// 尝试从本地存储恢复用户上次填的参数
(function loadDefaults() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.defaults) || '{}');
    if (saved.customer) state.customer = { ...state.customer, ...saved.customer };
    if (saved.product) state.product = { ...state.product, ...saved.product };
    if (saved.processes) {
      Object.keys(saved.processes).forEach(pid => {
        if (state.processes[pid]) {
          state.processes[pid].fields = { ...state.processes[pid].fields, ...saved.processes[pid].fields };
          state.processes[pid].enabled = saved.processes[pid].enabled || false;
        }
      });
    }
  } catch (e) { /* ignore */ }
})();

// ---------- 工具函数 ----------
function fmt(n) { return (Number(n) || 0).toFixed(2); }
function yuan(n) { return fmt(n) + ' 元'; }
function yuanBlock(n) { return fmt(n) + ' 元/块'; }
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show ' + type;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => t.className = 'toast', 2200);
}
function saveDefaults() {
  const data = {
    customer: state.customer,
    product: state.product,
    processes: {}
  };
  Object.keys(state.processes).forEach(pid => {
    data.processes[pid] = { enabled: state.processes[pid].enabled, fields: state.processes[pid].fields };
  });
  localStorage.setItem(STORAGE_KEYS.defaults, JSON.stringify(data));
}

// ---------- 渲染：根据当前 step 渲染内容 ----------
function render() {
  const content = document.getElementById('content');
  const s = state.step;
  const total = state.totalSteps;

  // 更新进度条
  document.getElementById('progress-bar').style.width = ((s + 1) / total * 100) + '%';
  document.getElementById('progress-text').textContent = `第 ${Math.min(s + 1, total)} / ${total} 步`;

  // 按钮状态
  document.getElementById('btn-prev').style.visibility = s === 0 ? 'hidden' : 'visible';
  const nextBtn = document.getElementById('btn-next');
  if (s === total - 1) {
    nextBtn.textContent = '✅ 完成';
  } else {
    nextBtn.textContent = '下一步 →';
  }

  // 悬浮总价
  const floating = document.getElementById('floating-total');
  if (s >= 2 && s < total - 1) {
    floating.style.display = 'flex';
    recalcTotal();
    document.getElementById('floating-value').textContent = yuanBlock(state.totalCost);
  } else {
    floating.style.display = 'none';
  }

  // 按步骤渲染
  if (s === 0) content.innerHTML = renderCustomerStep();
  else if (s === 1) content.innerHTML = renderProductStep();
  else if (s === total - 1) content.innerHTML = renderResultPage();
  else content.innerHTML = renderProcessStep(s - 2);

  // 绑定输入事件
  bindInputs();

  // 滚动到顶部
  content.scrollTop = 0;
}

// ---------- Step 1: 客户信息 ----------
function renderCustomerStep() {
  return `
    <div class="step-card">
      <div class="step-header">
        <div class="step-icon">👤</div>
        <div>
          <div class="step-title">客户信息</div>
          <div class="step-subtitle">填一下客户名称和项目名，方便以后查找</div>
        </div>
      </div>
      <div class="field-group">
        <label class="field-label">客户名称</label>
        <input type="text" class="field-input" id="f-customer-name" value="${state.customer.name}" placeholder="例如：XX玻璃厂">
      </div>
      <div class="field-group">
        <label class="field-label">项目名称</label>
        <input type="text" class="field-input" id="f-customer-project" value="${state.customer.project}" placeholder="例如：写字楼幕墙项目">
      </div>
    </div>
  `;
}

// ---------- Step 2: 产品规格 ----------
function renderProductStep() {
  return `
    <div class="step-card">
      <div class="step-header">
        <div class="step-icon">📐</div>
        <div>
          <div class="step-title">产品规格</div>
          <div class="step-subtitle">基本尺寸参数，影响每一道工序的计算</div>
        </div>
      </div>
      <div class="field-grid">
        <div class="field-group">
          <label class="field-label">产品长度<span class="unit">mm</span></label>
          <input type="number" class="field-input" id="f-p-length" value="${state.product.length}">
        </div>
        <div class="field-group">
          <label class="field-label">产品宽度<span class="unit">mm</span></label>
          <input type="number" class="field-input" id="f-p-width" value="${state.product.width}">
        </div>
        <div class="field-group">
          <label class="field-label">产品层数</label>
          <input type="number" class="field-input" id="f-p-layers" value="${state.product.layers}">
        </div>
        <div class="field-group">
          <label class="field-label">产品数量<span class="unit">块</span></label>
          <input type="number" class="field-input" id="f-p-quantity" value="${state.product.quantity}">
        </div>
      </div>
    </div>
  `;
}

// ---------- Steps 3..N+2: 17 道工序 ----------
function renderProcessStep(idx) {
  const p = PROCESSES[idx];
  const procState = state.processes[p.id];
  const fieldsHtml = procState.enabled ? p.fields.map(f => `
    <div class="field-group">
      <label class="field-label">${f.label}<span class="unit">${f.unit || ''}</span></label>
      <input type="number" step="any" class="field-input" id="f-${p.id}-${f.id}" value="${procState.fields[f.id]}">
    </div>
  `).join('') : '';

  const resultHtml = procState.enabled ? renderProcessResult(p) : '';

  return `
    <div class="step-card">
      <div class="step-header">
        <div class="step-icon">${p.icon}</div>
        <div>
          <div class="step-title">${p.name}</div>
          <div class="step-subtitle">${p.fields.length} 个参数 · 选择是否计算此工序</div>
        </div>
      </div>
      <div class="choice-row">
        <button class="choice-btn ${procState.enabled ? 'active' : ''}" data-choice="yes">✓ 需要计算</button>
        <button class="choice-btn ${!procState.enabled ? 'active skip' : ''}" data-choice="no">✕ 跳过</button>
      </div>
      <div class="field-grid">${fieldsHtml}</div>
      ${resultHtml}
    </div>
  `;
}

function renderProcessResult(p) {
  const r = state.results[p.id];
  if (!r || isNaN(r.cost)) return '';
  const detailHtml = Object.entries(r.detail).map(([k, v]) =>
    `<div class="result-detail-item"><span>${k}</span><span class="value">${typeof v === 'number' ? fmt(v) : v}</span></div>`
  ).join('');
  return `
    <div class="result-box">
      <div class="result-main">${yuanBlock(r.cost)}</div>
      <div class="result-label">本工序单块成本</div>
      <div class="result-detail">${detailHtml}</div>
    </div>
  `;
}

// ---------- 最终结果页 ----------
function renderResultPage() {
  recalcTotal();

  // 成本明细
  const detailHtml = PROCESSES.map(p => {
    const r = state.results[p.id];
    const enabled = state.processes[p.id].enabled;
    if (!enabled) {
      return `<div class="cost-breakdown-item skipped"><div class="process-name">${p.icon} ${p.name}</div><div class="process-cost">跳过</div></div>`;
    }
    return `<div class="cost-breakdown-item"><div class="process-name">${p.icon} ${p.name}</div><div class="process-cost">${yuan(r.cost)}</div></div>`;
  }).join('');

  const tax = state.totalCost * CONFIG.taxRate;
  const profit = state.totalCost * CONFIG.profitRate;
  const recommended = state.totalCost + tax + profit;

  return `
    <div class="step-card" style="box-shadow:none; padding:0 0 20px; max-width:760px;">
      <div class="result-page-title">📊 报价结果</div>
      <div class="result-page-subtitle">${state.customer.name || '未命名客户'} · ${state.customer.project || '未命名项目'}</div>

      <div class="customer-info-card">
        <div class="info-line"><span class="label">产品尺寸</span><span class="value">${state.product.length} × ${state.product.width} mm</span></div>
        <div class="info-line"><span class="label">层数 / 数量</span><span class="value">${state.product.layers} 层 · ${state.product.quantity} 块</span></div>
        <div class="info-line"><span class="label">计算工序</span><span class="value">${PROCESSES.filter(p => state.processes[p.id].enabled).length} 道</span></div>
      </div>

      <div class="cost-breakdown">${detailHtml}</div>

      <div class="summary-card">
        <div class="summary-line ${state.showTaxAndProfit ? '' : 'hidden-item'}" data-sensitive="true">
          <span>总成本</span><span class="value">${yuan(state.totalCost)}</span>
        </div>
        <div class="summary-line ${state.showTaxAndProfit ? '' : 'hidden-item'}" data-sensitive="true">
          <span>税金 (${Math.round(CONFIG.taxRate * 100)}%)</span><span class="value">${yuan(tax)}</span>
        </div>
        <div class="summary-line ${state.showTaxAndProfit ? '' : 'hidden-item'}" data-sensitive="true">
          <span>利润 (${Math.round(CONFIG.profitRate * 100)}%)</span><span class="value">${yuan(profit)}</span>
        </div>
        <div class="summary-line recommended">
          <span>✨ 推荐报价 / 每块</span><span class="value">${yuan(recommended)}</span>
        </div>
        <div class="summary-line recommended" style="font-size:16px; padding-top:8px; border-top:1px dashed rgba(255,255,255,0.3);">
          <span>📦 整批总价 × ${state.product.quantity} 块</span><span class="value">${yuan(recommended * state.product.quantity)}</span>
        </div>
      </div>

      <div class="toggle-row">
        <div class="toggle-label">${state.showTaxAndProfit ? '👁 显示成本/税金/利润（内部查看）' : '👁‍🗨 隐藏成本/税金/利润（客户只看报价）'}</div>
        <div class="toggle-switch ${state.showTaxAndProfit ? 'on' : ''}" id="toggle-sensitive"></div>
      </div>

      <div class="action-buttons">
        <button class="action-btn primary" id="btn-export-word">📄 导出 Word</button>
        <button class="action-btn success" id="btn-export-pdf">📑 导出 PDF</button>
        <button class="action-btn warning" id="btn-save-history">💾 保存到历史</button>
        <button class="action-btn" id="btn-restart">🔄 重新开始</button>
      </div>
    </div>
  `;
}

// ---------- 绑定表单输入事件 ----------
function bindInputs() {
  const s = state.step;

  if (s === 0) {
    document.getElementById('f-customer-name').addEventListener('input', e => state.customer.name = e.target.value);
    document.getElementById('f-customer-project').addEventListener('input', e => state.customer.project = e.target.value);
    return;
  }

  if (s === 1) {
    ['length', 'width', 'layers', 'quantity'].forEach(key => {
      const input = document.getElementById('f-p-' + key);
      input.addEventListener('input', e => {
        state.product[key] = parseFloat(e.target.value) || 0;
        recalcAllProcesses();
      });
    });
    return;
  }

  const total = state.totalSteps;
  if (s === total - 1) {
    // 结果页
    document.getElementById('toggle-sensitive').addEventListener('click', () => {
      state.showTaxAndProfit = !state.showTaxAndProfit;
      // 只切换敏感行，无需重新渲染
      document.querySelectorAll('[data-sensitive="true"]').forEach(el => {
        el.classList.toggle('hidden-item', !state.showTaxAndProfit);
      });
      const toggleSwitch = document.getElementById('toggle-sensitive');
      toggleSwitch.classList.toggle('on', state.showTaxAndProfit);
      const toggleLabel = toggleSwitch.parentElement.querySelector('.toggle-label');
      toggleLabel.textContent = state.showTaxAndProfit
        ? '👁 显示成本/税金/利润（内部查看）'
        : '👁‍🗨 隐藏成本/税金/利润（客户只看报价）';
    });
    document.getElementById('btn-export-word').addEventListener('click', exportWord);
    document.getElementById('btn-export-pdf').addEventListener('click', exportPDF);
    document.getElementById('btn-save-history').addEventListener('click', saveToHistory);
    document.getElementById('btn-restart').addEventListener('click', () => {
      state.step = 0;
      render();
    });
    return;
  }

  // 工序步骤
  const idx = s - 2;
  const p = PROCESSES[idx];

  document.querySelectorAll('.choice-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const choice = btn.getAttribute('data-choice') === 'yes';
      state.processes[p.id].enabled = choice;
      if (choice) calcProcessCost(p);
      else state.results[p.id] = null;
      saveDefaults();
      render();
    });
  });

  p.fields.forEach(f => {
    const input = document.getElementById(`f-${p.id}-${f.id}`);
    if (!input) return;
    input.addEventListener('input', () => {
      state.processes[p.id].fields[f.id] = parseFloat(input.value) || 0;
      calcProcessCost(p);
      saveDefaults();
      // 局部更新结果显示
      const card = document.querySelector('.step-card');
      const newResultHtml = renderProcessResult(p);
      const existingResult = card.querySelector('.result-box');
      const grid = card.querySelector('.field-grid');
      if (state.processes[p.id].enabled) {
        if (existingResult) existingResult.outerHTML = newResultHtml;
        else grid.insertAdjacentHTML('afterend', newResultHtml);
        document.getElementById('floating-value').textContent = yuanBlock(state.totalCost);
      }
    });
  });
}

// ---------- 计算某道工序 ----------
function calcProcessCost(p) {
  const procState = state.processes[p.id];
  if (!procState.enabled) { state.results[p.id] = null; return; }
  try {
    // 收集跨工序共享参数（如氩气依赖中空的层宽/合片数量）
    const shared = {
      hollow: {
        hollowLayerWidth: parseFloat(state.processes['hollow'].fields.hollowLayerWidth) || 0,
        hollowQuantity8h: parseFloat(state.processes['hollow'].fields.hollowQuantity8h) || 0
      }
    };
    const r = p.calc(procState.fields, state.product, shared);
    state.results[p.id] = r;
  } catch (e) {
    state.results[p.id] = { cost: 0, detail: { '错误': e.message } };
  }
}

// 重新计算所有工序
function recalcAllProcesses() {
  PROCESSES.forEach(p => calcProcessCost(p));
  recalcTotal();
}
function recalcTotal() {
  state.totalCost = PROCESSES.reduce((sum, p) => {
    const r = state.results[p.id];
    return sum + (r && !isNaN(r.cost) ? r.cost : 0);
  }, 0);
}

// ---------- 上一步 / 下一步 ----------
document.getElementById('btn-prev').addEventListener('click', () => {
  if (state.step > 0) { state.step--; render(); }
});
document.getElementById('btn-next').addEventListener('click', () => {
  const total = state.totalSteps;
  // 第一步简单校验
  if (state.step === 0 && !state.customer.name.trim()) {
    state.customer.name = '未填写客户';
  }
  if (state.step === total - 1) {
    // 完成
    showToast('✅ 已完成报价', 'success');
    return;
  }
  state.step++;
  saveDefaults();
  render();
});

// ---------- 重置 ----------
document.getElementById('btn-reset').addEventListener('click', () => {
  if (confirm('确定要重新开始吗？当前内容会被清空。')) {
    state.customer = { name: '', project: '' };
    state.product = { length: 1000, width: 1000, layers: 2, quantity: 100 };
    PROCESSES.forEach(p => {
      state.processes[p.id].enabled = false;
      p.fields.forEach(f => { state.processes[p.id].fields[f.id] = f.default; });
    });
    state.results = {};
    state.step = 0;
    saveDefaults();
    render();
  }
});

// ============================================
// 历史记录
// ============================================
const historyDrawer = document.getElementById('history-drawer');
const historyBackdrop = document.getElementById('drawer-backdrop');
document.getElementById('btn-history').addEventListener('click', () => openHistory());
document.getElementById('btn-close-history').addEventListener('click', () => closeHistory());
historyBackdrop.addEventListener('click', () => closeHistory());

function openHistory() {
  renderHistoryList();
  historyDrawer.classList.add('open');
  historyBackdrop.classList.add('open');
}
function closeHistory() {
  historyDrawer.classList.remove('open');
  historyBackdrop.classList.remove('open');
}
function renderHistoryList(keyword = '') {
  const list = JSON.parse(localStorage.getItem(STORAGE_KEYS.history) || '[]');
  const el = document.getElementById('history-list');
  const filtered = list.filter(r =>
    !keyword || (r.customer && r.customer.toLowerCase().includes(keyword.toLowerCase())) ||
    (r.project && r.project.toLowerCase().includes(keyword.toLowerCase()))
  );
  if (filtered.length === 0) { el.innerHTML = '<div class="history-empty">暂无历史记录<br>报价完成后点"保存到历史"</div>'; return; }
  el.innerHTML = filtered.map((r, i) => `
    <div class="history-item" data-idx="${list.length - 1 - i}">
      <div class="date">${r.date}</div>
      <div class="title">${r.customer || '未命名客户'} · ${r.project || '未命名项目'}</div>
      <div class="meta">${r.productSpec} · ${r.processCount} 道工序</div>
      <div class="price">${yuan(r.recommended)} / 块</div>
    </div>
  `).reverse().join('');
  el.querySelectorAll('.history-item').forEach(item => {
    item.addEventListener('click', () => {
      const realIdx = parseInt(item.getAttribute('data-idx'));
      const record = list[realIdx];
      if (confirm(`恢复这条报价：${record.customer || '未命名'}？`)) {
        state.customer.name = record.customer || '';
        state.customer.project = record.project || '';
        state.product = record.product;
        Object.keys(record.processes).forEach(pid => {
          if (state.processes[pid]) {
            state.processes[pid].fields = record.processes[pid].fields;
            state.processes[pid].enabled = record.processes[pid].enabled;
          }
        });
        recalcAllProcesses();
        state.step = state.totalSteps - 1;
        closeHistory();
        render();
      }
    });
  });
}
document.getElementById('history-search').addEventListener('input', e => renderHistoryList(e.target.value));
document.getElementById('btn-clear-history').addEventListener('click', () => {
  if (confirm('清空所有历史记录？此操作不可恢复。')) {
    localStorage.removeItem(STORAGE_KEYS.history);
    renderHistoryList();
    showToast('已清空历史', 'success');
  }
});

function saveToHistory() {
  recalcTotal();
  const tax = state.totalCost * CONFIG.taxRate;
  const profit = state.totalCost * CONFIG.profitRate;
  const recommended = state.totalCost + tax + profit;
  const record = {
    date: new Date().toLocaleString('zh-CN'),
    customer: state.customer.name,
    project: state.customer.project,
    productSpec: `${state.product.length}×${state.product.width}mm ${state.product.layers}层 ${state.product.quantity}块`,
    product: { ...state.product },
    processes: JSON.parse(JSON.stringify(state.processes)),
    processCount: PROCESSES.filter(p => state.processes[p.id].enabled).length,
    totalCost: state.totalCost,
    recommended: recommended
  };
  const list = JSON.parse(localStorage.getItem(STORAGE_KEYS.history) || '[]');
  list.push(record);
  localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(list));
  showToast('✅ 已保存到历史记录', 'success');
}

// ============================================
// 导出 Word（用原生 Blob 生成 .doc 文件，无需外部库）
// ============================================
function buildReportHTML(forWord = false) {
  recalcTotal();
  const tax = state.totalCost * CONFIG.taxRate;
  const profit = state.totalCost * CONFIG.profitRate;
  const recommended = state.totalCost + tax + profit;

  let html = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head><meta charset='utf-8'><title>玻璃报价单</title>
    <style>
      body { font-family: '微软雅黑', 'Microsoft YaHei', Arial; font-size: 12pt; line-height: 1.6; padding: 30px; }
      h1 { font-size: 22pt; text-align: center; color: #1d4ed8; margin-bottom: 20px; }
      h2 { font-size: 14pt; color: #1f2937; border-bottom: 2px solid #2563eb; padding-bottom: 4px; margin-top: 20px; }
      table { width: 100%; border-collapse: collapse; margin: 10px 0; }
      th, td { border: 1px solid #9ca3af; padding: 8px 12px; text-align: left; }
      th { background: #dbeafe; color: #1e40af; font-weight: bold; }
      .info-row td { background: #f9fafb; }
      .total-row td { background: #fef3c7; font-weight: bold; font-size: 13pt; }
      .recommend-row td { background: #10b981; color: white; font-weight: bold; font-size: 14pt; }
      .skipped { color: #9ca3af; text-decoration: line-through; }
      .cost { text-align: right; font-weight: 500; }
      .hide { display: none; }
      .big-price { font-size: 18pt; color: #059669; font-weight: bold; }
    </style></head><body>
    <h1>玻璃产品报价单</h1>
    <p style="text-align:right; color:#6b7280;">日期: ${new Date().toLocaleDateString('zh-CN')}</p>
    <h2>客户信息</h2>
    <table><tr><td>客户名称</td><td>${state.customer.name || '—'}</td><td>项目名称</td><td>${state.customer.project || '—'}</td></tr></table>
    <h2>产品规格</h2>
    <table>
      <tr><td>产品长度</td><td>${state.product.length} mm</td><td>产品宽度</td><td>${state.product.width} mm</td></tr>
      <tr><td>产品层数</td><td>${state.product.layers}</td><td>产品数量</td><td>${state.product.quantity} 块</td></tr>
    </table>
    <h2>工序成本明细</h2>
    <table><tr><th style="width:60%">工序</th><th style="width:40%; text-align:right;">每块成本（元）</th></tr>
  `;
  PROCESSES.forEach(p => {
    const r = state.results[p.id];
    const enabled = state.processes[p.id].enabled;
    if (enabled && r) {
      html += `<tr><td>${p.icon} ${p.name}</td><td class="cost">${fmt(r.cost)}</td></tr>`;
    } else {
      html += `<tr><td class="skipped">${p.icon} ${p.name}</td><td class="cost skipped">—</td></tr>`;
    }
  });
  html += `</table>`;

  html += `<h2>报价汇总</h2><table>`;
  html += `<tr class="info-row"><td>总成本</td><td class="cost">${yuan(state.totalCost)}</td></tr>`;
  html += `<tr class="info-row"><td>税金（${Math.round(CONFIG.taxRate * 100)}%）</td><td class="cost">${yuan(tax)}</td></tr>`;
  html += `<tr class="info-row"><td>利润（${Math.round(CONFIG.profitRate * 100)}%）</td><td class="cost">${yuan(profit)}</td></tr>`;
  html += `<tr class="recommend-row"><td>⭐ 推荐报价（每块）</td><td class="cost">${yuan(recommended)}</td></tr>`;
  html += `<tr class="total-row"><td>📦 整批总价（× ${state.product.quantity} 块）</td><td class="cost">${yuan(recommended * state.product.quantity)}</td></tr>`;
  html += `</table>`;

  // 详细参数
  html += `<h2>详细参数（各工序）</h2>`;
  PROCESSES.forEach(p => {
    if (!state.processes[p.id].enabled) return;
    html += `<h3>${p.icon} ${p.name}</h3><table>`;
    p.fields.forEach(f => {
      html += `<tr><td>${f.label}</td><td class="cost">${state.processes[p.id].fields[f.id]} ${f.unit || ''}</td></tr>`;
    });
    const r = state.results[p.id];
    if (r && r.detail) {
      Object.entries(r.detail).forEach(([k, v]) => {
        html += `<tr class="info-row"><td>${k}</td><td class="cost">${typeof v === 'number' ? fmt(v) : v}</td></tr>`;
      });
    }
    html += `</table>`;
  });

  html += `<p style="margin-top:30px; color:#6b7280; font-size:10pt; text-align:center;">本报价由玻璃成本报价系统生成 · 仅供参考 · 最终成交价以合同为准</p>`;
  html += `</body></html>`;
  return html;
}

function exportWord() {
  const html = buildReportHTML(true);
  const blob = new Blob(['\ufeff', html], { type: 'application/msword;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const fileName = `玻璃报价单_${state.customer.name || '客户'}_${new Date().toISOString().slice(0,10)}.doc`;
  a.download = fileName;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 100);
  showToast('📄 Word 已导出', 'success');
}

// ============================================
// 导出 PDF（用打印 + 浏览器另存为 PDF）
// ============================================
function exportPDF() {
  const html = buildReportHTML(false);
  const w = window.open('', '_blank');
  w.document.write(html);
  w.document.close();
  setTimeout(() => {
    w.focus();
    w.print();
  }, 400);
  showToast('已打开打印窗口，选择"另存为 PDF"', 'success');
}

// ============================================
// PWA Service Worker 注册
// ============================================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(err => console.log('SW 注册失败:', err));
  });
}

// ============================================
// 启动
// ============================================
// 先算一遍所有已启用工序的结果
recalcAllProcesses();
render();
