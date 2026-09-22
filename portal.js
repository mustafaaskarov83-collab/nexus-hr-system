/* ═══════════════════════════════════════════════════════════════════════
   NEXUS ENGENEERING — Логика портала v1.1
   Проверка авторизации + умные редиректы
   ═══════════════════════════════════════════════════════════════════════ */

const Portal = (() => {

  const USERS_KEY = 'nexus_users_v1';
  const SESSION_KEY = 'nexus_session_v1';
  const HR_KEY = 'nexus_hr_ua_v2';
  const INV_KEY = 'nexus_inventory_v1';

  /* --- Кто вошёл (из сессии) --- */
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

  /* --- Кнопка юзера в шапке --- */
  function renderUser() {
    const btn = document.getElementById('portal-user-btn');
    const nameEl = document.getElementById('portal-user-name');
    const roleEl = document.getElementById('portal-user-role');
    const avEl = document.getElementById('portal-user-avatar');
    if (!btn || !nameEl) return;

    const user = getCurrentUser();
    if (!user) {
      nameEl.textContent = 'Увійти';
      roleEl.textContent = 'потрібна авторизація';
      avEl.textContent = '→';
      avEl.style.background = 'linear-gradient(135deg,#ef4444,#dc2626)';
      avEl.style.color = '#fff';
      btn.onclick = () => { location.href = 'hr.html'; };
      return;
    }
    nameEl.textContent = user.fullName || user.username;
    const roleMap = { admin: 'Адміністратор', manager: 'Менеджер', viewer: 'Перегляд' };
    roleEl.textContent = roleMap[user.role] || user.role;
    const initials = (user.fullName || user.username).split(/\s+/).map(w => w[0]).join('').slice(0,2).toUpperCase();
    avEl.textContent = initials;
    avEl.style.background = 'linear-gradient(135deg,#fbbf24,#f59e0b)';
    avEl.style.color = '#78350f';
    btn.onclick = () => { location.href = 'hr.html'; };
  }

  /* --- Часы --- */
  function tickClock() {
    const el = document.getElementById('portal-clock');
    if (!el) return;
    const d = new Date();
    const wd = ['Нд','Пн','Вт','Ср','Чт','Пт','Сб'][d.getDay()];
    const pad = n => String(n).padStart(2, '0');
    el.textContent = `${wd}, ${pad(d.getDate())}.${pad(d.getMonth()+1)}.${d.getFullYear()} · ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  /* --- Приветствие --- */
  function renderGreeting() {
    const el = document.getElementById('portal-greet');
    if (!el) return;
    const h = new Date().getHours();
    let word = 'Доброго дня';
    if (h < 6) word = 'Доброї ночі';
    else if (h < 12) word = 'Доброго ранку';
    else if (h < 18) word = 'Доброго дня';
    else word = 'Доброго вечора';
    const user = getCurrentUser();
    const suffix = user ? ', ' + (user.fullName || user.username).split(' ')[0] : '';
    el.textContent = word + suffix;
  }

  /* --- Мини-статистика --- */
  function renderQuickStats() {
    let employees = 0, onVac = 0, onSick = 0, invTotal = 0, invCost = 0;
    try {
      const db = JSON.parse(localStorage.getItem(HR_KEY) || '{}');
      const emps = db.employees || [];
      employees = emps.length;
      const today = new Date().toISOString().slice(0, 10);
      emps.forEach(e => {
        (e.leaves || []).forEach(l => { if (l.start <= today && l.end >= today) onVac++; });
        (e.sickLeaves || []).forEach(s => { if (s.start <= today && s.end >= today) onSick++; });
      });
    } catch(e){}

    try {
      const inv = JSON.parse(localStorage.getItem(INV_KEY) || '{}');
      const items = inv.items || [];
      invTotal = items.length;
      invCost = items.reduce((s, it) => s + (Number(it.cost) || 0), 0);
    } catch(e){}

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('qs-emp', employees);
    set('qs-vac', onVac);
    set('qs-sick', onSick);
    set('qs-inv', invTotal);

    const fmt = n => new Intl.NumberFormat('uk-UA').format(Math.round(n));
    const costEl = document.getElementById('qs-cost');
    if (costEl) costEl.textContent = fmt(invCost) + ' ₴';
  }

  /* --- Тема --- */
  function initTheme() {
    const KEY = 'nexus_theme_v1';
    let current = localStorage.getItem(KEY) || 'auto';
    document.documentElement.setAttribute('data-theme', current);

    const updateIcon = () => {
      const icons = { light: '☀️', dark: '🌙', auto: '🌗' };
      document.querySelectorAll('.portal-theme-btn').forEach(b => b.textContent = icons[current] || '🌗');
    };
    const MODES = ['light', 'dark', 'auto'];
    document.querySelectorAll('.portal-theme-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = MODES.indexOf(current);
        current = MODES[(idx + 1) % MODES.length];
        document.documentElement.setAttribute('data-theme', current);
        localStorage.setItem(KEY, current);
        updateIcon();
      });
    });
    updateIcon();
  }

  /* --- Редиректы --- */
  function initModuleCards() {
    document.querySelectorAll('.pmodule--soon').forEach(card => {
      card.addEventListener('click', (e) => {
        e.preventDefault();
        const name = card.querySelector('.pmodule__title')?.textContent || 'Модуль';
        alert(`🔧 ${name}\n\nЦей модуль знаходиться у розробці.\nЗ'явиться найближчим часом.`);
      });
    });

    document.querySelectorAll('.pmodule[data-auth="1"]').forEach(card => {
      card.addEventListener('click', (e) => {
        const user = getCurrentUser();
        if (!user) {
          e.preventDefault();
          const target = card.getAttribute('href');
          sessionStorage.setItem('nexus_redirect_after_login', target);
          alert('🔒 Для доступу до модуля потрібно увійти в систему.\n\nПерейдіть на форму входу.');
          location.href = 'hr.html';
        }
      });
    });
  }

  function init() {
    renderGreeting();
    renderUser();
    renderQuickStats();
    initTheme();
    initModuleCards();
    tickClock();
    setInterval(tickClock, 30000);
    setInterval(renderQuickStats, 10000);
  }

  return { init, getCurrentUser };
})();

window.Portal = Portal;

document.addEventListener('DOMContentLoaded', () => Portal.init());