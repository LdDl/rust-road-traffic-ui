import { writable } from 'svelte/store';
import { browser } from '$app/environment';

/**
 * State of the connection to the backend. It says nothing about what was fetched:
 * the answer itself belongs to whichever store asked for it
 */
export interface PollState {
	error: string | null;
	/** False once a request has failed and no later one has succeeded */
	reachable: boolean;
	/** Failures in a row, resets on any success */
	failures: number;
	lastSuccessAt: number | null;
	/** True while the very first request is still on its way */
	initializing: boolean;
}

export interface PollerOptions {
	intervalMs: number;
	/** Interval ceiling while the backend keeps failing */
	maxIntervalMs?: number;
	/** Stop polling while the tab is in the background, catch up on return */
	pauseWhenHidden?: boolean;
	/** Does the actual request and stores the answer wherever it belongs */
	run: (signal: AbortSignal) => Promise<void>;
}

const emptyState = (): PollState => ({
	error: null,
	reachable: true,
	failures: 0,
	lastSuccessAt: null,
	initializing: true
});

export function createPoller(options: PollerOptions) {
	const { intervalMs, maxIntervalMs = 15000, pauseWhenHidden = true, run } = options;
	const store = writable<PollState>(emptyState());

	let running = false;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let inFlight: AbortController | undefined;

	const clearTimer = () => {
		if (timer !== undefined) {
			clearTimeout(timer);
			timer = undefined;
		}
	};

	const backoffFor = (failures: number) =>
		Math.min(intervalMs * Math.pow(2, Math.max(0, failures - 1)), maxIntervalMs);

	const schedule = (delay: number) => {
		clearTimer();
		if (!running) return;
		timer = setTimeout(tick, delay);
	};

	const tick = async () => {
		if (!running) return;
		if (pauseWhenHidden && browser && document.hidden) {
			// Nothing to do until the tab comes back, visibilitychange restarts us
			return;
		}

		inFlight?.abort();
		const controller = new AbortController();
		inFlight = controller;

		try {
			await run(controller.signal);
			if (controller.signal.aborted || !running) return;
			store.set({
				error: null,
				reachable: true,
				failures: 0,
				lastSuccessAt: Date.now(),
				initializing: false
			});
			schedule(intervalMs);
		} catch (error) {
			if (controller.signal.aborted || !running) return;
			let failures = 0;
			store.update((state) => {
				failures = state.failures + 1;
				return {
					...state,
					error: error instanceof Error ? error.message : 'Request failed',
					reachable: false,
					failures,
					initializing: false
				};
			});
			schedule(backoffFor(failures));
		} finally {
			if (inFlight === controller) {
				inFlight = undefined;
			}
		}
	};

	const onVisibilityChange = () => {
		if (!running) return;
		if (document.hidden) {
			clearTimer();
			inFlight?.abort();
		} else {
			schedule(0);
		}
	};

	return {
		subscribe: store.subscribe,
		start() {
			if (running) return;
			running = true;
			if (pauseWhenHidden && browser) {
				document.addEventListener('visibilitychange', onVisibilityChange);
			}
			schedule(0);
		},
		stop() {
			running = false;
			clearTimer();
			inFlight?.abort();
			inFlight = undefined;
			if (pauseWhenHidden && browser) {
				document.removeEventListener('visibilitychange', onVisibilityChange);
			}
		},
		/** Fetches at once and restarts the interval from now */
		refresh() {
			schedule(0);
		},
		/** Forgets the connection state, for when the poller is pointed at another backend */
		reset() {
			inFlight?.abort();
			inFlight = undefined;
			store.set(emptyState());
			schedule(0);
		}
	};
}
