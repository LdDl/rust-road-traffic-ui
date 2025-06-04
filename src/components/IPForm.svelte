<script lang="ts">
    import { apiUrlStore, changeAPI } from "../store/state"
    import { onMount } from 'svelte'

    const { schema, host, port } = apiUrlStore
    const { apiURL } = apiUrlStore

    let initialAPIURL = $apiURL

    const changeAddr = () => {
        if (initialAPIURL !== $apiURL) {
            changeAPI.set($apiURL)
            initialAPIURL = $apiURL
        }
    }
    
    onMount(() =>{
        console.log(`Mount IP form. Initial address: '${$apiURL}'`)
    })
</script>

<div class="api-form">
    <form autocomplete="off">
        <div class="input-group">
            <label for="input_schema">Protocol</label>
            <input bind:value={$schema} id="input_schema" type="text" placeholder="http">
        </div>
        
        <div class="input-group">
            <label for="input_host">Host Address</label>
            <input bind:value={$host} id="input_host" type="text" placeholder="localhost">
        </div>
        
        <div class="input-group">
            <label for="input_port">Port Number</label>
            <input bind:value={$port} id="input_port" type="number" placeholder="8080">
        </div>
        
        <div class="url-preview">
            <span class="preview-label">Full API URL:</span>
            <span class="preview-url">{$apiURL}</span>
        </div>
        
        <button type="button" class="action-btn" on:click={changeAddr}>
            Apply Connection
        </button>
    </form>
</div>

<style>
    .api-form {
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
        color: #6b7280;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    .input-group input {
        padding: 0.75rem;
        border: 1px solid #d1d5db;
        border-radius: 0.375rem;
        font-size: 0.875rem;
        transition: all 0.2s;
        background: white;
        width: 100%;
        min-width: 0;
        box-sizing: border-box;
    }

    .input-group input:focus {
        outline: none;
        border-color: #3b82f6;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }

    .url-preview {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 0.375rem;
        padding: 0.75rem;
        margin-bottom: 1rem;
        font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
        font-size: 0.8rem;
        box-sizing: border-box;
    }

    .preview-label {
        display: block;
        font-size: 0.7rem;
        color: #6b7280;
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin-bottom: 0.25rem;
        font-family: inherit;
    }

    .preview-url {
        color: #1e40af;
        word-break: break-all;
    }

    .action-btn {
        width: 100%;
        padding: 0.75rem;
        background: #3b82f6;
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
        background: #2563eb;
    }

    .action-btn:active {
        background: #1d4ed8;
    }
</style>