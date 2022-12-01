<script lang="ts">
    import { onMount, onDestroy } from 'svelte'
    import { mjpegReady, apiUrlStore, changeAPI } from '../store/state.js'

    const { apiURL } = apiUrlStore
    let initialAPIURL = `${$apiURL}`

    const imageLoaded = () => {
        mjpegReady.set(true)
    }

    const unsubApiChange = changeAPI.subscribe(value => {
        if (initialAPIURL !== value) {
            console.log(`Need to change API URL for MJPEG: '${$apiURL}'`)
            initialAPIURL = value
        }
    })

    onMount(() => {
    });

    onDestroy(() => {
        unsubApiChange()
    });
</script>

<div id="mjpeg">
    <!-- svelte-ignore a11y-missing-attribute -->
    <img id="fit_img" src="{initialAPIURL}/live_streaming" width="500" height="500" on:load={imageLoaded}>
    <!-- <img id="fit_img" src="https://pngimg.com/uploads/google/google_PNG19632.png" width="500" height="500" on:load={imageLoaded}> -->
    <canvas id="fit_canvas"></canvas>
</div>

<style global>
    #mjpeg {
        grid-area: A;
        background: green;
    }
    #fit_img {
        height: 100%;
        width: 100%;
    }
    #fit_canvas {
        height: 80%;
        width: 50%;
        background-color: transparent;
        position: absolute;
        left: 0;
        top: 0;
    }
</style>