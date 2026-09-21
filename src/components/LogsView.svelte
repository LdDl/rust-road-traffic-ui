<script lang="ts">
	import { onDestroy, tick } from 'svelte';
	import { changeAPI } from '../store/state';
	import { logsFilter } from '../store/logs';
	import { getLogs } from '$lib/api/client';
	import { createPoller } from '$lib/polling';
	import { formatTimestamp } from '$lib/format';
	import type { LogEntry } from '$lib/api/types';

	export let active = false;

	/** Slower than the status: a log file is read, not watched */
	const POLL_MS = 3000;
	const LEVELS = ['error', 'warn', 'info', 'debug'];
	const LIMITS = [200, 500, 1000, 5000];
	/** Closer to the bottom than this counts as being at the bottom */
	const BOTTOM_SLACK_PX = 24;

	let entries: LogEntry[] = [];
	let file: string | null = null;
	let loading = false;
	let error: string | null = null;
	let loadedOnce = false;

	let level = '';
	let scope = '';
	let limit = 200;
	let follow = true;

	let knownScopes: string[] = [];
	let expanded = new Set<string>();
	let listEl: HTMLElement | undefined;
	let atBottom = true;

	/** Entries are replaced on every poll, so what is open is remembered by content, not by row */
	const keyOf = (entry: LogEntry, index: number) =>
		`${entry.timestamp ?? index}|${entry.level}|${entry.message}`;

	const extrasOf = (entry: LogEntry) => Object.entries(entry.fields ?? {});

	function render(value: unknown): string {
		return typeof value === 'string' ? value : JSON.stringify(value);
	}

	async function load() {
		loading = true;
		try {
			const answer = await getLogs($changeAPI, {
				limit,
				level: level || undefined,
				scope: scope || undefined
			});
			entries = answer.entries;
			file = answer.file ?? null;
			error = null;
			loadedOnce = true;
			// The scope list is whatever has been seen: the API offers no list of its own
			const seen = entries.map((entry) => entry.scope).filter((s): s is string => !!s);
			knownScopes = [...new Set([...knownScopes, ...seen])].sort();
			await tick();
			if (follow) scrollToBottom();
		} catch (reason) {
			error = reason instanceof Error ? reason.message : 'Could not read the log';
		} finally {
			loading = false;
		}
	}

	const poller = createPoller({ intervalMs: POLL_MS, run: load });

	function scrollToBottom() {
		if (!listEl) return;
		listEl.scrollTop = listEl.scrollHeight;
		atBottom = true;
	}

	function onScroll() {
		if (!listEl) return;
		atBottom = listEl.scrollHeight - listEl.scrollTop - listEl.clientHeight < BOTTOM_SLACK_PX;
		// Scrolling back to read something stops the list from jumping away
		if (!atBottom) follow = false;
	}

	function toggleFollow() {
		follow = !follow;
		if (follow) {
			scrollToBottom();
			poller.refresh();
		}
	}

	function toggle(key: string) {
		const next = new Set(expanded);
		if (next.has(key)) next.delete(key);
		else next.add(key);
		expanded = next;
	}

	function clearFilters() {
		level = '';
		scope = '';
	}

	// Another view can ask for the logs of one scope, for example the problem badge
	const unsubscribeFilter = logsFilter.subscribe((wanted) => {
		if (wanted.level === level && wanted.scope === scope) return;
		level = wanted.level;
		scope = wanted.scope;
	});

	// Following keeps the poller running; without it the list is read once and stays
	let running = false;
	$: if (active && follow && !running) {
		running = true;
		poller.start();
	} else if ((!active || !follow) && running) {
		running = false;
		poller.stop();
	}

	// A filter change, a new device or the first look all mean read it again
	let readFor = '';
	$: wanted = `${$changeAPI}|${level}|${scope}|${limit}`;
	$: if (active && wanted !== readFor) {
		readFor = wanted;
		expanded = new Set();
		if (running) poller.refresh();
		else load();
	}

	onDestroy(() => {
		unsubscribeFilter();
		poller.stop();
	});
</script>

<section class="logs-view" class:hidden={!active}>
	<header class="logs-bar">
		<label class="control">
			<span class="control-label">Level</span>
			<select bind:value={level}>
				<option value="">every level</option>
				{#each LEVELS as name}
					<option value={name}>{name} and above</option>
				{/each}
			</select>
		</label>

		<label class="control">
			<span class="control-label">Scope</span>
			<select bind:value={scope}>
				<option value="">every scope</option>
				{#each knownScopes as name}
					<option value={name}>{name}</option>
				{/each}
			</select>
		</label>

		<label class="control">
			<span class="control-label">Lines</span>
			<select bind:value={limit}>
				{#each LIMITS as size}
					<option value={size}>{size}</option>
				{/each}
			</select>
		</label>

		<button
			type="button"
			class="action-btn"
			class:primary={follow}
			class:secondary={!follow}
			aria-pressed={follow}
			on:click={toggleFollow}
			title="Keep reading the end of the file"
		>
			<i class="material-icons">{follow ? 'pause' : 'play_arrow'}</i>
			{follow ? 'Following' : 'Follow'}
		</button>

		<button
			type="button"
			class="action-btn secondary"
			on:click={() => (running ? poller.refresh() : load())}
		>
			<i class="material-icons">refresh</i>
			Refresh
		</button>

		{#if level || scope}
			<button type="button" class="action-btn secondary" on:click={clearFilters}
				>Clear filters</button
			>
		{/if}

		<span class="spacer"></span>
		<span class="counts">
			{entries.length}
			{entries.length === 1 ? 'line' : 'lines'}{#if file}, from <span class="mono">{file}</span
				>{/if}
		</span>
	</header>

	<div class="list" bind:this={listEl} on:scroll={onScroll}>
		{#if error}
			<p class="state error">{error}</p>
		{:else if !loadedOnce && loading}
			<p class="state">Reading the log</p>
		{:else if entries.length === 0}
			<p class="state">
				{#if file === null}
					This device only writes to its standard output, so there is no file to read here.
				{:else if level || scope}
					Nothing in the file matches these filters.
				{:else}
					The log is empty.
				{/if}
			</p>
		{:else}
			{#each entries as entry, index (keyOf(entry, index))}
				{@const key = keyOf(entry, index)}
				{@const extras = extrasOf(entry)}
				<div class="entry level-{entry.level.toLowerCase()}" class:open={expanded.has(key)}>
					<button
						type="button"
						class="entry-row"
						aria-expanded={expanded.has(key)}
						on:click={() => toggle(key)}
					>
						<span class="time mono">{formatTimestamp(entry.timestamp)}</span>
						<span class="level">{entry.level}</span>
						<span class="scope">{entry.scope ?? ''}</span>
						<span class="message">{entry.message}</span>
						<span class="extras-hint">
							<i class="material-icons">{expanded.has(key) ? 'expand_less' : 'expand_more'}</i>
							{extras.length > 0 ? extras.length : ''}
						</span>
					</button>

					{#if expanded.has(key)}
						{#if extras.length > 0}
							<dl class="extras">
								{#each extras as [name, value]}
									<dt class="mono">{name}</dt>
									<dd class="mono">{render(value)}</dd>
								{/each}
							</dl>
						{:else}
							<p class="extras-empty">This line carried nothing but the message.</p>
						{/if}
					{/if}
				</div>
			{/each}
		{/if}
	</div>

	{#if entries.length > 0}
		<footer class="logs-foot">
			<span>Oldest first, newest at the bottom.</span>
			{#if !atBottom}
				<button type="button" class="action-btn secondary" on:click={scrollToBottom}>
					<i class="material-icons">arrow_downward</i>
					Jump to the newest
				</button>
			{/if}
		</footer>
	{/if}
</section>

<style>
	.logs-view {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
		background: var(--bg-primary);
	}

	.logs-view.hidden {
		display: none;
	}

	.logs-bar {
		display: flex;
		align-items: flex-end;
		flex-wrap: wrap;
		gap: var(--space-sm) var(--space-md);
		padding: var(--space-md) var(--space-lg);
		border-bottom: 1px solid var(--border-primary);
		background: var(--bg-secondary);
	}

	.control {
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
		min-width: 0;
	}

	.control-label {
		font-size: var(--text-2xs);
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-secondary);
	}

	select {
		box-sizing: border-box;
		min-height: 36px;
		padding: var(--space-xs) var(--space-sm);
		border: 1px solid var(--border-primary);
		border-radius: var(--radius-sm);
		background: var(--bg-primary);
		color: var(--text-primary);
		font-family: inherit;
		font-size: var(--text-base);
	}

	select:focus {
		outline: none;
		border-color: var(--accent-primary);
		box-shadow: 0 0 0 3px rgba(var(--accent-primary-rgb), 0.1);
	}

	.spacer {
		flex: 1;
	}

	.counts {
		color: var(--text-secondary);
		font-size: var(--text-sm);
		overflow-wrap: anywhere;
	}

	.list {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		font-size: var(--text-base);
	}

	.state {
		margin: 0;
		padding: var(--space-2xl) var(--space-lg);
		max-width: 60ch;
		color: var(--text-secondary);
		line-height: 1.5;
	}

	.state.error {
		color: var(--danger-primary);
	}

	.entry {
		border-bottom: 1px solid var(--border-secondary);
	}

	.entry-row {
		display: grid;
		grid-template-columns: auto auto auto 1fr auto;
		align-items: baseline;
		gap: var(--space-sm) var(--space-md);
		width: 100%;
		padding: var(--space-sm) var(--space-lg);
		border: none;
		background: none;
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	.entry-row:hover {
		background: var(--bg-secondary);
	}

	.time {
		color: var(--text-secondary);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	.level {
		min-width: 5ch;
		font-size: var(--text-2xs);
		font-weight: 700;
		letter-spacing: 0.04em;
		color: var(--text-secondary);
	}

	.level-error .level {
		color: var(--danger-primary);
	}

	.level-warn .level {
		color: var(--warning-text);
	}

	.level-error .message {
		color: var(--danger-primary);
	}

	.scope {
		min-width: 8ch;
		color: var(--text-secondary);
		font-size: var(--text-sm);
	}

	.message {
		min-width: 0;
		overflow-wrap: anywhere;
	}

	.extras-hint {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2xs);
		color: var(--text-secondary);
		font-size: var(--text-sm);
	}

	.extras-hint i {
		font-size: var(--icon-sm);
	}

	.extras-empty {
		margin: 0;
		padding: 0 var(--space-lg) var(--space-md) var(--space-lg);
		color: var(--text-secondary);
		font-size: var(--text-sm);
	}

	.extras {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		gap: var(--space-2xs) var(--space-md);
		margin: 0;
		padding: 0 var(--space-lg) var(--space-md) var(--space-lg);
		font-size: var(--text-sm);
	}

	.extras dt {
		color: var(--text-secondary);
		white-space: nowrap;
	}

	.extras dd {
		margin: 0;
		overflow-wrap: anywhere;
	}

	.mono {
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
	}

	.logs-foot {
		display: flex;
		align-items: center;
		gap: var(--space-md);
		padding: var(--space-sm) var(--space-lg);
		border-top: 1px solid var(--border-primary);
		background: var(--bg-secondary);
		color: var(--text-secondary);
		font-size: var(--text-sm);
	}

	/* A phone has no room for columns: the line stacks and the message gets the width */
	@media (max-width: 1024px) {
		.entry-row {
			grid-template-columns: auto auto 1fr auto;
			padding: var(--space-sm) var(--space-md);
		}

		.message {
			grid-column: 1 / -1;
		}

		.scope:empty {
			display: none;
		}

		select {
			font-size: var(--text-lg);
			min-height: 40px;
		}

		.extras,
		.extras-empty {
			padding: 0 var(--space-md) var(--space-md) var(--space-md);
		}
	}
</style>
