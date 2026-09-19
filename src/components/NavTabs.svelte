<script lang="ts">
	import { activeTab, goToTab, tabBadges, TABS } from '../store/navigation';
</script>

<nav class="tabs" aria-label="Sections">
	{#each TABS as tab (tab.id)}
		<button
			type="button"
			class="tab"
			class:active={$activeTab === tab.id}
			aria-current={$activeTab === tab.id ? 'page' : undefined}
			title={($tabBadges[tab.id] ?? 0) > 0
				? `${tab.description}. ${$tabBadges[tab.id]} not applied`
				: tab.description}
			on:click={() => goToTab(tab.id)}
		>
			<span class="tab-icon">
				<i class="material-icons">{tab.icon}</i>
				{#if ($tabBadges[tab.id] ?? 0) > 0}
					<span class="tab-count corner" aria-label="{$tabBadges[tab.id]} not applied"
						>{$tabBadges[tab.id]}</span
					>
				{/if}
			</span>
			<span class="tab-label">{tab.label}</span>
			{#if ($tabBadges[tab.id] ?? 0) > 0}
				<span class="tab-count inline" aria-label="{$tabBadges[tab.id]} not applied"
					>{$tabBadges[tab.id]}</span
				>
			{/if}
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

	.tab-icon {
		position: relative;
		display: inline-flex;
	}

	/* The same amber as Save and Restart in the header: something is started and not finished */
	.tab-count {
		min-width: 16px;
		height: 16px;
		padding: 0 4px;
		box-sizing: border-box;
		border-radius: 8px;
		background: var(--warning-text);
		color: var(--bg-primary);
		font-size: var(--text-2xs);
		font-weight: 600;
		line-height: 16px;
		text-align: center;
		font-variant-numeric: tabular-nums;
	}

	/* Next to the label while there is one: pinned to the icon it would sit on the first letter */
	.tab-count.inline {
		display: inline-block;
		margin-left: var(--space-2xs);
	}

	.tab-count.corner {
		display: none;
		position: absolute;
		top: -6px;
		right: -9px;
		box-shadow: 0 0 0 2px var(--bg-secondary);
	}

	@media (max-width: 640px) {
		.tab-count.inline {
			display: none;
		}

		.tab-count.corner {
			display: block;
		}
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
