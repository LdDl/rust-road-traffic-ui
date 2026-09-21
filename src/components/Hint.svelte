<script lang="ts">
	import { onDestroy } from 'svelte';
	import { registerEscapeLayer } from '$lib/escape_stack';

	/**
	 * A question mark that explains one number or one control. The bubble is
	 * positioned fixed because the app shell clips overflow at every level
	 */
	export let text: string;
	export let label: string = 'What this means';
	export let size: 'sm' | 'md' = 'sm';

	const BUBBLE_WIDTH = 260;
	const GAP = 6;
	const EDGE = 8;

	let trigger: HTMLButtonElement;
	let open = false;
	let bubbleStyle = '';

	const place = () => {
		const rect = trigger.getBoundingClientRect();
		const left = Math.min(
			Math.max(EDGE, rect.left + rect.width / 2 - BUBBLE_WIDTH / 2),
			window.innerWidth - BUBBLE_WIDTH - EDGE
		);
		bubbleStyle = `top: ${rect.bottom + GAP}px; left: ${left}px; width: ${BUBBLE_WIDTH}px;`;
	};

	const toggle = () => {
		open = !open;
		if (open) place();
	};

	const close = () => {
		open = false;
	};

	let releaseEscape: (() => void) | undefined;

	function updateEscapeLayer(isOpen: boolean) {
		releaseEscape?.();
		releaseEscape = isOpen ? registerEscapeLayer(close) : undefined;
	}

	$: updateEscapeLayer(open);

	onDestroy(() => releaseEscape?.());

	// Closing on pointerdown rather than through a backdrop, so that clicking another
	// hint moves straight to it instead of only dismissing this one
	const onWindowPointerDown = (event: PointerEvent) => {
		if (!open) return;
		if (trigger && event.target instanceof Node && trigger.contains(event.target)) return;
		close();
	};
</script>

<svelte:window on:pointerdown={onWindowPointerDown} on:resize={close} on:scroll={close} />

<span class="hint" class:md={size === 'md'}>
	<button
		bind:this={trigger}
		type="button"
		class="hint-trigger"
		class:active={open}
		aria-label={label}
		aria-expanded={open}
		on:click|stopPropagation={toggle}
	>
		<i class="material-icons">help_outline</i>
	</button>
</span>

{#if open}
	<span class="hint-bubble" role="tooltip" style={bubbleStyle}>{text}</span>
{/if}

<style>
	.hint {
		display: inline-flex;
		align-items: center;
	}

	.hint-trigger {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0;
		border: none;
		background: none;
		color: var(--text-secondary);
		cursor: pointer;
		opacity: 0.6;
		transition:
			opacity 0.15s ease,
			color 0.15s ease;
	}

	.hint-trigger:hover,
	.hint-trigger.active {
		opacity: 1;
		color: var(--accent-primary);
	}

	.hint-trigger i {
		font-size: var(--icon-xs);
	}

	.hint.md .hint-trigger i {
		font-size: var(--icon-sm);
	}

	.hint-bubble {
		position: fixed;
		z-index: 1102;
		padding: var(--space-sm) var(--space-md);
		background: var(--bg-secondary);
		color: var(--text-primary);
		border: 1px solid var(--border-primary);
		border-radius: var(--radius-md);
		box-shadow: 0 var(--space-xs) var(--space-md) var(--shadow);
		font-size: var(--text-sm);
		line-height: 1.45;
		font-weight: 400;
	}
</style>
