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
                                <i class="material-icons" style="color: {element.properties.color_rgb_str};">place</i>
                                <span>Zone identifier: {element.id}</span>
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