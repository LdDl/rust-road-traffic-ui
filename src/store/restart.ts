import { writable } from 'svelte/store';

/**
 * Bumped by anything that offers a restart, so the dialog can live in one place
 * while the buttons that open it live where they make sense
 */
export const restartRequests = writable(0);

export const askForRestart = () => restartRequests.update((count) => count + 1);
