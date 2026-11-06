/**
 * PRIVORA Settings Component
 * Robust configuration dashboard with safe DOM querying and error protection.
 */

import { getUserSettings, saveUserSettings } from '../core/settings.state.js';
import { getState } from '../core/state.js';
import { showToast } from '../utils/notifier.js';
import { rtcManager } from '../network/webrtc.manager.js';

export function renderSettings() {
    const settings = getUserSettings();
    let appState = { session: { roomId: null } };
    try {
        appState = getState() || appState;
    } catch (e) {
        console.warn('State retrieval warning in settings:', e);
    }

    const isConnected = appState.session && appState.session.isConnected && rtcManager && rtcManager.dataChannel && rtcManager.dataChannel.readyState === 'open';

    const container = document.createElement('div');
    container.className = 'max-w-4xl mx-auto space-y-6 animate-fade-in pb-12';

    container.innerHTML = `
        <!-- Settings Header -->
        <div class="bg-navy-900/80 border border-navy-700/60 rounded-2xl p-6 flex items-center justify-between">
            <div>
                <h2 class="text-base font-semibold text-white">Settings, Privacy & Security</h2>
                <p class="text-xs text-slate-400 mt-0.5">Manage your application preferences, privacy controls, and P2P cryptographic security.</p>
            </div>
            <span class="text-[10px] font-mono px-2.5 py-1 rounded-full bg-accent-500/10 text-accent-400 border border-accent-500/20">PRIVORA v2.5</span>
        </div>

        <!-- Settings Grid / Tabs -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <!-- Navigation Sidebar -->
            <div class="bg-navy-900/80 border border-navy-700/60 rounded-2xl p-3 space-y-1 h-fit">
                <button data-tab="general" class="settings-tab-btn w-full text-left px-4 py-2.5 rounded-xl text-xs font-medium bg-accent-600 text-white transition-all flex items-center gap-2.5">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                    <span>General Preferences</span>
                </button>
                <button data-tab="privacy" class="settings-tab-btn w-full text-left px-4 py-2.5 rounded-xl text-xs font-medium text-slate-300 hover:bg-navy-800/80 transition-all flex items-center gap-2.5">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                    <span>Privacy Controls</span>
                </button>
                <button data-tab="security" class="settings-tab-btn w-full text-left px-4 py-2.5 rounded-xl text-xs font-medium text-slate-300 hover:bg-navy-800/80 transition-all flex items-center gap-2.5">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
                    <span>Security & Cryptography</span>
                </button>
            </div>

            <!-- Tab Content Area -->
            <div class="md:col-span-2 space-y-6">
                <!-- GENERAL TAB -->
                <div id="tab-general" class="settings-tab-content bg-navy-900/80 border border-navy-700/60 rounded-2xl p-6 space-y-6">
                    <h3 class="text-sm font-semibold text-white border-b border-navy-800 pb-3">General Preferences</h3>
                    
                    <div class="space-y-4">
                        <div class="flex items-center justify-between">
                            <div>
                                <label class="text-xs font-medium text-white">Application Theme</label>
                                <p class="text-[11px] text-slate-400">Select your preferred visual interface mode.</p>
                            </div>
                            <select id="setting-theme" class="bg-navy-950 border border-navy-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-accent-500">
                                <option value="dark" ${settings.theme === 'dark' ? 'selected' : ''}>Dark Navy (Default)</option>
                                <option value="system" ${settings.theme === 'system' ? 'selected' : ''}>System Preference</option>
                            </select>
                        </div>

                        <div class="flex items-center justify-between">
                            <div>
                                <label class="text-xs font-medium text-white">Sound Effects</label>
                                <p class="text-[11px] text-slate-400">Play audio alerts for messages and file transfers.</p>
                            </div>
                            <input type="checkbox" id="setting-sound" ${settings.soundEnabled ? 'checked' : ''} class="w-4 h-4 rounded bg-navy-950 border-navy-800 text-accent-600 focus:ring-accent-500">
                        </div>

                        <div class="flex items-center justify-between">
                            <div>
                                <label class="text-xs font-medium text-white">Desktop Notifications</label>
                                <p class="text-[11px] text-slate-400">Enable browser notifications for incoming messages.</p>
                            </div>
                            <input type="checkbox" id="setting-notifications" ${settings.notificationsEnabled ? 'checked' : ''} class="w-4 h-4 rounded bg-navy-950 border-navy-800 text-accent-600 focus:ring-accent-500">
                        </div>
                    </div>
                </div>

                <!-- PRIVACY TAB -->
                <div id="tab-privacy" class="settings-tab-content bg-navy-900/80 border border-navy-700/60 rounded-2xl p-6 space-y-6 hidden">
                    <h3 class="text-sm font-semibold text-white border-b border-navy-800 pb-3">Privacy Controls</h3>
                    
                    <div class="space-y-4">
                        <div class="flex items-center justify-between">
                            <div>
                                <label class="text-xs font-medium text-white">Typing Indicators</label>
                                <p class="text-[11px] text-slate-400">Broadcast when you are typing a message.</p>
                            </div>
                            <input type="checkbox" id="setting-typing" ${settings.typingIndicatorsEnabled ? 'checked' : ''} class="w-4 h-4 rounded bg-navy-950 border-navy-800 text-accent-600 focus:ring-accent-500">
                        </div>

                        <div class="flex items-center justify-between">
                            <div>
                                <label class="text-xs font-medium text-white">Read Receipts</label>
                                <p class="text-[11px] text-slate-400">Send delivery and read confirmations.</p>
                            </div>
                            <input type="checkbox" id="setting-receipts" ${settings.readReceiptsEnabled ? 'checked' : ''} class="w-4 h-4 rounded bg-navy-950 border-navy-800 text-accent-600 focus:ring-accent-500">
                        </div>

                        <div class="flex items-center justify-between">
                            <div>
                                <label class="text-xs font-medium text-white">Notification Message Previews</label>
                                <p class="text-[11px] text-slate-400">Include message body text in system notifications.</p>
                            </div>
                            <input type="checkbox" id="setting-previews" ${settings.showNotificationPreviews ? 'checked' : ''} class="w-4 h-4 rounded bg-navy-950 border-navy-800 text-accent-600 focus:ring-accent-500">
                        </div>

                        <div class="pt-4 border-t border-navy-800 space-y-3">
                            <h4 class="text-xs font-semibold text-white">Local Data Management</h4>
                            <div class="flex items-center justify-between">
                                <div>
                                    <label class="text-xs font-medium text-white">Clear Chat History</label>
                                    <p class="text-[11px] text-slate-400">Immediately wipe all temporary messages from session memory.</p>
                                </div>
                                <button id="btn-clear-history" class="px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-medium transition-all">Clear History</button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- SECURITY TAB -->
                <div id="tab-security" class="settings-tab-content bg-navy-900/80 border border-navy-700/60 rounded-2xl p-6 space-y-6 hidden">
                    <h3 class="text-sm font-semibold text-white border-b border-navy-800 pb-3">Security & Cryptography</h3>
                    
                    <div class="space-y-4 font-mono text-xs">
                        <div class="bg-navy-950/60 border border-navy-800 rounded-xl p-4 space-y-2">
                            <div class="flex justify-between">
                                <span class="text-slate-400">Encryption Standard:</span>
                                <span class="text-emerald-400">AES-GCM-256 (Web Crypto API)</span>
                            </div>
                            <div class="flex justify-between">
                                <span class="text-slate-400">Key Derivation:</span>
                                <span class="text-accent-400">HKDF-SHA256</span>
                            </div>
                            <div class="flex justify-between">
                                <span class="text-slate-400">Transport Protocol:</span>
                                <span class="text-slate-200">WebRTC P2P DataChannel (DTLS-SRTP)</span>
                            </div>
                            <div class="flex justify-between">
                                <span class="text-slate-400">Connection State:</span>
                                <span class="${isConnected ? 'text-emerald-400' : 'text-amber-400'}">${isConnected ? 'Connected & Verified' : 'Standby / Disconnected'}</span>
                            </div>
                            <div class="flex justify-between pt-2 border-t border-navy-800">
                                <span class="text-slate-400">Active Room ID:</span>
                                <span class="text-white">${appState.session.roomId || 'None'}</span>
                            </div>
                        </div>

                        <div class="pt-2 space-y-3 font-sans">
                            <h4 class="text-xs font-semibold text-white">Session Control</h4>
                            <div class="flex items-center justify-between">
                                <div>
                                    <label class="text-xs font-medium text-white">Terminate Active Session</label>
                                    <p class="text-[11px] text-slate-400">Close WebRTC connections and purge keys from memory.</p>
                                </div>
                                <button id="btn-terminate-session" class="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-medium transition-all">End Session</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Safe event listener binding
    setTimeout(() => {
        const tabButtons = container.querySelectorAll('.settings-tab-btn');
        const tabContents = container.querySelectorAll('.settings-tab-content');

        tabButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetTab = btn.dataset.tab;
                
                tabButtons.forEach(b => {
                    b.classList.remove('bg-accent-600', 'text-white');
                    b.classList.add('text-slate-300');
                });
                btn.classList.add('bg-accent-600', 'text-white');
                btn.classList.remove('text-slate-300');

                tabContents.forEach(content => {
                    if (content.id === `tab-${targetTab}`) {
                        content.classList.remove('hidden');
                    } else {
                        content.classList.add('hidden');
                    }
                });
            });
        });

        const themeSelect = container.querySelector('#setting-theme');
        const soundCheckbox = container.querySelector('#setting-sound');
        const notifCheckbox = container.querySelector('#setting-notifications');
        const typingCheckbox = container.querySelector('#setting-typing');
        const receiptsCheckbox = container.querySelector('#setting-receipts');
        const previewsCheckbox = container.querySelector('#setting-previews');

        const persistChanges = () => {
            saveUserSettings({
                theme: themeSelect ? themeSelect.value : 'dark',
                soundEnabled: soundCheckbox ? soundCheckbox.checked : true,
                notificationsEnabled: notifCheckbox ? notifCheckbox.checked : true,
                typingIndicatorsEnabled: typingCheckbox ? typingCheckbox.checked : true,
                readReceiptsEnabled: receiptsCheckbox ? receiptsCheckbox.checked : true,
                showNotificationPreviews: previewsCheckbox ? previewsCheckbox.checked : true
            });
            showToast('Settings saved successfully', 'success');
        };

        if (themeSelect) themeSelect.addEventListener('change', persistChanges);
        if (soundCheckbox) soundCheckbox.addEventListener('change', persistChanges);
        if (notifCheckbox) notifCheckbox.addEventListener('change', persistChanges);
        if (typingCheckbox) typingCheckbox.addEventListener('change', persistChanges);
        if (receiptsCheckbox) receiptsCheckbox.addEventListener('change', persistChanges);
        if (previewsCheckbox) previewsCheckbox.addEventListener('change', persistChanges);

        const clearHistoryBtn = container.querySelector('#btn-clear-history');
        if (clearHistoryBtn) {
            clearHistoryBtn.addEventListener('click', () => {
                if (rtcManager && typeof rtcManager.clearConversation === 'function') {
                    rtcManager.clearConversation();
                }
                showToast('Local conversation history cleared', 'success');
            });
        }

        const terminateSessionBtn = container.querySelector('#btn-terminate-session');
        if (terminateSessionBtn) {
            terminateSessionBtn.addEventListener('click', () => {
                if (rtcManager && typeof rtcManager.closeConnection === 'function') {
                    rtcManager.closeConnection();
                }
                showToast('Active session terminated and memory purged', 'info');
                window.location.hash = '#home';
            });
        }
    }, 0);

    return container;
}