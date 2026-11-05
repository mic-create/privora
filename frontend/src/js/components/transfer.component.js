import { getState, updateState } from '../core/state.js';
import { showToast } from '../utils/notifier.js';

export function renderTransfer() {
    const state = getState();
    const container = document.createElement('div');
    container.className = 'space-y-6 animate-fade-in max-w-7xl mx-auto';

    container.innerHTML = `
        <!-- Session Controls Header -->
        <div class="bg-navy-900/80 border border-navy-700/60 rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div class="flex items-center gap-4">
                <div class="h-12 w-12 rounded-xl bg-accent-500/10 border border-accent-500/20 flex items-center justify-center text-accent-400">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                </div>
                <div>
                    <h3 class="text-base font-semibold text-white">Peer-to-Peer Session Room</h3>
                    <p class="text-xs text-slate-400 font-mono mt-0.5" id="transfer-room-status">Status: Disconnected • Ready to initialize room</p>
                </div>
            </div>
            <div class="flex items-center gap-3 w-full md:w-auto">
                <button id="btn-create-room" class="flex-1 md:flex-none px-4 py-2.5 bg-accent-600 hover:bg-accent-500 text-white text-xs font-medium rounded-xl shadow-md transition-all">
                    Create Secure Room
                </button>
                <button id="btn-join-room-modal" class="flex-1 md:flex-none px-4 py-2.5 bg-navy-800 hover:bg-navy-700 text-slate-200 text-xs font-medium rounded-xl border border-navy-700 transition-all">
                    Join via Code
                </button>
            </div>
        </div>

        <!-- Main Transfer Workspace -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            <!-- Drag and Drop Dropzone (2 Cols) -->
            <div class="lg:col-span-2 bg-navy-900/80 border border-navy-700/60 rounded-2xl p-6 flex flex-col justify-between">
                <div>
                    <div class="flex items-center justify-between mb-4">
                        <h4 class="text-sm font-semibold text-white">Selected Files & Dropzone</h4>
                        <span id="file-counter" class="text-xs text-slate-400 font-mono">0 files selected</span>
                    </div>

                    <!-- Dropzone Target -->
                    <div id="dropzone" class="border-2 border-dashed border-navy-700 hover:border-accent-500/60 transition-colors rounded-2xl p-8 lg:p-12 text-center bg-navy-950/40 cursor-pointer flex flex-col items-center justify-center">
                        <div class="h-14 w-14 rounded-2xl bg-navy-800/80 border border-navy-700 flex items-center justify-center text-accent-400 mb-4 shadow-inner">
                            <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>
                        </div>
                        <p class="text-sm font-medium text-slate-200">Drag and drop files here, or <span class="text-accent-400 underline underline-offset-2">browse</span></p>
                        <p class="text-xs text-slate-500 mt-1.5 font-mono">Encrypted locally in browser via Web Crypto API before P2P streaming</p>
                        <input type="file" id="file-input" multiple class="hidden">
                    </div>
                </div>

                <!-- Selected Files List Preview -->
                <div class="mt-6">
                    <div class="flex items-center justify-between mb-3">
                        <span class="text-xs font-semibold uppercase tracking-wider text-slate-400">Queue & Status</span>
                        <button id="btn-clear-queue" class="text-xs text-slate-400 hover:text-red-400 transition-colors">Clear Queue</button>
                    </div>
                    <div id="file-queue-list" class="space-y-2 max-h-60 overflow-y-auto pr-1">
                        <div class="text-center py-6 text-xs text-slate-500 border border-navy-800 rounded-xl bg-navy-950/20">
                            No files queued for transfer yet.
                        </div>
                    </div>
                </div>
            </div>

            <!-- Transfer Sidebar / Peer Connection Details -->
            <div class="space-y-6">
                <!-- Peer Info Card -->
                <div class="bg-navy-900/80 border border-navy-700/60 rounded-2xl p-6">
                    <h4 class="text-sm font-semibold text-white mb-4">Peer Connection</h4>
                    <div class="space-y-3 font-mono text-xs">
                        <div class="flex justify-between py-2 border-b border-navy-800">
                            <span class="text-slate-400">Connection State:</span>
                            <span id="peer-state" class="text-amber-400 font-semibold">Not Connected</span>
                        </div>
                        <div class="flex justify-between py-2 border-b border-navy-800">
                            <span class="text-slate-400">DataChannel:</span>
                            <span id="datachannel-state" class="text-slate-400">Standby</span>
                        </div>
                        <div class="flex justify-between py-2 border-b border-navy-800">
                            <span class="text-slate-400">Transport:</span>
                            <span class="text-emerald-400">P2P Direct / STUN</span>
                        </div>
                        <div class="flex justify-between py-2">
                            <span class="text-slate-400">Encryption:</span>
                            <span class="text-accent-400">AES-GCM-256</span>
                        </div>
                    </div>
                    <div class="mt-5">
                        <button id="btn-start-transfer" disabled class="w-full py-2.5 bg-accent-600/50 text-white/50 cursor-not-allowed rounded-xl text-xs font-medium transition-all">
                            Start P2P Transfer
                        </button>
                    </div>
                </div>

                <!-- Security & Notice Card -->
                <div class="bg-navy-900/80 border border-navy-700/60 rounded-2xl p-6">
                    <div class="flex items-center gap-3 mb-3">
                        <div class="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                        </div>
                        <h4 class="text-sm font-semibold text-white">Zero-Server Storage</h4>
                    </div>
                    <p class="text-xs text-slate-400 leading-relaxed">
                        PRIVORA streams files chunk-by-chunk through encrypted WebRTC DataChannels. Files never touch any backend server or database.
                    </p>
                </div>
            </div>

        </div>
    `;

    // Interactivity bindings for transfer component
    const dropzone = container.querySelector('#dropzone');
    const fileInput = container.querySelector('#file-input');
    const fileQueueList = container.querySelector('#file-queue-list');
    let selectedFiles = [];

    dropzone.addEventListener('click', () => fileInput.click());

    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('border-accent-500', 'bg-accent-500/5');
    });

    dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('border-accent-500', 'bg-accent-500/5');
    });

    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('border-accent-500', 'bg-accent-500/5');
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFiles(Array.from(e.dataTransfer.files));
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
            handleFiles(Array.from(e.target.files));
        }
    });

    function handleFiles(files) {
        selectedFiles = [...selectedFiles, ...files];
        renderQueue();
        showToast(`Added ${files.length} file(s) to transfer queue`, 'success');
    }

    function renderQueue() {
        container.querySelector('#file-counter').textContent = `${selectedFiles.length} files selected`;
        if (selectedFiles.length === 0) {
            fileQueueList.innerHTML = `
                <div class="text-center py-6 text-xs text-slate-500 border border-navy-800 rounded-xl bg-navy-950/20">
                    No files queued for transfer yet.
                </div>
            `;
            container.querySelector('#btn-start-transfer').disabled = true;
            container.querySelector('#btn-start-transfer').className = 'w-full py-2.5 bg-accent-600/50 text-white/50 cursor-not-allowed rounded-xl text-xs font-medium transition-all';
            return;
        }

        container.querySelector('#btn-start-transfer').disabled = false;
        container.querySelector('#btn-start-transfer').className = 'w-full py-2.5 bg-accent-600 hover:bg-accent-500 text-white rounded-xl text-xs font-medium shadow-md transition-all cursor-pointer';

        fileQueueList.innerHTML = selectedFiles.map((file, idx) => `
            <div class="flex items-center justify-between p-3 bg-navy-950/60 border border-navy-800 rounded-xl">
                <div class="flex items-center gap-3 overflow-hidden">
                    <div class="h-8 w-8 rounded-lg bg-navy-800 flex items-center justify-center text-accent-400 flex-shrink-0 font-mono text-[10px]">FILE</div>
                    <div class="overflow-hidden">
                        <p class="text-xs font-medium text-slate-200 truncate">${file.name}</p>
                        <p class="text-[10px] text-slate-400 font-mono">${(file.size / (1024 * 1024)).toFixed(2)} MB • Ready</p>
                    </div>
                </div>
                <button data-index="${idx}" class="remove-file-btn text-slate-500 hover:text-red-400 p-1">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
            </div>
        `).join('');

        fileQueueList.querySelectorAll('.remove-file-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.currentTarget.dataset.index);
                selectedFiles.splice(idx, 1);
                renderQueue();
            });
        });
    }

    container.querySelector('#btn-clear-queue').addEventListener('click', () => {
        selectedFiles = [];
        renderQueue();
        showToast('Transfer queue cleared', 'info');
    });

    container.querySelector('#btn-create-room').addEventListener('click', () => {
        const roomId = Math.random().toString(36).substring(2, 10).toUpperCase();
        updateState(s => ({ ...s, session: { ...s.session, roomId, isConnected: true, isHost: true } }));
        container.querySelector('#transfer-room-status').textContent = `Status: Room Active • Room ID: ${roomId}`;
        container.querySelector('#peer-state').textContent = 'Waiting for Peer...';
        container.querySelector('#peer-state').className = 'text-accent-400 font-semibold';
        showToast(`Secure room created: ${roomId}`, 'success');
    });

    container.querySelector('#btn-join-room-modal').addEventListener('click', () => {
        const roomCode = prompt('Enter Secure Room Code / ID:');
        if (roomCode) {
            updateState(s => ({ ...s, session: { ...s.session, roomId: roomCode.toUpperCase(), isConnected: true, isHost: false } }));
            container.querySelector('#transfer-room-status').textContent = `Status: Connected to Room • ${roomCode.toUpperCase()}`;
            container.querySelector('#peer-state').textContent = 'Peer Connected (Simulated)';
            container.querySelector('#peer-state').className = 'text-emerald-400 font-semibold';
            container.querySelector('#datachannel-state').textContent = 'Open (Ready)';
            container.querySelector('#datachannel-state').className = 'text-emerald-400';
            showToast(`Successfully joined room ${roomCode.toUpperCase()}`, 'success');
        }
    });

    return container;
}