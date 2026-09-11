// Mirrors the schemas in swagger.json. Everything the backend marks nullable is
// optional here as well, so a missing key and an explicit null read the same way.

export interface InputStatus {
	video_src: string;
	/** "live" for a camera or a stream, "file" for a video file */
	kind: string;
	width: number;
	height: number;
	fps: number;
	/** Frames in the file, -1 for a live source */
	total_frames: number;
	process_every_nth_frame: number;
	frames_processed: number;
	/** Always 0 for a file source: only a live source can outrun the detector */
	frames_dropped: number;
	processing_fps?: number | null;
	last_frame_at?: number | null;
}

/**
 * Only what can be observed while the app runs. Which model is loaded is chosen
 * when the device is assembled and changed over SSH, so the API does not report
 * it at all: it is not absent by accident and will not come back
 */
export interface DetectionStatus {
	cuda_available: boolean;
	inference_ms?: number | null;
	postprocess_ms?: number | null;
	tracking_ms?: number | null;
}

export interface TrackingStatus {
	description: string;
}

export interface RedisStatus {
	enabled: boolean;
	host: string;
	port: number;
	channel: string;
}

export interface LoggingStatus {
	/** "info" or "debug" */
	level: string;
	file?: string | null;
}

export interface LoggedProblem {
	/** "WARN" or "ERROR" */
	level: string;
	message: string;
	/** RFC 3339 */
	at: string;
	scope?: string | null;
}

export interface StatusResponse {
	equipment_id: string;
	version: string;
	uptime_seconds: number;
	input: InputStatus;
	detection: DetectionStatus;
	tracking: TrackingStatus;
	redis: RedisStatus;
	logging: LoggingStatus;
	last_problem?: LoggedProblem | null;
	restart_required: boolean;
	/** Dotted paths of saved settings waiting for a restart, e.g. "input.video_src" */
	pending_changes: string[];
}
