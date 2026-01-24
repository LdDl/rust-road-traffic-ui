import { Point } from 'fabric';
import type { FabricCanvasWrap } from './custom_canvas.js';
import { CustomPolygon } from './custom_canvas.js';
import { CustomLineGroup } from './custom_line.js';

export function resizeCanvas(canvasState: FabricCanvasWrap): void {
    if (!canvasState) return;

    const canvasElem = document.getElementById('fit_canvas') as HTMLCanvasElement;
    const imageElem = document.getElementById('fit_img') as HTMLImageElement;
    
    if (!canvasElem || !imageElem) return;

    const newWidth = imageElem.clientWidth;
    const newHeight = imageElem.clientHeight;

    if (canvasState.width === newWidth && canvasState.height === newHeight) return;

    const scaleX = newWidth / canvasState.width;
    const scaleY = newHeight / canvasState.height;

    // Scale all objects
    canvasState.getObjects().forEach(obj => {
        obj.scaleX = (obj.scaleX || 1) * scaleX;
        obj.scaleY = (obj.scaleY || 1) * scaleY;
        obj.left = (obj.left || 0) * scaleX;
        obj.top = (obj.top || 0) * scaleY;
        obj.setCoords();

        if (obj instanceof CustomPolygon && obj.current_points) {
            obj.current_points = obj.current_points.map(point => 
                new Point(point.x * scaleX, point.y * scaleY)
            );
        }

        if (obj instanceof CustomLineGroup && obj.current_points) {
            obj.current_points = obj.current_points.map(point => [
                point[0] * scaleX,
                point[1] * scaleY
            ]) as [[number, number], [number, number]];
        }
    });

    // Scale background image
    const bgImage = canvasState.backgroundImage;
    if (bgImage) {
        bgImage.scaleX = (bgImage.scaleX || 1) * scaleX;
        bgImage.scaleY = (bgImage.scaleY || 1) * scaleY;
    }

    // Update canvas
    canvasState.discardActiveObject();
    canvasState.setDimensions({
        width: canvasState.getWidth() * scaleX,
        height: canvasState.getHeight() * scaleY
    });
    canvasState.scaleWidth = newWidth / imageElem.naturalWidth;
    canvasState.scaleHeight = newHeight / imageElem.naturalHeight;
    canvasState.renderAll();
}