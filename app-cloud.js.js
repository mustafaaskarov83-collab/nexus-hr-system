/* ═══════════════════════════════════════════════════════════════════════
   NEXUS ENGENEERING — Модуль синхронизации (v3.7)
   Firebase Firestore, авто-синхронизация, несколько устройств
   ═══════════════════════════════════════════════════════════════════════ */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyB0TV34aolv1WjtZZLfAT_YZZNFHXzHIlQ",
  authDomain: "nexus-hr-d90c0.firebaseapp.com",
  projectId: "nexus-hr-d90c0",
  storageBucket: "nexus-hr-d90c0.firebasestorage.app",
  messagingSenderId: "791658464578",
  appId: "1:791658464578:web:71d6cee1d63895f6de74db"
};

const DB_KEY = 'nexus_hr_ua_v2';
const WS_KEY = 'nexus_cloud_workspace';
const EN_KEY = 'nexus_cloud_enabled';
const SYNC_KEY = 'nexus_cloud_last_sync';
const DEV_KEY = 'nexus_device_name';

let fbApp = null, fbDb = null;
let lastHash = '';
let watchTimer = null;

const Cloud = (() => {

  function hash(str) {
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < str.length; i++) {
      const c = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 2654435761);
      h2 = Math.imul(h2 ^ c, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    return (h1 >>> 0).toString(16);
  }

  function getWorkspaceId() { return localStorage.getItem(WS_KEY) || ''; }
  function isEnabled() { return localStorage.getItem(EN_KEY) === '1' && !!getWorkspaceId(); }
  function getDeviceName() {
    let n = localStorage.getItem(DEV_KEY);
    if (!n) {
      n = 'Пристрій-' + Math.floor(Math.random() * 9000 + 1000);
      localStorage.setItem(DEV_KEY, n);
    }
    return n;
  }

  function getLocalDB() {
    try { const r = localStorage.getItem(DB_KEY); return r ? JSON.parse(r) : null; }
    catch(e) { return null; }
  }
  function setLocalDB(d) {
    try { localStorage.setItem(DB_KEY, JSON.stringify(d)); } catch(e){}
  }

  function ensureInit() {
    if (fbApp) return true;
    try {
      fbApp = initializeApp(FIREBASE_CONFIG);
      fbDb = getFirestore(fbApp);
      console.log('%c Firebase OK ', 'background:#f59e0b;color:#fff;padding:2px 8px;border-radius:4px;font-weight:bold');
      return true;
    } catch(e) {
      console.error('Firebase init error:', e);
      return false;
    }
  }

  function getDocRef() {
    if (!fbDb) return null;
    const ws = getWorkspaceId();
    if (!ws) return null;
    return doc(fbDb, 'nexus_data', ws);
  }

  function genWorkspaceId() {
    const chars = 'abcdefghijkmnpqrstuvwxyz23456789';
    let id = '';
    for (let i = 0; i < 10; i++) id += chars[Math.floor(Math.random() * chars.length)];
    return id;
  }

  async function push(silent) {
    if (!ensureInit()) { if (!silent) alert('Firebase не ініціалізовано'); return false; }
    const ref = getDocRef();
    if (!ref) { if (!silent) alert('Спочатку вкажіть код простору'); return false; }
    const local = getLocalDB();
    if (!local) { if (!silent) alert('Немає локальних даних'); return false; }

    try {
      await setDoc(ref, {
        db: local,
        updatedAt: new Date().toISOString(),
        updatedBy: getDeviceName()
      });
      localStorage.setItem(SYNC_KEY, new Date().toISOString());
      lastHash = hash(JSON.stringify(local));
      updateUI();
      if (!silent) {
        console.log('✅ Pushed to cloud');
        refreshStatus();
      }
      return true;
    } catch(e) {
      console.error('Push error:', e);
      if (!silent) alert('Помилка відправки: ' + e.message);
      return false;
    }
  }

  async function pull(silent) {
    if (!ensureInit()) { if (!silent) alert('Firebase не ініціалізовано'); return false; }
    const ref = getDocRef();
    if (!ref) { if (!silent) alert('Спочатку вкажіть код простору'); return false; }

    try {
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        if (!silent) alert('У хмарі немає даних для цього простору');
        return false;
      }
      const data = snap.data();
      if (!data.db || !data.db.employees) {
        if (!silent) alert('Некоректні дані в хмарі');
        return false;
      }

      if (!silent) {
        const dt = new Date(data.updatedAt).toLocaleString();
        const who = data.updatedBy || 'невідомо';
        if (!confirm('Замінити локальні дані хмарними?\n\nОновлено: ' + dt + '\nВід: ' + who)) return false;
      }

      setLocalDB(data.db);
      localStorage.setItem(SYNC_KEY, new Date().toISOString());
      lastHash = hash(JSON.stringify(data.db));

      if (window.App && App.renderAll) App.renderAll();
      if (window.Cal && Cal.render) Cal.render();

      updateUI();
      if (!silent) {
        alert('✅ Дані завантажено з хмари');
        refreshStatus();
      }
      return true;
    } catch(e) {
      console.error('Pull error:', e);
      if (!silent) alert('Помилка отримання: ' + e.message);
      return false;
    }
  }

  function startWatch() {
    if (watchTimer) clearInterval(watchTimer);
    watchTimer = setInterval(async () => {
      if (!isEnabled()) return;
      const local = getLocalDB();
      if (!local) return;
      const h = hash(JSON.stringify(local));
      if (h !== lastHash) {
        await push(true);
      }
    }, 5000);
  }

  function enable(wsId) {
    if (!wsId || wsId.length < 4) { alert('Код простору мінімум 4 символи'); return false; }
    localStorage.setItem(WS_KEY, wsId);
    localStorage.setItem(EN_KEY, '1');
    lastHash = '';
    startWatch();
    updateUI();
    return true;
  }

  function disable() {
    localStorage.setItem(EN_KEY, '0');
    if (watchTimer) { clearInterval(watchTimer); watchTimer = null; }
    updateUI();
  }

  function updateUI() {
    const enabled = isEnabled();
    document.querySelectorAll('.cloud-btn').forEach(b => {
      b.textContent = enabled ? '☁️' : '☁︎';
      b.title = enabled ? 'Синхронізація увімкнена' : 'Синхронізація вимкнена';
    });
    refreshStatus();
  }

  function refreshStatus() {
    const el = document.getElementById('cloud-status');
    if (!el) return;
    if (!isEnabled()) {
      el.innerHTML = '<span style="color:#94a3b8">● Синхронізація вимкнена</span>';
      return;
    }
    const last = localStorage.getItem(SYNC_KEY);
    if (last) {
      const dt = new Date(last).toLocaleString();
      el.innerHTML = '<span style="color:#10b981">● Синхронізовано</span><br><span class="tsm tmu">Останнє: ' + dt + '</span>';
    } else {
      el.innerHTML = '<span style="color:#f59e0b">● Очікування першої синхронізації</span>';
    }
  }

  function openModal() {
    ensureInit();
    const m = document.getElementById('cloud-modal');
    if (!m) return;
    const enabled = isEnabled();
    const wsId = getWorkspaceId();

    document.getElementById('cloud-mt').textContent = '☁️ Синхронізація з хмарою';
    document.getElementById('cloud-mb').innerHTML = `
      <div id="cloud-status" style="font-size:13px;margin-bottom:16px"></div>

      <div class="ff mb16">
        <label>Код простору <span class="rq">*</span></label>
        <div style="display:flex;gap:8px">
          <input id="cloud-ws" value="${wsId}" placeholder="наприклад: nexus-hr-team" style="flex:1">
          <button class="btn bs bsm" onclick="Cloud.generateWs()" type="button">🎲</button>
        </div>
        <div class="tsm tmu" style="margin-top:4px;font-size:11px">
          Однаковий код на всіх пристроях = спільні дані. Мінімум 4 символи.
        </div>
      </div>

      <div class="fg mb16">
        ${enabled
          ? `<button class="btn bp" onclick="Cloud.disable()" type="button">⏸ Вимкнути</button>
             <button class="btn bs" onclick="Cloud.push(false)" type="button">⬆ Відправити</button>
             <button class="btn bs" onclick="Cloud.pull(false)" type="button">⬇ Отримати</button>`
          : `<button class="btn bp" onclick="Cloud.enableFromInput()" type="button">▶ Увімкнути синхронізацію</button>`
        }
      </div>

      <div class="cc cc-w" style="font-size:12px;margin-top:12px">
        <b>⚠ Увага:</b> код простору — це ключ доступу. Хто знає — бачить ваші дані.
        Не використовуйте простих кодів типу «1234».
      </div>

      <div class="tsm tmu" style="margin-top:12px;font-size:11px">
        💡 Синхронізація запускається автоматично кожні 5 секунд після зміни даних.
      </div>
    `;
    m.classList.add('open');
    refreshStatus();
  }

  function closeModal() {
    const m = document.getElementById('cloud-modal');
    if (m) m.classList.remove('open');
  }

  function generateWs() {
    const inp = document.getElementById('cloud-ws');
    if (inp) inp.value = genWorkspaceId();
  }

  function enableFromInput() {
    const inp = document.getElementById('cloud-ws');
    if (!inp) return;
    const wsId = inp.value.trim();
    if (!enable(wsId)) return;
    setTimeout(async () => {
      await push(true);
      openModal();
    }, 300);
  }

  async function start() {
    ensureInit();
    if (isEnabled()) {
      await pull(true);
      lastHash = hash(JSON.stringify(getLocalDB() || {}));
      startWatch();
    }
    updateUI();
  }

  return {
    push, pull, enable, disable,
    openModal, closeModal, generateWs, enableFromInput,
    start, updateUI,
    get workspace() { return getWorkspaceId(); },
    get enabled() { return isEnabled(); }
  };
})();

window.Cloud = Cloud;

document.addEventListener('DOMContentLoaded', () => {
  try { Cloud.start(); } catch(e) { console.error('Cloud start error:', e); }
});