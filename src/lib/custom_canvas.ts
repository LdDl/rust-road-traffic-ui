import { fabric } from "fabric"
import { findLefTopX, findLeftTopY, getObjectSizeWithStroke, getRandomRGB} from './utils'
import type { Zone } from "./zones";
import { States } from "../store/state";
import { get, type Writable } from "svelte/store";


// Extend fabric.Canvas with custom properties
export interface FabricCanvasWrap extends fabric.Canvas {
    editContour (contour: fabric.Polygon): void;
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
            contour.controls = contour?.points?.reduce(function(acc: any, point: any, index: any) {
                acc['p' + index] = new fabric.Control({
                    positionHandler: polygonPositionHandler,
                    actionHandler: anchorWrapper(index > 0 ? index - 1 : lastControl, actionHandler),
                    actionName: 'modifyPolygon',
                    //@ts-ignore
                    pointIndex: index
                });
                return acc;
            }, { });
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
    return function(eventData: any, transform: any, x: any, y: any) {
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
}

export const verticesChars = ['A', 'B', 'C', 'D']

export const makeContour = (coordinates: any, color = getRandomRGB()): ContourWrap => {
    let left = findLefTopX(coordinates)
    let top = findLeftTopY(coordinates)
    let contour = new fabric.Polygon(coordinates, {
        fill: 'rgba(0,0,0,0)',
        stroke: color,
        strokeWidth: 3,
        objectCaching: false
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

    // Before `current_points` is undefined
    //@ts-ignore
    contour.current_points = contour.points;
    return { inner: contour , unid: '00000000-0000-0000-0000-000000000000', notation: denotedVertices};
}

export const drawCanvasPolygons = (extendedCanvas: FabricCanvasWrap, state: Writable<States>, storage: Map<string, Zone>, updateDataStorageFn: (key: string, value: Zone) => void) => {
    storage.forEach(feature => {
        const contourFinalized = feature.properties.coordinates.map((element: any) => {
            return {
                x: element[0]*extendedCanvas.scaleWidth,
                y: element[1]*extendedCanvas.scaleHeight
            }
        });
        let contour = makeContour(contourFinalized, `rgb(${feature.properties.color_rgb[0]},${feature.properties.color_rgb[1]},${feature.properties.color_rgb[2]})`);
        contour.inner.on('mousedown', (options: any) => {
            options.e.preventDefault();
            options.e.stopPropagation();
            // state = States.PickPolygon;
            if (options.button === 3) {
                const stateVal = get(state)
                if (stateVal != States.EditingZone) {
                    state.set(States.EditingZone);
                } else {
                    state.set(States.Waiting);
                    let existingContour = storage.get(contour.unid);
                    if (!existingContour) {
                        return
                    }
                    //@ts-ignore
                    existingContour.properties.coordinates = contour.inner.current_points.map((element: { x: number; y: number; }) => {
                        return [
                            Math.floor(element.x/extendedCanvas.scaleWidth),
                            Math.floor(element.y/extendedCanvas.scaleHeight)
                        ]
                    })
                    updateDataStorageFn(contour.unid, existingContour)
                }
                extendedCanvas.editContour(contour.inner);
            }
        });
        contour.inner.on('modified', (options: any) => {
            // Recalculate points
            const matrix = contour.inner.calcTransformMatrix();
            //@ts-ignore
            const transformedPoints = contour.inner.points.map(function (p) {
                return new fabric.Point(
                    p.x - contour.inner.pathOffset.x,
                    p.y - contour.inner.pathOffset.y
                );
            }).map(function (p) {
                return fabric.util.transformPoint(p, matrix);
            });
            //@ts-ignore
            contour.inner.current_points = transformedPoints;

            // Update notation
            contour.notation.forEach((vertextNotation: fabric.Text, idx: number) => {
                //@ts-ignore
                const vertex = contour.inner.current_points[idx]
                vertextNotation.set({ left: vertex.x, top: vertex.y })
            })
            let existingContour = storage.get(contour.unid);
            if (!existingContour) {
                return
            }
            //@ts-ignore
            existingContour.properties.coordinates = contour.inner.current_points.map((element: { x: number; y: number; }) => {
                return [
                    Math.floor(element.x/extendedCanvas.scaleWidth),
                    Math.floor(element.y/extendedCanvas.scaleHeight)
                ]
            })
            updateDataStorageFn(contour.unid, existingContour)
        })
        //@ts-ignore
        contour.unid = feature.id
        //@ts-ignore
        contour.inner.unid = feature.id
        contour.notation.forEach((_, idx) => {
            //@ts-ignore
            contour.notation[idx].text_id = feature.id
        })
        extendedCanvas.add(contour.inner);
        contour.notation.forEach((vertextNotation: fabric.Text) => {
            extendedCanvas.add(vertextNotation)
        })
        extendedCanvas.renderAll()
    })
}