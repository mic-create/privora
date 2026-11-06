/**
 * PRIVORA Settings State Manager
 * Manages persistent user preferences (appearance, privacy, notifications) via localStorage.
 */

const SETTINGS_KEY = 'privora_user_settings_v1';

const defaultSettings = {
    theme: 'dark',
    soundEnabled: true,
    notificationsEnabled: true,
    showNotificationPreviews: true,
    showOnlineStatus: true,
    typingIndicatorsEnabled: true,
    readReceiptsEnabled: true,
    messageRetention: 'session', // 'session', '1hour', '24hours'
};

export function getUserSettings() {
    try {
        const stored = localStorage.getItem(SETTINGS_KEY);
        if (stored) {
            return { ...defaultSettings, ...JSON.parse(stored) };
        }
    } catch (err) {
        console.error('Failed to load user settings:', err);
    }
    return { ...defaultSettings };
}

export function saveUserSettings(newSettings) {
    try {
        const current = getUserSettings();
        const updated = { ...current, ...newSettings };
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
        return updated;
    } catch (err) {
        console.error('Failed to save user settings:', err);
        return getUserSettings();
    }
}