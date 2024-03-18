import { writable } from 'svelte/store';
import { fabric } from "fabric"
import type MapboxDraw from '@mapbox/mapbox-gl-draw';
import { EMPTY_POLYGON_RGB } from '../lib/gl_draw_styles.js'

export const dataStorage = writable(new Map())

export function updateDataStorage(key: any, value: any) {
    dataStorage.update(currentHashmap => {
      const updatedHashmap = new Map(currentHashmap);
      updatedHashmap.set(key, value);
      return updatedHashmap;
    });
}

export function deleteFromDataStorage(key: any) {
    dataStorage.update(currentHashmap => {
      const updatedHashmap = new Map(currentHashmap);
      updatedHashmap.delete(key);
      return updatedHashmap;
    });
}

export function clearDataStorage() {
    dataStorage.update(currentHashmap => {
      const updatedHashmap = new Map(currentHashmap);
      updatedHashmap.clear();
      return updatedHashmap;
    });
}


export const deattachCanvasFromSpatial = (storage: Map<any, any>, mdraw: MapboxDraw, zoneID: String): void => {
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