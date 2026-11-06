import { getState } from '../core/state.js';
import { showToast } from '../utils/notifier.js';
import { rtcManager } from '../network/webrtc.manager.js';

let typingTimeout = null;
let selectedFilesToAttach = [];

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
        <div class="md:col-span-3 bg-navy-900/80 border border-navy-700/60 rounded-2xl flex flex-col overflow-hidden relative">
            <!-- Chat Header -->
            <div class="p-4 border-b border-navy-800 flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <div class="h-9 w-9 rounded-full bg-navy-800 border border-navy-700 flex items-center justify-center text-accent-400 font-mono text-xs">P2</div>
                    <div>
                        <h4 class="text-xs font-semibold text-white">Peer Connection Room #${state.session.roomId || 'None'}</h4>
                        <p id="chat-sub-status" class="text-[10px] ${isConnected ? 'text-emerald-400' : 'text-amber-400'} font-mono">${isConnected ? 'Encrypted via Web Crypto API (HKDF-AES-GCM)' : 'Waiting for DataChannel connection...'}</p>
                    </div>
                </div>
                <div class="flex items-center gap-3">
                    <button id="btn-start-call" ${!isConnected ? 'disabled' : ''} class="px-3 py-1.5 bg-accent-600/20 hover:bg-accent-600/30 text-accent-400 border border-accent-500/30 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                        <span>Audio Call</span>
                    </button>
                    <div class="flex items-center gap-2">
                        <span id="chat-status-dot" class="h-2.5 w-2.5 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}"></span>
                        <span id="chat-status-text" class="text-xs font-mono text-slate-400">${isConnected ? 'Connected' : 'Disconnected'}</span>
                    </div>
                </div>
            </div>

            <!-- Messages Stream Area -->
            <div id="chat-messages-container" class="flex-1 overflow-y-auto p-6 space-y-4 bg-navy-950/30">
                <div class="flex justify-center">
                    <div class="px-3 py-1.5 rounded-full bg-navy-800/80 border border-navy-700 text-[10px] text-slate-400 font-mono">
                        🔒 All messages, files, voice notes, and calls are end-to-end encrypted.
                    </div>
                </div>
                ${renderMessagesList()}
            </div>

            <!-- Incoming Transfer Banner / Prompt -->
            <div id="incoming-transfer-banner" class="hidden absolute bottom-20 left-6 right-6 bg-navy-800 border border-accent-500/40 rounded-2xl p-4 shadow-xl flex items-center justify-between z-20 animate-fade-in">
                <div class="flex items-center gap-3">
                    <div class="h-10 w-10 rounded-xl bg-accent-500/20 border border-accent-500/30 flex items-center justify-center text-accent-400">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
                    </div>
                    <div>
                        <h5 class="text-xs font-semibold text-white" id="incoming-file-name">Incoming File</h5>
                        <p class="text-[10px] text-slate-400 font-mono" id="incoming-file-meta">Size: 0 KB</p>
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    <button id="btn-decline-file" class="px-3 py-1.5 bg-navy-950 hover:bg-navy-900 text-slate-300 border border-navy-700 rounded-xl text-xs font-medium">Decline</button>
                    <button id="btn-accept-file" class="px-3 py-1.5 bg-accent-600 hover:bg-accent-500 text-white rounded-xl text-xs font-medium">Accept & Download</button>
                </div>
            </div>

            <!-- Attachment Preview Area -->
            <div id="attachment-preview-container" class="hidden px-6 py-2 bg-navy-900/95 border-t border-navy-800 flex items-center gap-3">
                <div class="flex items-center gap-2 bg-navy-950 border border-navy-700 rounded-xl px-3 py-1.5 text-xs text-slate-200">
                    <svg class="w-4 h-4 text-accent-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/></svg>
                    <span id="preview-file-name" class="font-mono text-[11px] truncate max-w-xs">file.ext</span>
                    <button id="btn-remove-attachment" class="text-slate-400 hover:text-white ml-2">&times;</button>
                </div>
                <span class="text-[10px] text-slate-400 font-mono">Ready to send via secure P2P channel</span>
            </div>

            <!-- Typing Indicator Area -->
            <div id="typing-indicator-area" class="px-6 py-1 text-[11px] text-accent-400 font-mono italic hidden">
                Peer is typing...
            </div>

            <!-- Message Input Form -->
            <div class="p-4 border-t border-navy-800 bg-navy-900/90">
                <form id="chat-form" class="flex items-center gap-3">
                    <input type="file" id="chat-file-input" multiple class="hidden">
                    <button type="button" id="btn-attach-file" ${!isConnected ? 'disabled' : ''} class="p-2.5 bg-navy-950 hover:bg-navy-800 text-slate-300 border border-navy-800 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed" title="Attach files">
                        <svg class="w-4 h-4 text-accent-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/></svg>
                    </button>
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
    const fileInput = container.querySelector('#chat-file-input');
    const attachBtn = container.querySelector('#btn-attach-file');
    const previewContainer = container.querySelector('#attachment-preview-container');
    const previewFileName = container.querySelector('#preview-file-name');
    const removeAttachmentBtn = container.querySelector('#btn-remove-attachment');
    const incomingBanner = container.querySelector('#incoming-transfer-banner');
    const incomingFileName = container.querySelector('#incoming-file-name');
    const incomingFileMeta = container.querySelector('#incoming-file-meta');
    const acceptFileBtn = container.querySelector('#btn-accept-file');
    const declineFileBtn = container.querySelector('#btn-decline-file');

    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    attachBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
            selectedFilesToAttach = Array.from(e.target.files);
            previewFileName.textContent = selectedFilesToAttach.map(f => f.name).join(', ');
            previewContainer.classList.remove('hidden');
        }
    });

    removeAttachmentBtn.addEventListener('click', () => {
        selectedFilesToAttach = [];
        fileInput.value = '';
        previewContainer.classList.add('hidden');
    });

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

        try {
            if (selectedFilesToAttach.length > 0) {
                const filesToSend = [...selectedFilesToAttach];
                selectedFilesToAttach = [];
                fileInput.value = '';
                previewContainer.classList.add('hidden');
                await rtcManager.sendFiles(filesToSend);
            }
            if (text) {
                chatInput.value = '';
                await rtcManager.sendChatMessage(text);
            }
            refreshChatDOM(container);
        } catch (err) {
            showToast('Failed to send message or attachment', 'error');
        }
    });

    container.querySelector('#btn-clear-chat').addEventListener('click', () => {
        rtcManager.clearConversation();
        refreshChatDOM(container);
        showToast('Conversation cleared', 'info');
    });

    // Incoming file transfer listeners
    rtcManager.on('incoming_transfer', (meta) => {
        incomingFileName.textContent = meta.name;
        incomingFileMeta.textContent = `Size: ${(meta.size / 1024).toFixed(1)} KB — Secure P2P Transfer`;
        incomingBanner.classList.remove('hidden');
        incomingBanner.dataset.transferId = meta.transferId;
    });

    acceptFileBtn.addEventListener('click', () => {
        const transferId = incomingBanner.dataset.transferId;
        if (transferId) {
            rtcManager.acceptTransfer(transferId);
            incomingBanner.classList.add('hidden');
            showToast('Accepting file transfer...', 'info');
        }
    });

    declineFileBtn.addEventListener('click', () => {
        const transferId = incomingBanner.dataset.transferId;
        if (transferId) {
            rtcManager.declineTransfer(transferId);
            incomingBanner.classList.add('hidden');
            showToast('File transfer declined', 'error');
        }
    });

    rtcManager.on('transfer_completed', (transfer) => {
        refreshChatDOM(container);
        if (transfer.blob) {
            const url = URL.createObjectURL(transfer.blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = transfer.name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    });

    rtcManager.on('transfer_progress', () => refreshChatDOM(container));
    rtcManager.on('transfer_initiated', () => refreshChatDOM(container));
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
    let items = [...(rtcManager.chatMessages || [])];
    
    // Include active and incoming file transfers in the message stream for unified history
    rtcManager.activeTransfers.forEach((t) => {
        items.push({
            type: 'FILE_TRANSFER_OUTGOING',
            messageId: t.transferId,
            timestamp: Date.now(),
            name: t.name,
            size: t.size,
            status: t.status,
            progress: t.progress || 0,
            direction: 'outgoing'
        });
    });

    rtcManager.incomingTransfers.forEach((t) => {
        items.push({
            type: 'FILE_TRANSFER_INCOMING',
            messageId: t.transferId,
            timestamp: Date.now(),
            name: t.name,
            size: t.size,
            status: t.status || 'incoming',
            blob: t.blob,
            direction: 'incoming'
        });
    });

    // Sort chronologically by timestamp
    items.sort((a, b) => a.timestamp - b.timestamp);

    if (items.length === 0) {
        return `
            <div class="flex flex-col items-center justify-center h-48 text-center text-slate-500">
                <p class="text-xs">No messages in this secure session yet.</p>
                <p class="text-[10px] mt-1">Type or attach files below to start end-to-end encrypted sharing.</p>
            </div>
        `;
    }

    return items.map(item => {
        const isOutgoing = item.direction === 'outgoing';
        const timeStr = new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        if (item.type === 'FILE_TRANSFER_OUTGOING' || item.type === 'FILE_TRANSFER_INCOMING') {
            const isCompleted = item.status === 'completed';
            return `
                <div class="flex items-start gap-3 ${isOutgoing ? 'justify-end' : ''}">
                    ${!isOutgoing ? '<div class="h-8 w-8 rounded-full bg-navy-800 flex items-center justify-center text-xs text-slate-300 font-mono flex-shrink-0">P2</div>' : ''}
                    <div class="${isOutgoing ? 'bg-accent-600/90 border border-accent-500' : 'bg-navy-800 border border-navy-700/60'} rounded-2xl p-4 max-w-sm shadow-lg w-72">
                        <div class="flex items-center gap-3">
                            <div class="h-10 w-10 rounded-xl bg-navy-950/40 flex items-center justify-center text-white flex-shrink-0">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>
                            </div>
                            <div class="overflow-hidden flex-1">
                                <h6 class="text-xs font-semibold text-white truncate">${escapeHtml(item.name)}</h6>
                                <p class="text-[10px] text-slate-300 font-mono">${(item.size / 1024).toFixed(1)} KB — <span class="uppercase">${item.status}</span></p>
                            </div>
                        </div>
                        ${!isCompleted && item.status === 'transferring' ? `
                            <div class="w-full bg-navy-950/60 rounded-full h-1.5 mt-3 overflow-hidden">
                                <div class="bg-white h-1.5 transition-all duration-300" style="width: ${item.progress || 0}%"></div>
                            </div>
                        ` : ''}
                        ${isCompleted && item.blob ? `
                            <div class="mt-3 pt-2 border-t border-white/10 flex justify-end">
                                <a href="${URL.createObjectURL(item.blob)}" download="${item.name}" class="text-[11px] font-medium text-white underline hover:text-accent-200">Download File</a>
                            </div>
                        ` : ''}
                        <div class="flex items-center justify-end gap-2 mt-2">
                            <span class="text-[10px] ${isOutgoing ? 'text-accent-200' : 'text-slate-400'} font-mono">${timeStr}</span>
                        </div>
                    </div>
                    ${isOutgoing ? '<div class="h-8 w-8 rounded-full bg-accent-500/20 border border-accent-500/30 flex items-center justify-center text-xs text-accent-300 font-mono flex-shrink-0">ME</div>' : ''}
                </div>
            `;
        }

        return `
            <div class="flex items-start gap-3 ${isOutgoing ? 'justify-end' : ''}">
                ${!isOutgoing ? '<div class="h-8 w-8 rounded-full bg-navy-800 flex items-center justify-center text-xs text-slate-300 font-mono flex-shrink-0">P2</div>' : ''}
                <div class="${isOutgoing ? 'bg-accent-600 border border-accent-500' : 'bg-navy-800 border border-navy-700/60'} rounded-2xl px-4 py-3 max-w-md shadow-lg">
                    <p class="text-xs text-white">${escapeHtml(item.text)}</p>
                    <div class="flex items-center justify-end gap-2 mt-1">
                        <span class="text-[10px] ${isOutgoing ? 'text-accent-200' : 'text-slate-400'} font-mono">${timeStr}</span>
                        ${isOutgoing ? `<span class="text-[9px] font-mono uppercase text-accent-200">🔒 ${item.status || 'Sent'}</span>` : ''}
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
                    🔒 All messages, files, voice notes, and calls are end-to-end encrypted.
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