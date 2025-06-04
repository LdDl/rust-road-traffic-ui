<script lang="ts">
  import IPForm from './IPForm.svelte'
  import StylesForm from './StylesForm.svelte'

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
  }
  
  :global(.toolbar-expanded) .switcher-container {
      right: 220px;
  }
  
  .settings-toggle {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 1rem;
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 0.5rem;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      cursor: pointer;
      transition: all 0.2s;
      font-size: 0.875rem;
      font-weight: 500;
      color: #374151;
  }
  
  .settings-toggle:hover {
      background: #f9fafb;
      border-color: #d1d5db;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }
  
  .expand-icon {
      transition: transform 0.2s;
      font-size: 1rem;
  }
  
  .expand-icon.rotated {
      transform: rotate(180deg);
  }
  
  .settings-panel {
      position: absolute;
      top: calc(100% + 0.5rem);
      right: 0;
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 0.5rem;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
      animation: slideDown 0.2s ease;
      z-index: 1002;
      min-width: 300px;
      max-width: 90vw;
      width: max-content;
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
      color: #374151;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid #e5e7eb;
  }
  
  .form-wrapper {
      width: fit-content;
      min-width: 250px;
  }
  
  :global(.settings-panel form) {
      width: auto !important;
      max-width: none !important;
  }
  
  :global(.settings-panel input),
  :global(.settings-panel select),
  :global(.settings-panel textarea) {
      /* max-width: 300px; */
      box-sizing: border-box;
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