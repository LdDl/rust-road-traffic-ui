<script lang="ts">
	export let result: { kind: 'ok' | 'same' | 'error'; text: string } | undefined = undefined;
	/** How many fields of the section differ from what the device holds */
	export let changes = 0;
	export let busy = false;
	/** Required fields left empty; applying them would only be refused */
	export let missing: string[] = [];
	export let onApply: () => void;
	export let onRevert: () => void;
</script>

<footer class="section-footer">
	<div class="messages">
		{#if missing.length > 0}
			<p class="message error">
				<i class="material-icons">error_outline</i>Required: {missing.join(', ')}
			</p>
		{:else if result?.kind === 'error'}
			<!-- The refused value is still in the form, so this outranks "not applied" -->
			<p class="message error"><i class="material-icons">error_outline</i>{result.text}</p>
		{:else if changes > 0}
			<p class="message pending">
				<i class="material-icons">edit_note</i>{changes === 1 ? '1 change' : `${changes} changes`}
				not applied
			</p>
		{:else if result}
			<p class="message {result.kind}">
				<i class="material-icons">{result.kind === 'ok' ? 'check_circle' : 'info'}</i>{result.text}
			</p>
		{/if}
	</div>
	<div class="buttons">
		<button
			type="button"
			class="action-btn secondary"
			disabled={changes === 0 || busy}
			on:click={onRevert}
		>
			Reset
		</button>
		<button
			type="button"
			class="action-btn primary"
			disabled={changes === 0 || busy || missing.length > 0}
			on:click={onApply}
		>
			{busy ? 'Applying' : 'Apply'}
		</button>
	</div>
</footer>

<style>
	.section-footer {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--space-sm) var(--space-md);
		margin-top: var(--space-lg);
		padding-top: var(--space-md);
		border-top: 1px solid var(--border-primary);
	}

	.messages {
		flex: 1 1 200px;
		min-width: 0;
	}

	.message {
		margin: 0;
		font-size: var(--text-base);
		line-height: 1.4;
		overflow-wrap: anywhere;
	}

	.message.ok {
		color: var(--success-primary);
	}

	.message i {
		margin-right: var(--space-xs);
		font-size: var(--icon-sm);
		vertical-align: -3px;
	}

	.message.same {
		color: var(--text-secondary);
	}

	.message.pending {
		color: var(--warning-text);
		font-weight: 500;
	}

	.message.error {
		color: var(--danger-primary);
	}

	.buttons {
		display: flex;
		gap: var(--space-sm);
		margin-left: auto;
	}
</style>
