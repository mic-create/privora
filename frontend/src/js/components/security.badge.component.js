/**
 * PRIVORA Security Status Badge Component
 * Displays live cryptographic and connection verification badges in the navigation header.
 */

import { rtcManager } from '../network/webrtc.manager.js';
import { getState } from '../core/state.js';

export function renderSecurityBadge() {
    const state = getState();
    const isConnected = state.session.isConnected && rtcManager.dataChannel && rtcManager.dataChannel.readyState === 'open';

    const badge = document.createElement('div');
    badge.className = 'flex items-center gap-2 px-3 py-1.5 bg-navy-900/80 border border-navy-700/60 rounded-full text-[11px] font-mono';

    if (isConnected) {
        badge.innerHTML = `
            <span class="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span class="text-emerald-400 font-medium">E2EE Secured (AES-GCM)</span>
        `;
    } else {
        badge.innerHTML = `
            <span class="h-2 w-2 rounded-full bg-amber-500"></span>
            <span class="text-amber-400 font-medium">Standby / Unconnected</span>
        `;
    }

    return badge;
}