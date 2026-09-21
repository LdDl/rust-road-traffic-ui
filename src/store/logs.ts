import { writable } from 'svelte/store';

export interface LogsFilter {
	/** Lowest severity to include, empty for every level */
	level: string;
	/** Empty for every scope */
	scope: string;
}

/**
 * Set from elsewhere to open the logs on something specific, for example the
 * problem badge in the header jumping to the scope it came from
 */
export const logsFilter = writable<LogsFilter>({ level: '', scope: '' });
