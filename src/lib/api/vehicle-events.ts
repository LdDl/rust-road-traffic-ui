import type { EventImage } from './types';

export interface BoundingBox {
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface OcrObservation {
	attempt: number;
	confidence: number;
}

export interface OcrAlternative {
	class: string;
	mean_confidence: number;
	observations: OcrObservation[];
}

export interface OcrPosition extends OcrAlternative {
	position: number;
	row: number;
	status: 'agreement' | 'single' | 'conflict';
	bbox: BoundingBox | null;
	alternatives: OcrAlternative[];
}

export interface OcrSummary {
	number: string;
	mean_confidence: number;
	has_conflicts: boolean;
	reference_attempt: number;
	positions: OcrPosition[];
}

export interface VehicleDetection {
	class: string;
	confidence: number;
	bbox: BoundingBox;
}

export interface PlateDetection extends VehicleDetection {
	ocr: OcrSummary | null;
}

export interface VehicleEvent {
	event_id: string;
	type: 'vehicle.passed';
	equipment_id: string;
	track_id: string;
	started_at: string;
	ended_at: string;
	vehicle: VehicleDetection;
	plate: PlateDetection | null;
	frame_type: EventImage;
	frame_base64: string | null;
	frame_width: number;
	frame_height: number;
}

function object(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function unsigned(value: unknown): value is number {
	return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function confidence(value: unknown): boolean {
	return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

function box(value: unknown): boolean {
	return (
		object(value) &&
		unsigned(value.x) &&
		unsigned(value.y) &&
		unsigned(value.width) &&
		unsigned(value.height)
	);
}

function detection(value: unknown): boolean {
	return (
		object(value) &&
		typeof value.class === 'string' &&
		confidence(value.confidence) &&
		box(value.bbox)
	);
}

function alternative(value: unknown): boolean {
	return (
		object(value) &&
		typeof value.class === 'string' &&
		confidence(value.mean_confidence) &&
		Array.isArray(value.observations) &&
		value.observations.every(
			(observation) =>
				object(observation) && unsigned(observation.attempt) && confidence(observation.confidence)
		)
	);
}

function ocr(value: unknown): boolean {
	return (
		object(value) &&
		typeof value.number === 'string' &&
		confidence(value.mean_confidence) &&
		typeof value.has_conflicts === 'boolean' &&
		unsigned(value.reference_attempt) &&
		Array.isArray(value.positions) &&
		value.positions.every(
			(position) =>
				object(position) &&
				alternative(position) &&
				unsigned(position.position) &&
				unsigned(position.row) &&
				typeof position.status === 'string' &&
				['agreement', 'single', 'conflict'].includes(position.status) &&
				(position.bbox === null || box(position.bbox)) &&
				Array.isArray(position.alternatives) &&
				position.alternatives.every(alternative)
		)
	);
}

export function parseVehicleEvent(json: string): VehicleEvent {
	const value: unknown = JSON.parse(json);
	if (
		!object(value) ||
		value.type !== 'vehicle.passed' ||
		!['event_id', 'equipment_id', 'track_id'].every((key) => typeof value[key] === 'string') ||
		!['started_at', 'ended_at'].every(
			(key) => typeof value[key] === 'string' && Number.isFinite(Date.parse(value[key]))
		) ||
		!detection(value.vehicle) ||
		!(
			value.plate === null ||
			(object(value.plate) &&
				detection(value.plate) &&
				(value.plate.ocr === null || ocr(value.plate.ocr)))
		) ||
		typeof value.frame_type !== 'string' ||
		!['', 'full', 'vehicle', 'plate'].includes(value.frame_type) ||
		!(value.frame_base64 === null || typeof value.frame_base64 === 'string') ||
		!unsigned(value.frame_width) ||
		!unsigned(value.frame_height)
	) {
		throw new Error('Unsupported vehicle event');
	}
	return value as unknown as VehicleEvent;
}
