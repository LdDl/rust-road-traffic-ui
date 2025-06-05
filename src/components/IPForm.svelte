<script lang="ts">
    import { apiUrlStore, changeAPI } from "../store/state"
    import { onMount } from 'svelte'

    const { schema, host, port } = apiUrlStore
    const { apiURL } = apiUrlStore

    let initialAPIURL = $apiURL
    let showCopyMessage = false

    // Validation logic
    $: isValidProtocol = /^https?$/i.test($schema.trim())
    $: isValidHost = $host.trim().length > 0 && !/\s/.test($host.trim())
    $: isValidPort = !isNaN(Number($port)) && Number($port) > 0 && Number($port) <= 65535
    $: isValidURL = isValidProtocol && isValidHost && isValidPort

    const changeAddr = () => {
        if (initialAPIURL !== $apiURL) {
            changeAPI.set($apiURL)
            initialAPIURL = $apiURL
        }
    }

    const copyToClipboard = async () => {
        try {
            await navigator.clipboard.writeText($apiURL)
            showCopyMessage = true
            setTimeout(() => {
                showCopyMessage = false
            }, 2000) // Hide message after 2 seconds
        } catch (err) {
            console.error('Failed to copy text: ', err)
        }
    }

    const getValidationMessage = () => {
        if (!isValidProtocol) return "Invalid protocol (use 'http' or 'https')"
        if (!isValidHost) return "Invalid host address"
        if (!isValidPort) return "Invalid port number (1-65535)"
        return "API URL is valid"
    }

    // Custom number input handlers
        const incrementPort = () => {
        const currentPort = Number($port) || 0
        if (currentPort < 65535) {
            port.set(currentPort + 1)
        }
    }

    const decrementPort = () => {
        const currentPort = Number($port) || 0
        if (currentPort > 1) {
            port.set(currentPort - 1)
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
            <input 
                bind:value={$schema} 
                id="input_schema" 
                type="text" 
                placeholder="http"
                class:invalid={!isValidProtocol && $schema.trim() !== ''}
            >
        </div>
        
        <div class="input-group">
            <label for="input_host">Host Address</label>
            <input 
                bind:value={$host} 
                id="input_host" 
                type="text" 
                placeholder="localhost"
                class:invalid={!isValidHost && $host.trim() !== ''}
            >
        </div>
        
        <div class="input-group">
            <label for="input_port">Port Number</label>
            <div class="number-input-wrapper">
                <input 
                    bind:value={$port} 
                    id="input_port" 
                    type="text"
                    inputmode="numeric"
                    pattern="[0-9]*"
                    placeholder="8080"
                    class:invalid={!isValidPort && $port.toString().trim() !== ''}
                    class="number-input"
                >
                <div class="number-buttons">
                    <button 
                        type="button" 
                        class="number-btn increment" 
                        on:click={incrementPort}
                        tabindex="-1"
                    >
                        <i class="material-icons">keyboard_arrow_up</i>
                    </button>
                    <button 
                        type="button" 
                        class="number-btn decrement" 
                        on:click={decrementPort}
                        tabindex="-1"
                    >
                        <i class="material-icons">keyboard_arrow_down</i>
                    </button>
                </div>
            </div>
        </div>
        
        <div class="url-preview">
            <span class="preview-label">Full API URL:</span>
            <div class="url-container">
                <span class="preview-url" class:invalid-url={!isValidURL}>{$apiURL}</span>
                <button 
                    type="button" 
                    class="copy-btn" 
                    on:click={copyToClipboard} 
                    title="Copy to clipboard"
                    disabled={!isValidURL}
                >
                    <i class="material-icons">content_copy</i>
                </button>
            </div>
            <div class="status-message-container">
                {#if showCopyMessage}
                    <div class="copy-message">
                        <i class="material-icons">check_circle</i>
                        Copied to clipboard!
                    </div>
                {:else}
                    <div class="validation-message" class:valid={isValidURL} class:invalid={!isValidURL}>
                        <i class="material-icons">{isValidURL ? 'check_circle' : 'error'}</i>
                        {getValidationMessage()}
                    </div>
                {/if}
            </div>
        </div>
        
        <button 
            type="button" 
            class="action-btn" 
            on:click={changeAddr}
            disabled={!isValidURL}
        >
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

    .input-group input.invalid {
        border-color: #ef4444;
        background-color: #fef2f2;
    }

    .input-group input.invalid:focus {
        border-color: #ef4444;
        box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
    }

    /* Custom number input */
    .number-input-wrapper {
        position: relative;
    }

    .number-input {
        padding-right: 2.5rem !important;
    }

    .number-buttons {
        position: absolute;
        right: 1px;
        top: 1px;
        width: 2rem;
        height: calc(0.875rem * 1.5 + 0.75rem * 2);
        display: flex;
        flex-direction: column;
        border-radius: 0 0.3rem 0.3rem 0;
        overflow: hidden;
    }
    
    .number-btn {
        flex: 1;
        min-height: 0;
        padding: 0;
        border: none;
        border-left: 1px solid #e2e8f0;
        background: #f8fafc;
        cursor: pointer;
        color: #64748b;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background-color 0.15s;
    }

    .number-btn:first-child {
        border-bottom: 0.5px solid #e2e8f0;
    }
    
    .number-btn:hover {
        background: #e2e8f0;
        color: #475569;
    }

    .number-btn:active {
        background: #cbd5e1;
    }

    .number-btn i {
        font-size: 12px;
    }

    /* Hide default spinners */
    .number-input::-webkit-outer-spin-button,
    .number-input::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
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
        margin-bottom: 0.5rem;
        font-family: inherit;
    }

    .url-container {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .preview-url {
        color: #1e40af;
        word-break: break-all;
        flex: 1;
    }

    .preview-url.invalid-url {
        color: #dc2626;
    }

    .copy-btn {
        background: #f1f5f9;
        border: 1px solid #cbd5e1;
        border-radius: 0.25rem;
        padding: 0.25rem;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
        flex-shrink: 0;
    }

    .copy-btn:hover:not(:disabled) {
        background: #e2e8f0;
        border-color: #94a3b8;
    }

    .copy-btn:active:not(:disabled) {
        background: #cbd5e1;
    }

    .copy-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .copy-btn i {
        font-size: 16px;
        color: #64748b;
    }

    .status-message-container {
        height: 1.5rem;
        display: flex;
        align-items: center;
        margin-top: 0.5rem;
    }

    .copy-message {
        display: flex;
        align-items: center;
        gap: 0.25rem;
        color: #059669;
        font-size: 0.75rem;
        font-family: inherit;
        animation: fadeInOut 2s ease-in-out;
    }

    .validation-message {
        display: flex;
        align-items: center;
        gap: 0.25rem;
        font-size: 0.75rem;
        font-family: inherit;
        transition: color 0.2s;
    }

    .validation-message.valid {
        color: #059669;
    }

    .validation-message.invalid {
        color: #dc2626;
    }

    .validation-message i,
    .copy-message i {
        font-size: 14px;
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
        transition: all 0.2s;
        box-sizing: border-box;
    }

    .action-btn:hover:not(:disabled) {
        background: #2563eb;
    }

    .action-btn:active:not(:disabled) {
        background: #1d4ed8;
    }

    .action-btn:disabled {
        background: #9ca3af;
        cursor: not-allowed;
    }

    @keyframes fadeInOut {
        0% { opacity: 0; transform: translateY(5px); }
        20% { opacity: 1; transform: translateY(0); }
        80% { opacity: 1; transform: translateY(0); }
        100% { opacity: 0; transform: translateY(-5px); }
    }
</style>