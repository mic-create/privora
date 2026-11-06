/**
 * PRIVORA Main Application Entry & Router
 * Manages client-side view routing, initialization safeguards, and error boundaries.
 */

import { renderHome } from './components/home.component.js';
import { renderTransfer } from './components/transfer.component.js';
import { renderMessages } from './components/messages.component.js';
import { renderSettings } from './components/settings.component.js';
import { renderSecurityBadge } from './components/security.badge.component.js';
import { showToast } from './utils/notifier.js';

function router() {
    const app = document.getElementById('app');
    if (!app) {
        console.error('[Fatal Error] Root #app element not found in DOM.');
        return;
    }

    const hash = window.location.hash || '#home';
    app.innerHTML = '';

    // Safely update header security badge if container exists
    try {
        const headerBadgeContainer = document.getElementById('header-security-badge');
        if (headerBadgeContainer) {
            headerBadgeContainer.innerHTML = '';
            headerBadgeContainer.appendChild(renderSecurityBadge());
        }
    } catch (badgeErr) {
        console.warn('[UI Warning] Failed to render security badge:', badgeErr);
    }

    try {
        let viewElement = null;
        if (hash === '#home') {
            viewElement = renderHome();
        } else if (hash === '#transfer') {
            viewElement = renderTransfer();
        } else if (hash === '#messages') {
            viewElement = renderMessages();
        } else if (hash === '#settings') {
            viewElement = renderSettings();
        } else {
            viewElement = renderHome();
        }

        if (viewElement instanceof HTMLElement) {
            app.appendChild(viewElement);
        } else {
            throw new Error('Route renderer did not return a valid HTMLElement.');
        }
    } catch (err) {
        console.error('[Router Error] Failed to render route:', hash, err);
        showToast('Failed to load view. Restoring default dashboard.', 'error');
        
        // Error boundary fallback UI
        const errorContainer = document.createElement('div');
        errorContainer.className = 'max-w-xl mx-auto p-6 bg-navy-900 border border-rose-500/40 rounded-2xl text-center space-y-4 my-12 animate-fade-in';
        errorContainer.innerHTML = `
            <div class="h-12 w-12 rounded-full bg-rose-500/20 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-400">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
            </div>
            <h3 class="text-sm font-semibold text-white">View Rendering Exception</h3>
            <p class="text-xs text-slate-400 font-mono">${err.message}</p>
            <button id="btn-return-home" class="px-4 py-2 bg-accent-600 hover:bg-accent-500 text-white rounded-xl text-xs font-medium transition-all">Return to Home</button>
        `;
        errorContainer.querySelector('#btn-return-home').addEventListener('click', () => {
            window.location.hash = '#home';
        });
        app.appendChild(errorContainer);
    }
}

window.addEventListener('hashchange', router);
window.addEventListener('load', () => {
    router();
});