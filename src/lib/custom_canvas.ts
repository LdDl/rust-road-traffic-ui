import { Canvas, Polygon, Point, Line, FabricText, Shadow, util, Control, FabricObject} from "fabric";
import type {
    CanvasOptions,
    TOptions,
    FabricObjectProps,
    TPointerEventInfo,
    TPointerEvent,
    ModifiedEvent
} from "fabric";
import { UUIDv4, findLefTopX, findLeftTopY, getRandomRGB } from './utils'
import { type Zone } from "./zones";
import { get, type Writable } from "svelte/store";
import { States } from "./states";
import { CustomLineGroup, prepareVirtualLine } from "./custom_line";
import { anchorWrapper, polygonPositionHandler, actionHandler } from "./custom_control";
import { CUSTOM_CONTROL_TYPES } from "./custom_control";
import { lineControl } from '$lib/custom_control_zone.js';
import { changeDirectionControl, deleteVirtualLineControl } from '$lib/custom_control_line.js';

// Extend Canvas with custom properties
export interface FabricCanvasWrap extends Canvas {
    editContour(contour: Polygon): void;
    scaleWidth: number;
    scaleHeight: number;
    contourTemporary: Array<Line>;
    contourNotationTemporary: Array<FabricText>;
    contourFinalized: Array<ContourPoint>;
}

type PartialCanvasOptions = Partial<CanvasOptions>;

export class ExtendedCanvas extends Canvas implements FabricCanvasWrap {
    scaleWidth: number;
    scaleHeight: number;
    contourTemporary: Array<Line>;
    contourNotationTemporary: Array<FabricText>;
    contourFinalized: Array<ContourPoint>;
    constructor(element: string | HTMLCanvasElement, options?: PartialCanvasOptions) {
        super(element, options);
        this.scaleWidth = 1;
        this.scaleHeight = 1;
        this.contourTemporary = new Array<Line>()
        this.contourNotationTemporary = new Array<FabricText>()
        this.contourFinalized = new Array<ContourPoint>()
    }
    editContour(contour: Polygon): void {
        this.setActiveObject(contour);
        //@ts-ignore
        contour.edit = !contour.edit;
        //@ts-ignore
        if (contour.edit) {
            // Disable bounding box (selection outline)
            contour.set('hasBorders', false);
            contour.setControlsVisibility({
                bl: false, br: false, mb: false, ml: false, 
                mr: false, mt: false, tl: false, tr: false, mtr: false
            });
            contour.setControlVisible(CUSTOM_CONTROL_TYPES.LINE_CONTROL, false);
            contour.setControlVisible(CUSTOM_CONTROL_TYPES.CHANGE_DIRECTION_CONTROL, false);
            contour.setControlVisible(CUSTOM_CONTROL_TYPES.DELETE_VIRTUAL_LINE_CONTROL, false);
            // Show vertex controls
            if (contour instanceof CustomPolygon && contour.points) {
                contour.points.forEach((_, index) => {
                    const controlKey = `vertex_${index}`;
                    contour.setControlVisible(controlKey, true);
                });
            }
            contour.cornerStyle = 'circle';
            contour.cornerSize = 15;
            contour.cornerColor = 'rgba(0, 0, 255, 1.0)';
        } else {
            // Re-enable bounding box (selection outline)
            contour.set('hasBorders', true);
            contour.setControlsVisibility({
                bl: true, br: true, mb: true, ml: true, 
                mr: true, mt: true, tl: true, tr: true, mtr: true
            });
            contour.setControlVisible(CUSTOM_CONTROL_TYPES.LINE_CONTROL, true);
            contour.setControlVisible(CUSTOM_CONTROL_TYPES.CHANGE_DIRECTION_CONTROL, false);
            contour.setControlVisible(CUSTOM_CONTROL_TYPES.DELETE_VIRTUAL_LINE_CONTROL, false);
            // Hide vertex controls
            if (contour instanceof CustomPolygon && contour.points) {
                contour.points.forEach((_, index) => {
                    const controlKey = `vertex_${index}`;
                    contour.setControlVisible(controlKey, false);
                });
            }
            contour.cornerColor = 'rgb(178, 204, 255)';
            contour.cornerStyle = 'rect';
        }
        this.requestRenderAll();
    }
}

export interface ContourPoint {
    x: number,
    y: number
}
export interface ContourWrap {
    inner: Polygon,
    unid: string,
    notation: FabricText[]
    current_points?: Point[] | undefined
    virtual_line?: CustomLineGroup | undefined
}

export class CustomPolygon extends Polygon implements ContourWrap {
    inner: Polygon
    unid: string;
    notation: FabricText[];
    current_points?: Point[] | undefined
    virtual_line?: CustomLineGroup | undefined
    constructor(points: Point[], options?: Partial<TOptions<FabricObjectProps>>) {
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

    const shadow = new Shadow({
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

    const denotedVertices = new Array<FabricText>()
    const textShadow = new Shadow({
        color: 'rgba(255, 255, 255, 0.7)',
        blur: 10,
        offsetX: 0,
        offsetY: 0
    });
    coordinates.forEach((point: ContourPoint, idx: number) => {
        const vertexTextObject = new FabricText(verticesChars[idx], {
            left: point.x,
            top: point.y,
            fontSize: 24,
            fontFamily: 'Roboto',
            fill: color,
            shadow: textShadow,
            stroke: 'rgb(0, 0, 0)',
            strokeWidth: 0.9,
            selectable: false
        });
        denotedVertices.push(vertexTextObject)
    })

    contour.current_points = contour.points.map(p => new Point(p.x, p.y));
    contour.unid = '00000000-0000-0000-0000-000000000000'
    contour.notation = denotedVertices
    return contour
}

export function prepareContour(contourFinalized: any, state: Writable<States>, storage: Writable<Map<string, Zone>>, updateDataStorageFn: (key: string, value: Zone) => void, featureID: string = '', color = getRandomRGB(), init_virtual_lines_events: boolean = true) {
    const contour = makeContour(contourFinalized, color)
    // http://fabricjs.com/docs/FabricObject.html#setControlVisible - for custom controls
    contour.controls[CUSTOM_CONTROL_TYPES.LINE_CONTROL] = lineControl;
    contour.controls[CUSTOM_CONTROL_TYPES.CHANGE_DIRECTION_CONTROL] = changeDirectionControl;
    contour.controls[CUSTOM_CONTROL_TYPES.DELETE_VIRTUAL_LINE_CONTROL] = deleteVirtualLineControl;
    contour.setControlVisible(CUSTOM_CONTROL_TYPES.LINE_CONTROL, true)
    contour.setControlVisible(CUSTOM_CONTROL_TYPES.CHANGE_DIRECTION_CONTROL, false)
    contour.setControlVisible(CUSTOM_CONTROL_TYPES.DELETE_VIRTUAL_LINE_CONTROL, false)

    // Pre-define vertex controls (hidden by default)
    if (contour.points) {
        let lastControl = contour.points.length - 1;
        contour.points.forEach((point, index) => {
            const controlKey = `vertex_${index}`;
            contour.controls[controlKey] = new Control({
                positionHandler: polygonPositionHandler,
                actionHandler: anchorWrapper(index > 0 ? index - 1 : lastControl, actionHandler),
                actionName: 'modifyPolygon',
                //@ts-ignore
                pointIndex: index
            });
            // Hide vertex controls by default
            contour.setControlVisible(controlKey, false);
        });
    }

    contour.inner.on('mousedown', contourMouseDownEventWrapper(state, storage, updateDataStorageFn))
    contour.inner.on('modified', contourModifiedEventWrapper(storage, updateDataStorageFn))
    if (init_virtual_lines_events) {
        contour.inner.on('virtial_line:created', customEventCreatedForVirtualLine(storage, updateDataStorageFn))
        contour.inner.on('virtial_line:modified', customEventModifiedForVirtualLine(storage, updateDataStorageFn))
        contour.inner.on('virtial_line:removed', customEventRemovedForVirtualLine(storage, updateDataStorageFn))
    }

    contour.inner.on('mouseover', function (options: TPointerEventInfo<TPointerEvent>) {
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
        const isShadow = targetShadowObj && targetShadowObj instanceof Shadow
        if (!isShadow) {
            return
        }
        const targetShadow = targetShadowObj as Shadow
        targetShadow.blur = 30
        targetExtendedCanvas.renderAll()
    });
    contour.inner.on('mouseout', function (options: TPointerEventInfo<MouseEvent>) {
        const targetContour = options.target
        if (!targetContour) {
            console.warn('Empty target contour on mouseout - this can happen during object cleanup:', {
                event: options.e?.type,
                hasTarget: !!options.target,
                scenePoint: options.scenePoint,
                viewportPoint: options.viewportPoint,
                canvasObjects: targetContour?.canvas?.getObjects()?.length || 0
            });
            return
        }
        if (!(targetContour instanceof CustomPolygon)) {
            console.warn('Target contour is not a CustomPolygon on mouseout:', targetContour.constructor.name);
            return;
        }
        const targetExtendedCanvas: FabricCanvasWrap | undefined = targetContour.canvas as FabricCanvasWrap | undefined
        if (!targetExtendedCanvas) {
            console.warn('Empty target canvas on mouseout - object may have been removed:', {
                targetContour: !!targetContour,
                hasCanvas: !!targetContour.canvas
            });
            return
        }
        if (!targetExtendedCanvas.getObjects().includes(targetContour)) {
            console.warn('Target contour no longer exists in canvas on mouseout');
            return;
        }
        targetContour.set('fill', 'rgba(0, 0, 0, 0)')
        const targetShadowObj = targetContour.shadow?.valueOf()
        const isShadow = targetShadowObj && targetShadowObj instanceof Shadow
        if (!isShadow) {
            return
        }
        const targetShadow = targetShadowObj as Shadow
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
    return function (options: { target: CustomPolygon }) {
        const targetContour = options.target
        if (!targetContour) {
            console.error('Empty target contour on virtual_line:created. Options:', options)
            return
        }
        if (!(targetContour instanceof CustomPolygon)) {
            console.error('Unhandled type. Only CustomPolygon on top of FabricObject has been implemented. Event: virtual_line:created. Options:', options)
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
    return function (options: { target: CustomPolygon }) {
        const targetContour = options.target
        if (!targetContour) {
            console.error('Empty target contour on virtual_line:removed. Options:', options)
            return
        }
        if (!(targetContour instanceof CustomPolygon)) {
            console.error('Unhandled type. Only CustomPolygon on top of FabricObject has been implemented. Event: virtual_line:removed. Options:', options)
            return
        }
        targetContour.virtual_line = undefined
        let existingContour = get(storage).get(targetContour.unid);
        if (!existingContour) {
            console.warn('No contour in datastorage. Event: virtual_line:removed. Options:', options)
            return
        }
        existingContour.properties.virtual_line = undefined
        updateDataStorageFn(targetContour.unid, existingContour)
    }
}

function contourMouseDownEventWrapper(state: Writable<States>, storage: Writable<Map<string, Zone>>, updateDataStorageFn: (key: string, value: Zone) => void) {
    return function (options: TPointerEventInfo<TPointerEvent>) {
        const targetContour = options.target
        if (!targetContour) {
            console.error('Empty target contour on mouse:down. Options:', options)
            return
        }
        if (!(targetContour instanceof CustomPolygon)) {
            console.error('Unhandled type. Only CustomPolygon on top of FabricObject has been implemented. Event: mouse:down. Options:', options)
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
        if (options.e instanceof MouseEvent && options.e.button === 2) {
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
    return function (options: ModifiedEvent<TPointerEvent>) {
        const targetContour = options.target
        if (!targetContour) {
            console.error('Empty target contour on modified. Options:', options)
            return
        }
        if (!(targetContour instanceof CustomPolygon)) {
            console.error('Unhandled type. Only CustomPolygon on top of FabricObject has been implemented. Event: modified. Options:', options)
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
            console.error('No points in Polygon. Event: modified. Options:', options)
            return
        }
        const transformedPoints = targetPolygon.inner.points.map(function (p) {
            return new Point(
                p.x - targetPolygon.inner.pathOffset.x,
                p.y - targetPolygon.inner.pathOffset.y
            );
        }).map(function (p) {
            return util.transformPoint(p, matrix);
        });
        targetPolygon.current_points = transformedPoints;

        // Update notation
        targetPolygon.notation.forEach((vertextNotation: FabricText, idx: number) => {
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
        }
        /* Special case: should add events only after lines has been added to avoid excess updateDataStorageFn call */
        contour.inner.on('virtial_line:created', customEventCreatedForVirtualLine(storage, updateDataStorageFn))
        contour.inner.on('virtial_line:modified', customEventModifiedForVirtualLine(storage, updateDataStorageFn))
        contour.inner.on('virtial_line:removed', customEventRemovedForVirtualLine(storage, updateDataStorageFn))
        contour.notation.forEach((vertextNotation: FabricText) => {
            extendedCanvas.add(vertextNotation)
        })
        extendedCanvas.renderAll()
    })
}