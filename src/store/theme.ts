import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export type Theme = 'light' | 'dark';

// Get initial theme from localStorage or system preference
function getInitialTheme(): Theme {
    if (!browser) return 'light';
    
    const stored = localStorage.getItem('theme') as Theme;
    if (stored && ['light', 'dark'].includes(stored)) {
        return stored;
    }
    
    // Check system preference
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export const theme = writable<Theme>(getInitialTheme());

// Subscribe to theme changes and update localStorage + document class
theme.subscribe((value) => {
    if (browser) {
        localStorage.setItem('theme', value);
        document.documentElement.className = value;
    }
});

export const toggleTheme = () => {
    theme.update(t => t === 'light' ? 'dark' : 'light');
};