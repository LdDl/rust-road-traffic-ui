<script lang="ts">
	import type { ImageStage } from '$lib/event-images';
	export let src: string;
	export let width: number;
	export let height: number;
	export let stage: ImageStage;
	let failed = false;
	$: viewBox = `${stage.crop.x} ${stage.crop.y} ${stage.crop.width} ${stage.crop.height}`;
</script>

<figure>
	<figcaption>{stage.label}</figcaption>
	{#if failed}
		<p>Image unavailable</p>
	{:else}
		<svg {viewBox} role="img" aria-label={stage.label}>
			<svg
				x={stage.crop.x}
				y={stage.crop.y}
				width={stage.crop.width}
				height={stage.crop.height}
				{viewBox}
				overflow="hidden"
			>
				<image href={src} x="0" y="0" {width} {height} on:error={() => (failed = true)} />
				{#each stage.boxes as box}
					<rect
						x={box.bbox.x}
						y={box.bbox.y}
						width={box.bbox.width}
						height={box.bbox.height}
						class:conflict={box.conflict}
						fill="none"
						stroke-width="1.5"
						vector-effect="non-scaling-stroke"
					>
						<title>{box.label}{box.conflict ? ' (conflict)' : ''}</title>
					</rect>
				{/each}
			</svg>
		</svg>
	{/if}
</figure>

<style>
	figure {
		margin: 0;
		min-width: 0;
	}
	figcaption {
		margin-bottom: var(--space-sm);
		font-size: var(--text-sm);
		color: var(--text-secondary);
	}
	figure > svg {
		display: block;
		width: 100%;
		height: 200px;
		border-radius: var(--radius-sm);
		background: #111;
	}
	rect {
		stroke: #4ade80;
	}
	rect.conflict {
		stroke: #fbbf24;
	}
	p {
		color: var(--text-secondary);
		font-size: var(--text-sm);
	}
</style>
