import { browser } from '$app/environment';
import { writable } from 'svelte/store';

export type TabId = 'setup' | 'device';

export interface TabDefinition {
	id: TabId;
	label: string;
	icon: string;
	/** Shown on hover and in the section header, for someone opening this the first time */
	description: string;
}

export const TABS: TabDefinition[] = [
	{
		id: 'setup',
		label: 'Setup',
		icon: 'polyline',
		description: 'Draw each zone on the camera frame and on the map, then link the two'
	},
	{
		id: 'device',
		label: 'Device',
		icon: 'settings_input_component',
		description: 'Video source, tracking, Redis, logging and the other settings of the device'
	}
];

const DEFAULT_TAB: TabId = 'setup';

function fromHash(): TabId {
	if (!browser) return DEFAULT_TAB;
	const id = window.location.hash.replace(/^#\/?/, '');
	return TABS.some((tab) => tab.id === id) ? (id as TabId) : DEFAULT_TAB;
}

export const activeTab = writable<TabId>(fromHash());

if (browser) {
	// The hash is the source of truth, so reload and the back button both land right.
	// A real route would 404 on reload: the backend serves the build by exact path
	window.addEventListener('hashchange', () => activeTab.set(fromHash()));
}

export function goToTab(id: TabId) {
	if (browser) {
		window.location.hash = `#/${id}`;
	}
	activeTab.set(id);
}

/** Unfinished work shown on a tab's icon, so it is visible from any other tab and on a phone */
export const tabBadges = writable<Partial<Record<TabId, number>>>({});
