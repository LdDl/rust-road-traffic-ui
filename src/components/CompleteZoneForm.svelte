<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import type { Zone } from '$lib/zones';

    export let zone: Zone;

    const dispatch = createEventDispatcher<{
        save: {
            coordinates: number[][][],
            road_lane_direction: number,
            road_lane_num: number,
        },
        highlight: { pointIndex: number | null },
    }>();

    const labels = ['A', 'B', 'C', 'D'] as const;

    function getPoint(idx: number): { lng: string; lat: string } {
        const ring = zone.geometry?.coordinates?.[0];
        if (ring && ring[idx] && isFinite(ring[idx][0]) && isFinite(ring[idx][1])) {
            return { lng: String(ring[idx][0]), lat: String(ring[idx][1]) };
        }
        return { lng: '', lat: '' };
    }

    let points = [0, 1, 2, 3].map(i => getPoint(i));
    let laneDirection = zone.properties.road_lane_direction ?? -1;
    let laneNum = zone.properties.road_lane_num ?? -1;

    $: allFilled = points.every(p => p.lng !== '' && p.lat !== '');
    $: hasChanges = (() => {
        const ring = zone.geometry?.coordinates?.[0];
        for (let i = 0; i < 4; i++) {
            const lng = parseFloat(points[i].lng);
            const lat = parseFloat(points[i].lat);
            if (!ring || !ring[i] || ring[i][0] !== lng || ring[i][1] !== lat) return true;
        }
        if (laneDirection !== zone.properties.road_lane_direction) return true;
        if (laneNum !== zone.properties.road_lane_num) return true;
        return false;
    })();

    function handleSave() {
        const coords = points.map(p => [parseFloat(p.lng), parseFloat(p.lat)]);
        coords.push([...coords[0]]);
        dispatch('save', {
            coordinates: [coords],
            road_lane_direction: laneDirection,
            road_lane_num: laneNum,
        });
    }
</script>

<div class="zone-form">
    <div class="coords-section">
        <span class="section-label">Polygon vertices (WGS84)</span>
        <div class="coords-header">
            <span class="header-spacer"></span>
            <span class="header-label">Longitude</span>
            <span class="header-label">Latitude</span>
        </div>
        <div class="coords-grid">
            {#each labels as label, i}
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                    class="coord-row"
                    on:mouseenter={() => dispatch('highlight', { pointIndex: i })}
                    on:mouseleave={() => dispatch('highlight', { pointIndex: null })}
                >
                    <span class="point-label">{label}</span>
                    <input
                        type="number"
                        step="any"
                        placeholder="0.000000"
                        bind:value={points[i].lng}
                    >
                    <input
                        type="number"
                        step="any"
                        placeholder="0.000000"
                        bind:value={points[i].lat}
                    >
                </div>
            {/each}
        </div>
    </div>

    <div class="divider"></div>

    <div class="lane-section">
        <span class="section-label">Lane parameters</span>
        <div class="lane-row">
            <div class="lane-field">
                <label for="lane-dir-{zone.id}">Direction</label>
                <input id="lane-dir-{zone.id}" type="number" bind:value={laneDirection}>
            </div>
            <div class="lane-field">
                <label for="lane-num-{zone.id}">Lane number</label>
                <input id="lane-num-{zone.id}" type="number" bind:value={laneNum}>
            </div>
        </div>
    </div>

    <button
        type="button"
        class="save-btn"
        disabled={!allFilled || !hasChanges}
        on:click={handleSave}
    >
        Save changes
    </button>
</div>

<style>
    .zone-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
    }

    .section-label {
        font-size: 11px;
        font-weight: 600;
        color: var(--text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    .divider {
        height: 1px;
        background: var(--border-secondary);
    }

    /* Coordinates */
    .coords-section {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .coords-header {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .header-spacer {
        width: 28px;
        flex-shrink: 0;
    }

    .header-label {
        flex: 1;
        font-size: 11px;
        color: var(--text-secondary);
        font-weight: 500;
    }

    .coords-grid {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .coord-row {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 4px;
        border-radius: 6px;
        transition: background-color 0.15s;
    }

    .coord-row:hover {
        background: var(--bg-secondary);
    }

    .point-label {
        width: 24px;
        height: 24px;
        line-height: 24px;
        font-size: 12px;
        font-weight: 700;
        border-radius: 4px;
        background: var(--bg-tertiary);
        color: var(--text-primary);
        text-align: center;
        flex-shrink: 0;
    }

    .coord-row:hover .point-label {
        background: var(--accent-primary);
        color: white;
    }

    .coords-grid input,
    .lane-field input {
        flex: 1;
        min-width: 0;
        padding: 8px 10px;
        border: 1px solid var(--border-primary);
        border-radius: 6px;
        font-size: 13px;
        font-family: monospace;
        background: var(--bg-primary);
        color: var(--text-primary);
        box-sizing: border-box;
        transition: border-color 0.15s, box-shadow 0.15s;
    }

    .coords-grid input:focus,
    .lane-field input:focus {
        outline: none;
        border-color: var(--accent-primary);
        box-shadow: 0 0 0 2px rgba(var(--accent-primary-rgb), 0.15);
    }

    /* Hide number spinners */
    input[type="number"]::-webkit-inner-spin-button,
    input[type="number"]::-webkit-outer-spin-button {
        -webkit-appearance: none;
        margin: 0;
    }
    input[type="number"] {
        -moz-appearance: textfield;
        appearance: textfield;
    }

    /* Lane parameters */
    .lane-section {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .lane-row {
        display: flex;
        gap: 12px;
    }

    .lane-field {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .lane-field label {
        font-size: 11px;
        font-weight: 500;
        color: var(--text-secondary);
    }

    /* Save button */
    .save-btn {
        width: 100%;
        padding: 10px 16px;
        background: var(--success-primary);
        color: white;
        border: none;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: background-color 0.2s;
    }

    .save-btn:hover:not(:disabled) {
        background: var(--success-hover);
    }

    .save-btn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }
</style>
