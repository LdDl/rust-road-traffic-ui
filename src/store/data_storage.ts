import { writable, type Writable } from 'svelte/store';
import type MapboxDraw from '@mapbox/mapbox-gl-draw';
import { EMPTY_POLYGON_RGB } from '../lib/gl_draw_styles.js'

export interface Zone {
  type?: string,
  id: string,
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
    ds_id?: string,
    spatial_object_id?: string,
    color_rgb_str?: string,
  },
  geometry: PolygonGeoJSON
}

interface PolygonGeoJSON {
    type: string,
    coordinates: number[][][]
}

interface ZoneFeature {
  type: string,
  id: string,
  properties: {
    road_lane_direction: number,
    road_lane_num: number,
    coordinates: [[number, number], [number, number], [number, number], [number, number]],
    color_rgb: [number, number, number]
  },
  geometry: PolygonGeoJSON
}

export interface ZonesCollection {
  type: string,
  features: ZoneFeature[]
}

export const dataStorage: Writable<Map<string, Zone>> = writable(new Map<string, Zone>())

export function addZoneFeature(value: ZoneFeature) {
  dataStorage.update(currentHashmap => {
    const updatedHashmap = new Map<string, Zone>(currentHashmap);
    const newZone: Zone = {
      type: value.type,
      id: value.id,
      properties: {
        road_lane_direction: value.properties.road_lane_direction,
        road_lane_num: value.properties.road_lane_num,
        coordinates: value.properties.coordinates,
        color_rgb: value.properties.color_rgb,
        ds_id: value.id,
        spatial_object_id: `spatial-${value.id}`,
        color_rgb_str: `rgb(${value.properties.color_rgb[0]},${value.properties.color_rgb[1]},${value.properties.color_rgb[2]})`
      },
      geometry: {
        type: value.geometry.type,
        coordinates: value.geometry.coordinates
      }
    }
    updatedHashmap.set(value.id, newZone);
    return updatedHashmap;
  });
}

export function updateDataStorage(key: string, value: Zone) {
    dataStorage.update(currentHashmap => {
      const updatedHashmap = new Map<string, Zone>(currentHashmap);
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

export const deattachCanvasFromSpatial = (storage: Map<string, Zone>, mdraw: MapboxDraw, zoneID: string): void => {
  const zone = storage.get(zoneID)
  if (!zone) {
    return
  }
  if (!zone.properties.spatial_object_id) {
    console.error(`ID '${zone.id}' should have 'spatial_object_id' in prpetries, but it has not`)
    return
  }
  const drawFeature = mdraw.get(zone.properties.spatial_object_id);
  if (!drawFeature) {
    return
  }
  mdraw.add(drawFeature);
  mdraw.setFeatureProperty(drawFeature.id as string, 'color_rgb_str', EMPTY_POLYGON_RGB);
  zone.properties.spatial_object_id = undefined;
  zone.properties.road_lane_direction = -1;
  zone.properties.road_lane_num = -1;
  zone.geometry.coordinates = [[], [], [], [], []]
  updateDataStorage(zoneID, zone)
}