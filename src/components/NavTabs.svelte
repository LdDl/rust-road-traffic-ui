<script lang="ts">
	import { activeTab, goToTab, TABS } from '../store/navigation';
</script>

<nav class="tabs" aria-label="Sections">
	{#each TABS as tab (tab.id)}
		<button
			type="button"
			class="tab"
			class:active={$activeTab === tab.id}
			aria-current={$activeTab === tab.id ? 'page' : undefined}
			title={tab.description}
			on:click={() => goToTab(tab.id)}
		>
			<i class="material-icons">{tab.icon}</i>
			<span class="tab-label">{tab.label}</span>
		</button>
	{/each}
</nav>

<style>
	.tabs {
		display: flex;
		align-items: stretch;
		height: 100%;
	}

	.tab {
		display: inline-flex;
		align-items: center;
		gap: var(--space-xs);
		height: 100%;
		padding: 0 var(--space-md);
		border: none;
		/* The marker sits inside the height, so switching tabs moves nothing */
		border-bottom: 2px solid transparent;
		background: none;
		color: var(--text-secondary);
		font-size: var(--text-md);
		font-family: inherit;
		line-height: 1;
		cursor: pointer;
		transition:
			color 0.15s ease,
			background-color 0.15s ease;
	}

	.tab i {
		font-size: var(--icon-md);
	}

	.tab:hover {
		color: var(--text-primary);
		background: var(--bg-tertiary);
	}

	.tab.active {
		color: var(--accent-primary);
		border-bottom-color: var(--accent-primary);
		font-weight: 500;
	}

	@media (max-width: 640px) {
		.tab {
			padding: 0 var(--space-sm);
		}

		.tab-label {
			display: none;
		}
	}
</style>
