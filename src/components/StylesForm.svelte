<script lang="ts">
    import { mapStyleStore, DEFAULT_MAP_STYLE_URI } from '../store/state'
    import { BLANK_MAP_STYLE_MARKER } from '$lib/map_styles'
    import { onMount } from 'svelte';

    const { uri } = mapStyleStore;

    let initialStylesURI = $uri

    $: isBlank = $uri === BLANK_MAP_STYLE_MARKER
    $: isApplied = $uri === initialStylesURI
    $: isDefault = $uri === DEFAULT_MAP_STYLE_URI

    const changeStyles = () => {
        if (initialStylesURI !== $uri) {
            initialStylesURI = $uri
            mapStyleStore.accepted_uri.update(() => initialStylesURI);
        }
    };

    const useBlankMap = () => {
        mapStyleStore.uri.set(BLANK_MAP_STYLE_MARKER);
        initialStylesURI = BLANK_MAP_STYLE_MARKER;
        mapStyleStore.accepted_uri.set(BLANK_MAP_STYLE_MARKER);
    };

    const resetUrl = () => {
        mapStyleStore.uri.set(DEFAULT_MAP_STYLE_URI);
    };

    onMount(() => {
        console.log(`Mount styles form. Initial styles URL: '${$uri}'`)
    });
</script>

<div class="styles-form">
    <form autocomplete="off">
        <div class="input-group">
            <label for="input_style_url">Map Style URL</label>
            <div class="input-with-icon">
                <input
                    bind:value={$uri}
                    id="input_style_url"
                    type="url"
                    placeholder="https://api.maptiler.com/maps/..."
                >
                {#if !isDefault}
                    <button type="button" class="input-reset-btn" on:click={resetUrl} title="Reset to default URL">
                        <i class="material-icons">restart_alt</i>
                    </button>
                {/if}
            </div>
            <div class="input-hint">
                {#if isBlank}
                    Blank map is active. Enter a URL and click Apply to switch back.
                {:else}
                    MapTiler style JSON URL for map appearance
                {/if}
            </div>
        </div>
        <div class="button-row">
            <button type="button" class="action-btn" on:click={changeStyles} disabled={isApplied || isBlank}>
                Apply Style
            </button>
            <button type="button" class="action-btn secondary" on:click={useBlankMap} disabled={isBlank}>
                Use blank map
            </button>
        </div>
    </form>
</div>

<style>
    .styles-form {
        width: 100%;
    }

    .input-group {
        display: flex;
        flex-direction: column;
        gap: var(--space-xs);
        margin-bottom: var(--space-sm);
        overflow: visible;
    }

    .input-group label {
        font-size: var(--text-sm);
        font-weight: 500;
        color: var(--text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    .input-with-icon {
        position: relative;
        display: flex;
        align-items: center;
    }

    .input-with-icon input {
        padding-right: 2.25rem;
    }

    .input-reset-btn {
        position: absolute;
        right: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 1.5rem;
        height: 1.5rem;
        padding: 0;
        border: none;
        border-radius: var(--radius-sm);
        background: transparent;
        color: var(--text-secondary);
        cursor: pointer;
        transition: background-color 0.2s, color 0.2s;
    }

    .input-reset-btn:hover {
        background: var(--bg-tertiary, var(--bg-secondary));
        color: var(--text-primary);
    }

    .input-reset-btn i {
        font-size: var(--icon-lg);
    }

    .input-group input {
        padding: var(--space-sm) 10px;
        border: 1px solid var(--border-primary);
        border-radius: var(--radius-sm);
        font-size: var(--text-base);
        transition: border-color 0.2s, box-shadow 0.2s;
        background: var(--bg-primary);
        color: var(--text-primary);
        width: 100%;
        min-width: 0;
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
        font-size: var(--text-sm);
        color: var(--text-secondary);
        font-style: italic;
        opacity: 0.8;
    }

    .button-row {
        display: flex;
        gap: 6px;
    }

    .action-btn {
        flex: 1;
        padding: var(--space-xs) var(--space-sm);
        background: var(--success-primary);
        color: white;
        border: none;
        border-radius: var(--radius-sm);
        font-size: var(--text-base);
        font-weight: 500;
        cursor: pointer;
        transition: background-color 0.2s;
        box-sizing: border-box;
    }

    .action-btn.secondary {
        background: var(--bg-tertiary, var(--bg-secondary));
        color: var(--text-primary);
        border: 1px solid var(--border-primary);
    }

    .action-btn.secondary:hover {
        background: var(--bg-secondary);
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