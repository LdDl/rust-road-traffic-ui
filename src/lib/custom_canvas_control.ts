import { fabric } from "fabric"
import { CustomPolygon, type FabricCanvasWrap } from "./custom_canvas";
import { interpolatePoint, rgba2array, scalePoint } from "./utils";
import { CustomLine } from "./custom_line";
import { DirectionType } from "./zones";

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
    const L1 = interpolatePoint(Dpoint, Apoint, dist);
    const L2 = interpolatePoint(Cpoint, Bpoint, dist);
    const shadow = new fabric.Shadow({  
        color: 'rgba(0, 0, 0, 1)',  
        affectStroke: true,
        blur: 30
    });  
    const segment = new CustomLine([L1.x, L1.y, L2.x, L2.y], {
        stroke: targetContour.stroke,
        strokeWidth: 5,
        strokeDashArray: [5],
        shadow: shadow
    })
    const L1Scaled = new fabric.Point(Math.floor(L1.x/targetExtendedCanvas.scaleWidth), Math.floor(L1.y/targetExtendedCanvas.scaleHeight))
    const L2Scaled = new fabric.Point(Math.floor(L2.x/targetExtendedCanvas.scaleWidth), Math.floor(L2.y/targetExtendedCanvas.scaleHeight))
    segment.current_points = [[L1Scaled.x, L1Scaled.y], [L2Scaled.x, L2Scaled.y]]
    segment.color_rgb = rgba2array(segment.stroke)
    segment.direction = DirectionType.LeftRightTopBottom

    segment.on('mouseover', function(options: fabric.IEvent<MouseEvent>) {
        const targetObject = options.target
        if (!targetObject) {
            console.error('Empty target object on segment mouseover. Options:', options)
            return
        }
        const targetCanvas: FabricCanvasWrap | undefined = targetObject.canvas as FabricCanvasWrap | undefined
        if (!targetCanvas) {
            console.error('Empty target canvas on segment mouseover. Options:', options)
            return
        }

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
        
        targetCanvas.renderAll()
    });
    segment.on('mouseout', function(options: fabric.IEvent<MouseEvent>) {
        const targetObject = options.target
        if (!targetObject) {
            console.error('Empty target object on segment mouseout. Options:', options)
            return
        }
        const targetCanvas: FabricCanvasWrap | undefined = targetObject.canvas as FabricCanvasWrap | undefined
        if (!targetCanvas) {
            console.error('Empty target canvas on segment mouseout. Options:', options)
            return
        }
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

        targetCanvas.renderAll()
    }); 
    segment.on('modified', (options: fabric.IEvent<Event>) => {
        const targetObject = options.target
        if (!targetObject) {
            console.error('Empty target object on segment. Event: modified. Options:', options)
            return
        }
        if (!(targetObject instanceof CustomLine)) {
            console.error('Unhandled type. Only CustomLime on top of fabric.Object has been implemented. Event: modified. Options:', options)
            return
        }
        const targetCanvas: FabricCanvasWrap | undefined = targetObject.canvas as FabricCanvasWrap | undefined
        if (!targetCanvas) {
            console.error('Empty target canvas on segment. Event: modified. Options:', options)
            return
        }

        const targetLine = targetObject as CustomLine
        const currentPoints = targetLine.calcCurrentPoints()
        
        const L1Scaled = scalePoint(currentPoints[0], targetCanvas.scaleWidth, targetCanvas.scaleHeight)
        const L2Scaled = scalePoint(currentPoints[1], targetCanvas.scaleWidth, targetCanvas.scaleHeight)
        targetLine.current_points[0][0] = L1Scaled.x
        targetLine.current_points[0][1] = L1Scaled.y
        targetLine.current_points[1][0] = L2Scaled.x
        targetLine.current_points[1][1] = L2Scaled.y

        targetContour.fire('virtial_line:modified', { target: targetContour })
    })

    targetContour.virtual_line = segment
    targetContour.fire('virtial_line:created', { target: targetContour })
    targetExtendedCanvas.add(segment)
    // @todo
    console.warn("Need to implement 'lineControlHandler'")
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
