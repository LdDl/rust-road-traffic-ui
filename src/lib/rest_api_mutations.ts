import type { Zone } from './zones';
import { replaceAllZones, saveToml } from './api/client';

/**
 * Sends the zones to the running app, then writes the file. Rejects when either step
 * fails, so the caller can tell a real save from one that never reached the device
 */
export const saveTOML = async (baseURL: string, dataToSave: [string, Zone][]) => {
	const sendData = {
		// Should send only zones with both canvas and spatial object IDs
		data: dataToSave.map((e) => {
			const element = e[1];
			return {
				lane_number: element.properties.road_lane_num,
				lane_direction: element.properties.road_lane_direction,
				color_rgb: element.properties.color_rgb,
				pixel_points: element.properties.coordinates,
				spatial_points: [...element.geometry.coordinates[0].slice(0, -1)],
				virtual_line: element.properties.virtual_line
					? {
							geometry: element.properties.virtual_line.geometry,
							color_rgb: element.properties.virtual_line.color_rgb,
							direction: element.properties.virtual_line.direction
						}
					: null
			};
		})
	};
	await replaceAllZones(baseURL, sendData);
	return saveToml(baseURL);
};
