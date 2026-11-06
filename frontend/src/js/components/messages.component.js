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
        <div class="bg-white border border-border rounded-2xl flex flex-col overflow-hidden shadow-2xs">
            <div class="p-4 border-b border-border flex items-center justify-between bg-ivory-700/30">
                <h3 class="text-sm font-semibold text-charcoal">Secure Chats</h3>
                <span class="text-[10px] font-mono px-2 py-0.5 rounded-full bg-ivory-900 text-forest-800 border border-sage font-medium">AES-GCM-256</span>
            </div>
            <div class="p-3">
                <input type="text" placeholder="Search secure sessions..." class="w-full bg-ivory-800 border border-border rounded-xl px-3 py-2 text-xs text-charcoal placeholder:text-charcoal-muted focus:outline-none focus:border-forest-800">
            </div>
            <div class="flex-1 overflow-y-auto p-2 space-y-1">
                <div class="p-3 rounded-xl bg-ivory-800/60 border border-border cursor-pointer shadow-2xs">
                    <div class="flex items-center justify-between">
                        <span class="text-xs font-semibold text-charcoal">Peer Room #${state.session.roomId || 'DEFAULT'}</span>
                        <span id="sidebar-status-badge" class="text-[10px] ${isConnected ? 'text-forest-800' : 'text-brown-800'} font-mono font-medium">${isConnected ? 'Active' : 'Standby'}</span>
                    </div>
                    <p class="text-[11px] text-charcoal-muted truncate mt-1">End-to-end encrypted DataChannel chat</p>
                </div>
            </div>
            <div class="p-3 border-t border-border">
                <button id="btn-clear-chat" class="w-full py-2 bg-white hover:bg-ivory-800 text-charcoal border border-border rounded-xl text-xs font-medium transition-all shadow-2xs">
                    Clear Conversation
                </button>
            </div>
        </div>

        <!-- Active Chat Window -->
        <div class="md:col-span-3 bg-white border border-border rounded-2xl flex flex-col overflow-hidden relative shadow-2xs">
            <!-- Chat Header -->
            <div class="p-4 border-b border-border flex items-center justify-between bg-white">
                <div class="flex items-center gap-3">
                    <div class="h-9 w-9 rounded-full bg-ivory-800 border border-border flex items-center justify-center text-forest-800 font-mono text-xs font-bold">P2</div>
                    <div>
                        <h4 class="text-xs font-semibold text-charcoal">Peer Connection Room #${state.session.roomId || 'None'}</h4>
                        <p id="chat-sub-status" class="text-[10px] ${isConnected ? 'text-forest-800 font-medium' : 'text-brown-800'} font-mono">${isConnected ? 'Encrypted via Web Crypto API (HKDF-AES-GCM)' : 'Waiting for DataChannel connection...'}</p>
                    </div>
                </div>
                <div class="flex items-center gap-3">
                    <div class="flex items-center gap-2">
                        <span id="chat-status-dot" class="h-2.5 w-2.5 rounded-full ${isConnected ? 'bg-forest-800 animate-pulse' : 'bg-brown-800'}"></span>
                        <span id="chat-status-text" class="text-xs font-mono text-charcoal-muted font-medium">${isConnected ? 'Connected' : 'Disconnected'}</span>
                    </div>
                </div>
            </div>

            <!-- Messages Stream Area -->
            <div id="chat-messages-container" class="flex-1 overflow-y-auto p-6 space-y-1 bg-ivory-800/40">
                <div class="flex justify-center mb-3">
                    <div class="px-3 py-1.5 rounded-full bg-white border border-border text-[10px] text-charcoal-muted font-mono shadow-2xs">
                        🔒 All messages and files are end-to-end encrypted.
                    </div>
                </div>
                ${renderMessagesList()}
            </div>

            <!-- Incoming Transfer Banner / Prompt -->
            <div id="incoming-transfer-banner" class="hidden absolute bottom-20 left-6 right-6 bg-white border border-sage rounded-2xl p-4 shadow-xl flex items-center justify-between z-20 animate-fade-in">
                <div class="flex items-center gap-3">
                    <div class="h-10 w-10 rounded-xl bg-ivory-800 border border-sage flex items-center justify-center text-forest-800">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
                    </div>
                    <div>
                        <h5 class="text-xs font-semibold text-charcoal" id="incoming-file-name">Incoming File</h5>
                        <p class="text-[10px] text-charcoal-muted font-mono" id="incoming-file-meta">Size: 0 KB</p>
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    <button id="btn-decline-file" class="px-3 py-1.5 bg-ivory-800 hover:bg-ivory-900 text-charcoal border border-border rounded-xl text-xs font-medium transition-colors">Decline</button>
                    <button id="btn-accept-file" class="px-3 py-1.5 bg-forest-800 hover:bg-forest-700 text-white rounded-xl text-xs font-medium shadow-sm transition-colors">Accept & Download</button>
                </div>
            </div>

            <!-- Attachment Preview Area -->
            <div id="attachment-preview-container" class="hidden px-6 py-2 bg-white border-t border-border flex items-center gap-3">
                <div class="flex items-center gap-2 bg-ivory-800 border border-border rounded-xl px-3 py-1.5 text-xs text-charcoal">
                    <svg class="w-4 h-4 text-forest-800" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/></svg>
                    <span id="preview-file-name" class="font-mono text-[11px] truncate max-w-xs text-charcoal">file.ext</span>
                    <button id="btn-remove-attachment" class="text-charcoal-muted hover:text-charcoal ml-2 font-bold">&times;</button>
                </div>
                <span class="text-[10px] text-charcoal-muted font-mono">Ready to send via secure P2P channel</span>
            </div>

            <!-- Typing Indicator Area -->
            <div id="typing-indicator-area" class="px-6 py-1 text-[11px] text-forest-800 font-mono italic hidden bg-white">
                Peer is typing...
            </div>

            <!-- Message Input Form -->
            <div class="p-4 border-t border-border bg-white">
                <form id="chat-form" class="flex items-center gap-3">
                    <input type="file" id="chat-file-input" multiple class="hidden">
                    <button type="button" id="btn-attach-file" ${!isConnected ? 'disabled' : ''} class="p-2.5 bg-ivory-800 hover:bg-ivory-900 text-charcoal border border-border rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs" title="Attach files">
                        <svg class="w-4 h-4 text-forest-800" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/></svg>
                    </button>
                    <input type="text" id="chat-input" ${!isConnected ? 'disabled' : ''} placeholder="${isConnected ? 'Type an encrypted message...' : 'Connect to a room to start messaging...'}" class="flex-1 bg-ivory-800 border border-border rounded-xl px-4 py-2.5 text-xs text-charcoal placeholder:text-charcoal-muted focus:outline-none focus:border-forest-800 disabled:opacity-50 disabled:cursor-not-allowed">
                    <button type="submit" ${!isConnected ? 'disabled' : ''} class="px-4 py-2.5 bg-forest-800 hover:bg-forest-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium rounded-xl shadow-md transition-all flex items-center gap-2">
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
    
    rtcManager.activeTransfers.forEach((t) => {
        if (t.status !== 'completed') {
            items.push({
                type: 'FILE_TRANSFER_OUTGOING',
                messageId: t.transferId,
                timestamp: t.timestamp || Date.now(),
                name: t.name,
                size: t.size,
                status: t.status,
                progress: t.progress || 0,
                direction: 'outgoing'
            });
        }
    });

    rtcManager.incomingTransfers.forEach((t) => {
        if (t.status !== 'completed') {
            items.push({
                type: 'FILE_TRANSFER_INCOMING',
                messageId: t.transferId,
                timestamp: t.timestamp || Date.now(),
                name: t.name,
                size: t.size,
                status: t.status || 'incoming',
                blob: t.blob,
                direction: 'incoming'
            });
        }
    });

    items.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

    if (items.length === 0) {
        return `
            <div class="flex flex-col items-center justify-center h-48 text-center text-charcoal-muted">
                <p class="text-xs font-medium text-charcoal">No messages in this secure session yet.</p>
                <p class="text-[10px] mt-1 text-charcoal-muted">Type or attach files below to start end-to-end encrypted sharing.</p>
            </div>
        `;
    }

    return items.map((item, index, arr) => {
        const isOutgoing = item.direction === 'outgoing' || item.type === 'FILE_TRANSFER_OUTGOING';
        const timeStr = new Date(item.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const prevItem = arr[index - 1];
        const isPrevSameSender = prevItem && (
            (prevItem.direction === 'outgoing' || prevItem.type === 'FILE_TRANSFER_OUTGOING') === isOutgoing
        );

        const marginClass = isPrevSameSender ? 'mt-0.5 mb-1' : 'my-2.5';

        let roundedClass = '';
        if (isOutgoing) {
            roundedClass = isPrevSameSender ? 'rounded-2xl rounded-tr-md rounded-br-md' : 'rounded-2xl rounded-br-xs';
        } else {
            roundedClass = isPrevSameSender ? 'rounded-2xl rounded-tl-md rounded-bl-md' : 'rounded-2xl rounded-bl-xs';
        }

        if (item.type === 'FILE_TRANSFER_OUTGOING' || item.type === 'FILE_TRANSFER_INCOMING') {
            const isCompleted = item.status === 'completed';
            return `
                <div class="flex items-end gap-2 ${marginClass} ${isOutgoing ? 'justify-end' : 'justify-start'}">
                    <div class="${isOutgoing ? 'bg-forest-800 text-white' : 'bg-white text-charcoal border border-border'} ${roundedClass} p-3 max-w-xs shadow-2xs w-72">
                        <div class="flex items-center gap-2.5">
                            <div class="h-8 w-8 rounded-lg ${isOutgoing ? 'bg-white/10 text-white' : 'bg-ivory-800 text-charcoal'} flex items-center justify-center flex-shrink-0">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>
                            </div>
                            <div class="overflow-hidden flex-1">
                                <h6 class="text-xs font-medium truncate ${isOutgoing ? 'text-white' : 'text-charcoal'}">${escapeHtml(item.name)}</h6>
                                <p class="text-[10px] font-mono ${isOutgoing ? 'text-ivory-900' : 'text-charcoal-muted'}">${(item.size / 1024).toFixed(1)} KB • <span class="uppercase">${item.status}</span></p>
                            </div>
                        </div>
                        ${!isCompleted && item.status === 'transferring' ? `
                            <div class="w-full ${isOutgoing ? 'bg-black/20' : 'bg-ivory-800'} rounded-full h-1 mt-2 overflow-hidden">
                                <div class="${isOutgoing ? 'bg-white' : 'bg-forest-800'} h-1 transition-all duration-300" style="width: ${item.progress || 0}%"></div>
                            </div>
                        ` : ''}
                        <div class="flex items-center justify-end gap-1.5 mt-1.5">
                            <span class="text-[9px] ${isOutgoing ? 'text-ivory-900' : 'text-charcoal-muted'} font-mono">${timeStr}</span>
                        </div>
                    </div>
                </div>
            `;
        }

        return `
            <div class="flex items-end gap-2 ${marginClass} ${isOutgoing ? 'justify-end' : 'justify-start'}">
                ${!isOutgoing && !isPrevSameSender ? '<div class="h-6 w-6 rounded-full bg-ivory-800 border border-border flex items-center justify-center text-[10px] text-charcoal font-mono flex-shrink-0 font-bold mb-0.5">P2</div>' : (!isOutgoing ? '<div class="w-6"></div>' : '')}
                <div class="${isOutgoing ? 'bg-forest-800 text-white' : 'bg-white text-charcoal border border-border'} ${roundedClass} px-3.5 py-2 max-w-md shadow-2xs">
                    <p class="text-xs break-words leading-relaxed ${isOutgoing ? 'text-white' : 'text-charcoal'}">${escapeHtml(item.text || '')}</p>
                    <div class="flex items-center justify-end gap-1.5 mt-0.5">
                        <span class="text-[9px] ${isOutgoing ? 'text-ivory-900/80' : 'text-charcoal-muted'} font-mono">${timeStr}</span>
                        ${isOutgoing ? `<span class="text-[9px] font-mono text-ivory-900/80">✓</span>` : ''}
                    </div>
                </div>
                ${isOutgoing && !isPrevSameSender ? '<div class="h-6 w-6 rounded-full bg-ivory-800 border border-border flex items-center justify-center text-[10px] text-forest-800 font-mono flex-shrink-0 font-bold mb-0.5">ME</div>' : (isOutgoing ? '<div class="w-6"></div>' : '')}
            </div>
        `;
    }).join('');
}

function refreshChatDOM(container) {
    const messagesContainer = container.querySelector('#chat-messages-container');
    if (messagesContainer) {
        messagesContainer.innerHTML = `
            <div class="flex justify-center mb-3">
                <div class="px-3 py-1.5 rounded-full bg-white border border-border text-[10px] text-charcoal-muted font-mono shadow-2xs">
                    🔒 All messages and files are end-to-end encrypted.
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