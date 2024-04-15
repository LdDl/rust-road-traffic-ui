import { fabric } from "fabric"
import { DirectionType, type VirtualLineProps } from "./zones";
import { makeValidPoint, perpendicularToVectorByMidpoint, rgba2array, scalePoint } from "./utils";
import type { ContourWrap, CustomPolygon, FabricCanvasWrap } from "./custom_canvas";

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

export function prepareVirtualLine(targetContour: CustomPolygon, props: VirtualLineProps) {
    const targetExtendedCanvas: FabricCanvasWrap | undefined = targetContour.canvas as FabricCanvasWrap | undefined
    if (!targetExtendedCanvas) {
        console.error('Empty target canvas for preparing virtual line')
        return false
    }
    const L1 = new fabric.Point(props.geometry[0][0], props.geometry[0][1])
    const L2 = new fabric.Point(props.geometry[1][0], props.geometry[1][1])
    const shadow = new fabric.Shadow({  
        color: 'rgba(0, 0, 0, 1)',  
        affectStroke: true,
        blur: 30
    });  
    const L1Scaled = new fabric.Point(Math.floor(L1.x*targetExtendedCanvas.scaleWidth), Math.floor(L1.y*targetExtendedCanvas.scaleHeight))
    const L2Scaled = new fabric.Point(Math.floor(L2.x*targetExtendedCanvas.scaleWidth), Math.floor(L2.y*targetExtendedCanvas.scaleHeight))
    const segment = new CustomLine([L1Scaled.x, L1Scaled.y, L2Scaled.x, L2Scaled.y], {
        stroke: targetContour.stroke,
        strokeWidth: 5,
        strokeDashArray: [5],
        // http://fabricjs.com/stroke-uniform
        strokeUniform: true,
        objectCaching: false, // For real-time rendering updates
        shadow: shadow
    })
    segment.current_points = [[L1.x, L1.y], [L2.x, L2.y]]
    segment.color_rgb = rgba2array(segment.stroke)
    segment.direction = DirectionType.LeftRightTopBottom

    /* Arrow part */
    /* Do we need full Arrow class implementation in future? */
    const dist = 30
    const perpendicularDist = dist + 10
    const [p1, p2] = perpendicularToVectorByMidpoint(L1Scaled, L2Scaled, perpendicularDist)
    const arrow = new fabric.Line([p1.x, p1.y, p2.x, p2.y], {
        stroke: targetContour.stroke,
        strokeWidth: 5,
        strokeDashArray: [5],
        strokeUniform: true,
        objectCaching: false,
        shadow: shadow,
        selectable: false
    })
    /* */

    const virtLineGroup = new fabric.Group([segment, arrow], {
        strokeUniform: true,
        objectCaching: false, // For real-time rendering updates
    })

    virtLineGroup.on('modified', (options: fabric.IEvent<Event>) => {
        const targetGroupObject = options.target
        if (!targetGroupObject) {
            console.error('Empty target group object on line group. Event: modified. Options:', options)
            return
        }
        if (!(targetGroupObject instanceof fabric.Group)) {
            console.error('Unhandled type. Only fabric.Group has been implemented. Event: modified. Options:', options)
            return
        }
        const targetCanvas: FabricCanvasWrap | undefined = targetGroupObject.canvas as FabricCanvasWrap | undefined
        if (!targetCanvas) {
            console.error('Empty target canvas on line group. Event: modified. Options:', options)
            return
        }
        const targetObjects = targetGroupObject.getObjects(TYPE_VIRTUAL_LINE)
        targetObjects.forEach((targetObject) => {
            if (!(targetObject instanceof CustomLine)) {
                console.error('Unhandled type. Only CustomLime on top of fabric.Object has been implemented. Event: modified. Options:', options)
                return
            }
            const targetLine = targetObject as CustomLine
            const currentPoints = targetLine.calcCurrentPoints()
            // calcCurrentPoints grants that points will fit into canvas width/height, but rendered object itself won't have correct representation.
            // @todo: think how to handle it (and for polygons too) and do we even need this since REST API will accept correct values? 
            const L1ModifiedScaled = scalePoint(currentPoints[0], targetCanvas.scaleWidth, targetCanvas.scaleHeight)
            const L2ModifiedScaled = scalePoint(currentPoints[1], targetCanvas.scaleWidth, targetCanvas.scaleHeight)
            targetLine.current_points[0][0] = L1ModifiedScaled.x
            targetLine.current_points[0][1] = L1ModifiedScaled.y
            targetLine.current_points[1][0] = L2ModifiedScaled.x
            targetLine.current_points[1][1] = L2ModifiedScaled.y
            targetContour.fire('virtial_line:modified', { target: targetContour })
        })
    })
    
    virtLineGroup.on('mouseover', function(options: fabric.IEvent<MouseEvent>) {
        const targetGroupObject = options.target
        if (!targetGroupObject) {
            console.error('Empty target group object on line group. Event: mouseover. Options:', options)
            return
        }
        const targetCanvas: FabricCanvasWrap | undefined = targetGroupObject.canvas as FabricCanvasWrap | undefined
        if (!targetCanvas) {
            console.error('Empty target canvas on line group. Event: mouseover. Options:', options)
            return
        }
        if (!(targetGroupObject instanceof fabric.Group)) {
            return
        }
        const targetObjects = targetGroupObject.getObjects()
        targetObjects.forEach((targetObject) => {
            const targetShadowObj = targetObject.shadow?.valueOf()
            const isShadow = targetShadowObj && targetShadowObj instanceof fabric.Shadow
            if (!isShadow) {
                return
            }
            const targetShadow = targetShadowObj as fabric.Shadow
            targetShadow.color = 'rgba(255, 255, 255, 1)'  
            targetShadow.blur = 30

            // Apply some styling to parent contour too
            const parentObject = targetContour
            const parentShadowObj = parentObject.shadow?.valueOf()
            const isParentShadow = parentShadowObj && parentShadowObj instanceof fabric.Shadow
            if (!isParentShadow) {
                return
            }
            const parentShadow = parentShadowObj as fabric.Shadow
            parentShadow.color = 'rgba(255, 255, 255, 1)'  
            parentShadow.blur = 30
        })
        targetCanvas.renderAll()
    })

    virtLineGroup.on('mouseout', function(options: fabric.IEvent<MouseEvent>) {
        const targetGroupObject = options.target
        if (!targetGroupObject) {
            console.error('Empty target object on line group. Event: mouseout. Options:', options)
            return
        }
        const targetCanvas: FabricCanvasWrap | undefined = targetGroupObject.canvas as FabricCanvasWrap | undefined
        if (!targetCanvas) {
            console.error('Empty target canvas on line group. Event: mouseout. Options:', options)
            return
        }
        if (!(targetGroupObject instanceof fabric.Group)) {
            return
        }
        const targetObjects = targetGroupObject.getObjects()
        targetObjects.forEach((targetObject) => {
            const targetShadowObj = targetObject.shadow?.valueOf()
            const isShadow = targetShadowObj && targetShadowObj instanceof fabric.Shadow
            if (!isShadow) {
                return
            }
            const targetShadow = targetShadowObj as fabric.Shadow
            targetShadow.color = 'rgba(0, 0, 0, 1)'  
            targetShadow.blur = 30

            // Reset parent shadow
            const parentObject = targetContour
            const parentShadowObj = parentObject.shadow?.valueOf()
            const isParentShadow = parentShadowObj && parentShadowObj instanceof fabric.Shadow
            if (!isParentShadow) {
                return
            }
            const parentShadow = parentShadowObj as fabric.Shadow
            parentShadow.color = parentObject.stroke
            parentShadow.blur = 0
        })
        targetCanvas.renderAll()
    })

    targetContour.virtual_line = segment
    targetContour.fire('virtial_line:created', { target: targetContour })
    targetExtendedCanvas.add(virtLineGroup)
}