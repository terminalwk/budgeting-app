/* js/db.js */

// Helper to generate unique IDs
export function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

// Initial Data Structure
const DEFAULT_CATEGORIES = [
  { id: 'cat-housing', name: 'Housing & Rent', emoji: '🏠', limit: 1500, color: '#6366f1' },
  { id: 'cat-food', name: 'Food & Dining', emoji: '🍔', limit: 450, color: '#f59e0b' },
  { id: 'cat-transport', name: 'Transportation', emoji: '🚗', limit: 200, color: '#06b6d4' },
  { id: 'cat-entertainment', name: 'Entertainment', emoji: '🎬', limit: 150, color: '#d946ef' },
  { id: 'cat-utilities', name: 'Utilities', emoji: '⚡', limit: 300, color: '#ec4899' },
  { id: 'cat-income', name: 'Salary & Income', emoji: '💰', limit: 0, color: '#10b981' }
];

const DEFAULT_ACCOUNTS = [
  { id: 'acc-checking', name: 'Main Checking', type: 'checking', balance: 2450.00, color: '#6366f1' },
  { id: 'acc-savings', name: 'High-Yield Savings', type: 'savings', balance: 12500.00, color: '#10b981' },
  { id: 'acc-credit', name: 'Visa Credit Card', type: 'credit', balance: -320.00, color: '#f43f5e' }
];

// Helper to get date relative to today
function getRelativeDateString(daysAgo) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().split('T')[0];
}

const DEFAULT_TRANSACTIONS = [
  {
    id: 't-1',
    date: getRelativeDateString(5),
    description: 'Monthly Rent Payment',
    type: 'expense',
    amount: 1200.00,
    categoryId: 'cat-housing',
    accountId: 'acc-checking',
    toAccountId: null,
    isRecurring: false,
    recurringId: null
  },
  {
    id: 't-2',
    date: getRelativeDateString(3),
    description: 'Bi-Weekly Paycheck',
    type: 'income',
    amount: 2250.00,
    categoryId: 'cat-income',
    accountId: 'acc-checking',
    toAccountId: null,
    isRecurring: false,
    recurringId: null
  },
  {
    id: 't-3',
    date: getRelativeDateString(2),
    description: 'Whole Foods Grocery',
    type: 'expense',
    amount: 112.40,
    categoryId: 'cat-food',
    accountId: 'acc-checking',
    toAccountId: null,
    isRecurring: false,
    recurringId: null
  },
  {
    id: 't-4',
    date: getRelativeDateString(1),
    description: 'Savings Transfer',
    type: 'transfer',
    amount: 500.00,
    categoryId: null,
    accountId: 'acc-checking',
    toAccountId: 'acc-savings',
    isRecurring: false,
    recurringId: null
  },
  {
    id: 't-5',
    date: getRelativeDateString(0),
    description: 'Netflix Premium',
    type: 'expense',
    amount: 22.99,
    categoryId: 'cat-entertainment',
    accountId: 'acc-credit',
    toAccountId: null,
    isRecurring: true,
    recurringId: 'rec-netflix'
  }
];

const DEFAULT_RECURRING = [
  {
    id: 'rec-netflix',
    description: 'Netflix Premium',
    type: 'expense',
    amount: 22.99,
    categoryId: 'cat-entertainment',
    accountId: 'acc-credit',
    toAccountId: null,
    frequency: 'monthly',
    nextDate: getRelativeDateString(-30), // Due today or recently
    active: true
  },
  {
    id: 'rec-gym',
    description: 'Equinox Gym',
    type: 'expense',
    amount: 85.00,
    categoryId: 'cat-entertainment',
    accountId: 'acc-checking',
    toAccountId: null,
    frequency: 'monthly',
    nextDate: getRelativeDateString(-15),
    active: true
  }
];

export class DB {
  static init() {
    if (!localStorage.getItem('accounts')) {
      localStorage.setItem('accounts', JSON.stringify(DEFAULT_ACCOUNTS));
    }
    if (!localStorage.getItem('categories')) {
      localStorage.setItem('categories', JSON.stringify(DEFAULT_CATEGORIES));
    }
    if (!localStorage.getItem('transactions')) {
      localStorage.setItem('transactions', JSON.stringify(DEFAULT_TRANSACTIONS));
    }
    if (!localStorage.getItem('recurring')) {
      localStorage.setItem('recurring', JSON.stringify(DEFAULT_RECURRING));
    }
    if (!localStorage.getItem('settings')) {
      localStorage.setItem('settings', JSON.stringify({ currency: 'USD', theme: 'dark' }));
    }
  }

  // --- ACCOUNTS ---
  static getAccounts() {
    return JSON.parse(localStorage.getItem('accounts') || '[]');
  }

  static saveAccount(account) {
    const accounts = this.getAccounts();
    if (account.id) {
      const idx = accounts.findIndex(a => a.id === account.id);
      if (idx !== -1) accounts[idx] = account;
    } else {
      account.id = 'acc-' + generateId();
      accounts.push(account);
    }
    localStorage.setItem('accounts', JSON.stringify(accounts));
    return account;
  }

  static deleteAccount(id) {
    let accounts = this.getAccounts();
    accounts = accounts.filter(a => a.id !== id);
    localStorage.setItem('accounts', JSON.stringify(accounts));
    
    // Cleanup related transactions
    let transactions = this.getTransactions();
    transactions = transactions.filter(t => t.accountId !== id && t.toAccountId !== id);
    localStorage.setItem('transactions', JSON.stringify(transactions));
  }

  // --- CATEGORIES ---
  static getCategories() {
    return JSON.parse(localStorage.getItem('categories') || '[]');
  }

  static saveCategory(category) {
    const categories = this.getCategories();
    if (category.id) {
      const idx = categories.findIndex(c => c.id === category.id);
      if (idx !== -1) categories[idx] = category;
    } else {
      category.id = 'cat-' + generateId();
      categories.push(category);
    }
    localStorage.setItem('categories', JSON.stringify(categories));
    return category;
  }

  static deleteCategory(id) {
    let categories = this.getCategories();
    categories = categories.filter(c => c.id !== id);
    localStorage.setItem('categories', JSON.stringify(categories));
    
    // Assign transactions with deleted category to null
    const transactions = this.getTransactions();
    transactions.forEach(t => {
      if (t.categoryId === id) t.categoryId = null;
    });
    localStorage.setItem('transactions', JSON.stringify(transactions));
  }

  // --- TRANSACTIONS ---
  static getTransactions() {
    return JSON.parse(localStorage.getItem('transactions') || '[]');
  }

  static saveTransaction(transaction, adjustBalances = true) {
    const transactions = this.getTransactions();
    let oldTx = null;

    if (transaction.id) {
      const idx = transactions.findIndex(t => t.id === transaction.id);
      if (idx !== -1) {
        oldTx = transactions[idx];
        transactions[idx] = transaction;
      }
    } else {
      transaction.id = 't-' + generateId();
      transactions.push(transaction);
    }

    localStorage.setItem('transactions', JSON.stringify(transactions));

    if (adjustBalances) {
      this.reconcileBalances(oldTx, transaction);
    }

    return transaction;
  }

  static deleteTransaction(id, adjustBalances = true) {
    const transactions = this.getTransactions();
    const idx = transactions.findIndex(t => t.id === id);
    if (idx !== -1) {
      const oldTx = transactions[idx];
      transactions.splice(idx, 1);
      localStorage.setItem('transactions', JSON.stringify(transactions));
      
      if (adjustBalances) {
        this.reconcileBalances(oldTx, null);
      }
    }
  }

  // --- RECURRING ---
  static getRecurring() {
    return JSON.parse(localStorage.getItem('recurring') || '[]');
  }

  static saveRecurring(rule) {
    const recurring = this.getRecurring();
    if (rule.id) {
      const idx = recurring.findIndex(r => r.id === rule.id);
      if (idx !== -1) recurring[idx] = rule;
    } else {
      rule.id = 'rec-' + generateId();
      recurring.push(rule);
    }
    localStorage.setItem('recurring', JSON.stringify(recurring));
    return rule;
  }

  static deleteRecurring(id) {
    let recurring = this.getRecurring();
    recurring = recurring.filter(r => r.id !== id);
    localStorage.setItem('recurring', JSON.stringify(recurring));
  }

  // --- SETTINGS ---
  static getSettings() {
    return JSON.parse(localStorage.getItem('settings') || '{"currency":"USD","theme":"dark"}');
  }

  static saveSettings(settings) {
    localStorage.setItem('settings', JSON.stringify(settings));
  }

  // --- DATABASE SYNC / DATA EXPORT & IMPORT ---
  static exportData() {
    const data = {
      accounts: this.getAccounts(),
      categories: this.getCategories(),
      transactions: this.getTransactions(),
      recurring: this.getRecurring(),
      settings: this.getSettings(),
      version: '1.0.0',
      exportedAt: new Date().toISOString()
    };
    return JSON.stringify(data, null, 2);
  }

  static importData(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      if (data.accounts && data.categories && data.transactions && data.recurring) {
        localStorage.setItem('accounts', JSON.stringify(data.accounts));
        localStorage.setItem('categories', JSON.stringify(data.categories));
        localStorage.setItem('transactions', JSON.stringify(data.transactions));
        localStorage.setItem('recurring', JSON.stringify(data.recurring));
        if (data.settings) {
          localStorage.setItem('settings', JSON.stringify(data.settings));
        }
        return { success: true };
      }
      return { success: false, error: 'Invalid file format structure.' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  // --- SYSTEM LOGIC: RECONCILE ACCOUNT BALANCES ---
  // Compares old and new state of a transaction and shifts balances accordingly.
  static reconcileBalances(oldTx, newTx) {
    const accounts = this.getAccounts();
    const adjust = (accId, amt) => {
      const acc = accounts.find(a => a.id === accId);
      if (acc) {
        acc.balance = parseFloat((acc.balance + amt).toFixed(2));
      }
    };

    // Revert old transaction balances
    if (oldTx) {
      const amt = parseFloat(oldTx.amount);
      if (oldTx.type === 'expense') {
        adjust(oldTx.accountId, amt); // Add back the expense
      } else if (oldTx.type === 'income') {
        adjust(oldTx.accountId, -amt); // Subtract the income
      } else if (oldTx.type === 'transfer') {
        adjust(oldTx.accountId, amt); // Add back to source
        if (oldTx.toAccountId) {
          adjust(oldTx.toAccountId, -amt); // Deduct from target
        }
      }
    }

    // Apply new transaction balances
    if (newTx) {
      const amt = parseFloat(newTx.amount);
      if (newTx.type === 'expense') {
        adjust(newTx.accountId, -amt); // Deduct expense
      } else if (newTx.type === 'income') {
        adjust(newTx.accountId, amt); // Add income
      } else if (newTx.type === 'transfer') {
        adjust(newTx.accountId, -amt); // Deduct from source
        if (newTx.toAccountId) {
          adjust(newTx.toAccountId, amt); // Add to target
        }
      }
    }

    localStorage.setItem('accounts', JSON.stringify(accounts));
  }

  // --- SYSTEM LOGIC: PROCESS RECURRING TRANSACTIONS ---
  // Loops through active recurring bills/goals and inserts entries if due.
  static processRecurring() {
    const recurring = this.getRecurring();
    const transactions = this.getTransactions();
    const today = new Date();
    today.setHours(0,0,0,0);
    
    let dbUpdated = false;

    recurring.forEach(rule => {
      if (!rule.active) return;

      let nextDate = new Date(rule.nextDate + 'T00:00:00');
      
      // Keep adding transactions while the next execution date is in the past or today
      while (nextDate <= today) {
        // Create new transaction entries
        const newTx = {
          id: 't-' + generateId(),
          date: nextDate.toISOString().split('T')[0],
          description: rule.description,
          type: rule.type,
          amount: rule.amount,
          categoryId: rule.categoryId,
          accountId: rule.accountId,
          toAccountId: rule.toAccountId,
          isRecurring: true,
          recurringId: rule.id
        };

        transactions.push(newTx);
        this.reconcileBalances(null, newTx); // Adjust accounts directly
        dbUpdated = true;

        // Calculate next date based on frequency
        if (rule.frequency === 'daily') {
          nextDate.setDate(nextDate.getDate() + 1);
        } else if (rule.frequency === 'weekly') {
          nextDate.setDate(nextDate.getDate() + 7);
        } else if (rule.frequency === 'monthly') {
          nextDate.setMonth(nextDate.getMonth() + 1);
        } else if (rule.frequency === 'yearly') {
          nextDate.setFullYear(nextDate.getFullYear() + 1);
        }
      }

      // Update the next execution date
      rule.nextDate = nextDate.toISOString().split('T')[0];
    });

    if (dbUpdated) {
      localStorage.setItem('transactions', JSON.stringify(transactions));
      localStorage.setItem('recurring', JSON.stringify(recurring));
    }
    
    return dbUpdated;
  }
}
