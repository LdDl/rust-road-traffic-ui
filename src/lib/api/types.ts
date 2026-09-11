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

/**
 * What the running app holds against the configuration file. The same block comes
 * back from /status and from every mutation, and it covers everything accumulated so
 * far, not only the last request. Only save_toml writes the file, and a restart
 * rereads it, so anything unsaved is lost on restart
 */
export interface ChangeState {
	save_required: boolean;
	/** Dotted paths that differ from the file; "road_lanes" stands for the zones */
	unsaved_changes: string[];
	/** True as soon as a change needs a restart, even before it is saved */
	restart_required: boolean;
	/** Dotted paths that take effect only after a restart */
	pending_changes: string[];
}

export interface StatusResponse extends ChangeState {
	equipment_id: string;
	version: string;
	uptime_seconds: number;
	input: InputStatus;
	detection: DetectionStatus;
	tracking: TrackingStatus;
	redis: RedisStatus;
	logging: LoggingStatus;
	last_problem?: LoggedProblem | null;
}

export interface SaveTomlResponse extends ChangeState {
	message: string;
}

export interface ReplaceZonesResponse extends ChangeState {
	zones_ids: string[];
}

export interface ConfigView {
	equipment_info: { id: string };
	input: { video_src: string; process_every_nth_frame: number };
	tracking: {
		type: string;
		kalman_filter: string;
		max_lost_seconds: number | null;
		max_no_match: number | null;
		max_points_in_track: number;
		iou_threshold: number | null;
	};
	worker: { reset_data_milliseconds: number };
	redis_publisher: {
		enable: boolean;
		host: string;
		port: number;
		username: string | null;
		db_index: number;
		channel_name: string;
		password: string;
	};
	verbose: {
		level: string | null;
		logs_folder: string | null;
		max_file_size_mb: number | null;
		max_files: number | null;
	};
}

/**
 * A key left out is not touched. The schema marks every key nullable, but null means
 * "clear" only for the ones typed with `| null` here; elsewhere it is not a value to send
 */
export interface ConfigPatch {
	equipment_info?: { id?: string };
	input?: { video_src?: string; process_every_nth_frame?: number };
	tracking?: {
		type?: string;
		kalman_filter?: string;
		/** null clears it, and max_no_match takes over */
		max_lost_seconds?: number | null;
		max_no_match?: number | null;
		max_points_in_track?: number;
		/** null puts the default back */
		iou_threshold?: number | null;
	};
	worker?: { reset_data_milliseconds?: number };
	redis_publisher?: {
		enable?: boolean;
		host?: string;
		port?: number;
		/** null goes back to the default user */
		username?: string | null;
		db_index?: number;
		channel_name?: string;
		password?: string;
	};
	verbose?: {
		level?: string | null;
		logs_folder?: string | null;
		max_file_size_mb?: number | null;
		max_files?: number | null;
	};
}

export interface UpdateConfigResponse extends ChangeState {
	message: string;
	/** What this request actually changed; empty means nothing was different */
	changed: string[];
}

export interface TrackingOptions {
	tracker_types: string[];
	kalman_filters: string[];
}

/** The answer to a restart asked for while something is unsaved */
export interface RestartRefused extends ChangeState {
	error_text: string;
}

/** Anything left out falls back to the saved configuration, so an empty body checks what is configured */
export interface RedisCheckRequest {
	host?: string;
	port?: number;
	username?: string | null;
	password?: string;
	db_index?: number;
}

export interface RedisCheckResponse {
	ok: boolean;
	/** Where it tried, without the password */
	target: string;
	took_ms: number;
	/** Why it did not work, null when it did */
	error?: string | null;
}
