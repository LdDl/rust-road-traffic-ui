<script lang="ts">
    import { type Writable } from 'svelte/store'
    import { DirectionType, type Zone } from '$lib/zones';
    import { map, draw } from '../store/map';
    import { updateDataStorage } from '../store/data_storage';
    import { EMPTY_POLYGON_RGB } from '../lib/gl_draw_styles.js';
    import CompleteZoneForm from './CompleteZoneForm.svelte';
    import maplibregl from 'maplibre-gl';

    export let klass: string = ''
    export let dataReady: Writable<boolean>
    export let data: [string, Zone][]

    let expandedZones: { [key: string]: boolean } = {};
    let modalZone: Zone | null = null;
    let highlightMarkers: maplibregl.Marker[] = [];

    const toggleZone = (key: string) => {
        expandedZones[key] = !expandedZones[key];
        expandedZones = expandedZones;
    };

    function openEditModal(zone: Zone) {
        modalZone = zone;
    }

    function closeModal() {
        highlightMarkers.forEach(m => m.remove());
        highlightMarkers = [];
        modalZone = null;
    }

    function handleHighlight(zone: Zone, e: CustomEvent<{ pointIndex: number | null }>) {
        highlightMarkers.forEach(m => m.remove());
        highlightMarkers = [];

        const idx = e.detail.pointIndex;
        if (idx === null || !$map) return;

        const ring = zone.geometry?.coordinates?.[0];
        if (!ring || !ring[idx]) return;

        const [lng, lat] = ring[idx];
        if (!isFinite(lng) || !isFinite(lat)) return;

        const el = document.createElement('div');
        el.style.cssText = `
            width: 14px; height: 14px;
            border-radius: 50%;
            border: 2px solid ${zone.properties.color_rgb_str || '#ff0000'};
            background: rgba(255,255,255,0.8);
            pointer-events: none;
        `;

        const marker = new maplibregl.Marker({ element: el })
            .setLngLat([lng, lat])
            .addTo($map);
        highlightMarkers = [marker];
    }

    function handleSave(zone: Zone, e: CustomEvent<{ coordinates: number[][][], road_lane_direction: number, road_lane_num: number }>) {
        const { coordinates, road_lane_direction, road_lane_num } = e.detail;

        zone.properties.road_lane_direction = road_lane_direction;
        zone.properties.road_lane_num = road_lane_num;
        zone.geometry.coordinates = coordinates;

        const spatialId = zone.properties.spatial_object_id || `spatial-${zone.id}`;
        zone.properties.spatial_object_id = spatialId;

        const geoFeature = {
            type: 'Feature' as const,
            id: spatialId,
            properties: {
                color_rgb_str: zone.properties.color_rgb_str || EMPTY_POLYGON_RGB,
            },
            geometry: {
                type: 'Polygon' as const,
                coordinates: coordinates,
            }
        };

        $draw.add(geoFeature);
        $draw.setFeatureProperty(spatialId, 'color_rgb_str', zone.properties.color_rgb_str || EMPTY_POLYGON_RGB);
        updateDataStorage(zone.id, zone);
        closeModal();
    }

    function handleBackdropClick(e: MouseEvent) {
        if ((e.target as HTMLElement).classList.contains('modal-backdrop')) {
            closeModal();
        }
    }

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === 'Escape' && modalZone) {
            closeModal();
        }
    }
</script>

<svelte:window on:keydown={handleKeydown} />

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
                            {#if !element.properties.spatial_object_id}
                                <span class="zone-badge not-linked">Not linked</span>
                            {/if}
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
                                        <td>{element.properties.spatial_object_id ?? '-'}</td>
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
                            <button class="edit-btn" on:click={() => openEditModal(element)}>
                                <i class="material-icons">edit</i>
                                Edit
                            </button>
                        </div>
                    {/if}
                </div>
            {/each}
        {/if}
    </div>
</div>

{#if modalZone}
    <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
    <div class="modal-backdrop" on:click={handleBackdropClick}>
        <div class="modal-panel">
            <div class="modal-header">
                <div class="modal-title-row">
                    <div class="color-swatch modal-swatch" style="background-color: {modalZone.properties.color_rgb_str};"></div>
                    <h3>Zone {modalZone.id}</h3>
                </div>
                <button class="modal-close" on:click={closeModal}>
                    <i class="material-icons">close</i>
                </button>
            </div>
            <div class="modal-body">
                <CompleteZoneForm
                    zone={modalZone}
                    on:save={(e) => handleSave(modalZone!, e)}
                    on:highlight={(e) => handleHighlight(modalZone!, e)}
                />
            </div>
        </div>
    </div>
{/if}

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

    .zone-badge {
        font-size: 10px;
        font-weight: 600;
        padding: 1px 6px;
        border-radius: 3px;
        text-transform: uppercase;
        letter-spacing: 0.03em;
        flex-shrink: 0;
    }

    .zone-badge.not-linked {
        background: var(--warning-bg, #fef3c7);
        color: var(--warning-text, #92400e);
        border: 1px solid var(--warning-border, #fcd34d);
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

    .edit-btn {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        margin-top: 8px;
        padding: 4px 10px;
        background: var(--bg-secondary);
        border: 1px solid var(--border-primary);
        border-radius: 3px;
        color: var(--text-secondary);
        font-size: 11px;
        cursor: pointer;
        transition: all 0.2s;
    }

    .edit-btn:hover {
        color: var(--accent-primary);
        border-color: var(--accent-primary);
    }

    .edit-btn i {
        font-size: 14px;
    }

    /* Modal */
    .modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.5);
        z-index: 2000;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .modal-panel {
        background: var(--bg-primary);
        border: 1px solid var(--border-primary);
        border-radius: 8px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        width: 420px;
        max-width: 90vw;
        max-height: 80vh;
        overflow-y: auto;
    }

    .modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 20px;
        border-bottom: 1px solid var(--border-secondary);
    }

    .modal-title-row {
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .modal-title-row h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
        color: var(--text-primary);
    }

    .modal-swatch {
        width: 20px;
        height: 20px;
        border-radius: 4px;
    }

    .modal-close {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        padding: 0;
        background: var(--bg-secondary);
        border: 1px solid var(--border-primary);
        border-radius: 6px;
        color: var(--text-secondary);
        cursor: pointer;
        transition: all 0.2s;
    }

    .modal-close:hover {
        background: var(--bg-tertiary);
        color: var(--text-primary);
    }

    .modal-close i {
        font-size: 18px;
    }

    .modal-body {
        padding: 16px 20px 20px;
    }
</style>
