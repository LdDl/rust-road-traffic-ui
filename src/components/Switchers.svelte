<script lang="ts">
  import IPForm from './IPForm.svelte'
  import StylesForm from './StylesForm.svelte'
  import { theme } from '../store/theme'
  import { apiUrlStore, mapStyleStore, DEFAULT_MAP_STYLE_URI, DEFAULT_API_SCHEMA, DEFAULT_API_HOST, DEFAULT_API_PORT } from '../store/state'

  export let klass: string = ''
  export let forceOpen: boolean = false

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

<div class="switcher-container {klass}" class:force-open={forceOpen} bind:this={containerEl}>
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
      top: 1rem;
      right: 1rem;
      z-index: 1001;
      transition: right 0.3s ease;
      display: flex;
      gap: 0.5rem;
      align-items: center;
  }
  
  .theme-selector {
      display: flex;
      gap: 0.5rem;
  }

  .theme-option {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.375rem 0.625rem;
      background: var(--bg-secondary);
      border: 1px solid var(--border-primary);
      border-radius: var(--radius-sm);
      cursor: pointer;
      transition: all 0.2s;
      color: var(--text-secondary);
      font-size: 0.8rem;
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
      gap: 0.5rem;
      padding: 0.75rem 1rem;
      background: var(--bg-primary);
      border: 1px solid var(--border-primary);
      border-radius: var(--radius-md);
      box-shadow: 0 2px 8px var(--shadow);
      cursor: pointer;
      transition: all 0.2s;
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--text-primary);
  }
  
  .settings-toggle:hover {
      background: var(--bg-secondary);
      border-color: var(--border-secondary);
      box-shadow: 0 4px 12px var(--shadow);
  }
  
  .expand-icon {
      transition: transform 0.2s;
      font-size: 1rem;
      color: var(--text-secondary);
  }
  
  .expand-icon.rotated {
      transform: rotate(180deg);
  }
  
  .settings-panel {
      position: absolute;
      top: calc(100% + 0.5rem);
      right: 0;
      background: var(--bg-primary);
      border: 1px solid var(--border-primary);
      border-radius: var(--radius-md);
      box-shadow: 0 4px 20px var(--shadow);
      animation: slideDown 0.3s ease;
      z-index: 1002;
      width: 380px;
      max-width: calc(100vw - 2rem);
  }

  .settings-content {
      padding: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
  }

  .form-section {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
  }

  .form-section h4 {
      margin: 0;
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--text-primary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding-bottom: 0.375rem;
      border-bottom: 1px solid var(--border-secondary);
  }
  
  .form-wrapper {
    width: 100%;
    max-width: 100%;
    overflow: visible;
  }
  
  :global(.settings-panel .api-form),
  :global(.settings-panel .styles-form) {
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
  }
  
  :global(.settings-panel input),
  :global(.settings-panel select),
  :global(.settings-panel textarea) {
      box-sizing: border-box;
      max-width: 100%;
  }
  
  .reset-section {
      padding-top: 0.5rem;
      border-top: 1px solid var(--border-secondary);
  }

  .reset-all-btn {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      width: 100%;
      padding: 0.4rem 0.625rem;
      background: transparent;
      border: 1px solid var(--border-primary);
      border-radius: var(--radius-sm);
      color: var(--text-secondary);
      font-size: 0.8rem;
      cursor: pointer;
      transition: all 0.2s;
  }

  .reset-all-btn:hover {
      background: var(--bg-secondary);
      color: var(--text-primary);
      border-color: var(--border-secondary);
  }

  .reset-all-btn i {
      font-size: 18px;
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
      width: 100% !important;
      max-width: 100% !important;
      border: none;
      border-radius: 0;
      box-shadow: none;
      animation: none;
  }
</style>