import { getState } from '../core/state.js';
import { showToast } from '../utils/notifier.js';

export function renderDashboard() {
    const state = getState();
    const container = document.createElement('div');
    container.className = 'space-y-6 animate-fade-in max-w-7xl mx-auto';

    container.innerHTML = `
        <!-- Welcome Hero Banner -->
        <div class="relative overflow-hidden rounded-2xl bg-gradient-to-br from-white to-ivory-800 border border-border p-6 lg:p-8 shadow-2xs">
            <div class="relative z-10 max-w-3xl">
                <div class="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-ivory-900 border border-sage text-forest-800 text-xs font-mono mb-4 font-medium">
                    <span class="h-2 w-2 rounded-full bg-forest-800 animate-pulse"></span>
                    Zero-Knowledge Architecture • Web Crypto AES-GCM 256
                </div>
                <h2 class="text-2xl lg:text-3xl font-bold text-charcoal tracking-tight">Secure P2P Workspace</h2>
                <p class="mt-2 text-sm text-charcoal-muted leading-relaxed">
                    Transfer files directly between browsers and exchange encrypted messages without central server storage. Your data never leaves your peer connection.
                </p>
                <div class="mt-6 flex flex-wrap items-center gap-3">
                    <button id="dash-start-session" class="px-4 py-2.5 bg-forest-800 hover:bg-forest-700 text-white text-sm font-medium rounded-xl shadow-md shadow-forest-800/20 transition-all flex items-center gap-2">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
                        Start Secure Session
                    </button>
                    <button id="dash-join-session" class="px-4 py-2.5 bg-white hover:bg-ivory-800 text-charcoal text-sm font-medium rounded-xl border border-border shadow-2xs transition-all flex items-center gap-2">
                        <svg class="w-4 h-4 text-charcoal-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"/></svg>
                        Join Existing Room
                    </button>
                </div>
            </div>
        </div>

        <!-- Grid Status Metrics -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="bg-white border border-border rounded-2xl p-5 flex items-center justify-between shadow-2xs">
                <div>
                    <p class="text-xs font-semibold text-charcoal-muted uppercase tracking-wider">Session Status</p>
                    <p class="text-lg font-bold text-charcoal mt-1" id="metric-session-status">${state.session.isConnected ? 'Active Room' : 'Disconnected'}</p>
                    <p class="text-xs text-charcoal-muted mt-0.5 font-mono">Room ID: ${state.session.roomId || 'None'}</p>
                </div>
                <div class="h-12 w-12 rounded-xl bg-ivory-800 border border-border flex items-center justify-center text-forest-800">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M12 5l7 7-7 7"/></svg>
                </div>
            </div>

            <div class="bg-white border border-border rounded-2xl p-5 flex items-center justify-between shadow-2xs">
                <div>
                    <p class="text-xs font-semibold text-charcoal-muted uppercase tracking-wider">Transport Mode</p>
                    <p class="text-lg font-bold text-forest-800 mt-1">${state.session.connectionType}</p>
                    <p class="text-xs text-charcoal-muted mt-0.5 font-mono">STUN Handshake Verified</p>
                </div>
                <div class="h-12 w-12 rounded-xl bg-ivory-800 border border-border flex items-center justify-center text-forest-800">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
                </div>
            </div>

            <div class="bg-white border border-border rounded-2xl p-5 flex items-center justify-between shadow-2xs">
                <div>
                    <p class="text-xs font-semibold text-charcoal-muted uppercase tracking-wider">Active Transfers</p>
                    <p class="text-lg font-bold text-charcoal mt-1">${state.transfers.length} Files</p>
                    <p class="text-xs text-charcoal-muted mt-0.5 font-mono">0 bytes pending</p>
                </div>
                <div class="h-12 w-12 rounded-xl bg-ivory-800 border border-border flex items-center justify-center text-forest-800">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
                </div>
            </div>
        </div>

        <!-- Recent Activity & Empty States Section -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            <!-- Recent Transfers Card -->
            <div class="bg-white border border-border rounded-2xl p-6 flex flex-col justify-between shadow-2xs">
                <div class="flex items-center justify-between mb-4">
                    <h3 class="text-sm font-semibold text-charcoal tracking-wide">Recent File Transfers</h3>
                    <a href="#transfer" class="text-xs text-forest-800 hover:text-forest-700 font-medium">View All →</a>
                </div>
                <div class="flex-1 py-8 flex flex-col items-center justify-center text-center border border-dashed border-border rounded-xl bg-ivory-800/40">
                    <div class="h-10 w-10 rounded-full bg-ivory-800 flex items-center justify-center text-charcoal-muted mb-3 border border-border">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/></svg>
                    </div>
                    <p class="text-sm font-medium text-charcoal">No active file transfers</p>
                    <p class="text-xs text-charcoal-muted mt-1 max-w-xs">Drag and drop files into the transfer room or connect with a peer to begin.</p>
                </div>
            </div>

            <!-- Recent Conversations Card -->
            <div class="bg-white border border-border rounded-2xl p-6 flex flex-col justify-between shadow-2xs">
                <div class="flex items-center justify-between mb-4">
                    <h3 class="text-sm font-semibold text-charcoal tracking-wide">Encrypted Messages</h3>
                    <a href="#messages" class="text-xs text-forest-800 hover:text-forest-700 font-medium">Open Chat →</a>
                </div>
                <div class="flex-1 py-8 flex flex-col items-center justify-center text-center border border-dashed border-border rounded-xl bg-ivory-800/40">
                    <div class="h-10 w-10 rounded-full bg-ivory-800 flex items-center justify-center text-charcoal-muted mb-3 border border-border">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/></svg>
                    </div>
                    <p class="text-sm font-medium text-charcoal">No active conversation</p>
                    <p class="text-xs text-charcoal-muted mt-1 max-w-xs">Messages are ephemeral, end-to-end encrypted, and automatically destroyed on disconnect.</p>
                </div>
            </div>

        </div>
    `;

    // Button event binders
    container.querySelector('#dash-start-session').addEventListener('click', () => {
        window.location.hash = '#transfer';
    });
    container.querySelector('#dash-join-session').addEventListener('click', () => {
        window.location.hash = '#transfer';
    });

    return container;
}