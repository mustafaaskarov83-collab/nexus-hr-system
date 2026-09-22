/* ═══════════════════════════════════════════════════════════════════════
   NEXUS ENGENEERING — Модуль инвентаря v1.0
   ═══════════════════════════════════════════════════════════════════════ */

const Inv = (() => {

  const USERS_KEY = 'nexus_users_v1';
  const SESSION_KEY = 'nexus_session_v1';
  const HR_KEY = 'nexus_hr_ua_v2';
  const INV_KEY = 'nexus_inventory_v1';
  const THEME_KEY = 'nexus_theme_v1';

  let db = loadDB();
  let editingId = null;

  const CATS = {
    tech:      { icon: '💻', name: 'Техніка' },
    furniture: { icon: '🪑', name: 'Меблі' },
    transport: { icon: '🚗', name: 'Транспорт' },
    tool:      { icon: '🔧', name: 'Інструменти' },
    office:    { icon: '📎', name: 'Офісне' },
    other:     { icon: '📦', name: 'Інше' }
  };
  const STATUSES = {
    active:  { icon: '✅', name: 'В експлуатації', cls: 'bg-g' },
    repair:  { icon: '🔧', name: 'На ремонті',      cls: 'bg-o' },
    storage: { icon: '📦', name: 'На складі',       cls: 'bg-b' },
    written: { icon: '❌', name: 'Списано',         cls: 'bg-gr' }
  };

  function loadDB() {
    try {
      const r = localStorage.getItem(INV_KEY);
      if (r) { const p = JSON.parse(r); if (p && p.items) return p; }
    } catch(e){}
    return { items: [], meta: { created: new Date().toISOString().slice(0,10), version: '1.0' } };
  }

  function saveDB() {
    try { localStorage.setItem(INV_KEY, JSON.stringify(db)); } catch(e){}
  }

  /* --- Авторизация --- */
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
      const db = JSON.parse(localStorage.getItem(HR_KEY) || '{}');
      return (db.employees || []).slice().sort((a,b) => (a.fullName||'').localeCompare(b.fullName||''));
    } catch(e) { return []; }
  }

  function initAuth() {
    const user = getCurrentUser();
    const auth = document.getElementById('auth-ov');
    const app = document.getElementById('app');

    if (!user) {
      auth.classList.remove('hidden');
      app.classList.remove('vis');
      return false;
    }

    auth.classList.add('hidden');
    app.classList.add('vis');

    // Кнопка юзера в шапке
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

  /* --- Тема --- */
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

  /* --- Заполнить select сотрудников --- */
  function fillEmployeeSelect() {
    const sel = document.getElementById('f-emp');
    if (!sel) return;
    const current = sel.value;
    const emps = getEmployees();
    sel.innerHTML = '<option value="">— не закріплено —</option>' +
      emps.map(e => `<option value="${e.id}">${e.fullName}</option>`).join('');
    if (current) sel.value = current;
  }

  /* --- Форма --- */
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
    ['f-name','f-inv','f-model','f-serial','f-loc','f-notes'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    const cost = document.getElementById('f-cost'); if (cost) cost.value = 0;
    const date = document.getElementById('f-date'); if (date) date.value = '';
    const cat = document.getElementById('f-cat'); if (cat) cat.value = 'tech';
    const status = document.getElementById('f-status'); if (status) status.value = 'active';
    const emp = document.getElementById('f-emp'); if (emp) emp.value = '';
    document.getElementById('form-title').textContent = 'Додати предмет';
    document.getElementById('btn-save').textContent = 'Додати предмет';
    document.getElementById('btn-reset').style.display = 'none';
  }

  function save() {
    const name = document.getElementById('f-name').value.trim();
    if (!name) { alert('Вкажіть назву предмета'); return; }

    const item = {
      id: editingId || 'inv_' + Math.random().toString(36).slice(2,10) + Date.now().toString(36),
      name,
      category: document.getElementById('f-cat').value,
      inv: document.getElementById('f-inv').value.trim(),
      model: document.getElementById('f-model').value.trim(),
      serial: document.getElementById('f-serial').value.trim(),
      cost: Number(document.getElementById('f-cost').value) || 0,
      date: document.getElementById('f-date').value,
      status: document.getElementById('f-status').value,
      employeeId: document.getElementById('f-emp').value,
      location: document.getElementById('f-loc').value.trim(),
      notes: document.getElementById('f-notes').value.trim(),
      updatedAt: new Date().toISOString().slice(0,10)
    };

    if (editingId) {
      const idx = db.items.findIndex(x => x.id === editingId);
      if (idx >= 0) db.items[idx] = item;
      alert('✅ Предмет оновлено');
    } else {
      item.createdAt = new Date().toISOString().slice(0,10);
      db.items.push(item);
      alert('✅ Предмет додано');
    }

    saveDB();
    reset();
    render();
  }

  function edit(id) {
    const item = db.items.find(x => x.id === id);
    if (!item) return;
    editingId = id;

    document.getElementById('f-name').value = item.name || '';
    document.getElementById('f-cat').value = item.category || 'tech';
    document.getElementById('f-inv').value = item.inv || '';
    document.getElementById('f-model').value = item.model || '';
    document.getElementById('f-serial').value = item.serial || '';
    document.getElementById('f-cost').value = item.cost || 0;
    document.getElementById('f-date').value = item.date || '';
    document.getElementById('f-status').value = item.status || 'active';
    document.getElementById('f-emp').value = item.employeeId || '';
    document.getElementById('f-loc').value = item.location || '';
    document.getElementById('f-notes').value = item.notes || '';

    document.getElementById('form-title').textContent = 'Редагувати предмет';
    document.getElementById('btn-save').textContent = 'Зберегти зміни';
    document.getElementById('btn-reset').style.display = '';
    document.getElementById('form-body').style.display = '';

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function del(id) {
    const item = db.items.find(x => x.id === id);
    if (!item) return;
    if (!confirm('Видалити «' + item.name + '»?')) return;
    db.items = db.items.filter(x => x.id !== id);
    saveDB();
    render();
  }

  /* --- Рендер списка --- */
  function render() {
    renderStats();
    renderTable();
  }

  function renderStats() {
    const items = db.items;
    const total = items.length;
    const active = items.filter(i => i.status === 'active').length;
    const repair = items.filter(i => i.status === 'repair').length;
    const cost = items.reduce((s, i) => s + (Number(i.cost) || 0), 0);
    const fmt = n => new Intl.NumberFormat('uk-UA').format(Math.round(n));

    document.getElementById('stats').innerHTML = `
      <div class="sc"><div class="scl">Всього одиниць</div>
        <div class="scv scv-b">${total}</div></div>
      <div class="sc"><div class="scl">В експлуатації</div>
        <div class="scv scv-g">${active}</div></div>
      <div class="sc"><div class="scl">На ремонті</div>
        <div class="scv scv-o">${repair}</div></div>
      <div class="sc"><div class="scl">Загальна вартість</div>
        <div class="scv scv-b" style="font-size:18px">${fmt(cost)} ₴</div></div>`;
  }

  function renderTable() {
    const el = document.getElementById('inv-list');
    const q = (document.getElementById('search').value || '').toLowerCase().trim();
    const fc = document.getElementById('filter-cat').value;
    const fs = document.getElementById('filter-status').value;

    let list = db.items.slice();
    if (q) list = list.filter(i =>
      (i.name||'').toLowerCase().includes(q) ||
      (i.inv||'').toLowerCase().includes(q) ||
      (i.serial||'').toLowerCase().includes(q) ||
      (i.model||'').toLowerCase().includes(q)
    );
    if (fc) list = list.filter(i => i.category === fc);
    if (fs) list = list.filter(i => i.status === fs);

    list.sort((a,b) => (a.name||'').localeCompare(b.name||''));

    document.getElementById('inv-count').textContent = list.length;

    if (!list.length) {
      el.innerHTML = '<div class="tm">' + (q || fc || fs ? 'Нічого не знайдено' : 'Інвентар порожній. Додайте перший предмет.') + '</div>';
      return;
    }

    const emps = getEmployees();
    const empMap = {};
    emps.forEach(e => empMap[e.id] = e.fullName);

    let html = '<table class="dt"><thead><tr>' +
      '<th>Назва</th><th>Категорія</th><th>Інв. №</th><th>Закріплено за</th>' +
      '<th>Статус</th><th>Вартість</th><th></th>' +
      '</tr></thead><tbody>';

    list.forEach(it => {
      const cat = CATS[it.category] || CATS.other;
      const st = STATUSES[it.status] || STATUSES.active;
      const emp = it.employeeId ? (empMap[it.employeeId] || '—') : '—';
      const cost = Number(it.cost) || 0;

      html += `<tr>
        <td><b>${it.name}</b>${it.model ? '<div class="tsm tmu">' + it.model + '</div>' : ''}</td>
        <td>${cat.icon} ${cat.name}</td>
        <td class="tmn">${it.inv || '—'}</td>
        <td>${emp}</td>
        <td><span class="bg ${st.cls}">${st.icon} ${st.name}</span></td>
        <td class="tmn">${new Intl.NumberFormat('uk-UA').format(cost)} ₴</td>
        <td style="text-align:right;white-space:nowrap">
          <button class="btn bs bxs" onclick="Inv.openDetail('${it.id}')">👁</button>
          <button class="btn bs bxs" onclick="Inv.edit('${it.id}')">✏️</button>
          <button class="btn bd bxs" onclick="Inv.del('${it.id}')">×</button>
        </td></tr>`;
    });

    html += '</tbody></table>';
    el.innerHTML = html;
  }

  function filter() { renderTable(); }

  /* --- Детали --- */
  function openDetail(id) {
    const it = db.items.find(x => x.id === id);
    if (!it) return;
    const cat = CATS[it.category] || CATS.other;
    const st = STATUSES[it.status] || STATUSES.active;
    const emps = getEmployees();
    const emp = it.employeeId ? (emps.find(e => e.id === it.employeeId) || {}).fullName : null;
    const fmt = n => new Intl.NumberFormat('uk-UA', {minimumFractionDigits:2}).format(n || 0);

    document.getElementById('detail-title').textContent = cat.icon + ' ' + it.name;

    const row = (lbl, val) => `<div class="detail-row"><div class="lbl">${lbl}</div><div class="val">${val || '—'}</div></div>`;

    document.getElementById('detail-body').innerHTML = `
      ${row('Категорія', cat.name)}
      ${row('Інвентарний №', it.inv)}
      ${row('Модель', it.model)}
      ${row('Серійний номер', it.serial)}
      ${row('Вартість', fmt(it.cost) + ' ₴')}
      ${row('Дата придбання', it.date ? it.date.split('-').reverse().join('.') : '')}
      ${row('Статус', '<span class="bg ' + st.cls + '">' + st.icon + ' ' + st.name + '</span>')}
      ${row('Закріплено за', emp)}
      ${row('Місцезнаходження', it.location)}
      ${row('Примітки', it.notes)}
      ${row('Додано', it.createdAt ? it.createdAt.split('-').reverse().join('.') : '')}
      ${row('Оновлено', it.updatedAt ? it.updatedAt.split('-').reverse().join('.') : '')}
      <div class="fg mt-16" style="margin-top:20px">
        <button class="btn bp" onclick="Inv.closeDetail();Inv.edit('${it.id}')">✏️ Редагувати</button>
        <button class="btn bs" onclick="Inv.printDetail('${it.id}')">🖨️ Друкувати</button>
      </div>
    `;

    document.getElementById('detail-modal').classList.add('open');
  }

  function closeDetail() {
    document.getElementById('detail-modal').classList.remove('open');
  }

  function printDetail(id) {
    const it = db.items.find(x => x.id === id);
    if (!it) return;
    const cat = CATS[it.category] || CATS.other;
    const st = STATUSES[it.status] || STATUSES.active;
    const emps = getEmployees();
    const emp = it.employeeId ? (emps.find(e => e.id === it.employeeId) || {}).fullName : '—';
    const hr = JSON.parse(localStorage.getItem(HR_KEY) || '{}');
    const co = hr.company || {};
    const fmt = n => new Intl.NumberFormat('uk-UA', {minimumFractionDigits:2}).format(n || 0);

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${it.name}</title>
    <style>
      body{font-family:Arial,sans-serif;padding:40px;max-width:750px;margin:0 auto;color:#111}
      h1{font-size:18px;border-bottom:2px solid #1e40af;padding-bottom:10px;color:#1e3a8a}
      .hdr{text-align:center;margin-bottom:20px;font-size:11px;color:#666}
      table{width:100%;border-collapse:collapse;margin-top:15px;font-size:13px}
      td{padding:8px 12px;border-bottom:1px solid #ddd}
      td:first-child{color:#666;width:40%}
      td:last-child{font-weight:600}
      .foot{margin-top:40px;padding-top:20px;border-top:1px solid #ddd;font-size:11px;color:#888;text-align:center}
      .sign{margin-top:60px;display:flex;justify-content:space-between}
      .sign div{border-top:1px solid #333;padding-top:5px;width:200px;text-align:center;font-size:12px}
      @media print{body{padding:20px}}
    </style></head><body>
    <div class="hdr">${co.name || 'NEXUS ENGENEERING'}${co.edrpou ? ' · ЄДРПОУ ' + co.edrpou : ''}</div>
    <h1>Картка предмета інвентарю</h1>
    <table>
      <tr><td>Назва</td><td>${it.name}</td></tr>
      <tr><td>Категорія</td><td>${cat.icon} ${cat.name}</td></tr>
      <tr><td>Інвентарний №</td><td>${it.inv || '—'}</td></tr>
      <tr><td>Модель</td><td>${it.model || '—'}</td></tr>
      <tr><td>Серійний номер</td><td>${it.serial || '—'}</td></tr>
      <tr><td>Вартість</td><td>${fmt(it.cost)} ₴</td></tr>
      <tr><td>Дата придбання</td><td>${it.date ? it.date.split('-').reverse().join('.') : '—'}</td></tr>
      <tr><td>Статус</td><td>${st.name}</td></tr>
      <tr><td>Закріплено за</td><td>${emp}</td></tr>
      <tr><td>Місцезнаходження</td><td>${it.location || '—'}</td></tr>
      <tr><td>Примітки</td><td>${it.notes || '—'}</td></tr>
    </table>
    <div class="sign">
      <div>Відповідальна особа</div>
      <div>Отримувач</div>
    </div>
    <div class="foot">Документ сформовано ${new Date().toLocaleString('uk-UA')} · NEXUS ENGENEERING</div>
    <script>setTimeout(function(){window.print()},300)<\/script>
    </body></html>`;

    const w = window.open('', '_blank', 'width=900,height=1000');
    w.document.write(html);
    w.document.close();
  }

  /* --- Экспорт / Импорт --- */
  function exportExcel() {
    if (!db.items.length) { alert('Немає даних'); return; }
    const emps = getEmployees();
    const empMap = {};
    emps.forEach(e => empMap[e.id] = e.fullName);

    const data = [
      ['Назва','Категорія','Інв. №','Модель','Серійний','Вартість','Дата придбання','Статус','Закріплено за','Місцезнаходження','Примітки']
    ];
    db.items.forEach(it => {
      data.push([
        it.name,
        (CATS[it.category] || CATS.other).name,
        it.inv || '',
        it.model || '',
        it.serial || '',
        Number(it.cost) || 0,
        it.date || '',
        (STATUSES[it.status] || STATUSES.active).name,
        it.employeeId ? (empMap[it.employeeId] || '') : '',
        it.location || '',
        it.notes || ''
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{wch:30},{wch:15},{wch:12},{wch:20},{wch:18},{wch:14},{wch:14},{wch:18},{wch:25},{wch:18},{wch:25}];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Інвентар');
    XLSX.writeFile(wb, 'inventory-' + new Date().toISOString().slice(0,10) + '.xlsx');
  }

  function exportJSON() {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'inventory-backup-' + new Date().toISOString().slice(0,10) + '.json';
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
        if (!d.items) throw new Error('Невірний формат');
        db = d;
        saveDB();
        render();
        alert('✅ Імпортовано: ' + d.items.length + ' предметів');
      } catch(e) { alert('Помилка: ' + e.message); }
    };
    r.readAsText(f);
    ev.target.value = '';
  }

  function clearAll() {
    if (!confirm('Видалити ВЕСЬ інвентар? Цю дію неможливо скасувати.')) return;
    if (!confirm('Точно видалити всі ' + db.items.length + ' предметів?')) return;
    db.items = [];
    saveDB();
    render();
    alert('🗑️ Інвентар очищено');
  }

  /* --- Инициализация --- */
  function init() {
    if (!initAuth()) return;

    initTheme();
    fillEmployeeSelect();
    render();

    // Обновление списка сотрудников каждые 15 секунд
    setInterval(fillEmployeeSelect, 15000);
  }

  return {
    init, save, reset, edit, del, toggleForm, filter,
    openDetail, closeDetail, printDetail,
    exportExcel, exportJSON, importJSON, clearAll,
    logout
  };
})();

window.Inv = Inv;

document.addEventListener('DOMContentLoaded', () => Inv.init());