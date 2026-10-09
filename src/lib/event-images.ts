import type { BoundingBox, VehicleEvent } from './api/vehicle-events';

export type EventMetadata = Omit<VehicleEvent, 'frame_base64'>;

export interface ImageStage {
	label: string;
	crop: BoundingBox;
	boxes: ImageBox[];
}

export interface ImageBox {
	bbox: BoundingBox;
	label: string;
	conflict: boolean;
}

export interface EventGeometry {
	width: number;
	height: number;
	stages: ImageStage[];
}

function shifted(box: BoundingBox, x: number, y: number): BoundingBox {
	return { ...box, x: box.x + x, y: box.y + y };
}

function visible(box: BoundingBox): boolean {
	return box.width > 0 && box.height > 0;
}

export function eventGeometry(event: EventMetadata): EventGeometry {
	const vehicle = event.vehicle.bbox;
	const plate = event.plate;
	const stages: ImageStage[] = [];
	let width = event.frame_width;
	let height = event.frame_height;
	let vehicleOrigin = { x: vehicle.x, y: vehicle.y };
	if (event.frame_type === 'vehicle') {
		width = vehicle.width;
		height = vehicle.height;
		vehicleOrigin = { x: 0, y: 0 };
	} else if (event.frame_type === 'plate') {
		width = plate?.bbox.width ?? 0;
		height = plate?.bbox.height ?? 0;
	} else if (event.frame_type !== 'full') {
		return { width: 0, height: 0, stages };
	}
	if (!width || !height) return { width, height, stages };
	const vehicleBox = { ...vehicle, ...vehicleOrigin };
	const plateBox = plate
		? event.frame_type === 'plate'
			? { ...plate.bbox, x: 0, y: 0 }
			: shifted(plate.bbox, vehicleOrigin.x, vehicleOrigin.y)
		: null;
	if (event.frame_type === 'full') {
		stages.push({
			label: 'Frame',
			crop: { x: 0, y: 0, width, height },
			boxes: visible(vehicleBox)
				? [{ bbox: vehicleBox, label: event.vehicle.class, conflict: false }]
				: []
		});
	}
	if (event.frame_type !== 'plate' && visible(vehicleBox)) {
		stages.push({
			label: 'Vehicle',
			crop: vehicleBox,
			boxes:
				plateBox && visible(plateBox)
					? [{ bbox: plateBox, label: plate!.class, conflict: false }]
					: []
		});
	}
	if (plateBox && visible(plateBox)) {
		stages.push({
			label: 'Plate / OCR',
			crop: plateBox,
			boxes: (plate?.ocr?.positions ?? [])
				.filter((position) => position.bbox && visible(position.bbox))
				.map((position) => ({
					bbox: shifted(position.bbox!, plateBox.x, plateBox.y),
					label: position.class,
					conflict: position.status === 'conflict'
				}))
		});
	}
	return { width, height, stages };
}

export interface PassageItem {
	event: EventMetadata;
	geometry: EventGeometry;
	imageUrl: string | null;
	imageBytes: number;
	imageError: string | null;
}

// Includes an estimate for decoded pixels, as well as the stored JPEG.
export const IMAGE_BUDGET = 32 * 1024 * 1024;
export const EVENT_LIMIT = 50;

export function passageItem(event: VehicleEvent): PassageItem {
	const { frame_base64, ...metadata } = event;
	const geometry = eventGeometry(metadata);
	const item: PassageItem = {
		event: metadata,
		geometry,
		imageUrl: null,
		imageBytes: 0,
		imageError: null
	};
	if (!frame_base64) return item;
	if (!geometry.stages.length) {
		item.imageError = 'Image geometry is unavailable.';
		return item;
	}
	const imageBytes =
		Math.ceil((frame_base64.length * 3) / 4) + geometry.width * geometry.height * 4;
	if (imageBytes > IMAGE_BUDGET) {
		item.imageError = 'Image is too large for this viewer.';
		return item;
	}
	try {
		const bytes = Uint8Array.from(atob(frame_base64), (character) => character.charCodeAt(0));
		item.imageUrl = URL.createObjectURL(new Blob([bytes], { type: 'image/jpeg' }));
		item.imageBytes = imageBytes;
	} catch {
		item.imageError = 'Image could not be decoded.';
	}
	return item;
}

export function releasePassage(item: PassageItem) {
	if (item.imageUrl) URL.revokeObjectURL(item.imageUrl);
}

export function confidenceLabel(value: number): string {
	return `${(value * 100).toFixed(1)}%`;
}
