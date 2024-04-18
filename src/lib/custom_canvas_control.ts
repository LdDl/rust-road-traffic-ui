import { fabric } from "fabric"
import { CustomPolygon, type FabricCanvasWrap } from "./custom_canvas";
import { interpolatePoint, makeValidPoint, perpendicularToVectorByMidpoint, rgba2array, scalePoint } from "./utils";
import { CustomLineGroup, prepareVirtualLine } from "./custom_line";
import { DirectionType } from "./zones";

// http://fabricjs.com/custom-control-render

export enum CUSTOM_CONTROL_TYPES {
    LINE_CONTROL = 'lineControl',
    CHANGE_DIRECTION_CONTROL = 'changeDirectionControl'
}

const cornerSize = 32
const lineIcon = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1.2rem' height='1.2rem' viewBox='0 0 24 24'%3E %3Crect width='100%25' height='100%25' stroke='rgba(0, 0, 0, 1)' stroke-width='2px' fill='rgba(255, 255, 255, 0.3)' %2F%3E %3Cpath fill='red' stroke='%234b4b4b' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M4 18a2 2 0 1 0 4 0a2 2 0 1 0-4 0M16 6a2 2 0 1 0 4 0a2 2 0 1 0-4 0M7.5 16.5l9-9'/%3E%3C/svg%3E";
const lineImageElem = document.createElement('img');
lineImageElem.src = lineIcon;

const lineControlHandler = (eventData: MouseEvent, transformData: fabric.Transform, x: number, y: number): boolean => {
    const targetContour = transformData.target
    if (!targetContour) {
        console.error('Empty target contour on control click. Transform data:', transformData)
        return false
    }
    if (!(targetContour instanceof CustomPolygon)) {
        console.error('Unhandled type. Only CustomPolygon on top of fabric.Object has been implemented. Event: control click. Transform data:', transformData)
        return false
    }
    if (targetContour.virtual_line) {
        console.warn("Target contour already has virtual line. Ignoring. Transform data:", transformData)
        return false
    }
    const targetExtendedCanvas: FabricCanvasWrap | undefined = targetContour.canvas as FabricCanvasWrap | undefined
    if (!targetExtendedCanvas) {
        console.error('Empty target canvas on control click. transform Data:', transformData)
        return false
    }
    const abcdPoints = targetContour.current_points?.slice() // Copy data
    if (!abcdPoints) {
        console.error('Empty target canvas points on control click. transform Data:', transformData)
        return false
    }
    if (abcdPoints.length !== 4) {
        console.error('Target canvas points should have 4 points exactly on control click. transform Data:', transformData)
        return false
    }
    const Apoint = abcdPoints[0]
    const Bpoint = abcdPoints[1]
    const Cpoint = abcdPoints[2]
    const Dpoint = abcdPoints[3]
    const dist = 30
    const maxx = targetExtendedCanvas.getWidth() - 10
    const maxy = targetExtendedCanvas.getHeight() - 10
    const L1 = interpolatePoint(Dpoint, Apoint, dist);
    makeValidPoint(L1, 0, 0, maxx, maxy)
    const L2 = interpolatePoint(Cpoint, Bpoint, dist);
    makeValidPoint(L2, 0, 0, maxx, maxy)

    prepareVirtualLine(targetContour, false, {
        geometry: [[L1.x, L1.y], [L2.x, L2.y]],
        color_rgb: rgba2array(targetContour.stroke),
        direction: DirectionType.LeftRightTopBottom
    })

    // @todo
    console.warn("Need to implement 'lineControlHandler'. Checkup health of saving virtual line to rest api")
    return true
}

const lineRenderControlHandler = (ctx: CanvasRenderingContext2D, left: number, top: number, styleOverride: any, fabricObject: fabric.Object): void => {
    if (!(fabricObject instanceof CustomPolygon)) {
        // Render this control for this type of object only
        // It still "transparent" and clickable, but error will be occured during click
        return
    }
    ctx.save()
    ctx.translate(left, top)
    if (fabricObject.angle) {
        ctx.rotate(fabric.util.degreesToRadians(fabricObject.angle))
    }
    ctx.drawImage(lineImageElem, -cornerSize/2, -cornerSize/2, cornerSize, cornerSize);
    ctx.restore()
}

export const lineControl = new fabric.Control({
    x: 0.5,
    y: -0.5,
    offsetY: -16,
    offsetX: 16,
    cursorStyle: 'pointer',
    mouseUpHandler: lineControlHandler,
    render: lineRenderControlHandler,
    sizeX: cornerSize,
    sizeY: cornerSize
})


const changeDirectionIcon = "data:image/svg+xml,%3Csvg width='1.2rem' height='1.2rem' viewBox='0 0 1474.3327 1935.947' fill='red' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='100%25' height='100%25' stroke='rgba(0, 0, 0, 1)' stroke-width='5' fill='rgba(255, 255, 255, 0.3)' /%3E%3Cpath d='M513.166 1863.974h-192q-13 0-22.5-9.5t-9.5-22.5v-1376h-192q-13 0-22.5-9.5t-9.5-22.5q0-12 10-24l320-319q9-9 22-9 14 0 23 9l320 320q9 9 9 23 0 13-9.5 22.5t-22.5 9.5h-192v1376q0 13-9.5 22.5t-22.5 9.5m544 0q-14 0-23-9l-320-320q-9-9-9-23 0-13 9.5-22.5t22.5-9.5h192v-1376q0-13 9.5-22.5t22.5-9.5h192q13 0 22.5 9.5t9.5 22.5v1376h192q14 0 23 9t9 23q0 12-10 24l-319 319q-9 9-23 9' style='opacity:1;fill:red;stroke:%23000;stroke-width:42;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1'/%3E%3C/svg%3E"
const changeDirectionElem = document.createElement('img');
changeDirectionElem.src = changeDirectionIcon;

const changeDirectionControlHandler = (eventData: MouseEvent, transformData: fabric.Transform, x: number, y: number): boolean => {
    const targetObject = transformData.target
    if (!targetObject) {
        console.error('Empty target. Event: change_direction_control. Transform data:', transformData)
        return false
    }
    if (!(targetObject instanceof CustomLineGroup)) {
        console.error('Unhandled type. Only CustomLineGroup on top of fabric.Group has been implemented. Event: change_direction_control. Transform data:', transformData)
        return false
    }
    if (!targetObject.segment) {
        console.error('No segment. Event: change_direction_control. Transform data:', transformData)
        return false
    }
    targetObject.segment.direction = targetObject.segment.direction === DirectionType.LeftRightTopBottom ? DirectionType.RightLeftBottomTop : DirectionType.LeftRightTopBottom

    // @todo
    console.warn("Need to implement 'changeDirectionControlHandler'. Call update storage / change text")
    return true
}

const changeDirectionRenderControlHandler = (ctx: CanvasRenderingContext2D, left: number, top: number, styleOverride: any, fabricObject: fabric.Object): void => {
    if (!(fabricObject instanceof fabric.Group)) {
        // Render this control for this type of object only
        // It still "transparent" and clickable, but error will be occured during click
        // @todo: probably should wrap fabric.Group with custom grouping
        return
    }
    ctx.save()
    ctx.translate(left, top)
    if (fabricObject.angle) {
        ctx.rotate(fabric.util.degreesToRadians(fabricObject.angle))
    }
    ctx.drawImage(changeDirectionElem, -cornerSize/2, -cornerSize/2, cornerSize, cornerSize);
    ctx.restore()
}

export const changeDirectionControl = new fabric.Control({
    x: 0.5,
    y: -0.5,
    offsetY: -16,
    offsetX: 16,
    cursorStyle: 'pointer',
    mouseUpHandler: changeDirectionControlHandler,
    render: changeDirectionRenderControlHandler,
    sizeX: cornerSize,
    sizeY: cornerSize
})
