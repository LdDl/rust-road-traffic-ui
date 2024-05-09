<script lang="ts">
    import { type Writable } from 'svelte/store'
	import { DirectionType, type Zone } from '$lib/zones';

    export let klass: string = ''
    export let dataReady: Writable<boolean>
    export let data: [string, Zone][]
</script>

<div id="configuration" class={klass}>
    <div id="configuration-content">
        <ul id="collapsible-data" class="collapsible">
            {#if $dataReady === true}
                {#each data as [k, element]}
                    <li>
                        <div class="collapsible-header collapsible-header-content">
                            <div class="collapbisle-header-zone">
                                <!-- <i class="material-icons" style="color: {element.properties.color_rgb_str};">place</i> -->
                                <svg xmlns="http://www.w3.org/2000/svg" width="1.6rem" height="1.6rem" viewBox="0 0 256 256"><g fill="{element.properties.color_rgb_str}"><path d="M137 65a24 24 0 1 1 0-34a24 24 0 0 1 0 34M23 103a24 24 0 1 0 34 0a24 24 0 0 0-34 0m120 88a24 24 0 1 0 34 0a24 24 0 0 0-34 0m82-136a24 24 0 1 0 0 34a24 24 0 0 0 0-34" opacity="0.2"/><path d="M230.64 49.36a32 32 0 0 0-45.26 0a32 32 0 0 0-5.16 6.76L152 48.42a32 32 0 0 0-54.63-23.06a32.06 32.06 0 0 0-5.76 37.41L57.67 93.32a32.05 32.05 0 0 0-40.31 4.05a32 32 0 0 0 42.89 47.41l70 51.36a32 32 0 1 0 47.57-14.69l27.39-77.59q1.38.12 2.76.12a32 32 0 0 0 22.63-54.62Zm-122-12.69a16 16 0 1 1 0 22.64a16 16 0 0 1 .04-22.64Zm-80 94.65a16 16 0 0 1 0-22.64a16 16 0 1 1 0 22.64m142.65 88a16 16 0 0 1-22.63-22.63a16 16 0 1 1 22.63 22.63m-8.55-43.18a32 32 0 0 0-23 7.08l-70-51.36a32.17 32.17 0 0 0-1.34-26.65l33.95-30.55a32 32 0 0 0 45.47-10.81L176 71.56a32 32 0 0 0 14.12 27ZM219.3 83.3a16 16 0 1 1-22.6-22.62a16 16 0 0 1 22.63 22.63Z"/></g></svg>
                                <span style="padding-left: 0.5rem;">Zone identifier: {element.id}</span>
                            </div>
                            <div class="collapbisle-header-divider"></div>
                            <div class="collapbisle-header-zone">
                                <div>
                                    <span>Virtual line:</span>
                                    {#if element.properties.virtual_line}
                                        <span>{DirectionType.toHumanString(element.properties.virtual_line.direction)}</span>
                                    {:else}
                                        <span style="font-weight: bold;">None</span>
                                    {/if}
                                </div>
                            </div>
                        </div>
                        <div class="collapsible-body">
                            <table class="collapsible-table">
                                <thead>
                                    <tr>
                                        <th>Attirubute</th>
                                        <th>Value</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td>Road lane direction</td>
                                        <td>{element.properties.road_lane_direction}</td>
                                    </tr>
                                    <tr>
                                        <td>Road lane number</td>
                                        <td>{element.properties.road_lane_num}</td>
                                    </tr>
                                    <tr>
                                        <td>Color</td>
                                        <td><div style="background-color: {element.properties.color_rgb_str}; width: 32px; height: 16px; border: 1px solid #000000;"></div></td>
                                    </tr>
                                    <tr>
                                        <td>Canvas coordinates</td>
                                        <td>{JSON.stringify(element.properties.coordinates)}</td>
                                    </tr>
                                    <tr>
                                        <td>Spatial coordinates</td>
                                        <td>{JSON.stringify(element.geometry.coordinates)}</td>
                                    </tr>
                                    {#if element.properties.virtual_line}
                                    <tr>
                                        <td>Virtual line direction</td>
                                        <td><span>{DirectionType.toHumanString(element.properties.virtual_line.direction)}</span></td>
                                    </tr>
                                    <tr>
                                        <td>Virtual line coordinates</td>
                                        <td>{JSON.stringify(element.properties.virtual_line.geometry)}</td>
                                    </tr>
                                    {:else}
                                    <tr>
                                        <td>Virtual line</td>
                                        <td><span style="font-weight: bold;">None</span></td>
                                    </tr>
                                    {/if}
                                </tbody>
                            </table>
                        </div>
                    </li>
                {/each}
            {/if}
        </ul>
    </div>
</div>

<style scoped>
    #configuration {
        grid-area: B;
        /* background: blue; */
        overflow-y: auto;
        max-height: 185px;
    }

    /* Custom scrollbar */
    #configuration::-webkit-scrollbar {
        background-color:#fff;
        width:16px
    }
    #configuration::-webkit-scrollbar-track {
        background-color:#fff
    }
    #configuration::-webkit-scrollbar-track:hover {
        background-color:#f4f4f4
    }
    #configuration::-webkit-scrollbar-thumb {
        background-color:#babac0;
        border-radius:16px;
        border:5px solid #fff
    }
    #configuration::-webkit-scrollbar-thumb:hover {
        background-color:#a0a0a5;
        border:4px solid #f4f4f4
    }
    #configuration::-webkit-scrollbar-button {
        display:none
    }

    .collapsible-table {
        font-size: 14px;
    }

    /* Override collapsible */
    .collapsible-header, .collapsible-body, .collapsible, ul.collapsible>li {
        margin: 0 !important;
    }
    .collapsible-header-content{
        display: flex;
        flex-direction: row;
        padding: 0 !important;
    }
    .collapbisle-header-zone{
        flex: 1;
        display: flex;
        text-align: center;
        flex-direction: row;
        align-items: center;
        padding: 1rem;
    }
    .collapbisle-header-divider {
      border-left: 0.2rem solid rgb(107, 107, 107);
      margin-top: 0.3rem;
      margin-bottom: 0.3rem;
    }
</style>