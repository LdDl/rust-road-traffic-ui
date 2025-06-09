<script lang="ts">
    import { mapStyleStore } from '../store/state'
    import { onMount } from 'svelte';

    const { uri } = mapStyleStore;

    let initialStylesURI = $uri

    const changeStyles = () => {
        if (initialStylesURI !== $uri) {
            initialStylesURI = $uri
            mapStyleStore.accepted_uri.update(() => initialStylesURI);
        }
    };

    onMount(() => {
        console.log(`Mount styles form. Initial styles URL: '${$uri}'`)
    });
</script>

<div class="styles-form">
    <form autocomplete="off">
        <div class="input-group">
            <label for="input_style_url">Map Style URL</label>
            <input 
                bind:value={$uri} 
                id="input_style_url" 
                type="url" 
                placeholder="https://api.maptiler.com/maps/..."
            >
            <div class="input-hint">
                MapTiler style JSON URL for map appearance
            </div>
        </div>
        <button type="button" class="action-btn" on:click={changeStyles}>
            Apply Style
        </button>
    </form>
</div>

<style>
    .styles-form {
        width: 100%;
    }

    .input-group {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        margin-bottom: 1rem;
    }

    .input-group label {
        font-size: 0.75rem;
        font-weight: 500;
        color: var(--text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    .input-group input {
        padding: 0.75rem;
        border: 1px solid var(--border-primary);
        border-radius: 0.375rem;
        font-size: 0.875rem;
        transition: all 0.2s;
        background: var(--bg-primary);
        color: var(--text-primary);
        width: 100%;
        min-width: 0; /* Allow shrinking */
        box-sizing: border-box;
    }

    .input-group input:focus {
        outline: none;
        border-color: var(--accent-primary);
        box-shadow: 0 0 0 3px rgba(var(--accent-primary-rgb), 0.1);
    }

    .input-group input::placeholder {
        color: var(--text-secondary);
        opacity: 0.7;
    }

    .input-hint {
        font-size: 0.75rem;
        color: var(--text-secondary);
        font-style: italic;
        opacity: 0.8;
    }

    .action-btn {
        width: 100%;
        padding: 0.75rem;
        background: var(--success-primary);
        color: white;
        border: none;
        border-radius: 0.375rem;
        font-size: 0.875rem;
        font-weight: 500;
        cursor: pointer;
        transition: background-color 0.2s;
        box-sizing: border-box;
    }

    .action-btn:hover {
        background: var(--success-hover);
    }

    .action-btn:active {
        background: var(--success-hover);
        transform: translateY(1px);
    }

    .action-btn:disabled {
        background: var(--text-secondary);
        opacity: 0.5;
        cursor: not-allowed;
    }
</style>