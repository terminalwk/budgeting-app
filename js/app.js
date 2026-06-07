/* js/app.js */

import { DB } from './db.js';
import { UI } from './ui.js';

// Wait for DOM to load fully
document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize local storage schema and dummy dataset
  DB.init();

  // 2. Run the scheduler check for overdue recurring entries
  const triggered = DB.processRecurring();
  if (triggered) {
    console.log('Processed recurring transactions: Database updated.');
  }

  // 3. Mount UI logic, triggers, routing hooks, and render
  UI.init();

  // 4. Register Progressive Web App Service Worker for offline capability
  registerServiceWorker();
});

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then(reg => {
          console.log('Service Worker registered successfully with scope: ', reg.scope);
        })
        .catch(err => {
          console.error('Service Worker registration failed: ', err);
        });
    });
  }
}
