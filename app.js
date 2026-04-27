// --- DATA MODELS & STATE ---
let habits = JSON.parse(localStorage.getItem('tracklytics_habits')) || [];
let habitLogs = JSON.parse(localStorage.getItem('tracklytics_habit_logs')) || {};
let completedDates = JSON.parse(localStorage.getItem('tracklytics_completed_dates')) || [];
let expenses = JSON.parse(localStorage.getItem('tracklytics_expenses')) || [];
let accounts = JSON.parse(localStorage.getItem('tracklytics_accounts')) || [];

let currentExpenseFilter = 'all';

// --- BACKEND API FUNCTIONS ---

async function fetchExpensesFromDB() {
    const res = await fetch("http://localhost:3000/expenses");
    return await res.json();
}

async function saveExpenseToDB(expense) {
    await fetch("http://localhost:3000/add-expense", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(expense)
    });
}
async function deleteExpenseFromDB(id) {
    await fetch(`http://localhost:3000/delete-expense/${id}`, {
        method: "DELETE"
    });
}
// --- CHART INSTANCES ---
let habitChartInstance = null;
let expensePieInstance = null;
let expenseBarInstance = null;
let expenseBankInstance = null;

// --- SELECTORS ---
const body = document.body;
const themeToggle = document.getElementById('theme-toggle');
const navItems = document.querySelectorAll('.nav-item');
const views = document.querySelectorAll('.view');
const currentViewTitle = document.getElementById('current-view-title');
const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
const sidebar = document.querySelector('.sidebar');

// Dashboard Selectors
const dashboardTaskList = document.getElementById('dashboard-task-list');
const todayDateDisplay = document.getElementById('today-date-display');
const completionCircle = document.getElementById('completion-circle');
const completionPercentage = document.getElementById('completion-percentage');
const completionText = document.getElementById('completion-text');
const streakCount = document.getElementById('streak-count');
const habitSelect = document.getElementById('habit-select');
const timeframeSelect = document.getElementById('timeframe-select');

// Manage Habits Selectors
const manageHabitList = document.getElementById('manage-habit-list');
const habitForm = document.getElementById('habit-form');
const habitTypeSelect = document.getElementById('habit-type');
const numericFields = document.querySelectorAll('.numeric-fields');

// Bank Accounts Selectors
const accountForm = document.getElementById('account-form');
const accountBank = document.getElementById('account-bank');
const accountLabel = document.getElementById('account-label');
const accountLast4 = document.getElementById('account-last4');
const accountList = document.getElementById('account-list');

// Expenses Selectors
const expenseForm = document.getElementById('expense-form');
const expenseList = document.getElementById('expense-list');
const todayExpenseTotal = document.getElementById('today-expense-total');
const monthExpenseTotal = document.getElementById('month-expense-total');
const expenseAccountSelect = document.getElementById('expense-account');
const expenseFilterBank = document.getElementById('expense-filter-bank');
const expenseSearch = document.getElementById('expense-search');
const expenseDateFilter = document.getElementById('expense-date-filter');
const noAccountsWarning = document.getElementById('no-accounts-warning');
const btnAddExpense = document.getElementById('btn-add-expense');

// --- UTILITIES ---
function calculateAccountBalance(accountId) {
    const account = accounts.find(a => a.id === accountId);
    if (!account) return 0;

    const spent = expenses
        .filter(e => e.accountId === accountId)
        .reduce((sum, e) => sum + parseFloat(e.amount), 0);

    return (account.balance || 0) - spent;
}
function getTodayDateString() {
    const d = new Date();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${month}-${day}`;
}

const formatRupee = (num) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(num);

function init() {
    // Theme
    const savedTheme = localStorage.getItem('tracklytics_theme') || 'dark';
    if (savedTheme === 'light') { 
        body.classList.remove('dark'); 
    } else { 
        body.classList.add('dark'); 
    }

    // UI Setup
    const options = { weekday: 'long', month: 'long', day: 'numeric' };
    todayDateDisplay.textContent = new Date().toLocaleDateString('en-US', options);
    document.getElementById('expense-date').value = getTodayDateString();

    renderAll();

    // 🔥 FETCH FROM DATABASE
    fetchExpensesFromDB().then(data => {
        expenses = data;
        renderExpenses();
        updateExpenseStats();
        updateExpenseCharts();
    });
}

function renderAll() {
    renderManageHabits();
    renderDashboardHabits();
    updateDashboardStats();
    updateHabitDropdown();
    updateHabitChart();
    
    renderAccounts();
    updateExpenseAccountDropdowns();
    
    renderExpenses();
    updateExpenseStats();
    updateExpenseCharts();
}

// --- DATA PERSISTENCE ---
function saveHabits() { localStorage.setItem('tracklytics_habits', JSON.stringify(habits)); }
function saveHabitLogs() { localStorage.setItem('tracklytics_habit_logs', JSON.stringify(habitLogs)); }
function saveCompletedDates() { localStorage.setItem('tracklytics_completed_dates', JSON.stringify(completedDates)); }
function saveExpenses() { localStorage.setItem('tracklytics_expenses', JSON.stringify(expenses)); }
function saveAccounts() { localStorage.setItem('tracklytics_accounts', JSON.stringify(accounts)); }

// --- EVENT LISTENERS ---

// Theme Toggle
themeToggle.addEventListener('click', () => {
    body.classList.toggle('dark');
    localStorage.setItem('tracklytics_theme', body.classList.contains('dark') ? 'dark' : 'light');
    updateHabitChart();
    updateExpenseCharts();
});

// Navigation
navItems.forEach(item => {
    item.addEventListener('click', () => {
        const targetId = item.dataset.target;
        navItems.forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');
        currentViewTitle.textContent = item.querySelector('span').textContent;
        views.forEach(view => {
            view.classList.remove('active');
            if (view.id === targetId) view.classList.add('active');
        });
        if(window.innerWidth <= 768) sidebar.classList.remove('open');
        updateHabitChart();
        updateExpenseCharts();
    });
});

mobileMenuBtn.addEventListener('click', () => { sidebar.classList.toggle('open'); });

// Form Toggles
habitTypeSelect.addEventListener('change', (e) => {
    const isNumeric = e.target.value === 'numeric';
    numericFields.forEach(el => el.style.display = isNumeric ? 'flex' : 'none');
    document.getElementById('habit-target').required = isNumeric;
});

// Create Habit
habitForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('habit-name').value.trim();
    const type = habitTypeSelect.value;
    const target = type === 'numeric' ? parseFloat(document.getElementById('habit-target').value) : null;
    const unit = type === 'numeric' ? document.getElementById('habit-unit').value.trim() : null;

    if (!name) return;

    const newHabit = { id: Date.now().toString(), name, type, target, unit, createdAt: getTodayDateString() };
    habits.push(newHabit);
    saveHabits();
    
    habitForm.reset();
    habitTypeSelect.dispatchEvent(new Event('change'));
    renderAll();
});

// Create Bank Account
accountForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const bank = accountBank.value.trim();
    const label = accountLabel.value.trim();
    const last4 = accountLast4.value.trim();
    const balance = parseFloat(document.getElementById('account-balance').value) || 0;

    accounts.push({ 
        id: Date.now().toString(), 
        bank, 
        label, 
        last4,
        balance   // 🔥 added
    });

    saveAccounts();
    accountForm.reset();
    renderAll();
});
// Expense Filter Change
const triggerExpenseFilters = () => {
    currentExpenseFilter = expenseFilterBank.value;
    renderExpenses();
    updateExpenseStats();
    updateExpenseCharts();
};
expenseFilterBank.addEventListener('change', triggerExpenseFilters);
expenseSearch.addEventListener('input', triggerExpenseFilters);
expenseDateFilter.addEventListener('change', triggerExpenseFilters);

// Add Expense
expenseForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (accounts.length === 0) return; // safety

    const amount = parseFloat(document.getElementById('expense-amount').value);
    const date = document.getElementById('expense-date').value;
    const accountId = expenseAccountSelect.value;
    const category = document.getElementById('expense-category').value;
    const notes = document.getElementById('expense-notes').value.trim();

    await saveExpenseToDB({
    amount,
    category,
    date,
    notes,
    accountId
});

// reload from DB
expenses = await fetchExpensesFromDB();
    
    document.getElementById('expense-amount').value = '';
    document.getElementById('expense-notes').value = '';
    
    // Refresh expenses
    renderExpenses();
    updateExpenseStats();
    updateExpenseCharts();
});

timeframeSelect.addEventListener('change', updateHabitChart);
habitSelect.addEventListener('change', updateHabitChart);


// --- HABITS LOGIC ---

function isHabitCompleted(habitId, dateStr) {
    const habit = habits.find(h => h.id === habitId);
    if (!habit || !habitLogs[dateStr] || habitLogs[dateStr][habitId] === undefined) return false;
    
    const val = habitLogs[dateStr][habitId];
    if (habit.type === 'boolean') return val === true;
    if (habit.type === 'numeric') return parseFloat(val) >= habit.target;
    return false;
}

window.toggleBooleanHabit = function(habitId) {
    const today = getTodayDateString();
    if (!habitLogs[today]) habitLogs[today] = {};
    habitLogs[today][habitId] = !habitLogs[today][habitId];
    saveHabitLogs();
    renderDashboardHabits();
    updateDashboardStats();
    updateHabitChart();
}

window.updateNumericHabit = function(habitId, val) {
    const today = getTodayDateString();
    if (!habitLogs[today]) habitLogs[today] = {};
    if (val === '' || isNaN(val)) {
        delete habitLogs[today][habitId];
    } else {
        habitLogs[today][habitId] = parseFloat(val);
    }
    saveHabitLogs();
    renderDashboardHabits();
    updateDashboardStats();
    updateHabitChart();
}

window.deleteHabit = function(id) {
    if(!confirm("Delete this habit? History will be kept.")) return;
    habits = habits.filter(h => h.id !== id);
    saveHabits();
    renderAll();
}

window.editHabit = function(id) {
    const habit = habits.find(h => h.id === id);
    if(!habit) return;
    const newName = prompt("Edit habit name:", habit.name);
    if (newName && newName.trim()) {
        habit.name = newName.trim();
        saveHabits();
        renderAll();
    }
}

function renderManageHabits() {
    manageHabitList.innerHTML = '';
    if (habits.length === 0) {
        manageHabitList.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 2rem;">No active habits.</p>';
        return;
    }

    habits.forEach(habit => {
        const div = document.createElement('div');
        div.className = 'task-item';
        div.innerHTML = `
            <div class="task-content">
                <div class="task-details">
                    <span class="task-text">${habit.name}</span>
                    <span class="task-meta">${habit.type === 'numeric' ? `Target: ${habit.target} ${habit.unit}` : 'Checkbox'}</span>
                </div>
            </div>
            <div class="task-actions">
                <button class="icon-btn" onclick="editHabit('${habit.id}')" aria-label="Edit">
                    <ion-icon name="create-outline"></ion-icon>
                </button>
                <button class="icon-btn delete" onclick="deleteHabit('${habit.id}')" aria-label="Delete">
                    <ion-icon name="trash-outline"></ion-icon>
                </button>
            </div>
        `;
        manageHabitList.appendChild(div);
    });
}

function renderDashboardHabits() {
    dashboardTaskList.innerHTML = '';
    const today = getTodayDateString();

    if (habits.length === 0) {
        dashboardTaskList.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 2rem;">No habits setup for today.</p>';
        return;
    }

    habits.forEach(habit => {
        const isCompleted = isHabitCompleted(habit.id, today);
        const div = document.createElement('div');
        div.className = `task-item ${isCompleted ? 'completed' : ''}`;
        
        let controlHtml = '';
        if (habit.type === 'boolean') {
            const checked = (habitLogs[today] && habitLogs[today][habit.id]) ? 'checked' : '';
            controlHtml = `<input type="checkbox" class="checkbox" ${checked} onchange="toggleBooleanHabit('${habit.id}')">`;
        } else {
            const val = (habitLogs[today] && habitLogs[today][habit.id] !== undefined) ? habitLogs[today][habit.id] : '';
            controlHtml = `
                <div class="numeric-input-wrapper">
                    <input type="number" step="any" value="${val}" onchange="updateNumericHabit('${habit.id}', this.value)" placeholder="0">
                    <span>/ ${habit.target} ${habit.unit || ''}</span>
                </div>
            `;
        }

        div.innerHTML = `
            <div class="task-content">
                ${habit.type === 'boolean' ? controlHtml : ''}
                <div class="task-details">
                    <span class="task-text">${habit.name}</span>
                </div>
            </div>
            ${habit.type === 'numeric' ? controlHtml : ''}
        `;
        dashboardTaskList.appendChild(div);
    });
}

function updateDashboardStats() {
    const today = getTodayDateString();
    const total = habits.length;
    let completedCount = 0;

    habits.forEach(h => { if (isHabitCompleted(h.id, today)) completedCount++; });

    const percent = total === 0 ? 0 : Math.round((completedCount / total) * 100);
    const offset = 251.2 - (percent / 100) * 251.2;
    completionCircle.style.strokeDashoffset = offset;
    
    completionPercentage.textContent = `${percent}%`;
    completionText.textContent = `${completedCount}/${total} Habits Completed`;

    const isTodayComplete = total > 0 && percent === 100;

    if (isTodayComplete) {
        if (!completedDates.includes(today)) {
            completedDates.push(today);
            completedDates.sort();
            saveCompletedDates();
        }
    } else {
        if (completedDates.includes(today)) {
            completedDates = completedDates.filter(d => d !== today);
            saveCompletedDates();
        }
    }

    let streak = 0;
    let checkDate = new Date(today);
    
    if (completedDates.includes(today)) {
        streak = 1;
        checkDate.setDate(checkDate.getDate() - 1);
    } else {
        checkDate.setDate(checkDate.getDate() - 1);
    }

    while (true) {
        const m = String(checkDate.getMonth() + 1).padStart(2, '0');
        const d = String(checkDate.getDate()).padStart(2, '0');
        const dateString = `${checkDate.getFullYear()}-${m}-${d}`;
        if (completedDates.includes(dateString)) {
            streak++;
            checkDate.setDate(checkDate.getDate() - 1);
        } else { break; }
    }
    
    streakCount.textContent = streak;
}


// --- BANK ACCOUNTS LOGIC ---

// --- BANK ACCOUNTS LOGIC ---

// ✅ DELETE ACCOUNT (separate function)
window.deleteAccount = async function(id) {

    // get latest expenses
    expenses = await fetchExpensesFromDB();

    if (expenses.some(e => e.accountId === id)) {
        alert("Cannot delete account: there are expenses linked to it.");
        return;
    }

    if (!confirm("Delete this bank account?")) return;

    accounts = accounts.filter(a => a.id !== id);
    saveAccounts();
    renderAll();
};


// ✅ DELETE EXPENSE (separate function)
window.deleteExpense = async function(id) {
    if (!confirm("Delete this expense?")) return;

    await deleteExpenseFromDB(id);

    expenses = await fetchExpensesFromDB();

    renderExpenses();
    updateExpenseStats();
    updateExpenseCharts();
};

function renderAccounts() {
    accountList.innerHTML = '';
    if (accounts.length === 0) {
        accountList.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 2rem;">No accounts added yet.</p>';
        return;
    }

    accounts.forEach(acc => {
        const div = document.createElement('div');
        div.className = 'task-item';
        div.innerHTML = `
            <div class="task-content">
                <div class="task-details">
                    <span class="task-text">${acc.bank} - ${acc.label}</span>
                    <span class="task-meta">
                        ending in •••• ${acc.last4} | Balance: ${formatRupee(calculateAccountBalance(acc.id))}
                    </span>
                </div>
            </div>
            <div class="task-actions">
                <button class="icon-btn delete" onclick="deleteAccount('${acc.id}')" aria-label="Delete">
                    <ion-icon name="trash-outline"></ion-icon>
                </button>
            </div>
        `;
        accountList.appendChild(div);
    });
}
function updateExpenseAccountDropdowns() {
    expenseAccountSelect.innerHTML = '';
    expenseFilterBank.innerHTML = '<option value="all">All Accounts</option>';

    if (accounts.length === 0) {
        noAccountsWarning.style.display = 'block';
        btnAddExpense.disabled = true;
        btnAddExpense.style.opacity = '0.5';
        return;
    }

    noAccountsWarning.style.display = 'none';
    btnAddExpense.disabled = false;
    btnAddExpense.style.opacity = '1';

    accounts.forEach(acc => {
        const option = document.createElement('option');
        option.value = acc.id;
        option.textContent = `${acc.bank} (${acc.label})`;
        expenseAccountSelect.appendChild(option);

        const filterOpt = document.createElement('option');
        filterOpt.value = acc.id;
        filterOpt.textContent = `${acc.bank} (${acc.label})`;
        expenseFilterBank.appendChild(filterOpt);
    });

    // ✅ restore filter selection
    if (currentExpenseFilter !== 'all' && accounts.find(a => a.id === currentExpenseFilter)) {
        expenseFilterBank.value = currentExpenseFilter;
    } else {
        currentExpenseFilter = 'all';
        expenseFilterBank.value = 'all';
    }
}


// --- EXPENSES LOGIC ---

function getFilteredExpenses() {
    let filtered = expenses;
    
    // 1. Bank Filter
    if (currentExpenseFilter !== 'all') {
        filtered = filtered.filter(e => e.accountId === currentExpenseFilter);
    }
    
    // 2. Search Filter
    const query = (expenseSearch.value || '').toLowerCase().trim();
    if (query) {
        filtered = filtered.filter(e => 
            e.category.toLowerCase().includes(query) || 
            (e.notes && e.notes.toLowerCase().includes(query))
        );
    }
    
    // 3. Date Filter
    const dateFilter = expenseDateFilter.value;
    if (dateFilter !== 'all') {
        const today = new Date();
        const limit = new Date();
        if (dateFilter === 'week') {
            limit.setDate(today.getDate() - 7);
        } else if (dateFilter === 'month') {
            limit.setMonth(today.getMonth() - 1);
        }
        limit.setHours(0,0,0,0);
        filtered = filtered.filter(e => {
            const expDate = new Date(e.date);
            expDate.setHours(0,0,0,0);
            return expDate >= limit;
        });
    }
    
    return filtered;
}


function renderExpenses() {
    expenseList.innerHTML = '';
    const filtered = getFilteredExpenses();
    const sorted = [...filtered].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    if (sorted.length === 0) {
        expenseList.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 2rem;">No expenses recorded.</p>';
        return;
    }

    sorted.slice(0, 30).forEach(exp => {
        const acc = accounts.find(a => a.id === exp.accountId);
        const bankName = acc ? acc.bank : 'Deleted Account';
        
        const div = document.createElement('div');
        div.className = 'expense-item';
        div.innerHTML = `
            <div class="expense-info">
                <div>
                    <span class="expense-cat">${exp.category}</span>
                    <span class="bank-badge">${bankName}</span>
                </div>
                <span class="expense-date-notes">${exp.date} ${exp.notes ? '• ' + exp.notes : ''}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 1rem;">
                <span class="expense-amount">${formatRupee(exp.amount)}</span>
                <button class="icon-btn delete" onclick="deleteExpense('${exp.id}')" aria-label="Delete">
                    <ion-icon name="trash-outline"></ion-icon>
                </button>
            </div>
        `;
        expenseList.appendChild(div);
    });
}

function updateExpenseStats() {
    const today = getTodayDateString();
    const currentMonth = today.substring(0, 7); 
    const filtered = getFilteredExpenses();

    let todayTotal = 0;
    let monthTotal = 0;

    filtered.forEach(e => {
        if (e.date === today) todayTotal += e.amount;
        if (e.date.startsWith(currentMonth)) monthTotal += e.amount;
    });

    todayExpenseTotal.textContent = formatRupee(todayTotal);
    monthExpenseTotal.textContent = formatRupee(monthTotal);
}


// --- CHARTJS INTEGRATION ---

const getChartColors = () => {
    const isDark = body.classList.contains('dark');
    return {
        text: isDark ? '#f8fafc' : '#1e293b',
        grid: isDark ? '#334155' : '#e2e8f0',
        primary: '#6366f1',
        secondary: '#0ea5e9'
    };
};

function updateHabitDropdown() {
    const prevVal = habitSelect.value;
    habitSelect.innerHTML = '';
    if(habits.length === 0) {
        habitSelect.innerHTML = '<option value="">No habits</option>';
        return;
    }
    habits.forEach(h => {
        const opt = document.createElement('option');
        opt.value = h.id;
        opt.textContent = h.name;
        habitSelect.appendChild(opt);
    });
    if(prevVal && habits.find(h=>h.id === prevVal)) habitSelect.value = prevVal;
}

function updateHabitChart() {
    if (!document.getElementById('habitChart')) return;
    if (habitChartInstance) habitChartInstance.destroy();

    const habitId = habitSelect.value;
    if (!habitId) return;

    const habit = habits.find(h => h.id === habitId);
    if(!habit) return;

    const timeframe = timeframeSelect.value;
    let daysToShow = timeframe === 'yearly' ? 365 : (timeframe === 'monthly' ? 30 : 7);

    const labels = [];
    const dataPoints = [];
    const today = new Date();

    for (let i = daysToShow - 1; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const dayStr = String(d.getDate()).padStart(2, '0');
        const dateString = `${d.getFullYear()}-${m}-${dayStr}`;
        
        labels.push(`${m}/${dayStr}`);
        
        let val = 0;
        if (habitLogs[dateString] && habitLogs[dateString][habitId] !== undefined) {
            val = habit.type === 'boolean' ? (habitLogs[dateString][habitId] ? 1 : 0) : habitLogs[dateString][habitId];
        }
        dataPoints.push(val);
    }

    const colors = getChartColors();
    const ctx = document.getElementById('habitChart').getContext('2d');

    habitChartInstance = new Chart(ctx, {
        type: habit.type === 'boolean' ? 'bar' : 'line',
        data: {
            labels: labels,
            datasets: [{
                label: habit.type === 'boolean' ? 'Completed' : `${habit.name} (${habit.unit})`,
                data: dataPoints,
                borderColor: colors.primary,
                backgroundColor: habit.type === 'boolean' ? colors.primary : 'rgba(99, 102, 241, 0.2)',
                borderWidth: 2,
                tension: 0.3,
                fill: habit.type === 'numeric'
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, max: habit.type === 'boolean' ? 1 : undefined, ticks: { color: colors.text }, grid: { color: colors.grid } },
                x: { ticks: { color: colors.text }, grid: { color: colors.grid } }
            },
            plugins: { legend: { labels: { color: colors.text } } }
        }
    });
}

function updateExpenseCharts() {
    if (!document.getElementById('expensePieChart')) return;

    if (expensePieInstance) expensePieInstance.destroy();
    if (expenseBarInstance) expenseBarInstance.destroy();
    if (expenseBankInstance) expenseBankInstance.destroy();

    const filtered = getFilteredExpenses();
    const bgColors = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
    const colors = getChartColors();

    // 1. PIE CHART (Categories)
    const categoryTotals = {};
    filtered.forEach(e => { categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount; });

    let pieLabels = Object.keys(categoryTotals);
    let pieData = Object.values(categoryTotals);
    let pieBgColors = bgColors;

    if (filtered.length === 0) {
        pieLabels = ['No Expenses Yet'];
        pieData = [1];
        pieBgColors = [body.classList.contains('dark') ? '#334155' : '#e2e8f0'];
    }

    expensePieInstance = new Chart(document.getElementById('expensePieChart').getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: pieLabels,
            datasets: [{ data: pieData, backgroundColor: pieBgColors, borderWidth: 0 }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { 
                legend: { position: 'right', labels: { color: colors.text, padding: 15 } },
                tooltip: { enabled: filtered.length > 0 }
            }
        }
    });

    // 2. BAR CHART (Months)
    const monthTotals = {};
    filtered.forEach(e => {
        const month = e.date.substring(0, 7);
        monthTotals[month] = (monthTotals[month] || 0) + e.amount;
    });
    const sortedMonths = Object.keys(monthTotals).sort();

    expenseBarInstance = new Chart(document.getElementById('expenseBarChart').getContext('2d'), {
        type: 'bar',
        data: {
            labels: sortedMonths,
            datasets: [{ label: 'Monthly Spending', data: sortedMonths.map(m => monthTotals[m]), backgroundColor: colors.secondary, borderRadius: 4 }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
                y: { ticks: { color: colors.text, callback: function(value) { return '₹' + value; } }, grid: { color: colors.grid } },
                x: { ticks: { color: colors.text }, grid: { display: false } }
            },
            plugins: { legend: { labels: { color: colors.text } } }
        }
    });

    // 3. BAR CHART (Bank-wise)
    const bankTotals = {};
    filtered.forEach(e => {
        const acc = accounts.find(a => a.id === e.accountId);
        const name = acc ? acc.bank : 'Unknown';
        bankTotals[name] = (bankTotals[name] || 0) + e.amount;
    });

    expenseBankInstance = new Chart(document.getElementById('expenseBankChart').getContext('2d'), {
        type: 'bar',
        data: {
            labels: Object.keys(bankTotals),
            datasets: [{ label: 'Spending by Bank', data: Object.values(bankTotals), backgroundColor: '#10b981', borderRadius: 4 }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
                y: { ticks: { color: colors.text, callback: function(value) { return '₹' + value; } }, grid: { color: colors.grid } },
                x: { ticks: { color: colors.text }, grid: { display: false } }
            },
            plugins: { legend: { labels: { color: colors.text } } }
        }
    });
}

// Start
init();
