<script lang="ts">
	import { onDestroy } from 'svelte';
	import BrowserSettings from './BrowserSettings.svelte';
	import { registerEscapeLayer } from '$lib/escape_stack';

	export let open = false;
	export let top = 0;
	export let onClose: () => void;

	let panel: HTMLElement | undefined;

	// No backdrop on purpose: the frame and the map stay live behind the panel, which is
	// the whole point of these settings. A click outside closes it and still reaches the map
	const onWindowPointerDown = (event: PointerEvent) => {
		if (!open || !panel) return;
		const target = event.target;
		if (!(target instanceof Node)) return;
		if (panel.contains(target)) return;
		if (target instanceof Element && target.closest('.settings-toggle')) return;
		onClose();
	};

	let releaseEscape: (() => void) | undefined;

	function updateEscapeLayer(isOpen: boolean) {
		releaseEscape?.();
		releaseEscape = isOpen ? registerEscapeLayer(onClose) : undefined;
	}

	$: updateEscapeLayer(open);

	onDestroy(() => releaseEscape?.());
</script>

<svelte:window on:pointerdown={onWindowPointerDown} />

{#if open}
	<aside
		class="settings-panel"
		bind:this={panel}
		style="--panel-top: {top}px;"
		aria-label="View settings"
	>
		<header class="panel-header">
			<h2>View settings</h2>
			<button type="button" class="panel-close" aria-label="Close settings" on:click={onClose}>
				<i class="material-icons">close</i>
			</button>
		</header>

		<p class="panel-note">
			Stored in this browser. They change what this page shows, not how the device works, so the
			frame and the map behind update as you go.
		</p>

		<BrowserSettings />
	</aside>
{/if}

<style>
	.settings-panel {
		position: fixed;
		top: var(--panel-top);
		right: 0;
		width: 360px;
		max-height: calc(100vh - var(--panel-top));
		overflow-y: auto;
		padding: var(--space-lg);
		background: var(--bg-secondary);
		border-left: 1px solid var(--border-primary);
		border-bottom: 1px solid var(--border-primary);
		box-shadow: 0 var(--space-sm) var(--space-lg) var(--shadow);
		z-index: 1101;
	}

	/* Below 1024 the workspace itself stacks vertically, so a side panel would sit on top of
	   it. The panel becomes a sheet on the lower half instead, leaving the frame and the map
	   in view above it: that is the width an installer works at, on a phone or a small tablet */
	@media (max-width: 1024px) {
		.settings-panel {
			top: auto;
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

	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-sm);
		margin-bottom: var(--space-sm);
	}

	.panel-header h2 {
		margin: 0;
		font-size: var(--text-md);
		font-weight: 600;
		color: var(--text-primary);
	}

	.panel-close {
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

	.panel-close:hover {
		background: var(--bg-tertiary);
		color: var(--text-primary);
	}

	.panel-close i {
		font-size: var(--icon-md);
	}

	.panel-note {
		margin: 0 0 var(--space-xl) 0;
		color: var(--text-secondary);
		font-size: var(--text-base);
		line-height: 1.5;
	}
</style>
