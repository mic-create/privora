import { getState, setState, subscribe } from './core/state.js';
import { rtcManager } from './network/webrtc.manager.js';
import { renderMessages } from './components/messages.component.js';
import { showToast } from './utils/notifier.js';

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

function initializeApp() {
    console.log('[PRIVORA] Initializing application core...');
    setupNavigation();
    setupSessionListeners();
    setupRtcEventListeners();

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

function handleRoute() {
    const hash = window.location.hash.substring(1) || 'dashboard';
    
    // Target both common container IDs to ensure content renders regardless of HTML wrapper ID
    let container = document.getElementById('view-container') || document.getElementById('main-content-area');
    
    if (!container) {
        // Fallback: search for the main viewing pane next to the sidebar
        container = document.querySelector('main') || document.querySelector('.md\\:col-span-3') || document.querySelector('div.flex-1');
    }

    if (!container) {
        console.warn('[PRIVORA] View container not found in DOM.');
        return;
    }

    setState({ currentView: hash });
    container.innerHTML = '';

    if (hash === 'dashboard' || hash === '') {
        container.innerHTML = `
            <div class="p-8 max-w-5xl animate-fade-in">
                <div class="mb-6">
                    <h2 class="text-lg font-bold text-white">Dashboard</h2>
                    <p class="text-xs text-slate-400 mt-1">Overview of your secure sessions and encrypted data streams</p>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="bg-navy-900/80 border border-navy-700/60 p-6 rounded-2xl shadow-xl flex flex-col justify-between">
                        <div>
                            <div class="h-10 w-10 rounded-xl bg-accent-500/20 border border-accent-500/30 flex items-center justify-center text-accent-400 mb-4">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
                            </div>
                            <h3 class="text-sm font-semibold text-white mb-1">Encrypted Secure Chat</h3>
                            <p class="text-xs text-slate-400 mb-6">Real-time peer-to-peer messaging protected by Web Crypto API HKDF-AES-GCM-256 and SHA-256 integrity checks.</p>
                        </div>
                        <a href="#messages" class="inline-flex items-center justify-center px-4 py-2.5 bg-accent-600 hover:bg-accent-500 text-white text-xs font-medium rounded-xl shadow-lg transition-all">Launch Secure Chat</a>
                    </div>
                    <div class="bg-navy-900/80 border border-navy-700/60 p-6 rounded-2xl shadow-xl flex flex-col justify-between">
                        <div>
                            <div class="h-10 w-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>
                            </div>
                            <h3 class="text-sm font-semibold text-white mb-1">P2P File Transfer</h3>
                            <p class="text-xs text-slate-400 mb-6">Send documents, archives, and media instantly across peers with chunked AES-GCM verification and download streams.</p>
                        </div>
                        <a href="#messages" class="inline-flex items-center justify-center px-4 py-2.5 bg-navy-800 hover:bg-navy-700 text-slate-200 border border-navy-700 text-xs font-medium rounded-xl transition-all">Open Transfer Session</a>
                    </div>
                </div>
            </div>
        `;
    } else if (hash === 'messages' || hash === 'transfer') {
        container.appendChild(renderMessages());
    } else {
        container.innerHTML = `
            <div class="p-8 text-center text-slate-400">
                <h3 class="text-sm font-semibold text-white mb-1">Section Under Construction</h3>
                <p class="text-xs">The requested view '${hash}' is currently routed to dashboard modules.</p>
                <a href="#dashboard" class="inline-block mt-4 px-4 py-2 bg-accent-600 text-white text-xs rounded-xl">Return to Dashboard</a>
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