<script lang="ts">
	import PassageImage from './PassageImage.svelte';
	import Hint from './Hint.svelte';
	import { confidenceLabel, type PassageItem } from '$lib/event-images';
	import { formatTimestamp } from '$lib/format';
	import type { OcrObservation } from '$lib/api/vehicle-events';
	export let item: PassageItem;
	$: event = item.event;
	$: ocr = event.plate?.ocr;
	$: stages = item.imageUrl ? item.geometry.stages : [];
	const observations = (values: OcrObservation[]) =>
		values.map((value) => `#${value.attempt}: ${confidenceLabel(value.confidence)}`).join(', ');
</script>

<article class="passage">
	<header>
		<time datetime={event.ended_at} title={event.ended_at}>{formatTimestamp(event.ended_at)}</time>
		<span>{event.vehicle.class}</span>
		{#if ocr?.has_conflicts}<span class="conflict-badge">OCR conflicts</span>{/if}
	</header>
	<div class="chain" style={`--stage-count: ${stages.length + 1}`}>
		{#each stages as stage}
			<div class="stage">
				<PassageImage
					src={item.imageUrl!}
					width={item.geometry.width}
					height={item.geometry.height}
					{stage}
				/>
				<svg
					class="stage-connector"
					viewBox="0 0 24 24"
					aria-hidden="true"
					fill="none"
					stroke="currentColor"
					stroke-width="1.75"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path d="M9 6l6 6-6 6" />
				</svg>
			</div>
		{/each}
		<div class="result">
			<h3>{ocr?.number || (event.plate ? 'Number not recognized' : 'No plate result')}</h3>
			<dl>
				{#if ocr}
					<dt>Mean confidence</dt>
					<dd>{confidenceLabel(ocr.mean_confidence)}</dd>
					<dt>Reference attempt</dt>
					<dd>{ocr.reference_attempt}</dd>
				{/if}
				<dt>Vehicle</dt>
				<dd>{event.vehicle.class} · {confidenceLabel(event.vehicle.confidence)}</dd>
				{#if event.plate}<dt>Plate</dt>
					<dd>{event.plate.class} · {confidenceLabel(event.plate.confidence)}</dd>{/if}
			</dl>
			{#if !item.imageUrl}<p class="hint">{item.imageError ?? 'No image in this event.'}</p>{/if}
		</div>
	</div>
	<details>
		<summary>Details{ocr ? ' and OCR positions' : ''}</summary>
		<dl class="metadata">
			<dt>Started</dt>
			<dd>{formatTimestamp(event.started_at)}</dd>
			<dt>Ended</dt>
			<dd>{formatTimestamp(event.ended_at)}</dd>
			<dt>Equipment</dt>
			<dd>{event.equipment_id}</dd>
			<dt>Track</dt>
			<dd>{event.track_id}</dd>
			<dt>Event</dt>
			<dd>{event.event_id}</dd>
		</dl>
		{#if ocr}
			<div class="table-scroll">
				<table>
					<thead
						><tr
							><th>Position</th><th>Row</th><th>Class</th><th>
								<Hint
									triggerText="Mean confidence"
									label="Mean confidence for this character"
									text="Arithmetic mean of confidence scores for the selected class at this position, across the observations listed here. Alternative classes are excluded."
								/>
							</th><th>
								<Hint
									triggerText="Status"
									label="OCR position status"
									text={'How OCR attempts agree at this position.\n\nsingle: seen in one attempt.\nagreement: the same class in multiple attempts.\nconflict: attempts produced different classes; see Alternatives.'}
								/>
							</th><th>
								<Hint
									triggerText="Observations"
									label="OCR observations"
									text="Attempts that detected the selected class at this position. Each entry shows the attempt number and its confidence, for example #2: 85.0%. Competing classes are listed under Alternatives."
								/>
							</th><th>Alternatives</th></tr
						></thead
					>
					<tbody>
						{#each ocr.positions as position}
							<tr class:conflict={position.status === 'conflict'}>
								<td>{position.position}</td><td>{position.row}</td><td class="symbol"
									>{position.class}</td
								>
								<td>{confidenceLabel(position.mean_confidence)}</td>
								<td
									>{position.status}{#if !position.bbox}<small>No box in reference</small>{/if}</td
								>
								<td>{observations(position.observations)}</td>
								<td
									>{#each position.alternatives as alternative}<div
											title={observations(alternative.observations)}
										>
											{alternative.class} · {confidenceLabel(alternative.mean_confidence)}
										</div>{:else}none{/each}</td
								>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</details>
</article>

<style>
	.passage {
		background: var(--bg-secondary);
		border: 1px solid var(--border-primary);
		border-radius: var(--radius-md);
		padding: var(--space-lg);
	}
	header {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--space-md);
		margin-bottom: var(--space-md);
		font-size: var(--text-sm);
		color: var(--text-secondary);
	}
	time {
		color: var(--text-primary);
		font-variant-numeric: tabular-nums;
	}
	.conflict-badge {
		color: var(--warning-text);
		background: var(--warning-bg);
		padding: 3px 7px;
		border-radius: var(--radius-sm);
	}
	.chain {
		display: grid;
		grid-template-columns: repeat(var(--stage-count), minmax(0, 1fr));
		gap: var(--space-xl);
		align-items: start;
	}
	.stage {
		position: relative;
		min-width: 0;
	}
	.stage-connector {
		position: absolute;
		width: 20px;
		height: 20px;
		left: calc(100% + var(--space-xl) / 2);
		top: 50%;
		transform: translate(-50%, -50%);
		color: var(--text-secondary);
		pointer-events: none;
	}
	.result {
		min-width: 0;
		align-self: center;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
	}
	.result dl {
		text-align: left;
	}
	h3 {
		margin: 0 0 var(--space-md);
		font-size: var(--text-xl);
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
		overflow-wrap: anywhere;
	}
	dl {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: var(--space-xs) var(--space-md);
		margin: 0;
		font-size: var(--text-sm);
	}
	dt {
		color: var(--text-secondary);
	}
	dd {
		margin: 0;
		overflow-wrap: anywhere;
	}
	.hint {
		color: var(--text-secondary);
		font-size: var(--text-sm);
	}
	details {
		margin-top: var(--space-lg);
		border-top: 1px solid var(--border-primary);
		padding-top: var(--space-sm);
	}
	summary {
		cursor: pointer;
		color: var(--text-secondary);
		font-size: var(--text-sm);
	}
	.metadata {
		margin: var(--space-md) 0;
	}
	.table-scroll {
		overflow-x: auto;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--text-sm);
		text-align: left;
	}
	th,
	td {
		padding: var(--space-sm);
		border-bottom: 1px solid var(--border-primary);
	}
	th {
		color: var(--text-secondary);
		font-weight: 500;
	}
	tr.conflict {
		background: var(--warning-bg);
	}
	.symbol {
		font-family: monospace;
		font-weight: 600;
		font-size: var(--text-lg);
	}
	small {
		display: block;
		color: var(--text-secondary);
	}
	@media (max-width: 1100px) {
		.chain {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.stage-connector {
			display: none;
		}
	}
	@media (max-width: 640px) {
		.chain {
			grid-template-columns: 1fr;
		}
		.passage {
			padding: var(--space-md);
		}
	}
</style>
