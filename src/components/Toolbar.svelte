<script lang="ts">
    import { state } from '../store/state.js';
    import { States } from '$lib/states.js';
    
    export let onAddToCanvas: () => void;
    export let onDeleteFromCanvas: () => void;
    export let onAddToMap: () => void;
    export let onDeleteFromMap: () => void;
    export let onSave: () => void;
    
    let stateVariable: States;
    state.subscribe((value) => stateVariable = value);
    
    let collapsed = true;
</script>

<div class="toolbar-side" class:collapsed>
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
                {#if !collapsed}<span>Add Zone</span>{/if}
            </button>
            <button 
                class="tool-btn danger"
                class:active={stateVariable === States.DeletingZoneCanvas}
                on:click={onDeleteFromCanvas}
                title="Delete zone from canvas"
            >
                <i class="material-icons">delete</i>
                {#if !collapsed}<span>Delete</span>{/if}
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
                {#if !collapsed}<span>Add Zone</span>{/if}
            </button>
            <button 
                class="tool-btn danger"
                class:active={stateVariable === States.DeletingZoneMap}
                on:click={onDeleteFromMap}
                title="Delete zone from map"
            >
                <i class="material-icons">location_off</i>
                {#if !collapsed}<span>Delete</span>{/if}
            </button>
        </div>
        
        <div class="toolbar-separator"></div>
        
        <div class="toolbar-group">
            <button class="tool-btn success" on:click={onSave} title="Save all changes">
                <i class="material-icons">save</i>
                {#if !collapsed}<span>Save</span>{/if}
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
        background: white;
        border-radius: 0.5rem 0 0 0.5rem;
        box-shadow: -2px 0 12px rgba(0, 0, 0, 0.15);
        z-index: 1000;
        transition: all 0.3s ease;
        width: 200px;
        border: 1px solid #e5e7eb;
        border-right: none;
    }
    
    .toolbar-side.collapsed {
        width: 60px;
    }
    
    .toolbar-toggle {
        position: absolute;
        top: 1rem;
        left: -12px;
        width: 24px;
        height: 24px;
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        font-size: 16px;
        color: #6b7280;
        box-shadow: -2px 0 8px rgba(0, 0, 0, 0.1);
    }
    
    .toolbar-toggle:hover {
        background: #f9fafb;
    }
    
    .toolbar-content {
        padding: 1rem;
        display: flex;
        flex-direction: column;
        gap: 0.75rem; /* Reduced gap */
    }
    
    .toolbar-group {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }
    
    .group-header {
        position: relative;
        height: 1.25rem; /* Fixed height for both states */
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 0.25rem;
    }
    
    .group-label {
        font-size: 0.75rem;
        font-weight: 600;
        color: #6b7280;
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
        color: #9ca3af;
        font-size: 1rem;
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
        background: linear-gradient(to right, transparent, #e5e7eb, transparent);
        margin: 0.25rem 0;
    }
    
    .collapsed .toolbar-separator {
        margin: 0.25rem 0.75rem;
    }
    
    .tool-btn {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.75rem;
        border: 1px solid #d1d5db;
        border-radius: 0.375rem;
        background: white;
        cursor: pointer;
        transition: all 0.2s;
        font-size: 0.875rem;
        white-space: nowrap;
    }
    
    .tool-btn:hover {
        background: #f9fafb;
        border-color: #9ca3af;
    }
    
    .tool-btn.active {
        background: #3b82f6;
        color: white;
        border-color: #3b82f6;
    }
    
    .tool-btn.danger.active {
        background: #ef4444;
        border-color: #ef4444;
    }
    
    .tool-btn.success {
        background: #10b981;
        color: white;
        border-color: #10b981;
    }
    
    .collapsed .tool-btn {
        justify-content: center;
    }
    
    .collapsed .tool-btn span {
        display: none;
    }
</style>