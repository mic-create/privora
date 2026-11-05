export function renderActivity() {
    const container = document.createElement('div');
    container.className = 'space-y-6 animate-fade-in max-w-7xl mx-auto';

    container.innerHTML = `
        <div class="bg-navy-900/80 border border-navy-700/60 rounded-2xl p-6">
            <div class="flex items-center justify-between mb-6">
                <div>
                    <h3 class="text-base font-semibold text-white">Recent Activity Log</h3>
                    <p class="text-xs text-slate-400 mt-0.5">Session events, connection handshakes, and transfer logs (ephemeral)</p>
                </div>
                <button class="px-3 py-1.5 bg-navy-800 hover:bg-navy-700 text-slate-300 text-xs font-medium rounded-xl border border-navy-700 transition-all">
                    Clear Logs
                </button>
            </div>

            <div class="space-y-3 font-mono text-xs">
                <div class="flex items-center justify-between p-3.5 bg-navy-950/60 border border-navy-800 rounded-xl">
                    <div class="flex items-center gap-3">
                        <span class="h-2 w-2 rounded-full bg-emerald-500"></span>
                        <span class="text-slate-200">Frontend Foundation Initialized</span>
                    </div>
                    <span class="text-slate-500">Just now</span>
                </div>
                <div class="flex items-center justify-between p-3.5 bg-navy-950/60 border border-navy-800 rounded-xl">
                    <div class="flex items-center gap-3">
                        <span class="h-2 w-2 rounded-full bg-accent-400"></span>
                        <span class="text-slate-200">Web Crypto API Context Ready (AES-GCM-256)</span>
                    </div>
                    <span class="text-slate-500">2 mins ago</span>
                </div>
                <div class="flex items-center justify-between p-3.5 bg-navy-950/60 border border-navy-800 rounded-xl">
                    <div class="flex items-center gap-3">
                        <span class="h-2 w-2 rounded-full bg-blue-400"></span>
                        <span class="text-slate-200">STUN Server Handshake Configured</span>
                    </div>
                    <span class="text-slate-500">5 mins ago</span>
                </div>
            </div>
        </div>
    `;

    return container;
}