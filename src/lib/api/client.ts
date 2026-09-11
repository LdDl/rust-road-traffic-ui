import type {
	ConfigPatch,
	ConfigView,
	RedisCheckRequest,
	RedisCheckResponse,
	ReplaceZonesResponse,
	RestartRefused,
	SaveTomlResponse,
	StatusResponse,
	TrackingOptions,
	UpdateConfigResponse
} from './types';

export const DEFAULT_TIMEOUT_MS = 5000;

export class ApiError extends Error {
	constructor(
		message: string,
		public readonly status?: number,
		/** The parsed error body, for answers that carry more than a message */
		public readonly payload?: unknown
	) {
		super(message);
		this.name = 'ApiError';
	}
}

interface RequestOptions {
	method?: string;
	body?: unknown;
	signal?: AbortSignal;
	timeoutMs?: number;
	/** Response is read as text instead of JSON, for endpoints like /api/ping */
	asText?: boolean;
}

async function request<T>(baseURL: string, path: string, options: RequestOptions = {}): Promise<T> {
	const { method = 'GET', body, signal, timeoutMs = DEFAULT_TIMEOUT_MS, asText = false } = options;

	// A dead host makes fetch hang until the browser gives up, which is far longer
	// than any polling interval, so every request carries its own deadline
	const timeout = new AbortController();
	const timer = setTimeout(() => timeout.abort(), timeoutMs);
	const onOuterAbort = () => timeout.abort();
	signal?.addEventListener('abort', onOuterAbort);

	try {
		const response = await fetch(`${baseURL}${path}`, {
			method,
			signal: timeout.signal,
			headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
			body: body === undefined ? undefined : JSON.stringify(body)
		});

		if (!response.ok) {
			const { message, payload } = await describeFailure(response);
			throw new ApiError(message, response.status, payload);
		}
		return (asText ? await response.text() : await response.json()) as T;
	} catch (error) {
		if (signal?.aborted) {
			throw error;
		}
		if (error instanceof ApiError) {
			throw error;
		}
		if (error instanceof DOMException && error.name === 'AbortError') {
			throw new ApiError(`No answer within ${timeoutMs} ms`);
		}
		// "Failed to fetch" is what the browser says for a refused connection, a wrong
		// port and a dead host alike, and it explains none of them
		const reason = error instanceof Error ? error.message : 'Request failed';
		throw new ApiError(reason === 'Failed to fetch' ? 'Cannot reach the address' : reason);
	} finally {
		clearTimeout(timer);
		signal?.removeEventListener('abort', onOuterAbort);
	}
}

async function describeFailure(
	response: Response
): Promise<{ message: string; payload?: unknown }> {
	const fallback = `${response.status} ${response.statusText}`.trim();
	try {
		const payload = await response.json();
		const message =
			payload && typeof payload.error_text === 'string' ? payload.error_text : fallback;
		return { message, payload };
	} catch {
		// Not every error answer is JSON, the status line is enough then
		return { message: fallback };
	}
}

export const getStatus = (baseURL: string, signal?: AbortSignal) =>
	request<StatusResponse>(baseURL, '/api/status', { signal });

export const ping = (baseURL: string, signal?: AbortSignal) =>
	request<string>(baseURL, '/api/ping', { signal, timeoutMs: 2000, asText: true });

/** Puts the zones into the running app. The configuration file is not touched */
export const replaceAllZones = (baseURL: string, body: unknown) =>
	request<ReplaceZonesResponse>(baseURL, '/api/mutations/replace_all', { method: 'POST', body });

/** The only call that writes the configuration file: settings in memory plus the live zones */
export const saveToml = (baseURL: string) =>
	request<SaveTomlResponse>(baseURL, '/api/mutations/save_toml');

export const getConfig = (baseURL: string, signal?: AbortSignal) =>
	request<ConfigView>(baseURL, '/api/config', { signal });

/** Changes the settings in memory only. Nothing reaches the file until saveToml */
export const updateConfig = (baseURL: string, patch: ConfigPatch) =>
	request<UpdateConfigResponse>(baseURL, '/api/config', { method: 'PUT', body: patch });

/** The same lists the backend validates against, so the dropdowns never offer a refused value */
export const getTrackingOptions = (baseURL: string, signal?: AbortSignal) =>
	request<TrackingOptions>(baseURL, '/api/tracking/types', { signal });

export type RestartOutcome = { restarted: true } | { restarted: false; refused: RestartRefused };

/**
 * A refusal because of unsaved changes is an answer, not a failure: it carries the
 * current change state, which is what the "save first?" dialog is built from
 */
export async function restartApp(baseURL: string, force = false): Promise<RestartOutcome> {
	const path = force ? '/api/mutations/restart?force=true' : '/api/mutations/restart';
	try {
		await request<{ message: string }>(baseURL, path, { method: 'POST' });
		return { restarted: true };
	} catch (error) {
		if (error instanceof ApiError && error.status === 409 && error.payload) {
			return { restarted: false, refused: error.payload as RestartRefused };
		}
		throw error;
	}
}

/** Always answers 200; ok says whether Redis replied, error says why not */
export const checkRedis = (baseURL: string, body: RedisCheckRequest) =>
	request<RedisCheckResponse>(baseURL, '/api/redis/check', {
		method: 'POST',
		body,
		timeoutMs: 10000
	});
