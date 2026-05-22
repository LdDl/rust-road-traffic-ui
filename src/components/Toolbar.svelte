<script lang="ts">
    import { state } from '../store/state.js';
    import { States } from '$lib/states.js';
    
    export let onAddToCanvas: () => void;
    export let onDeleteFromCanvas: () => void;
    export let onAddToMap: () => void;
    export let onDeleteFromMap: () => void;
    export let onSave: () => void | Promise<void>;
    export let compact: boolean = false;
    export let landscape: boolean = false;

    let stateVariable: States;
    state.subscribe((value) => stateVariable = value);

    let collapsed = true;
    let saving = false;
    let saveResult: 'success' | 'error' | null = null;

    const handleSave = async () => {
        saving = true;
        saveResult = null;
        try {
            await onSave();
            saveResult = 'success';
        } catch {
            saveResult = 'error';
        } finally {
            saving = false;
            setTimeout(() => { saveResult = null; }, 2000);
        }
    };
</script>

<div class="toolbar-side" class:collapsed class:compact class:landscape>
    <button class="toolbar-toggle" on:click={() => collapsed = !collapsed}>
        <i class="material-icons">{collapsed ? 'chevron_left' : 'chevron_right'}</i>
    </button>
    
    <div class="toolbar-content">
        <div class="toolbar-group">
            <div class="group-header">
                <div class="group-label">Canvas</div>
                <div class="group-icon">
                    <i class="material-icons">grid_on</i>
                </div>
            </div>
            <button 
                class="tool-btn"
                class:active={stateVariable === States.AddingZoneCanvas}
                on:click={onAddToCanvas}
                title="Add zone to canvas"
            >
                <i class="material-icons">add</i>
                <span>Add Zone</span>
            </button>
            <button 
                class="tool-btn danger"
                class:active={stateVariable === States.DeletingZoneCanvas}
                on:click={onDeleteFromCanvas}
                title="Delete zone from canvas"
            >
                <i class="material-icons">delete</i>
                <span>Delete</span>
            </button>
        </div>
        
        <div class="toolbar-separator"></div>
        
        <div class="toolbar-group">
            <div class="group-header">
                <div class="group-label">Map</div>
                <div class="group-icon">
                    <i class="material-icons">map</i>
                </div>
            </div>
            <button 
                class="tool-btn"
                class:active={stateVariable === States.AddingZoneMap}
                on:click={onAddToMap}
                title="Add zone to map"
            >
                <i class="material-icons">add_location</i>
                <span>Add Zone</span>
            </button>
            <button 
                class="tool-btn danger"
                class:active={stateVariable === States.DeletingZoneMap}
                on:click={onDeleteFromMap}
                title="Delete zone from map"
            >
                <i class="material-icons">location_off</i>
                <span>Delete</span>
            </button>
        </div>
        
        <div class="toolbar-separator"></div>
        
        <div class="toolbar-group">
            <button
                class="tool-btn success"
                class:save-ok={saveResult === 'success'}
                class:save-err={saveResult === 'error'}
                on:click={handleSave}
                disabled={saving}
                title="Save all changes"
            >
                <i class="material-icons">
                    {#if saving}hourglass_empty{:else if saveResult === 'success'}check{:else if saveResult === 'error'}error_outline{:else}save{/if}
                </i>
                <span>{saving ? 'Saving...' : saveResult === 'success' ? 'Saved!' : saveResult === 'error' ? 'Error' : 'Save'}</span>
            </button>
        </div>
    </div>
</div>

<style>
    .toolbar-side {
        position: fixed;
        right: 0;
        top: 50%;
        transform: translateY(-50%);
        background: var(--bg-primary);
        border-radius: var(--radius-md) 0 0 var(--radius-md);
        box-shadow: -2px 0 var(--space-md) var(--shadow);
        z-index: 1000;
        transition: width 0.3s ease;
        width: 200px;
        border: 1px solid var(--border-primary);
        border-right: none;
    }

    .toolbar-side.collapsed {
        width: 60px;
    }

    .toolbar-toggle {
        position: absolute;
        top: var(--space-lg);
        left: -12px;
        width: var(--space-2xl);
        height: var(--space-2xl);
        background: var(--bg-primary);
        border: 1px solid var(--border-primary);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        font-size: var(--icon-lg);
        color: var(--text-secondary);
        box-shadow: -2px 0 var(--space-sm) var(--shadow);
        transition: background-color 0.2s, color 0.2s;
    }

    /* Expand touch target to 44px without changing visual size */
    .toolbar-toggle::after {
        content: '';
        position: absolute;
        inset: -10px;
    }

    .toolbar-toggle:hover {
        background: var(--bg-secondary);
        color: var(--text-primary);
    }

    .toolbar-content {
        padding: var(--space-lg);
        display: flex;
        flex-direction: column;
        gap: var(--space-md);
    }

    .toolbar-group {
        display: flex;
        flex-direction: column;
        gap: var(--space-sm);
    }

    .group-header {
        position: relative;
        height: var(--space-xl);
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: var(--space-xs);
    }

    .group-label {
        font-size: var(--text-sm);
        font-weight: 600;
        color: var(--text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        white-space: nowrap;
        transition: opacity 0.3s ease;
        position: absolute;
        width: 100%;
        text-align: center;
    }

    .group-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--text-secondary);
        font-size: var(--text-lg);
        opacity: 0;
        transition: opacity 0.3s ease;
        position: absolute;
        width: 100%;
    }

    .collapsed .group-label {
        opacity: 0;
    }

    .collapsed .group-icon {
        opacity: 1;
    }

    .toolbar-separator {
        height: 1px;
        background: linear-gradient(to right, transparent, var(--border-primary), transparent);
        margin: var(--space-xs) 0;
    }

    .collapsed .toolbar-separator {
        margin: var(--space-xs) var(--space-md);
    }

    .tool-btn {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
        padding: var(--space-md);
        border: 1px solid var(--border-primary);
        border-radius: var(--radius-sm);
        background: var(--bg-primary);
        color: var(--text-primary);
        cursor: pointer;
        transition: background-color 0.2s, border-color 0.2s, color 0.2s;
        font-size: var(--text-md);
        white-space: nowrap;
    }

    .tool-btn:hover {
        background: var(--bg-secondary);
        border-color: var(--border-secondary);
    }

    .tool-btn.active {
        background: var(--accent-primary);
        color: white;
        border-color: var(--accent-primary);
    }

    .tool-btn.active:hover {
        background: var(--accent-hover);
        border-color: var(--accent-hover);
    }

    .tool-btn.danger.active {
        background: var(--danger-primary);
        border-color: var(--danger-primary);
    }

    .tool-btn.danger.active:hover {
        background: var(--danger-hover);
        border-color: var(--danger-hover);
    }

    .tool-btn.success {
        background: var(--success-primary);
        color: white;
        border-color: var(--success-primary);
    }

    .tool-btn.success:hover:not(:disabled) {
        background: var(--success-hover);
        border-color: var(--success-hover);
    }

    .tool-btn.success:disabled {
        opacity: 0.7;
        cursor: wait;
    }

    /* save-ok/save-err override .success via higher specificity (2 classes) */
    .tool-btn.save-ok {
        background: var(--success-primary);
        border-color: var(--success-primary);
    }

    .tool-btn.save-err {
        background: var(--danger-primary);
        border-color: var(--danger-primary);
    }

    .collapsed .tool-btn {
        justify-content: center;
    }

    .collapsed .tool-btn span {
        display: none;
    }

    /* Compact mode (mobile/tablet <=1024px) - centered in work area (below tab bar ~50px) */
    .toolbar-side.compact {
        top: calc(50% + 25px);
        bottom: auto;
        transform: translateY(-50%);
    }

    .compact .toolbar-separator {
        margin: 2px var(--space-sm);
    }

    .compact.collapsed {
        width: 48px;
    }

    /* Landscape compact - centered, tighter spacing */
    .toolbar-side.compact.landscape {
        top: 50%;
        bottom: auto;
        transform: translateY(-50%);
    }

    .compact.landscape .toolbar-content {
        padding: 6px;
        gap: var(--space-xs);
    }

    .compact.landscape .toolbar-group {
        gap: var(--space-xs);
    }

    .compact.landscape .group-header {
        height: var(--text-lg);
        margin-bottom: 0;
    }

    .compact.landscape .group-icon i {
        font-size: var(--icon-sm);
    }

    .compact.landscape .tool-btn {
        padding: 6px;
        font-size: var(--text-sm);
    }

    .compact.landscape .tool-btn i {
        font-size: var(--icon-md);
    }

    .compact.landscape .toolbar-separator {
        margin: 0;
    }
</style>