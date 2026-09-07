<script lang="ts">
  import IPForm from './IPForm.svelte'
  import StylesForm from './StylesForm.svelte'
  import { theme } from '../store/theme'
  import { apiUrlStore, mapStyleStore, DEFAULT_MAP_STYLE_URI, DEFAULT_API_SCHEMA, DEFAULT_API_HOST, DEFAULT_API_PORT } from '../store/state'

  export let klass: string = ''
  export let forceOpen: boolean = false
  export let compact: boolean = false

  let showSettings = false;
  let containerEl: HTMLElement = undefined as any;

  $: effectiveShow = forceOpen || showSettings;

  const resetAllSettings = () => {
      theme.set('system');
      apiUrlStore.schema.set(DEFAULT_API_SCHEMA);
      apiUrlStore.host.set(DEFAULT_API_HOST);
      apiUrlStore.port.set(DEFAULT_API_PORT);
      mapStyleStore.uri.set(DEFAULT_MAP_STYLE_URI);
      mapStyleStore.accepted_uri.set(DEFAULT_MAP_STYLE_URI);
  };

  function handleClickOutside(e: MouseEvent) {
      if (!forceOpen && showSettings && containerEl && !containerEl.contains(e.target as Node)) {
          showSettings = false;
      }
  }
</script>

<svelte:window on:click={handleClickOutside} />

<div class="switcher-container {klass}" class:force-open={forceOpen} class:compact bind:this={containerEl}>
    {#if !forceOpen}
        <button class="settings-toggle" on:click={() => showSettings = !showSettings}>
            <i class="material-icons">settings</i>
            <span>Settings</span>
            <i class="material-icons expand-icon" class:rotated={effectiveShow}>expand_more</i>
        </button>
    {/if}

    {#if effectiveShow}
        <div class="settings-panel">
            <div class="settings-content">
                <div class="form-section">
                    <h4>Theme</h4>
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
                </div>
                
                <div class="form-section">
                    <h4>API Connection</h4>
                    <div class="form-wrapper">
                        <IPForm />
                    </div>
                </div>
                <div class="form-section">
                    <h4>Visual Styles</h4>
                    <div class="form-wrapper">
                        <StylesForm />
                    </div>
                </div>

                <div class="reset-section">
                    <button type="button" class="reset-all-btn" on:click={resetAllSettings}>
                        <i class="material-icons">settings_backup_restore</i>
                        Reset to default
                    </button>
                </div>
            </div>
        </div>
    {/if}
</div>

<style>
  .switcher-container {
      position: fixed;
      top: calc(var(--statusbar-height) + var(--space-sm));
      right: var(--space-lg);
      z-index: 1001;
      transition: right 0.3s ease;
      display: flex;
      gap: var(--space-sm);
      align-items: center;
  }

  .theme-selector {
      display: flex;
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
      transition: background-color 0.2s, color 0.2s, border-color 0.2s;
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

  .settings-toggle {
      display: flex;
      align-items: center;
      gap: var(--space-sm);
      padding: var(--space-md) var(--space-lg);
      background: var(--bg-primary);
      border: 1px solid var(--border-primary);
      border-radius: var(--radius-md);
      box-shadow: 0 2px var(--space-sm) var(--shadow);
      cursor: pointer;
      transition: background-color 0.2s, border-color 0.2s, box-shadow 0.2s;
      font-size: var(--text-md);
      font-weight: 500;
      color: var(--text-primary);
  }

  .settings-toggle:hover {
      background: var(--bg-secondary);
      border-color: var(--border-secondary);
      box-shadow: 0 var(--space-xs) var(--space-md) var(--shadow);
  }

  .expand-icon {
      transition: transform 0.2s;
      font-size: var(--text-lg);
      color: var(--text-secondary);
  }

  .expand-icon.rotated {
      transform: rotate(180deg);
  }

  /* Dropdown panel - fixed width on desktop, full-width when force-open */
  .switcher-container:not(.force-open) .settings-panel {
      width: 380px;
      max-width: calc(100vw - 2rem);
  }

  .settings-panel {
      position: absolute;
      top: calc(100% + var(--space-sm));
      right: 0;
      background: var(--bg-primary);
      border: 1px solid var(--border-primary);
      border-radius: var(--radius-md);
      box-shadow: 0 var(--space-xs) var(--space-xl) var(--shadow);
      animation: slideDown 0.3s ease;
      z-index: 1002;
  }

  .settings-content {
      padding: var(--space-lg);
      display: flex;
      flex-direction: column;
      gap: var(--space-md);
  }

  .form-section {
      display: flex;
      flex-direction: column;
      gap: var(--space-sm);
  }

  .form-section h4 {
      margin: 0;
      font-size: var(--text-sm);
      font-weight: 600;
      color: var(--text-primary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding-bottom: var(--space-xs);
      border-bottom: 1px solid var(--border-secondary);
  }

  .form-wrapper {
    width: 100%;
    max-width: 100%;
    overflow: visible;
  }

  .reset-section {
      padding-top: var(--space-sm);
      border-top: 1px solid var(--border-secondary);
  }

  .reset-all-btn {
      display: flex;
      align-items: center;
      gap: var(--space-xs);
      width: 100%;
      padding: var(--space-xs) 10px;
      background: transparent;
      border: 1px solid var(--border-primary);
      border-radius: var(--radius-sm);
      color: var(--text-secondary);
      font-size: var(--text-base);
      cursor: pointer;
      transition: background-color 0.2s, color 0.2s, border-color 0.2s;
  }

  .reset-all-btn:hover {
      background: var(--bg-secondary);
      color: var(--text-primary);
      border-color: var(--border-secondary);
  }

  .reset-all-btn i {
      font-size: var(--icon-md);
  }

  @keyframes slideDown {
      from {
          opacity: 0;
          transform: translateY(-10px);
      }
      to {
          opacity: 1;
          transform: translateY(0);
      }
  }

  /* Force-open mode: inline full-width panel (used by mobile settings tab) */
  .switcher-container.force-open {
      position: static;
      z-index: auto;
      display: block;
      width: 100%;
      height: 100%;
      overflow-y: auto;
  }

  .force-open .settings-panel {
      position: static;
      width: 100%;
      max-width: 100%;
      border: none;
      border-radius: 0;
      box-shadow: none;
      animation: none;
  }

  /* Compact mode (mobile) - hide floating toggle, show only when force-open */
  .switcher-container.compact:not(.force-open) {
      display: none;
  }

  .switcher-container.compact.force-open {
      flex: 1;
      min-height: 0;
  }
</style>