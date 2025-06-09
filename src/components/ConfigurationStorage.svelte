<script lang="ts">
    import { type Writable } from 'svelte/store'
    import { DirectionType, type Zone } from '$lib/zones';

    export let klass: string = ''
    export let dataReady: Writable<boolean>
    export let data: [string, Zone][]

    let expandedZones: { [key: string]: boolean } = {};

    const toggleZone = (key: string) => {
        expandedZones[key] = !expandedZones[key];
        expandedZones = expandedZones;
    };
</script>

<div id="configuration" class={klass}>
    <div id="configuration-content">
        {#if $dataReady === true}
            {#each data as [k, element]}
                <div class="zone-card">
                    <button class="zone-header" on:click={() => toggleZone(k)}>
                        <div class="zone-header-main">
                            <svg xmlns="http://www.w3.org/2000/svg" width="1.6rem" height="1.6rem" viewBox="0 0 256 256">
                                <g fill="{element.properties.color_rgb_str}">
                                    <path d="M137 65a24 24 0 1 1 0-34a24 24 0 0 1 0 34M23 103a24 24 0 1 0 34 0a24 24 0 0 0-34 0m120 88a24 24 0 1 0 34 0a24 24 0 0 0-34 0m82-136a24 24 0 1 0 0 34a24 24 0 0 0 0-34" opacity="0.2"/>
                                    <path d="M230.64 49.36a32 32 0 0 0-45.26 0a32 32 0 0 0-5.16 6.76L152 48.42a32 32 0 0 0-54.63-23.06a32.06 32.06 0 0 0-5.76 37.41L57.67 93.32a32.05 32.05 0 0 0-40.31 4.05a32 32 0 0 0 42.89 47.41l70 51.36a32 32 0 1 0 47.57-14.69l27.39-77.59q1.38.12 2.76.12a32 32 0 0 0 22.63-54.62Zm-122-12.69a16 16 0 1 1 0 22.64a16 16 0 0 1 .04-22.64Zm-80 94.65a16 16 0 0 1 0-22.64a16 16 0 1 1 0 22.64m142.65 88a16 16 0 0 1-22.63-22.63a16 16 0 1 1 22.63 22.63m-8.55-43.18a32 32 0 0 0-23 7.08l-70-51.36a32.17 32.17 0 0 0-1.34-26.65l33.95-30.55a32 32 0 0 0 45.47-10.81L176 71.56a32 32 0 0 0 14.12 27ZM219.3 83.3a16 16 0 1 1-22.6-22.62a16 16 0 0 1 22.63 22.63Z"/>
                                </g>
                            </svg>
                            <span class="zone-title">Zone {element.id}</span>
                            <span class="zone-status">{element.properties.virtual_line ? '• Has virtual line' : '• No virtual line'}</span>
                        </div>
                        <span class="expand-arrow">{expandedZones[k] ? '▼' : '▶'}</span>
                    </button>
                    
                    {#if expandedZones[k]}
                        <div class="zone-content">
                            <table class="table table-sm">
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
                                        <td>Spatial object ID</td>
                                        <td>{element.properties.spatial_object_id}</td>
                                    </tr>
                                    <tr>
                                        <td>Color</td>
                                        <td>
                                            <div class="color-display">
                                                <div class="color-swatch" style="background-color: {element.properties.color_rgb_str};"></div>
                                                <span>{element.properties.color_rgb_str}</span>
                                            </div>
                                        </td>
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
                                            <td>{DirectionType.toHumanString(element.properties.virtual_line.direction)}</td>
                                        </tr>
                                        <tr>
                                            <td>Virtual line coordinates</td>
                                            <td>{JSON.stringify(element.properties.virtual_line.geometry)}</td>
                                        </tr>
                                    {/if}
                                </tbody>
                            </table>
                        </div>
                    {/if}
                </div>
            {/each}
        {/if}
    </div>
</div>

<style scoped>
    #configuration {
        grid-area: B;
        overflow-y: auto;
        height: 100%;
        padding: 8px;
        background: var(--bg-primary);
        color: var(--text-primary);
    }

    /* Custom scrollbar with theme support */
    #configuration::-webkit-scrollbar {
        background-color: var(--bg-primary);
        width: 8px;
    }
    
    #configuration::-webkit-scrollbar-track {
        background-color: var(--bg-secondary);
    }
    
    #configuration::-webkit-scrollbar-thumb {
        background-color: var(--text-secondary);
        border-radius: 4px;
        opacity: 0.7;
    }
    
    #configuration::-webkit-scrollbar-thumb:hover {
        background-color: var(--text-primary);
        opacity: 0.9;
    }

    .zone-card {
        margin-bottom: 8px;
        border: 1px solid var(--border-primary);
        border-radius: 4px;
        overflow: hidden;
        background: var(--bg-primary);
        box-shadow: 0 1px 3px var(--shadow);
    }

    .zone-header {
        width: 100%;
        padding: 10px;
        background: var(--bg-secondary);
        color: var(--text-primary);
        border: none;
        border-radius: 0;
        cursor: pointer;
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 14px;
        font-weight: 500;
        transition: background-color 0.2s;
    }

    .zone-header:hover {
        background: var(--bg-tertiary);
    }

    .zone-header-main {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex: 1;
    }

    .zone-title {
        font-weight: 600;
        color: var(--text-primary);
    }

    .zone-status {
        font-size: 12px;
        color: var(--text-secondary);
        font-style: italic;
    }

    .expand-arrow {
        margin-left: auto;
        font-family: monospace;
        color: var(--text-secondary);
        transition: color 0.2s;
    }

    .zone-content {
        padding: 10px;
        background: var(--bg-primary);
        border-top: 1px solid var(--border-secondary);
    }

    .color-display {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .color-swatch {
        width: 32px;
        height: 16px;
        border: 1px solid var(--border-primary);
        border-radius: 2px;
    }

    table {
        font-size: 12px;
        width: 100%;
    }

    td {
        padding: 4px 8px;
        vertical-align: top;
        border-bottom: 1px solid var(--border-secondary);
    }

    tr:last-child td {
        border-bottom: none;
    }

    td:first-child {
        font-weight: 500;
        color: var(--text-secondary);
        width: 40%;
    }

    td:last-child {
        font-family: monospace;
        color: var(--text-primary);
        word-break: break-all;
    }
</style>