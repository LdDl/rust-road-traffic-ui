<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import PassageCard from './PassageCard.svelte';
	import Hint from './Hint.svelte';
	import { parseVehicleEvent } from '$lib/api/vehicle-events';
	import {
		EVENT_LIMIT,
		IMAGE_BUDGET,
		passageItem,
		releasePassage,
		type PassageItem
	} from '$lib/event-images';
	import { changeAPI } from '../store/state';
	import { connection, status } from '../store/status';
	import { goToTab } from '../store/navigation';
	export let active = false;

	let items: PassageItem[] = [];
	let source: EventSource | null = null;
	let retry: ReturnType<typeof setTimeout> | undefined;
	let streamState: 'idle' | 'connecting' | 'live' | 'reconnecting' = 'idle';
	let paused = false;
	let visible = false;
	let received = 0;
	let invalid = 0;
	let interrupted = false;
	let device = '';
	let subscribedTo = '';

	function clear() {
		items.forEach(releasePassage);
		items = [];
		received = 0;
		invalid = 0;
	}

	function disconnect() {
		if (retry !== undefined) clearTimeout(retry);
		retry = undefined;
		if (source) interrupted = true;
		source?.close();
		source = null;
		streamState = 'idle';
	}

	function connect(address: string) {
		const current = new EventSource(`${address}/api/events/stream`);
		source = current;
		streamState = 'connecting';
		current.onopen = () => {
			if (source === current) streamState = 'live';
		};
		current.onerror = () => {
			if (source !== current) return;
			streamState = 'reconnecting';
			interrupted = true;
			if (current.readyState === EventSource.CLOSED) {
				retry = setTimeout(() => {
					if (source === current) connect(address);
				}, 3000);
			}
		};
		current.addEventListener('vehicle.passed', (message) => {
			if (source !== current) return;
			try {
				const event = parseVehicleEvent((message as MessageEvent<string>).data);
				if (items.some((item) => item.event.event_id === event.event_id)) return;
				const item = passageItem(event);
				const next = [item, ...items];
				let bytes = next.reduce((total, entry) => total + entry.imageBytes, 0);
				while (next.length > EVENT_LIMIT || bytes > IMAGE_BUDGET) {
					const removed = next.pop()!;
					bytes -= removed.imageBytes;
					releasePassage(removed);
				}
				items = next;
				received += 1;
			} catch {
				invalid += 1;
			}
		});
	}

	// Device changes discard the previous device's feed, even while this tab is hidden.
	$: if (device !== $changeAPI) {
		disconnect();
		clear();
		interrupted = false;
		device = $changeAPI;
		subscribedTo = '';
	}
	$: wanted = active && visible && !paused ? $changeAPI : '';
	$: if (wanted !== subscribedTo) {
		disconnect();
		subscribedTo = wanted;
		if (wanted) connect(wanted);
	}

	onMount(() => {
		const updateVisibility = () => {
			visible = !document.hidden;
		};
		updateVisibility();
		document.addEventListener('visibilitychange', updateVisibility);
		return () => document.removeEventListener('visibilitychange', updateVisibility);
	});
	onDestroy(() => {
		disconnect();
		clear();
	});
</script>

<section class="anpr-view" class:hidden={!active}>
	<header>
		<div>
			<h2>ANPR</h2>
			<p>Completed passages while this view is open. No history replay.</p>
			<p class="image-mode">
				<Hint
					triggerText="Image mode"
					label="Event image modes"
					text={'full: the full frame, with vehicle and plate crops shown here.\nvehicle: the vehicle image and its plate crop.\nplate: only the plate image with OCR boxes.\nnone: recognition data without an image.\n\nCrops and OCR boxes appear when detections are available.'}
				/>:
				<strong
					>{$connection.reachable && $status?.anpr
						? $status.anpr.image || 'none'
						: 'unavailable'}</strong
				>
			</p>
		</div>
		<div class="controls">
			<span class="stream-state" class:live={streamState === 'live'}
				>{paused
					? 'Paused'
					: streamState === 'live'
						? 'Live'
						: streamState === 'reconnecting'
							? 'Reconnecting'
							: 'Connecting'}</span
			>
			<button type="button" class="action-btn secondary" on:click={() => (paused = !paused)}
				>{paused ? 'Resume' : 'Pause'}</button
			>
			<button
				type="button"
				class="action-btn secondary"
				disabled={!items.length && !invalid}
				on:click={clear}>Clear</button
			>
		</div>
	</header>
	{#if $connection.reachable && $status?.anpr?.enabled === false}
		<div class="notice warning">
			ANPR is disabled. Vehicle events still arrive without recognition or images.
			<button type="button" class="action-btn secondary" on:click={() => goToTab('device')}
				>Device settings</button
			>
		</div>
	{:else if $connection.reachable && $status?.anpr?.image === ''}
		<p class="notice">
			Event images are disabled in Device settings. Recognition results are still shown.
		</p>
	{:else if !$connection.reachable || !$status?.anpr}
		<p class="notice">Current ANPR status is unavailable.</p>
	{/if}
	{#if interrupted}<p class="notice">
			Some events may have been missed while disconnected or paused.
		</p>{/if}
	{#if invalid}<p class="notice warning">Skipped {invalid} unsupported or invalid events.</p>{/if}
	<div class="feed-summary">
		{items.length} retained · {received} received. Up to {EVENT_LIMIT} events, limited by image memory.
	</div>
	<div class="feed">
		{#if active}
			{#each items as item (item.event.event_id)}<PassageCard {item} />
			{:else}<p class="empty">
					{paused ? 'Resume to receive new passages.' : 'Waiting for completed passages.'}
				</p>{/each}
		{/if}
	</div>
</section>

<style>
	.anpr-view {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: var(--space-lg);
		background: var(--bg-primary);
	}
	.hidden {
		display: none;
	}
	header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--space-md);
		margin-bottom: var(--space-lg);
	}
	h2 {
		margin: 0 0 var(--space-xs);
		font-size: var(--text-lg);
	}
	header p,
	.feed-summary {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--text-secondary);
	}
	.controls {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--space-sm);
	}
	header .image-mode {
		margin-top: var(--space-xs);
	}
	.stream-state {
		font-size: var(--text-sm);
		color: var(--text-secondary);
	}
	.stream-state.live {
		color: var(--success-primary);
	}
	.notice {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--space-md);
		margin: 0 0 var(--space-md);
		padding: var(--space-md);
		border-radius: var(--radius-sm);
		background: var(--bg-secondary);
		color: var(--text-secondary);
		font-size: var(--text-sm);
	}
	.warning {
		color: var(--warning-text);
		background: var(--warning-bg);
	}
	.feed-summary {
		margin-bottom: var(--space-md);
	}
	.feed {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
	}
	.empty {
		color: var(--text-secondary);
		padding: var(--space-xl) 0;
		text-align: center;
	}
	@media (max-width: 640px) {
		.anpr-view {
			padding: var(--space-md);
		}
	}
</style>
