/* ═══════════════════════════════════════════════════════════════════════
   NEXUS ENGENEERING — Модуль Фінанси v1.0.2
   Облік доходів та витрат
   ═══════════════════════════════════════════════════════════════════════ */

const Fin = (() => {

  const USERS_KEY = 'nexus_users_v1';
  const SESSION_KEY = 'nexus_session_v1';
  const FIN_KEY = 'nexus_finance_v1';
  const THEME_KEY = 'nexus_theme_v1';

  const ACCOUNTS = {
    cash: { icon: '💵', name: 'Готівка' },
    bank: { icon: '🏦', name: 'Банк' },
    card: { icon: '💳', name: 'Картка' }
  };

  const DEFAULT_CATS = {
    income: [
      { id: 'i_service',  name: '💰 Оплата послуг' },
      { id: 'i_goods',    name: '📦 Продаж товарів' },
      { id: 'i_contract', name: '📝 За договором' },
      { id: 'i_advance',  name: '💳 Аванс від клієнта' },
      { id: 'i_other',    name: '💵 Інші надходження' }
    ],
    expense: [
      { id: 'e_salary',   name: '👥 Зарплата' },
      { id: 'e_tax',      name: '🏛️ Податки та збори' },
      { id: 'e_rent',     name: '🏢 Оренда' },
      { id: 'e_office',   name: '📎 Офісні витрати' },
      { id: 'e_internet', name: '🌐 Зв\'язок та інтернет' },
      { id: 'e_tech',     name: '💻 Техніка та ПЗ' },
      { id: 'e_transport',name: '🚗 Транспорт' },
      { id: 'e_marketing',name: '📣 Маркетинг' },
      { id: 'e_bank',     name: '🏦 Банківські послуги' },
      { id: 'e_other',    name: '💸 Інші витрати' }
    ]
  };

  let db = loadDB();
  let editingId = null;
  let currentRange = 'quarter';

  function loadDB() {
    try {
      const r = localStorage.getItem(FIN_KEY);
      if (r) {
        const p = JSON.parse(r);
        if (p && p.ops) {
          if (!p.categories) p.categories = JSON.parse(JSON.stringify(DEFAULT_CATS));
          return p;
        }
      }
    } catch(e){}
    return {
      ops: [],
      categories: JSON.parse(JSON.stringify(DEFAULT_CATS)),
      meta: { created: new Date().toISOString().slice(0,10), version: '1.0' }
    };
  }

  function saveDB() {
    try { localStorage.setItem(FIN_KEY, JSON.stringify(db)); } catch(e){}
  }

  function getCurrentUser() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const sess = JSON.parse(raw);
      if (!sess || !sess.userId) return null;
      if (sess.expiresAt && sess.expiresAt < Date.now()) {
        localStorage.removeItem(SESSION_KEY);
        return null;
      }
      const users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
      return users.find(u => u.id === sess.userId) || null;
    } catch(e) { return null; }
  }

  function initAuth() {
    const user = getCurrentUser();
    if (!user) {
      try { sessionStorage.setItem('nexus_redirect_after_login', 'finance.html'); } catch(e){}
      location.href = 'hr.html';
      return false;
    }
    const auth = document.getElementById('auth-ov');
    const app = document.getElementById('app');
    if (auth) auth.classList.add('hidden');
    if (app) app.classList.add('vis');

    const av = document.getElementById('av');
    const hun = document.getElementById('hun');
    const hur = document.getElementById('hur');
    const initials = (user.fullName || user.username).split(/\s+/).map(w => w[0]).join('').slice(0,2).toUpperCase();
    const roleMap = { admin: 'Адміністратор', manager: 'Менеджер', viewer: 'Перегляд' };
    if (av) av.textContent = initials;
    if (hun) hun.textContent = user.fullName || user.username;
    if (hur) hur.textContent = roleMap[user.role] || user.role;

    return true;
  }

  function logout() {
    localStorage.removeItem(SESSION_KEY);
    location.href = 'index.html';
  }

  function initTheme() {
    let current = localStorage.getItem(THEME_KEY) || 'auto';
    document.documentElement.setAttribute('data-theme', current);
    const updateIcon = () => {
      const icons = { light:'☀️', dark:'🌙', auto:'🌗' };
      document.querySelectorAll('.theme-btn').forEach(b => b.textContent = icons[current] || '🌗');
    };
    const MODES = ['light','dark','auto'];
    document.querySelectorAll('.theme-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = MODES.indexOf(current);
        current = MODES[(idx+1) % MODES.length];
        document.documentElement.setAttribute('data-theme', current);
        localStorage.setItem(THEME_KEY, current);
        updateIcon();
      });
    });
    updateIcon();
  }

  function formatMoney(n) {
    return new Intl.NumberFormat('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);
  }

  function formatDate(s) {
    if (!s) return '';
    return s.split('-').reverse().join('.');
  }

  function getCatById(type, id) {
    const cats = db.categories[type] || [];
    return cats.find(c => c.id === id) || { id, name: '—' };
  }

  function getAllCats() {
    return [...(db.categories.income || []), ...(db.categories.expense || [])];
  }

  function getRangeStart() {
    const now = new Date();
    if (currentRange === 'all') return null;
    if (currentRange === 'month') return new Date(now.getFullYear(), now.getMonth(), 1);
    if (currentRange === 'quarter') return new Date(now.getFullYear(), now.getMonth() - 2, 1);
    if (currentRange === 'year') return new Date(now.getFullYear(), 0, 1);
    return null;
  }

  function setRange(r) {
    currentRange = r;
    document.querySelectorAll('.range-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.range === r);
    });
    render();
  }

  function getFilteredOps() {
    const start = getRangeStart();
    const q = (document.getElementById('search').value || '').toLowerCase().trim();
    const ft = document.getElementById('filter-type').value;
    const fc = document.getElementById('filter-cat').value;
    const fa = document.getElementById('filter-acc').value;

    let list = db.ops.slice();
    if (start) {
      const startStr = start.toISOString().slice(0,10);
      list = list.filter(o => o.date >= startStr);
    }
    if (q) list = list.filter(o =>
      (o.desc||'').toLowerCase().includes(q) ||
      (o.counter||'').toLowerCase().includes(q)
    );
    if (ft) list = list.filter(o => o.type === ft);
    if (fc) list = list.filter(o => o.categoryId === fc);
    if (fa) list = list.filter(o => o.account === fa);

    return list.sort((a,b) => (b.date||'').localeCompare(a.date||''));
  }

  function renderStats() {
    const list = getFilteredOps();
    const income = list.filter(o => o.type === 'income').reduce((s,o) => s + (Number(o.amount)||0), 0);
    const expense = list.filter(o => o.type === 'expense').reduce((s,o) => s + (Number(o.amount)||0), 0);
    const balance = income - expense;

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0,10);
    const monthOps = db.ops.filter(o => o.date >= monthStart);
    const monthIncome = monthOps.filter(o => o.type === 'income').reduce((s,o) => s + (Number(o.amount)||0), 0);
    const monthExpense = monthOps.filter(o => o.type === 'expense').reduce((s,o) => s + (Number(o.amount)||0), 0);
    const monthBalance = monthIncome - monthExpense;

    const rangeLabels = { month: 'за місяць', quarter: 'за квартал', year: 'за рік', all: 'за весь час' };
    const rangeLabel = rangeLabels[currentRange] || '';

    document.getElementById('stats').innerHTML = `
      <div class="fstat fstat--income">
        <div class="fstat__icon">💰</div>
        <div class="fstat__label">Доходи ${rangeLabel}</div>
        <div class="fstat__value">+${formatMoney(income)} ₴</div>
        <div class="fstat__hint">${list.filter(o=>o.type==='income').length} операцій</div>
      </div>
      <div class="fstat fstat--expense">
        <div class="fstat__icon">💸</div>
        <div class="fstat__label">Витрати ${rangeLabel}</div>
        <div class="fstat__value">−${formatMoney(expense)} ₴</div>
        <div class="fstat__hint">${list.filter(o=>o.type==='expense').length} операцій</div>
      </div>
      <div class="fstat fstat--balance">
        <div class="fstat__icon">⚖️</div>
        <div class="fstat__label">Баланс ${rangeLabel}</div>
        <div class="fstat__value ${balance < 0 ? 'negative' : ''}">${balance >= 0 ? '+' : ''}${formatMoney(balance)} ₴</div>
        <div class="fstat__hint">${balance >= 0 ? '✅ Позитивний' : '⚠️ Негативний'}</div>
      </div>
      <div class="fstat fstat--monthly">
        <div class="fstat__icon">📅</div>
        <div class="fstat__label">За поточний місяць</div>
        <div class="fstat__value">${monthBalance >= 0 ? '+' : ''}${formatMoney(monthBalance)} ₴</div>
        <div class="fstat__hint">+${formatMoney(monthIncome)} / −${formatMoney(monthExpense)}</div>
      </div>`;
  }

  function renderTable() {
    const list = getFilteredOps();
    document.getElementById('ops-count').textContent = list.length;

    const el = document.getElementById('ops-list');
    if (!list.length) {
      el.innerHTML = '<div class="tm">Операцій не знайдено. Додайте першу.</div>';
      return;
    }

    let html = '<table class="dt"><thead><tr>' +
      '<th>Дата</th><th>Тип</th><th>Категорія</th><th>Опис</th>' +
      '<th>Рахунок</th><th style="text-align:right">Сума</th><th></th>' +
      '</tr></thead><tbody>';

    list.forEach(o => {
      const cat = getCatById(o.type, o.categoryId);
      const acc = ACCOUNTS[o.account] || { icon:'', name:'' };
      const sign = o.type === 'income' ? '+' : '−';
      const cls = o.type === 'income' ? 'amount--income' : 'amount--expense';
      const typeBadge = o.type === 'income'
        ? '<span class="bg bg-g">💰 Дохід</span>'
        : '<span class="bg bg-r">💸 Витрата</span>';

      html += `<tr>
        <td class="tmn">${formatDate(o.date)}</td>
        <td>${typeBadge}</td>
        <td>${cat.name}</td>
        <td>
          <b>${o.desc || '—'}</b>
          ${o.counter ? '<div class="tsm tmu">' + o.counter + '</div>' : ''}
        </td>
        <td>${acc.icon} ${acc.name}</td>
        <td class="amount ${cls}">${sign}${formatMoney(o.amount)} ₴</td>
        <td style="text-align:right;white-space:nowrap">
          <button class="btn bs bxs" onclick="Fin.openDetail('${o.id}')">👁</button>
          <button class="btn bs bxs" onclick="Fin.edit('${o.id}')">✏️</button>
          <button class="btn bd bxs" onclick="Fin.del('${o.id}')">×</button>
        </td></tr>`;
    });

    html += '</tbody></table>';
    el.innerHTML = html;
  }

  function filter() {
    renderStats();
    renderTable();
  }

  function fillCategorySelect(type, keepValue) {
    const sel = document.getElementById('f-category');
    if (!sel) return;
    const cats = db.categories[type] || [];
    sel.innerHTML = cats.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    if (keepValue) sel.value = keepValue;
  }

  function fillCategoryFilter() {
    const sel = document.getElementById('filter-cat');
    if (!sel) return;
    const current = sel.value;
    const allCats = getAllCats();
    sel.innerHTML = '<option value="">Всі категорії</option>' +
      allCats.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    if (current) sel.value = current;
  }

  function onTypeChange() {
    const type = document.getElementById('f-type').value;
    fillCategorySelect(type);
  }

  function toggleForm() {
    const body = document.getElementById('form-body');
    const btn = document.getElementById('form-toggle');
    if (!body) return;
    const hidden = body.style.display === 'none';
    body.style.display = hidden ? '' : 'none';
    btn.textContent = hidden ? 'Згорнути' : 'Розгорнути';
  }

  function reset() {
    editingId = null;
    document.getElementById('f-type').value = 'expense';
    document.getElementById('f-amount').value = 0;
    document.getElementById('f-date').value = new Date().toISOString().slice(0,10);
    document.getElementById('f-account').value = 'bank';
    document.getElementById('f-counter').value = '';
    document.getElementById('f-desc').value = '';
    document.getElementById('f-link').value = '';
    fillCategorySelect('expense');
    document.getElementById('form-title').textContent = 'Нова операція';
    document.getElementById('btn-save').textContent = 'Додати операцію';
    document.getElementById('btn-reset').style.display = 'none';
  }

  function save() {
    const amount = Number(document.getElementById('f-amount').value);
    if (!amount || amount <= 0) { alert('Вкажіть суму більше 0'); return; }
    const date = document.getElementById('f-date').value;
    if (!date) { alert('Вкажіть дату'); return; }

    const type = document.getElementById('f-type').value;
    const categoryId = document.getElementById('f-category').value;
    if (!categoryId) { alert('Виберіть категорію'); return; }

    const op = {
      id: editingId || 'op_' + Math.random().toString(36).slice(2,10) + Date.now().toString(36),
      type,
      amount,
      date,
      categoryId,
      account: document.getElementById('f-account').value,
      counter: document.getElementById('f-counter').value.trim(),
      desc: document.getElementById('f-desc').value.trim(),
      link: document.getElementById('f-link').value.trim(),
      updatedAt: new Date().toISOString().slice(0,10)
    };

    if (editingId) {
      const idx = db.ops.findIndex(x => x.id === editingId);
      if (idx >= 0) db.ops[idx] = op;
      alert('✅ Операцію оновлено');
    } else {
      op.createdAt = new Date().toISOString().slice(0,10);
      db.ops.push(op);
      alert('✅ Операцію додано');
    }

    saveDB();
    reset();
    fillCategoryFilter();
    render();
  }

  function edit(id) {
    const op = db.ops.find(x => x.id === id);
    if (!op) return;
    editingId = id;

    document.getElementById('f-type').value = op.type;
    fillCategorySelect(op.type, op.categoryId);
    document.getElementById('f-amount').value = op.amount;
    document.getElementById('f-date').value = op.date;
    document.getElementById('f-account').value = op.account;
    document.getElementById('f-counter').value = op.counter || '';
    document.getElementById('f-desc').value = op.desc || '';
    document.getElementById('f-link').value = op.link || '';

    document.getElementById('form-title').textContent = 'Редагувати операцію';
    document.getElementById('btn-save').textContent = 'Зберегти';
    document.getElementById('btn-reset').style.display = '';
    document.getElementById('form-body').style.display = '';

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function del(id) {
    const op = db.ops.find(x => x.id === id);
    if (!op) return;
    if (!confirm('Видалити операцію на ' + formatMoney(op.amount) + ' ₴?')) return;
    db.ops = db.ops.filter(x => x.id !== id);
    saveDB();
    render();
  }

  function openDetail(id) {
    const o = db.ops.find(x => x.id === id);
    if (!o) return;
    const cat = getCatById(o.type, o.categoryId);
    const acc = ACCOUNTS[o.account] || { icon:'', name:'' };
    const sign = o.type === 'income' ? '+' : '−';
    const cls = o.type === 'income' ? 'amount--income' : 'amount--expense';

    document.getElementById('detail-title').textContent = (o.type === 'income' ? '💰' : '💸') + ' ' + (o.desc || cat.name);

    const row = (lbl, val) => `<div class="detail-row"><div class="lbl">${lbl}</div><div class="val">${val || '—'}</div></div>`;

    const linkHtml = o.link
      ? `<a href="${o.link}" target="_blank" rel="noopener" style="color:var(--primary);text-decoration:none">🔗 Відкрити</a>`
      : '—';

    document.getElementById('detail-body').innerHTML = `
      ${row('Тип', o.type === 'income' ? '💰 Дохід' : '💸 Витрата')}
      ${row('Сума', `<span class="amount ${cls}" style="font-size:18px">${sign}${formatMoney(o.amount)} ₴</span>`)}
      ${row('Дата', formatDate(o.date))}
      ${row('Категорія', cat.name)}
      ${row('Рахунок', acc.icon + ' ' + acc.name)}
      ${row('Контрагент', o.counter)}
      ${row('Опис', o.desc)}
      ${row('Посилання', linkHtml)}
      ${row('Створено', o.createdAt ? formatDate(o.createdAt) : '')}
      ${row('Оновлено', o.updatedAt ? formatDate(o.updatedAt) : '')}
      <div class="fg" style="margin-top:20px">
        <button class="btn bp" onclick="Fin.closeDetail();Fin.edit('${o.id}')">✏️ Редагувати</button>
        <button class="btn bs" onclick="Fin.closeDetail();Fin.del('${o.id}')">🗑️ Видалити</button>
      </div>
    `;

    document.getElementById('detail-modal').classList.add('open');
  }

  function closeDetail() {
    document.getElementById('detail-modal').classList.remove('open');
  }

  function renderCatPreview() {
    const el = document.getElementById('cat-preview');
    if (!el) return;
    const inc = (db.categories.income || []).slice(0, 4);
    const exp = (db.categories.expense || []).slice(0, 6);
    el.innerHTML = `
      <div class="tsm tmu mb16">Доходи (${(db.categories.income || []).length})</div>
      <div class="cat-preview-list mb16">
        ${inc.map(c => `<span class="cat-chip cat-chip--income">${c.name}</span>`).join('')}
        ${(db.categories.income || []).length > 4 ? '<span class="cat-chip">+' + ((db.categories.income || []).length - 4) + '</span>' : ''}
      </div>
      <div class="tsm tmu mb16">Витрати (${(db.categories.expense || []).length})</div>
      <div class="cat-preview-list">
        ${exp.map(c => `<span class="cat-chip cat-chip--expense">${c.name}</span>`).join('')}
        ${(db.categories.expense || []).length > 6 ? '<span class="cat-chip">+' + ((db.categories.expense || []).length - 6) + '</span>' : ''}
      </div>`;
  }

  function openCatManager() {
    renderCatManager();
    document.getElementById('cat-modal').classList.add('open');
  }

  function closeCatManager() {
    document.getElementById('cat-modal').classList.remove('open');
  }

  function renderCatManager() {
    const el = document.getElementById('cat-body');
    if (!el) return;

    const renderGroup = (type, title) => {
      const cats = db.categories[type] || [];
      return `<div class="cat-group">
        <div class="cat-group__title">${title}</div>
        <div class="cat-list">
          ${cats.map(c => `<div class="cat-item">
            <span>${c.name}</span>
            <button class="cat-item__del" onclick="Fin.delCategory('${type}','${c.id}')" title="Видалити">×</button>
          </div>`).join('')}
          <div class="fg" style="margin-top:8px">
            <input id="new-cat-${type}" placeholder="Нова категорія..." style="flex:1">
            <button class="btn bp bsm" onclick="Fin.addCategory('${type}')">➕</button>
          </div>
        </div>
      </div>`;
    };

    el.innerHTML = renderGroup('income', '💰 Доходи') + renderGroup('expense', '💸 Витрати');
  }

  function addCategory(type) {
    const inp = document.getElementById('new-cat-' + type);
    if (!inp) return;
    const name = inp.value.trim();
    if (!name) return;
    const id = type.slice(0,1) + '_' + Date.now().toString(36);
    if (!db.categories[type]) db.categories[type] = [];
    db.categories[type].push({ id, name });
    saveDB();
    inp.value = '';
    renderCatManager();
    fillCategoryFilter();
    renderCatPreview();
  }

  function delCategory(type, id) {
    const used = db.ops.some(o => o.categoryId === id);
    if (used) {
      if (!confirm('Категорія використовується в операціях.\nВидалити все одно? Операції залишаться з посиланням на видалену категорію.')) return;
    } else {
      if (!confirm('Видалити категорію?')) return;
    }
    db.categories[type] = db.categories[type].filter(c => c.id !== id);
    saveDB();
    renderCatManager();
    fillCategoryFilter();
    renderCatPreview();
  }

  function exportExcel() {
    if (!db.ops.length) { alert('Немає даних'); return; }
    const data = [
      ['Дата','Тип','Категорія','Сума','Рахунок','Контрагент','Опис','Посилання']
    ];
    db.ops.slice().sort((a,b) => (a.date||'').localeCompare(b.date||'')).forEach(o => {
      const cat = getCatById(o.type, o.categoryId);
      const acc = ACCOUNTS[o.account] || { name: o.account };
      data.push([
        o.date,
        o.type === 'income' ? 'Дохід' : 'Витрата',
        cat.name,
        Number(o.amount) || 0,
        acc.name,
        o.counter || '',
        o.desc || '',
        o.link || ''
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{wch:12},{wch:12},{wch:25},{wch:14},{wch:14},{wch:25},{wch:30},{wch:30}];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Фінанси');
    XLSX.writeFile(wb, 'finance-' + new Date().toISOString().slice(0,10) + '.xlsx');
  }

  function exportJSON() {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'finance-backup-' + new Date().toISOString().slice(0,10) + '.json';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function importJSON(ev) {
    const f = ev.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const d = JSON.parse(r.result);
        if (!d.ops) throw new Error('Невірний формат');
        db = d;
        if (!db.categories) db.categories = JSON.parse(JSON.stringify(DEFAULT_CATS));
        saveDB();
        fillCategoryFilter();
        renderCatPreview();
        render();
        alert('✅ Імпортовано: ' + d.ops.length + ' операцій');
      } catch(e) { alert('Помилка: ' + e.message); }
    };
    r.readAsText(f);
    ev.target.value = '';
  }

  function clearAll() {
    if (!confirm('Видалити ВСІ операції?')) return;
    if (!confirm('Точно видалити ' + db.ops.length + ' операцій?')) return;
    db.ops = [];
    saveDB();
    render();
    alert('🗑️ Операції очищено');
  }

  function init() {
    if (!initAuth()) return;
    initTheme();
    reset();
    fillCategoryFilter();
    renderCatPreview();
    render();
    setInterval(fillCategoryFilter, 15000);
  }

  return {
    init, save, edit, del, reset, toggleForm, filter,
    setRange, onTypeChange,
    openDetail, closeDetail,
    openCatManager, closeCatManager, addCategory, delCategory,
    exportExcel, exportJSON, importJSON, clearAll,
    logout
  };
})();

window.Fin = Fin;

document.addEventListener('DOMContentLoaded', () => Fin.init());