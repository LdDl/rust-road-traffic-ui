import { writable, type Writable } from 'svelte/store';
import type MapboxDraw from '@mapbox/mapbox-gl-draw';
import { EMPTY_POLYGON_RGB } from '../lib/gl_draw_styles.js'

export interface Zone {
  id: string,
  type?: string,
  properties: {
    road_lane_direction: number,
    road_lane_num: number,
    coordinates: [[number, number], [number, number], [number, number], [number, number]],
    color_rgb: [number, number, number],
    virtual_line?: {
      geometry: [[number, number], [number, number]],
      color_rgb: [number, number, number],
      direction: string
    },
    spatial_object_id?: string | null,
    canvas_object_id?: string | null,
    color_rgb_str?: string,
  },
  geometry: {
    type: string,
    coordinates: [[[number, number], [number, number], [number, number], [number, number], [number, number]]]
  }
}

export const dataStorage: Writable<Map<string, Zone>> = writable(new Map<string, Zone>())

export function updateDataStorage(key: string, value: Zone) {
    dataStorage.update(currentHashmap => {
      const updatedHashmap = new Map<string, any>(currentHashmap);
      updatedHashmap.set(key, value);
      return updatedHashmap;
    });
}

export function deleteFromDataStorage(key: string) {
    dataStorage.update(currentHashmap => {
      const updatedHashmap = new Map<string, Zone>(currentHashmap);
      updatedHashmap.delete(key);
      return updatedHashmap;
    });
}

export function clearDataStorage() {
    dataStorage.update(currentHashmap => {
      const updatedHashmap = new Map<string, Zone>(currentHashmap);
      updatedHashmap.clear();
      return updatedHashmap;
    });
}


export const deattachCanvasFromSpatial = (storage: Map<string, any>, mdraw: MapboxDraw, zoneID: string): void => {
  const zone = storage.get(zoneID)
  if (!zone) {
    return
  }
  const drawFeature = mdraw.get(zone.properties.spatial_object_id);
  if (!drawFeature) {
    return
  }
  // @ts-ignore
  drawFeature.properties.canvas_object_id = null;
  // @ts-ignore
  drawFeature.properties.road_lane_direction = -1;
  // @ts-ignore
  drawFeature.properties.road_lane_num = -1;
  // @ts-ignore
  drawFeature.properties.coordinates = [[], [], [], [], []];
  // @ts-ignore
  drawFeature.properties.color_rgb = [127, 127, 127];
  // @ts-ignore
  drawFeature.properties.color_rgb_str = EMPTY_POLYGON_RGB;
  // @ts-ignore
  drawFeature.properties.virtual_line = null;
  mdraw.add(drawFeature);
  // @ts-ignore
  mdraw.setFeatureProperty(drawFeature.id, 'color_rgb_str', EMPTY_POLYGON_RGB);

  zone.properties.spatial_object_id = null;
  zone.properties.road_lane_direction = -1;
  zone.properties.road_lane_num = -1;
  zone.geometry.coordinates = [[], [], [], [], []]
  updateDataStorage(zoneID, zone)
}