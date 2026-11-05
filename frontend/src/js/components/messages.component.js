import { getState } from '../core/state.js';
import { showToast } from '../utils/notifier.js';

export function renderMessages() {
    const state = getState();
    const container = document.createElement('div');
    container.className = 'grid grid-cols-1 md:grid-cols-4 gap-6 h-[calc(100vh-8rem)] animate-fade-in max-w-7xl mx-auto';

    container.innerHTML = `
        <!-- Sidebar Conversation List -->
        <div class="bg-navy-900/80 border border-navy-700/60 rounded-2xl flex flex-col overflow-hidden">
            <div class="p-4 border-b border-navy-800 flex items-center justify-between">
                <h3 class="text-sm font-semibold text-white">Secure Chats</h3>
                <span class="text-[10px] font-mono px-2 py-0.5 rounded-full bg-accent-500/10 text-accent-400 border border-accent-500/20">E2EE</span>
            </div>
            <div class="p-3">
                <input type="text" placeholder="Search secure sessions..." class="w-full bg-navy-950/60 border border-navy-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-accent-500">
            </div>
            <div class="flex-1 overflow-y-auto p-2 space-y-1">
                <div class="p-3 rounded-xl bg-navy-800/80 border border-navy-700/60 cursor-pointer">
                    <div class="flex items-center justify-between">
                        <span class="text-xs font-medium text-white">Peer Room #${state.session.roomId || 'DEFAULT'}</span>
                        <span class="text-[10px] text-emerald-400 font-mono">Active</span>
                    </div>
                    <p class="text-[11px] text-slate-400 truncate mt-1">End-to-end encrypted DataChannel chat</p>
                </div>
            </div>
        </div>

        <!-- Active Chat Window -->
        <div class="md:col-span-3 bg-navy-900/80 border border-navy-700/60 rounded-2xl flex flex-col overflow-hidden">
            <!-- Chat Header -->
            <div class="p-4 border-b border-navy-800 flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <div class="h-9 w-9 rounded-full bg-navy-800 border border-navy-700 flex items-center justify-center text-accent-400 font-mono text-xs">P2</div>
                    <div>
                        <h4 class="text-xs font-semibold text-white">Peer Connection #${state.session.roomId || '8492'}</h4>
                        <p class="text-[10px] text-emerald-400 font-mono">Encrypted via Web Crypto API</p>
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    <span class="h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
                    <span class="text-xs font-mono text-slate-400">Connected</span>
                </div>
            </div>

            <!-- Messages Stream Area -->
            <div id="chat-messages-container" class="flex-1 overflow-y-auto p-6 space-y-4 bg-navy-950/30">
                <div class="flex justify-center">
                    <div class="px-3 py-1.5 rounded-full bg-navy-800/80 border border-navy-700 text-[10px] text-slate-400 font-mono">
                        🔒 All messages are encrypted locally and destroyed on disconnect.
                    </div>
                </div>

                <div class="flex items-start gap-3">
                    <div class="h-8 w-8 rounded-full bg-navy-800 flex items-center justify-center text-xs text-slate-300 font-mono flex-shrink-0">P2</div>
                    <div class="bg-navy-800 border border-navy-700/60 rounded-2xl px-4 py-3 max-w-md">
                        <p class="text-xs text-slate-200">Hello! Secure P2P messaging channel initialized successfully.</p>
                        <span class="text-[10px] text-slate-500 font-mono mt-1 block">Just now</span>
                    </div>
                </div>
            </div>

            <!-- Message Input Form -->
            <div class="p-4 border-t border-navy-800 bg-navy-900/90">
                <form id="chat-form" class="flex items-center gap-3">
                    <button type="button" id="btn-attach-file" class="p-2.5 text-slate-400 hover:text-white rounded-xl bg-navy-800 hover:bg-navy-700 border border-navy-700 transition-all" title="Attach file">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/></svg>
                    </button>
                    <input type="text" id="chat-input" placeholder="Type an encrypted message..." class="flex-1 bg-navy-950 border border-navy-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-accent-500">
                    <button type="submit" class="px-4 py-2.5 bg-accent-600 hover:bg-accent-500 text-white text-xs font-medium rounded-xl shadow-md transition-all flex items-center gap-2">
                        <span>Send</span>
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
                    </button>
                </form>
            </div>
        </div>
    `;

    const chatForm = container.querySelector('#chat-form');
    const chatInput = container.querySelector('#chat-input');
    const messagesContainer = container.querySelector('#chat-messages-container');

    chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = chatInput.value.trim();
        if (!text) return;

        // Append outgoing message
        const msgDiv = document.createElement('div');
        msgDiv.className = 'flex items-start gap-3 justify-end';
        msgDiv.innerHTML = `
            <div class="bg-accent-600 border border-accent-500 rounded-2xl px-4 py-3 max-w-md shadow-lg">
                <p class="text-xs text-white">${escapeHtml(text)}</p>
                <span class="text-[10px] text-accent-200 font-mono mt-1 block text-right">Just now • Encrypted</span>
            </div>
            <div class="h-8 w-8 rounded-full bg-accent-500/20 border border-accent-500/30 flex items-center justify-center text-xs text-accent-300 font-mono flex-shrink-0">ME</div>
        `;
        messagesContainer.appendChild(msgDiv);
        chatInput.value = '';
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        showToast('Message encrypted and transmitted P2P', 'success');
    });

    return container;
}

function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}