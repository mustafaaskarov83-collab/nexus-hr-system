/* ═══════════════════════════════════════════════════════════════════════
   NEXUS ENGENEERING — Модуль документообігу v1.0.1
   ═══════════════════════════════════════════════════════════════════════ */

const Doc = (() => {

  const USERS_KEY = 'nexus_users_v1';
  const SESSION_KEY = 'nexus_session_v1';
  const HR_KEY = 'nexus_hr_ua_v2';
  const DOC_KEY = 'nexus_documents_v1';
  const THEME_KEY = 'nexus_theme_v1';

  let db = loadDB();
  let editingId = null;

  const TYPES = {
    contract: { icon: '📝', name: 'Договір' },
    act:      { icon: '📋', name: 'Акт' },
    invoice:  { icon: '💵', name: 'Рахунок' },
    order:    { icon: '📢', name: 'Наказ' },
    letter:   { icon: '✉️', name: 'Лист' },
    report:   { icon: '📊', name: 'Звіт' },
    other:    { icon: '📎', name: 'Інше' }
  };
  const STATUSES = {
    draft:     { icon: '✏️', name: 'Чернетка',  cls: 'bg-gr' },
    active:    { icon: '🟢', name: 'Активний',  cls: 'bg-g' },
    done:      { icon: '✅', name: 'Виконано',  cls: 'bg-b' },
    archive:   { icon: '📦', name: 'Архів',     cls: 'bg-gr' },
    cancelled: { icon: '❌', name: 'Скасовано', cls: 'bg-r' }
  };

  function loadDB() {
    try {
      const r = localStorage.getItem(DOC_KEY);
      if (r) { const p = JSON.parse(r); if (p && p.docs) return p; }
    } catch(e){}
    return { docs: [], meta: { created: new Date().toISOString().slice(0,10), version: '1.0' } };
  }

  function saveDB() {
    try { localStorage.setItem(DOC_KEY, JSON.stringify(db)); } catch(e){}
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

  function getEmployees() {
    try {
      const h = JSON.parse(localStorage.getItem(HR_KEY) || '{}');
      return (h.employees || []).slice().sort((a,b) => (a.fullName||'').localeCompare(b.fullName||''));
    } catch(e) { return []; }
  }

  function initAuth() {
    const user = getCurrentUser();
    if (!user) {
      try { sessionStorage.setItem('nexus_redirect_after_login', 'documents.html'); } catch(e){}
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

  function fillEmployeeSelect() {
    const sel = document.getElementById('f-emp');
    if (!sel) return;
    const current = sel.value;
    const emps = getEmployees();
    sel.innerHTML = '<option value="">— не вказано —</option>' +
      emps.map(e => `<option value="${e.id}">${e.fullName}</option>`).join('');
    if (current) sel.value = current;
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
    ['f-name','f-num','f-counter','f-edrpou','f-link','f-notes'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    const amount = document.getElementById('f-amount'); if (amount) amount.value = 0;
    const date = document.getElementById('f-date');
    if (date) date.value = new Date().toISOString().slice(0,10);
    const until = document.getElementById('f-until'); if (until) until.value = '';
    const type = document.getElementById('f-type'); if (type) type.value = 'contract';
    const status = document.getElementById('f-status'); if (status) status.value = 'active';
    const emp = document.getElementById('f-emp'); if (emp) emp.value = '';
    document.getElementById('form-title').textContent = 'Додати документ';
    document.getElementById('btn-save').textContent = 'Додати документ';
    document.getElementById('btn-reset').style.display = 'none';
  }

  function save() {
    const name = document.getElementById('f-name').value.trim();
    if (!name) { alert('Вкажіть назву документу'); return; }
    const dateVal = document.getElementById('f-date').value;
    if (!dateVal) { alert('Вкажіть дату документу'); return; }

    const doc = {
      id: editingId || 'doc_' + Math.random().toString(36).slice(2,10) + Date.now().toString(36),
      name,
      type: document.getElementById('f-type').value,
      num: document.getElementById('f-num').value.trim(),
      date: dateVal,
      until: document.getElementById('f-until').value,
      amount: Number(document.getElementById('f-amount').value) || 0,
      counter: document.getElementById('f-counter').value.trim(),
      edrpou: document.getElementById('f-edrpou').value.trim(),
      status: document.getElementById('f-status').value,
      employeeId: document.getElementById('f-emp').value,
      link: document.getElementById('f-link').value.trim(),
      notes: document.getElementById('f-notes').value.trim(),
      updatedAt: new Date().toISOString().slice(0,10)
    };

    if (editingId) {
      const idx = db.docs.findIndex(x => x.id === editingId);
      if (idx >= 0) db.docs[idx] = doc;
      alert('✅ Документ оновлено');
    } else {
      doc.createdAt = new Date().toISOString().slice(0,10);
      db.docs.push(doc);
      alert('✅ Документ додано');
    }

    saveDB();
    reset();
    render();
  }

  function edit(id) {
    const doc = db.docs.find(x => x.id === id);
    if (!doc) return;
    editingId = id;

    document.getElementById('f-name').value = doc.name || '';
    document.getElementById('f-type').value = doc.type || 'contract';
    document.getElementById('f-num').value = doc.num || '';
    document.getElementById('f-date').value = doc.date || '';
    document.getElementById('f-until').value = doc.until || '';
    document.getElementById('f-amount').value = doc.amount || 0;
    document.getElementById('f-counter').value = doc.counter || '';
    document.getElementById('f-edrpou').value = doc.edrpou || '';
    document.getElementById('f-status').value = doc.status || 'active';
    document.getElementById('f-emp').value = doc.employeeId || '';
    document.getElementById('f-link').value = doc.link || '';
    document.getElementById('f-notes').value = doc.notes || '';

    document.getElementById('form-title').textContent = 'Редагувати документ';
    document.getElementById('btn-save').textContent = 'Зберегти зміни';
    document.getElementById('btn-reset').style.display = '';
    document.getElementById('form-body').style.display = '';

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function del(id) {
    const doc = db.docs.find(x => x.id === id);
    if (!doc) return;
    if (!confirm('Видалити «' + doc.name + '»?')) return;
    db.docs = db.docs.filter(x => x.id !== id);
    saveDB();
    render();
  }

  function render() {
    renderStats();
    renderTable();
  }

  function renderStats() {
    const docs = db.docs;
    const total = docs.length;
    const active = docs.filter(d => d.status === 'active').length;
    const done = docs.filter(d => d.status === 'done').length;
    const totalAmount = docs.reduce((s, d) => s + (Number(d.amount) || 0), 0);
    const fmt = n => new Intl.NumberFormat('uk-UA').format(Math.round(n));

    document.getElementById('stats').innerHTML = `
      <div class="sc"><div class="scl">Всього документів</div>
        <div class="scv scv-b">${total}</div></div>
      <div class="sc"><div class="scl">Активні</div>
        <div class="scv scv-g">${active}</div></div>
      <div class="sc"><div class="scl">Виконані</div>
        <div class="scv scv-b">${done}</div></div>
      <div class="sc"><div class="scl">Загальна сума</div>
        <div class="scv scv-p" style="font-size:18px">${fmt(totalAmount)} ₴</div></div>`;
  }

  function renderTable() {
    const el = document.getElementById('doc-list');
    const q = (document.getElementById('search').value || '').toLowerCase().trim();
    const ft = document.getElementById('filter-type').value;
    const fs = document.getElementById('filter-status').value;

    let list = db.docs.slice();
    if (q) list = list.filter(d =>
      (d.name||'').toLowerCase().includes(q) ||
      (d.num||'').toLowerCase().includes(q) ||
      (d.counter||'').toLowerCase().includes(q) ||
      (d.edrpou||'').toLowerCase().includes(q)
    );
    if (ft) list = list.filter(d => d.type === ft);
    if (fs) list = list.filter(d => d.status === fs);

    list.sort((a,b) => (b.date||'').localeCompare(a.date||''));

    document.getElementById('doc-count').textContent = list.length;

    if (!list.length) {
      el.innerHTML = '<div class="tm">' + (q || ft || fs ? 'Нічого не знайдено' : 'Документів ще немає. Додайте перший.') + '</div>';
      return;
    }

    const emps = getEmployees();
    const empMap = {};
    emps.forEach(e => empMap[e.id] = e.fullName);

    let html = '<table class="dt"><thead><tr>' +
      '<th>Документ</th><th>Тип</th><th>Дата</th><th>Контрагент</th>' +
      '<th>Сума</th><th>Статус</th><th>Відповідальний</th><th></th>' +
      '</tr></thead><tbody>';

    list.forEach(d => {
      const tp = TYPES[d.type] || TYPES.other;
      const st = STATUSES[d.status] || STATUSES.active;
      const emp = d.employeeId ? (empMap[d.employeeId] || '—') : '—';
      const amount = Number(d.amount) || 0;

      html += `<tr>
        <td><b>${d.name}</b>${d.num ? '<div class="tsm tmu tmn">№ ' + d.num + '</div>' : ''}</td>
        <td>${tp.icon} ${tp.name}</td>
        <td>${d.date ? d.date.split('-').reverse().join('.') : '—'}</td>
        <td>${d.counter || '—'}${d.edrpou ? '<div class="tsm tmu tmn">' + d.edrpou + '</div>' : ''}</td>
        <td class="amount">${amount ? new Intl.NumberFormat('uk-UA').format(amount) + ' ₴' : '—'}</td>
        <td><span class="bg ${st.cls}">${st.icon} ${st.name}</span></td>
        <td>${emp}</td>
        <td style="text-align:right;white-space:nowrap">
          <button class="btn bs bxs" onclick="Doc.openDetail('${d.id}')">👁</button>
          <button class="btn bs bxs" onclick="Doc.edit('${d.id}')">✏️</button>
          <button class="btn bd bxs" onclick="Doc.del('${d.id}')">×</button>
        </td></tr>`;
    });

    html += '</tbody></table>';
    el.innerHTML = html;
  }

  function filter() { renderTable(); }

  function openDetail(id) {
    const d = db.docs.find(x => x.id === id);
    if (!d) return;
    const tp = TYPES[d.type] || TYPES.other;
    const st = STATUSES[d.status] || STATUSES.active;
    const emps = getEmployees();
    const emp = d.employeeId ? (emps.find(e => e.id === d.employeeId) || {}).fullName : null;
    const fmt = n => new Intl.NumberFormat('uk-UA', {minimumFractionDigits:2}).format(n || 0);

    document.getElementById('detail-title').textContent = tp.icon + ' ' + d.name;

    const row = (lbl, val) => `<div class="detail-row"><div class="lbl">${lbl}</div><div class="val">${val || '—'}</div></div>`;

    const linkHtml = d.link
      ? `<a href="${d.link}" target="_blank" rel="noopener" style="color:var(--primary);text-decoration:none">🔗 Відкрити файл</a>`
      : '—';

    document.getElementById('detail-body').innerHTML = `
      ${row('Тип', tp.name)}
      ${row('Номер', d.num)}
      ${row('Дата', d.date ? d.date.split('-').reverse().join('.') : '')}
      ${row('Діє до', d.until ? d.until.split('-').reverse().join('.') : '')}
      ${row('Сума', d.amount ? fmt(d.amount) + ' ₴' : '')}
      ${row('Контрагент', d.counter)}
      ${row('ЄДРПОУ', d.edrpou)}
      ${row('Статус', '<span class="bg ' + st.cls + '">' + st.icon + ' ' + st.name + '</span>')}
      ${row('Відповідальний', emp)}
      ${row('Файл', linkHtml)}
      ${row('Примітки', d.notes)}
      ${row('Додано', d.createdAt ? d.createdAt.split('-').reverse().join('.') : '')}
      ${row('Оновлено', d.updatedAt ? d.updatedAt.split('-').reverse().join('.') : '')}
      <div class="fg" style="margin-top:20px">
        <button class="btn bp" onclick="Doc.closeDetail();Doc.edit('${d.id}')">✏️ Редагувати</button>
        <button class="btn bs" onclick="Doc.printDetail('${d.id}')">🖨️ Друкувати</button>
      </div>
    `;

    document.getElementById('detail-modal').classList.add('open');
  }

  function closeDetail() {
    document.getElementById('detail-modal').classList.remove('open');
  }

  function printDetail(id) {
    const d = db.docs.find(x => x.id === id);
    if (!d) return;
    const tp = TYPES[d.type] || TYPES.other;
    const st = STATUSES[d.status] || STATUSES.active;
    const emps = getEmployees();
    const emp = d.employeeId ? (emps.find(e => e.id === d.employeeId) || {}).fullName : '—';
    const hr = JSON.parse(localStorage.getItem(HR_KEY) || '{}');
    const co = hr.company || {};
    const fmt = n => new Intl.NumberFormat('uk-UA', {minimumFractionDigits:2}).format(n || 0);

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${d.name}</title>
    <style>
      body{font-family:'Times New Roman',serif;padding:40px;max-width:750px;margin:0 auto;color:#000;font-size:13pt}
      .hdr{text-align:center;margin-bottom:20px;font-size:11pt;color:#666}
      h1{font-size:16pt;border-bottom:2px solid #1e40af;padding-bottom:10px;color:#1e3a8a;text-align:center}
      table{width:100%;border-collapse:collapse;margin-top:20px;font-size:12pt}
      td{padding:10px 12px;border-bottom:1px solid #ddd;vertical-align:top}
      td:first-child{color:#555;width:40%;font-weight:500}
      td:last-child{font-weight:600}
      .foot{margin-top:40px;padding-top:20px;border-top:1px solid #ddd;font-size:10pt;color:#888;text-align:center}
      .sign{margin-top:60px;display:flex;justify-content:space-between}
      .sign div{border-top:1px solid #333;padding-top:5px;width:220px;text-align:center;font-size:11pt}
      @media print{body{padding:20px}}
    </style></head><body>
    <div class="hdr">${co.name || 'NEXUS ENGENEERING'}${co.edrpou ? ' · ЄДРПОУ ' + co.edrpou : ''}</div>
    <h1>${tp.icon} ${d.name}</h1>
    <table>
      <tr><td>Тип документу</td><td>${tp.name}</td></tr>
      <tr><td>Номер</td><td>${d.num || '—'}</td></tr>
      <tr><td>Дата</td><td>${d.date ? d.date.split('-').reverse().join('.') : '—'}</td></tr>
      <tr><td>Діє до</td><td>${d.until ? d.until.split('-').reverse().join('.') : '—'}</td></tr>
      <tr><td>Сума</td><td>${d.amount ? fmt(d.amount) + ' ₴' : '—'}</td></tr>
      <tr><td>Контрагент</td><td>${d.counter || '—'}</td></tr>
      <tr><td>ЄДРПОУ контрагента</td><td>${d.edrpou || '—'}</td></tr>
      <tr><td>Статус</td><td>${st.name}</td></tr>
      <tr><td>Відповідальний</td><td>${emp}</td></tr>
      <tr><td>Примітки</td><td>${d.notes || '—'}</td></tr>
    </table>
    <div class="sign">
      <div>Підпис відповідальної особи</div>
      <div>${co.director || 'Підпис керівника'}</div>
    </div>
    <div class="foot">Документ сформовано ${new Date().toLocaleString('uk-UA')} · NEXUS ENGENEERING</div>
    <script>setTimeout(function(){window.print()},300)<\/script>
    </body></html>`;

    const w = window.open('', '_blank', 'width=900,height=1000');
    w.document.write(html);
    w.document.close();
  }

  function exportExcel() {
    if (!db.docs.length) { alert('Немає даних'); return; }
    const emps = getEmployees();
    const empMap = {};
    emps.forEach(e => empMap[e.id] = e.fullName);

    const data = [
      ['Назва','Тип','Номер','Дата','Діє до','Сума','Контрагент','ЄДРПОУ','Статус','Відповідальний','Посилання','Примітки']
    ];
    db.docs.forEach(d => {
      data.push([
        d.name,
        (TYPES[d.type] || TYPES.other).name,
        d.num || '',
        d.date || '',
        d.until || '',
        Number(d.amount) || 0,
        d.counter || '',
        d.edrpou || '',
        (STATUSES[d.status] || STATUSES.active).name,
        d.employeeId ? (empMap[d.employeeId] || '') : '',
        d.link || '',
        d.notes || ''
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{wch:30},{wch:14},{wch:12},{wch:12},{wch:12},{wch:14},{wch:25},{wch:14},{wch:14},{wch:25},{wch:30},{wch:25}];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Документи');
    XLSX.writeFile(wb, 'documents-' + new Date().toISOString().slice(0,10) + '.xlsx');
  }

  function exportJSON() {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'documents-backup-' + new Date().toISOString().slice(0,10) + '.json';
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
        if (!d.docs) throw new Error('Невірний формат');
        db = d;
        saveDB();
        render();
        alert('✅ Імпортовано: ' + d.docs.length + ' документів');
      } catch(e) { alert('Помилка: ' + e.message); }
    };
    r.readAsText(f);
    ev.target.value = '';
  }

  function clearAll() {
    if (!confirm('Видалити ВСІ документи?')) return;
    if (!confirm('Точно видалити ' + db.docs.length + ' документів?')) return;
    db.docs = [];
    saveDB();
    render();
    alert('🗑️ Документи очищено');
  }

  function init() {
    if (!initAuth()) return;
    initTheme();
    fillEmployeeSelect();
    reset();
    render();
    setInterval(fillEmployeeSelect, 15000);
  }

  return {
    init, save, reset, edit, del, toggleForm, filter,
    openDetail, closeDetail, printDetail,
    exportExcel, exportJSON, importJSON, clearAll,
    logout
  };
})();

window.Doc = Doc;

document.addEventListener('DOMContentLoaded', () => Doc.init());