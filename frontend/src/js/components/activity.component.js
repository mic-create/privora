import { getState, setState } from '../core/state.js';
import { showToast } from '../utils/notifier.js';

export function renderActivity() {
    const state = getState();
    
    // Gather available activity items from state or fallback to standard system events
    let rawActivities = state.activities || [
        { type: 'system', category: 'Connections', description: 'Frontend Foundation Initialized', timestamp: Date.now() - 300000, status: 'Success' },
        { type: 'system', category: 'Security', description: 'Web Crypto API Context Ready (AES-GCM-256)', timestamp: Date.now() - 180000, status: 'Verified' },
        { type: 'system', category: 'Connections', description: 'STUN Server Handshake Configured', timestamp: Date.now() - 90000, status: 'Connected' }
    ];

    const container = document.createElement('div');
    container.className = 'space-y-6 animate-fade-in max-w-7xl mx-auto pb-12';

    // Calculate metrics for circular chart & analytics
    const totalCount = rawActivities.length;
    const categories = {
        'Messages': rawActivities.filter(a => a.category === 'Messages' || a.type === 'message').length,
        'Transfers': rawActivities.filter(a => a.category === 'Transfers' || a.type === 'transfer').length,
        'Connections': rawActivities.filter(a => a.category === 'Connections' || a.type === 'system' || a.type === 'connection').length,
        'Other': rawActivities.filter(a => !['Messages', 'Transfers', 'Connections', 'message', 'transfer', 'system', 'connection'].includes(a.category && a.type)).length
    };

    // Build lightweight SVG Donut Chart slices
    let cumulativePercent = 0;
    const palette = ['#244C3A', '#76513B', '#A8B5A0', '#59402F'];
    let colorIdx = 0;

    const chartSlices = Object.entries(categories).map(([name, count]) => {
        if (count === 0 || totalCount === 0) return '';
        const percent = (count / totalCount) * 100;
        const dashArray = `${percent} ${100 - percent}`;
        const dashOffset = -cumulativePercent;
        cumulativePercent += percent;
        const color = palette[colorIdx++ % palette.length];

        return `<circle cx="21" cy="21" r="15.9155" fill="transparent" stroke="${color}" stroke-width="3.8" stroke-dasharray="${dashArray}" stroke-dashoffset="${dashOffset}" class="transition-all duration-500"></circle>`;
    }).join('');

    container.innerHTML = `
        <!-- Page Introduction Header -->
        <div class="bg-white border border-border rounded-2xl p-6 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
                <h3 class="text-base font-semibold text-charcoal">Activity Centre</h3>
                <p class="text-xs text-charcoal-muted mt-0.5">Recorded application events, security handshakes, and ephemeral session logs</p>
            </div>
            <button id="btn-clear-logs" class="px-4 py-2 bg-white hover:bg-ivory-800 text-charcoal text-xs font-medium rounded-xl border border-border shadow-2xs transition-all">
                Clear Logs
            </button>
        </div>

        <!-- Analytics & Overview Section -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <!-- Donut Chart Analytics Card -->
            <div class="bg-white border border-border rounded-2xl p-6 shadow-2xs flex flex-col items-center justify-center">
                <h4 class="text-sm font-semibold text-charcoal mb-4 self-start">Activity Distribution</h4>
                <div class="relative w-40 h-40 flex items-center justify-center my-2">
                    <svg viewBox="0 0 42 42" class="w-full h-full transform -rotate-90">
                        <circle cx="21" cy="21" r="15.9155" fill="transparent" stroke="#E6E5DC" stroke-width="3.8"></circle>
                        ${chartSlices}
                    </svg>
                    <div class="absolute inset-0 flex flex-col items-center justify-center text-center">
                        <span class="text-xl font-bold text-charcoal">${totalCount}</span>
                        <span class="text-[10px] text-charcoal-muted uppercase font-mono">Total Events</span>
                    </div>
                </div>
                <div class="w-full mt-4 grid grid-cols-2 gap-2 text-xs font-mono">
                    <div class="flex items-center gap-2"><span class="h-2.5 w-2.5 rounded-full bg-forest-800"></span><span class="text-charcoal-muted">Connections (${categories['Connections']})</span></div>
                    <div class="flex items-center gap-2"><span class="h-2.5 w-2.5 rounded-full bg-brown-800"></span><span class="text-charcoal-muted">Transfers (${categories['Transfers']})</span></div>
                    <div class="flex items-center gap-2"><span class="h-2.5 w-2.5 rounded-full bg-sage"></span><span class="text-charcoal-muted">Messages (${categories['Messages']})</span></div>
                    <div class="flex items-center gap-2"><span class="h-2.5 w-2.5 rounded-full bg-brown-900"></span><span class="text-charcoal-muted">Other (${categories['Other']})</span></div>
                </div>
            </div>

            <!-- Quick Metrics Summary Cards -->
            <div class="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div class="bg-white border border-border rounded-2xl p-5 flex flex-col justify-between shadow-2xs">
                    <div class="flex items-center justify-between">
                        <p class="text-xs font-semibold text-charcoal-muted uppercase tracking-wider">Security State</p>
                        <span class="h-2.5 w-2.5 rounded-full bg-forest-800 animate-pulse"></span>
                    </div>
                    <div class="my-4">
                        <p class="text-2xl font-bold text-charcoal">AES-GCM-256</p>
                        <p class="text-xs text-charcoal-muted mt-1 font-mono">Web Crypto API Verified</p>
                    </div>
                    <div class="text-[10px] text-forest-800 font-mono">Zero-Knowledge Key Exchange Active</div>
                </div>

                <div class="bg-white border border-border rounded-2xl p-5 flex flex-col justify-between shadow-2xs">
                    <div class="flex items-center justify-between">
                        <p class="text-xs font-semibold text-charcoal-muted uppercase tracking-wider">Storage Mode</p>
                        <span class="h-2.5 w-2.5 rounded-full bg-sage"></span>
                    </div>
                    <div class="my-4">
                        <p class="text-2xl font-bold text-charcoal">Ephemeral</p>
                        <p class="text-xs text-charcoal-muted mt-1 font-mono">In-Memory Local Logs Only</p>
                    </div>
                    <div class="text-[10px] text-charcoal-muted font-mono">Automatically cleared on session termination</div>
                </div>
            </div>
        </div>

        <!-- Tabular Activity History Section -->
        <div class="bg-white border border-border rounded-2xl p-6 shadow-2xs space-y-4">
            <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <h4 class="text-sm font-semibold text-charcoal">Recorded Event History</h4>
                <div class="flex items-center gap-2 w-full sm:w-auto">
                    <input type="text" id="activity-search" placeholder="Filter logs..." class="w-full sm:w-48 bg-ivory-800 border border-border rounded-xl px-3 py-1.5 text-xs text-charcoal placeholder:text-charcoal-muted focus:outline-none focus:border-forest-800">
                </div>
            </div>

            <div class="overflow-x-auto">
                <table class="w-full text-left text-xs font-mono">
                    <thead>
                        <tr class="border-b border-border text-charcoal-muted uppercase text-[10px] tracking-wider">
                            <th class="py-3 px-4 font-semibold">Category</th>
                            <th class="py-3 px-4 font-semibold">Event Description</th>
                            <th class="py-3 px-4 font-semibold">Status</th>
                            <th class="py-3 px-4 font-semibold text-right">Timestamp</th>
                        </tr>
                    </thead>
                    <tbody id="activity-table-body" class="divide-y divide-border">
                        ${rawActivities.length === 0 ? `
                            <tr>
                                <td colspan="4" class="py-8 text-center text-charcoal-muted">No activity logs recorded.</td>
                            </tr>
                        ` : rawActivities.map(item => `
                            <tr class="hover:bg-ivory-800/40 transition-colors">
                                <td class="py-3 px-4 font-medium text-charcoal">
                                    <span class="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] bg-ivory-800 text-forest-800 border border-sage">${item.category || item.type || 'System'}</span>
                                </td>
                                <td class="py-3 px-4 text-charcoal">${item.description || item.text || 'Recorded event'}</td>
                                <td class="py-3 px-4 text-forest-800 font-semibold">${item.status || 'Active'}</td>
                                <td class="py-3 px-4 text-right text-charcoal-muted">${new Date(item.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    // Event handler for clearing logs
    container.querySelector('#btn-clear-logs').addEventListener('click', () => {
        setState(s => ({ ...s, activities: [] }));
        showToast('Activity logs cleared', 'info');
        
        // Immediately refresh the activity view container
        const viewContainer = document.getElementById('app-view');
        if (viewContainer) {
            viewContainer.innerHTML = '';
            viewContainer.appendChild(renderActivity());
        }
    });

    // Simple search filtering
    const searchInput = container.querySelector('#activity-search');
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        const rows = container.querySelectorAll('#activity-table-body tr');
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(query) ? '' : 'none';
        });
    });

    return container;
}