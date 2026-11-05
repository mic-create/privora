import { getState } from '../core/state.js';
import { showToast } from '../utils/notifier.js';
import { rtcManager } from '../network/webrtc.manager.js';

let typingTimeout = null;

export function renderMessages() {
    const state = getState();
    const isConnected = state.session.isConnected && rtcManager.dataChannel && rtcManager.dataChannel.readyState === 'open';

    const container = document.createElement('div');
    container.className = 'grid grid-cols-1 md:grid-cols-4 gap-6 h-[calc(100vh-8rem)] animate-fade-in max-w-7xl mx-auto';

    container.innerHTML = `
        <!-- Sidebar Conversation List -->
        <div class="bg-navy-900/80 border border-navy-700/60 rounded-2xl flex flex-col overflow-hidden">
            <div class="p-4 border-b border-navy-800 flex items-center justify-between">
                <h3 class="text-sm font-semibold text-white">Secure Chats</h3>
                <span class="text-[10px] font-mono px-2 py-0.5 rounded-full bg-accent-500/10 text-accent-400 border border-accent-500/20">AES-GCM-256</span>
            </div>
            <div class="p-3">
                <input type="text" placeholder="Search secure sessions..." class="w-full bg-navy-950/60 border border-navy-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-accent-500">
            </div>
            <div class="flex-1 overflow-y-auto p-2 space-y-1">
                <div class="p-3 rounded-xl bg-navy-800/80 border border-navy-700/60 cursor-pointer">
                    <div class="flex items-center justify-between">
                        <span class="text-xs font-medium text-white">Peer Room #${state.session.roomId || 'DEFAULT'}</span>
                        <span id="sidebar-status-badge" class="text-[10px] ${isConnected ? 'text-emerald-400' : 'text-amber-400'} font-mono">${isConnected ? 'Active' : 'Standby'}</span>
                    </div>
                    <p class="text-[11px] text-slate-400 truncate mt-1">End-to-end encrypted DataChannel chat</p>
                </div>
            </div>
            <div class="p-3 border-t border-navy-800">
                <button id="btn-clear-chat" class="w-full py-2 bg-navy-950 hover:bg-navy-800 text-slate-300 border border-navy-700/60 rounded-xl text-xs font-medium transition-all">
                    Clear Conversation
                </button>
            </div>
        </div>

        <!-- Active Chat Window -->
        <div class="md:col-span-3 bg-navy-900/80 border border-navy-700/60 rounded-2xl flex flex-col overflow-hidden">
            <!-- Chat Header -->
            <div class="p-4 border-b border-navy-800 flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <div class="h-9 w-9 rounded-full bg-navy-800 border border-navy-700 flex items-center justify-center text-accent-400 font-mono text-xs">P2</div>
                    <div>
                        <h4 class="text-xs font-semibold text-white">Peer Connection Room #${state.session.roomId || 'None'}</h4>
                        <p id="chat-sub-status" class="text-[10px] ${isConnected ? 'text-emerald-400' : 'text-amber-400'} font-mono">${isConnected ? 'Encrypted via Web Crypto API (HKDF-AES-GCM)' : 'Waiting for DataChannel connection...'}</p>
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    <span id="chat-status-dot" class="h-2.5 w-2.5 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}"></span>
                    <span id="chat-status-text" class="text-xs font-mono text-slate-400">${isConnected ? 'Connected' : 'Disconnected'}</span>
                </div>
            </div>

            <!-- Messages Stream Area -->
            <div id="chat-messages-container" class="flex-1 overflow-y-auto p-6 space-y-4 bg-navy-950/30">
                <div class="flex justify-center">
                    <div class="px-3 py-1.5 rounded-full bg-navy-800/80 border border-navy-700 text-[10px] text-slate-400 font-mono">
                        🔒 All messages are end-to-end encrypted and destroyed on session disconnect.
                    </div>
                </div>
                ${renderMessagesList()}
            </div>

            <!-- Typing Indicator Area -->
            <div id="typing-indicator-area" class="px-6 py-1 text-[11px] text-accent-400 font-mono italic hidden">
                Peer is typing...
            </div>

            <!-- Message Input Form -->
            <div class="p-4 border-t border-navy-800 bg-navy-900/90">
                <form id="chat-form" class="flex items-center gap-3">
                    <input type="text" id="chat-input" ${!isConnected ? 'disabled' : ''} placeholder="${isConnected ? 'Type an encrypted message...' : 'Connect to a room to start messaging...'}" class="flex-1 bg-navy-950 border border-navy-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-accent-500 disabled:opacity-50 disabled:cursor-not-allowed">
                    <button type="submit" ${!isConnected ? 'disabled' : ''} class="px-4 py-2.5 bg-accent-600 hover:bg-accent-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium rounded-xl shadow-md transition-all flex items-center gap-2">
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
    const typingArea = container.querySelector('#typing-indicator-area');

    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    chatInput.addEventListener('input', () => {
        rtcManager.sendTypingIndicator(true);
        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => {
            rtcManager.sendTypingIndicator(false);
        }, 1500);
    });

    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = chatInput.value.trim();
        if (!text) return;

        try {
            chatInput.value = '';
            await rtcManager.sendChatMessage(text);
            refreshChatDOM(container);
        } catch (err) {
            showToast('Failed to send encrypted message', 'error');
        }
    });

    container.querySelector('#btn-clear-chat').addEventListener('click', () => {
        rtcManager.clearConversation();
        refreshChatDOM(container);
        showToast('Conversation cleared', 'info');
    });

    rtcManager.on('chat_message_received', () => refreshChatDOM(container));
    rtcManager.on('chat_message_sent', () => refreshChatDOM(container));
    rtcManager.on('chat_status_updated', () => refreshChatDOM(container));

    rtcManager.on('peer_typing', (isTyping) => {
        if (typingArea) {
            if (isTyping) typingArea.classList.remove('hidden');
            else typingArea.classList.add('hidden');
        }
    });

    return container;
}

function renderMessagesList() {
    if (!rtcManager.chatMessages || rtcManager.chatMessages.length === 0) {
        return `
            <div class="flex flex-col items-center justify-center h-48 text-center text-slate-500">
                <p class="text-xs">No messages in this secure session yet.</p>
                <p class="text-[10px] mt-1">Type below to start an end-to-end encrypted chat.</p>
            </div>
        `;
    }

    return rtcManager.chatMessages.map(msg => {
        const isOutgoing = msg.direction === 'outgoing';
        const timeStr = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        return `
            <div class="flex items-start gap-3 ${isOutgoing ? 'justify-end' : ''}">
                ${!isOutgoing ? '<div class="h-8 w-8 rounded-full bg-navy-800 flex items-center justify-center text-xs text-slate-300 font-mono flex-shrink-0">P2</div>' : ''}
                <div class="${isOutgoing ? 'bg-accent-600 border border-accent-500' : 'bg-navy-800 border border-navy-700/60'} rounded-2xl px-4 py-3 max-w-md shadow-lg">
                    <p class="text-xs text-white">${escapeHtml(msg.text)}</p>
                    <div class="flex items-center justify-end gap-2 mt-1">
                        <span class="text-[10px] ${isOutgoing ? 'text-accent-200' : 'text-slate-400'} font-mono">${timeStr}</span>
                        ${isOutgoing ? `<span class="text-[9px] font-mono uppercase text-accent-200">🔒 ${msg.status || 'Sent'}</span>` : ''}
                    </div>
                </div>
                ${isOutgoing ? '<div class="h-8 w-8 rounded-full bg-accent-500/20 border border-accent-500/30 flex items-center justify-center text-xs text-accent-300 font-mono flex-shrink-0">ME</div>' : ''}
            </div>
        `;
    }).join('');
}

function refreshChatDOM(container) {
    const messagesContainer = container.querySelector('#chat-messages-container');
    if (messagesContainer) {
        messagesContainer.innerHTML = `
            <div class="flex justify-center">
                <div class="px-3 py-1.5 rounded-full bg-navy-800/80 border border-navy-700 text-[10px] text-slate-400 font-mono">
                    🔒 All messages are end-to-end encrypted and destroyed on session disconnect.
                </div>
            </div>
            ${renderMessagesList()}
        `;
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
}

function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}