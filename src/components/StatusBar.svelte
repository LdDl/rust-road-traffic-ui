<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import Hint from './Hint.svelte';
	import NavTabs from './NavTabs.svelte';
	import { TABS } from '../store/navigation';
	import SettingsPanel from './SettingsPanel.svelte';
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
		splitAtSeparators
	} from '$lib/format';

	/** How long a restart stays announced in the header after it was noticed */
	const RESTART_NOTICE_MS = 20000;
	/** The backend reports the zones as one dotted path, which means nothing to a person */
	const ZONES_KEY = 'road_lanes';
	const describeChange = (path: string) => (path === ZONES_KEY ? 'zones' : path);

	/** How long the equipment id reads "copied" before going back to the id itself */
	const COPIED_NOTICE_MS = 2000;

	let release: (() => void) | undefined;
	let barHeight = 0;
	let detailsOpen = false;
	let settingsOpen = false;
	/** Detection, tracking, Redis and logging are fixed at startup, so they stay folded away */
	let configOpen = false;
	let detailsEl: HTMLElement | undefined;
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
	// No CUDA means the detector fell back to the processor, the usual reason an
	// otherwise healthy install cannot keep up with its camera
	$: onCpu = state !== null && detection?.cuda_available === false;
	$: restartNoticeVisible = $lastRestartAt !== null && now - $lastRestartAt < RESTART_NOTICE_MS;
	$: unsavedChanges = state?.unsaved_changes ?? [];
	$: pendingChanges = state?.pending_changes ?? [];
	// A restart rereads the file, so it would throw away whatever is not saved yet.
	// The header therefore asks for a save first and only then for a restart
	$: saveFirst = state?.save_required === true;
	$: waitingForRestart = pendingChanges.filter((path) => !unsavedChanges.includes(path));
	$: problem = state?.last_problem ?? null;
	$: problemIsError = (problem?.level ?? '').toUpperCase() === 'ERROR';
	$: lastAnswerAgo =
		$connection.lastSuccessAt === null
			? null
			: Math.max(0, Math.round((now - $connection.lastSuccessAt) / 1000));

	// The two panels share the strip under the header, so only one of them is up at a time
	const toggleDetails = () => {
		detailsOpen = !detailsOpen;
		if (detailsOpen) settingsOpen = false;
	};
	const openDetails = () => {
		detailsOpen = true;
		settingsOpen = false;
	};
	const toggleSettings = () => {
		settingsOpen = !settingsOpen;
		if (settingsOpen) detailsOpen = false;
	};

	const onDetailsPointerDown = (event: PointerEvent) => {
		if (!detailsOpen || !detailsEl) return;
		const target = event.target;
		if (!(target instanceof Node)) return;
		if (detailsEl.contains(target)) return;
		if (target instanceof Element && target.closest('.status-trigger, .badge')) return;
		detailsOpen = false;
	};

	const onStatusKeydown = (event: KeyboardEvent) => {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			toggleDetails();
		}
	};

	let releaseEscape: (() => void) | undefined;

	function updateEscapeLayer(open: boolean) {
		releaseEscape?.();
		releaseEscape = open ? registerEscapeLayer(() => (detailsOpen = false)) : undefined;
	}

	$: updateEscapeLayer(detailsOpen);
</script>

<svelte:window on:pointerdown={onDetailsPointerDown} />

<header class="status-bar" bind:clientHeight={barHeight}>
	{#if TABS.length > 1}
		<div class="segment nav">
			<NavTabs />
		</div>
	{/if}

	<div
		class="segment identity status-trigger"
		class:with-nav={TABS.length > 1}
		role="button"
		tabindex="0"
		aria-expanded={detailsOpen}
		aria-label="Device status, open for details"
		on:click={toggleDetails}
		on:keydown={onStatusKeydown}
	>
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

		<div class="metrics" class:stale class:hidden={state === null}>
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

		<i class="material-icons status-chevron">{detailsOpen ? 'expand_less' : 'expand_more'}</i>
	</div>

	<div class="segment actions">
		{#if restartNoticeVisible}
			<span class="badge neutral" title="The process restarted, everything runtime started over">
				<i class="material-icons">autorenew</i>
				<span class="badge-text">Restarted</span>
			</span>
		{/if}

		{#if saveFirst}
			<button
				type="button"
				class="badge warn"
				on:click={openDetails}
				title="Changed in the running app, not written to the configuration file yet. A restart would drop it"
			>
				<i class="material-icons">save</i>
				<span class="badge-text">Unsaved changes</span>
				<span class="badge-count">{unsavedChanges.length}</span>
			</button>
		{:else if state?.restart_required}
			<button
				type="button"
				class="badge warn"
				on:click={openDetails}
				title="Saved, takes effect after a restart"
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
			class="details-toggle settings-toggle"
			class:active={settingsOpen}
			aria-expanded={settingsOpen}
			aria-label="View settings"
			title="Theme, device address and map style"
			on:click={toggleSettings}
		>
			<i class="material-icons">tune</i>
		</button>
	</div>
</header>

<SettingsPanel open={settingsOpen} top={barHeight} onClose={() => (settingsOpen = false)} />

{#if detailsOpen}
	<section class="details" bind:this={detailsEl} style="top: {barHeight}px;">
		<div class="details-inner">
			<h2 class="details-title">Device status</h2>

			{#if state && (saveFirst || waitingForRestart.length > 0 || problem)}
				<div class="details-grid attention-grid">
					{#if saveFirst}
						<article class="card attention">
							<h3>Not saved yet</h3>
							<p class="card-text">
								Changed in the running app but not written to the configuration file. A restart
								rereads the file and drops these.
							</p>
							<ul class="change-list">
								{#each unsavedChanges as change}
									<li>
										<span class="mono">{describeChange(change)}</span>
										{#if pendingChanges.includes(change)}
											<span class="change-tag">after restart</span>
										{/if}
									</li>
								{/each}
							</ul>
						</article>
					{/if}

					{#if waitingForRestart.length > 0}
						<article class="card attention">
							<h3>Waiting for a restart</h3>
							<p class="card-text">
								Saved in the configuration file, but the running process still uses the previous
								values.
							</p>
							<ul class="change-list">
								{#each waitingForRestart as change}
									<li class="mono">{describeChange(change)}</li>
								{/each}
							</ul>
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
				</div>
			{/if}

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
							<dd class="mono">
								{#each splitAtSeparators(input.video_src) as part}{part}<wbr />{/each}
							</dd>
							<dt>Processing rate</dt>
							<dd class="mono" class:problem={fpsBehind}>{formatFps(input.processing_fps)} fps</dd>
							<dt>Frames processed</dt>
							<dd class="mono">{formatCount(input.frames_processed)}</dd>
							<dt>Frames dropped</dt>
							<dd class="mono" class:problem={dropping}>{formatCount(input.frames_dropped)}</dd>
							<dt title="Seconds since capture started">Last frame at</dt>
							<dd class="mono">
								{input.last_frame_at === null || input.last_frame_at === undefined
									? 'n/a'
									: `${input.last_frame_at.toFixed(1)} s`}
							</dd>
						</dl>
					</article>
				{/if}
			</div>

			{#if state}
				<button
					type="button"
					class="config-toggle"
					aria-expanded={configOpen}
					on:click={() => (configOpen = !configOpen)}
				>
					<i class="material-icons">{configOpen ? 'expand_less' : 'expand_more'}</i>
					How it is configured
				</button>

				{#if configOpen}
					<div class="details-grid">
						{#if input}
							<article class="card">
								<h3>Source setup</h3>
								<dl>
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
									{#if input.kind === 'file'}
										<dt>Frames in file</dt>
										<dd class="mono">{formatCount(input.total_frames)}</dd>
									{/if}
								</dl>
							</article>
						{/if}

						<article class="card">
							<h3>Detection</h3>
							<dl>
								<dt>Running on</dt>
								<dd class:problem={onCpu}>{onCpu ? 'CPU' : 'GPU (CUDA)'}</dd>
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
								<dd class="mono">
									{#if state.logging.file}{#each splitAtSeparators(state.logging.file) as part}{part}<wbr
											/>{/each}{:else}stdout only{/if}
								</dd>
							</dl>
						</article>
					</div>
				{/if}
			{/if}
		</div>
	</section>
{/if}

<style>
	.status-bar {
		display: flex;
		align-items: stretch;
		gap: var(--space-md);
		flex: 0 0 auto;
		height: var(--statusbar-height);
		/* No left padding: the tabs start at the edge of the window */
		padding: 0 var(--space-md) 0 0;
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

	.nav {
		flex: 0 0 auto;
		gap: 0;
		margin-right: auto;
	}

	.identity {
		flex: 0 1 auto;
	}

	/* With no tab strip on the left there is nothing else pushing the cluster right */
	.identity:not(.with-nav) {
		margin-left: auto;
	}

	/* The summary and the panel behind it are one control, not a row plus a button */
	.status-trigger {
		padding: 0 var(--space-sm);
		border-radius: var(--radius-sm);
		cursor: pointer;
	}

	.status-trigger:hover {
		background: var(--bg-tertiary);
	}

	.metrics {
		display: flex;
		align-items: center;
		gap: var(--space-md);
		min-width: 0;
	}

	.status-chevron {
		font-size: var(--icon-md);
		color: var(--text-secondary);
	}

	.metrics {
		flex: 0 0 auto;
		transition: opacity 0.2s ease;
	}

	.metrics.stale {
		opacity: 0.45;
	}

	.actions {
		flex: 0 0 auto;
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

	/* Anchored under the status cluster it drops from, not stretched across the screen.
	   Fixed because the app shell clips overflow at every level */
	.details {
		position: fixed;
		right: 0;
		width: 420px;
		max-height: calc(100vh - var(--statusbar-height));
		overflow-y: auto;
		padding: var(--space-md) var(--space-lg) var(--space-lg);
		background: var(--bg-secondary);
		border-left: 1px solid var(--border-primary);
		border-bottom: 1px solid var(--border-primary);
		box-shadow: 0 var(--space-sm) var(--space-lg) var(--shadow);
		z-index: 1101;
	}

	/* Same rule as the settings panel: below 1024 the workspace stacks, so a side panel
	   would sit on top of it. A sheet on the lower half keeps the frame and map in view */
	@media (max-width: 1024px) {
		.details {
			top: auto !important;
			left: 0;
			right: 0;
			bottom: 0;
			width: auto;
			max-height: 55vh;
			border-left: none;
			border-top: 1px solid var(--border-primary);
			border-bottom: none;
			border-radius: var(--radius-lg) var(--radius-lg) 0 0;
			box-shadow: 0 calc(-1 * var(--space-sm)) var(--space-lg) var(--shadow);
		}
	}

	.details-inner {
		max-width: none;
	}

	.details-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: var(--space-sm);
		align-items: start;
	}

	/* Whatever needs attention is the reason the panel was opened, so it leads */
	.attention-grid {
		margin-bottom: var(--space-md);
	}

	.config-toggle {
		display: inline-flex;
		align-items: center;
		gap: var(--space-xs);
		margin-top: var(--space-lg);
		padding: var(--space-xs) var(--space-sm) var(--space-xs) var(--space-2xs);
		border: none;
		border-radius: var(--radius-sm);
		background: none;
		color: var(--text-secondary);
		font-family: inherit;
		font-size: var(--text-md);
		cursor: pointer;
	}

	.config-toggle:hover {
		background: var(--bg-tertiary);
		color: var(--text-primary);
	}

	.config-toggle i {
		font-size: var(--icon-md);
	}

	.config-toggle[aria-expanded='true'] + .details-grid {
		margin-top: var(--space-md);
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

	.problem {
		color: var(--danger-primary);
	}

	.card .card-text.problem {
		margin-top: var(--space-sm);
	}

	.change-tag {
		margin-left: var(--space-xs);
		padding: 0 var(--space-xs);
		border-radius: var(--radius-xs);
		background: rgba(127, 127, 127, 0.2);
		font-size: var(--text-2xs);
		text-transform: uppercase;
		letter-spacing: 0.04em;
		white-space: nowrap;
	}

	.change-list {
		margin: var(--space-sm) 0 0 0;
		padding-left: var(--space-lg);
		font-size: var(--text-sm);
	}

	@media (max-width: 1024px) {
		.status-bar {
			gap: var(--space-md);
			padding: 0 var(--space-sm);
		}

		/* A 12 px question mark is not a touch target, and the panel explains the same things */
		.metric :global(.hint) {
			display: none;
		}

		.badge {
			height: 32px;
			min-width: 32px;
			justify-content: center;
		}

		.actions {
			gap: var(--space-md);
		}

		.details-toggle {
			width: 32px;
			height: 32px;
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
		/* "Connected" is what the green dot already says, but a phone must still spell out
		   trouble: with no answer the metrics are gone anyway, so the words fit */
		.connection.online .connection-text,
		.chip:not(.address-chip),
		.metric.uptime {
			display: none;
		}
	}
</style>
