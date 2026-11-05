import { initRouter } from './core/router.js';
import { initState, getState } from './core/state.js';
import { initModalComponent } from './components/modal.component.js';
import { initThemeToggle } from './utils/dom.js';
import { showToast } from './utils/notifier.js';

document.addEventListener('DOMContentLoaded', () => {
    console.log('[PRIVORA] Initializing Frontend Foundation v1.0.0');

    // Initialize state
    initState();

    // Initialize Theme & UI toggles
    initThemeToggle();

    // Initialize Global Modals
    initModalComponent();

    // Initialize Client-side Router
    initRouter();

    // Bind Global Header Action Buttons
    document.getElementById('btn-quick-start').addEventListener('click', () => {
        window.location.hash = '#transfer';
        showToast('Secure session workspace ready. Create or join a room.', 'info');
    });

    document.getElementById('btn-quick-join').addEventListener('click', () => {
        window.location.hash = '#transfer';
        showToast('Enter a room code or invitation link to connect.', 'info');
    });
});