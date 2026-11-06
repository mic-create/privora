import { getState, setState, subscribe } from './core/state.js';
import { rtcManager } from './network/webrtc.manager.js';
import { renderMessages } from './components/messages.component.js';
import { showToast } from './utils/notifier.js';

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

function initializeApp() {
    console.log('[PRIVORA] Initializing application core...');
    
    // Bind global navigation and session UI elements
    setupNavigation();
    setupSessionListeners();
    setupRtcEventListeners();

    // Initial route check based on URL hash or default view
    handleRoute();
    window.addEventListener('hashchange', handleRoute);
}

function setupNavigation() {
    // Handle tab switching or view navigation if applicable
    const navLinks = document.querySelectorAll('[data-route]');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const route = link.getAttribute('data-route');
            window.location.hash = route;
        });
    });
}

function handleRoute() {
    const hash = window.location.hash.substring(1) || 'transfer';
    const mainContainer = document.getElementById('main-content-area') || document.body;

    // Update active route in state
    setState({ currentView: hash });

    // Render corresponding view components
    if (hash === 'messages' || hash === 'transfer') {
        // Clear main viewport container and render messages/transfer interface
        const activeViewContainer = document.getElementById('view-container');
        if (activeViewContainer) {
            activeViewContainer.innerHTML = '';
            activeViewContainer.appendChild(renderMessages());
        }
    }
}

function setupSessionListeners() {
    // Listen to state changes to update UI badges or indicators
    subscribe((state) => {
        const statusBadge = document.getElementById('sidebar-status-badge');
        if (statusBadge) {
            const isConnected = state.session.isConnected;
            statusBadge.textContent = isConnected ? 'Active' : 'Standby';
            statusBadge.className = `text-[10px] font-mono ${isConnected ? 'text-emerald-400' : 'text-amber-400'}`;
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
        // Re-render view to enable interactive inputs
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
        } else if (state === 'failed' || state === 'disconnected') {
            setState({ session: { ...getState().session, isConnected: false } });
            handleRoute();
        }
    });
}