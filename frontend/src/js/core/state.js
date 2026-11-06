let appState = {
    theme: 'dark',
    session: {
        roomId: null,
        isConnected: false,
        isHost: false,
        peerCount: 0,
        connectionType: 'Direct P2P',
        transportLatency: null
    },
    transfers: [],
    messages: [],
    settings: {
        autoAcceptFiles: false,
        soundNotifications: true,
        stunServers: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'],
        turnServerEnabled: false,
        turnUrl: '',
        turnUsername: '',
        turnCredential: ''
    }
};

let listeners = [];

export function initState() {
    const savedTheme = localStorage.getItem('privora_theme') || 'dark';
    appState.theme = savedTheme;
    if (savedTheme === 'light') {
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
    } else {
        document.documentElement.classList.add('dark');
        document.documentElement.classList.remove('light');
    }
}

export function getState() {
    return appState;
}

export function updateState(updater) {
    if (typeof updater === 'function') {
        appState = updater(appState);
    } else {
        appState = { ...appState, ...updater };
    }
    notifyListeners();
}

// Alias to prevent import/export mismatches across app files
export function setState(updater) {
    updateState(updater);
}

export function subscribe(listener) {
    listeners.push(listener);
    listener(appState);
    return () => {
        listeners = listeners.filter(l => l !== listener);
    };
}

function notifyListeners() {
    for (const listener of listeners) {
        listener(appState);
    }
    window.dispatchEvent(new CustomEvent('privora:statechange', { detail: appState }));
}