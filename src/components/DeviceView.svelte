<script lang="ts">
	import { onDestroy } from 'svelte';
	import SectionFooter from './SectionFooter.svelte';
	import { tabBadges } from '../store/navigation';
	import { askForRestart } from '../store/restart';
	import { refreshStatus, restartEpoch } from '../store/status';
	import { changeAPI } from '../store/state';
	import { checkRedis, getConfig, getTrackingOptions, updateConfig } from '$lib/api/client';
	import type {
		ConfigPatch,
		ConfigView,
		ErrorResponse,
		RedisCheckResponse,
		TrackingOptions
	} from '$lib/api/types';
	import { ApiError } from '$lib/api/client';

	/** False while another tab is on screen. The view stays mounted so unapplied edits survive a tab switch */
	export let active = false;

	type SectionKey = keyof ConfigView;
	type Result = { kind: 'ok' | 'same' | 'error'; text: string; fields?: string[] };

	// Only these accept null, and for them null means "not set". An empty input maps to it
	const NULLABLE = new Set([
		'tracking.max_lost_seconds',
		'tracking.max_no_match',
		'tracking.iou_threshold',
		'redis_publisher.username',
		'verbose.level',
		'verbose.logs_folder',
		'verbose.max_file_size_mb',
		'verbose.max_files'
	]);
	// An empty Redis password is a real value: the server has none
	const EMPTY_ALLOWED = new Set(['redis_publisher.password']);

	let loaded: ConfigView | null = null;
	let draft: ConfigView | null = null;
	let options: TrackingOptions | null = null;
	let loading = false;
	let loadError: string | null = null;
	let results: Partial<Record<SectionKey, Result>> = {};
	let busy: Partial<Record<SectionKey, boolean>> = {};
	let redisCheck: RedisCheckResponse | null = null;
	let redisCheckError: string | null = null;
	let checkingRedis = false;
	// What the device refused, by dotted path, with the value it refused
	let refused: Record<string, { text: string; value: unknown }> = {};

	const clone = (value: ConfigView): ConfigView => JSON.parse(JSON.stringify(value));

	async function loadAll() {
		loading = true;
		loadError = null;
		try {
			const [config, tracking] = await Promise.all([
				getConfig($changeAPI),
				getTrackingOptions($changeAPI)
			]);
			loaded = config;
			draft = clone(config);
			options = tracking;
			results = {};
			redisCheck = null;
			redisCheckError = null;
		} catch (error) {
			loadError = error instanceof Error ? error.message : 'Could not load the settings';
		} finally {
			loading = false;
		}
	}

	// The first look at the tab, a restart and a new device address all start from what
	// the device holds now: after a restart the running settings may be different
	let loadedFor = '';
	$: wanted = `${$changeAPI}#${$restartEpoch}`;
	$: if (active && wanted !== loadedFor && !loading) {
		loadedFor = wanted;
		loadAll();
	}

	function normalise(section: SectionKey, field: string, value: unknown) {
		if (value === '' && NULLABLE.has(`${section}.${field}`)) return null;
		return value;
	}

	function sectionPatch(section: SectionKey): Record<string, unknown> {
		if (!loaded || !draft) return {};
		const before = loaded[section] as Record<string, unknown>;
		const after = draft[section] as Record<string, unknown>;
		const patch: Record<string, unknown> = {};
		for (const field of Object.keys(after)) {
			const value = normalise(section, field, after[field]);
			// Both sides, so an empty string from the device and an emptied input agree
			if (value !== normalise(section, field, before[field])) patch[field] = value;
		}
		return patch;
	}

	function missingRequired(section: SectionKey): string[] {
		if (!draft) return [];
		const values = draft[section] as Record<string, unknown>;
		return Object.keys(values).filter((field) => {
			const path = `${section}.${field}`;
			if (NULLABLE.has(path)) return false;
			const value = values[field];
			if (value === '' && EMPTY_ALLOWED.has(path)) return false;
			return value === null || value === undefined || value === '';
		});
	}

	// Both recompute on every keystroke, since the inputs are bound into draft
	$: changes = draft && loaded ? perSection(draft, (s) => Object.keys(sectionPatch(s)).length) : {};
	$: missing = draft ? perSection(draft, missingRequired) : {};

	// Edits typed but not applied yet, counted on the tab so they are not forgotten elsewhere
	$: unappliedTotal = Object.values(changes).reduce((sum, count) => sum + (count ?? 0), 0);
	$: tabBadges.update((badges) => ({ ...badges, device: unappliedTotal }));
	onDestroy(() => tabBadges.update((badges) => ({ ...badges, device: 0 })));

	function perSection(value: ConfigView, compute: (section: SectionKey) => any) {
		const out: Partial<Record<SectionKey, any>> = {};
		for (const section of Object.keys(value) as SectionKey[]) out[section] = compute(section);
		return out;
	}

	async function apply(section: SectionKey) {
		if (!draft) return;
		const patch = { [section]: sectionPatch(section) } as ConfigPatch;
		busy = { ...busy, [section]: true };
		try {
			const answer = await updateConfig($changeAPI, patch);
			results = {
				...results,
				[section]:
					answer.changed.length > 0
						? { kind: 'ok', text: `Applied: ${answer.changed.join(', ')}` }
						: { kind: 'same', text: 'Nothing was different, nothing changed' }
			};
			// The device is the reference now: take its values for this section and keep
			// whatever is still being edited in the others
			const fresh = await getConfig($changeAPI);
			const kept = clone(draft);
			loaded = fresh;
			draft = { ...kept, [section]: clone(fresh)[section] } as ConfigView;
			refreshStatus();
		} catch (error) {
			// The refusal names the fields it is about, so each one is shown at its own input
			const body =
				error instanceof ApiError ? (error.payload as ErrorResponse | undefined) : undefined;
			for (const detail of body?.details ?? []) {
				refused = {
					...refused,
					[detail.field]: { text: detail.error, value: valueAt(detail.field) }
				};
			}
			// The reason sits at each field, so the line only says which ones to look at
			const named = (body?.details ?? []).map((detail) => detail.field);
			results = {
				...results,
				[section]: {
					kind: 'error',
					text: named.length
						? `${body?.error_text ?? 'Refused'}: ${named.join(', ')}`
						: error instanceof Error
							? error.message
							: 'The device refused the change',
					fields: named
				}
			};
		} finally {
			busy = { ...busy, [section]: false };
		}
	}

	function valueAt(path: string) {
		const [section, field] = path.split('.');
		if (!draft || !(section in draft)) return undefined;
		return (draft[section as SectionKey] as Record<string, unknown>)[field];
	}

	// A refusal is about the value that was sent: once the field is edited it no longer applies
	$: issues = draft
		? Object.fromEntries(
				Object.entries(refused)
					.filter(([path, issue]) => valueAt(path) === issue.value)
					.map(([path, issue]) => [path, issue.text])
			)
		: {};

	// A refusal about named fields is over once they have all been edited: what the line
	// should say then is that there are changes waiting, not what was refused before
	$: shownResults = Object.fromEntries(
		Object.entries(results).map(([section, result]) => [
			section,
			result?.kind === 'error' && result.fields?.length && !result.fields.some((f) => f in issues)
				? undefined
				: result
		])
	) as Partial<Record<SectionKey, Result>>;

	function revert(section: SectionKey) {
		if (!loaded || !draft) return;
		draft = { ...draft, [section]: clone(loaded)[section] } as ConfigView;
		results = { ...results, [section]: undefined };
		refused = Object.fromEntries(
			Object.entries(refused).filter(([path]) => !path.startsWith(`${section}.`))
		);
		if (section === 'redis_publisher') {
			redisCheck = null;
			redisCheckError = null;
		}
	}

	async function runRedisCheck() {
		if (!draft) return;
		const redis = draft.redis_publisher;
		checkingRedis = true;
		redisCheck = null;
		redisCheckError = null;
		try {
			redisCheck = await checkRedis($changeAPI, {
				host: redis.host,
				port: redis.port,
				username: redis.username === '' ? null : redis.username,
				password: redis.password,
				db_index: redis.db_index
			});
		} catch (error) {
			redisCheckError = error instanceof Error ? error.message : 'The check did not run';
		} finally {
			checkingRedis = false;
		}
	}

	// A value the device already uses stays selectable even if the list does not name it
	function withCurrent(list: string[], current: string | undefined): string[] {
		return current && !list.includes(current) ? [current, ...list] : list;
	}

	$: trackerTypes = withCurrent(options?.tracker_types ?? [], draft?.tracking.type);
	$: kalmanFilters = withCurrent(options?.kalman_filters ?? [], draft?.tracking.kalman_filter);
	$: windowSeconds =
		draft && Number.isFinite(draft.worker.reset_data_milliseconds)
			? draft.worker.reset_data_milliseconds / 1000
			: null;
</script>

<section class="device-view" class:hidden={!active}>
	<div class="device-inner">
		<header class="view-header">
			<h2>Device</h2>
			<p>
				<strong>Apply</strong> changes the running app. <strong>Save</strong> in the header writes
				everything to the configuration file, and most settings take effect only after a
				<strong>restart</strong>, which is also in the header.
			</p>
		</header>

		{#if loading && !draft}
			<p class="state-line">Loading the settings of the device</p>
		{:else if loadError && !draft}
			<div class="state-line error">
				<span>{loadError}</span>
				<button type="button" class="action-btn secondary" on:click={loadAll}>Try again</button>
			</div>
		{/if}

		{#if draft && loaded}
			<article class="card" class:pending={(changes.input ?? 0) > 0}>
				<header class="card-header">
					<h3>Video source</h3>
					<span class="tag">after restart</span>
				</header>
				<div class="fields">
					<label class="field wide">
						<span class="label">Source</span>
						<input
							class="mono"
							type="text"
							spellcheck="false"
							autocomplete="off"
							autocapitalize="off"
							bind:value={draft.input.video_src}
							class:invalid={!!issues['input.video_src']}
						/>
						{#if issues['input.video_src']}<span class="field-error"
								>{issues['input.video_src']}</span
							>{/if}
						<span class="hint">Video file, RTSP URL, camera index or GStreamer pipeline</span>
					</label>
					<label class="field">
						<span class="label">Process every N-th frame</span>
						<input
							type="number"
							inputmode="numeric"
							min="1"
							step="1"
							bind:value={draft.input.process_every_nth_frame}
							class:invalid={!!issues['input.process_every_nth_frame']}
						/>
						{#if issues['input.process_every_nth_frame']}<span class="field-error"
								>{issues['input.process_every_nth_frame']}</span
							>{/if}
						<span class="hint">2 means every second frame, which halves the load</span>
					</label>
				</div>
				<SectionFooter
					result={shownResults.input}
					changes={changes.input ?? 0}
					busy={busy.input ?? false}
					missing={missing.input ?? []}
					onApply={() => apply('input')}
					onRevert={() => revert('input')}
				/>
			</article>

			<article class="card" class:pending={(changes.equipment_info ?? 0) > 0}>
				<header class="card-header">
					<h3>Equipment</h3>
					<span class="tag now">applies at once</span>
				</header>
				<div class="fields">
					<label class="field wide">
						<span class="label">Equipment id</span>
						<input
							class="mono"
							type="text"
							spellcheck="false"
							autocomplete="off"
							autocapitalize="off"
							bind:value={draft.equipment_info.id}
							class:invalid={!!issues['equipment_info.id']}
						/>
						{#if issues['equipment_info.id']}<span class="field-error"
								>{issues['equipment_info.id']}</span
							>{/if}
						<span class="hint"
							>Identifies this installation point in everything the device publishes</span
						>
					</label>
				</div>
				<SectionFooter
					result={shownResults.equipment_info}
					changes={changes.equipment_info ?? 0}
					busy={busy.equipment_info ?? false}
					missing={missing.equipment_info ?? []}
					onApply={() => apply('equipment_info')}
					onRevert={() => revert('equipment_info')}
				/>
			</article>

			<article class="card" class:pending={(changes.worker ?? 0) > 0}>
				<header class="card-header">
					<h3>Statistics window</h3>
					<span class="tag">after restart</span>
				</header>
				<div class="fields">
					<label class="field">
						<span class="label">Window length, ms</span>
						<input
							type="number"
							inputmode="numeric"
							min="1"
							step="1000"
							bind:value={draft.worker.reset_data_milliseconds}
							class:invalid={!!issues['worker.reset_data_milliseconds']}
						/>
						{#if issues['worker.reset_data_milliseconds']}<span class="field-error"
								>{issues['worker.reset_data_milliseconds']}</span
							>{/if}
						<span class="hint">
							{windowSeconds === null ? 'Counts are collected' : `${windowSeconds} s:`} counts are collected
							over this long, published, then start over
						</span>
					</label>
				</div>
				<SectionFooter
					result={shownResults.worker}
					changes={changes.worker ?? 0}
					busy={busy.worker ?? false}
					missing={missing.worker ?? []}
					onApply={() => apply('worker')}
					onRevert={() => revert('worker')}
				/>
			</article>

			<article class="card" class:pending={(changes.redis_publisher ?? 0) > 0}>
				<header class="card-header">
					<h3>Redis</h3>
					<span class="tag">after restart</span>
				</header>
				<div class="fields">
					<label class="field wide toggle-field">
						<input type="checkbox" bind:checked={draft.redis_publisher.enable} />
						<span>Publish statistics to Redis</span>
					</label>
					<label class="field">
						<span class="label">Host</span>
						<input
							class="mono"
							type="text"
							spellcheck="false"
							autocomplete="off"
							autocapitalize="off"
							bind:value={draft.redis_publisher.host}
							class:invalid={!!issues['redis_publisher.host']}
						/>
						{#if issues['redis_publisher.host']}<span class="field-error"
								>{issues['redis_publisher.host']}</span
							>{/if}
					</label>
					<label class="field">
						<span class="label">Port</span>
						<input
							type="number"
							inputmode="numeric"
							min="1"
							max="65535"
							step="1"
							bind:value={draft.redis_publisher.port}
							class:invalid={!!issues['redis_publisher.port']}
						/>
						{#if issues['redis_publisher.port']}<span class="field-error"
								>{issues['redis_publisher.port']}</span
							>{/if}
					</label>
					<label class="field">
						<span class="label">User</span>
						<input
							class="mono"
							type="text"
							spellcheck="false"
							autocomplete="off"
							autocapitalize="off"
							placeholder="Default user"
							bind:value={draft.redis_publisher.username}
							class:invalid={!!issues['redis_publisher.username']}
						/>
						{#if issues['redis_publisher.username']}<span class="field-error"
								>{issues['redis_publisher.username']}</span
							>{/if}
						<span class="hint">Only for a server with ACL users</span>
					</label>
					<label class="field">
						<span class="label">Password</span>
						<input
							class="mono"
							type="text"
							spellcheck="false"
							autocomplete="off"
							autocapitalize="off"
							placeholder="No password"
							bind:value={draft.redis_publisher.password}
							class:invalid={!!issues['redis_publisher.password']}
						/>
						{#if issues['redis_publisher.password']}<span class="field-error"
								>{issues['redis_publisher.password']}</span
							>{/if}
					</label>
					<label class="field">
						<span class="label">Database</span>
						<input
							type="number"
							inputmode="numeric"
							min="0"
							step="1"
							bind:value={draft.redis_publisher.db_index}
							class:invalid={!!issues['redis_publisher.db_index']}
						/>
						{#if issues['redis_publisher.db_index']}<span class="field-error"
								>{issues['redis_publisher.db_index']}</span
							>{/if}
					</label>
					<label class="field">
						<span class="label">Channel</span>
						<input
							class="mono"
							type="text"
							spellcheck="false"
							autocomplete="off"
							autocapitalize="off"
							bind:value={draft.redis_publisher.channel_name}
							class:invalid={!!issues['redis_publisher.channel_name']}
						/>
						{#if issues['redis_publisher.channel_name']}<span class="field-error"
								>{issues['redis_publisher.channel_name']}</span
							>{/if}
					</label>
				</div>

				<div class="check-row">
					<button
						type="button"
						class="action-btn secondary"
						disabled={checkingRedis}
						on:click={runRedisCheck}
					>
						<i class="material-icons">{checkingRedis ? 'hourglass_empty' : 'lan'}</i>
						{checkingRedis ? 'Checking' : 'Check connection'}
					</button>
					{#if redisCheck}
						<span class="check-result" class:ok={redisCheck.ok} class:error={!redisCheck.ok}>
							{redisCheck.ok
								? `Replied in ${redisCheck.took_ms} ms`
								: (redisCheck.error ?? 'No reply')}
							<span class="mono target">{redisCheck.target}</span>
						</span>
					{:else if redisCheckError}
						<span class="check-result error">{redisCheckError}</span>
					{/if}
				</div>
				<p class="hint">Tries the values typed above, before anything is applied</p>

				<SectionFooter
					result={shownResults.redis_publisher}
					changes={changes.redis_publisher ?? 0}
					busy={busy.redis_publisher ?? false}
					missing={missing.redis_publisher ?? []}
					onApply={() => apply('redis_publisher')}
					onRevert={() => revert('redis_publisher')}
				/>
			</article>

			<article class="card" class:pending={(changes.tracking ?? 0) > 0}>
				<header class="card-header">
					<h3>Tracking</h3>
					<span class="tag">after restart</span>
				</header>
				<div class="fields">
					<label class="field">
						<span class="label">Tracker</span>
						<select bind:value={draft.tracking.type} class:invalid={!!issues['tracking.type']}>
							{#each trackerTypes as type}
								<option value={type}>{type}</option>
							{/each}
						</select>
						{#if issues['tracking.type']}<span class="field-error">{issues['tracking.type']}</span
							>{/if}
					</label>
					<label class="field">
						<span class="label">Kalman filter</span>
						<select
							bind:value={draft.tracking.kalman_filter}
							class:invalid={!!issues['tracking.kalman_filter']}
						>
							{#each kalmanFilters as filter}
								<option value={filter}>{filter}</option>
							{/each}
						</select>
						{#if issues['tracking.kalman_filter']}<span class="field-error"
								>{issues['tracking.kalman_filter']}</span
							>{/if}
					</label>
					<label class="field">
						<span class="label">Keep a lost track, s</span>
						<input
							type="number"
							inputmode="decimal"
							min="0"
							step="0.1"
							placeholder="Not set"
							bind:value={draft.tracking.max_lost_seconds}
							class:invalid={!!issues['tracking.max_lost_seconds']}
						/>
						{#if issues['tracking.max_lost_seconds']}<span class="field-error"
								>{issues['tracking.max_lost_seconds']}</span
							>{/if}
						<span class="hint">Leave empty to count frames instead, below</span>
					</label>
					<label class="field">
						<span class="label">Keep a lost track, frames</span>
						<input
							type="number"
							inputmode="numeric"
							min="0"
							step="1"
							placeholder="Not set"
							bind:value={draft.tracking.max_no_match}
							class:invalid={!!issues['tracking.max_no_match']}
						/>
						{#if issues['tracking.max_no_match']}<span class="field-error"
								>{issues['tracking.max_no_match']}</span
							>{/if}
						<span class="hint">Used only when the seconds are empty</span>
					</label>
					<label class="field">
						<span class="label">Points kept per track</span>
						<input
							type="number"
							inputmode="numeric"
							min="1"
							step="1"
							bind:value={draft.tracking.max_points_in_track}
							class:invalid={!!issues['tracking.max_points_in_track']}
						/>
						{#if issues['tracking.max_points_in_track']}<span class="field-error"
								>{issues['tracking.max_points_in_track']}</span
							>{/if}
					</label>
					<label class="field">
						<span class="label">IoU threshold</span>
						<input
							type="number"
							inputmode="decimal"
							min="0"
							max="1"
							step="0.05"
							placeholder="Default"
							bind:value={draft.tracking.iou_threshold}
							class:invalid={!!issues['tracking.iou_threshold']}
						/>
						{#if issues['tracking.iou_threshold']}<span class="field-error"
								>{issues['tracking.iou_threshold']}</span
							>{/if}
						<span class="hint">Leave empty for the default</span>
					</label>
				</div>
				<SectionFooter
					result={shownResults.tracking}
					changes={changes.tracking ?? 0}
					busy={busy.tracking ?? false}
					missing={missing.tracking ?? []}
					onApply={() => apply('tracking')}
					onRevert={() => revert('tracking')}
				/>
			</article>

			<article class="card" class:pending={(changes.verbose ?? 0) > 0}>
				<header class="card-header">
					<h3>Logging</h3>
				</header>
				<div class="fields">
					<label class="field">
						<span class="label">Level <span class="tag now">applies at once</span></span>
						<select bind:value={draft.verbose.level} class:invalid={!!issues['verbose.level']}>
							<option value={null}>Default</option>
							<option value="info">info</option>
							<option value="debug">debug</option>
						</select>
						{#if issues['verbose.level']}<span class="field-error">{issues['verbose.level']}</span
							>{/if}
					</label>
					<label class="field">
						<span class="label">Folder <span class="tag">after restart</span></span>
						<input
							class="mono"
							type="text"
							spellcheck="false"
							autocomplete="off"
							autocapitalize="off"
							placeholder="Default"
							bind:value={draft.verbose.logs_folder}
							class:invalid={!!issues['verbose.logs_folder']}
						/>
						{#if issues['verbose.logs_folder']}<span class="field-error"
								>{issues['verbose.logs_folder']}</span
							>{/if}
					</label>
					<label class="field">
						<span class="label">File size, MB <span class="tag">after restart</span></span>
						<input
							type="number"
							inputmode="numeric"
							min="1"
							step="1"
							placeholder="Default"
							bind:value={draft.verbose.max_file_size_mb}
							class:invalid={!!issues['verbose.max_file_size_mb']}
						/>
						{#if issues['verbose.max_file_size_mb']}<span class="field-error"
								>{issues['verbose.max_file_size_mb']}</span
							>{/if}
					</label>
					<label class="field">
						<span class="label">Files kept <span class="tag">after restart</span></span>
						<input
							type="number"
							inputmode="numeric"
							min="1"
							step="1"
							placeholder="Default"
							bind:value={draft.verbose.max_files}
							class:invalid={!!issues['verbose.max_files']}
						/>
						{#if issues['verbose.max_files']}<span class="field-error"
								>{issues['verbose.max_files']}</span
							>{/if}
					</label>
				</div>
				<SectionFooter
					result={shownResults.verbose}
					changes={changes.verbose ?? 0}
					busy={busy.verbose ?? false}
					missing={missing.verbose ?? []}
					onApply={() => apply('verbose')}
					onRevert={() => revert('verbose')}
				/>
			</article>

			<article class="card">
				<header class="card-header">
					<h3>Restart</h3>
				</header>
				<p class="hint">
					Reads the configuration file again and starts the detector over. Processing stops for a
					few seconds and the current statistics window begins again. Anything not saved is asked
					about first.
				</p>
				<div class="restart-row">
					<button type="button" class="action-btn secondary" on:click={askForRestart}>
						<i class="material-icons">restart_alt</i>
						Restart the device
					</button>
				</div>
			</article>
		{/if}
	</div>
</section>

<style>
	.device-view {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		background: var(--bg-primary);
	}

	.device-view.hidden {
		display: none;
	}

	.device-inner {
		display: flex;
		flex-direction: column;
		gap: var(--space-lg);
		max-width: 760px;
		margin: 0 auto;
		padding: var(--space-xl) var(--space-lg) var(--space-3xl);
	}

	.view-header h2 {
		margin: 0 0 var(--space-sm) 0;
		font-size: var(--text-lg);
		font-weight: 600;
		color: var(--text-primary);
	}

	.view-header p {
		margin: 0;
		max-width: 64ch;
		color: var(--text-secondary);
		font-size: var(--text-md);
		line-height: 1.55;
	}

	.state-line {
		display: flex;
		align-items: center;
		gap: var(--space-md);
		margin: 0;
		color: var(--text-secondary);
		font-size: var(--text-md);
	}

	.state-line.error {
		color: var(--danger-primary);
	}

	.card {
		padding: var(--space-lg);
		background: var(--bg-secondary);
		border: 1px solid var(--border-primary);
		border-radius: var(--radius-md);
	}

	/* A section with edits not applied yet stands out while scrolling a long page */
	.card.pending {
		border-color: var(--warning-border);
		box-shadow: inset 3px 0 0 var(--warning-text);
	}

	.card-header {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--space-sm);
		margin-bottom: var(--space-md);
	}

	.card-header h3 {
		margin: 0;
		font-size: var(--text-md);
		font-weight: 600;
		color: var(--text-primary);
	}

	.tag {
		display: inline-flex;
		align-items: center;
		padding: 1px var(--space-xs);
		border-radius: var(--radius-xs);
		background: var(--bg-tertiary);
		color: var(--text-secondary);
		font-size: var(--text-2xs);
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		white-space: nowrap;
	}

	.tag.now {
		background: rgba(var(--accent-primary-rgb), 0.12);
		color: var(--accent-primary);
	}

	.fields {
		display: grid;
		grid-template-columns: 1fr;
		gap: var(--space-md);
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
		min-width: 0;
	}

	.label {
		display: flex;
		align-items: center;
		gap: var(--space-xs);
		font-size: var(--text-sm);
		font-weight: 500;
		color: var(--text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.field-error {
		color: var(--danger-primary);
		font-size: var(--text-sm);
		line-height: 1.4;
	}

	input.invalid,
	select.invalid {
		border-color: var(--danger-primary);
	}

	input.invalid:focus,
	select.invalid:focus {
		box-shadow: 0 0 0 3px rgba(var(--danger-primary-rgb), 0.15);
	}

	.hint {
		margin: 0;
		color: var(--text-secondary);
		font-size: var(--text-sm);
		line-height: 1.4;
	}

	input:not([type='checkbox']),
	select {
		box-sizing: border-box;
		width: 100%;
		min-width: 0;
		min-height: 40px;
		padding: var(--space-sm) 10px;
		border: 1px solid var(--border-primary);
		border-radius: var(--radius-sm);
		background: var(--bg-primary);
		color: var(--text-primary);
		font-family: inherit;
		font-size: var(--text-md);
		transition:
			border-color 0.2s,
			box-shadow 0.2s;
	}

	input::placeholder {
		color: var(--text-secondary);
		opacity: 0.7;
	}

	input:focus,
	select:focus {
		outline: none;
		border-color: var(--accent-primary);
		box-shadow: 0 0 0 3px rgba(var(--accent-primary-rgb), 0.1);
	}

	input[type='number']::-webkit-outer-spin-button,
	input[type='number']::-webkit-inner-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}

	input[type='number'] {
		-moz-appearance: textfield;
		appearance: textfield;
	}

	.mono {
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
	}

	.toggle-field {
		flex-direction: row;
		align-items: center;
		gap: var(--space-sm);
		min-height: 32px;
		color: var(--text-primary);
		font-size: var(--text-md);
		cursor: pointer;
	}

	.toggle-field input {
		width: 18px;
		height: 18px;
		margin: 0;
		accent-color: var(--accent-primary);
	}

	.restart-row {
		margin-top: var(--space-lg);
	}

	.check-row {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--space-md);
		margin-top: var(--space-lg);
	}

	.check-row + .hint {
		margin-top: var(--space-xs);
	}

	.check-result {
		display: inline-flex;
		align-items: baseline;
		flex-wrap: wrap;
		gap: var(--space-xs) var(--space-sm);
		font-size: var(--text-base);
	}

	.check-result.ok {
		color: var(--success-primary);
	}

	.check-result.error {
		color: var(--danger-primary);
	}

	.check-result .target {
		color: var(--text-secondary);
		font-size: var(--text-sm);
	}

	@media (min-width: 640px) {
		.fields {
			grid-template-columns: 1fr 1fr;
		}

		.field.wide {
			grid-column: 1 / -1;
		}
	}

	/* Below 16 px a phone zooms into the input on focus and the page jumps sideways */
	@media (max-width: 1024px) {
		input:not([type='checkbox']),
		select {
			font-size: var(--text-lg);
		}

		.device-inner {
			padding: var(--space-lg) var(--space-md) var(--space-3xl);
		}
	}
</style>
