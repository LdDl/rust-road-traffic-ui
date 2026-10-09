<script lang="ts">
	import type { InferenceModelSettings } from '$lib/api/types';

	export let title: string;
	export let path: string;
	export let model: InferenceModelSettings;
	export let issues: Record<string, string> = {};

	const thresholds = ['conf_threshold', 'nms_threshold'] as const;
	const dimensions = ['net_width', 'net_height'] as const;
	let classesText = '';
	let observedClasses: string[] | undefined;
	$: if (model.net_classes !== observedClasses) {
		observedClasses = model.net_classes;
		classesText = model.net_classes.join('\n');
	}

	function updateClasses(value: string) {
		classesText = value;
		model.net_classes = value === '' ? [] : value.split('\n').map((item) => item.trim());
		observedClasses = model.net_classes;
	}
</script>

<fieldset>
	<legend>{title}</legend>
	<div class="fields">
		<label class="wide">
			<span>Model path</span>
			<input
				type="text"
				spellcheck="false"
				autocomplete="off"
				bind:value={model.network_weights}
				class:invalid={!!issues[`${path}.network_weights`]}
			/>
			{#if issues[`${path}.network_weights`]}<small class="error"
					>{issues[`${path}.network_weights`]}</small
				>{/if}
		</label>
		{#each thresholds as field}
			<label>
				<span>{field === 'conf_threshold' ? 'Confidence threshold' : 'NMS threshold'}</span>
				<input
					type="number"
					min="0"
					max="1"
					step="0.05"
					bind:value={model[field]}
					class:invalid={!!issues[`${path}.${field}`]}
				/>
				{#if issues[`${path}.${field}`]}<small class="error">{issues[`${path}.${field}`]}</small
					>{/if}
			</label>
		{/each}
		{#each dimensions as field}
			<label>
				<span>{field === 'net_width' ? 'Input width' : 'Input height'}</span>
				<input
					type="number"
					min="1"
					step="1"
					placeholder="Automatic"
					bind:value={model[field]}
					class:invalid={!!issues[`${path}.${field}`] || !!issues[`${path}.net_width/net_height`]}
				/>
				{#if issues[`${path}.${field}`]}<small class="error">{issues[`${path}.${field}`]}</small
					>{/if}
			</label>
		{/each}
		{#if issues[`${path}.net_width/net_height`]}<small class="wide error"
				>{issues[`${path}.net_width/net_height`]}</small
			>{/if}
		<p class="wide hint">Set both dimensions or leave both empty.</p>
		<label class="wide">
			<span>Classes</span>
			<textarea
				rows="4"
				spellcheck="false"
				value={classesText}
				on:input={(event) => updateClasses(event.currentTarget.value)}
				class:invalid={!!issues[`${path}.net_classes`]}
			></textarea>
			{#if issues[`${path}.net_classes`]}<small class="error">{issues[`${path}.net_classes`]}</small
				>{/if}
			<small class="hint">One class per line, in model output order.</small>
		</label>
	</div>
</fieldset>

<style>
	fieldset {
		min-width: 0;
		margin: var(--space-lg) 0 0;
		padding: 0;
		border: 0;
	}
	legend {
		margin-bottom: var(--space-md);
		font-size: var(--text-md);
		font-weight: 600;
		color: var(--text-primary);
	}
	.fields {
		display: grid;
		grid-template-columns: 1fr;
		gap: var(--space-md);
	}
	label {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
		min-width: 0;
	}
	label > span {
		color: var(--text-secondary);
		font-size: var(--text-sm);
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
	input,
	textarea {
		box-sizing: border-box;
		width: 100%;
		min-width: 0;
		min-height: 40px;
		padding: var(--space-sm) 10px;
		border: 1px solid var(--border-primary);
		border-radius: var(--radius-sm);
		background: var(--bg-primary);
		color: var(--text-primary);
		font: inherit;
		font-size: var(--text-md);
	}
	input[type='text'],
	textarea {
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
	}
	textarea {
		resize: vertical;
	}
	input:focus,
	textarea:focus {
		outline: none;
		border-color: var(--accent-primary);
		box-shadow: 0 0 0 3px rgba(var(--accent-primary-rgb), 0.1);
	}
	.invalid {
		border-color: var(--danger-primary);
	}
	.hint,
	.error {
		margin: 0;
		font-size: var(--text-sm);
		line-height: 1.4;
	}
	.hint {
		color: var(--text-secondary);
	}
	.error {
		color: var(--danger-primary);
	}
	@media (min-width: 640px) {
		.fields {
			grid-template-columns: 1fr 1fr;
		}
		.wide {
			grid-column: 1 / -1;
		}
	}
	@media (max-width: 1024px) {
		input,
		textarea {
			font-size: var(--text-lg);
		}
	}
</style>
