import { get, writable } from 'svelte/store';
import { getStatus } from '$lib/api/client';
import { createPoller } from '$lib/polling';
import type { StatusResponse } from '$lib/api/types';
import { changeAPI } from './state';

/** Often enough for the header to feel live, cheap enough to leave running all day */
const STATUS_INTERVAL_MS = 2000;

/** Last answer from /api/status, kept while the backend is unreachable so the view can grey it out instead of blanking */
export const status = writable<StatusResponse | null>(null);

/**
 * Counts restarts seen while the page was open. Everything runtime is gone after
 * one, so accumulated series elsewhere break on a change of this number
 */
export const restartEpoch = writable(0);
export const lastRestartAt = writable<number | null>(null);

/** Frames dropped between the two most recent answers. Above zero means the detector is falling behind right now */
export const droppedDelta = writable(0);

let previous: StatusResponse | null = null;

function applyStatus(current: StatusResponse) {
	if (previous) {
		// Uptime only ever grows within one run, so a smaller value is a fresh process.
		// The version check catches an upgrade that restarted quickly enough to look continuous
		const restarted =
			current.uptime_seconds < previous.uptime_seconds || current.version !== previous.version;
		if (restarted) {
			restartEpoch.update((value) => value + 1);
			lastRestartAt.set(Date.now());
			droppedDelta.set(0);
		} else {
			droppedDelta.set(Math.max(0, current.input.frames_dropped - previous.input.frames_dropped));
		}
	}
	previous = current;
	status.set(current);
}

const poller = createPoller({
	intervalMs: STATUS_INTERVAL_MS,
	run: async (signal) => {
		applyStatus(await getStatus(get(changeAPI), signal));
	}
});

/** Whether the backend answers, and why it does not */
export const connection = { subscribe: poller.subscribe };

changeAPI.subscribe(() => {
	// The new address is a different installation as far as the header is concerned
	previous = null;
	droppedDelta.set(0);
	status.set(null);
	poller.reset();
});

let consumers = 0;

/** Starts polling for as long as at least one view needs it. Returns the release function */
export function acquireStatus(): () => void {
	consumers += 1;
	if (consumers === 1) {
		poller.start();
	}
	let released = false;
	return () => {
		if (released) return;
		released = true;
		consumers -= 1;
		if (consumers === 0) {
			poller.stop();
		}
	};
}

export const refreshStatus = () => poller.refresh();
