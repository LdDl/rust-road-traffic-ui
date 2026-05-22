import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';

export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

function getSystemTheme(): ResolvedTheme {
    if (!browser) return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getInitialPreference(): ThemePreference {
    if (!browser) return 'system';
    const stored = localStorage.getItem('theme');
    if (stored && ['system', 'light', 'dark'].includes(stored)) {
        return stored as ThemePreference;
    }
    return 'system';
}

// The user's preference (system / light / dark)
export const theme = writable<ThemePreference>(getInitialPreference());

// Live system theme, updated on OS preference change
const systemTheme = writable<ResolvedTheme>(getSystemTheme());

if (browser) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', (e) => {
        systemTheme.set(e.matches ? 'dark' : 'light');
    });
}

// Resolved theme: what actually gets applied to the document
export const resolvedTheme = derived(
    [theme, systemTheme],
    ([$theme, $systemTheme]) => {
        if ($theme === 'system') return $systemTheme;
        return $theme;
    }
);

// Apply to DOM and persist
theme.subscribe((value) => {
    if (browser) {
        localStorage.setItem('theme', value);
    }
});

resolvedTheme.subscribe((value) => {
    if (browser) {
        document.documentElement.className = value;
    }
});
