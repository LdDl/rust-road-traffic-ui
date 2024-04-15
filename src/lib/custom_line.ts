import { fabric } from "fabric"
import { DirectionType } from "./zones";

export interface LineWrap {
    direction: DirectionType,
    geometry: [[number, number], [number, number]]
    color_rgb: [number, number, number]
}

export class CustomLine extends fabric.Line implements LineWrap {
    direction: DirectionType
    geometry: [[number, number], [number, number]]
    color_rgb: [number, number, number]
    constructor(points: number[], options?: fabric.ILineOptions) {
        super(points, options);
        this.direction = DirectionType.LeftRightTopBottom
        this.geometry = [[0, 0], [0, 0]]
        this.color_rgb = [0, 0, 0]
    }
}
