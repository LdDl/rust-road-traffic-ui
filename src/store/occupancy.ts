import { get, writable } from 'svelte/store';
import { getOccupancy } from '$lib/api/client';
import { createPoller } from '$lib/polling';
import type { ZoneRealtime } from '$lib/api/types';
import { changeAPI } from './state';

/** Occupancy is a "right now" number, so it is read often enough to deserve the name */
const OCCUPANCY_INTERVAL_MS = 1500;

/** By zone id, the same one the zone list and the map use */
export const occupancy = writable<Map<string, ZoneRealtime>>(new Map());

const poller = createPoller({
	intervalMs: OCCUPANCY_INTERVAL_MS,
	run: async (signal) => {
		const answer = await getOccupancy(get(changeAPI), signal);
		occupancy.set(new Map(answer.data.map((zone) => [zone.id, zone])));
	}
});

/** Whether the device is answering, so stale numbers can be shown as stale */
export const occupancyState = { subscribe: poller.subscribe };

changeAPI.subscribe(() => {
	occupancy.set(new Map());
	poller.reset();
});

let consumers = 0;

/** Polls while at least one view is showing the numbers. Returns the release function */
export function acquireOccupancy(): () => void {
	consumers += 1;
	if (consumers === 1) poller.start();
	let released = false;
	return () => {
		if (released) return;
		released = true;
		consumers -= 1;
		if (consumers === 0) poller.stop();
	};
}
