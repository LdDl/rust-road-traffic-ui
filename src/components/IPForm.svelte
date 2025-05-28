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

<div class="addr-container">
    <form autocomplete="off">
        <div class="addr-form">
            <div class="addr-part row">
                <div class="input-field">
                    <input bind:value={$schema} id="input_protocol" type="text" class="validate">
                    <label class="active" for="input_protocol">Protocol schema type</label>
                </div>
            </div>
            <div class="addr-part row">
                <div class="input-field">
                    <input bind:value={$host} id="input_protocol" type="text" class="validate">
                    <label class="active" for="input_protocol">Address or explicit IP</label>
                </div>
            </div>
            <div class="addr-part row">
                <div class="input-field">
                    <input bind:value={$port} id="input_protocol" type="number" class="validate">
                    <label class="active" for="input_protocol">Port</label>
                </div>
            </div>
        </div>
    </form>
    <button class="btn waves-effect waves-light btn-small red" type="submit" name="action" on:click={changeAddr}>Switch</button>
</div>


<style>
    .addr-container{
        display: flex;
        flex-direction: column;
        right: 0;
        border: 2px solid black;
        width: 34rem;
    }

    .addr-form {
        background-color: rgb(240, 240, 240);
        font-family: 'Roboto';
        font-size: 1.5rem;
        display: flex;
        flex-direction: row;
    }

    .addr-part {
        padding: 5px;
        margin: 2px;
        border: 2px solid black;
    }
</style>