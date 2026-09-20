import { get, writable } from 'svelte/store';
import { getConfig, getStats } from '$lib/api/client';
import { createPoller } from '$lib/polling';
import type { AllZonesStats } from '$lib/api/types';
import { changeAPI } from './state';

/** What the device uses when nothing else is known, until /api/config says otherwise */
const DEFAULT_WINDOW_MS = 30000;
/** Polling at a third of the window is what keeps a window from being missed */
const WINDOW_SHARE = 3;
const MIN_INTERVAL_MS = 1000;

/** The last completed window, as the device reported it. Null until the first answer */
export const stats = writable<AllZonesStats | null>(null);

/** How long a window is on this device, so the interface can say it out loud */
export const statsWindowMs = writable(DEFAULT_WINDOW_MS);

const poller = createPoller({
	intervalMs: Math.round(DEFAULT_WINDOW_MS / WINDOW_SHARE),
	run: async (signal) => {
		stats.set(await getStats(get(changeAPI), signal));
	}
});

export const statsState = { subscribe: poller.subscribe };

async function readWindowLength() {
	try {
		const config = await getConfig(get(changeAPI));
		const length = config.worker?.reset_data_milliseconds;
		if (!length || length <= 0) return;
		statsWindowMs.set(length);
		poller.setIntervalMs(Math.max(MIN_INTERVAL_MS, Math.round(length / WINDOW_SHARE)));
	} catch {
		// The default cadence is close enough; the numbers themselves are what matters here
	}
}

changeAPI.subscribe(() => {
	stats.set(null);
	statsWindowMs.set(DEFAULT_WINDOW_MS);
	poller.reset();
});

let consumers = 0;

/** Polls while the analytics view is on screen. Returns the release function */
export function acquireStats(): () => void {
	consumers += 1;
	if (consumers === 1) {
		poller.start();
		// The window length can have been changed on the Device tab since the last look
		readWindowLength();
	}
	let released = false;
	return () => {
		if (released) return;
		released = true;
		consumers -= 1;
		if (consumers === 0) poller.stop();
	};
}

/** Reads the window again at once, for the refresh button */
export const refreshStats = () => poller.refresh();

/** After a restart the counters start from nothing, so what is on screen is no longer true */
export function forgetStats() {
	stats.set(null);
	poller.refresh();
}
