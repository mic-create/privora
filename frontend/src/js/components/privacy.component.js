export function renderPrivacy() {
    const container = document.createElement('div');
    container.className = 'space-y-6 animate-fade-in max-w-4xl mx-auto';

    container.innerHTML = `
        <div class="bg-navy-900/80 border border-navy-700/60 rounded-2xl p-6 lg:p-8 space-y-6">
            <div>
                <h3 class="text-base font-semibold text-white">Privacy & Cryptographic Security</h3>
                <p class="text-xs text-slate-400 mt-0.5">Overview of zero-knowledge parameters and encryption standards</p>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="p-5 bg-navy-950/60 border border-navy-800 rounded-2xl">
                    <div class="h-10 w-10 rounded-xl bg-accent-500/10 border border-accent-500/20 flex items-center justify-center text-accent-400 mb-3">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                    </div>
                    <h4 class="text-sm font-semibold text-white">Web Crypto API</h4>
                    <p class="text-xs text-slate-400 mt-1 leading-relaxed">
                        All file chunks and chat messages are encrypted and decrypted locally using browser-native AES-GCM 256-bit keys. Keys never leave client RAM.
                    </p>
                </div>

                <div class="p-5 bg-navy-950/60 border border-navy-800 rounded-2xl">
                    <div class="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-3">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
                    </div>
                    <h4 class="text-sm font-semibold text-white">Zero Server Retention</h4>
                    <p class="text-xs text-slate-400 mt-1 leading-relaxed">
                        The central Node.js server only facilitates WebSocket signaling and ICE candidate exchange. No logs or payloads are permanently stored.
                    </p>
                </div>
            </div>
        </div>
    `;

    return container;
}