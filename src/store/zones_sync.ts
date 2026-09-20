import { writable } from 'svelte/store';

/**
 * Bumped when the zones on screen have to be read from the device again.
 *
 * Saving is one such moment: replace_all builds every zone anew, and a zone made
 * that way gets a random identifier while one read from the configuration file gets
 * "dir_<direction>_lane_<number>". Live numbers are matched to zones by that
 * identifier, so without rereading they would quietly stop matching after a save.
 */
export const zonesReloadRequests = writable(0);

export const askZonesReload = () => zonesReloadRequests.update((count) => count + 1);
