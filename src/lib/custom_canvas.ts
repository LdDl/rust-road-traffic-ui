import { fabric } from "fabric"
import { UUIDv4, findLefTopX, findLeftTopY, getObjectSizeWithStroke, getRandomRGB } from './utils'
import { type Zone } from "./zones";
import { get, type Writable } from "svelte/store";
import { States } from "./states";
import { CustomLineGroup, prepareVirtualLine } from "./custom_line";
import { CUSTOM_CONTROL_TYPES } from "./custom_control";

// Extend fabric.Canvas with custom properties
export interface FabricCanvasWrap extends fabric.Canvas {
    editContour(contour: fabric.Polygon): void;
    scaleWidth: number;
    scaleHeight: number;
    contourTemporary: Array<fabric.Line>;
    contourNotationTemporary: Array<fabric.Text>;
    contourFinalized: Array<ContourPoint>;
}

export class ExtendedCanvas extends fabric.Canvas implements FabricCanvasWrap {
    scaleWidth: number;
    scaleHeight: number;
    contourTemporary: Array<fabric.Line>;
    contourNotationTemporary: Array<fabric.Text>;
    contourFinalized: Array<ContourPoint>;
    constructor(element: string | HTMLCanvasElement, options?: fabric.ICanvasOptions) {
        super(element, options);
        this.scaleWidth = 1;
        this.scaleHeight = 1;
        this.contourTemporary = new Array<fabric.Line>()
        this.contourNotationTemporary = new Array<fabric.Text>()
        this.contourFinalized = new Array<ContourPoint>()
    }
    editContour(contour: fabric.Polygon): void {
        this.setActiveObject(contour);
        //@ts-ignore
        contour.edit = !contour.edit;
        //@ts-ignore
        if (contour.edit) {
            let lastControl = (contour?.points?.length as number) - 1;
            contour.cornerStyle = 'circle';
            contour.cornerSize = 15;
            contour.cornerColor = 'rgba(0, 0, 255, 1.0)';
            contour.controls = contour?.points?.reduce(function (acc: any, point: any, index: any) {
                acc['p' + index] = new fabric.Control({
                    positionHandler: polygonPositionHandler,
                    actionHandler: anchorWrapper(index > 0 ? index - 1 : lastControl, actionHandler),
                    actionName: 'modifyPolygon',
                    //@ts-ignore
                    pointIndex: index
                });
                return acc;
            }, {});
        } else {
            contour.cornerColor = 'rgb(178, 204, 255)';
            contour.cornerStyle = 'rect';
            contour.controls = fabric.Object.prototype.controls;
        }
        //@ts-ignore
        contour.hasBorders = !contour.edit;
        this.requestRenderAll();
    }
}

// define a function that can keep the polygon in the same position when we change its
// width/height/top/left.
const anchorWrapper = function (anchorIndex: any, fn: any) {
    return function (eventData: any, transform: any, x: any, y: any) {
        let fabricObject = transform.target;
        const pt = new fabric.Point((fabricObject.points[anchorIndex].x - fabricObject.pathOffset.x), (fabricObject.points[anchorIndex].y - fabricObject.pathOffset.y))
        let absolutePoint = fabric.util.transformPoint(pt, fabricObject.calcTransformMatrix());
        let actionPerformed = fn(eventData, transform, x, y);
        let newDim = fabricObject._setPositionDimensions({});
        let polygonBaseSize = getObjectSizeWithStroke(fabricObject);
        let newX = (fabricObject.points[anchorIndex].x - fabricObject.pathOffset.x) / polygonBaseSize.x;
        let newY = (fabricObject.points[anchorIndex].y - fabricObject.pathOffset.y) / polygonBaseSize.y;
        fabricObject.setPositionByOrigin(absolutePoint, newX + 0.5, newY + 0.5);
        return actionPerformed;
    }
}

// define a function that can locate the controls.
// this function will be used both for drawing and for interaction.
// this is not an anonymus function since we need parent scope (`this`)
const polygonPositionHandler = function (this: { positionHandler: (dim: any, finalMatrix: any, fabricObject: any) => fabric.Point; actionHandler: (eventData: any, transform: any, x: any, y: any) => any; actionName: string; pointIndex: number; }, dim: any, finalMatrix: any, fabricObject: any) {
    let x = (fabricObject.points[this.pointIndex].x - fabricObject.pathOffset.x)
    let y = (fabricObject.points[this.pointIndex].y - fabricObject.pathOffset.y)
    const pt = new fabric.Point(x, y)
    return fabric.util.transformPoint(
        pt,
        fabric.util.multiplyTransformMatrices(
            fabricObject.canvas.viewportTransform,
            fabricObject.calcTransformMatrix()
        )
    )
}

// define a function that will define what the control does
// this function will be called on every mouse move after a control has been
// clicked and is being dragged.
// The function receive as argument the mouse event, the current trasnform object
// and the current position in canvas coordinate
// transform.target is a reference to the current object being transformed,
const actionHandler = function (eventData: any, transform: any, x: any, y: any) {
    let polygon = transform.target;
    let currentControl = polygon.controls[polygon.__corner];
    let mouseLocalPosition = polygon.toLocalPoint(new fabric.Point(x, y), 'center', 'center')
    let polygonBaseSize = getObjectSizeWithStroke(polygon);
    let size = polygon._getTransformedDimensions(0, 0);
    let finalPointPosition = {
        x: mouseLocalPosition.x * polygonBaseSize.x / size.x + polygon.pathOffset.x,
        y: mouseLocalPosition.y * polygonBaseSize.y / size.y + polygon.pathOffset.y
    };
    polygon.points[currentControl.pointIndex] = finalPointPosition;
    return true;
}

export interface ContourPoint {
    x: number,
    y: number
}
export interface ContourWrap {
    inner: fabric.Polygon,
    unid: string,
    notation: fabric.Text[]
    current_points?: fabric.Point[] | undefined
    virtual_line?: CustomLineGroup | undefined
}

export class CustomPolygon extends fabric.Polygon implements ContourWrap {
    inner: fabric.Polygon
    unid: string;
    notation: fabric.Text[];
    current_points?: fabric.Point[] | undefined
    virtual_line?: CustomLineGroup | undefined
    constructor(points: fabric.Point[], options?: fabric.IPolylineOptions) {
        super(points, options);
        // Initialize additional properties
        this.unid = '';
        this.notation = [];
        this.inner = this
        this.current_points = []
        this.virtual_line = undefined
    }
}

export const verticesChars = ['A', 'B', 'C', 'D']

export const makeContour = (coordinates: any, color = getRandomRGB()): CustomPolygon => {
    let left = findLefTopX(coordinates)
    let top = findLeftTopY(coordinates)

    const shadow = new fabric.Shadow({
        color: color,
        affectStroke: true,
        blur: 0
    });

    let contour = new CustomPolygon(coordinates, {
        fill: 'rgba(0,0,0,0)',
        stroke: color,
        strokeWidth: 3,
        objectCaching: false,
        shadow: shadow
    })
    contour.set({
        left: left,
        top: top,
    })

    const denotedVertices = new Array<fabric.Text>()
    coordinates.forEach((point: ContourPoint, idx: number) => {
        const vertexTextObject = new fabric.Text(verticesChars[idx], {
            left: point.x,
            top: point.y,
            fontSize: 24,
            fontFamily: 'Roboto',
            fill: color,
            shadow: '0 0 10px rgba(255, 255, 255, 0.7)',
            stroke: 'rgb(0, 0, 0)',
            strokeWidth: 0.9,
        });
        denotedVertices.push(vertexTextObject)
    })

    contour.current_points = contour.points;
    contour.unid = '00000000-0000-0000-0000-000000000000'
    contour.notation = denotedVertices
    return contour
}

export function prepareContour(contourFinalized: any, state: Writable<States>, storage: Writable<Map<string, Zone>>, updateDataStorageFn: (key: string, value: Zone) => void, featureID: string = '', color = getRandomRGB(), init_virtual_lines_events: boolean = true) {
    const contour = makeContour(contourFinalized, color)
    // http://fabricjs.com/docs/fabric.Object.html#setControlVisible - for custom controls
    contour.setControlVisible(CUSTOM_CONTROL_TYPES.LINE_CONTROL, true)
    contour.setControlVisible(CUSTOM_CONTROL_TYPES.CHANGE_DIRECTION_CONTROL, false)
    contour.setControlVisible(CUSTOM_CONTROL_TYPES.DELETE_VIRTUAL_LINE_CONTROL, false)

    contour.inner.on('mousedown', contourMouseDownEventWrapper(state, storage, updateDataStorageFn))
    contour.inner.on('modified', contourModifiedEventWrapper(storage, updateDataStorageFn))
    if (init_virtual_lines_events) {
        contour.inner.on('virtial_line:created', customEventCreatedForVirtualLine(storage, updateDataStorageFn))
        contour.inner.on('virtial_line:modified', customEventModifiedForVirtualLine(storage, updateDataStorageFn))
        contour.inner.on('virtial_line:removed', customEventRemovedForVirtualLine(storage, updateDataStorageFn))
    }

    contour.inner.on('mouseover', function (options: fabric.IEvent<MouseEvent>) {
        const targetContour = options.target
        if (!targetContour) {
            console.error('Empty target contour on mouseover. Options:', options)
            return
        }
        const targetExtendedCanvas: FabricCanvasWrap | undefined = targetContour.canvas as FabricCanvasWrap | undefined
        if (!targetExtendedCanvas) {
            console.error('Empty target canvas on mouseover. Options:', options)
            return
        }
        targetContour.set('fill', 'rgba(0, 0, 0, 0.1)')
        const targetShadowObj = targetContour.shadow?.valueOf()
        const isShadow = targetShadowObj && targetShadowObj instanceof fabric.Shadow
        if (!isShadow) {
            return
        }
        const targetShadow = targetShadowObj as fabric.Shadow
        targetShadow.blur = 30
        targetExtendedCanvas.renderAll()
    });
    contour.inner.on('mouseout', function (options: fabric.IEvent<MouseEvent>) {
        const targetContour = options.target
        if (!targetContour) {
            console.error('Empty target contour on mouseout. Options:', options)
            return
        }
        const targetExtendedCanvas: FabricCanvasWrap | undefined = targetContour.canvas as FabricCanvasWrap | undefined
        if (!targetExtendedCanvas) {
            console.error('Empty target canvas on mouseout. Options:', options)
            return
        }
        targetContour.set('fill', 'rgba(0, 0, 0, 0)')
        const targetShadowObj = targetContour.shadow?.valueOf()
        const isShadow = targetShadowObj && targetShadowObj instanceof fabric.Shadow
        if (!isShadow) {
            return
        }
        const targetShadow = targetShadowObj as fabric.Shadow
        targetShadow.blur = 0
        targetExtendedCanvas.renderAll()
    });
    if (featureID !== '') {
        contour.unid = featureID
    } else {
        contour.unid = new UUIDv4().generate()
    }
    contour.notation.forEach((_, idx) => {
        //@ts-ignore
        contour.notation[idx].text_id = contour.unid
    })

    return contour
}

function customEventCreatedForVirtualLine(storage: Writable<Map<string, Zone>>, updateDataStorageFn: (key: string, value: Zone) => void) {
    return function (options: fabric.IEvent<Event>) {
        const targetContour = options.target
        if (!targetContour) {
            console.error('Empty target contour on virtual_line:created. Options:', options)
            return
        }
        if (!(targetContour instanceof CustomPolygon)) {
            console.error('Unhandled type. Only CustomPolygon on top of fabric.Object has been implemented. Event: virtual_line:created. Options:', options)
            return
        }
        const targetPolygon = targetContour as CustomPolygon
        const targetVirtualLine = targetPolygon.virtual_line
        if (!targetVirtualLine) {
            console.error('Empty virtual line. Event: virtual_line:created. Options:', options)
            return
        }
        let existingContour = get(storage).get(targetPolygon.unid);
        if (!existingContour) {
            console.error('No contour in datastorage. Event: virtual_line:created. Options:', options)
            return
        }
        existingContour.properties.virtual_line = {
            geometry: targetVirtualLine.current_points,
            color_rgb: targetVirtualLine.color_rgb,
            direction: targetVirtualLine.direction
        }
        updateDataStorageFn(targetPolygon.unid, existingContour)
    }
}

function customEventModifiedForVirtualLine(storage: Writable<Map<string, Zone>>, updateDataStorageFn: (key: string, value: Zone) => void) {
    // Modified == Created currently
    // Could change this behaviour when need to.
    return customEventCreatedForVirtualLine(storage, updateDataStorageFn)
}

function customEventRemovedForVirtualLine(storage: Writable<Map<string, Zone>>, updateDataStorageFn: (key: string, value: Zone) => void) {
    return function (options: fabric.IEvent<Event>) {
        const targetContour = options.target
        if (!targetContour) {
            console.error('Empty target contour on virtual_line:removed. Options:', options)
            return
        }
        if (!(targetContour instanceof CustomPolygon)) {
            console.error('Unhandled type. Only CustomPolygon on top of fabric.Object has been implemented. Event: virtual_line:removed. Options:', options)
            return
        }
        targetContour.virtual_line = undefined
        let existingContour = get(storage).get(targetContour.unid);
        if (!existingContour) {
            console.error('No contour in datastorage. Event: virtual_line:removed. Options:', options)
            return
        }
        existingContour.properties.virtual_line = undefined
        updateDataStorageFn(targetContour.unid, existingContour)
    }
}

function contourMouseDownEventWrapper(state: Writable<States>, storage: Writable<Map<string, Zone>>, updateDataStorageFn: (key: string, value: Zone) => void) {
    return function (options: fabric.IEvent<MouseEvent>) {
        const targetContour = options.target
        if (!targetContour) {
            console.error('Empty target contour on mouse:down. Options:', options)
            return
        }
        if (!(targetContour instanceof CustomPolygon)) {
            console.error('Unhandled type. Only CustomPolygon on top of fabric.Object has been implemented. Event: mouse:down. Options:', options)
            return
        }
        const targetPolygon = targetContour as CustomPolygon
        const targetExtendedCanvas: FabricCanvasWrap | undefined = targetContour.canvas as FabricCanvasWrap | undefined
        if (!targetExtendedCanvas) {
            // Could be triggered when object is deleted via click.
            // @todo: consider to re-impelement
            console.error('Empty target canvas on mouse:down. Options:', options)
            return
        }
        options.e.preventDefault();
        options.e.stopPropagation();
        // Handle right-click
        // Turn on "Edit" mode
        if (options.button === 3) {
            const stateVal = get(state) // Bad practice, since it subscriber with instant unsubscribe
            if (stateVal != States.EditingZone) {
                state.set(States.EditingZone);
            } else {
                state.set(States.Waiting);
                let existingContour = get(storage).get(targetPolygon.unid);
                if (!existingContour) {
                    console.error('No contour in datastorage. Event: mouse:down. Options:', options)
                    return
                }
                if (!targetPolygon.current_points) {
                    console.error('No current points in target polygon. Event: mouse:down. Options:', options)
                    return
                }
                existingContour.properties.coordinates = targetPolygon.current_points.map((element: { x: number; y: number; }) => {
                    return [
                        Math.floor(element.x / targetExtendedCanvas.scaleWidth),
                        Math.floor(element.y / targetExtendedCanvas.scaleHeight)
                    ]
                }) as [[number, number], [number, number], [number, number], [number, number]]
                updateDataStorageFn(targetPolygon.unid, existingContour)
            }
            targetExtendedCanvas.editContour(targetPolygon);
        }
    }
}

function contourModifiedEventWrapper(storage: Writable<Map<string, Zone>>, updateDataStorageFn: (key: string, value: Zone) => void) {
    return function (options: fabric.IEvent<Event>) {
        const targetContour = options.target
        if (!targetContour) {
            console.error('Empty target contour on modified. Options:', options)
            return
        }
        if (!(targetContour instanceof CustomPolygon)) {
            console.error('Unhandled type. Only CustomPolygon on top of fabric.Object has been implemented. Event: modified. Options:', options)
            return
        }
        const targetPolygon = targetContour as CustomPolygon
        const targetExtendedCanvas: FabricCanvasWrap | undefined = targetContour.canvas as FabricCanvasWrap | undefined
        if (!targetExtendedCanvas) {
            console.error('Empty target canvas on modified. Options:', options)
            return
        }
        // Recalculate points
        const matrix = targetPolygon.inner.calcTransformMatrix();
        if (!targetPolygon.inner.points) {
            console.error('No points in fabric.Polygon. Event: modified. Options:', options)
            return
        }
        const transformedPoints = targetPolygon.inner.points.map(function (p) {
            return new fabric.Point(
                p.x - targetPolygon.inner.pathOffset.x,
                p.y - targetPolygon.inner.pathOffset.y
            );
        }).map(function (p) {
            return fabric.util.transformPoint(p, matrix);
        });
        targetPolygon.current_points = transformedPoints;

        // Update notation
        targetPolygon.notation.forEach((vertextNotation: fabric.Text, idx: number) => {
            const vertex = targetPolygon.current_points?.[idx]
            if (!vertex) {
                console.error(`No vertex at pos #${idx} in target polygon. Event: modified`, 'Options:', options)
                return
            }
            vertextNotation.set({ left: vertex.x, top: vertex.y })
        })
        let existingContour = get(storage).get(targetPolygon.unid);
        if (!existingContour) {
            console.error('No contour in datastorage. Event: modified. Options:', options)
            return
        }
        existingContour.properties.coordinates = targetPolygon.current_points.map((element: { x: number; y: number; }) => {
            return [
                Math.floor(element.x / targetExtendedCanvas.scaleWidth),
                Math.floor(element.y / targetExtendedCanvas.scaleHeight)
            ]
        }) as [[number, number], [number, number], [number, number], [number, number]]
        updateDataStorageFn(targetPolygon.unid, existingContour)
    }
}

export const drawCanvasPolygons = (extendedCanvas: FabricCanvasWrap, state: Writable<States>, storage: Writable<Map<string, Zone>>, updateDataStorageFn: (key: string, value: Zone) => void) => {
    get(storage).forEach(feature => {
        const contourFinalized = feature.properties.coordinates.map((element: any) => {
            return {
                x: element[0] * extendedCanvas.scaleWidth,
                y: element[1] * extendedCanvas.scaleHeight
            }
        });
        const contour = prepareContour(contourFinalized, state, storage, updateDataStorageFn, feature.id, `rgb(${feature.properties.color_rgb[0]},${feature.properties.color_rgb[1]},${feature.properties.color_rgb[2]})`, false)
        extendedCanvas.add(contour.inner);
        if (feature.properties.virtual_line) {
            prepareVirtualLine(contour, true, feature.properties.virtual_line)
            /* Special case: should add events only after lines has been added to avoid excess updateDataStorageFn call */
            contour.inner.on('virtial_line:created', customEventCreatedForVirtualLine(storage, updateDataStorageFn))
            contour.inner.on('virtial_line:modified', customEventModifiedForVirtualLine(storage, updateDataStorageFn))
            contour.inner.on('virtial_line:removed', customEventRemovedForVirtualLine(storage, updateDataStorageFn))
        }
        contour.notation.forEach((vertextNotation: fabric.Text) => {
            extendedCanvas.add(vertextNotation)
        })
        extendedCanvas.renderAll()
    })
}