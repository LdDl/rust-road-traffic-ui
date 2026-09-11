<script lang="ts">
	import { onDestroy } from 'svelte';
	import { changeAPI } from '../store/state';
	import { refreshStatus, status } from '../store/status';
	import { zonesDirty } from '../store/data_storage';
	import { getStatus, restartApp } from '$lib/api/client';
	import { saveAll } from '$lib/save_flow';
	import { registerEscapeLayer } from '$lib/escape_stack';

	type Phase = 'closed' | 'confirm' | 'saving' | 'restarting' | 'waiting' | 'done' | 'failed';

	/** A restart takes a few seconds; past this the device is reported as not back */
	const COME_BACK_TIMEOUT_MS = 90000;
	const ZONES_KEY = 'road_lanes';

	let phase: Phase = 'closed';
	let unsaved: string[] = [];
	let localZones = false;
	let notice: string | null = null;
	let error: string | null = null;
	let waited = 0;
	let closeTimer: ReturnType<typeof setTimeout> | undefined;

	$: atRisk = unsaved.length > 0 || localZones;
	$: listed = [
		...unsaved.map((path) => (path === ZONES_KEY ? 'zones' : path)),
		...(localZones && !unsaved.includes(ZONES_KEY) ? ['zones edited in this browser'] : [])
	];

	export function begin() {
		unsaved = $status?.unsaved_changes ?? [];
		localZones = $zonesDirty;
		notice = null;
		error = null;
		phase = 'confirm';
	}

	function close() {
		if (closeTimer !== undefined) clearTimeout(closeTimer);
		phase = 'closed';
	}

	const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

	function fail(reason: unknown) {
		error = reason instanceof Error ? reason.message : 'Something went wrong';
		phase = 'failed';
	}

	async function saveAndRestart() {
		phase = 'saving';
		try {
			await saveAll($changeAPI);
		} catch (reason) {
			fail(reason);
			return;
		}
		await restart(false);
	}

	async function restart(force: boolean) {
		phase = 'restarting';
		const uptimeBefore = $status?.uptime_seconds ?? Number.POSITIVE_INFINITY;
		const versionBefore = $status?.version;
		try {
			const outcome = await restartApp($changeAPI, force);
			if (!outcome.restarted) {
				// Something was changed on the device between opening this and pressing the button
				unsaved = outcome.refused.unsaved_changes;
				localZones = $zonesDirty;
				notice = 'Something was changed on the device just now. Save it, or restart without it.';
				phase = 'confirm';
				return;
			}
		} catch (reason) {
			fail(reason);
			return;
		}

		// /ping answers the old process too, in the moment before it goes. A smaller uptime
		// or another version is what says the new one is up
		phase = 'waiting';
		const started = Date.now();
		while (Date.now() - started < COME_BACK_TIMEOUT_MS) {
			await sleep(1000);
			waited = Math.round((Date.now() - started) / 1000);
			try {
				const now = await getStatus($changeAPI);
				if (now.uptime_seconds < uptimeBefore || now.version !== versionBefore) {
					phase = 'done';
					refreshStatus();
					closeTimer = setTimeout(close, 2500);
					return;
				}
			} catch {
				// Still down, which is expected for a second or two
			}
		}
		fail(new Error(`The device has not come back in ${COME_BACK_TIMEOUT_MS / 1000} s`));
	}

	// Escape may cancel the question, never a restart that is already under way
	let releaseEscape: (() => void) | undefined;
	function updateEscapeLayer(current: Phase) {
		releaseEscape?.();
		releaseEscape =
			current === 'confirm' || current === 'failed' ? registerEscapeLayer(close) : undefined;
	}
	$: updateEscapeLayer(phase);

	onDestroy(() => {
		releaseEscape?.();
		if (closeTimer !== undefined) clearTimeout(closeTimer);
	});
</script>

{#if phase !== 'closed'}
	<div class="backdrop">
		<div class="dialog" role="dialog" aria-modal="true" aria-labelledby="restart-title">
			{#if phase === 'confirm'}
				<h2 id="restart-title">Restart the device?</h2>
				<p class="lead">
					Processing stops for a few seconds, and the current statistics window starts over.
				</p>

				{#if notice}
					<p class="notice">{notice}</p>
				{/if}

				{#if atRisk}
					<div class="risk">
						<p>
							<strong>Not saved yet.</strong> A restart reads the configuration file, so these would be
							lost:
						</p>
						<ul>
							{#each listed as item}
								<li class="mono">{item}</li>
							{/each}
						</ul>
					</div>
					<div class="buttons">
						<button type="button" class="action-btn primary" on:click={saveAndRestart}>
							Save and restart
						</button>
						<button type="button" class="action-btn danger" on:click={() => restart(true)}>
							Restart without saving
						</button>
						<button type="button" class="action-btn secondary" on:click={close}>Cancel</button>
					</div>
				{:else}
					<div class="buttons">
						<button type="button" class="action-btn primary" on:click={() => restart(false)}>
							Restart
						</button>
						<button type="button" class="action-btn secondary" on:click={close}>Cancel</button>
					</div>
				{/if}
			{:else if phase === 'saving'}
				<h2 id="restart-title">Saving</h2>
				<p class="lead progress">
					<i class="material-icons spin">autorenew</i>Writing the configuration file
				</p>
			{:else if phase === 'restarting' || phase === 'waiting'}
				<h2 id="restart-title">Restarting</h2>
				<p class="lead progress">
					<i class="material-icons spin">autorenew</i>
					{phase === 'restarting'
						? 'Asking the device to restart'
						: `Waiting for the device to come back, ${waited} s`}
				</p>
			{:else if phase === 'done'}
				<h2 id="restart-title">The device is back</h2>
				<p class="lead">Everything shown here has been read again from the new run.</p>
				<div class="buttons">
					<button type="button" class="action-btn primary" on:click={close}>Close</button>
				</div>
			{:else if phase === 'failed'}
				<h2 id="restart-title">Restart did not complete</h2>
				<p class="lead error">{error}</p>
				<div class="buttons">
					<button type="button" class="action-btn secondary" on:click={close}>Close</button>
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--space-lg);
		background: rgba(0, 0, 0, 0.45);
		z-index: 2100;
	}

	.dialog {
		width: 100%;
		max-width: 440px;
		max-height: calc(100vh - 2 * var(--space-lg));
		overflow-y: auto;
		padding: var(--space-xl);
		background: var(--bg-primary);
		border: 1px solid var(--border-primary);
		border-radius: var(--radius-lg);
		box-shadow: 0 var(--space-sm) var(--space-3xl) var(--shadow);
		color: var(--text-primary);
	}

	h2 {
		margin: 0 0 var(--space-sm) 0;
		font-size: var(--text-lg);
		font-weight: 600;
	}

	.lead {
		margin: 0;
		color: var(--text-secondary);
		font-size: var(--text-md);
		line-height: 1.5;
	}

	.lead.error {
		color: var(--danger-primary);
	}

	.progress {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
	}

	.spin {
		font-size: var(--icon-lg);
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.notice {
		margin: var(--space-md) 0 0 0;
		color: var(--warning-text);
		font-size: var(--text-base);
		line-height: 1.45;
	}

	.risk {
		margin-top: var(--space-lg);
		padding: var(--space-md);
		background: var(--warning-bg);
		border: 1px solid var(--warning-border);
		border-radius: var(--radius-md);
		color: var(--warning-text);
		font-size: var(--text-base);
		line-height: 1.45;
	}

	.risk p {
		margin: 0;
	}

	.risk ul {
		margin: var(--space-sm) 0 0 0;
		padding-left: var(--space-lg);
	}

	.mono {
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
	}

	.buttons {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: var(--space-sm);
		margin-top: var(--space-xl);
	}

	/* On a phone the three choices stack, each one wide enough to hit */
	@media (max-width: 480px) {
		.buttons {
			flex-direction: column-reverse;
			align-items: stretch;
		}
	}
</style>
