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
	const naturalWidth = imageElem.naturalWidth;
	const naturalHeight = imageElem.naturalHeight;

	// A hidden panel measures zero, and scaling every object by zero cannot be undone
	if (newWidth === 0 || newHeight === 0) return;
	if (!naturalWidth || !naturalHeight) return;
	if (!canvasState.width || !canvasState.height) return;

	// How much one pixel of the source frame measures on screen. Another video source
	// changes this even when the picture keeps its size on screen, and zones are placed
	// by multiplying their source pixels by exactly this
	const wantedScaleWidth = newWidth / naturalWidth;
	const wantedScaleHeight = newHeight / naturalHeight;

	const scaleX = canvasState.scaleWidth ? wantedScaleWidth / canvasState.scaleWidth : 1;
	const scaleY = canvasState.scaleHeight ? wantedScaleHeight / canvasState.scaleHeight : 1;
	const sameSize = canvasState.width === newWidth && canvasState.height === newHeight;
	const sameScale = Math.abs(scaleX - 1) < 1e-6 && Math.abs(scaleY - 1) < 1e-6;
	if (sameSize && sameScale) return;

	// Scale all objects
	canvasState.getObjects().forEach((obj) => {
		obj.scaleX = (obj.scaleX || 1) * scaleX;
		obj.scaleY = (obj.scaleY || 1) * scaleY;
		obj.left = (obj.left || 0) * scaleX;
		obj.top = (obj.top || 0) * scaleY;
		obj.setCoords();

		if (obj instanceof CustomPolygon && obj.current_points) {
			obj.current_points = obj.current_points.map(
				(point) => new Point(point.x * scaleX, point.y * scaleY)
			);
		}

		if (obj instanceof CustomLineGroup && obj.current_points) {
			obj.current_points = obj.current_points.map((point) => [
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
	// The canvas always covers the picture, whatever changed underneath
	canvasState.setDimensions({ width: newWidth, height: newHeight });
	canvasState.scaleWidth = wantedScaleWidth;
	canvasState.scaleHeight = wantedScaleHeight;
	canvasState.renderAll();
}
