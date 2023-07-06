<script lang="ts">
	import { mapStyleStore, changeAPI } from '../store/state'
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
		console.log(`Initial styles URL: '${$uri}'`)
	});
</script>

<div class="styles-switch-container">
	<form autocomplete="off">
		<div class="styles-switch-form">
			<div class="styles-switch-part row">
				<div class="input-field">
					<input bind:value={$uri} id="input_protocol" type="text" class="validate">
					<label class="active" for="input_style_url">URI for Maptiler styles JSON</label>
				</div>
			</div>
		</div>
	</form>
	<button
		class="btn waves-effect waves-light btn-small red"
		type="submit"
		name="action"
		on:click={changeStyles}>Switch</button
	>
</div>

<style>
	@import url('https://fonts.googleapis.com/css?family=Roboto');

	.styles-switch-container {
		/* position: absolute; */
		display: flex;
		flex-direction: column;
		right: 0;
		border: 2px solid black;
		width: 34rem;
	}

	.styles-switch-form {
		background-color: rgb(240, 240, 240);
		font-family: 'Roboto', sans-serif;
		font-size: 1.5rem;
		display: flex;
		flex-direction: row;
	}

	.styles-switch-part {
		padding: 5px;
		margin: 2px;
		border: 2px solid black;
		width: 100%;
	}
</style>
