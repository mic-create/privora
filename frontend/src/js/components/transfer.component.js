import { getState, updateState } from '../core/state.js';
import { showToast } from '../utils/notifier.js';
import { rtcManager } from '../network/webrtc.manager.js';

let selectedFiles = [];
let pendingIncomingTransfers = [];

export function renderTransfer() {
    const state = getState();
    const container = document.createElement('div');
    container.className = 'space-y-6 animate-fade-in max-w-7xl mx-auto pb-12';

    const isDataChannelOpen = rtcManager.dataChannel && rtcManager.dataChannel.readyState === 'open';

    container.innerHTML = `
        <!-- Session Controls Header -->
        <div class="bg-white border border-border rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-2xs">
            <div class="flex items-center gap-4">
                <div class="h-12 w-12 rounded-xl bg-ivory-800 border border-sage flex items-center justify-center text-forest-800">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                </div>
                <div>
                    <h3 class="text-base font-semibold text-charcoal">Peer-to-Peer Encrypted File Transfer</h3>
                    <p class="text-xs text-charcoal-muted font-mono mt-0.5" id="transfer-room-status">Status: ${isDataChannelOpen ? 'DataChannel OPEN • Ready' : (state.session.isConnected ? 'Connected • Establishing DataChannel...' : 'Disconnected • Ready')}</p>
                </div>
            </div>
            <div class="flex items-center gap-3 w-full md:w-auto flex-wrap">
                <button id="btn-create-room" class="flex-1 md:flex-none px-4 py-2.5 bg-forest-800 hover:bg-forest-700 text-white text-xs font-medium rounded-xl shadow-md transition-all">
                    Create Secure Room
                </button>
                <button id="btn-join-room-modal" class="flex-1 md:flex-none px-4 py-2.5 bg-white hover:bg-ivory-800 text-charcoal text-xs font-medium rounded-xl border border-border transition-all shadow-2xs">
                    Join via Code
                </button>
                <button id="btn-leave-room" class="${state.session.isConnected ? '' : 'hidden'} px-4 py-2.5 bg-red-600/10 hover:bg-red-600/20 text-red-700 border border-red-500/30 text-xs font-medium rounded-xl transition-all">
                    Leave Room
                </button>
            </div>
        </div>

        <!-- Incoming Transfer Notification Banner Area -->
        <div id="incoming-banner-container" class="space-y-3"></div>

        <!-- Main Transfer Workspace -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            <!-- Drag and Drop Dropzone & Queue (2 Cols) -->
            <div class="lg:col-span-2 space-y-6">
                <div class="bg-white border border-border rounded-2xl p-6 shadow-2xs">
                    <div class="flex items-center justify-between mb-4">
                        <h4 class="text-sm font-semibold text-charcoal">Selected Files & Dropzone</h4>
                        <span id="file-counter" class="text-xs text-charcoal-muted font-mono">${selectedFiles.length} files selected</span>
                    </div>

                    <!-- Dropzone Target -->
                    <div id="dropzone" class="border-2 border-dashed border-border hover:border-forest-800 transition-colors rounded-2xl p-8 lg:p-10 text-center bg-ivory-800/40 cursor-pointer flex flex-col items-center justify-center">
                        <div class="h-14 w-14 rounded-2xl bg-white border border-border flex items-center justify-center text-forest-800 mb-4 shadow-2xs">
                            <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>
                        </div>
                        <p class="text-sm font-medium text-charcoal">Drag and drop files here, or <span class="text-forest-800 underline underline-offset-2">browse</span></p>
                        <p class="text-xs text-charcoal-muted mt-1.5 font-mono">Encrypted via AES-GCM-256 with SHA-256 integrity verification</p>
                        <input type="file" id="file-input" multiple class="hidden">
                    </div>

                    <!-- Selected Files Queue List -->
                    <div class="mt-6">
                        <div class="flex items-center justify-between mb-3">
                            <span class="text-xs font-semibold uppercase tracking-wider text-charcoal-muted">Transfer Queue</span>
                            <button id="btn-clear-queue" class="text-xs text-charcoal-muted hover:text-red-700 transition-colors">Clear Queue</button>
                        </div>
                        <div id="file-queue-list" class="space-y-2 max-h-48 overflow-y-auto pr-1">
                            ${selectedFiles.length === 0 ? `<div class="text-center py-6 text-xs text-charcoal-muted border border-border rounded-xl bg-ivory-800/20">No files queued for transfer yet.</div>` : ''}
                        </div>
                        <div class="mt-4">
                            <button id="btn-send-files" ${selectedFiles.length === 0 || !isDataChannelOpen ? 'disabled' : ''} class="w-full py-3 bg-forest-800 hover:bg-forest-700 disabled:bg-forest-800/30 disabled:text-white/50 disabled:cursor-not-allowed text-white text-xs font-medium rounded-xl shadow-md transition-all flex items-center justify-center gap-2">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>
                                Send Files (Encrypted P2P)
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Active & Completed Transfers Panel -->
                <div class="bg-white border border-border rounded-2xl p-6 shadow-2xs">
                    <h4 class="text-sm font-semibold text-charcoal mb-4">Active & Completed Transfers</h4>
                    <div id="transfers-progress-container" class="space-y-3">
                        <div class="text-center py-6 text-xs text-charcoal-muted border border-border rounded-xl bg-ivory-800/20">
                            No active file transfers in progress.
                        </div>
                    </div>
                </div>
            </div>

            <!-- Transfer Sidebar / Peer Connection Details -->
            <div class="space-y-6">
                <!-- Peer Info Card -->
                <div class="bg-white border border-border rounded-2xl p-6 shadow-2xs">
                    <h4 class="text-sm font-semibold text-charcoal mb-4">Peer Connection</h4>
                    <div class="space-y-3 font-mono text-xs">
                        <div class="flex justify-between py-2 border-b border-border">
                            <span class="text-charcoal-muted">Room ID:</span>
                            <span id="info-room-id" class="text-forest-800 font-semibold">${state.session.roomId || 'None'}</span>
                        </div>
                        <div class="flex justify-between py-2 border-b border-border">
                            <span class="text-charcoal-muted">Connection State:</span>
                            <span id="peer-state" class="text-brown-800 font-semibold">${state.session.isConnected ? 'Connected' : 'Not Connected'}</span>
                        </div>
                        <div class="flex justify-between py-2 border-b border-border">
                            <span class="text-charcoal-muted">DataChannel:</span>
                            <span id="datachannel-state" class="${isDataChannelOpen ? 'text-forest-800 font-semibold' : 'text-charcoal-muted'}">${isDataChannelOpen ? 'Open (Active)' : 'Standby'}</span>
                        </div>
                        <div class="flex justify-between py-2">
                            <span class="text-charcoal-muted">Encryption:</span>
                            <span class="text-forest-800">AES-GCM-256</span>
                        </div>
                    </div>
                    <div class="mt-5 space-y-2">
                        <button id="btn-copy-link" class="w-full py-2.5 bg-white hover:bg-ivory-800 text-charcoal border border-border rounded-xl text-xs font-medium transition-all shadow-2xs flex items-center justify-center gap-2">
                            <svg class="w-4 h-4 text-forest-800" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/></svg>
                            Copy Invitation Link
                        </button>
                    </div>
                </div>

                <!-- Security & Notice Card -->
                <div class="bg-white border border-border rounded-2xl p-6 shadow-2xs">
                    <div class="flex items-center gap-3 mb-3">
                        <div class="h-8 w-8 rounded-lg bg-ivory-800 border border-sage flex items-center justify-center text-forest-800">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                        </div>
                        <h4 class="text-sm font-semibold text-charcoal">Mobile P2P Synced</h4>
                    </div>
                    <p class="text-xs text-charcoal-muted leading-relaxed">
                        DataChannel is now explicitly required to reach the OPEN state before enabling file transmission buttons across mobile browsers.
                    </p>
                </div>
            </div>

        </div>
    `;

    // Event Listeners
    rtcManager.on('room_created', (roomId) => {
        updateState(s => ({ ...s, session: { ...s.session, roomId, isConnected: true, isHost: true } }));
        refreshUIState();
        showToast(`Room created successfully: ${roomId}`, 'success');
    });

    rtcManager.on('room_joined', (roomId) => {
        updateState(s => ({ ...s, session: { ...s.session, roomId, isConnected: true, isHost: false } }));
        refreshUIState();
        showToast(`Joined room: ${roomId}`, 'success');
    });

    rtcManager.on('datachannel_open', () => {
        refreshUIState();
        showToast('DataChannel operational for secure transfers', 'success');
    });

    rtcManager.on('incoming_transfer', (meta) => {
        pendingIncomingTransfers.push(meta);
        renderIncomingBanners(container);
        showToast(`Incoming file transfer: ${meta.name}`, 'info');
    });

    rtcManager.on('transfer_progress', (transfer) => {
        upsertTransferRecord(container, transfer);
    });

    rtcManager.on('transfer_completed', (transfer) => {
        upsertTransferRecord(container, transfer);
    });

    if (selectedFiles.length > 0) {
        renderQueueDOM(container);
    }

    container.querySelector('#btn-create-room').addEventListener('click', async () => {
        try { await rtcManager.createRoom(); } catch (err) { showToast('Failed to create room', 'error'); }
    });

    container.querySelector('#btn-join-room-modal').addEventListener('click', async () => {
        const roomCode = prompt('Enter Room ID / Code:');
        if (roomCode) {
            try { await rtcManager.joinRoom(roomCode.toUpperCase().trim()); } catch (err) { showToast('Failed to join room', 'error'); }
        }
    });

    const leaveBtn = container.querySelector('#btn-leave-room');
    if (leaveBtn) {
        leaveBtn.addEventListener('click', () => {
            rtcManager.closeConnection();
            selectedFiles = [];
            pendingIncomingTransfers = [];
            updateState(s => ({ ...s, session: { ...s.session, roomId: null, isConnected: false, isHost: false } }));
            showToast('Left session room', 'info');
            renderTransfer();
        });
    }

    container.querySelector('#btn-copy-link').addEventListener('click', () => {
        const roomId = getState().session.roomId;
        if (!roomId) { showToast('No active room to share', 'error'); return; }
        const link = `${window.location.origin}${window.location.pathname}#transfer?room=${roomId}`;
        navigator.clipboard.writeText(link).then(() => showToast('Invitation link copied', 'success'));
    });

    const dropzone = container.querySelector('#dropzone');
    const fileInput = container.querySelector('#file-input');

    dropzone.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('border-forest-800', 'bg-ivory-700/50'); });
    dropzone.addEventListener('dragleave', () => { dropzone.classList.remove('border-forest-800', 'bg-ivory-700/50'); });
    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('border-forest-800', 'bg-ivory-700/50');
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            selectedFiles = [...selectedFiles, ...Array.from(e.dataTransfer.files)];
            renderQueueDOM(container);
            refreshUIState();
            showToast(`Queued ${e.dataTransfer.files.length} file(s)`, 'success');
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
            selectedFiles = [...selectedFiles, ...Array.from(e.target.files)];
            renderQueueDOM(container);
            refreshUIState();
            showToast(`Queued ${e.target.files.length} file(s)`, 'success');
        }
    });

    container.querySelector('#btn-clear-queue').addEventListener('click', () => {
        selectedFiles = [];
        renderQueueDOM(container);
        refreshUIState();
        showToast('Queue cleared', 'info');
    });

    container.querySelector('#btn-send-files').addEventListener('click', async () => {
        if (selectedFiles.length === 0) return;
        showToast('Encrypting & initiating transfer...', 'info');
        const filesToSend = [...selectedFiles];
        selectedFiles = [];
        renderQueueDOM(container);
        refreshUIState();
        await rtcManager.sendFiles(filesToSend);
    });

    return container;
}

function renderQueueDOM(container) {
    const queueList = container.querySelector('#file-queue-list');
    const counter = container.querySelector('#file-counter');
    if (counter) counter.textContent = `${selectedFiles.length} files selected`;
    if (!queueList) return;

    if (selectedFiles.length === 0) {
        queueList.innerHTML = `<div class="text-center py-6 text-xs text-charcoal-muted border border-border rounded-xl bg-ivory-800/20">No files queued for transfer yet.</div>`;
        return;
    }

    queueList.innerHTML = selectedFiles.map((file, idx) => `
        <div class="flex items-center justify-between p-3 bg-ivory-800/60 border border-border rounded-xl">
            <div class="flex items-center gap-3 overflow-hidden">
                <div class="h-8 w-8 rounded-lg bg-white border border-border flex items-center justify-center text-forest-800 flex-shrink-0 font-mono text-[10px]">FILE</div>
                <div class="overflow-hidden">
                    <p class="text-xs font-medium text-charcoal truncate">${file.name}</p>
                    <p class="text-[10px] text-charcoal-muted font-mono">${(file.size / (1024 * 1024)).toFixed(2)} MB • Ready</p>
                </div>
            </div>
            <button data-index="${idx}" class="remove-queue-item text-charcoal-muted hover:text-red-700 p-1">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
        </div>
    `).join('');

    queueList.querySelectorAll('.remove-queue-item').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.currentTarget.dataset.index);
            selectedFiles.splice(idx, 1);
            renderQueueDOM(container);
            refreshUIState();
        });
    });
}

function renderIncomingBanners(container) {
    const bannerContainer = container.querySelector('#incoming-banner-container');
    if (!bannerContainer) return;

    bannerContainer.innerHTML = pendingIncomingTransfers.map(meta => `
        <div class="bg-white border border-sage rounded-2xl p-5 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-fade-in">
            <div class="flex items-center gap-3">
                <div class="h-10 w-10 rounded-xl bg-ivory-800 border border-sage flex items-center justify-center text-forest-800 font-mono text-xs">IN</div>
                <div>
                    <p class="text-xs font-semibold text-charcoal">Incoming Encrypted File Transfer</p>
                    <p class="text-xs text-charcoal font-medium mt-0.5">${meta.name} <span class="text-charcoal-muted font-mono">(${(meta.size / (1024 * 1024)).toFixed(2)} MB)</span></p>
                </div>
            </div>
            <div class="flex items-center gap-2 w-full md:w-auto">
                <button data-id="${meta.transferId}" class="accept-transfer-btn flex-1 md:flex-none px-4 py-2 bg-forest-800 hover:bg-forest-700 text-white text-xs font-medium rounded-xl transition-all">
                    Accept & Download
                </button>
                <button data-id="${meta.transferId}" class="decline-transfer-btn flex-1 md:flex-none px-4 py-2 bg-white hover:bg-ivory-800 text-charcoal text-xs font-medium rounded-xl border border-border transition-all">
                    Decline
                </button>
            </div>
        </div>
    `).join('');

    bannerContainer.querySelectorAll('.accept-transfer-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.dataset.id;
            rtcManager.acceptTransfer(id);
            pendingIncomingTransfers = pendingIncomingTransfers.filter(m => m.transferId !== id);
            renderIncomingBanners(container);
            showToast('Transfer accepted. Receiving encrypted chunks...', 'success');
        });
    });

    bannerContainer.querySelectorAll('.decline-transfer-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.dataset.id;
            rtcManager.declineTransfer(id);
            pendingIncomingTransfers = pendingIncomingTransfers.filter(m => m.transferId !== id);
            renderIncomingBanners(container);
            showToast('Transfer declined', 'info');
        });
    });
}

function upsertTransferRecord(container, transfer) {
    const progressContainer = container.querySelector('#transfers-progress-container');
    if (!progressContainer) return;

    if (progressContainer.querySelector('.text-center')) {
        progressContainer.innerHTML = '';
    }

    let itemEl = progressContainer.querySelector(`[data-transfer-id="${transfer.transferId}"]`);
    if (!itemEl) {
        itemEl = document.createElement('div');
        itemEl.dataset.transferId = transfer.transferId;
        itemEl.className = 'p-4 bg-ivory-800/60 border border-border rounded-xl space-y-3 animate-fade-in';
        progressContainer.appendChild(itemEl);
    }

    const isCompleted = transfer.status === 'completed';
    const progressVal = transfer.progress || 0;

    let actionButtonHtml = '';
    if (isCompleted && transfer.blob) {
        const url = URL.createObjectURL(transfer.blob);
        actionButtonHtml = `<a href="${url}" download="${transfer.name}" class="px-3 py-1.5 bg-forest-800 hover:bg-forest-700 text-white text-xs font-medium rounded-lg transition-all shadow-2xs">Save File</a>`;
    } else {
        actionButtonHtml = `<button data-id="${transfer.transferId}" class="cancel-transfer-btn text-xs text-red-700 hover:text-red-800">Cancel</button>`;
    }

    itemEl.innerHTML = `
        <div class="flex items-center justify-between">
            <div class="flex items-center gap-3 overflow-hidden">
                <div class="h-8 w-8 rounded-lg bg-white border border-border flex items-center justify-center text-forest-800 flex-shrink-0 font-mono text-[10px]">
                    ${isCompleted ? '✓' : 'TR'}
                </div>
                <div class="overflow-hidden">
                    <p class="text-xs font-medium text-charcoal truncate">${transfer.name}</p>
                    <p class="text-[10px] text-charcoal-muted font-mono uppercase">${transfer.status} • ${progressVal}%</p>
                </div>
            </div>
            <div>${actionButtonHtml}</div>
        </div>
        <div class="w-full bg-ivory-900 rounded-full h-1.5 overflow-hidden border border-border">
            <div class="bg-forest-800 h-full transition-all duration-200" style="width: ${progressVal}%"></div>
        </div>
    `;

    itemEl.querySelectorAll('.cancel-transfer-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.dataset.id;
            rtcManager.cancelTransfer(id);
            itemEl.remove();
            showToast('Transfer cancelled', 'info');
        });
    });
}

function refreshUIState() {
    const state = getState();
    const statusEl = document.getElementById('transfer-room-status');
    const roomEl = document.getElementById('info-room-id');
    const peerEl = document.getElementById('peer-state');
    const dcEl = document.getElementById('datachannel-state');
    const leaveBtn = document.getElementById('btn-leave-room');
    const sendBtn = document.getElementById('btn-send-files');

    const isOpen = rtcManager.dataChannel && rtcManager.dataChannel.readyState === 'open';

    if (statusEl) statusEl.textContent = `Status: ${isOpen ? 'DataChannel OPEN • Ready' : (state.session.isConnected ? 'Connected • Establishing DataChannel...' : 'Disconnected • Ready')}`;
    if (roomEl) roomEl.textContent = state.session.roomId || 'None';
    if (peerEl) {
        peerEl.textContent = state.session.isConnected ? 'Connected' : 'Not Connected';
        peerEl.className = state.session.isConnected ? 'text-forest-800 font-semibold' : 'text-brown-800 font-semibold';
    }
    if (dcEl) {
        dcEl.textContent = isOpen ? 'Open (Active)' : 'Standby';
        dcEl.className = isOpen ? 'text-forest-800 font-semibold' : 'text-charcoal-muted';
    }
    if (leaveBtn) {
        if (state.session.isConnected) leaveBtn.classList.remove('hidden');
        else leaveBtn.classList.add('hidden');
    }
    if (sendBtn) {
        sendBtn.disabled = selectedFiles.length === 0 || !isOpen;
    }
}