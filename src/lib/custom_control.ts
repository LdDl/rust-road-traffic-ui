import { Point, util } from "fabric";
import type {
    TPointerEvent,
    TMat2D
} from "fabric";
import { getObjectSizeWithStroke } from './utils'

export enum CUSTOM_CONTROL_TYPES {
    LINE_CONTROL = 'lineControl',
    CHANGE_DIRECTION_CONTROL = 'changeDirectionControl',
    DELETE_VIRTUAL_LINE_CONTROL = 'deleteVirtualLineControl'
}

export const anchorWrapper = function (anchorIndex: number, fn: any) {
    return function (eventData: TPointerEvent, transform: any, x: number, y: number) {
        let fabricObject = transform.target;

        const pt = new Point(
            (fabricObject.points[anchorIndex].x - fabricObject.pathOffset.x), 
            (fabricObject.points[anchorIndex].y - fabricObject.pathOffset.y)
        );

        let absolutePoint = pt.transform(fabricObject.calcTransformMatrix());

        let actionPerformed = fn(eventData, transform, x, y);

        // FIX: Ensure dimensions are recalculated after point modification
        fabricObject.setDimensions();

        // let newDim = fabricObject._setPositionDimensions({});
        let polygonBaseSize = getObjectSizeWithStroke(fabricObject);

        let newX = (fabricObject.points[anchorIndex].x - fabricObject.pathOffset.x) / polygonBaseSize.x;
        let newY = (fabricObject.points[anchorIndex].y - fabricObject.pathOffset.y) / polygonBaseSize.y;
        
        fabricObject.setPositionByOrigin(absolutePoint, newX + 0.5, newY + 0.5);
        return actionPerformed;
    };
};

export const polygonPositionHandler = function (this: any, dim: Point, finalMatrix: TMat2D, fabricObject: any): Point {
    let x = (fabricObject.points[this.pointIndex].x - fabricObject.pathOffset.x);
    let y = (fabricObject.points[this.pointIndex].y - fabricObject.pathOffset.y);
    const pt = new Point(x, y);
    const result = pt.transform(
        util.multiplyTransformMatrices(
            fabricObject.canvas.viewportTransform,
            fabricObject.calcTransformMatrix()
        )
    );
    return result;
};

export const actionHandler = function (eventData: TPointerEvent, transform: any, x: number, y: number) {
    let polygon = transform.target;
    let currentControl = polygon.controls[transform.corner];

    // Use util.transformPoint instead of toLocalPoint
    const pt = new Point(x, y)
    const mouseLocalPosition = pt.transform(
        util.invertTransform(polygon.calcTransformMatrix())
    );

    let polygonBaseSize = getObjectSizeWithStroke(polygon);

    let size = polygon._getTransformedDimensions(0, 0);

    let finalPointPosition = {
        x: mouseLocalPosition.x * polygonBaseSize.x / size.x + polygon.pathOffset.x,
        y: mouseLocalPosition.y * polygonBaseSize.y / size.y + polygon.pathOffset.y
    };

    polygon.points[currentControl.pointIndex] = finalPointPosition;
    // FIX: Recalculate bounding box after point modification
    polygon.setDimensions();

    // Update current_points and notation
    if (polygon.current_points && polygon.notation) {
        const matrix = polygon.calcTransformMatrix();
        const tpt = new Point(
            polygon.points[currentControl.pointIndex].x - polygon.pathOffset.x,
            polygon.points[currentControl.pointIndex].y - polygon.pathOffset.y
        )
        const transformedPoint = tpt.transform(matrix);
        polygon.current_points[currentControl.pointIndex] = transformedPoint;

        // Update vertex notation position
        if (polygon.notation[currentControl.pointIndex]) {
            polygon.notation[currentControl.pointIndex].set({
                left: transformedPoint.x,
                top: transformedPoint.y
            });
        }
    }

    return true;
};
