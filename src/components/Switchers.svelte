<script lang="ts">
  import IPForm from './IPForm.svelte'
  import StylesForm from './StylesForm.svelte'
  import { theme, toggleTheme } from '../store/theme'

  export let klass: string = ''
  
  let showSettings = false;
</script>

<div class="switcher-container {klass}">
    <button class="settings-toggle" on:click={() => showSettings = !showSettings}>
        <i class="material-icons">settings</i>
        <span>Settings</span>
        <i class="material-icons expand-icon" class:rotated={showSettings}>expand_more</i>
    </button>
  
    {#if showSettings}
        <div class="settings-panel">
            <div class="settings-content">
                <div class="form-section">
                    <h4>Theme</h4>
                    <div class="theme-selector">
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
      gap: 0.5rem;
      padding: 0.5rem 0.75rem;
      background: var(--bg-secondary);
      border: 1px solid var(--border-primary);
      border-radius: 0.375rem;
      cursor: pointer;
      transition: all 0.2s;
      color: var(--text-secondary);
      font-size: 0.875rem;
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
  
  :global(.toolbar-expanded) .switcher-container {
      right: 220px;
  }
  
  .settings-toggle {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 1rem;
      background: var(--bg-primary);
      border: 1px solid var(--border-primary);
      border-radius: 0.5rem;
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
      border-radius: 0.5rem;
      box-shadow: 0 4px 20px var(--shadow);
      animation: slideDown 0.3s ease;
      z-index: 1002;
      width: 420px;
      max-width: 90vw;
  }
  
  .settings-content {
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
  }
  
  .form-section {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
  }
  
  .form-section h4 {
      margin: 0;
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--text-primary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid var(--border-secondary);
  }
  
  .form-wrapper {
    width: calc(100% - 0rem); /* Slight adjustment to prevent overflow */
    max-width: 100%;
    overflow: hidden;
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
</style>