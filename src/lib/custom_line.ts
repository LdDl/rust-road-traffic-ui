import { fabric } from "fabric"
import { DirectionType } from "./zones";
import { makeValidPoint } from "./utils";

export const TYPE_VIRTUAL_LINE = 'TYPE_VIRTUAL_LINE'

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
        this.type = TYPE_VIRTUAL_LINE
    }
    // https://github.com/fabricjs/fabric.js/issues/6711#issuecomment-739978578
    calcCurrentPoints(): [fabric.Point, fabric.Point] {
        const points = this.calcLinePoints()
        const matrix = this.calcTransformMatrix()
        const maxx = this.canvas?.getWidth()  ?? 10
        const maxy = this.canvas?.getHeight() ?? 10
        const point1 = fabric.util.transformPoint(new fabric.Point(points.x1, points.y1), matrix)
        makeValidPoint(point1, 0, 0, maxx, maxy)
        const point2 = fabric.util.transformPoint(new fabric.Point(points.x2, points.y2), matrix)
        makeValidPoint(point2, 0, 0, maxx, maxy)
        return [point1, point2]
    }
}
