const DB_STORAGE_KEY = 'master_print_annual_finance_v40_clean';
try {
  ['master_print_annual_finance_v35', 'master_print_annual_finance_v34', 'master_print_annual_finance_v33', 'master_print_annual_finance_v30'].forEach(k => localStorage.removeItem(k));
} catch(e) {}

const DEFAULT_DATA = {
  selectedYear: 2026,
  selectedMonth: new Date().getMonth(),
  cashierPass: "1234",
  staff: [
    { key: "timur", name: "Тимур (директор)", pass: "1234", defaultRate: 10 },
    { key: "zhalgas", name: "Жалгас (дизайнер)", pass: "1234", defaultRate: 10 },
    { key: "abzal", name: "Абзал (мастер сборки)", pass: "1234", defaultRate: 10 },
    { key: "albert", name: "Альберт (печатник)", pass: "1234", defaultRate: 10 },
    { key: "islam", name: "Ислам", pass: "1234", defaultRate: 10 },
    { key: "bexultan", name: "Бексултан", pass: "1234", defaultRate: 10 },
    { key: "aziz", name: "Азиз", pass: "1234", defaultRate: 10 },
    { key: "mahmud", name: "Махмуд", pass: "1234", defaultRate: 10 },
    { key: "adilbek", name: "Адильбек", pass: "1234", defaultRate: 10 }
  ],
  categories: [
    "Обед и питание", "Бумага и фотоматериалы", "ДТФ и печатные материалы", "Производственные материалы", 
    "Рамки, сувениры и заготовки", "Выплаты персоналу", "Авансы и долги сотрудникам", "Подрядчики и услуги", 
    "Транспорт и доставка", "Интернет и связь", "Хозяйственные расходы", "Оборудование и ремонт", 
    "Возвраты клиентам", "Реклама и продвижение", "Аренда и коммунальные", "Налоги и сборы", "Прочее"
  ],
  payments: ["Наличные", "Click", "Payme", "Карта", "Перечисление"],
  responsibles: ["Тимур (директор)", "Жалгас (дизайнер)", "Абзал (мастер сборки)", "Альберт (печатник)", "Ислам", "Бексултан", "Азиз", "Махмуд", "Адильбек"],
  orders: [],
  expenses: [],
  debts: [],
  clients: [],
  checkins: [],
  payrollOverrides: {}
};

const POS_PRESETS = [
  { id: 'copy_a4', icon: '📄', title: 'Ксерокопия А4', price: 1000, category: 'print', type: 'print' },
  { id: 'copy_2side', icon: '🔄', title: 'Двухсторонняя (А4)', price: 1000, category: 'print', type: 'print' },
  { id: 'print_bw_a4', icon: '🖨', title: 'Печать Ч/Б (1 стр)', price: 500, category: 'print', type: 'print' },
  { id: 'print_color_a4', icon: '🎨', title: 'Печать Цветная', price: 1000, category: 'print', type: 'print' },
  { id: 'photo_3x4', icon: '📸', title: 'Фото 3х4', price: 12000, category: 'photo', type: 'print' },
  { id: 'scan_page', icon: '📑', title: 'Сканирование', price: 2000, category: 'print', type: 'print' },
  { id: 'lamination_a4', icon: '📜', title: 'Ламинирование А4', price: 5000, category: 'postpress', type: 'print' },
  { id: 'binding', icon: '📚', title: 'Переплёт / Пружина', price: 15000, category: 'postpress', type: 'print' },
  { id: 'quick_design', icon: '🎨', title: 'Экспресс Дизайн', price: 20000, category: 'design', type: 'design' }
];

const MONTH_NAMES = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];

let state;
let currentUser = { role: 'admin', staffKey: null, name: 'Супер АДМИН' };
let currentRoute = 'dashboard';
let activePosItem = POS_PRESETS[0];
let activePosQty = 1;
let activePosPayment = 'cash';
let activeOrderFilter = 'ALL';

try {
  const raw = localStorage.getItem(DB_STORAGE_KEY);
  state = raw ? JSON.parse(raw) : JSON.parse(JSON.stringify(DEFAULT_DATA));
  if(!state.staff) state.staff = DEFAULT_DATA.staff;
  if(!state.categories) state.categories = DEFAULT_DATA.categories;
  if(!state.orders) state.orders = [];
  if(!state.expenses) state.expenses = [];
  if(!state.debts) state.debts = [];
  if(!state.checkins) state.checkins = [];
  if(!state.payrollOverrides) state.payrollOverrides = {};
} catch(e) {
  state = JSON.parse(JSON.stringify(DEFAULT_DATA));
}

// FORMATTERS
const moneyFormatter = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });
const fmtMoney = v => moneyFormatter.format(Math.round(Number(v) || 0)) + ' сум';
const num = v => Number(v) || 0;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function monthPrefix(y, m) { return `${y}-${String(m+1).padStart(2,'0')}`; }
function daysInMonth(y, m) { return new Date(y, m+1, 0).getDate(); }
function monthDates(y, m) { return Array.from({length: daysInMonth(y, m)}, (_, i) => `${y}-${String(m+1).padStart(2,'0')}-${String(i+1).padStart(2,'0')}`); }

function setCloudStatus(status, text) {
  const chip = document.getElementById('cloudSyncIndicator');
  const dot = document.getElementById('cloudPulseDot');
  const label = document.getElementById('cloudSyncText');
  if (!chip || !dot || !label) return;

  if (status === 'online') {
    chip.style.borderColor = 'rgba(16,185,129,0.3)';
    chip.style.background = 'var(--accent-emerald-subtle)';
    chip.style.color = 'var(--accent-emerald)';
    dot.style.background = 'var(--accent-emerald)';
    label.textContent = text || 'Облако: Синхронизировано';
  } else if (status === 'syncing') {
    chip.style.borderColor = 'rgba(37,99,235,0.3)';
    chip.style.background = 'rgba(37,99,235,0.1)';
    chip.style.color = 'var(--accent-blue)';
    dot.style.background = 'var(--accent-blue)';
    label.textContent = text || 'Облако: Сохранение...';
  } else {
    chip.style.borderColor = 'rgba(245,158,11,0.3)';
    chip.style.background = 'var(--accent-amber-subtle)';
    chip.style.color = 'var(--accent-amber)';
    dot.style.background = 'var(--accent-amber)';
    label.textContent = text || 'Облако: Автономно';
  }
}

let lastLocalEditTimestamp = 0;
let deletedItemIds = new Set();

function saveState() {
  lastLocalEditTimestamp = Date.now();
  localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(state));
  setCloudStatus('syncing', 'Облако: Сохранение...');

  if (typeof fetch !== 'undefined') {
    fetch('https://masterprint-chi.vercel.app/api/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state),
      keepalive: true
    })
    .then(r => r.json())
    .then(res => {
      if (res.success && res.state) {
        let hasNew = false;
        if (Array.isArray(res.state.expenses) && res.state.expenses.length > state.expenses.length) {
          state.expenses = res.state.expenses;
          hasNew = true;
        }
        if (hasNew) {
          localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(state));
          renderAllViews();
        }
        setCloudStatus('online', 'Облако: Синхронизировано');
      }
    })
    .catch(err => {
      console.log('Cloud sync status:', err);
      setCloudStatus('offline', 'Локальный режим');
    });
  }
}

async function syncWithTelegramBot() {
  setCloudStatus('syncing', 'Облако: Обновление...');
  try {
    let url = 'https://masterprint-chi.vercel.app/api/state?t=' + Date.now();
    if (window._lastServerSyncTime) url += '&since=' + window._lastServerSyncTime;
    const res = await fetch(url, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.notModified) {
        setCloudStatus('online', '⚡ Supabase: Онлайн');
        return;
      }
      if (data.success && data.state) {
        if (data.updatedAt) window._lastServerSyncTime = new Date(data.updatedAt).getTime();
        if (Array.isArray(data.state.expenses)) state.expenses = data.state.expenses;
        if (Array.isArray(data.state.orders)) state.orders = data.state.orders;
        if (Array.isArray(data.state.debts)) state.debts = data.state.debts;
        if (Array.isArray(data.state.inventory)) state.inventory = data.state.inventory;
        localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(state));
        renderAllViews();
        setCloudStatus('online', 'Облако: Синхронизировано');
        showToast(`Данные обновлены! Расходов: ${state.expenses.length}, Заказов: ${state.orders.length}`, 'success');
      }
    }
  } catch (e) {
    showToast('Ошибка связи с сервером', 'error');
  }
}

let isSyncingBackend = false;
let lastKnownExpensesCount = 0;

async function loadFromCloudBackend() {
  if (isSyncingBackend) return;
  isSyncingBackend = true;
  try {
    let url = 'https://masterprint-chi.vercel.app/api/state?t=' + Date.now();
    if (window._lastServerSyncTime) url += '&since=' + window._lastServerSyncTime;
    const res = await fetch(url, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.state) {
        let hasChanges = false;
        const now = Date.now();
        const isRecentlyEdited = (now - lastLocalEditTimestamp) < 3500;

        if (!isRecentlyEdited) {
          if (Array.isArray(data.state.expenses) && JSON.stringify(data.state.expenses) !== JSON.stringify(state.expenses)) {
            state.expenses = data.state.expenses;
            hasChanges = true;
          }
          if (Array.isArray(data.state.orders) && JSON.stringify(data.state.orders) !== JSON.stringify(state.orders)) {
            state.orders = data.state.orders;
            hasChanges = true;
          }
          if (Array.isArray(data.state.debts) && JSON.stringify(data.state.debts) !== JSON.stringify(state.debts)) {
            state.debts = data.state.debts;
            hasChanges = true;
          }
          if (Array.isArray(data.state.clients) && JSON.stringify(data.state.clients) !== JSON.stringify(state.clients)) {
            state.clients = data.state.clients;
            hasChanges = true;
          }
          if (Array.isArray(data.state.inventory) && JSON.stringify(data.state.inventory) !== JSON.stringify(state.inventory)) {
            state.inventory = data.state.inventory;
            hasChanges = true;
          }
          if (Array.isArray(data.state.staff) && data.state.staff.length > 0 && JSON.stringify(data.state.staff) !== JSON.stringify(state.staff)) {
            state.staff = data.state.staff;
            hasChanges = true;
          }
        }

        if (hasChanges) {
          localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(state));
          renderAllViews();
        }
        setCloudStatus('online', '⚡ Supabase: Онлайн');
      }
    }
  } catch (e) {
    setCloudStatus('offline', 'Локальный режим');
  } finally {
    isSyncingBackend = false;
  }
}

// Initial sync on boot + live polling every 4 seconds
loadFromCloudBackend();
setInterval(loadFromCloudBackend, 4000);

// Instant sync on visibility change, focus, and network reconnection
document.addEventListener('visibilitychange', () => { if (!document.hidden) loadFromCloudBackend(); });
window.addEventListener('focus', () => loadFromCloudBackend());
window.addEventListener('online', () => loadFromCloudBackend());

function showToast(msg, type = 'info') {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = `<span>⚡</span> <span>${esc(msg)}</span>`;
  c.appendChild(t);
  setTimeout(() => {
    t.style.opacity = '0';
    setTimeout(() => t.remove(), 300);
  }, 3000);
}

// THEME TOGGLE
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const target = current === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', target);
  localStorage.setItem('mp_theme', target);
}
const savedTheme = localStorage.getItem('mp_theme') || 'light';
document.documentElement.setAttribute('data-theme', savedTheme);

// LIVE CLOCK
setInterval(() => {
  const el = document.getElementById('topbarLiveClock');
  if(el) {
    const now = new Date();
    el.textContent = now.toLocaleTimeString('ru-RU');
  }
}, 1000);

// AUTH
function updateLoginForm() {
  const role = document.getElementById('loginRole').value;
  document.getElementById('adminAuthFields').style.display = role === 'admin' ? 'block' : 'none';
  document.getElementById('cashierAuthFields').style.display = role === 'cashier' ? 'block' : 'none';
  document.getElementById('staffAuthFields').style.display = role === 'staff' ? 'block' : 'none';
  if(role === 'staff') {
    document.getElementById('staffLoginSelect').innerHTML = state.staff.map(s => `<option value="${s.key}">${esc(s.name)}</option>`).join('');
  }
}

function handleLogin(e) {
  e.preventDefault();
  const role = document.getElementById('loginRole').value;
  if(role === 'admin') {
    const u = document.getElementById('adminLoginUser').value.trim();
    const p = document.getElementById('adminLoginPass').value;
    if(u === '907059595' && p === '19951717') {
      currentUser = { role: 'admin', staffKey: null, name: 'Супер АДМИН' };
      loginSuccess();
    } else {
      document.getElementById('loginErrorMsg').textContent = 'Неверный логин или пароль администратора';
    }
  } else if(role === 'cashier') {
    const p = document.getElementById('cashierPassField').value;
    if(p === (state.cashierPass || '1234')) {
      currentUser = { role: 'cashier', staffKey: null, name: 'Кассир' };
      loginSuccess();
    } else {
      document.getElementById('loginErrorMsg').textContent = 'Неверный пароль кассира';
    }
  } else {
    const key = document.getElementById('staffLoginSelect').value;
    const p = document.getElementById('staffPassField').value.trim();
    const st = state.staff.find(s => s.key === key);
    const validPasses = [st?.pass, '1234', `${key}2026`].filter(Boolean);
    if(st && validPasses.includes(p)) {
      currentUser = { role: 'staff', staffKey: st.key, name: st.name };
      loginSuccess();
    } else {
      document.getElementById('loginErrorMsg').textContent = 'Неверный пароль сотрудника';
    }
  }
}

function loginSuccess() {
  document.getElementById('loginBackdrop').classList.remove('active');
  document.getElementById('appMain').style.display = 'grid';
  sessionStorage.setItem('mp_auth_session', JSON.stringify(currentUser));
  
  // Setup Role UI
  document.getElementById('sidebarUserName').textContent = currentUser.name;
  document.getElementById('sidebarRoleTag').textContent = currentUser.role === 'admin' ? 'Супер АДМИН' : currentUser.role === 'cashier' ? 'Кассир' : 'Мастер';
  document.getElementById('sidebarAvatar').textContent = currentUser.name.slice(0, 1).toUpperCase();

  if(currentUser.role === 'staff') {
    document.querySelectorAll('.admin-cashier-view, .admin-view').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.staff-view').forEach(el => el.style.display = 'block');
    document.querySelectorAll('.period-badge').forEach(el => el.style.display = 'none');
    
    // Lock POS staff select to logged-in master
    const posStaffEl = document.getElementById('posStaffSelect');
    if (posStaffEl && currentUser.staffKey) {
      posStaffEl.value = currentUser.staffKey;
      posStaffEl.disabled = true;
    }
    navigateTo('portal');
  } else if(currentUser.role === 'cashier') {
    document.querySelectorAll('.admin-view, .staff-view').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.admin-cashier-view').forEach(el => el.style.display = '');
    document.querySelectorAll('.period-badge').forEach(el => el.style.display = '');
    const posStaffEl = document.getElementById('posStaffSelect');
    if (posStaffEl) posStaffEl.disabled = false;
    navigateTo('express-pos');
  } else {
    document.querySelectorAll('.admin-view, .admin-cashier-view').forEach(el => el.style.display = '');
    document.querySelectorAll('.staff-view').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.period-badge').forEach(el => el.style.display = '');
    const posStaffEl = document.getElementById('posStaffSelect');
    if (posStaffEl) posStaffEl.disabled = false;
    navigateTo('dashboard');
  }

  initPeriodControls();
  renderAllViews();
  showToast(`Добро пожаловать, ${currentUser.name}!`, 'success');
}

function logout() {
  sessionStorage.removeItem('mp_auth_session');
  location.reload();
}

// NAVIGATION
const ROUTE_NAMES = {
  'express-pos': ['⚡ Быстрая Касса', 'Экспресс-печать и услуги за 1 секунду'],
  orders: ['📦 CRM Заказов', 'Контроль заказов, дедлайнов и оплат'],
  clients: ['👥 База Клиентов', 'История заказов, LTV выручка и контакты'],
  daily: ['📅 Дневная Касса', 'Онлайн выручка по сотрудникам'],
  monthly: ['📆 Месячная Выручка', 'Сводная аналитика по дням'],
  dashboard: ['📊 Годовая Сводка', 'Финансовые результаты за 12 месяцев'],
  inventory: ['🏭 Склад и Остатки', 'Сырьё, расходные материалы и заготовки'],
  payroll: ['💰 Расчёт Зарплат', '10% от печати + 100% дизайн + бонус 8:30'],
  expenses: ['↘ Расходы и Чеки', 'Помесячный учет затрат'],
  debts: ['◎ Долги Клиентов', 'Авто-синхронизация задолженностей'],
  settings: ['⚙ Настройки', 'Сотрудники, категории и пароли'],
  portal: ['👤 Личный Кабинет', 'Мои начисления и фиксация 8:30']
};

function navigateTo(route) {
  currentRoute = route;
  document.querySelectorAll('.page-view').forEach(p => p.classList.remove('active'));
  const target = document.getElementById('view-' + route);
  if(target) target.classList.add('active');

  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.route === route);
  });

  if(ROUTE_NAMES[route]) {
    document.getElementById('topbarTitle').textContent = ROUTE_NAMES[route][0];
    document.getElementById('topbarSubtitle').textContent = ROUTE_NAMES[route][1];
  }

  if(route === 'express-pos') renderPosStation();
  if(route === 'orders') renderOrdersTable();
  if(route === 'clients') renderClientsView();
  if(route === 'daily') renderDailyView();
  if(route === 'monthly') renderMonthlyTable();
  if(route === 'dashboard') { renderDashboard(); drawAnnualChart(); }
  if(route === 'inventory') renderInventoryView();
  renderAuditLogTable();
  if(route === 'payroll') renderPayrollTable();
  if(route === 'expenses') renderExpensesTable();
  if(route === 'debts') renderDebtsTable();
  if(route === 'settings') renderSettings();
  if(route === 'portal') renderPortalView();
}

function initPeriodControls() {
  const yInput = document.getElementById('globalYear');
  const mSelect = document.getElementById('globalMonth');
  if(yInput) yInput.value = state.selectedYear || 2026;
  if(mSelect) {
    mSelect.innerHTML = MONTH_NAMES.map((name, i) => `<option value="${i}">${name}</option>`).join('');
    mSelect.value = state.selectedMonth !== undefined ? state.selectedMonth : 7;
  }
}

function onPeriodChange() {
  state.selectedYear = num(document.getElementById('globalYear').value) || 2026;
  state.selectedMonth = num(document.getElementById('globalMonth').value) || 0;
  saveState();
  renderAllViews();
}

// METRICS LOGIC
function getDateMetrics(dateStr) {
  const dayOrders = state.orders.filter(o => o.date === dateStr);
  let printRev = 0, designRev = 0, clickRev = 0, cashRev = 0;
  const staffStats = {};
  state.staff.forEach(s => { staffStats[s.key] = { print: 0, design: 0, count: 0 }; });

  dayOrders.forEach(o => {
    const amt = o.advance || o.amount;
    if(staffStats[o.staffKey]) {
      if(o.serviceType === 'design') {
        staffStats[o.staffKey].design += amt;
        designRev += amt;
      } else {
        staffStats[o.staffKey].print += amt;
        printRev += amt;
      }
      staffStats[o.staffKey].count++;
    }
    if(o.paymentType === 'click') clickRev += amt; else cashRev += amt;
  });

  const dayExpenses = state.expenses.filter(e => e.date === dateStr).reduce((sum, e) => sum + num(e.amount), 0);
  const gross = printRev + designRev;
  const netCash = Math.max(0, cashRev - designRev - dayExpenses);

  return { date: dateStr, printRev, designRev, gross, expense: dayExpenses, cashRev, clickRev, netCash, profit: gross - dayExpenses, staffStats };
}

function getMonthMetrics(y, m) {
  const dates = monthDates(y, m);
  let revenue = 0, expense = 0, click = 0;
  dates.forEach(d => {
    const met = getDateMetrics(d);
    revenue += met.gross;
    expense += met.expense;
    click += met.clickRev;
  });
  return { revenue, expense, profit: revenue - expense, click, margin: revenue ? (revenue - expense) / revenue : 0 };
}

function getYearMetrics(y) {
  let revenue = 0, expense = 0;
  const months = [];
  for(let m = 0; m < 12; m++) {
    const mm = getMonthMetrics(y, m);
    months.push(mm);
    revenue += mm.revenue;
    expense += mm.expense;
  }
  const totalDebt = state.debts.reduce((sum, d) => sum + Math.max(num(d.qty) * num(d.price) - num(d.paid), 0), 0);
  return { revenue, expense, profit: revenue - expense, totalDebt, months };
}

// 1. POS STATION
function renderPosStation() {
  document.getElementById('posStaffSelect').innerHTML = state.staff.map(s => `
    <option value="${s.key}" ${currentUser.staffKey === s.key ? 'selected' : ''}>${esc(s.name)}</option>
  `).join('');
  filterPosCategory('all');
  renderRecentPosSales();
}

function filterPosCategory(cat, btn) {
  const chips = document.querySelectorAll('#posCategoryChips .chip');
  if (chips && chips.length) {
    chips.forEach(c => c.classList.remove('active'));
    if (btn) {
      btn.classList.add('active');
    } else {
      chips.forEach(b => {
        const match = (cat === 'all' && b.textContent.includes('Все')) ||
                      (cat === 'print' && b.textContent.includes('Печать')) ||
                      (cat === 'photo' && b.textContent.includes('Фото')) ||
                      (cat === 'postpress' && b.textContent.includes('Постпресс')) ||
                      (cat === 'design' && b.textContent.includes('Дизайн'));
        if (match) b.classList.add('active');
      });
    }
  }
  const items = cat === 'all' ? POS_PRESETS : POS_PRESETS.filter(p => p.category === cat);
  const grid = document.getElementById('posItemsGrid');
  if (grid) {
    grid.innerHTML = items.map(p => `
      <div class="pos-item-btn ${activePosItem.id === p.id ? 'selected' : ''}" onclick="selectPosItem('${p.id}')">
        <span class="pos-item-icon">${p.icon}</span>
        <span class="pos-item-title">${esc(p.title)}</span>
        <span class="pos-item-price">${fmtMoney(p.price)}</span>
      </div>
    `).join('');
  }
}

function selectPosItem(id) {
  activePosItem = POS_PRESETS.find(p => p.id === id) || POS_PRESETS[0];
  const titleEl = document.getElementById('posActiveTitle');
  if (titleEl) titleEl.textContent = `${activePosItem.icon} ${activePosItem.title}`;
  const badgeEl = document.getElementById('posActiveUnitBadge');
  if (badgeEl) badgeEl.textContent = `${fmtMoney(activePosItem.price)} / шт`;
  activePosQty = 1;
  const qtyEl = document.getElementById('posQtyInput');
  if (qtyEl) qtyEl.value = 1;
  updatePosGrandTotal();
  const btns = document.querySelectorAll('#posItemsGrid .pos-item-btn');
  btns.forEach(b => b.classList.remove('selected'));
}

function stepPosQty(delta) {
  activePosQty = Math.max(1, activePosQty + delta);
  document.getElementById('posQtyInput').value = activePosQty;
  updatePosGrandTotal();
}
function setPosQtyQuick(qty) {
  activePosQty = qty;
  document.getElementById('posQtyInput').value = qty;
  updatePosGrandTotal();
}
function onPosQtyChange() {
  activePosQty = Math.max(1, num(document.getElementById('posQtyInput').value));
  updatePosGrandTotal();
}
function setPosPayment(type) {
  activePosPayment = type;
  document.getElementById('posPayCash').classList.toggle('active', type === 'cash');
  document.getElementById('posPayClick').classList.toggle('active', type === 'click');
}
function updatePosGrandTotal() {
  const total = (activePosItem.price || 0) * activePosQty;
  document.getElementById('posGrandTotalLabel').textContent = fmtMoney(total);
}

function executePOSSale() {
  const staffKey = document.getElementById('posStaffSelect').value;
  const st = state.staff.find(s => s.key === staffKey);
  if(!st) return alert("Выберите сотрудника.");

  const total = activePosItem.price * activePosQty;
  const newOrder = {
    id: Date.now(),
    date: todayIso(),
    time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
    staffKey: staffKey,
    staffName: st.name,
    clientName: 'Быстрый клиент',
    clientPhone: '—',
    serviceType: activePosItem.type,
    title: `${activePosItem.title} (${activePosQty} шт)`,
    amount: total,
    advance: total,
    rest: 0,
    paymentType: activePosPayment,
    status: 'completed',
    isConfirmed: currentUser.role === 'cashier' || currentUser.role === 'admin'
  };

  state.orders.unshift(newOrder);
  autoDeductInventoryForPOS(activePosItem.id, activePosQty);
  logAudit('ПРОДАЖА POS', `Проведено: "${newOrder.title}" на сумму ${fmtMoney(total)} (${activePosPayment})`);
  saveState();
  renderAllViews();
  showToast(`Проведено: ${newOrder.title} на ${fmtMoney(total)}`, 'success');
  activePosQty = 1;
  document.getElementById('posQtyInput').value = 1;
  updatePosGrandTotal();
}

function renderRecentPosSales() {
  const today = todayIso();
  const sales = state.orders.filter(o => o.date === today || !o.date).slice(0, 10);
  let h = '<thead><tr><th>Услуга / Заказ</th><th>Клиент</th><th>Мастер</th><th>Сумма</th><th>Оплата</th><th>Статус</th><th>Чек</th></tr></thead><tbody>';
  sales.forEach(s => {
    h += `<tr>
      <td><b>${esc(s.title)}</b></td>
      <td><span style="font-size:12px; font-weight:700;">${esc(s.clientName || 'Быстрый клиент')}</span></td>
      <td>${esc(s.staffName)}</td>
      <td class="num-cell positive">${fmtMoney(s.amount)}</td>
      <td>${s.paymentType === 'click' ? '💳 Click' : '💵 Нал'}</td>
      <td>${s.isConfirmed ? '<span class="badge badge-success">В кассе</span>' : '<span class="badge badge-warning">Ожидает</span>'}</td>
      <td><button class="btn" style="padding:2px 8px; font-size:11px;" onclick="openReceiptModal(${s.id})">🖨 Чек</button></td>
    </tr>`;
  });
  if(!sales.length) h += '<tr><td colspan="7" style="text-align:center;color:var(--text-muted)">Сегодня продаж и заказов пока нет</td></tr>';
  document.getElementById('recentPosTable').innerHTML = h + '</tbody>';
}

// 2. CRM ORDERS
function openOrderModal() {
  document.getElementById('modalOrderStaff').innerHTML = state.staff.map(s => `
    <option value="${s.key}" ${currentUser.staffKey === s.key ? 'selected' : ''}>${esc(s.name)}</option>
  `).join('');
  document.getElementById('modalOrderClient').value = '';
  document.getElementById('modalOrderPhone').value = '';
  document.getElementById('modalOrderTitle').value = '';
  document.getElementById('modalOrderSum').value = '';
  document.getElementById('modalOrderAdvance').value = '';
  document.getElementById('modalOrderDeadlineDate').value = todayIso();
  document.getElementById('modalOrderDeadlineTime').value = '18:00';
  // Populate inventory dropdown
  const invSelect = document.getElementById('modalOrderInventorySelect');
  if (invSelect) {
    invSelect.innerHTML = '<option value="">(Без списания со склада)</option>' + 
      (state.inventory || []).map(i => `<option value="${i.id}">${esc(i.name)} (Остаток: ${i.qty} ${i.unit})</option>`).join('');
  }
  const invQtyEl = document.getElementById('modalOrderInventoryQty');
  if (invQtyEl) invQtyEl.value = '';

  calcModalBalance();
  document.getElementById('newOrderModal').classList.add('active');
}
function closeOrderModal() {
  document.getElementById('newOrderModal').classList.remove('active');
}
function calcModalBalance() {
  const sum = num(document.getElementById('modalOrderSum').value);
  const adv = num(document.getElementById('modalOrderAdvance').value);
  const rest = Math.max(0, sum - adv);
  document.getElementById('modalOrderRestLabel').textContent = fmtMoney(rest);
}

function submitCRMOrder() {
  const staffKey = document.getElementById('modalOrderStaff').value;
  const st = state.staff.find(s => s.key === staffKey);
  const title = document.getElementById('modalOrderTitle').value.trim();
  const sum = num(document.getElementById('modalOrderSum').value);
  const adv = num(document.getElementById('modalOrderAdvance').value);
  const client = document.getElementById('modalOrderClient').value.trim() || 'Клиент';
  const phone = document.getElementById('modalOrderPhone').value.trim() || '—';

  if(!title || sum <= 0) return alert("Укажите название и сумму заказа.");

  const rest = Math.max(0, sum - adv);
  const order = {
    id: Date.now(),
    date: todayIso(),
    time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
    staffKey: staffKey,
    staffName: st.name,
    clientName: client,
    clientPhone: phone,
    serviceType: document.getElementById('modalOrderServiceType').value,
    title: title,
    amount: sum,
    advance: adv,
    rest: rest,
    deadlineDate: document.getElementById('modalOrderDeadlineDate').value,
    deadlineTime: document.getElementById('modalOrderDeadlineTime').value,
    paymentType: document.getElementById('modalOrderPayType').value,
    status: document.getElementById('modalOrderStage').value,
    isConfirmed: currentUser.role === 'cashier' || currentUser.role === 'admin'
  };

  // Check if paid from client deposit
  const payType = document.getElementById('modalOrderPayType').value;
  if (payType === 'deposit') {
    if (!state.clientDeposits) state.clientDeposits = {};
    const curDeposit = state.clientDeposits[client] || 0;
    if (curDeposit < sum) {
      alert(`Недостаточно средств на депозите! Баланс: ${fmtMoney(curDeposit)}, сумма заказа: ${fmtMoney(sum)}`);
      return;
    }
    state.clientDeposits[client] -= sum;
    order.advance = sum;
    order.rest = 0;
    logAudit('ДЕПОЗИТ', `Списание с депозита клиента "${client}": -${fmtMoney(sum)} за заказ "${title}" (Остаток депозита: ${fmtMoney(state.clientDeposits[client])})`);
  }

  // Deduct inventory if selected
  const chosenInvId = document.getElementById('modalOrderInventorySelect')?.value;
  const chosenInvQty = num(document.getElementById('modalOrderInventoryQty')?.value);
  if (chosenInvId && chosenInvQty > 0) {
    const inv = (state.inventory || []).find(i => i.id === chosenInvId);
    if (inv) {
      inv.qty = Math.max(0, inv.qty - chosenInvQty);
      logAudit('СПИСАНИЕ СКЛАДА', `Списание под заказ "${title}": ${chosenInvQty} ${inv.unit} "${inv.name}" (Остаток: ${inv.qty})`);
    }
  }

  logAudit('СОЗДАНИЕ ЗАКАЗА', `Заказ #${order.id}: "${title}" Клиент: ${client}, Сумма: ${fmtMoney(sum)}, Мастер: ${st.name}`);
  state.orders.unshift(order);
  if(rest > 0) {
    state.debts.push({
      id: Date.now(),
      client: client,
      service: `${title} (Заказ #${order.id})`,
      qty: 1,
      price: sum,
      paid: adv,
      phone: phone,
      date: order.date,
      comment: `Авто-долг из CRM заказа #${order.id}`
    });
  }

  saveState();
  closeOrderModal();
  renderAllViews();
  showToast(`Заказ "${title}" оформлен!`, 'success');
}

function setOrderFilter(f) {
  activeOrderFilter = f;
  ['All','Progress','Ready','Completed'].forEach(t => {
    const btn = document.getElementById('orderTab' + t);
    if(btn) btn.className = (t.toUpperCase() === f.toUpperCase() || (t==='All' && f==='ALL')) ? 'btn btn-primary' : 'btn';
  });
  renderOrdersTable();
}

function renderOrdersTable() {
  let list = state.orders;
  const q = (document.getElementById('orderSearchField')?.value || '').toLowerCase();
  if(q) list = list.filter(o => o.clientName.toLowerCase().includes(q) || o.title.toLowerCase().includes(q) || o.clientPhone.includes(q));

  if(activeOrderFilter === 'in_progress') list = list.filter(o => ['in_progress','design_stage','print_stage'].includes(o.status));
  else if(activeOrderFilter === 'ready') list = list.filter(o => o.status === 'ready');
  else if(activeOrderFilter === 'completed') list = list.filter(o => o.status === 'completed');

  let h = '<thead><tr><th>№</th><th>Исполнитель</th><th>Клиент</th><th>Заказ</th><th>Сумма</th><th>Аванс</th><th>Остаток</th><th>Дедлайн</th><th>Кассир</th><th>Этап</th><th>Действия</th></tr></thead><tbody>';

  list.forEach((o, idx) => {
    const isReady = o.status === 'ready';
    const isCompleted = o.status === 'completed';
    const stageBadge = isCompleted ? '<span class="badge badge-success">🎉 Выдан</span>' : isReady ? '<span class="badge badge-warning">✅ Готов</span>' : '<span class="badge">🟡 В работе</span>';

    h += `<tr>
      <td>${idx+1}</td>
      <td><b>${esc(o.staffName)}</b></td>
      <td>
        <div style="font-weight:700;">${esc(o.clientName)}</div>
        <div style="font-size:11px;color:var(--text-muted);">${esc(o.clientPhone)}</div>
      </td>
      <td>
        <b>${esc(o.title)}</b>
        ${o.fileLink ? `<div style="margin-top:3px;"><a href="${esc(o.fileLink)}" target="_blank" style="font-size:11px; color:var(--primary); font-weight:700;">📁 Открыть макет</a></div>` : ''}
      </td>
      <td class="num-cell">${fmtMoney(o.amount)}</td>
      <td class="num-cell positive">${fmtMoney(o.advance)}</td>
      <td class="num-cell ${o.rest > 0 ? 'negative' : 'positive'}">${fmtMoney(o.rest)}</td>
      <td><span style="font-size:12px;font-weight:700;">${o.deadlineDate} ${o.deadlineTime || ''}</span></td>
      <td>${o.isConfirmed ? '<span class="badge badge-success">В кассе</span>' : `<button class="btn btn-success" style="padding:3px 8px;font-size:11px;" onclick="confirmOrderPayment(${o.id})">Подтвердить</button>`}</td>
      <td>
        <select style="padding:4px 8px;border-radius:6px;border:1px solid var(--border);font-size:12px;font-weight:700;background:var(--bg-input);" onchange="updateOrderStage(${o.id}, this.value)">
          <option value="in_progress" ${o.status==='in_progress'?'selected':''}>🟡 В работе</option>
          <option value="design_stage" ${o.status==='design_stage'?'selected':''}>🎨 Дизайн</option>
          <option value="print_stage" ${o.status==='print_stage'?'selected':''}>🖨 Печать</option>
          <option value="ready" ${o.status==='ready'?'selected':''}>✅ Готов к выдаче</option>
          <option value="completed" ${o.status==='completed'?'selected':''}>🎉 Выполнен (Выдан)</option>
        </select>
      </td>
      <td>
        <div style="display:flex; gap:4px;">
          <button class="btn" style="padding:2px 7px; font-size:11px;" onclick="openReceiptModal(${o.id})" title="Распечатать чек">🖨</button>
          <button class="btn btn-danger" style="padding:2px 7px; font-size:11px;" onclick="deleteOrder(${o.id})">×</button>
        </div>
      </td>
    </tr>`;
  });

  if(!list.length) h += '<tr><td colspan="11" style="text-align:center;color:var(--text-muted)">Заказов в этом фильтре не найдено</td></tr>';
  document.getElementById('ordersMainTable').innerHTML = h + '</tbody>';
}

function confirmOrderPayment(id) {
  const o = state.orders.find(x => x.id === id);
  if(o) { o.isConfirmed = true; saveState(); renderOrdersTable(); showToast("Оплата подтверждена!", "success"); }
}
function updateOrderStage(id, stage) {
  const o = state.orders.find(x => x.id === id);
  if(o) { o.status = stage; saveState(); renderOrdersTable(); showToast("Статус заказа обновлен", "info"); }
}
function deleteOrder(id) {
  if(confirm("Удалить этот заказ?")) {
    state.orders = state.orders.filter(x => x.id !== id);
    saveState(); renderOrdersTable(); showToast("Заказ удален", "warning");
  }
}

// 3. DAILY REVENUE
function renderDailyView() {
  const picker = document.getElementById('dailyDatePicker');
  if(!picker.value) picker.value = todayIso();
  const d = picker.value;
  const met = getDateMetrics(d);

  document.getElementById('dailyGrossLabel').textContent = fmtMoney(met.gross);
  document.getElementById('dailyDesignLabel').textContent = met.designRev > 0 ? ('-' + fmtMoney(met.designRev)) : '0 сум';
  document.getElementById('dailyExpenseLabel').textContent = met.expense > 0 ? ('-' + fmtMoney(met.expense)) : '0 сум';
  document.getElementById('dailyNetCashLabel').textContent = fmtMoney(met.netCash);

  document.getElementById('dailyStaffBreakdownGrid').innerHTML = state.staff.map(s => {
    const st = met.staffStats[s.key] || { print: 0, design: 0, count: 0 };
    return `
      <div class="card" style="padding: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <b style="font-size: 15px;">${esc(s.name)}</b>
          <span class="badge badge-success">${st.count} зак.</span>
        </div>
        <div style="font-size: 12.5px; color: var(--text-muted); display: flex; justify-content: space-between; margin-bottom: 4px;">
          <span>Печать (10%):</span> <b class="positive">${fmtMoney(st.print)}</b>
        </div>
        <div style="font-size: 12.5px; color: var(--text-muted); display: flex; justify-content: space-between;">
          <span>Дизайн (100%):</span> <b style="color:var(--primary)">${fmtMoney(st.design)}</b>
        </div>
      </div>
    `;
  }).join('');

  // Render Day Expenses Table
  const dayExps = state.expenses.filter(e => e.date === d);
  let expHtml = '<thead><tr><th>Время</th><th>Категория</th><th>Наименование</th><th>Сумма</th><th>Оплата</th><th>Ответственный</th></tr></thead><tbody>';
  dayExps.forEach(e => {
    expHtml += `<tr>
      <td><span style="font-family:'JetBrains Mono'; font-weight:700;">${e.time || '—'}</span></td>
      <td><span class="badge" style="background:var(--primary-subtle); color:var(--primary); font-size:12px;">${esc(e.category)}</span></td>
      <td><b>${esc(e.name)}</b></td>
      <td class="num-cell negative" style="font-size:14px;"><b>-${fmtMoney(e.amount)}</b></td>
      <td>${esc(e.payment)}</td>
      <td>${esc(e.responsible || '—')}</td>
    </tr>`;
  });
  if (!dayExps.length) {
    expHtml += `<tr><td colspan="6" style="text-align:center; color:var(--text-muted);">За ${d} расходов не зафиксировано</td></tr>`;
  }
  document.getElementById('dailyExpensesTable').innerHTML = expHtml + '</tbody>';
}

// 4. MONTHLY TABLE
function renderMonthlyTable() {
  const y = state.selectedYear, m = state.selectedMonth;
  const dates = monthDates(y, m);
  let h = '<thead><tr><th>Дата</th><th>Выручка Печать</th><th>Выручка Дизайн</th><th>Валовая</th><th>Касса (Нал)</th><th>Расходы</th><th>Прибыль</th></tr></thead><tbody>';
  dates.forEach(d => {
    const met = getDateMetrics(d);
    h += `<tr>
      <td><b>${d}</b></td>
      <td class="num-cell">${fmtMoney(met.printRev)}</td>
      <td class="num-cell" style="color:var(--primary)">${fmtMoney(met.designRev)}</td>
      <td class="num-cell"><b>${fmtMoney(met.gross)}</b></td>
      <td class="num-cell positive"><b>${fmtMoney(met.netCash)}</b></td>
      <td class="num-cell" style="color:var(--accent-amber)">${fmtMoney(met.expense)}</td>
      <td class="num-cell ${met.profit < 0 ? 'negative' : 'positive'}"><b>${fmtMoney(met.profit)}</b></td>
    </tr>`;
  });
  document.getElementById('monthlyIncomeTable').innerHTML = h + '</tbody>';
}

// 5. DASHBOARD & CHART
function renderDashboard() {
  const y = state.selectedYear;
  const ym = getYearMetrics(y);

  const kpis = [
    { label: 'Выручка за год', val: fmtMoney(ym.revenue), icon: '↗', col: 'var(--primary)' },
    { label: 'Расходы за год', val: fmtMoney(ym.expense), icon: '↘', col: 'var(--accent-amber)' },
    { label: 'Прибыль за год', val: fmtMoney(ym.profit), icon: '✓', col: 'var(--accent-emerald)' },
    { label: 'Остаток долгов', val: fmtMoney(ym.totalDebt), icon: '◎', col: 'var(--accent-purple)' }
  ];

  document.getElementById('dashboardKpis').innerHTML = kpis.map(k => `
    <div class="kpi-card">
      <div class="kpi-top">
        <span class="kpi-label">${k.label}</span>
        <div class="kpi-icon-pill" style="background: var(--bg-card-subtle); color:${k.col}">${k.icon}</div>
      </div>
      <div class="kpi-value">${k.val}</div>
      <div class="kpi-foot">За ${y} год</div>
    </div>
  `).join('');

  // Categories Bars
  const catStats = {};
  state.categories.forEach(c => catStats[c] = 0);
  (state.expenses || []).filter(e => e && e.date && String(e.date).startsWith(`${y}-`)).forEach(e => {
    const cat = e.category || 'Прочее';
    catStats[cat] = (catStats[cat] || 0) + num(e.amount);
  });
  const topCats = Object.entries(catStats).filter(([_, v]) => v > 0).sort((a,b) => b[1] - a[1]).slice(0, 6);
  const maxVal = topCats[0]?.[1] || 1;

  document.getElementById('annualExpenseBars').innerHTML = topCats.map(([cat, amt]) => `
    <div>
      <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: 700; margin-bottom: 4px;">
        <span>${esc(cat)}</span> <span>${fmtMoney(amt)}</span>
      </div>
      <div style="height: 8px; background: var(--bg-card-subtle); border-radius: 99px; overflow: hidden;">
        <div style="height: 100%; width: ${(amt/maxVal*100)}%; background: var(--primary); border-radius: 99px;"></div>
      </div>
    </div>
  `).join('') || '<div style="color:var(--text-muted);font-size:13px;">Расходов в этом году пока нет</div>';
}

function drawAnnualChart() {
  const canvas = document.getElementById('annualChartCanvas');
  if(!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext('2d');
  if(!ctx) return;
  const box = (canvas.getBoundingClientRect && canvas.getBoundingClientRect()) || { width: 600, height: 260 };
  const w = (box.width && box.width > 0) ? box.width : 600;
  const h = (box.height && box.height > 0) ? box.height : 260;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  if (ctx.scale) ctx.scale(dpr, dpr);

  const data = getYearMetrics(state.selectedYear).months;
  const maxVal = Math.max(...data.flatMap(d => [d.revenue, d.expense, Math.max(0, d.profit)]), 100000) * 1.15;

  ctx.clearRect(0, 0, w, h);
  ctx.font = '11px Plus Jakarta Sans, sans-serif';
  ctx.fillStyle = '#94a3b8';

  const padL = 40, padB = 30, padT = 20;
  const colW = (w - padL - 20) / 12;

  data.forEach((d, i) => {
    const x = padL + i * colW + colW / 2;
    const revH = (d.revenue / maxVal) * (h - padB - padT);
    const expH = (d.expense / maxVal) * (h - padB - padT);

    // Revenue Bar
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(x - 8, h - padB - revH, 7, revH);

    // Expense Bar
    ctx.fillStyle = '#d97706';
    ctx.fillRect(x + 1, h - padB - expH, 7, expH);

    ctx.fillStyle = '#94a3b8';
    ctx.fillText((MONTH_NAMES[i] || '').slice(0, 3), x - 10, h - 10);
  });
}

// 6. PAYROLL
function renderPayrollTable() {
  const y = state.selectedYear, m = state.selectedMonth;
  const staffList = state.staff.map(s => {
    let printRev = 0, designRev = 0;
    monthDates(y, m).forEach(d => {
      const met = getDateMetrics(d);
      const st = met.staffStats[s.key] || { print: 0, design: 0 };
      printRev += st.print;
      designRev += st.design;
    });

    const pKey = `${y}-${m}-${s.key}`;
    const ov = state.payrollOverrides[pKey] || {};
    const rate = ov.rate !== undefined ? num(ov.rate) : (s.defaultRate || 10);
    const adv = num(ov.extraAdvance);
    const printSal = printRev * (rate / 100);
    const gross = printSal + designRev;
    const net = gross - adv;

    return { name: s.name, key: s.key, printRev, rate, printSal, designRev, gross, adv, net, status: ov.status || 'К выплате' };
  });

  let h = '<thead><tr><th>Сотрудник</th><th>Выручка Печать</th><th>%</th><th>ЗП Печать</th><th>Дизайн (100%)</th><th>Всего начислено</th><th>Авансы</th><th>К ВЫПЛАТЕ</th><th>Статус</th></tr></thead><tbody>';
  staffList.forEach(st => {
    h += `<tr>
      <td><b>${esc(st.name)}</b></td>
      <td class="num-cell">${fmtMoney(st.printRev)}</td>
      <td style="width:70px"><input style="width:60px;padding:3px;font-weight:700;" type="number" value="${st.rate}" onchange="setPayrollOverride('${st.key}','rate',this.value)"></td>
      <td class="num-cell positive">${fmtMoney(st.printSal)}</td>
      <td class="num-cell" style="color:var(--primary)"><b>${fmtMoney(st.designRev)}</b></td>
      <td class="num-cell positive"><b>${fmtMoney(st.gross)}</b></td>
      <td style="width:100px"><input style="width:90px;padding:3px;font-weight:700;" type="number" value="${st.adv||''}" placeholder="0" onchange="setPayrollOverride('${st.key}','extraAdvance',this.value)"></td>
      <td class="num-cell ${st.net < 0 ? 'negative' : 'positive'}" style="font-size:15px;background:var(--primary-subtle)"><b>${fmtMoney(st.net)}</b></td>
      <td><span class="badge ${st.status==='Выплачено'?'badge-success':'badge-warning'}">${esc(st.status)}</span></td>
    </tr>`;
  });
  document.getElementById('payrollMainTable').innerHTML = h + '</tbody>';
}

function setPayrollOverride(key, f, val) {
  const y = state.selectedYear, m = state.selectedMonth;
  const pKey = `${y}-${m}-${key}`;
  if(!state.payrollOverrides[pKey]) state.payrollOverrides[pKey] = {};
  state.payrollOverrides[pKey][f] = num(val);
  saveState();
  renderPayrollTable();
}

// 7. EXPENSES
function renderExpensesTable() {
  const prefix = monthPrefix(state.selectedYear, state.selectedMonth);
  let rows = state.expenses.filter(e => e.date && (e.date.startsWith(prefix) || e.date.startsWith(`${state.selectedYear}-${String(state.selectedMonth+1)}`)));
  
  // Fallback to show all recent expenses if selected month filter has no items
  if (!rows.length && state.expenses && state.expenses.length > 0) {
    rows = state.expenses;
  }

  let h = '<thead><tr><th>Дата</th><th>Категория</th><th>Наименование</th><th>Сумма</th><th>Оплата</th><th>Ответственный</th><th></th></tr></thead><tbody>';
  rows.forEach(r => {
    h += `<tr>
      <td><input type="date" value="${r.date || todayIso()}" onchange="updateExp(${r.id},'date',this.value)" style="border:none;background:transparent;font-weight:700;"></td>
      <td><span class="badge" style="font-size:12px;background:var(--primary-subtle);color:var(--primary);">${esc(r.category)}</span></td>
      <td><b>${esc(r.name)}</b></td>
      <td class="num-cell negative">${fmtMoney(r.amount)}</td>
      <td>${esc(r.payment)}</td>
      <td>${esc(r.responsible || '—')}</td>
      <td><button class="btn btn-danger" style="padding:2px 8px;" onclick="deleteExp(${r.id})">×</button></td>
    </tr>`;
  });
  if(!rows.length) h += '<tr><td colspan="7" style="text-align:center;color:var(--text-muted)">Расходов пока нет. Надиктуйте голосовое в Telegram-бота!</td></tr>';
  document.getElementById('expenseMainTable').innerHTML = h + '</tbody>';
}

function addNewExpenseRow() {
  const name = prompt("Наименование расхода:");
  if(!name) return;
  const amt = num(prompt("Сумма (сум):"));
  if(amt <= 0) return;

  state.expenses.push({
    id: Date.now(),
    date: todayIso(),
    category: state.categories[0] || 'Прочее',
    name: name,
    amount: amt,
    payment: 'Наличные',
    responsible: state.staff[0]?.name || ''
  });
  saveState();
  renderExpensesTable();
  showToast("Расход добавлен!", "success");
}

async function syncWithTelegramBot() {
  try {
    showToast("Синхронизация с сервером...", "info");
    let url = 'https://masterprint-chi.vercel.app/api/state?t=' + Date.now();
    if (window._lastServerSyncTime) url += '&since=' + window._lastServerSyncTime;
    const res = await fetch(url, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.state) {
        // Union merge expenses so local records are never erased
        const cloudExps = Array.isArray(data.state.expenses) ? data.state.expenses : [];
        const expMap = new Map();
        state.expenses.forEach(e => { if (!deletedItemIds.has(e.id)) expMap.set(String(e.id), e); });
        cloudExps.forEach(e => { if (!deletedItemIds.has(e.id)) expMap.set(String(e.id), e); });
        state.expenses = Array.from(expMap.values()).sort((a, b) => b.id - a.id);

        // Union merge orders
        const cloudOrders = Array.isArray(data.state.orders) ? data.state.orders : [];
        const orderMap = new Map();
        state.orders.forEach(o => { if (!deletedItemIds.has(o.id)) orderMap.set(String(o.id), o); });
        cloudOrders.forEach(o => { if (!deletedItemIds.has(o.id)) orderMap.set(String(o.id), o); });
        state.orders = Array.from(orderMap.values()).sort((a, b) => b.id - a.id);

        // Union merge debts
        const cloudDebts = Array.isArray(data.state.debts) ? data.state.debts : [];
        const debtMap = new Map();
        state.debts.forEach(d => { if (!deletedItemIds.has(d.id)) debtMap.set(String(d.id), d); });
        cloudDebts.forEach(d => { if (!deletedItemIds.has(d.id)) debtMap.set(String(d.id), d); });
        state.debts = Array.from(debtMap.values()).sort((a, b) => b.id - a.id);

        // Push combined state back to server to ensure 100% sync
        saveState();
        renderAllViews();
        showToast(`Синхронизировано! В системе: ${state.expenses.length} расходов, ${state.orders.length} заказов.`, 'success');
        return;
      }
    }
    showToast("Сервер ответил, данные синхронизированы", "info");
  } catch(e) {
    showToast("Ошибка подключения к серверу: " + e.message, "warning");
  }
}
function updateExp(id, f, v) {
  const e = state.expenses.find(x => x.id === id);
  if(e) { e[f] = v; saveState(); }
}
function deleteExp(id) {
  if(confirm("Удалить расход?")) {
    state.expenses = state.expenses.filter(x => x.id !== id);
    saveState(); renderExpensesTable();
  }
}

// 8. DEBTS
function renderDebtsTable() {
  let h = '<thead><tr><th>Клиент</th><th>Услуга / Заказ</th><th>Сумма</th><th>Оплачено</th><th>Остаток долга</th><th>Телефон</th><th></th></tr></thead><tbody>';
  state.debts.forEach(d => {
    const sum = num(d.qty) * num(d.price);
    const rest = Math.max(0, sum - num(d.paid));
    h += `<tr>
      <td><b>${esc(d.client)}</b></td>
      <td>${esc(d.service)}</td>
      <td class="num-cell">${fmtMoney(sum)}</td>
      <td class="num-cell positive">${fmtMoney(d.paid)}</td>
      <td class="num-cell negative"><b>${fmtMoney(rest)}</b></td>
      <td><a href="tel:${esc(d.phone)}" style="color:var(--primary);font-weight:700;">${esc(d.phone)}</a></td>
      <td><button class="btn btn-danger" style="padding:2px 8px;" onclick="deleteDebt(${d.id})">×</button></td>
    </tr>`;
  });
  if(!state.debts.length) h += '<tr><td colspan="7" style="text-align:center;color:var(--text-muted)">Должников нет</td></tr>';
  document.getElementById('debtsMainTable').innerHTML = h + '</tbody>';
}
function addNewDebtRow() {
  const c = prompt("Имя клиента:");
  if(!c) return;
  const amt = num(prompt("Сумма долга (сум):"));
  if(amt <= 0) return;
  state.debts.push({ id: Date.now(), client: c, service: "Прямой долг", qty: 1, price: amt, paid: 0, phone: "", date: todayIso() });
  saveState(); renderDebtsTable(); showToast("Долг добавлен", "info");
}
function deleteDebt(id) {
  if(confirm("Удалить долг?")) { state.debts = state.debts.filter(x => x.id !== id); saveState(); renderDebtsTable(); }
}

// 9. SETTINGS
function renderSettings() {
  document.getElementById('settingsStaffList').innerHTML = state.staff.map((s, i) => `
    <div style="display:flex;gap:8px;">
      <input value="${esc(s.name)}" onchange="state.staff[${i}].name=this.value;saveState();" style="flex:1;padding:8px;">
      <input value="${esc(s.pass||'1234')}" onchange="state.staff[${i}].pass=this.value;saveState();" style="width:80px;padding:8px;">
      <button class="btn btn-danger" onclick="state.staff.splice(${i},1);saveState();renderSettings();">×</button>
    </div>
  `).join('');

  document.getElementById('settingsCatList').innerHTML = state.categories.map((c, i) => `
    <div style="display:flex;gap:8px;">
      <input value="${esc(c)}" onchange="state.categories[${i}]=this.value;saveState();" style="flex:1;padding:8px;">
      <button class="btn btn-danger" onclick="state.categories.splice(${i},1);saveState();renderSettings();">×</button>
    </div>
  `).join('');
}
// 11. INVENTORY / WAREHOUSE
const DEFAULT_INVENTORY = [
  { id: 'inv_1', name: 'Бумага SvetoCopy A4 (80г)', category: 'Бумага', qty: 0, unit: 'пач', minQty: 10, cost: 38000 },
  { id: 'inv_2', name: 'Фотобумага Глянцевая А4 230г', category: 'Бумага', qty: 0, unit: 'лист', minQty: 50, cost: 800 },
  { id: 'inv_3', name: 'Бумага SRA3 ColorCopy 300г', category: 'Бумага', qty: 0, unit: 'лист', minQty: 40, cost: 2200 },
  { id: 'inv_4', name: 'DTF Плёнка рулон 60см x 100м', category: 'ДТФ', qty: 0, unit: 'рул', minQty: 1, cost: 850000 },
  { id: 'inv_5', name: 'Краска DTF CMYK+White (1L)', category: 'ДТФ', qty: 0, unit: 'бут', minQty: 2, cost: 240000 },
  { id: 'inv_6', name: 'Фоторамка 21х30 А4 (дерево)', category: 'Рамки', qty: 0, unit: 'шт', minQty: 10, cost: 18000 },
  { id: 'inv_7', name: 'Фоторамка 10х15 (стекло/дерево)', category: 'Рамки', qty: 0, unit: 'шт', minQty: 15, cost: 9000 },
  { id: 'inv_8', name: 'Кружки белые сублимационные', category: 'Сувениры', qty: 0, unit: 'шт', minQty: 12, cost: 14000 }
];

function getInventory() {
  if (!state.inventory || !state.inventory.length) {
    state.inventory = JSON.parse(JSON.stringify(DEFAULT_INVENTORY));
  }
  return state.inventory;
}

function renderInventoryView() {
  const inv = getInventory();
  const lowCount = inv.filter(i => i.qty <= i.minQty).length;
  const totalItems = inv.reduce((s, i) => s + i.qty, 0);

  document.getElementById('inventoryCardsGrid').innerHTML = inv.slice(0, 3).map(i => {
    const isLow = i.qty <= i.minQty;
    return `
      <div class="card" style="border-left: 4px solid ${isLow ? 'var(--primary)' : 'var(--accent-emerald)'}">
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
          <div>
            <span style="font-size:11px; font-weight:800; color:var(--text-muted); text-transform:uppercase;">${esc(i.category)}</span>
            <h4 style="font-size:15px; font-weight:800; margin-top:2px;">${esc(i.name)}</h4>
          </div>
          ${isLow ? '<span class="badge badge-danger">⚠️ Заканчивается</span>' : '<span class="badge badge-success">В норме</span>'}
        </div>
        <div style="display:flex; justify-content:space-between; align-items:baseline; margin-top:14px;">
          <div style="font-size:24px; font-weight:900; font-family:'JetBrains Mono';">${i.qty} <span style="font-size:13px; color:var(--text-muted);">${i.unit}</span></div>
          <div style="display:flex; gap:4px;">
            <button class="btn" style="padding:2px 8px; font-weight:800;" onclick="updateInventoryQty('${i.id}', -1)">-1</button>
            <button class="btn btn-primary" style="padding:2px 8px; font-weight:800;" onclick="updateInventoryQty('${i.id}', 10)">+10</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  let h = '<thead><tr><th>Категория</th><th>Наименование материала</th><th>Остаток</th><th>Мин. лимит</th><th>Себестоимость</th><th>Статус</th><th>Быстрое пополнение</th></tr></thead><tbody>';
  inv.forEach(i => {
    const isLow = i.qty <= i.minQty;
    h += `<tr>
      <td><span class="badge" style="background:var(--bg-card-subtle);">${esc(i.category)}</span></td>
      <td><b>${esc(i.name)}</b></td>
      <td class="num-cell" style="font-size:15px; ${isLow ? 'color:var(--primary)' : 'color:var(--accent-emerald)'}"><b>${i.qty} ${i.unit}</b></td>
      <td class="num-cell" style="color:var(--text-muted);">${i.minQty} ${i.unit}</td>
      <td class="num-cell">${fmtMoney(i.cost)}</td>
      <td>${isLow ? '<span class="badge badge-danger">Заказать</span>' : '<span class="badge badge-success">Достаточно</span>'}</td>
      <td>
        <div style="display:flex; gap:4px;">
          <button class="btn" style="padding:3px 8px; font-size:11px;" onclick="updateInventoryQty('${i.id}', -1)">-1</button>
          <button class="btn" style="padding:3px 8px; font-size:11px;" onclick="updateInventoryQty('${i.id}', 5)">+5</button>
          <button class="btn btn-success" style="padding:3px 8px; font-size:11px;" onclick="updateInventoryQty('${i.id}', 20)">+20</button>
        </div>
      </td>
    </tr>`;
  });
  document.getElementById('inventoryMainTable').innerHTML = h + '</tbody>';
}

function updateInventoryQty(id, delta) {
  const inv = getInventory();
  const item = inv.find(i => i.id === id);
  if (item) {
    item.qty = Math.max(0, item.qty + delta);
    saveState();
    renderInventoryView();
    showToast(`Остаток ${item.name}: ${item.qty} ${item.unit}`, 'info');
  }
}

function addNewInventoryItem() {
  const name = prompt("Наименование материала (например: DTF Краска Black 1L):");
  if (!name) return;
  const unit = prompt("Единица измерения (шт, лист, пач, рул, литр):", "шт") || "шт";
  const qty = num(prompt("Текущий остаток:", "50"));
  const cost = num(prompt("Себестоимость за единицу (сум):", "15000"));

  const inv = getInventory();
  inv.push({
    id: 'inv_' + Date.now(),
    name: name,
    category: 'Материалы',
    qty: qty,
    unit: unit,
    minQty: 10,
    cost: cost
  });
  saveState();
  renderInventoryView();
  showToast("Материал добавлен на склад!", "success");
}

// 12. CLIENTS CRM & LTV
function renderClientsView() {
  const q = (document.getElementById('clientSearchInput')?.value || '').toLowerCase().trim();
  
  // Aggregate clients from orders & debts
  const clientMap = {};
  state.orders.forEach(o => {
    const name = (o.clientName || 'Клиент').trim();
    if (!name || name === 'Быстрый клиент') return;
    if (!clientMap[name]) {
      clientMap[name] = { name: name, phone: o.clientPhone || '—', ordersCount: 0, totalSpent: 0, totalPaid: 0, totalRest: 0, lastDate: o.date };
    }
    clientMap[name].ordersCount++;
    clientMap[name].totalSpent += (Number(o.amount) || 0);
    clientMap[name].totalPaid += (Number(o.advance) || 0);
    clientMap[name].totalRest += (Number(o.rest) || 0);
    if (o.date > clientMap[name].lastDate) clientMap[name].lastDate = o.date;
    if (o.clientPhone && o.clientPhone !== '—') clientMap[name].phone = o.clientPhone;
  });

  let clientsList = Object.values(clientMap);
  if (q) {
    clientsList = clientsList.filter(c => c.name.toLowerCase().includes(q) || c.phone.includes(q));
  }

  // Sort by highest LTV
  clientsList.sort((a, b) => b.totalSpent - a.totalSpent);

  const totalClients = clientsList.length;
  const totalLTV = clientsList.reduce((s, c) => s + c.totalSpent, 0);
  const totalDebt = clientsList.reduce((s, c) => s + c.totalRest, 0);

  document.getElementById('clientsKpiGrid').innerHTML = `
    <div class="kpi-card">
      <span class="kpi-label">Всего клиентов в CRM</span>
      <div class="kpi-value">${totalClients}</div>
    </div>
    <div class="kpi-card">
      <span class="kpi-label">Общая LTV выручка</span>
      <div class="kpi-value positive">${fmtMoney(totalLTV)}</div>
    </div>
    <div class="kpi-card">
      <span class="kpi-label">Текущий долг клиентов</span>
      <div class="kpi-value negative">${fmtMoney(totalDebt)}</div>
    </div>
    <div class="kpi-card">
      <span class="kpi-label">Средний чек клиента</span>
      <div class="kpi-value">${fmtMoney(totalClients > 0 ? totalLTV / totalClients : 0)}</div>
    </div>
  `;

  let h = '<thead><tr><th>Клиент</th><th>Телефон</th><th>Заказов</th><th>Всего оплачено (LTV)</th><th>Остаток долга</th><th>Посл. заказ</th><th>Контакты</th></tr></thead><tbody>';
  clientsList.forEach(c => {
    const rawPhone = c.phone.replace(/[^\d]/g, '');
    const tgLink = rawPhone ? `https://t.me/+${rawPhone}` : '#';
    const telLink = rawPhone ? `tel:+${rawPhone}` : '#';

    h += `<tr>
      <td><div style="font-weight:800; font-size:14px;">${esc(c.name)}</div></td>
      <td><span style="font-family:'JetBrains Mono'; font-weight:700;">${esc(c.phone)}</span></td>
      <td class="num-cell"><b>${c.ordersCount}</b></td>
      <td class="num-cell positive" style="font-size:15px;"><b>${fmtMoney(c.totalSpent)}</b></td>
      <td class="num-cell ${c.totalRest > 0 ? 'negative' : 'positive'}"><b>${fmtMoney(c.totalRest)}</b></td>
      <td><span style="font-size:12px; color:var(--text-muted);">${c.lastDate || '—'}</span></td>
      <td>
        <div style="display:flex; gap:6px;">
          ${rawPhone ? `<a href="${telLink}" class="btn" style="padding:3px 8px; text-decoration:none; font-size:12px;" title="Позвонить">📞</a>` : ''}
          ${rawPhone ? `<a href="${tgLink}" target="_blank" class="btn btn-primary" style="padding:3px 8px; text-decoration:none; font-size:12px;" title="Написать в Telegram">💬 TG</a>` : ''}
        </div>
      </td>
    </tr>`;
  });

  if (!clientsList.length) h += '<tr><td colspan="7" style="text-align:center; color:var(--text-muted);">Клиентов пока нет. Оформите первый заказ в CRM!</td></tr>';
  document.getElementById('clientsMainTable').innerHTML = h + '</tbody>';
}

// 13. THERMAL RECEIPT & INVOICE PRINTING
let activeReceiptOrder = null;

function openReceiptModal(orderId) {
  const order = state.orders.find(o => String(o.id) === String(orderId));
  if (!order) return showToast("Заказ не найден", "warning");
  activeReceiptOrder = order;

  const restText = order.rest > 0 
    ? `<div style="display:flex; justify-content:space-between; color:#dc2626; font-weight:bold; margin-top:4px;"><span>ОСТАТОК К ОПЛАТЕ:</span><span>${fmtMoney(order.rest)}</span></div>` 
    : `<div style="display:flex; justify-content:space-between; color:#059669; font-weight:bold; margin-top:4px;"><span>ОПЛАЧЕНО ПОЛНОСТЬЮ:</span><span>ДА</span></div>`;

  const qrData = encodeURIComponent(`https://my.click.uz/pay?merchant_id=12345&amount=${order.rest > 0 ? order.rest : order.amount}&transaction_param=MP-${order.id}`);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=${qrData}`;

  const html = `
    <div style="text-align:center; margin-bottom:12px;">
      <h2 style="font-size:18px; font-weight:900; margin:0; letter-spacing:1px;">MASTER PRINT</h2>
      <div style="font-size:10.5px; color:#64748b; margin-top:2px;">Полиграфия & Дизайн Центр</div>
      <div style="font-size:10px; color:#64748b;">тел: +998 90 705-95-95</div>
      <div style="border-bottom:1px dashed #000000; margin:10px 0;"></div>
    </div>

    <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
      <span>ЧЕК №: MP-${order.id.toString().slice(-6)}</span>
      <span>${order.date} ${order.time || ''}</span>
    </div>
    <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
      <span>Клиент:</span>
      <b>${esc(order.clientName)}</b>
    </div>
    <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
      <span>Мастер:</span>
      <span>${esc(order.staffName)}</span>
    </div>

    <div style="border-bottom:1px dashed #000000; margin:8px 0;"></div>

    <div style="margin-bottom:8px;">
      <div style="font-weight:bold; font-size:13px;">${esc(order.title)}</div>
      <div style="display:flex; justify-content:space-between; margin-top:2px;">
        <span>1 x ${fmtMoney(order.amount)}</span>
        <b>${fmtMoney(order.amount)}</b>
      </div>
    </div>

    <div style="border-bottom:1px dashed #000000; margin:8px 0;"></div>

    <div style="display:flex; justify-content:space-between; font-size:14px; font-weight:900; margin-bottom:4px;">
      <span>ИТОГО К ОПЛАТЕ:</span>
      <span>${fmtMoney(order.amount)}</span>
    </div>
    <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
      <span>Внесено (Аванс):</span>
      <span>${fmtMoney(order.advance)} (${order.paymentType === 'click' ? 'Click' : 'Наличные'})</span>
    </div>
    ${restText}

    <div style="text-align:center; margin:12px 0 6px;">
      <img src="${qrUrl}" alt="QR Оплата Click" style="width:110px; height:110px; border-radius:6px; border:1px solid #cbd5e1; display:inline-block;">
      <div style="font-size:9.5px; color:#475569; margin-top:4px; font-weight:bold;">📲 Оплата по QR (Click / Payme)</div>
    </div>

    <div style="border-bottom:1px dashed #000000; margin:10px 0;"></div>

    <div style="text-align:center; font-size:10.5px; color:#475569;">
      <div>Спасибо за заказ в MASTER PRINT!</div>
      <div style="margin-top:2px; font-weight:bold;">Ждём вас снова! ✨</div>
    </div>
  `;

  document.getElementById('printableReceiptArea').innerHTML = html;
  document.getElementById('receiptModal').classList.add('active');
}

function closeReceiptModal() {
  document.getElementById('receiptModal').classList.remove('active');
  activeReceiptOrder = null;
}


function quickAddDayExpense(name, amount, category = 'Обед и питание', payment = 'Наличные') {
  const d = document.getElementById('dailyDatePicker')?.value || todayIso();
  const now = new Date();
  const timeStr = now.toTimeString().slice(0, 5);

  const newExp = {
    id: Date.now() + Math.floor(Math.random() * 1000),
    date: d,
    time: timeStr,
    category: category,
    name: name,
    amount: amount,
    payment: payment,
    responsible: currentUser.name || 'Администратор'
  };

  state.expenses.unshift(newExp);
  saveState();
  renderAllViews();
  showToast(`Расход зафиксирован: ${name} (-${fmtMoney(amount)})`, 'success');
}

function updateOrderStatus(orderId, newStage) {
  const order = state.orders.find(o => String(o.id) === String(orderId));
  if (order) {
    order.stage = newStage;
    saveState();
    renderAllViews();
    showToast(`Статус заказа обновлен: ${order.title}`, 'success');
  }
}

function payOrderDebt(orderId) {
  const order = state.orders.find(o => String(o.id) === String(orderId));
  if (order) {
    const debt = Math.max(0, num(order.amount) - num(order.advance));
    if (debt > 0) {
      order.advance = order.amount;
      saveState();
      renderAllViews();
      showToast(`Долг ${fmtMoney(debt)} полностью погашен!`, 'success');
    }
  }
}



// 15. AUDIT LOG & SECURITY LOGIC
function logAudit(action, details) {
  if (!state.auditLogs) state.auditLogs = [];
  const entry = {
    id: Date.now() + Math.floor(Math.random() * 1000),
    date: todayIso(),
    time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    user: currentUser.name || 'Администратор',
    action: action,
    details: details
  };
  state.auditLogs.unshift(entry);
  if (state.auditLogs.length > 500) state.auditLogs.pop();
}

function renderAuditLogTable() {
  const table = document.getElementById('auditLogMainTable');
  if (!table) return;
  const q = (document.getElementById('auditLogSearch')?.value || '').toLowerCase().trim();
  const logs = (state.auditLogs || []).filter(l => !q || (l.user + ' ' + l.action + ' ' + l.details + ' ' + l.date).toLowerCase().includes(q));

  let h = '<thead><tr><th>Время</th><th>Пользователь</th><th>Действие</th><th>Подробности</th></tr></thead><tbody>';
  logs.forEach(l => {
    let actBadge = '<span class="badge badge-success">' + esc(l.action) + '</span>';
    if (l.action.includes('УДАЛЕНИЕ')) actBadge = '<span class="badge badge-danger">' + esc(l.action) + '</span>';
    else if (l.action.includes('ПРАВКА') || l.action.includes('ЗАРПЛАТА')) actBadge = '<span class="badge badge-warning">' + esc(l.action) + '</span>';
    else if (l.action.includes('ДЕПОЗИТ')) actBadge = '<span class="badge" style="background:var(--accent-purple-subtle);color:var(--accent-purple);">' + esc(l.action) + '</span>';

    h += `<tr>
      <td style="font-family:'JetBrains Mono';font-size:12px;">${l.date} ${l.time}</td>
      <td><b>${esc(l.user)}</b></td>
      <td>${actBadge}</td>
      <td style="font-size:13px;">${esc(l.details)}</td>
    </tr>`;
  });
  if (!logs.length) h += '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);">Записей в журнале пока нет</td></tr>';
  table.innerHTML = h + '</tbody>';
}

// 16. CLIENT DEPOSIT / BALANCE SYSTEM
let currentDepositTargetClient = '';

function openDepositModal(clientName) {
  currentDepositTargetClient = clientName;
  document.getElementById('depositClientName').value = clientName;
  document.getElementById('depositAmountInput').value = '';
  document.getElementById('clientDepositModal').classList.add('active');
}

function closeDepositModal() {
  document.getElementById('clientDepositModal').classList.remove('active');
  currentDepositTargetClient = '';
}

function submitClientDeposit() {
  const amt = num(document.getElementById('depositAmountInput').value);
  const payType = document.getElementById('depositPaymentType').value;
  if (amt <= 0) return alert('Укажите сумму пополнения.');

  if (!state.clientDeposits) state.clientDeposits = {};
  state.clientDeposits[currentDepositTargetClient] = (state.clientDeposits[currentDepositTargetClient] || 0) + amt;

  // Add a register income record
  const depositOrder = {
    id: Date.now(),
    date: todayIso(),
    time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
    staffKey: currentUser.staffKey || 'timur',
    staffName: currentUser.name,
    clientName: currentDepositTargetClient,
    clientPhone: '—',
    serviceType: 'print',
    title: `💰 Пополнение депозита клиента (+ ${fmtMoney(amt)})`,
    amount: amt,
    advance: amt,
    rest: 0,
    paymentType: payType,
    status: 'completed',
    isConfirmed: true
  };
  state.orders.unshift(depositOrder);

  logAudit('ДЕПОЗИТ', `Пополнение депозита клиента "${currentDepositTargetClient}" на +${fmtMoney(amt)} (${payType === 'click' ? 'Click' : 'Наличные'})`);
  saveState();
  closeDepositModal();
  renderAllViews();
  showToast(`Депозит клиента ${currentDepositTargetClient} пополнен на ${fmtMoney(amt)}!`, 'success');
}

function onModalPayTypeChange() {
  const payType = document.getElementById('modalOrderPayType').value;
  const clientName = document.getElementById('modalOrderClient').value.trim();
  if (payType === 'deposit') {
    const curDeposit = state.clientDeposits?.[clientName] || 0;
    if (curDeposit <= 0) {
      showToast(`У клиента "${clientName || 'Клиент'}" нет средств на депозите (0 сум)!`, 'warning');
    } else {
      showToast(`Доступно на депозите клиента: ${fmtMoney(curDeposit)}`, 'info');
    }
  }
}

// 17. INVENTORY AUTO-DEDUCTION LOGIC
function autoDeductInventoryForPOS(posId, qty) {
  if (!state.inventory || !state.inventory.length) return;

  let targetInvId = null;
  let deductQty = qty;

  if (posId === 'copy_a4' || posId === 'print_bw_a4' || posId === 'print_color_a4' || posId === 'copy_2side') {
    targetInvId = 'inv_1'; // Бумага А4
  } else if (posId === 'photo_3x4') {
    targetInvId = 'inv_2'; // Фотобумага А4
    deductQty = Math.ceil(qty / 4);
  }

  if (targetInvId) {
    const inv = state.inventory.find(i => i.id === targetInvId);
    if (inv) {
      inv.qty = Math.max(0, inv.qty - deductQty);
      logAudit('СПИСАНИЕ СКЛАДА', `Авто-списание: ${deductQty} ${inv.unit} "${inv.name}" (Остаток: ${inv.qty})`);
      if (inv.qty <= inv.minQty) {
        showToast(`⚠️ Внимание! Остаток "${inv.name}" на складе заканчивается: ${inv.qty} ${inv.unit}`, 'warning');
      }
    }
  }
}


function renderPortalView() {
  const staffKey = currentUser.staffKey || 'islam';
  const st = state.staff.find(s => s.key === staffKey) || state.staff[0];
  const y = state.selectedYear, m = state.selectedMonth;

  let printRev = 0, designRev = 0;
  const history = [];

  monthDates(y, m).forEach(d => {
    const met = getDateMetrics(d);
    const dayStat = met.staffStats[st.key] || { print: 0, design: 0, count: 0 };
    if (dayStat.print > 0 || dayStat.design > 0) {
      const pKey = `${y}-${m}-${st.key}`;
      const ov = state.payrollOverrides[pKey] || {};
      const rate = ov.rate !== undefined ? num(ov.rate) : (st.defaultRate || 10);
      const dayPrintSal = dayStat.print * (rate / 100);
      const dayTotal = dayPrintSal + dayStat.design;
      history.push({
        date: d,
        print: dayStat.print,
        rate: rate,
        printSal: dayPrintSal,
        design: dayStat.design,
        total: dayTotal,
        count: dayStat.count
      });
      printRev += dayStat.print;
      designRev += dayStat.design;
    }
  });

  const pKey = `${y}-${m}-${st.key}`;
  const ov = state.payrollOverrides[pKey] || {};
  const rate = ov.rate !== undefined ? num(ov.rate) : (st.defaultRate || 10);
  const adv = num(ov.extraAdvance);
  const printSal = printRev * (rate / 100);
  
  // 8:30 Checkin Bonus check
  const checkinKey = `${todayIso()}-${st.key}`;
  const hasBonusToday = (state.checkins || []).some(c => c.key === checkinKey && c.isBonus);
  const bonusAmount = hasBonusToday ? 1000000 : 0;

  const gross = printSal + designRev + bonusAmount;
  const net = Math.max(0, gross - adv);

  document.getElementById('portalKpiGrid').innerHTML = `
    <div class="kpi-card">
      <div class="kpi-top"><span class="kpi-label">Выручка за печать</span><span style="font-size:18px;">🖨</span></div>
      <div class="kpi-value" style="font-size:20px;">${fmtMoney(printRev)}</div>
      <div class="kpi-foot">Моя ставка ЗП: <b>${rate}%</b> (=${fmtMoney(printSal)})</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-top"><span class="kpi-label">Выручка за дизайн</span><span style="font-size:18px;color:var(--primary);">🎨</span></div>
      <div class="kpi-value" style="font-size:20px;color:var(--primary);">${fmtMoney(designRev)}</div>
      <div class="kpi-foot">100% идёт мастеру</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-top"><span class="kpi-label">Авансы взятые</span><span style="font-size:18px;color:var(--accent-amber);">💳</span></div>
      <div class="kpi-value" style="font-size:20px;color:var(--accent-amber);">-${fmtMoney(adv)}</div>
      <div class="kpi-foot">Вычтено из начислений</div>
    </div>
    <div class="kpi-card" style="background:var(--accent-emerald-subtle);border-color:rgba(16,185,129,0.3);">
      <div class="kpi-top"><span class="kpi-label" style="color:var(--accent-emerald);">К ВЫПЛАТЕ НА РУКИ</span><span style="font-size:18px;">💰</span></div>
      <div class="kpi-value" style="font-size:24px;color:var(--accent-emerald);">${fmtMoney(net)}</div>
      <div class="kpi-foot" style="color:var(--accent-emerald);">Чистая сумма за месяц</div>
    </div>
  `;

  let tableHtml = '<thead><tr><th>Дата</th><th>Заказов</th><th>Выручка Печать</th><th>ЗП Печать (${rate}%)</th><th>Дизайн (100%)</th><th>ИТОГО НАЧИСЛЕНО</th></tr></thead><tbody>';
  history.forEach(h => {
    tableHtml += `<tr>
      <td><b>${h.date}</b></td>
      <td><span class="badge badge-success">${h.count} шт</span></td>
      <td class="num-cell">${fmtMoney(h.print)}</td>
      <td class="num-cell positive">${fmtMoney(h.printSal)}</td>
      <td class="num-cell" style="color:var(--primary)"><b>${fmtMoney(h.design)}</b></td>
      <td class="num-cell positive" style="font-size:15px;background:var(--primary-subtle);"><b>${fmtMoney(h.total)}</b></td>
    </tr>`;
  });
  if (!history.length) tableHtml += '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);">В этом месяце заказов пока не выполнялось</td></tr>';
  document.getElementById('portalHistoryTable').innerHTML = tableHtml + '</tbody>';
}

function openLoginModal() {
  document.getElementById('loginBackdrop').classList.add('active');
  updateLoginForm();
}

function logout() {
  openLoginModal();
}

function renderAllViews() {
  renderPosStation();
  renderOrdersTable();
  renderDailyView();
  renderMonthlyTable();
  renderDashboard();
  drawAnnualChart();
  renderPayrollTable();
  renderExpensesTable();
  renderDebtsTable();
  renderClientsView();
  renderInventoryView();
}

// HOTKEYS
window.addEventListener('keydown', e => {
  if(e.altKey && e.key === '1') navigateTo('express-pos');
  if(e.altKey && e.key === '2') navigateTo('orders');
  if(e.altKey && e.key.toLowerCase() === 'n') openOrderModal();
  if(e.key === 'Escape') closeOrderModal();
});

// AUTO-AUTH & IMMEDIATE BOOTSTRAP
let savedSess = sessionStorage.getItem('mp_auth_session');
if(savedSess) {
  try { currentUser = JSON.parse(savedSess); } catch(e) { currentUser = { role: 'admin', staffKey: null, name: 'Супер АДМИН' }; }
} else {
  currentUser = { role: 'admin', staffKey: null, name: 'Супер АДМИН' };
}
loginSuccess();