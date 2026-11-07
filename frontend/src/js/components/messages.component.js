import { getState } from '../core/state.js';
import { showToast } from '../utils/notifier.js';
import { rtcManager } from '../network/webrtc.manager.js';

let typingTimeout = null;
let selectedFilesToAttach = [];
let showMobileChat = false;
let searchQuery = '';
let editingMessageId = null;

export function renderMessages() {
    const state = getState();
    const isConnected = state.session.isConnected && rtcManager.dataChannel && rtcManager.dataChannel.readyState === 'open';

    const container = document.createElement('div');
    container.className = 'h-[calc(100vh-5rem)] max-w-7xl mx-auto flex flex-col md:flex-row bg-white border border-border rounded-2xl overflow-hidden shadow-sm animate-fade-in';

    container.innerHTML = `
        <!-- LEFT PANEL — Conversation List -->
        <div id="conversations-sidebar" class="${showMobileChat ? 'hidden' : 'flex'} md:flex flex-col w-full md:w-80 lg:w-96 border-r border-border bg-white flex-shrink-0">
            <!-- Header -->
            <div class="p-4 border-b border-border flex items-center justify-between bg-ivory-700/40">
                <div class="flex items-center gap-2.5">
                    <div class="h-9 w-9 rounded-xl bg-forest-800 flex items-center justify-center text-white font-bold text-xs shadow-xs">
                        PR
                    </div>
                    <div>
                        <h3 class="text-sm font-semibold text-charcoal leading-tight">PRIVORA Messages</h3>
                        <p class="text-[10px] font-mono text-forest-800 font-medium">E2EE DataChannel</p>
                    </div>
                </div>
                <span class="text-[10px] font-mono px-2 py-0.5 rounded-full ${isConnected ? 'bg-forest-800/10 text-forest-800 border border-forest-800/20' : 'bg-brown-800/10 text-brown-800 border border-brown-800/20'} font-medium">
                    ${isConnected ? 'AES-GCM-256' : 'Standby'}
                </span>
            </div>

            <!-- Search -->
            <div class="p-3 border-b border-border bg-white">
                <div class="relative">
                    <svg class="w-4 h-4 text-charcoal-muted absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                    </svg>
                    <input type="text" id="conversation-search" value="${escapeHtml(searchQuery)}" placeholder="Search sessions or messages..." class="w-full bg-ivory-800 border border-border rounded-xl pl-9 pr-3 py-2 text-xs text-charcoal placeholder:text-charcoal-muted focus:outline-none focus:border-forest-800 transition-colors">
                </div>
            </div>

            <!-- Conversation Entries -->
            <div class="flex-1 overflow-y-auto p-2 space-y-1 bg-ivory-800/20">
                <div id="active-session-item" class="p-3 rounded-xl bg-ivory-800 border border-sage/50 cursor-pointer transition-all hover:border-forest-800 shadow-2xs">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2.5 overflow-hidden">
                            <div class="h-8 w-8 rounded-full bg-forest-800 text-white font-mono text-xs font-bold flex items-center justify-center flex-shrink-0">
                                P2
                            </div>
                            <div class="overflow-hidden">
                                <h4 class="text-xs font-semibold text-charcoal truncate">Peer Room #${state.session.roomId || 'DEFAULT'}</h4>
                                <p class="text-[11px] text-charcoal-muted truncate mt-0.5" id="sidebar-last-msg">
                                    ${getLastMessagePreview()}
                                </p>
                            </div>
                        </div>
                        <span id="sidebar-status-badge" class="text-[10px] ${isConnected ? 'text-forest-800 font-semibold' : 'text-brown-800'} font-mono ml-2 flex-shrink-0">
                            ${isConnected ? 'Active' : 'Standby'}
                        </span>
                    </div>
                </div>
            </div>

            <!-- Actions Footer -->
            <div class="p-3 border-t border-border bg-white">
                <button id="btn-clear-chat" class="w-full py-2 bg-ivory-800 hover:bg-ivory-900 text-charcoal border border-border rounded-xl text-xs font-medium transition-all shadow-2xs flex items-center justify-center gap-2">
                    <svg class="w-3.5 h-3.5 text-charcoal-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                    </svg>
                    Clear Conversation
                </button>
            </div>
        </div>

        <!-- RIGHT PANEL — Main Chat Window -->
        <div id="main-chat-panel" class="${showMobileChat ? 'flex' : 'hidden'} md:flex flex-1 flex-col bg-white overflow-hidden relative">
            <!-- Header -->
            <div class="p-4 border-b border-border flex items-center justify-between bg-white z-10 shadow-2xs">
                <div class="flex items-center gap-3">
                    <button id="btn-mobile-back" class="md:hidden text-charcoal hover:text-forest-800 p-1.5 rounded-lg bg-ivory-800 border border-border">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
                        </svg>
                    </button>
                    <div class="h-9 w-9 rounded-full bg-forest-800 text-white font-mono text-xs font-bold flex items-center justify-center flex-shrink-0">
                        P2
                    </div>
                    <div>
                        <h4 class="text-xs font-semibold text-charcoal">Peer Connection Room #${state.session.roomId || 'None'}</h4>
                        <p id="chat-sub-status" class="text-[10px] ${isConnected ? 'text-forest-800 font-medium' : 'text-brown-800'} font-mono">
                            ${isConnected ? 'Encrypted via Web Crypto API (HKDF-AES-GCM)' : 'Waiting for DataChannel connection...'}
                        </p>
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    <span id="chat-status-dot" class="h-2.5 w-2.5 rounded-full ${isConnected ? 'bg-forest-800 animate-pulse' : 'bg-brown-800'}"></span>
                    <span id="chat-status-text" class="text-xs font-mono text-charcoal-muted font-medium hidden sm:inline">
                        ${isConnected ? 'Connected' : 'Disconnected'}
                    </span>
                </div>
            </div>

            <!-- Message History Area -->
            <div id="chat-messages-container" class="flex-1 overflow-y-auto p-4 sm:p-6 space-y-1 bg-ivory-800/40">
                <div class="flex justify-center mb-4">
                    <div class="px-3.5 py-1.5 rounded-full bg-white border border-border text-[10px] text-charcoal-muted font-mono shadow-2xs">
                        🔒 Messages and calls are end-to-end encrypted.
                    </div>
                </div>
                ${renderMessagesList()}
            </div>

            <!-- Incoming File Banner Prompt -->
            <div id="incoming-transfer-banner" class="hidden absolute bottom-20 left-4 right-4 sm:left-6 sm:right-6 bg-white border border-sage rounded-2xl p-4 shadow-xl flex items-center justify-between z-20 animate-fade-in">
                <div class="flex items-center gap-3 overflow-hidden">
                    <div class="h-10 w-10 rounded-xl bg-ivory-800 border border-sage flex items-center justify-center text-forest-800 flex-shrink-0">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
                        </svg>
                    </div>
                    <div class="overflow-hidden">
                        <h5 class="text-xs font-semibold text-charcoal truncate" id="incoming-file-name">Incoming File</h5>
                        <p class="text-[10px] text-charcoal-muted font-mono" id="incoming-file-meta">Size: 0 KB</p>
                    </div>
                </div>
                <div class="flex items-center gap-2 flex-shrink-0">
                    <button id="btn-decline-file" class="px-3 py-1.5 bg-ivory-800 hover:bg-ivory-900 text-charcoal border border-border rounded-xl text-xs font-medium transition-colors">Decline</button>
                    <button id="btn-accept-file" class="px-3 py-1.5 bg-forest-800 hover:bg-forest-700 text-white rounded-xl text-xs font-medium shadow-sm transition-colors">Accept Transfer</button>
                </div>
            </div>

            <!-- Attachment Preview Area -->
            <div id="attachment-preview-container" class="hidden px-4 sm:px-6 py-2 bg-white border-t border-border flex items-center gap-3">
                <div class="flex items-center gap-2 bg-ivory-800 border border-border rounded-xl px-3 py-1.5 text-xs text-charcoal overflow-hidden">
                    <svg class="w-4 h-4 text-forest-800 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/>
                    </svg>
                    <span id="preview-file-name" class="font-mono text-[11px] truncate max-w-xs text-charcoal">file.ext</span>
                    <button id="btn-remove-attachment" class="text-charcoal-muted hover:text-charcoal ml-2 font-bold">&times;</button>
                </div>
                <span class="text-[10px] text-charcoal-muted font-mono hidden sm:inline">Ready to send encrypted</span>
            </div>

            <!-- Editing Banner Indicator Area -->
            <div id="editing-banner-area" class="px-4 py-2 bg-ivory-700 border-t border-border flex items-center justify-between ${editingMessageId ? '' : 'hidden'}">
                <div class="flex items-center gap-2 text-xs text-forest-800 font-medium">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                    </svg>
                    <span>Editing message</span>
                </div>
                <button id="btn-cancel-edit" class="text-xs text-charcoal-muted hover:text-charcoal font-bold px-2 py-0.5">&times; Cancel</button>
            </div>

            <!-- Typing Indicator -->
            <div id="typing-indicator-area" class="px-6 py-1 text-[11px] text-forest-800 font-mono italic hidden bg-white border-t border-border/50">
                Peer is typing...
            </div>

            <!-- Message Composer -->
            <div class="p-3 sm:p-4 border-t border-border bg-white">
                <form id="chat-form" class="flex items-center gap-2 sm:gap-3">
                    <input type="file" id="chat-file-input" multiple class="hidden">
                    <button type="button" id="btn-attach-file" ${!isConnected || editingMessageId ? 'disabled' : ''} class="p-2.5 bg-ivory-800 hover:bg-ivory-900 text-charcoal border border-border rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs flex-shrink-0" title="Attach files">
                        <svg class="w-4 h-4 text-forest-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/>
                        </svg>
                    </button>
                    <input type="text" id="chat-input" ${!isConnected ? 'disabled' : ''} placeholder="${isConnected ? (editingMessageId ? 'Edit message...' : 'Type an encrypted message...') : 'Connect to a room to start messaging...'}" class="flex-1 bg-ivory-800 border border-border rounded-xl px-4 py-2.5 text-xs text-charcoal placeholder:text-charcoal-muted focus:outline-none focus:border-forest-800 disabled:opacity-50 disabled:cursor-not-allowed">
                    <button type="submit" ${!isConnected ? 'disabled' : ''} id="chat-submit-btn" class="px-4 py-2.5 bg-forest-800 hover:bg-forest-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium rounded-xl shadow-md transition-all flex items-center gap-2 flex-shrink-0">
                        <span id="chat-submit-text" class="hidden sm:inline">${editingMessageId ? 'Save' : 'Send'}</span>
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/>
                        </svg>
                    </button>
                </form>
            </div>
        </div>
    `;

    // DOM References
    const chatForm = container.querySelector('#chat-form');
    const chatInput = container.querySelector('#chat-input');
    const messagesContainer = container.querySelector('#chat-messages-container');
    const typingArea = container.querySelector('#typing-indicator-area');
    const fileInput = container.querySelector('#chat-file-input');
    const attachBtn = container.querySelector('#btn-attach-file');
    const previewContainer = container.querySelector('#attachment-preview-container');
    const previewFileName = container.querySelector('#preview-file-name');
    const removeAttachmentBtn = container.querySelector('#btn-remove-attachment');
    const searchInput = container.querySelector('#conversation-search');
    const mobileBackBtn = container.querySelector('#btn-mobile-back');
    const activeSessionItem = container.querySelector('#active-session-item');
    const editingBanner = container.querySelector('#editing-banner-area');
    const cancelEditBtn = container.querySelector('#btn-cancel-edit');
    const submitTextSpan = container.querySelector('#chat-submit-text');

    const incomingBanner = container.querySelector('#incoming-transfer-banner');
    const incomingFileName = container.querySelector('#incoming-file-name');
    const incomingFileMeta = container.querySelector('#incoming-file-meta');
    const acceptFileBtn = container.querySelector('#btn-accept-file');
    const declineFileBtn = container.querySelector('#btn-decline-file');

    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // Mobile Navigation
    activeSessionItem.addEventListener('click', () => {
        showMobileChat = true;
        refreshChatDOM(container);
    });

    mobileBackBtn.addEventListener('click', () => {
        showMobileChat = false;
        refreshChatDOM(container);
    });

    // Search Filtering
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase();
        refreshChatDOM(container);
    });

    // Cancel Editing handler
    cancelEditBtn.addEventListener('click', () => {
        editingMessageId = null;
        chatInput.value = '';
        editingBanner.classList.add('hidden');
        submitTextSpan.textContent = 'Send';
        attachBtn.removeAttribute('disabled');
    });

    // Attachment Actions
    attachBtn.addEventListener('click', () => {
        if (!editingMessageId) fileInput.click();
    });

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

    // Typing Indicators
    chatInput.addEventListener('input', () => {
        if (!editingMessageId) {
            rtcManager.sendTypingIndicator(true);
            clearTimeout(typingTimeout);
            typingTimeout = setTimeout(() => {
                rtcManager.sendTypingIndicator(false);
            }, 1500);
        }
    });

    // Submit Handler (Supports both Sending & Editing)
    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = chatInput.value.trim();

        try {
            if (editingMessageId) {
                if (!text) {
                    showToast('Edited message cannot be empty', 'error');
                    return;
                }
                const msgIdToEdit = editingMessageId;
                editingMessageId = null;
                chatInput.value = '';
                editingBanner.classList.add('hidden');
                submitTextSpan.textContent = 'Send';
                attachBtn.removeAttribute('disabled');

                await rtcManager.editChatMessage(msgIdToEdit, text);
            } else {
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
            }
            refreshChatDOM(container);
        } catch (err) {
            showToast('Failed to save message or edit', 'error');
        }
    });

    // Clear Conversation
    container.querySelector('#btn-clear-chat').addEventListener('click', () => {
        rtcManager.clearConversation();
        editingMessageId = null;
        chatInput.value = '';
        refreshChatDOM(container);
        showToast('Conversation cleared', 'info');
    });

    // Event Delegation for Message Action Menus (Edit / Copy)
    messagesContainer.addEventListener('click', (e) => {
        const menuBtn = e.target.closest('.message-menu-btn');
        if (menuBtn) {
            e.stopPropagation();
            const messageId = menuBtn.dataset.messageId;
            const dropdown = messagesContainer.querySelector(`#menu-dropdown-${messageId}`);
            messagesContainer.querySelectorAll('.message-dropdown').forEach(d => {
                if (d !== dropdown) d.classList.add('hidden');
            });
            dropdown.classList.toggle('hidden');
            return;
        }

        const editAction = e.target.closest('.action-edit-msg');
        if (editAction) {
            const messageId = editAction.dataset.messageId;
            const targetMsg = (rtcManager.chatMessages || []).find(m => m.messageId === messageId);
            if (targetMsg && targetMsg.direction === 'outgoing') {
                editingMessageId = messageId;
                chatInput.value = targetMsg.text;
                chatInput.focus();
                editingBanner.classList.remove('hidden');
                submitTextSpan.textContent = 'Save';
                attachBtn.setAttribute('disabled', 'true');
                previewContainer.classList.add('hidden');
            }
            messagesContainer.querySelectorAll('.message-dropdown').forEach(d => d.classList.add('hidden'));
            return;
        }

        const copyAction = e.target.closest('.action-copy-msg');
        if (copyAction) {
            const text = copyAction.dataset.text;
            navigator.clipboard.writeText(text).then(() => showToast('Message copied to clipboard', 'success'));
            messagesContainer.querySelectorAll('.message-dropdown').forEach(d => d.classList.add('hidden'));
            return;
        }

        messagesContainer.querySelectorAll('.message-dropdown').forEach(d => d.classList.add('hidden'));
    });

    // RTC Event Listeners
    rtcManager.on('incoming_transfer', (meta) => {
        incomingFileName.textContent = meta.name;
        incomingFileMeta.textContent = `Size: ${(meta.size / 1024).toFixed(1)} KB — Encrypted P2P`;
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

    rtcManager.on('transfer_completed', () => refreshChatDOM(container));
    rtcManager.on('transfer_progress', () => refreshChatDOM(container));
    rtcManager.on('transfer_initiated', () => refreshChatDOM(container));
    rtcManager.on('chat_message_received', () => refreshChatDOM(container));
    rtcManager.on('chat_message_sent', () => refreshChatDOM(container));
    rtcManager.on('chat_message_edited', () => refreshChatDOM(container));
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
        items.push({
            type: 'FILE_TRANSFER_OUTGOING',
            messageId: t.transferId,
            localOrder: t.localOrder || 0,
            timestamp: t.timestamp || Date.now(),
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
            localOrder: t.localOrder || 0,
            timestamp: t.timestamp || Date.now(),
            name: t.name,
            size: t.size,
            status: t.status || 'incoming',
            blob: t.blob,
            direction: 'incoming'
        });
    });

    // Chronological sequence sorting using localOrder
    items.sort((a, b) => (a.localOrder || 0) - (b.localOrder || 0));

    // Search filter
    if (searchQuery) {
        items = items.filter(i => {
            if (i.text) return i.text.toLowerCase().includes(searchQuery);
            if (i.name) return i.name.toLowerCase().includes(searchQuery);
            return false;
        });
    }

    if (items.length === 0) {
        return `
            <div class="flex flex-col items-center justify-center h-48 text-center text-charcoal-muted">
                <p class="text-xs font-medium text-charcoal">No messages in this session yet.</p>
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
        const roundedClass = isOutgoing
            ? (isPrevSameSender ? 'rounded-2xl rounded-tr-md rounded-br-md' : 'rounded-2xl rounded-br-xs')
            : (isPrevSameSender ? 'rounded-2xl rounded-tl-md rounded-bl-md' : 'rounded-2xl rounded-bl-xs');

        if (item.type === 'FILE_TRANSFER_OUTGOING' || item.type === 'FILE_TRANSFER_INCOMING') {
            const isCompleted = item.status === 'completed';
            let downloadBtnHtml = '';

            if (isCompleted && item.blob) {
                const blobUrl = URL.createObjectURL(item.blob);
                downloadBtnHtml = `
                    <a href="${blobUrl}" download="${escapeHtml(item.name)}" 
                       class="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 bg-forest-800 hover:bg-forest-700 text-white text-[11px] font-medium rounded-xl shadow-2xs transition-colors">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                        </svg>
                        Download File
                    </a>
                `;
            }

            return `
                <div class="flex items-end gap-2 ${marginClass} ${isOutgoing ? 'justify-end' : 'justify-start'}">
                    <div class="${isOutgoing ? 'bg-forest-800 text-white' : 'bg-white text-charcoal border border-border'} ${roundedClass} p-3.5 max-w-xs shadow-2xs w-72">
                        <div class="flex items-center gap-2.5">
                            <div class="h-8 w-8 rounded-lg ${isOutgoing ? 'bg-white/10 text-white' : 'bg-ivory-800 text-charcoal'} flex items-center justify-center flex-shrink-0">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
                                </svg>
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
                        ${downloadBtnHtml}
                        <div class="flex items-center justify-end gap-1.5 mt-1.5">
                            <span class="text-[9px] ${isOutgoing ? 'text-ivory-900' : 'text-charcoal-muted'} font-mono">${timeStr}</span>
                        </div>
                    </div>
                </div>
            `;
        }

        const messageId = item.messageId || '';
        const editedLabel = item.edited ? `<span class="text-[9px] italic opacity-80 mr-1">edited</span>` : '';

        return `
            <div class="flex items-end gap-2 ${marginClass} ${isOutgoing ? 'justify-end' : 'justify-start'} group relative">
                ${!isOutgoing && !isPrevSameSender ? '<div class="h-6 w-6 rounded-full bg-ivory-800 border border-border flex items-center justify-center text-[10px] text-charcoal font-mono flex-shrink-0 font-bold mb-0.5">P2</div>' : (!isOutgoing ? '<div class="w-6"></div>' : '')}
                
                <div class="relative">
                    <div class="${isOutgoing ? 'bg-forest-800 text-white' : 'bg-white text-charcoal border border-border'} ${roundedClass} px-3.5 py-2 max-w-md shadow-2xs">
                        <p class="text-xs break-words leading-relaxed ${isOutgoing ? 'text-white' : 'text-charcoal'}">${escapeHtml(item.text || '')}</p>
                        <div class="flex items-center justify-end gap-1.5 mt-0.5">
                            ${editedLabel}
                            <span class="text-[9px] ${isOutgoing ? 'text-ivory-900/80' : 'text-charcoal-muted'} font-mono">${timeStr}</span>
                            ${isOutgoing ? `<span class="text-[9px] font-mono text-ivory-900/80">✓</span>` : ''}
                        </div>
                    </div>

                    <button data-message-id="${messageId}" class="message-menu-btn absolute ${isOutgoing ? '-left-6' : '-right-6'} top-1 opacity-0 group-hover:opacity-100 transition-opacity p-1 text-charcoal-muted hover:text-charcoal bg-white/80 rounded-md shadow-xs border border-border">
                        <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
                    </button>

                    <div id="menu-dropdown-${messageId}" class="message-dropdown hidden absolute ${isOutgoing ? 'right-0' : 'left-0'} top-8 z-30 w-36 bg-white border border-border rounded-xl shadow-lg py-1 animate-fade-in text-xs text-charcoal">
                        ${isOutgoing ? `<button data-message-id="${messageId}" class="action-edit-msg w-full px-3 py-1.5 text-left hover:bg-ivory-800 flex items-center gap-2">Edit Message</button>` : ''}
                        <button data-text="${escapeHtml(item.text || '')}" class="action-copy-msg w-full px-3 py-1.5 text-left hover:bg-ivory-800 flex items-center gap-2">Copy Message</button>
                    </div>
                </div>

                ${isOutgoing && !isPrevSameSender ? '<div class="h-6 w-6 rounded-full bg-ivory-800 border border-border flex items-center justify-center text-[10px] text-forest-800 font-mono flex-shrink-0 font-bold mb-0.5">ME</div>' : (isOutgoing ? '<div class="w-6"></div>' : '')}
            </div>
        `;
    }).join('');
}

function getLastMessagePreview() {
    const msgs = rtcManager.chatMessages || [];
    if (msgs.length === 0) return 'End-to-end encrypted DataChannel chat';
    const last = msgs[msgs.length - 1];
    return last.text ? escapeHtml(last.text) : 'File attachment';
}

function refreshChatDOM(container) {
    const sidebar = container.querySelector('#conversations-sidebar');
    const mainChat = container.querySelector('#main-chat-panel');

    if (sidebar && mainChat) {
        sidebar.className = `${showMobileChat ? 'hidden' : 'flex'} md:flex flex-col w-full md:w-80 lg:w-96 border-r border-border bg-white flex-shrink-0`;
        mainChat.className = `${showMobileChat ? 'flex' : 'hidden'} md:flex flex-1 flex-col bg-white overflow-hidden relative`;
    }

    const messagesContainer = container.querySelector('#chat-messages-container');
    if (messagesContainer) {
        messagesContainer.innerHTML = `
            <div class="flex justify-center mb-4">
                <div class="px-3.5 py-1.5 rounded-full bg-white border border-border text-[10px] text-charcoal-muted font-mono shadow-2xs">
                    🔒 Messages and calls are end-to-end encrypted.
                </div>
            </div>
            ${renderMessagesList()}
        `;
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    const lastMsgEl = container.querySelector('#sidebar-last-msg');
    if (lastMsgEl) {
        lastMsgEl.textContent = getLastMessagePreview();
    }
}

function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}.