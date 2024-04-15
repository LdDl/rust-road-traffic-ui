import { fabric } from "fabric"
import { DirectionType } from "./zones";

export interface LineWrap {
    _inner: fabric.Line,
    calcCurrentPoints(): [fabric.Point, fabric.Point],
    direction: DirectionType,
    current_points: [[number, number], [number, number]],
    color_rgb: [number, number, number]
}

export class CustomLine extends fabric.Line implements LineWrap {
    _inner: fabric.Line
    direction: DirectionType
    current_points: [[number, number], [number, number]]
    color_rgb: [number, number, number]
    constructor(points: number[], options?: fabric.ILineOptions) {
        super(points, options);
        this._inner = this
        this.direction = DirectionType.LeftRightTopBottom
        this.current_points = [[0, 0], [0, 0]]
        this.color_rgb = [0, 0, 0]
    }
    // https://github.com/fabricjs/fabric.js/issues/6711#issuecomment-739978578
    calcCurrentPoints(): [fabric.Point, fabric.Point] {
        const points = this.calcLinePoints()
        const matrix = this.calcTransformMatrix()
        const point1 = fabric.util.transformPoint(new fabric.Point(points.x1, points.y1), matrix)
        if (point1.x < 0) {
            point1.x = 0
        }
        if (point1.y < 0) {
            point1.y = 0
        }
        const point2 = fabric.util.transformPoint(new fabric.Point(points.x2, points.y2), matrix)
        if (point2.x < 0) {
            point2.x = 0
        }
        if (point2.y < 0) {
            point2.y = 0
        }
        return [point1, point2]
    }
}
