import { renderHome } from './components/home.component.js';
import { renderTransfer } from './components/transfer.component.js';
import { renderMessages } from './components/messages.component.js';
import { renderSettings } from './components/settings.component.js';
import { renderSecurityBadge } from './components/security.badge.component.js';
import { getState } from './core/state.js';

function router() {
    const app = document.getElementById('app');
    const hash = window.location.hash || '#home';
    
    app.innerHTML = '';

    // Inject Security Badge into header if present
    const headerBadgeContainer = document.getElementById('header-security-badge');
    if (headerBadgeContainer) {
        headerBadgeContainer.innerHTML = '';
        headerBadgeContainer.appendChild(renderSecurityBadge());
    }

    if (hash === '#home') {
        app.appendChild(renderHome());
    } else if (hash === '#transfer') {
        app.appendChild(renderTransfer());
    } else if (hash === '#messages') {
        app.appendChild(renderMessages());
    } else if (hash === '#settings') {
        app.appendChild(renderSettings());
    } else {
        app.appendChild(renderHome());
    }
}

window.addEventListener('hashchange', router);
window.addEventListener('load', () => {
    router();
});