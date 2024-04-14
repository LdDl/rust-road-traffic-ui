import { fabric } from "fabric"
import { CustomPolygon, type FabricCanvasWrap } from "./custom_canvas";

// http://fabricjs.com/custom-control-render

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
    const targetExtendedCanvas: FabricCanvasWrap | undefined = targetContour.canvas as FabricCanvasWrap | undefined
    if (!targetExtendedCanvas) {
        console.error('Empty target canvas on control click. transform Data:', transformData)
        return false
    }
    if (!(targetContour instanceof CustomPolygon)) {
        console.error('Unhandled type. Only CustomPolygon on top of fabric.Object has been implemented. Event: control click. Transform data:', transformData)
        return false
    }
    
    // @todo
    console.warn("Need to implement 'lineControlHandler'")
    return true
}

// <rect width="100%" height="100%" fill="green"/>

const lineRenderControlHandler = (ctx: CanvasRenderingContext2D, left: number, top: number, styleOverride: any, fabricObject: fabric.Object): void => {
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
