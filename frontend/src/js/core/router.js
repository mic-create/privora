import { renderDashboard } from '../components/dashboard.component.js';
import { renderTransfer } from '../components/transfer.component.js';
import { renderMessages } from '../components/messages.component.js';
import { renderActivity } from '../components/activity.component.js';
import { renderSettings } from '../components/settings.component.js';
import { renderPrivacy } from '../components/privacy.component.js';

const routes = {
    'dashboard': { title: 'Dashboard', subtitle: 'Overview of your secure sessions and encrypted data streams', render: renderDashboard },
    'transfer': { title: 'File Transfer', subtitle: 'Direct peer-to-peer encrypted file exchange via WebRTC DataChannel', render: renderTransfer },
    'messages': { title: 'Encrypted Messages', subtitle: 'Real-time peer-to-peer ephemeral messaging channel', render: renderMessages },
    'activity': { title: 'Recent Activity', subtitle: 'Session logs and transfer history (stored locally in-memory)', render: renderActivity },
    'settings': { title: 'Settings', subtitle: 'Configure appearance, network nodes, and connection preferences', render: renderSettings },
    'privacy': { title: 'Privacy & Security', subtitle: 'Web Crypto API parameters, zero-knowledge proofs, and keys', render: renderPrivacy }
};

export function initRouter() {
    window.addEventListener('hashchange', handleRoute);
    
    // Mobile sidebar toggle handlers
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebarClose = document.getElementById('sidebar-close');

    sidebarToggle.addEventListener('click', () => {
        sidebar.classList.remove('-translate-x-full');
        sidebarOverlay.classList.remove('hidden');
    });

    const closeSidebar = () => {
        sidebar.classList.add('-translate-x-full');
        sidebarOverlay.classList.add('hidden');
    };

    sidebarClose.addEventListener('click', closeSidebar);
    sidebarOverlay.addEventListener('click', closeSidebar);

    // Initial load
    if (!window.location.hash) {
        window.location.hash = '#dashboard';
    } else {
        handleRoute();
    }
}

function handleRoute() {
    const hash = window.location.hash.replace('#', '') || 'dashboard';
    const route = routes[hash] || routes['dashboard'];

    // Update Header Text
    document.getElementById('page-title').textContent = route.title;
    document.getElementById('page-subtitle').textContent = route.subtitle;

    // Highlight active nav item
    document.querySelectorAll('.nav-item').forEach(el => {
        if (el.dataset.route === hash) {
            el.classList.add('bg-navy-800', 'text-white', 'border', 'border-navy-700/60');
            el.classList.remove('text-slate-400');
            // Update icon color
            const svg = el.querySelector('svg');
            if (svg) svg.classList.remove('text-slate-400');
            if (svg) svg.classList.add('text-accent-400');
        } else {
            el.classList.remove('bg-navy-800', 'text-white', 'border', 'border-navy-700/60');
            el.classList.add('text-slate-400');
            const svg = el.querySelector('svg');
            if (svg) svg.classList.add('text-slate-400');
            if (svg) svg.classList.remove('text-accent-400');
        }
    });

    // Close mobile menu on route change
    document.getElementById('sidebar').classList.add('-translate-x-full');
    document.getElementById('sidebar-overlay').classList.add('hidden');

    // Render View
    const viewContainer = document.getElementById('app-view');
    viewContainer.innerHTML = '';
    const renderedElement = route.render();
    if (renderedElement) {
        viewContainer.appendChild(renderedElement);
    }
}