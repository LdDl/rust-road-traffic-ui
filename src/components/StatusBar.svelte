<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import Hint from './Hint.svelte';
	import { acquireStatus, connection, droppedDelta, lastRestartAt, status } from '../store/status';
	import { changeAPI } from '../store/state';
	import { copyText } from '$lib/clipboard';
	import { registerEscapeLayer } from '$lib/escape_stack';
	import {
		formatCount,
		formatFps,
		formatMs,
		formatTimestamp,
		formatUptime,
		maskCredentials
	} from '$lib/format';

	/** How long a restart stays announced in the header after it was noticed */
	const RESTART_NOTICE_MS = 20000;
	/** How long the equipment id reads "copied" before going back to the id itself */
	const COPIED_NOTICE_MS = 2000;

	let release: (() => void) | undefined;
	let barHeight = 0;
	let detailsOpen = false;
	let showVideoSrc = false;
	let now = Date.now();
	let ticker: ReturnType<typeof setInterval> | undefined;
	let copyResult: 'copied' | 'failed' | null = null;
	let copyTimer: ReturnType<typeof setTimeout> | undefined;

	onMount(() => {
		release = acquireStatus();
		ticker = setInterval(() => (now = Date.now()), 1000);
	});

	onDestroy(() => {
		release?.();
		releaseEscape?.();
		if (ticker !== undefined) clearInterval(ticker);
		if (copyTimer !== undefined) clearTimeout(copyTimer);
	});

	const copyEquipmentId = async () => {
		if (!state) return;
		const done = await copyText(state.equipment_id);
		copyResult = done ? 'copied' : 'failed';
		if (copyTimer !== undefined) clearTimeout(copyTimer);
		copyTimer = setTimeout(() => (copyResult = null), COPIED_NOTICE_MS);
	};

	$: state = $status;
	$: input = state?.input;
	$: detection = state?.detection;

	$: connecting = $connection.initializing && state === null;
	$: online = $connection.reachable && state !== null;
	$: stale = !$connection.reachable && state !== null;

	$: connectionText = connecting ? 'Connecting' : online ? 'Connected' : 'Unreachable';
	$: connectionTitle = $connection.error
		? `${$changeAPI} is not answering: ${$connection.error}`
		: `Polling ${$changeAPI}`;

	// Only every N-th decoded frame is meant to be processed, so the honest target
	// is the source rate divided by that step, not the source rate itself
	$: targetFps =
		input && input.fps > 0 && input.process_every_nth_frame > 0
			? input.fps / input.process_every_nth_frame
			: null;
	$: isLive = input?.kind === 'live';
	$: fpsBehind =
		isLive &&
		targetFps !== null &&
		input?.processing_fps !== null &&
		input?.processing_fps !== undefined &&
		input.processing_fps < targetFps * 0.9;

	$: dropping = $droppedDelta > 0;
	$: restartNoticeVisible = $lastRestartAt !== null && now - $lastRestartAt < RESTART_NOTICE_MS;
	$: pendingChanges = state?.pending_changes ?? [];
	$: problem = state?.last_problem ?? null;
	$: problemIsError = (problem?.level ?? '').toUpperCase() === 'ERROR';
	$: lastAnswerAgo =
		$connection.lastSuccessAt === null
			? null
			: Math.max(0, Math.round((now - $connection.lastSuccessAt) / 1000));

	const toggleDetails = () => (detailsOpen = !detailsOpen);
	const openDetails = () => (detailsOpen = true);

	let releaseEscape: (() => void) | undefined;

	function updateEscapeLayer(open: boolean) {
		releaseEscape?.();
		releaseEscape = open ? registerEscapeLayer(() => (detailsOpen = false)) : undefined;
	}

	$: updateEscapeLayer(detailsOpen);
</script>

<header class="status-bar" bind:clientHeight={barHeight}>
	<div class="segment identity">
		<span
			class="connection"
			class:online
			class:offline={!online && !connecting}
			class:connecting
			title={connectionTitle}
		>
			<span class="dot"></span>
			<span class="connection-text">{connectionText}</span>
		</span>

		<span class="divider"></span>

		{#if state}
			<button
				type="button"
				class="chip chip-button"
				title="Equipment id, it identifies this installation point. Click to copy"
				aria-label="Copy the equipment id"
				on:click={copyEquipmentId}
			>
				<span class="chip-label">id</span>
				<!-- The id stays in place while the notice sits on top of it, so nothing shifts -->
				<span class="value-slot">
					<span class="chip-value mono truncate" class:muted={copyResult !== null}>
						{state.equipment_id}
					</span>
					{#if copyResult !== null}
						<span class="copy-notice" class:failed={copyResult === 'failed'} aria-live="polite">
							{copyResult === 'copied' ? 'copied' : 'copy failed'}
						</span>
					{/if}
				</span>
			</button>

			<span class="chip version" title="Version of the running binary">
				<span class="chip-value mono">v{state.version}</span>
			</span>
		{:else}
			<!-- Nothing has ever answered here, so the address is the useful thing to show -->
			<span class="chip address-chip" title="Change it in Settings, top right">
				<span class="chip-value mono truncate address">{$changeAPI}</span>
			</span>
			{#if $connection.error}
				<span class="connection-error truncate" title={$connection.error}>{$connection.error}</span>
			{/if}
		{/if}
	</div>

	<div class="segment metrics" class:stale class:hidden={state === null}>
		<span
			class="metric"
			class:warn={fpsBehind}
			title="Processed frames per second against the target rate"
		>
			<i class="material-icons">speed</i>
			<span class="metric-value mono">
				{formatFps(input?.processing_fps)}<span class="metric-of">/{formatFps(targetFps)}</span>
			</span>
			<span class="metric-label">fps</span>
			<Hint
				text="How many frames per second the detector actually keeps up with, next to the rate it should reach. That target is the source frame rate divided by how often a frame is taken for processing. Staying below it on a live source means the device is not keeping up."
			/>
		</span>

		<span class="metric" class:warn={dropping} title="Frames the detector never got to">
			<i class="material-icons">layers_clear</i>
			<span class="metric-value mono">
				{formatCount(input?.frames_dropped)}{#if dropping}<span class="metric-delta"
						>+{$droppedDelta}</span
					>{/if}
			</span>
			<span class="metric-label">dropped</span>
			<Hint
				text={isLive
					? 'Frames that arrived while the detector was still busy and were thrown away. A number that keeps growing means the device cannot process the stream at this rate.'
					: 'Frames thrown away because the detector was busy. Always 0 for a video file: a file waits, a camera does not.'}
			/>
		</span>

		<span class="metric uptime" title="Time since the process started">
			<i class="material-icons">schedule</i>
			<span class="metric-value mono">{formatUptime(state?.uptime_seconds)}</span>
			<span class="metric-label">uptime</span>
		</span>
	</div>

	<div class="segment actions">
		{#if restartNoticeVisible}
			<span class="badge neutral" title="The process restarted, everything runtime started over">
				<i class="material-icons">autorenew</i>
				<span class="badge-text">Restarted</span>
			</span>
		{/if}

		{#if state?.restart_required}
			<button
				type="button"
				class="badge warn"
				on:click={openDetails}
				title="Saved settings differ from the ones this run started with"
			>
				<i class="material-icons">restart_alt</i>
				<span class="badge-text">Restart required</span>
				{#if pendingChanges.length > 0}<span class="badge-count">{pendingChanges.length}</span>{/if}
			</button>
		{/if}

		{#if problem}
			<button
				type="button"
				class="badge"
				class:danger={problemIsError}
				class:warn={!problemIsError}
				on:click={openDetails}
				title={problem.message}
			>
				<i class="material-icons">{problemIsError ? 'error_outline' : 'warning_amber'}</i>
				<span class="badge-text">{problemIsError ? 'Error' : 'Warning'}</span>
			</button>
		{/if}

		<button
			type="button"
			class="details-toggle"
			class:active={detailsOpen}
			aria-expanded={detailsOpen}
			aria-label={detailsOpen ? 'Hide details' : 'Show details'}
			on:click={toggleDetails}
		>
			<i class="material-icons">{detailsOpen ? 'expand_less' : 'expand_more'}</i>
		</button>
	</div>
</header>

{#if detailsOpen}
	<button
		type="button"
		class="details-backdrop"
		aria-label="Close details"
		style="top: {barHeight}px;"
		on:click={() => (detailsOpen = false)}
	></button>

	<section class="details" style="top: {barHeight}px;">
		<p class="details-note">
			Everything here is what the process is doing right now. Settings live in the configuration
			file and most of them are read once, at startup, so a saved change shows up only after a
			restart.
		</p>

		<div class="details-grid">
			<article class="card">
				<h3>Connection</h3>
				<dl>
					<dt>Address</dt>
					<dd class="mono">{$changeAPI}</dd>
					<dt>State</dt>
					<dd>{connectionText}</dd>
					<dt>Last answer</dt>
					<dd>{lastAnswerAgo === null ? 'never' : `${lastAnswerAgo} s ago`}</dd>
					{#if $connection.error}
						<dt>Error</dt>
						<dd class="problem">{$connection.error}</dd>
						<dt>Failed attempts</dt>
						<dd>{$connection.failures}</dd>
					{/if}
				</dl>
			</article>

			{#if state && input}
				<article class="card">
					<h3>Source</h3>
					<dl>
						<dt>Address</dt>
						<dd class="mono wrap">
							{showVideoSrc ? input.video_src : maskCredentials(input.video_src)}
							{#if input.video_src !== maskCredentials(input.video_src)}
								<button
									type="button"
									class="inline-toggle"
									on:click={() => (showVideoSrc = !showVideoSrc)}
								>
									{showVideoSrc ? 'hide' : 'show'}
								</button>
							{/if}
						</dd>
						<dt>Kind</dt>
						<dd>{input.kind}</dd>
						<dt>Frame</dt>
						<dd class="mono">{input.width} x {input.height}</dd>
						<dt>Source rate</dt>
						<dd class="mono">{formatFps(input.fps)} fps</dd>
						<dt>Processing every</dt>
						<dd class="mono">{input.process_every_nth_frame} frame</dd>
						<dt>Target rate</dt>
						<dd class="mono">{formatFps(targetFps)} fps</dd>
						<dt>Processing rate</dt>
						<dd class="mono" class:problem={fpsBehind}>{formatFps(input.processing_fps)} fps</dd>
						<dt>Frames processed</dt>
						<dd class="mono">{formatCount(input.frames_processed)}</dd>
						<dt>Frames dropped</dt>
						<dd class="mono" class:problem={dropping}>{formatCount(input.frames_dropped)}</dd>
						{#if input.kind === 'file'}
							<dt>Frames in file</dt>
							<dd class="mono">{formatCount(input.total_frames)}</dd>
						{/if}
						<dt title="Seconds since capture started">Last frame at</dt>
						<dd class="mono">
							{input.last_frame_at === null || input.last_frame_at === undefined
								? 'n/a'
								: `${input.last_frame_at.toFixed(1)} s`}
						</dd>
					</dl>
				</article>

				<article class="card">
					<h3>Detection</h3>
					<dl>
						<dt>Backend</dt>
						<dd>{detection?.backend}</dd>
						<dt>CUDA</dt>
						<dd>{detection?.cuda_available ? 'available' : 'not available'}</dd>
						<dt>Model</dt>
						<dd class="mono wrap">{detection?.model}</dd>
						{#if detection?.net_width && detection?.net_height}
							<dt>Network input</dt>
							<dd class="mono">{detection.net_width} x {detection.net_height}</dd>
						{/if}
						<dt>Inference</dt>
						<dd class="mono">{formatMs(detection?.inference_ms)}</dd>
						<dt>Postprocess</dt>
						<dd class="mono">{formatMs(detection?.postprocess_ms)}</dd>
						<dt>Tracking</dt>
						<dd class="mono">{formatMs(detection?.tracking_ms)}</dd>
					</dl>
				</article>

				<article class="card">
					<h3>Tracking</h3>
					<p class="card-text">{state.tracking.description}</p>
				</article>

				<article class="card">
					<h3>Redis</h3>
					<dl>
						<dt>State</dt>
						<dd>{state.redis.enabled ? 'enabled' : 'disabled'}</dd>
						<dt>Host</dt>
						<dd class="mono">{state.redis.host}:{state.redis.port}</dd>
						<dt>Channel</dt>
						<dd class="mono">{state.redis.channel}</dd>
					</dl>
				</article>

				<article class="card">
					<h3>Logging</h3>
					<dl>
						<dt>Level</dt>
						<dd>{state.logging.level}</dd>
						<dt>File</dt>
						<dd class="mono wrap">{state.logging.file ?? 'stdout only'}</dd>
					</dl>
				</article>

				{#if state.restart_required}
					<article class="card attention">
						<h3>Waiting for a restart</h3>
						<p class="card-text">
							These settings are saved in the configuration file but the running process still uses
							the previous ones.
						</p>
						{#if pendingChanges.length > 0}
							<ul class="change-list">
								{#each pendingChanges as change}
									<li class="mono">{change}</li>
								{/each}
							</ul>
						{/if}
					</article>
				{/if}

				{#if problem}
					<article class="card" class:attention={!problemIsError} class:alarm={problemIsError}>
						<h3>Last problem</h3>
						<dl>
							<dt>Level</dt>
							<dd>{problem.level}</dd>
							{#if problem.scope}
								<dt>Scope</dt>
								<dd class="mono">{problem.scope}</dd>
							{/if}
							<dt>At</dt>
							<dd class="mono">{formatTimestamp(problem.at)}</dd>
						</dl>
						<p class="card-text problem">{problem.message}</p>
					</article>
				{/if}
			{/if}
		</div>
	</section>
{/if}

<style>
	.status-bar {
		display: flex;
		align-items: center;
		gap: var(--space-md);
		flex: 0 0 auto;
		height: var(--statusbar-height);
		padding: 0 var(--space-md);
		background: var(--bg-secondary);
		border-bottom: 1px solid var(--border-primary);
		color: var(--text-primary);
		font-size: var(--text-sm);
		line-height: 1;
		user-select: none;
		overflow: hidden;
		z-index: 1003;
	}

	.segment {
		display: flex;
		align-items: center;
		gap: var(--space-md);
		min-width: 0;
	}

	/* Both sides claim the same share, so the metrics stay put when a badge appears */
	.identity {
		flex: 1 1 0;
	}

	.metrics {
		flex: 0 0 auto;
		transition: opacity 0.2s ease;
	}

	.metrics.stale {
		opacity: 0.45;
	}

	.actions {
		flex: 1 1 0;
		justify-content: flex-end;
		gap: var(--space-sm);
	}

	.divider {
		width: 1px;
		height: 16px;
		background: var(--border-primary);
	}

	.connection {
		display: inline-flex;
		align-items: center;
		gap: var(--space-sm);
		flex: 0 0 auto;
	}

	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--text-secondary);
		flex: 0 0 auto;
	}

	.connection.online .dot {
		background: var(--success-primary);
	}

	.connection.offline .dot {
		background: var(--danger-primary);
	}

	.connection.connecting .dot {
		animation: pulse 1.2s ease-in-out infinite;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 0.3;
		}
		50% {
			opacity: 1;
		}
	}

	.connection-text {
		font-weight: 500;
	}

	.connection.offline .connection-text {
		color: var(--danger-primary);
	}

	.connection-error {
		color: var(--text-secondary);
		max-width: 40ch;
	}

	.metrics.hidden {
		display: none;
	}

	.chip {
		display: inline-flex;
		/* Not baseline: the truncated value is an overflow box, whose baseline is its
		   bottom edge, which would lift the whole chip above the rest of the bar */
		align-items: center;
		gap: var(--space-xs);
		min-width: 0;
		color: var(--text-secondary);
	}

	.chip-button {
		padding: 0 var(--space-xs);
		margin: 0 calc(-1 * var(--space-xs));
		height: 22px;
		border: none;
		border-radius: var(--radius-sm);
		background: none;
		font: inherit;
		cursor: pointer;
	}

	.chip-button:hover {
		background: var(--bg-tertiary);
	}

	.value-slot {
		position: relative;
		display: inline-flex;
		align-items: center;
		min-width: 0;
	}

	.chip-value.muted {
		visibility: hidden;
	}

	.copy-notice {
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		display: flex;
		align-items: center;
		color: var(--success-primary);
		font-weight: 500;
		white-space: nowrap;
	}

	.copy-notice.failed {
		color: var(--danger-primary);
	}

	.chip-label {
		font-size: var(--text-2xs);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.chip-value {
		color: var(--text-primary);
	}

	.truncate {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 22ch;
	}

	.address {
		max-width: 32ch;
	}

	.mono {
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
		font-variant-numeric: tabular-nums;
	}

	.metric {
		display: inline-flex;
		align-items: center;
		gap: var(--space-xs);
		color: var(--text-secondary);
	}

	.metric i {
		font-size: var(--icon-sm);
		opacity: 0.7;
	}

	.metric-value {
		color: var(--text-primary);
		font-weight: 500;
	}

	.metric-of {
		color: var(--text-secondary);
		font-weight: 400;
	}

	.metric-delta {
		margin-left: var(--space-2xs);
		color: var(--warning-text);
		font-weight: 600;
	}

	.metric-label {
		font-size: var(--text-2xs);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.metric.warn i,
	.metric.warn .metric-value {
		color: var(--warning-text);
	}

	.badge {
		display: inline-flex;
		align-items: center;
		gap: var(--space-xs);
		height: 22px;
		padding: 0 var(--space-sm);
		border: 1px solid transparent;
		border-radius: var(--radius-sm);
		background: var(--bg-tertiary);
		color: var(--text-primary);
		font-size: var(--text-xs);
		font-weight: 500;
		cursor: pointer;
		white-space: nowrap;
	}

	.badge i {
		font-size: var(--icon-xs);
	}

	.badge.neutral {
		cursor: default;
	}

	.badge.warn {
		background: var(--warning-bg);
		border-color: var(--warning-border);
		color: var(--warning-text);
	}

	.badge.danger {
		background: var(--danger-bg);
		border-color: var(--danger-primary);
		color: var(--danger-primary);
	}

	.badge-count {
		padding: 0 var(--space-xs);
		border-radius: var(--radius-xs);
		background: rgba(127, 127, 127, 0.28);
		font-variant-numeric: tabular-nums;
	}

	.details-toggle {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		padding: 0;
		border: none;
		border-radius: var(--radius-sm);
		background: none;
		color: var(--text-secondary);
		cursor: pointer;
	}

	.details-toggle:hover,
	.details-toggle.active {
		background: var(--bg-tertiary);
		color: var(--text-primary);
	}

	.details-toggle i {
		font-size: var(--icon-md);
	}

	.details-backdrop {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		border: none;
		background: transparent;
		cursor: default;
		z-index: 1100;
	}

	/* Fixed because the app shell clips overflow, and the panel must not push the workspace down */
	.details {
		position: fixed;
		left: 0;
		right: 0;
		max-height: 60vh;
		overflow-y: auto;
		padding: var(--space-lg);
		background: var(--bg-secondary);
		border-bottom: 1px solid var(--border-primary);
		box-shadow: 0 var(--space-sm) var(--space-lg) var(--shadow);
		z-index: 1101;
	}

	.details-note {
		margin: 0 0 var(--space-lg) 0;
		max-width: 80ch;
		color: var(--text-secondary);
		font-size: var(--text-sm);
		line-height: 1.5;
	}

	.details-grid {
		display: grid;
		/* min() keeps the track from forcing the panel wider than a phone screen */
		grid-template-columns: repeat(auto-fill, minmax(min(260px, 100%), 1fr));
		gap: var(--space-md);
		align-items: start;
	}

	.card {
		min-width: 0;
		padding: var(--space-md);
		background: var(--bg-primary);
		border: 1px solid var(--border-primary);
		border-radius: var(--radius-md);
	}

	.card.attention {
		border-color: var(--warning-border);
		background: var(--warning-bg);
	}

	.card.alarm {
		border-color: var(--danger-primary);
		background: var(--danger-bg);
	}

	.card h3 {
		margin: 0 0 var(--space-sm) 0;
		font-size: var(--text-xs);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-secondary);
	}

	.card-text {
		margin: 0;
		font-size: var(--text-sm);
		line-height: 1.5;
	}

	.card dl {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		gap: var(--space-xs) var(--space-md);
		margin: 0;
		font-size: var(--text-sm);
	}

	.card dt {
		color: var(--text-secondary);
		white-space: nowrap;
	}

	.card dd {
		margin: 0;
		text-align: right;
		min-width: 0;
		overflow-wrap: anywhere;
	}

	.card dd.wrap {
		text-align: left;
	}

	.problem {
		color: var(--danger-primary);
	}

	.card .card-text.problem {
		margin-top: var(--space-sm);
	}

	.inline-toggle {
		margin-left: var(--space-xs);
		padding: 0;
		border: none;
		background: none;
		color: var(--accent-primary);
		font-size: var(--text-xs);
		cursor: pointer;
		text-decoration: underline;
	}

	.change-list {
		margin: var(--space-sm) 0 0 0;
		padding-left: var(--space-lg);
		font-size: var(--text-sm);
	}

	@media (max-width: 1024px) {
		.status-bar {
			gap: var(--space-sm);
			padding: 0 var(--space-sm);
		}

		/* Badges and the details toggle keep their width, the identity gives way instead */
		.identity {
			flex: 1 1 auto;
		}

		.actions {
			flex: 0 0 auto;
		}

		.chip.version,
		.divider,
		.connection-error,
		.metric-label {
			display: none;
		}

		.truncate {
			max-width: 12ch;
		}

		.badge-text {
			display: none;
		}

		.badge {
			padding: 0 var(--space-xs);
		}
	}

	@media (max-width: 640px) {
		.connection-text,
		.chip:not(.address-chip),
		.metric.uptime {
			display: none;
		}
	}
</style>
