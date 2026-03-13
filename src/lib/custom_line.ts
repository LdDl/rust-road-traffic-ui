import { Line, Group, Point, IText, FabricText, util, Shadow, Polygon } from "fabric";
import type { FabricObject } from "fabric";
import type {
    TOptions,
    FabricObjectProps,
    BasicTransformEvent,
    ModifiedEvent,
    TPointerEvent,
    TPointerEventInfo
} from "fabric";
import { DirectionType, type VirtualLineProps } from "./zones";
import { makeValidPoint, rgba2array, scalePoint } from "./utils";
import type { CustomPolygon, FabricCanvasWrap } from "./custom_canvas";
import { CUSTOM_CONTROL_TYPES } from "./custom_control";
import { lineControl } from '$lib/custom_control_zone.js';
import { changeDirectionControl, deleteVirtualLineControl } from '$lib/custom_control_line.js';

export const TYPE_VIRTUAL_LINE_GROUP = 'TYPE_VIRTUAL_LINE_GROUP'

interface LineWrapOne {
    calcCurrentPoints(): [Point, Point],
}

export class CustomLineOne extends Line implements LineWrapOne {
    constructor(points: [number, number, number, number], options?: Partial<TOptions<FabricObjectProps>>) {
        super(points, options);
    }
    // https://github.com/fabricjs/fabric.js/issues/6711#issuecomment-739978578
    calcCurrentPoints(): [Point, Point] {
        const points = this.calcLinePoints()
        const matrix = this.calcTransformMatrix()
        const maxx = this.canvas?.getWidth()  ?? 10
        const maxy = this.canvas?.getHeight() ?? 10
        const point1 = util.transformPoint(new Point(points.x1, points.y1), matrix)
        makeValidPoint(point1, 0, 0, maxx, maxy)
        const point2 = util.transformPoint(new Point(points.x2, points.y2), matrix)
        makeValidPoint(point2, 0, 0, maxx, maxy)
        return [point1, point2]
    }
}

interface GroupWrap {
    parentContour?: CustomPolygon
    segment_object_idx: number
    direction: DirectionType
    current_points: [[number, number], [number, number]]
    color_rgb: [number, number, number]
}

export class CustomLineGroup extends Group implements GroupWrap {
    segment_object_idx: number
    direction: DirectionType
    current_points: [[number, number], [number, number]]
    color_rgb: [number, number, number]
    parentContour?: CustomPolygon
    constructor(objects?: FabricObject[], options?: Partial<TOptions<FabricObjectProps>>) {
        const finalOptions = options || {};
        super(objects, finalOptions);
        this.segment_object_idx = 0
        this.direction = DirectionType.Inbound
        this.current_points = [[0, 0], [0, 0]]
        this.color_rgb = [0, 0, 0]
        this.type = TYPE_VIRTUAL_LINE_GROUP
    }
}

interface DirectionArrowParams {
    L1: Point;
    L2: Point;
    direction: DirectionType;
    color: string;
    shadow?: Shadow;
}

export function createDirectionArrow(params: DirectionArrowParams): Group {
    const { L1, L2, direction, color, shadow } = params;

    // Calculate midpoint
    const midX = (L1.x + L2.x) / 2.0;
    const midY = (L1.y + L2.y) / 2.0;

    // Calculate line vector
    const dx = L2.x - L1.x;
    const dy = L2.y - L1.y;

    // Calculate perpendicular vector based on direction
    const arrowLength = 30;
    let perpX: number, perpY: number;

    if (direction === DirectionType.Inbound) {
        // Clockwise rotation: (dy, -dx)
        // Arrow points to target side (inbound crossing direction)
        perpX = dy;
        perpY = -dx;
    } else { // DirectionType.Outbound
        // Counterclockwise rotation: (-dy, dx)
        // Arrow points to target side (outbound crossing direction)
        perpX = -dy;
        perpY = dx;
    }

    // Normalize perpendicular vector
    const perpMag = Math.sqrt(perpX * perpX + perpY * perpY);
    const normPerpX = (perpX / perpMag) * arrowLength;
    const normPerpY = (perpY / perpMag) * arrowLength;

    // Arrow endpoint
    const arrowEndX = midX + normPerpX;
    const arrowEndY = midY + normPerpY;

    // Create arrow shaft
    const shaft = new Line([midX, midY, arrowEndX, arrowEndY], {
        stroke: color,
        strokeWidth: 2.5,
        strokeUniform: true,
        objectCaching: false,
        selectable: false,
        evented: false
    });

    // Create arrowhead
    // Height of triangle
    const headLength = 12;

    // Calculate arrowhead points (triangle pointing away from midpoint)
    const angle = Math.atan2(normPerpY, normPerpX);
    const tipX = arrowEndX;
    const tipY = arrowEndY;

    // Base points at ~153 degrees angle from tip
    const baseAngle1 = angle + Math.PI * 0.85;
    const baseAngle2 = angle - Math.PI * 0.85;

    const base1X = tipX + headLength * Math.cos(baseAngle1);
    const base1Y = tipY + headLength * Math.sin(baseAngle1);
    const base2X = tipX + headLength * Math.cos(baseAngle2);
    const base2Y = tipY + headLength * Math.sin(baseAngle2);

    const arrowhead = new Polygon([
        { x: tipX, y: tipY },
        { x: base1X, y: base1Y },
        { x: base2X, y: base2Y }
    ], {
        fill: color,
        stroke: color,
        strokeWidth: 1,
        strokeUniform: true,
        objectCaching: false,
        selectable: false,
        evented: false
    });

    // Group shaft and head
    const arrowGroup = new Group([shaft, arrowhead], {
        objectCaching: false,
        selectable: false,
        evented: false
    });

    return arrowGroup;
}

export function prepareVirtualLine(targetContour: CustomPolygon, givenByAPI: boolean, props: VirtualLineProps) {
    const targetExtendedCanvas: FabricCanvasWrap | undefined = targetContour.canvas as FabricCanvasWrap | undefined
    if (!targetExtendedCanvas) {
        console.error('Empty target canvas for preparing virtual line')
        return false
    }
    const L1 = new Point(props.geometry[0][0], props.geometry[0][1])
    const L2 = new Point(props.geometry[1][0], props.geometry[1][1])
    const shadow = new Shadow({  
        color: 'rgba(0, 0, 0, 1)',  
        affectStroke: true,
        blur: 30
    });
    const L1Scaled = givenByAPI ? 
        new Point(Math.floor(L1.x*targetExtendedCanvas.scaleWidth), Math.floor(L1.y*targetExtendedCanvas.scaleHeight)) :
        new Point(Math.floor(L1.x/targetExtendedCanvas.scaleWidth), Math.floor(L1.y/targetExtendedCanvas.scaleHeight))

    const L2Scaled = givenByAPI ?
        new Point(Math.floor(L2.x*targetExtendedCanvas.scaleWidth), Math.floor(L2.y*targetExtendedCanvas.scaleHeight)) :
        new Point(Math.floor(L2.x/targetExtendedCanvas.scaleWidth), Math.floor(L2.y/targetExtendedCanvas.scaleHeight))

    const L1Canvas = givenByAPI ? L1Scaled : L1
    const L2Canvas = givenByAPI ? L2Scaled : L2

    const segment = new CustomLineOne([L1Canvas.x, L1Canvas.y, L2Canvas.x, L2Canvas.y], {
        stroke: targetContour.stroke,
        strokeWidth: 5,
        strokeDashArray: [5],
        // http://fabricjs.com/stroke-uniform
        strokeUniform: true,
        objectCaching: false, // For real-time rendering updates
        shadow: shadow
    })

    /* Direction arrow indicator - perpendicular to line */
    const textShadow = new Shadow({
        color: 'rgba(255, 255, 255, 0.7)',
        blur: 10,
        offsetX: 0,
        offsetY: 0
    });
    const directionArrow = createDirectionArrow({
        L1: L1Canvas,
        L2: L2Canvas,
        direction: props.direction,
        color: targetContour.stroke || 'rgb(255, 0, 0)',
        shadow: shadow
    });
    /* Denote line vertices */
    const L1Text = new FabricText("L1", {
        left: L1Canvas.x - 5,
        top: L1Canvas.y + 10,
        fontSize: 18,
        fontFamily: 'Roboto',
        fill: targetContour.stroke,
        shadow: textShadow,
        stroke: 'rgb(0, 0, 0)',
        strokeWidth: 0.9,
        objectCaching: false
    });
    const L2Text = new FabricText("L2", {
        left: L2Canvas.x - 5,
        top: L2Canvas.y + 10,
        fontSize: 18,
        fontFamily: 'Roboto',
        fill: targetContour.stroke,
        shadow: textShadow,
        stroke: 'rgb(0, 0, 0)',
        strokeWidth: 0.9,
        objectCaching: false
    });
    /* */

    const virtLineGroup = new CustomLineGroup([segment, directionArrow, L1Text, L2Text], {
        strokeUniform: true,
        objectCaching: false, // For real-time rendering updates
        isAlreadyGrouped: true
    })
    virtLineGroup.current_points = givenByAPI ? [[L1.x, L1.y], [L2.x, L2.y]] : [[L1Scaled.x, L1Scaled.y], [L2Scaled.x, L2Scaled.y]]
    virtLineGroup.color_rgb = rgba2array(segment.stroke?.toString() || undefined)
    virtLineGroup.direction = props.direction

    virtLineGroup.segment_object_idx = 0

    // http://fabricjs.com/docs/FabricObject.html#setControlsVisibility
    virtLineGroup.setControlsVisibility({
        bl: false,
        br: false,
        mb: false,
        ml: true,
        mr: true,
        mt: false,
        tl: false,
        tr: false,
        mtr: true
    })
    // http://fabricjs.com/docs/FabricObject.html#setControlVisible - for custom controls
    virtLineGroup.controls[CUSTOM_CONTROL_TYPES.LINE_CONTROL] = lineControl;
    virtLineGroup.controls[CUSTOM_CONTROL_TYPES.CHANGE_DIRECTION_CONTROL] = changeDirectionControl;
    virtLineGroup.controls[CUSTOM_CONTROL_TYPES.DELETE_VIRTUAL_LINE_CONTROL] = deleteVirtualLineControl;
    virtLineGroup.setControlVisible(CUSTOM_CONTROL_TYPES.LINE_CONTROL, false)
    virtLineGroup.setControlVisible(CUSTOM_CONTROL_TYPES.CHANGE_DIRECTION_CONTROL, true)
    virtLineGroup.setControlVisible(CUSTOM_CONTROL_TYPES.DELETE_VIRTUAL_LINE_CONTROL, true)

    virtLineGroup.on('scaling', function(options: BasicTransformEvent<TPointerEvent>) {
        const transform = options.transform
        if (!transform) {
            console.error('Empty transform event for group object on line group. Event: modified. Options:', options)
            return
        }
        const targetGroupObject = transform.target
        if (!targetGroupObject) {
            console.error('Empty target group object on line group. Event: scaling. Options:', options)
            return
        }
        if (!(targetGroupObject instanceof CustomLineGroup)) {
            console.error('Unhandled type. Only CustomLineGroup on top of Group has been implemented. Event: scaling. Options:', options)
            return
        }
        const scaleX = 1 / (targetGroupObject.scaleX ?? 1)
        const scaleY = 1 / (targetGroupObject.scaleY ?? 1)
        const textObjects = targetGroupObject.getObjects('text')
        textObjects.forEach((textObject) => {
            textObject.set('scaleX', scaleX)
            textObject.set('scaleY', scaleY)
        })
        const iTextObjects = targetGroupObject.getObjects('i-text')
        iTextObjects.forEach((iTextObject) => {
            iTextObject.set('scaleX', scaleX)
            iTextObject.set('scaleY', scaleY)
        })
        // Keep arrow at constant visual size
        const arrowObject = targetGroupObject.getObjects()[1];
        if (arrowObject && arrowObject.isType('Group')) {
            arrowObject.set('scaleX', scaleX);
            arrowObject.set('scaleY', scaleY);
        }
    })

    virtLineGroup.on('rotating', function(options: BasicTransformEvent<TPointerEvent>) {
        const transform = options.transform
        if (!transform) {
            console.error('Empty transform event for group object on line group. Event: modified. Options:', options)
            return
        }
        const targetGroupObject = transform.target
        if (!targetGroupObject) {
            console.error('Empty target group object on line group. Event: scaling. Options:', options)
            return
        }
        if (!(targetGroupObject instanceof CustomLineGroup)) {
            console.error('Unhandled type. Only CustomLineGroup on top of Group has been implemented. Event: scaling. Options:', options)
            return
        }
        const angle = 360 - (targetGroupObject.angle ?? 0)
        const textObjects = targetGroupObject.getObjects('text')
        textObjects.forEach((textObject) => {
            textObject.rotate(angle)
        })
        const iTextObjects = targetGroupObject.getObjects('i-text')
        iTextObjects.forEach((iTextObject) => {
            iTextObject.rotate(angle)
        })
        // Arrow rotates naturally with the group (no counter-rotation needed)
    })

    virtLineGroup.on('modified', (options: ModifiedEvent<TPointerEvent>) => {
        const targetGroupObject = options.target
        if (!targetGroupObject) {
            console.error('Empty target group object on line group. Event: modified. Options:', options)
            return
        }
        if (!(targetGroupObject instanceof CustomLineGroup)) {
            console.error('Unhandled type. Only CustomLineGroup on top of Group has been implemented. Event: modified. Options:', options)
            return
        }
        const targetCanvas: FabricCanvasWrap | undefined = targetGroupObject.canvas as FabricCanvasWrap | undefined
        if (!targetCanvas) {
            console.error('Empty target canvas on line group. Event: modified. Options:', options)
            return
        }
        const segmentObject = targetGroupObject.getObjects()[targetGroupObject.segment_object_idx]
        if (!(segmentObject instanceof CustomLineOne)) {
            console.error('Unhandled type. Only CustomLime on top of FabricObject has been implemented. Event: modified. Options:', options)
            return
        }
        const currentPoints = segmentObject.calcCurrentPoints()
        // calcCurrentPoints grants that points will fit into canvas width/height, but rendered object itself won't have correct representation.
        // @todo: think how to handle it (and for polygons too) and do we even need this since REST API will accept correct values? 
        const L1ModifiedScaled = scalePoint(currentPoints[0], targetCanvas.scaleWidth, targetCanvas.scaleHeight)
        const L2ModifiedScaled = scalePoint(currentPoints[1], targetCanvas.scaleWidth, targetCanvas.scaleHeight)
        targetGroupObject.current_points[0][0] = L1ModifiedScaled.x
        targetGroupObject.current_points[0][1] = L1ModifiedScaled.y
        targetGroupObject.current_points[1][0] = L2ModifiedScaled.x
        targetGroupObject.current_points[1][1] = L2ModifiedScaled.y
        targetContour.fire('virtial_line:modified', { target: targetContour })
    })

    virtLineGroup.on('mouseover', function(options: TPointerEventInfo<TPointerEvent>) {
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
        if (!(targetGroupObject instanceof CustomLineGroup)) {
            return
        }
        const targetObjects = targetGroupObject.getObjects()
        targetObjects.forEach((targetObject) => {
            const targetShadowObj = targetObject.shadow?.valueOf()
            const isShadow = targetShadowObj && targetShadowObj instanceof Shadow
            if (!isShadow) {
                return
            }
            const targetShadow = targetShadowObj as Shadow
            targetShadow.color = 'rgba(255, 255, 255, 1)'  
            targetShadow.blur = 30

            // Apply some styling to parent contour too
            const parentObject = targetContour
            const parentShadowObj = parentObject.shadow?.valueOf()
            const isParentShadow = parentShadowObj && parentShadowObj instanceof Shadow
            if (!isParentShadow) {
                return
            }
            const parentShadow = parentShadowObj as Shadow
            parentShadow.color = 'rgba(255, 255, 255, 1)'  
            parentShadow.blur = 30
        })
        targetCanvas.renderAll()
    })

    virtLineGroup.on('mouseout', function(options: TPointerEventInfo<TPointerEvent>) {
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
        if (!(targetGroupObject instanceof CustomLineGroup)) {
            return
        }
        const targetObjects = targetGroupObject.getObjects()
        targetObjects.forEach((targetObject) => {
            const targetShadowObj = targetObject.shadow?.valueOf()
            const isShadow = targetShadowObj && targetShadowObj instanceof Shadow
            if (!isShadow) {
                return
            }
            const targetShadow = targetShadowObj as Shadow
            targetShadow.color = 'rgba(0, 0, 0, 1)'  
            targetShadow.blur = 30

            // Reset parent shadow
            const parentObject = targetContour
            const parentShadowObj = parentObject.shadow?.valueOf()
            const isParentShadow = parentShadowObj && parentShadowObj instanceof Shadow
            if (!isParentShadow) {
                return
            }
            const parentShadow = parentShadowObj as Shadow
            parentShadow.color = parentObject.stroke?.toString() || 'rgb(0,0,0)'
            parentShadow.blur = 0
        })
        targetCanvas.renderAll()
    })

    virtLineGroup.on('removed', function(options) {
        if (virtLineGroup.parentContour) {
            virtLineGroup.parentContour.fire('virtial_line:removed', { target: targetContour })
        }
    })

    targetContour.virtual_line = virtLineGroup
    targetContour.fire('virtial_line:created', { target: targetContour })

    virtLineGroup.parentContour = targetContour
    
    targetExtendedCanvas.add(virtLineGroup)
}