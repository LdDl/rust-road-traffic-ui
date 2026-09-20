import { get } from 'svelte/store';
import { dataStorage, linkedZones, markZonesSaved } from '../store/data_storage';
import { refreshStatus } from '../store/status';
import { askZonesReload } from '../store/zones_sync';
import { saveTOML } from './rest_api_mutations';

/**
 * The one save behind both the toolbar and the header: the zones drawn in this browser
 * go to the running app first, then save_toml writes them together with the settings
 */
export async function saveAll(baseURL: string) {
	await saveTOML(baseURL, linkedZones(get(dataStorage)));
	markZonesSaved();
	refreshStatus();
	// The device has just rebuilt every zone, identifiers included, so what is on
	// screen has to come from it again for the live numbers to match
	askZonesReload();
}
