// ============================================================================
// DAILY DISH — API Client & Auth Helpers  (api.js)
// Uses sessionStorage so each browser TAB is its own independent user session.
// This means buyer in Tab 1, seller in Tab 2 — both fully logged in at once.
// ============================================================================

const API_BASE = '/api';

// ── Per-tab token/user (sessionStorage = isolated per tab) ────────────────────
function getToken()    { return sessionStorage.getItem('dd_token'); }
function setToken(t)   { sessionStorage.setItem('dd_token', t); }
function removeToken() { sessionStorage.removeItem('dd_token'); }

function getUser()  {
  try { return JSON.parse(sessionStorage.getItem('dd_user')); } catch { return null; }
}
function setUser(u)    { sessionStorage.setItem('dd_user', JSON.stringify(u)); }
function removeUser()  { sessionStorage.removeItem('dd_user'); }

function isLoggedIn()  { return !!getToken() && !!getUser(); }
function isRole(r)     { const u = getUser(); return u && u.role === r; }

function logout() {
  removeToken();
  removeUser();
  window.location.href = '/login.html';
}

// ── Fetch wrapper ──────────────────────────────────────────────────────────────
async function apiFetch(endpoint, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (options.body instanceof FormData) delete headers['Content-Type'];

  const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
}

// ── Auth guards ────────────────────────────────────────────────────────────────
function requireAuth(role) {
  if (!isLoggedIn()) { window.location.href = '/login.html'; return false; }
  if (role && !isRole(role)) { window.location.href = '/login.html'; return false; }
  return true;
}

function redirectIfLoggedIn() {
  if (!isLoggedIn()) return;
  window.location.href = isRole('seller') ? '/seller_dashboard.html' : '/buyer_dashboard.html';
}

// ── Toast notifications ────────────────────────────────────────────────────────
function showToast(message, type = 'success') {
  const existing = document.getElementById('dd-toast');
  if (existing) existing.remove();
  const bg = type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#f59e0b';
  const toast = document.createElement('div');
  toast.id = 'dd-toast';
  toast.style.cssText = `
    position:fixed;bottom:24px;right:24px;z-index:9999;
    padding:14px 22px;border-radius:12px;font-weight:600;font-size:0.9rem;
    box-shadow:0 8px 30px rgba(0,0,0,0.15);background:${bg};
    color:#fff;transform:translateY(20px);opacity:0;
    transition:all 0.3s ease;font-family:'Quicksand',sans-serif;max-width:360px;
    display:flex;align-items:center;gap:10px;
  `;
  toast.innerHTML = `<span>${message}</span>`;
  document.body.appendChild(toast);
  requestAnimationFrame(() => { toast.style.transform = 'translateY(0)'; toast.style.opacity = '1'; });
  setTimeout(() => {
    toast.style.transform = 'translateY(20px)';
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ── DOM-ready wiring ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const user = getUser();
  document.querySelectorAll('[data-user-name]').forEach(el => {
    el.textContent = user ? user.name : '';
  });
  document.querySelectorAll('[data-logout-btn]').forEach(el => {
    el.addEventListener('click', e => { e.preventDefault(); logout(); });
  });
});
