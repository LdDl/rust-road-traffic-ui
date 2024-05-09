export enum DirectionType {
    LeftRightTopBottom = 'lrtb',
    RightLeftBottomTop = 'rlbt'
}

const DIRECTION_TYPE_TEXT = new Map([
    [DirectionType.LeftRightTopBottom, '→↓'],
    [DirectionType.RightLeftBottomTop, '←↑'],
])

const DIRECTION_TYPE_HUMAN_TEXT = new Map([
    [DirectionType.LeftRightTopBottom, 'Left->Right or Top->Bottom'],
    [DirectionType.RightLeftBottomTop, 'Right->Left or Bottom->Top'],
])

const TEXT_DIRECTION_TYPE = new Map([
    ['→↓', DirectionType.LeftRightTopBottom],
    ['←↑', DirectionType.RightLeftBottomTop],
])

export namespace DirectionType {
    export function toString(dirType: DirectionType): string {
        return DIRECTION_TYPE_TEXT.get(dirType) ?? 'err';
    }
    export function toHumanString(dirType: DirectionType): string {
        return DIRECTION_TYPE_HUMAN_TEXT.get(dirType) ?? 'err';
    }
    export function parse(dirStr: string): DirectionType | undefined {
        return TEXT_DIRECTION_TYPE.get(dirStr);
    }
}

export interface Zone {
    type?: string,
    id: string,
    properties: {
      road_lane_direction: number,
      road_lane_num: number,
      coordinates: [[number, number], [number, number], [number, number], [number, number]],
      color_rgb: [number, number, number],
      virtual_line?: VirtualLineProps,
      ds_id?: string,
      spatial_object_id?: string,
      color_rgb_str?: string,
    },
    geometry: PolygonGeoJSON
}

export interface VirtualLineProps {
    geometry: [[number, number], [number, number]],
    color_rgb: [number, number, number],
    direction: DirectionType
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
        color_rgb: [number, number, number],
        virtual_line?: VirtualLineProps
    },
    geometry: PolygonGeoJSON
}

export interface ZonesCollection {
    type: string,
    features: ZoneFeature[]
}