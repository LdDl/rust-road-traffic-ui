<script lang="ts">
	import IPForm from './IPForm.svelte';
	import StylesForm from './StylesForm.svelte';
	import { theme } from '../store/theme';
	import {
		apiUrlStore,
		mapStyleStore,
		DEFAULT_MAP_STYLE_URI,
		DEFAULT_API_SCHEMA,
		DEFAULT_API_HOST,
		DEFAULT_API_PORT
	} from '../store/state';

	const resetAllSettings = () => {
		theme.set('system');
		apiUrlStore.schema.set(DEFAULT_API_SCHEMA);
		apiUrlStore.host.set(DEFAULT_API_HOST);
		apiUrlStore.port.set(DEFAULT_API_PORT);
		mapStyleStore.uri.set(DEFAULT_MAP_STYLE_URI);
		mapStyleStore.accepted_uri.set(DEFAULT_MAP_STYLE_URI);
	};
</script>

<div class="settings-content">
	<section class="form-section">
		<h3>Theme</h3>
		<div class="theme-selector">
			<button
				class="theme-option"
				class:active={$theme === 'system'}
				on:click={() => theme.set('system')}
			>
				<i class="material-icons">settings_brightness</i>
				<span>System</span>
			</button>
			<button
				class="theme-option"
				class:active={$theme === 'light'}
				on:click={() => theme.set('light')}
			>
				<i class="material-icons">light_mode</i>
				<span>Light</span>
			</button>
			<button
				class="theme-option"
				class:active={$theme === 'dark'}
				on:click={() => theme.set('dark')}
			>
				<i class="material-icons">dark_mode</i>
				<span>Dark</span>
			</button>
		</div>
	</section>

	<section class="form-section">
		<h3>Device address</h3>
		<p class="section-note">Where this page looks for the traffic detector.</p>
		<IPForm />
	</section>

	<section class="form-section">
		<h3>Map style</h3>
		<p class="section-note">
			The map behind the zones. A style URL that fails to load falls back to a blank map, and the
			zones stay where they are.
		</p>
		<StylesForm />
	</section>

	<section class="reset-section">
		<button type="button" class="reset-all-btn" on:click={resetAllSettings}>
			<i class="material-icons">settings_backup_restore</i>
			Reset to default
		</button>
	</section>
</div>

<style>
	.settings-content {
		display: flex;
		flex-direction: column;
		gap: var(--space-xl);
	}

	.form-section {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.form-section h3 {
		margin: 0;
		padding-bottom: var(--space-xs);
		border-bottom: 1px solid var(--border-secondary);
		font-size: var(--text-sm);
		font-weight: 600;
		color: var(--text-primary);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.section-note {
		margin: 0 0 var(--space-xs) 0;
		color: var(--text-secondary);
		font-size: var(--text-base);
		line-height: 1.5;
	}

	.theme-selector {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-sm);
	}

	.theme-option {
		display: flex;
		align-items: center;
		gap: var(--space-xs);
		padding: var(--space-xs) var(--space-md);
		background: var(--bg-secondary);
		border: 1px solid var(--border-primary);
		border-radius: var(--radius-sm);
		cursor: pointer;
		transition:
			background-color 0.2s,
			color 0.2s,
			border-color 0.2s;
		color: var(--text-secondary);
		font-size: var(--text-base);
	}

	.theme-option:hover {
		background: var(--bg-tertiary);
		color: var(--text-primary);
	}

	.theme-option.active {
		background: var(--accent-primary);
		color: white;
		border-color: var(--accent-primary);
	}

	.reset-section {
		padding-top: var(--space-md);
		border-top: 1px solid var(--border-secondary);
	}

	.reset-all-btn {
		display: flex;
		align-items: center;
		gap: var(--space-xs);
		padding: var(--space-xs) var(--space-md);
		background: transparent;
		border: 1px solid var(--border-primary);
		border-radius: var(--radius-sm);
		color: var(--text-secondary);
		font-size: var(--text-base);
		cursor: pointer;
		transition:
			background-color 0.2s,
			color 0.2s,
			border-color 0.2s;
	}

	.reset-all-btn:hover {
		background: var(--bg-secondary);
		color: var(--text-primary);
		border-color: var(--border-secondary);
	}

	.reset-all-btn i {
		font-size: var(--icon-md);
	}
</style>
