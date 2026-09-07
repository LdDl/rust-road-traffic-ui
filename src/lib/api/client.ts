import type { StatusResponse } from './types';

export const DEFAULT_TIMEOUT_MS = 5000;

export class ApiError extends Error {
	constructor(
		message: string,
		public readonly status?: number
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
			throw new ApiError(await describeFailure(response), response.status);
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

async function describeFailure(response: Response): Promise<string> {
	try {
		const payload = await response.json();
		if (payload && typeof payload.error_text === 'string') {
			return payload.error_text;
		}
	} catch {
		// Not every error answer is JSON, the status line is enough then
	}
	return `${response.status} ${response.statusText}`.trim();
}

export const getStatus = (baseURL: string, signal?: AbortSignal) =>
	request<StatusResponse>(baseURL, '/api/status', { signal });

export const ping = (baseURL: string, signal?: AbortSignal) =>
	request<string>(baseURL, '/api/ping', { signal, timeoutMs: 2000, asText: true });
