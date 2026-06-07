/* js/ui.js */

import { DB, generateId } from './db.js';
import { Charts } from './charts.js';

export class UI {
  static currentTab = 'dashboard';
  static activeFilters = {
    search: '',
    type: 'all',
    category: 'all',
    account: 'all',
    dateRange: 'all'
  };
  
  static editingItem = {
    type: null, // 'account', 'category', 'transaction', 'recurring'
    data: null
  };

  static init() {
    // 1. Initial Render
    this.applyTheme();
    this.renderAll();
    this.populateSelectors();
    
    // 2. Navigation / Tab Router
    document.querySelectorAll('.nav-link, .mobile-nav-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const tabId = link.getAttribute('data-tab');
        this.navigateTo(tabId);
      });
    });

    // 3. Modal Controls
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
      btn.addEventListener('click', () => this.closeAllModals());
    });

    // Bind triggers for "Add" buttons
    this.bindModalTriggers();

    // 4. Form Submissions
    this.bindFormSubmissions();

    // 5. Transaction Filters
    this.bindFilters();

    // 6. Settings Actions
    this.bindSettings();
  }

  // --- NAVIGATION ---
  static navigateTo(tabId) {
    this.currentTab = tabId;
    
    // Update active nav links (sidebar & mobile-bar)
    document.querySelectorAll('.nav-link, .mobile-nav-link').forEach(link => {
      if (link.getAttribute('data-tab') === tabId) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    // Update visibility of views
    document.querySelectorAll('.view-section').forEach(section => {
      if (section.id === `view-${tabId}`) {
        section.classList.add('active');
      } else {
        section.classList.remove('active');
      }
    });

    // Update active header title
    const headerTitle = document.getElementById('active-header-title');
    if (headerTitle) {
      headerTitle.textContent = tabId.charAt(0).toUpperCase() + tabId.slice(1);
    }

    // Refresh rendering for target tab
    this.renderAll();
  }

  static renderAll() {
    this.renderGlobalSummaries();
    
    switch (this.currentTab) {
      case 'dashboard':
        this.renderDashboard();
        break;
      case 'accounts':
        this.renderAccounts();
        break;
      case 'transactions':
        this.renderTransactions();
        break;
      case 'budgets':
        this.renderBudgets();
        break;
      case 'recurring':
        this.renderRecurring();
        break;
      case 'settings':
        this.renderSettings();
        break;
    }
  }

  // --- GLOBAL HELPERS ---
  static formatCurrency(amount) {
    const settings = DB.getSettings();
    const currencySymbols = { USD: '$', EUR: '€', GBP: '£', JPY: '¥', CAD: 'CA$', AUD: 'A$', MYR: 'RM' };
    const symbol = currencySymbols[settings.currency] || '$';
    
    const fmt = Math.abs(amount).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    
    return amount < 0 ? `-${symbol}${fmt}` : `${symbol}${fmt}`;
  }

  static formatDate(dateStr) {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  static getAccountBadge(accountId) {
    const accounts = DB.getAccounts();
    const acc = accounts.find(a => a.id === accountId);
    if (!acc) return `<span class="badge badge-muted">Unknown</span>`;
    return `<span class="badge" style="background-color: ${acc.color}15; color: ${acc.color}; border: 1px solid ${acc.color}30">${acc.name}</span>`;
  }

  static getCategoryBadge(categoryId) {
    const categories = DB.getCategories();
    const cat = categories.find(c => c.id === categoryId);
    if (!cat) return `<span class="badge badge-muted">🏷️ Uncategorized</span>`;
    return `<span class="badge" style="background-color: ${cat.color}15; color: ${cat.color}; border: 1px solid ${cat.color}30">${cat.emoji} ${cat.name}</span>`;
  }

  static applyTheme() {
    const settings = DB.getSettings();
    document.documentElement.setAttribute('data-theme', settings.theme);
  }

  static renderGlobalSummaries() {
    const accounts = DB.getAccounts();
    const transactions = DB.getTransactions();
    
    // Net Worth (all combined)
    const netWorth = accounts.reduce((sum, a) => sum + parseFloat(a.balance), 0);
    const nwEl = document.getElementById('global-net-worth');
    if (nwEl) nwEl.textContent = this.formatCurrency(netWorth);

    // Monthly Income / Expense
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let incSum = 0;
    let expSum = 0;

    transactions.forEach(t => {
      const tDate = new Date(t.date + 'T00:00:00');
      if (tDate.getMonth() === currentMonth && tDate.getFullYear() === currentYear) {
        if (t.type === 'income') incSum += parseFloat(t.amount);
        if (t.type === 'expense') expSum += parseFloat(t.amount);
      }
    });

    const incEl = document.getElementById('global-monthly-income');
    const expEl = document.getElementById('global-monthly-expense');
    
    if (incEl) incEl.textContent = this.formatCurrency(incSum);
    if (expEl) expEl.textContent = this.formatCurrency(expSum);
  }

  // --- VIEW RENDERERS ---

  // 1. Dashboard
  static renderDashboard() {
    const transactions = DB.getTransactions();
    const categories = DB.getCategories();
    
    // Render Custom SVG charts
    Charts.renderAreaChart('dashboard-cashflow-chart', transactions, 30);
    Charts.renderDonutChart('dashboard-donut-chart', transactions, categories);

    // Render Recent Transactions (Last 5)
    const recentContainer = document.getElementById('dashboard-recent-activity');
    if (recentContainer) {
      const recent = [...transactions]
        .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
        .slice(0, 5);

      if (recent.length === 0) {
        recentContainer.innerHTML = `<div class="empty-list-state">No transactions yet. Add your first expense or income!</div>`;
        return;
      }

      let html = '<div class="activity-list">';
      recent.forEach(t => {
        const amtClass = t.type === 'income' ? 'amt-income' : (t.type === 'transfer' ? 'amt-transfer' : 'amt-expense');
        const amtPrefix = t.type === 'income' ? '+' : (t.type === 'transfer' ? '' : '-');
        
        let subText = this.getAccountBadge(t.accountId);
        if (t.type === 'transfer') {
          subText += ` ➔ ${this.getAccountBadge(t.toAccountId)}`;
        } else {
          subText += ` • ${this.getCategoryBadge(t.categoryId)}`;
        }

        html += `
          <div class="activity-item">
            <div class="activity-details">
              <span class="activity-desc">${escapeHtml(t.description)}</span>
              <span class="activity-meta">${subText}</span>
            </div>
            <div class="activity-right">
              <span class="activity-amount ${amtClass}">${amtPrefix}${this.formatCurrency(t.amount)}</span>
              <span class="activity-date">${this.formatDate(t.date)}</span>
            </div>
          </div>
        `;
      });
      html += '</div>';
      recentContainer.innerHTML = html;
    }
  }

  // 2. Accounts
  static renderAccounts() {
    const accounts = DB.getAccounts();
    const grid = document.getElementById('accounts-grid');
    if (!grid) return;

    let html = '';
    accounts.forEach(a => {
      const typeIcons = { checking: '🏦', savings: '🐷', credit: '💳', cash: '💵' };
      const icon = typeIcons[a.type] || '💰';
      
      html += `
        <div class="account-card" style="--card-acc-color: ${a.color}">
          <div class="account-card-glow" style="background: radial-gradient(circle at top right, ${a.color}20, transparent 60%)"></div>
          <div class="account-card-header">
            <span class="account-icon-badge">${icon}</span>
            <span class="account-type-label">${a.type.toUpperCase()}</span>
          </div>
          <h3 class="account-card-name">${escapeHtml(a.name)}</h3>
          <h2 class="account-card-balance">${this.formatCurrency(a.balance)}</h2>
          
          <div class="account-card-actions">
            <button class="btn-icon-action" data-action="edit-account" data-id="${a.id}" title="Edit Account">
              ✏️
            </button>
            <button class="btn-icon-action btn-danger-action" data-action="delete-account" data-id="${a.id}" title="Delete Account">
              🗑️
            </button>
          </div>
        </div>
      `;
    });

    grid.innerHTML = html;

    // Bind Edit/Delete Buttons
    grid.querySelectorAll('[data-action="edit-account"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openEditAccountModal(btn.getAttribute('data-id'));
      });
    });

    grid.querySelectorAll('[data-action="delete-account"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleDeleteAccount(btn.getAttribute('data-id'));
      });
    });
  }

  // 3. Transactions
  static renderTransactions() {
    const transactions = DB.getTransactions();
    const tableBody = document.getElementById('transactions-table-body');
    if (!tableBody) return;

    // Filter logic
    let filtered = [...transactions];

    if (this.activeFilters.search) {
      const query = this.activeFilters.search.toLowerCase();
      filtered = filtered.filter(t => t.description.toLowerCase().includes(query));
    }

    if (this.activeFilters.type !== 'all') {
      filtered = filtered.filter(t => t.type === this.activeFilters.type);
    }

    if (this.activeFilters.category !== 'all') {
      filtered = filtered.filter(t => t.categoryId === this.activeFilters.category);
    }

    if (this.activeFilters.account !== 'all') {
      filtered = filtered.filter(t => t.accountId === this.activeFilters.account || t.toAccountId === this.activeFilters.account);
    }

    if (this.activeFilters.dateRange !== 'all') {
      const today = new Date();
      today.setHours(0,0,0,0);
      
      filtered = filtered.filter(t => {
        const tDate = new Date(t.date + 'T00:00:00');
        if (this.activeFilters.dateRange === 'today') {
          return tDate.getTime() === today.getTime();
        } else if (this.activeFilters.dateRange === 'week') {
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          return tDate >= weekAgo;
        } else if (this.activeFilters.dateRange === 'month') {
          const monthAgo = new Date();
          monthAgo.setMonth(monthAgo.getMonth() - 1);
          return tDate >= monthAgo;
        }
        return true;
      });
    }

    // Sort descending by date
    filtered.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));

    if (filtered.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 30px; color: var(--text-muted);">
            No transactions match the selected filters.
          </td>
        </tr>
      `;
      return;
    }

    let html = '';
    filtered.forEach(t => {
      const amtClass = t.type === 'income' ? 'amt-income' : (t.type === 'transfer' ? 'amt-transfer' : 'amt-expense');
      const amtPrefix = t.type === 'income' ? '+' : (t.type === 'transfer' ? '' : '-');
      
      let sourceInfo = this.getAccountBadge(t.accountId);
      if (t.type === 'transfer') {
        sourceInfo += ` ➔ ${this.getAccountBadge(t.toAccountId)}`;
      }

      html += `
        <tr>
          <td>${this.formatDate(t.date)}</td>
          <td class="tx-cell-desc">${escapeHtml(t.description)} ${t.isRecurring ? '<span class="tx-rec-tag" title="Recurring Transaction">🔁</span>' : ''}</td>
          <td><span class="type-capsule type-${t.type}">${t.type.toUpperCase()}</span></td>
          <td>${sourceInfo}</td>
          <td>${t.type === 'transfer' ? '<span class="badge badge-muted">N/A</span>' : this.getCategoryBadge(t.categoryId)}</td>
          <td class="${amtClass}" style="font-weight: 600; text-align: right;">${amtPrefix}${this.formatCurrency(t.amount)}</td>
          <td style="text-align: center;">
            <div class="row-actions">
              <button class="btn-action-sm" data-action="edit-tx" data-id="${t.id}">✏️</button>
              <button class="btn-action-sm btn-danger-action" data-action="delete-tx" data-id="${t.id}">🗑️</button>
            </div>
          </td>
        </tr>
      `;
    });

    tableBody.innerHTML = html;

    // Bind triggers
    tableBody.querySelectorAll('[data-action="edit-tx"]').forEach(btn => {
      btn.addEventListener('click', () => this.openEditTransactionModal(btn.getAttribute('data-id')));
    });

    tableBody.querySelectorAll('[data-action="delete-tx"]').forEach(btn => {
      btn.addEventListener('click', () => this.handleDeleteTransaction(btn.getAttribute('data-id')));
    });
  }

  // 4. Budgets
  static renderBudgets() {
    const categories = DB.getCategories();
    const transactions = DB.getTransactions();
    const grid = document.getElementById('budgets-grid');
    if (!grid) return;

    // Filter current month transactions
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const expenses = transactions.filter(t => {
      if (t.type !== 'expense') return false;
      const tDate = new Date(t.date + 'T00:00:00');
      return tDate.getMonth() === currentMonth && tDate.getFullYear() === currentYear;
    });

    // Sum by category
    const catTotals = {};
    expenses.forEach(t => {
      const catId = t.categoryId || 'uncategorized';
      catTotals[catId] = (catTotals[catId] || 0) + parseFloat(t.amount);
    });

    let html = '';
    
    // Sort so categories with budgets come first
    const sortedCats = [...categories].sort((a, b) => b.limit - a.limit);

    sortedCats.forEach(c => {
      if (c.limit <= 0) return; // Skip non-budget categories (like Income)

      const spent = catTotals[c.id] || 0;
      const pct = Math.min((spent / c.limit) * 100, 100);
      
      // Determine health class
      let healthClass = 'budget-safe';
      if (spent >= c.limit) {
        healthClass = 'budget-danger';
      } else if (spent / c.limit >= 0.75) {
        healthClass = 'budget-warning';
      }

      html += `
        <div class="budget-card">
          <div class="budget-card-header">
            <span class="budget-emoji">${c.emoji}</span>
            <div class="budget-header-details">
              <h3 class="budget-category-name">${escapeHtml(c.name)}</h3>
              <span class="budget-amounts">
                <strong>${this.formatCurrency(spent)}</strong> of ${this.formatCurrency(c.limit)}
              </span>
            </div>
            <button class="btn-action-sm" data-action="edit-budget" data-id="${c.id}" title="Edit Target">✏️</button>
          </div>
          
          <div class="budget-progress-track">
            <div class="budget-progress-bar ${healthClass}" style="width: ${pct}%"></div>
          </div>
          
          <div class="budget-card-footer">
            <span class="budget-pct-text">${Math.round(spent / c.limit * 100)}% Used</span>
            <span class="budget-remaining-text">
              ${spent >= c.limit ? 
                `<span style="color: var(--danger); font-weight:700">Over by ${this.formatCurrency(spent - c.limit)}</span>` : 
                `Left: ${this.formatCurrency(c.limit - spent)}`}
            </span>
          </div>
        </div>
      `;
    });

    grid.innerHTML = html || `<div class="empty-list-state" style="grid-column: 1/-1;">No budgets configured. Edit a category to add a budget limit!</div>`;

    // Bind Edit Budgets
    grid.querySelectorAll('[data-action="edit-budget"]').forEach(btn => {
      btn.addEventListener('click', () => this.openEditCategoryModal(btn.getAttribute('data-id')));
    });
  }

  // 5. Recurring Transactions
  static renderRecurring() {
    const rules = DB.getRecurring();
    const grid = document.getElementById('recurring-grid');
    if (!grid) return;

    let html = '';
    rules.forEach(r => {
      const stateIcon = r.active ? '⏸️' : '▶️';
      const stateText = r.active ? 'Pause Rule' : 'Resume Rule';
      const typeCapsule = `<span class="type-capsule type-${r.type}">${r.type.toUpperCase()}</span>`;
      
      let badgeDetails = this.getAccountBadge(r.accountId);
      if (r.type === 'transfer') {
        badgeDetails += ` ➔ ${this.getAccountBadge(r.toAccountId)}`;
      } else {
        badgeDetails += ` • ${this.getCategoryBadge(r.categoryId)}`;
      }

      html += `
        <div class="recurring-card ${r.active ? '' : 'recurring-paused'}">
          <div class="recurring-card-header">
            <div class="recurring-title-block">
              <h3 class="recurring-desc">${escapeHtml(r.description)}</h3>
              <div style="margin-top: 4px; display: flex; align-items: center; gap: 8px;">
                ${typeCapsule}
                <span class="recurring-frequency-tag">🔁 ${r.frequency.toUpperCase()}</span>
              </div>
            </div>
            <div class="recurring-amount">${this.formatCurrency(r.amount)}</div>
          </div>
          
          <div class="recurring-card-body">
            <div class="recurring-meta-row">
              <span class="recurring-meta-label">Routing:</span>
              <span class="recurring-meta-val">${badgeDetails}</span>
            </div>
            <div class="recurring-meta-row">
              <span class="recurring-meta-label">Next Execution:</span>
              <span class="recurring-meta-val">${this.formatDate(r.nextDate)}</span>
            </div>
          </div>
          
          <div class="recurring-card-footer">
            <button class="btn-action-text" data-action="toggle-recurring" data-id="${r.id}">
              ${stateIcon} ${stateText}
            </button>
            <div class="recurring-footer-actions">
              <button class="btn-action-sm" data-action="edit-recurring" data-id="${r.id}">✏️</button>
              <button class="btn-action-sm btn-danger-action" data-action="delete-recurring" data-id="${r.id}">🗑️</button>
            </div>
          </div>
        </div>
      `;
    });

    grid.innerHTML = html || `<div class="empty-list-state" style="grid-column: 1/-1;">No recurring scheduling rules created. Set up bills, subscriptions, or salaries!</div>`;

    // Bind triggers
    grid.querySelectorAll('[data-action="toggle-recurring"]').forEach(btn => {
      btn.addEventListener('click', () => this.handleToggleRecurring(btn.getAttribute('data-id')));
    });

    grid.querySelectorAll('[data-action="edit-recurring"]').forEach(btn => {
      btn.addEventListener('click', () => this.openEditRecurringModal(btn.getAttribute('data-id')));
    });

    grid.querySelectorAll('[data-action="delete-recurring"]').forEach(btn => {
      btn.addEventListener('click', () => this.handleDeleteRecurring(btn.getAttribute('data-id')));
    });
  }

  // 6. Settings
  static renderSettings() {
    const settings = DB.getSettings();
    
    const currencySelect = document.getElementById('setting-currency');
    const themeSelect = document.getElementById('setting-theme');
    
    if (currencySelect) currencySelect.value = settings.currency;
    if (themeSelect) themeSelect.value = settings.theme;

    // Render Category Manager list under Settings (or configuration list)
    const catList = document.getElementById('settings-categories-list');
    if (catList) {
      const categories = DB.getCategories();
      let html = '';
      categories.forEach(c => {
        html += `
          <div class="category-settings-row">
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="cat-settings-emoji">${c.emoji}</span>
              <span class="cat-settings-name" style="font-weight:600; color:${c.color}">${escapeHtml(c.name)}</span>
              ${c.limit > 0 ? `<span class="cat-settings-limit">(Budget: ${this.formatCurrency(c.limit)})</span>` : ''}
            </div>
            <div style="display:flex; gap:6px;">
              <button class="btn-action-sm" data-action="edit-category" data-id="${c.id}">✏️</button>
              <button class="btn-action-sm btn-danger-action" data-action="delete-category" data-id="${c.id}">🗑️</button>
            </div>
          </div>
        `;
      });
      catList.innerHTML = html;

      // Bind category triggers
      catList.querySelectorAll('[data-action="edit-category"]').forEach(btn => {
        btn.addEventListener('click', () => this.openEditCategoryModal(btn.getAttribute('data-id')));
      });

      catList.querySelectorAll('[data-action="delete-category"]').forEach(btn => {
        btn.addEventListener('click', () => this.handleDeleteCategory(btn.getAttribute('data-id')));
      });
    }
  }

  // --- POPULATE FORM SELECTORS ---
  static populateSelectors() {
    const accounts = DB.getAccounts();
    const categories = DB.getCategories();

    // Accounts lists (Transactions)
    const txAcc = document.getElementById('tx-account');
    const txToAcc = document.getElementById('tx-to-account');
    const recAcc = document.getElementById('rec-account');
    const recToAcc = document.getElementById('rec-to-account');

    const fillAccountOptions = (el) => {
      if (!el) return;
      el.innerHTML = accounts.map(a => `<option value="${a.id}">${escapeHtml(a.name)} (${this.formatCurrency(a.balance)})</option>`).join('');
    };

    fillAccountOptions(txAcc);
    fillAccountOptions(txToAcc);
    fillAccountOptions(recAcc);
    fillAccountOptions(recToAcc);

    // Categories lists
    const txCat = document.getElementById('tx-category');
    const recCat = document.getElementById('rec-category');
    const filterCat = document.getElementById('filter-category');

    const fillCategoryOptions = (el, showAllOption = false) => {
      if (!el) return;
      let options = categories.map(c => `<option value="${c.id}">${c.emoji} ${escapeHtml(c.name)}</option>`).join('');
      if (showAllOption) {
        options = '<option value="all">All Categories</option>' + options;
      }
      el.innerHTML = options;
    };

    fillCategoryOptions(txCat);
    fillCategoryOptions(recCat);
    fillCategoryOptions(filterCat, true);

    // Accounts filter selector
    const filterAcc = document.getElementById('filter-account');
    if (filterAcc) {
      filterAcc.innerHTML = '<option value="all">All Accounts</option>' + 
        accounts.map(a => `<option value="${a.id}">${escapeHtml(a.name)}</option>`).join('');
    }
  }

  // --- MODAL CONTROLS & BINDINGS ---
  static openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('active');
    }
  }

  static closeAllModals() {
    document.querySelectorAll('.modal-overlay').forEach(modal => {
      modal.classList.remove('active');
    });
    // Reset forms
    document.querySelectorAll('.modal-overlay form').forEach(form => form.reset());
    
    // Hide transfer option by default
    const txToGroup = document.getElementById('tx-to-account-group');
    if (txToGroup) txToGroup.style.display = 'none';
    const recToGroup = document.getElementById('rec-to-account-group');
    if (recToGroup) recToGroup.style.display = 'none';

    this.editingItem = { type: null, data: null };
  }

  static bindModalTriggers() {
    const btnAddAcc = document.getElementById('btn-add-account');
    if (btnAddAcc) {
      btnAddAcc.addEventListener('click', () => {
        document.getElementById('modal-account-title').textContent = 'Add Account';
        this.openModal('modal-account');
      });
    }

    const btnAddTx = document.getElementById('btn-add-tx');
    if (btnAddTx) {
      btnAddTx.addEventListener('click', () => {
        document.getElementById('modal-transaction-title').textContent = 'Add Transaction';
        // Set default date to today
        const txDate = document.getElementById('tx-date');
        if (txDate) txDate.value = new Date().toISOString().split('T')[0];
        
        this.openModal('modal-transaction');
      });
    }

    const btnAddRec = document.getElementById('btn-add-recurring');
    if (btnAddRec) {
      btnAddRec.addEventListener('click', () => {
        document.getElementById('modal-recurring-title').textContent = 'Add Recurring Rule';
        const recNextDate = document.getElementById('rec-next-date');
        if (recNextDate) recNextDate.value = new Date().toISOString().split('T')[0];
        
        this.openModal('modal-recurring');
      });
    }

    const btnAddCat = document.getElementById('btn-add-category');
    if (btnAddCat) {
      btnAddCat.addEventListener('click', () => {
        document.getElementById('modal-category-title').textContent = 'Add Category';
        this.openModal('modal-category');
      });
    }

    // Toggle Transfer visual inputs dynamically
    const txType = document.getElementById('tx-type');
    if (txType) {
      txType.addEventListener('change', () => {
        const toGroup = document.getElementById('tx-to-account-group');
        const catGroup = document.getElementById('tx-category-group');
        
        if (txType.value === 'transfer') {
          if (toGroup) toGroup.style.display = 'block';
          if (catGroup) catGroup.style.display = 'none';
        } else {
          if (toGroup) toGroup.style.display = 'none';
          if (catGroup) catGroup.style.display = 'block';
        }
      });
    }

    const recType = document.getElementById('rec-type');
    if (recType) {
      recType.addEventListener('change', () => {
        const toGroup = document.getElementById('rec-to-account-group');
        const catGroup = document.getElementById('rec-category-group');
        
        if (recType.value === 'transfer') {
          if (toGroup) toGroup.style.display = 'block';
          if (catGroup) catGroup.style.display = 'none';
        } else {
          if (toGroup) toGroup.style.display = 'none';
          if (catGroup) catGroup.style.display = 'block';
        }
      });
    }
  }

  // --- ACTIONS: EDIT / DELETE ---
  static openEditAccountModal(id) {
    const acc = DB.getAccounts().find(a => a.id === id);
    if (!acc) return;

    this.editingItem = { type: 'account', data: acc };

    document.getElementById('modal-account-title').textContent = 'Edit Account';
    document.getElementById('acc-name').value = acc.name;
    document.getElementById('acc-type').value = acc.type;
    document.getElementById('acc-balance').value = acc.balance;
    document.getElementById('acc-color').value = acc.color;

    this.openModal('modal-account');
  }

  static handleDeleteAccount(id) {
    if (DB.getAccounts().length <= 1) {
      alert('You must have at least one account!');
      return;
    }
    if (confirm('Are you sure you want to delete this account? All associated transactions will also be permanently deleted.')) {
      DB.deleteAccount(id);
      this.populateSelectors();
      this.renderAll();
    }
  }

  static openEditCategoryModal(id) {
    const cat = DB.getCategories().find(c => c.id === id);
    if (!cat) return;

    this.editingItem = { type: 'category', data: cat };

    document.getElementById('modal-category-title').textContent = 'Edit Category';
    document.getElementById('cat-name').value = cat.name;
    document.getElementById('cat-emoji').value = cat.emoji;
    document.getElementById('cat-limit').value = cat.limit;
    document.getElementById('cat-color').value = cat.color;

    this.openModal('modal-category');
  }

  static handleDeleteCategory(id) {
    if (confirm('Are you sure you want to delete this category? Related transactions will be marked uncategorized.')) {
      DB.deleteCategory(id);
      this.populateSelectors();
      this.renderAll();
    }
  }

  static openEditTransactionModal(id) {
    const tx = DB.getTransactions().find(t => t.id === id);
    if (!tx) return;

    this.editingItem = { type: 'transaction', data: tx };

    document.getElementById('modal-transaction-title').textContent = 'Edit Transaction';
    document.getElementById('tx-date').value = tx.date;
    document.getElementById('tx-description').value = tx.description;
    document.getElementById('tx-type').value = tx.type;
    document.getElementById('tx-amount').value = tx.amount;
    document.getElementById('tx-account').value = tx.accountId;

    const toGroup = document.getElementById('tx-to-account-group');
    const catGroup = document.getElementById('tx-category-group');

    if (tx.type === 'transfer') {
      if (toGroup) {
        toGroup.style.display = 'block';
        document.getElementById('tx-to-account').value = tx.toAccountId;
      }
      if (catGroup) catGroup.style.display = 'none';
    } else {
      if (toGroup) toGroup.style.display = 'none';
      if (catGroup) {
        catGroup.style.display = 'block';
        document.getElementById('tx-category').value = tx.categoryId || '';
      }
    }

    this.openModal('modal-transaction');
  }

  static handleDeleteTransaction(id) {
    if (confirm('Are you sure you want to delete this transaction?')) {
      DB.deleteTransaction(id);
      this.renderAll();
    }
  }

  static openEditRecurringModal(id) {
    const rule = DB.getRecurring().find(r => r.id === id);
    if (!rule) return;

    this.editingItem = { type: 'recurring', data: rule };

    document.getElementById('modal-recurring-title').textContent = 'Edit Recurring Rule';
    document.getElementById('rec-description').value = rule.description;
    document.getElementById('rec-type').value = rule.type;
    document.getElementById('rec-amount').value = rule.amount;
    document.getElementById('rec-account').value = rule.accountId;
    document.getElementById('rec-frequency').value = rule.frequency;
    document.getElementById('rec-next-date').value = rule.nextDate;

    const toGroup = document.getElementById('rec-to-account-group');
    const catGroup = document.getElementById('rec-category-group');

    if (rule.type === 'transfer') {
      if (toGroup) {
        toGroup.style.display = 'block';
        document.getElementById('rec-to-account').value = rule.toAccountId;
      }
      if (catGroup) catGroup.style.display = 'none';
    } else {
      if (toGroup) toGroup.style.display = 'none';
      if (catGroup) {
        catGroup.style.display = 'block';
        document.getElementById('rec-category').value = rule.categoryId || '';
      }
    }

    this.openModal('modal-recurring');
  }

  static handleToggleRecurring(id) {
    const rules = DB.getRecurring();
    const idx = rules.findIndex(r => r.id === id);
    if (idx !== -1) {
      rules[idx].active = !rules[idx].active;
      DB.saveRecurring(rules[idx]);
      this.renderAll();
    }
  }

  static handleDeleteRecurring(id) {
    if (confirm('Are you sure you want to delete this recurring rule?')) {
      DB.deleteRecurring(id);
      this.renderAll();
    }
  }

  // --- FORM SUBMISSIONS ---
  static bindFormSubmissions() {
    // 1. Account Form
    const formAcc = document.getElementById('form-account');
    if (formAcc) {
      formAcc.addEventListener('submit', (e) => {
        e.preventDefault();
        const payload = {
          name: document.getElementById('acc-name').value,
          type: document.getElementById('acc-type').value,
          balance: parseFloat(document.getElementById('acc-balance').value),
          color: document.getElementById('acc-color').value
        };

        if (this.editingItem.type === 'account') {
          payload.id = this.editingItem.data.id;
        }

        DB.saveAccount(payload);
        this.closeAllModals();
        this.populateSelectors();
        this.renderAll();
      });
    }

    // 2. Category Form
    const formCat = document.getElementById('form-category');
    if (formCat) {
      formCat.addEventListener('submit', (e) => {
        e.preventDefault();
        const payload = {
          name: document.getElementById('cat-name').value,
          emoji: document.getElementById('cat-emoji').value || '🏷️',
          limit: parseFloat(document.getElementById('cat-limit').value) || 0,
          color: document.getElementById('cat-color').value
        };

        if (this.editingItem.type === 'category') {
          payload.id = this.editingItem.data.id;
        }

        DB.saveCategory(payload);
        this.closeAllModals();
        this.populateSelectors();
        this.renderAll();
      });
    }

    // 3. Transaction Form
    const formTx = document.getElementById('form-transaction');
    if (formTx) {
      formTx.addEventListener('submit', (e) => {
        e.preventDefault();
        const type = document.getElementById('tx-type').value;
        const payload = {
          date: document.getElementById('tx-date').value,
          description: document.getElementById('tx-description').value,
          type: type,
          amount: parseFloat(document.getElementById('tx-amount').value),
          accountId: document.getElementById('tx-account').value,
          toAccountId: type === 'transfer' ? document.getElementById('tx-to-account').value : null,
          categoryId: type !== 'transfer' ? document.getElementById('tx-category').value : null,
          isRecurring: this.editingItem.type === 'transaction' ? this.editingItem.data.isRecurring : false,
          recurringId: this.editingItem.type === 'transaction' ? this.editingItem.data.recurringId : null
        };

        if (payload.type === 'transfer' && payload.accountId === payload.toAccountId) {
          alert('Source and destination accounts must be different!');
          return;
        }

        if (this.editingItem.type === 'transaction') {
          payload.id = this.editingItem.data.id;
        }

        DB.saveTransaction(payload);
        this.closeAllModals();
        this.renderAll();
      });
    }

    // 4. Recurring Form
    const formRec = document.getElementById('form-recurring');
    if (formRec) {
      formRec.addEventListener('submit', (e) => {
        e.preventDefault();
        const type = document.getElementById('rec-type').value;
        const payload = {
          description: document.getElementById('rec-description').value,
          type: type,
          amount: parseFloat(document.getElementById('rec-amount').value),
          accountId: document.getElementById('rec-account').value,
          toAccountId: type === 'transfer' ? document.getElementById('rec-to-account').value : null,
          categoryId: type !== 'transfer' ? document.getElementById('rec-category').value : null,
          frequency: document.getElementById('rec-frequency').value,
          nextDate: document.getElementById('rec-next-date').value,
          active: this.editingItem.type === 'recurring' ? this.editingItem.data.active : true
        };

        if (payload.type === 'transfer' && payload.accountId === payload.toAccountId) {
          alert('Source and destination accounts must be different!');
          return;
        }

        if (this.editingItem.type === 'recurring') {
          payload.id = this.editingItem.data.id;
        }

        DB.saveRecurring(payload);
        this.closeAllModals();
        this.renderAll();
      });
    }
  }

  // --- FILTERS BINDINGS ---
  static bindFilters() {
    const search = document.getElementById('filter-search');
    const type = document.getElementById('filter-type');
    const cat = document.getElementById('filter-category');
    const acc = document.getElementById('filter-account');
    const dateRange = document.getElementById('filter-date');

    const triggerFilterUpdate = () => {
      this.activeFilters = {
        search: search ? search.value : '',
        type: type ? type.value : 'all',
        category: cat ? cat.value : 'all',
        account: acc ? acc.value : 'all',
        dateRange: dateRange ? dateRange.value : 'all'
      };
      this.renderTransactions();
    };

    if (search) search.addEventListener('input', triggerFilterUpdate);
    if (type) type.addEventListener('change', triggerFilterUpdate);
    if (cat) cat.addEventListener('change', triggerFilterUpdate);
    if (acc) acc.addEventListener('change', triggerFilterUpdate);
    if (dateRange) dateRange.addEventListener('change', triggerFilterUpdate);
  }

  // --- SETTINGS BINDINGS (CURRENCY, THEME, EXPORT, IMPORT) ---
  static bindSettings() {
    // 1. Currency Change
    const currencySelect = document.getElementById('setting-currency');
    if (currencySelect) {
      currencySelect.addEventListener('change', () => {
        const settings = DB.getSettings();
        settings.currency = currencySelect.value;
        DB.saveSettings(settings);
        this.renderAll();
      });
    }

    // 2. Theme Change
    const themeSelect = document.getElementById('setting-theme');
    if (themeSelect) {
      themeSelect.addEventListener('change', () => {
        const settings = DB.getSettings();
        settings.theme = themeSelect.value;
        DB.saveSettings(settings);
        this.applyTheme();
        this.renderAll();
      });
    }

    // 3. Export Data
    const btnExport = document.getElementById('btn-export-db');
    if (btnExport) {
      btnExport.addEventListener('click', () => {
        const data = DB.exportData();
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `budget_backup_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      });
    }

    // 4. Import Data
    const btnImport = document.getElementById('btn-import-db');
    const fileInput = document.getElementById('import-file-input');
    
    if (btnImport && fileInput) {
      btnImport.addEventListener('click', () => fileInput.click());
      
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
          const res = DB.importData(evt.target.result);
          if (res.success) {
            alert('Database restored successfully!');
            this.populateSelectors();
            this.renderAll();
          } else {
            alert(`Error restoring database: ${res.error}`);
          }
        };
        reader.readAsText(file);
      });
    }

    // 5. Clear Database
    const btnClear = document.getElementById('btn-clear-db');
    if (btnClear) {
      btnClear.addEventListener('click', () => {
        if (confirm('CRITICAL WARNING: This will permanently delete ALL transactions, categories, and accounts, restoring default mock data. Proceed?')) {
          localStorage.clear();
          DB.init();
          this.populateSelectors();
          this.renderAll();
          alert('Database reset complete.');
        }
      });
    }
  }
}

// Simple HTML escaping helper for inputs
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
