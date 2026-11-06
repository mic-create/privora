import { getState, setState, subscribe } from './core/state.js';
import { rtcManager } from './network/webrtc.manager.js';
import { renderDashboard } from './components/dashboard.component.js';
import { renderTransfer } from './components/transfer.component.js';
import { renderMessages } from './components/messages.component.js';
import { renderActivity } from './components/activity.component.js';
import { renderSettings } from './components/settings.component.js';
import { showToast } from './utils/notifier.js';

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

function initializeApp() {
    console.log('[PRIVORA] Initializing application core...');
    setupNavigation();
    setupSessionListeners();
    setupRtcEventListeners();
    setupVisibilityHandler();

    handleRoute();
    window.addEventListener('hashchange', handleRoute);
}

function setupNavigation() {
    const navLinks = document.querySelectorAll('[data-route], .sidebar-link, a[href^="#"]');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const href = link.getAttribute('href') || `#${link.getAttribute('data-route')}`;
            if (href && href.startsWith('#')) {
                // Let hash routing handle it natively
            }
        });
    });
}

function setupVisibilityHandler() {
    document.addEventListener('visibilitychange', async () => {
        if (document.visibilityState === 'visible') {
            console.log('[PRIVORA] App returned to foreground. Syncing signaling...');
            
            // If socket was severed by background mobile OS, restore it and rejoin room state
            if (!rtcManager.signalingClient.isConnected) {
                try {
                    await rtcManager.signalingClient.connect();
                    rtcManager.signalingClient.rejoinSession();
                } catch (err) {
                    console.warn('[PRIVORA] Background reconnection attempt failed:', err);
                }
            }
        }
    });
}

function handleRoute() {
    const hash = window.location.hash.substring(1) || 'dashboard';
    
    let container = document.getElementById('app-view') || document.getElementById('view-container') || document.getElementById('main-content-area');
    
    if (!container) {
        container = document.querySelector('main') || document.querySelector('.md\\:col-span-3') || document.querySelector('div.flex-1');
    }

    if (!container) {
        console.warn('[PRIVORA] View container not found in DOM.');
        return;
    }

    setState({ currentView: hash });
    container.innerHTML = '';

    // Route handling mapped to actual component functions
    if (hash === 'dashboard' || hash === '') {
        container.appendChild(renderDashboard());
    } else if (hash === 'transfer') {
        container.appendChild(renderTransfer());
    } else if (hash === 'messages') {
        container.appendChild(renderMessages());
    } else if (hash === 'activity') {
        container.appendChild(renderActivity());
    } else if (hash === 'settings' || hash === 'privacy') {
        const settingsContainer = document.createElement('div');
        settingsContainer.className = 'p-6 bg-white border border-slate-200 rounded-2xl text-slate-800 shadow-xs';
        renderSettings(settingsContainer);
        container.appendChild(settingsContainer);
    } else {
        container.innerHTML = `
            <div class="p-8 text-center text-slate-500">
                <h3 class="text-sm font-semibold text-slate-900 mb-1">Page Not Found</h3>
                <p class="text-xs">The requested view '${hash}' does not exist.</p>
                <a href="#dashboard" class="inline-block mt-4 px-4 py-2 bg-accent-600 text-white text-xs rounded-xl shadow-md">Return to Dashboard</a>
            </div>
        `;
    }
}

function setupSessionListeners() {
    subscribe((state) => {
        const statusBadge = document.getElementById('sidebar-status-badge');
        if (statusBadge) {
            const isConnected = state.session.isConnected;
            statusBadge.textContent = isConnected ? 'Active' : 'Standby';
            statusBadge.className = `text-[10px] font-mono ${isConnected ? 'text-emerald-600' : 'text-amber-600'}`;
        }
    });
}

function setupRtcEventListeners() {
    rtcManager.on('room_created', (roomId) => {
        setState({ session: { ...getState().session, roomId, isHost: true } });
        showToast(`Room created: #${roomId}`, 'success');
    });

    rtcManager.on('room_joined', (roomId) => {
        setState({ session: { ...getState().session, roomId, isHost: false } });
        showToast(`Joined room: #${roomId}`, 'success');
    });

    rtcManager.on('datachannel_open', () => {
        setState({ session: { ...getState().session, isConnected: true } });
        handleRoute();
    });

    rtcManager.on('datachannel_close', () => {
        setState({ session: { ...getState().session, isConnected: false } });
        showToast('Secure connection closed', 'info');
        handleRoute();
    });

    rtcManager.on('connection_state_change', (state) => {
        if (state === 'connected') {
            setState({ session: { ...getState().session, isConnected: true } });
            handleRoute();
        } else if (state === 'failed') {
            setState({ session: { ...getState().session, isConnected: false } });
            handleRoute();
        }
    });
}