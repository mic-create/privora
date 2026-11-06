import { getState, updateState } from '../core/state.js';
import { showToast } from '../utils/notifier.js';

export function renderSettings() {
    const state = getState();
    const container = document.createElement('div');
    container.className = 'space-y-6 animate-fade-in max-w-4xl mx-auto';

    container.innerHTML = `
        <div class="bg-navy-900/80 border border-navy-700/60 rounded-2xl p-6 lg:p-8 space-y-6">
            <div>
                <h3 class="text-base font-semibold text-white">Application Settings</h3>
                <p class="text-xs text-slate-400 mt-0.5">Customize appearance, STUN/TURN relays, and connection preferences</p>
            </div>

            <div class="space-y-4 pt-4 border-t border-navy-800">
                <h4 class="text-xs font-semibold uppercase tracking-wider text-slate-400">Appearance</h4>
                <div class="flex items-center justify-between py-2">
                    <div>
                        <p class="text-sm font-medium text-slate-200">Dark Appearance Mode</p>
                        <p class="text-xs text-slate-500">Enable deep navy and charcoal high-contrast palette</p>
                    </div>
                    <button id="settings-theme-toggle" class="px-4 py-2 bg-navy-800 hover:bg-navy-700 border border-navy-700 text-slate-200 text-xs font-medium rounded-xl transition-all">
                        Toggle Theme (${state.theme.toUpperCase()})
                    </button>
                </div>
            </div>

            <div class="space-y-4 pt-4 border-t border-navy-800">
                <h4 class="text-xs font-semibold uppercase tracking-wider text-slate-400">STUN / TURN Servers</h4>
                <div class="space-y-3">
                    <div>
                        <label class="block text-xs font-medium text-slate-300 mb-1">STUN Servers (Comma separated)</label>
                        <input type="text" id="input-stun" value="${state.settings.stunServers.join(', ')}" class="w-full bg-navy-950 border border-navy-800 rounded-xl px-4 py-2.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-accent-500">
                    </div>
                    <div class="flex items-center justify-between pt-2">
                        <div>
                            <p class="text-sm font-medium text-slate-200">Enable TURN Relay Support</p>
                            <p class="text-xs text-slate-500">Required if NAT traversal fails behind strict firewalls</p>
                        </div>
                        <input type="checkbox" id="check-turn" ${state.settings.turnServerEnabled ? 'checked' : ''} class="h-4 w-4 rounded bg-navy-950 border-navy-700 text-accent-600 focus:ring-accent-500">
                    </div>
                </div>
            </div>

            <div class="pt-6 border-t border-navy-800 flex justify-end">
                <button id="btn-save-settings" class="px-5 py-2.5 bg-accent-600 hover:bg-accent-500 text-white text-xs font-medium rounded-xl shadow-md transition-all">
                    Save Preferences
                </button>
            </div>
        </div>
    `;

    container.querySelector('#settings-theme-toggle').addEventListener('click', () => {
        const newTheme = state.theme === 'dark' ? 'light' : 'dark';
        updateState({ theme: newTheme });
        localStorage.setItem('privora_theme', newTheme);
        if (newTheme === 'light') {
            document.documentElement.classList.remove('dark');
            document.documentElement.classList.add('light');
        } else {
            document.documentElement.classList.add('dark');
            document.documentElement.classList.remove('light');
        }
        showToast(`Theme switched to ${newTheme.toUpperCase()}`, 'info');
    });

    container.querySelector('#btn-save-settings').addEventListener('click', () => {
        const stunInput = container.querySelector('#input-stun').value;
        const turnEnabled = container.querySelector('#check-turn').checked;
        updateState(s => ({
            ...s,
            settings: {
                ...s.settings,
                stunServers: stunInput.split(',').map(s => s.trim()).filter(Boolean),
                turnServerEnabled: turnEnabled
            }
        }));
        showToast('Settings saved successfully', 'success');
    });

    return container;
}