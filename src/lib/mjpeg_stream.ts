/**
 * Reads an MJPEG stream frame by frame instead of handing the URL to an <img>.
 *
 * An <img> fires `load` once for the whole multipart response, not per frame, so
 * nothing in the page can tell a live stream from one that quietly ended: the last
 * frame simply stays on screen. Reading the body here gives the arrival time of
 * every frame, which is what makes noticing a stall and reconnecting possible.
 */

export type StreamState = 'connecting' | 'playing' | 'stalled';

export interface MjpegPlayer {
	stop(): void;
}

/** No frame for this long means the stream is gone, whatever the socket thinks */
const DEFAULT_STALL_MS = 6000;
const RECONNECT_START_MS = 500;
const RECONNECT_MAX_MS = 5000;
/** A buffer larger than this holds something that is not a frame, so it is dropped */
const BUFFER_LIMIT = 8 * 1024 * 1024;

const CRLF_CRLF = new Uint8Array([13, 10, 13, 10]);

/** What a stream reader hands over, which is not always backed by a plain ArrayBuffer */
type Bytes = Uint8Array<ArrayBufferLike>;

export function playMjpeg(
	url: string,
	onFrame: (objectUrl: string) => void,
	onState: (state: StreamState) => void = () => {},
	stallMs: number = DEFAULT_STALL_MS
): MjpegPlayer {
	let stopped = false;
	let controller: AbortController | undefined;
	let retryTimer: ReturnType<typeof setTimeout> | undefined;
	let lastFrameAt = Date.now();
	let attempt = 0;
	let current: StreamState = 'connecting';

	/**
	 * Only real changes reach the caller, and a stream already known to be gone is not
	 * downgraded back to "connecting" by each retry: the text would flip every second
	 */
	function report(next: StreamState) {
		if (next === current) return;
		if (current === 'stalled' && next === 'connecting') return;
		current = next;
		onState(next);
	}

	const watchdog = setInterval(() => {
		// A hidden tab is throttled, not broken: the browser stops handing over frames
		if (stopped || document.hidden) return;
		if (Date.now() - lastFrameAt > stallMs) {
			report('stalled');
			// Aborting ends the read below, and the catch there reconnects
			controller?.abort();
		}
	}, 1000);

	function reconnectLater() {
		if (stopped) return;
		attempt += 1;
		const delay = Math.min(RECONNECT_START_MS * 2 ** (attempt - 1), RECONNECT_MAX_MS);
		retryTimer = setTimeout(connect, delay);
	}

	async function connect() {
		if (stopped) return;
		report('connecting');
		controller = new AbortController();
		try {
			const response = await fetch(url, { signal: controller.signal, cache: 'no-store' });
			if (!response.ok || !response.body) {
				throw new Error(`The stream answered ${response.status}`);
			}
			const boundary = boundaryOf(response.headers.get('content-type'));
			lastFrameAt = Date.now();
			attempt = 0;
			report('playing');
			await readFrames(response.body.getReader(), boundary);
		} catch {
			// Aborted on purpose, refused, or cut off: reconnecting covers all three
		}
		reconnectLater();
	}

	async function readFrames(reader: ReadableStreamDefaultReader<Bytes>, boundary: Bytes) {
		let buffer: Bytes = new Uint8Array(0);
		while (!stopped) {
			const { done, value } = await reader.read();
			if (done) return;
			if (!value) continue;
			buffer = concat(buffer, value);

			// One chunk can carry several frames, or a part of one
			for (;;) {
				const start = indexOf(buffer, boundary, 0);
				if (start < 0) break;
				const headerEnd = indexOf(buffer, CRLF_CRLF, start);
				if (headerEnd < 0) break;
				const header = new TextDecoder().decode(buffer.subarray(start, headerEnd));
				const length = contentLengthOf(header);
				if (length === null) break;
				const bodyStart = headerEnd + CRLF_CRLF.length;
				if (buffer.length < bodyStart + length) break;

				const frame = buffer.slice(bodyStart, bodyStart + length);
				buffer = buffer.slice(bodyStart + length);
				lastFrameAt = Date.now();
				report('playing');
				onFrame(URL.createObjectURL(new Blob([frame], { type: 'image/jpeg' })));
			}

			if (buffer.length > BUFFER_LIMIT) buffer = new Uint8Array(0);
		}
	}

	connect();

	return {
		stop() {
			stopped = true;
			clearInterval(watchdog);
			if (retryTimer !== undefined) clearTimeout(retryTimer);
			controller?.abort();
		}
	};
}

function boundaryOf(contentType: string | null): Bytes {
	const found = /boundary=("?)([^";]+)\1/i.exec(contentType ?? '');
	const name = found ? found[2].trim() : 'boundarydonotcross';
	return new TextEncoder().encode(`--${name}`);
}

function contentLengthOf(header: string): number | null {
	const found = /content-length:\s*(\d+)/i.exec(header);
	return found ? Number(found[1]) : null;
}

function concat(left: Bytes, right: Bytes): Bytes {
	if (left.length === 0) return right;
	const joined = new Uint8Array(left.length + right.length);
	joined.set(left, 0);
	joined.set(right, left.length);
	return joined;
}

function indexOf(haystack: Bytes, needle: Bytes, from: number): number {
	for (let at = from; at <= haystack.length - needle.length; at += 1) {
		if (matchesAt(haystack, needle, at)) return at;
	}
	return -1;
}

function matchesAt(haystack: Bytes, needle: Bytes, at: number): boolean {
	for (let offset = 0; offset < needle.length; offset += 1) {
		if (haystack[at + offset] !== needle[offset]) return false;
	}
	return true;
}
