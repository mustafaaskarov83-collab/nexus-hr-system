/* ═══════════════════════════════════════════════════════════════════════
   NEXUS ENGENEERING — Модуль календаря відпусток (v3.5)
   Залежить від: app.js (використовує tISO, fD, today, Auth)
   ═══════════════════════════════════════════════════════════════════════ */

const Cal = (() => {
  const STORAGE = 'nexus_hr_ua_v2';
  let viewYear, viewMonth;

  const CAL_LANG = {
    uk: { title:'Календар відпусток', sub:'Візуальна сітка на місяць', today:'Сьогодні',
          emp:'Співробітник', noEmp:'Немає співробітників', months:['Січень','Лютий','Березень','Квітень','Травень','Червень','Липень','Серпень','Вересень','Жовтень','Листопад','Грудень'],
          wd:['Пн','Вт','Ср','Чт','Пт','Сб','Нд'] },
    ru: { title:'Календарь отпусков', sub:'Визуальная сетка на месяц', today:'Сегодня',
          emp:'Сотрудник', noEmp:'Нет сотрудников', months:['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'],
          wd:['Пн','Вт','Ср','Чт','Пт','Сб','Вс'] },
    tr: { title:'İzin Takvimi', sub:'Aylık görsel ızgara', today:'Bugün',
          emp:'Çalışan', noEmp:'Çalışan yok', months:['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'],
          wd:['Pzt','Sal','Çar','Per','Cum','Cmt','Paz'] }
  };

  function calT(key) {
    const cl = localStorage.getItem('nexus_lang_v1') || 'uk';
    const dict = CAL_LANG[cl] || CAL_LANG.uk;
    return dict[key] !== undefined ? dict[key] : (CAL_LANG.uk[key] || key);
  }

  function loadDB() {
    try {
      const raw = localStorage.getItem(STORAGE);
      if (raw) { const p = JSON.parse(raw); if (p && p.employees) return p; }
    } catch(e){}
    return { employees: [], holidays: [], useHolidays: false };
  }

  function injectStyles() {
    if (document.getElementById('cal-styles')) return;
    const s = document.createElement('style');
    s.id = 'cal-styles';
    s.textContent = `
      .cal-wrap { overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 8px; }
      .cal-tbl { border-collapse: collapse; font-size: 12px; width: 100%; }
      .cal-tbl th, .cal-tbl td { border: 1px solid #e2e8f0; padding: 4px 6px; text-align: center; white-space: nowrap; }
      .cal-tbl th { background: #f8fafc; font-weight: 600; color: #64748b; font-size: 11px; }
      .cal-emp-h { text-align: left !important; min-width: 200px; }
      .cal-emp { text-align: left !important; background: #f8fafc; font-weight: 500;
        position: sticky; left: 0; z-index: 2; border-right: 2px solid #cbd5e1 !important; }
      .cal-cell { min-width: 28px; height: 28px; font-size: 11px; }
      .cal-vac { background: #10b981 !important; color: #fff; font-weight: 700; }
      .cal-sick { background: #3b82f6 !important; color: #fff; font-weight: 700; }
      .cal-hol { background: #fde68a !important; color: #78350f; }
      .cal-wk { background: #f1f5f9; }
      .cal-today { box-shadow: inset 0 0 0 2px #f59e0b; }
      .cal-today-h { background: #fef3c7 !important; color: #78350f !important; }
    `;
    document.head.appendChild(s);
  }

  function prev() { viewMonth--; if (viewMonth < 0) { viewMonth = 11; viewYear--; } render(); }
  function next() { viewMonth++; if (viewMonth > 11) { viewMonth = 0; viewYear++; } render(); }
  function goToday() {
    const n = new Date();
    viewYear = n.getFullYear();
    viewMonth = n.getMonth();
    render();
  }

  function render() {
    const grid = document.getElementById('cal-grid');
    if (!grid) return;

    // Локализация элементов управления
    const t1 = document.getElementById('t-cal');
    const t2 = document.getElementById('t-cal-sub');
    const tb = document.getElementById('cal-today-btn');
    if (t1) t1.textContent = calT('title');
    if (t2) t2.textContent = calT('sub');
    if (tb) tb.textContent = calT('today');

    const months = calT('months');
    const wd = calT('wd');
    const period = document.getElementById('cal-period');
    if (period) period.textContent = months[viewMonth] + ' ' + viewYear;

    const db = loadDB();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const todayStr = today();

    // Заголовок таблицы
    let html = '<div class="cal-wrap"><table class="cal-tbl"><thead><tr>';
    html += '<th class="cal-emp-h">' + calT('emp') + '</th>';
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(viewYear, viewMonth, d);
      const dow = (date.getDay() + 6) % 7;
      const dateStr = tISO(date);
      const isWk = dow >= 5;
      const isToday = dateStr === todayStr;
      const isHol = db.useHolidays && (db.holidays || []).includes(dateStr.slice(5));
      const classes = [];
      if (isToday) classes.push('cal-today-h');
      else if (isHol) classes.push('cal-hol');
      else if (isWk) classes.push('cal-wk');
      html += '<th class="' + classes.join(' ') + '">' + d +
              '<br><span style="font-weight:400;font-size:10px;opacity:.7">' + wd[dow] + '</span></th>';
    }
    html += '</tr></thead><tbody>';

    // Строки сотрудников
    const emps = (db.employees || []).slice().sort((a,b) => a.fullName.localeCompare(b.fullName));
    if (!emps.length) {
      html += '<tr><td class="cal-emp">' + calT('noEmp') + '</td>';
      html += '<td colspan="' + daysInMonth + '" style="padding:20px;color:#64748b;font-style:italic">—</td></tr>';
    } else {
      emps.forEach(e => {
        html += '<tr><td class="cal-emp">' + e.fullName + '</td>';
        for (let d = 1; d <= daysInMonth; d++) {
          const date = new Date(viewYear, viewMonth, d);
          const dateStr = tISO(date);
          const dow = (date.getDay() + 6) % 7;
          const isWk = dow >= 5;
          const isToday = dateStr === todayStr;
          const isHol = db.useHolidays && (db.holidays || []).includes(dateStr.slice(5));

          const onVac = (e.leaves || []).some(l => l.start <= dateStr && l.end >= dateStr);
          const onSick = (e.sickLeaves || []).some(s => s.start <= dateStr && s.end >= dateStr);

          const classes = ['cal-cell'];
          let symbol = '';
          if (onVac) { classes.push('cal-vac'); symbol = 'В'; }
          else if (onSick) { classes.push('cal-sick'); symbol = 'Л'; }
          else if (isHol) { classes.push('cal-hol'); }
          else if (isWk) { classes.push('cal-wk'); }
          if (isToday) classes.push('cal-today');

          html += '<td class="' + classes.join(' ') + '" title="' + e.fullName + ' · ' + fD(dateStr) + '">' + symbol + '</td>';
        }
        html += '</tr>';
      });
    }
    html += '</tbody></table></div>';
    grid.innerHTML = html;
  }

  function init() {
    const n = new Date();
    viewYear = n.getFullYear();
    viewMonth = n.getMonth();
    injectStyles();

    // Хук на клик по вкладке «Календар»
    document.querySelectorAll('.nb').forEach(btn => {
      if (btn.dataset.tab === 'calendar') {
        btn.addEventListener('click', () => setTimeout(render, 30));
      }
    });

    // Перерисовка при смене языка
    document.querySelectorAll('.lb, .auth-lb').forEach(btn => {
      btn.addEventListener('click', () => setTimeout(render, 30));
    });

    // Начальный рендер (на случай, если календарь — первая вкладка)
    render();
  }

  return { init, prev, next, today: goToday, render };
})();

window.Cal = Cal;

document.addEventListener('DOMContentLoaded', () => {
  try { Cal.init(); } catch(e) { console.error('Cal init error:', e); }
});