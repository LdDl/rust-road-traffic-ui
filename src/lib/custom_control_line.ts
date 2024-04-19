import { fabric } from "fabric"
import { CustomLineGroup } from "./custom_line";
import { DirectionType } from "./zones";

// http://fabricjs.com/custom-control-render
const cornerSize = 32
const changeDirectionIcon = "data:image/svg+xml,%3Csvg width='1.2rem' height='1.2rem' viewBox='0 0 1474.3327 1935.947' fill='red' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='100%25' height='100%25' stroke='rgba(0, 0, 0, 1)' stroke-width='5' fill='rgba(255, 255, 255, 0.3)' /%3E%3Cpath d='M513.166 1863.974h-192q-13 0-22.5-9.5t-9.5-22.5v-1376h-192q-13 0-22.5-9.5t-9.5-22.5q0-12 10-24l320-319q9-9 22-9 14 0 23 9l320 320q9 9 9 23 0 13-9.5 22.5t-22.5 9.5h-192v1376q0 13-9.5 22.5t-22.5 9.5m544 0q-14 0-23-9l-320-320q-9-9-9-23 0-13 9.5-22.5t22.5-9.5h192v-1376q0-13 9.5-22.5t22.5-9.5h192q13 0 22.5 9.5t9.5 22.5v1376h192q14 0 23 9t9 23q0 12-10 24l-319 319q-9 9-23 9' style='opacity:1;fill:red;stroke:%23000;stroke-width:42;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1'/%3E%3C/svg%3E"
const changeDirectionElem = document.createElement('img')
changeDirectionElem.src = changeDirectionIcon

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
    if (!targetObject.parentContour) {
        console.error('Empty parent contour. Event: change_direction_control. Transform data:', transformData)
        return false
    }
    targetObject.direction = targetObject.direction === DirectionType.LeftRightTopBottom ? DirectionType.RightLeftBottomTop : DirectionType.LeftRightTopBottom
    // Source group has 4 objects: [segment, directionText, L1Text, L2Text]
    const directionTextObject = targetObject.getObjects()[1]
    if (!(directionTextObject instanceof fabric.IText)) {
        console.error('Unhandled object. Should be fabric.IText at position #1 Event: change_direction_control. Transform data:', transformData)
        return false
    }
    directionTextObject.set('text', DirectionType.toString(targetObject.direction))
    targetObject.parentContour.fire('virtial_line:modified', { target: targetObject.parentContour })
    targetObject.canvas?.renderAll() // Force call of render
    return true
}

const changeDirectionRenderControlHandler = (ctx: CanvasRenderingContext2D, left: number, top: number, styleOverride: any, fabricObject: fabric.Object): void => {
    if (!(fabricObject instanceof CustomLineGroup)) {
        // Render this control for this type of object only
        // It still "transparent" and clickable, but error will be occured during click
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
    offsetX: -16,
    cursorStyle: 'pointer',
    mouseUpHandler: changeDirectionControlHandler,
    render: changeDirectionRenderControlHandler,
    sizeX: cornerSize,
    sizeY: cornerSize
})

const trashVirtLineIcon = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1.2rem' height='1.2rem' viewBox='0 0 24 24'%3E%3Crect width='100%25' height='100%25' stroke='rgba(0, 0, 0, 1)' stroke-width='2px' fill='rgba(255, 255, 255, 0.3)'/%3E%3Cpath fill='%23ff0000' d='M12 2a10 10 0 0 1 10 10a10 10 0 0 1-10 10A10 10 0 0 1 2 12A10 10 0 0 1 12 2m0 2a8 8 0 0 0-8 8a8 8 0 0 0 8 8a8 8 0 0 0 8-8a8 8 0 0 0-8-8m4 6v7a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-7zm-2.5-4l1 1H17v2H7V7h2.5l1-1z'/%3E%3C/svg%3E"
const trashVirtLineElem = document.createElement('img')
trashVirtLineElem.src = trashVirtLineIcon

const deleteVirtualLineControlHandler = (eventData: MouseEvent, transformData: fabric.Transform, x: number, y: number): boolean => {
    // @todo
    console.log("need to impl delete for virt line group")
    return true
}

const deleteVirtualLineRenderControlHandler = (ctx: CanvasRenderingContext2D, left: number, top: number, styleOverride: any, fabricObject: fabric.Object): void => {
    if (!(fabricObject instanceof CustomLineGroup)) {
        // Render this control for this type of object only
        // It still "transparent" and clickable, but error will be occured during click
        return
    }
    ctx.save()
    ctx.translate(left, top)
    if (fabricObject.angle) {
        ctx.rotate(fabric.util.degreesToRadians(fabricObject.angle))
    }
    ctx.drawImage(trashVirtLineElem, -cornerSize/2, -cornerSize/2, cornerSize, cornerSize);
    ctx.restore()
}

export const deleteVirtualLineControl = new fabric.Control({
    x: 0.5,
    y: -0.5,
    offsetY: -16,
    offsetX: 16,
    cursorStyle: 'pointer',
    mouseUpHandler: deleteVirtualLineControlHandler,
    render: deleteVirtualLineRenderControlHandler,
    sizeX: cornerSize,
    sizeY: cornerSize
})