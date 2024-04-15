export enum DirectionType {
    LeftRightTopBottom = 'lrtb',
    RightLeftBottomTop = 'rlbt'
}

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
        direction: DirectionType
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
  
export interface ZoneFeature {
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