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
        preview: { coordinates: number[][][] },
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

    const initialPoints = [0, 1, 2, 3].map(i => getPoint(i));
    let points = initialPoints.map(p => ({ ...p }));
    let laneDirection = zone.properties.road_lane_direction ?? -1;
    let laneNum = zone.properties.road_lane_num ?? -1;

    // History for undo/redo
    type Snapshot = { lng: string; lat: string }[];
    let history: Snapshot[] = [initialPoints.map(p => ({ ...p }))];
    let historyIndex = 0;
    let skipPush = false;

    function clonePoints(pts: { lng: string; lat: string }[]): Snapshot {
        return pts.map(p => ({ ...p }));
    }

    function pushHistory() {
        if (skipPush) return;
        const snap = clonePoints(points);
        // Trim any redo states ahead
        history = [...history.slice(0, historyIndex + 1), snap];
        historyIndex = history.length - 1;
    }

    function applySnapshot(snap: Snapshot) {
        skipPush = true;
        points = snap.map(p => ({ ...p }));
        skipPush = false;
    }

    function undo() {
        if (historyIndex <= 0) return;
        historyIndex--;
        applySnapshot(history[historyIndex]);
    }

    function redo() {
        if (historyIndex >= history.length - 1) return;
        historyIndex++;
        applySnapshot(history[historyIndex]);
    }

    function reset() {
        applySnapshot(initialPoints);
        pushHistory();
    }

    $: canUndo = historyIndex > 0;
    $: canRedo = historyIndex < history.length - 1;

    $: allFilled = points.every(p => p.lng !== '' && p.lat !== '');

    // Reactively preview coordinates on map when all points are valid
    $: if (allFilled) {
        const coords = points.map(p => [parseFloat(p.lng), parseFloat(p.lat)]);
        if (coords.every(c => isFinite(c[0]) && isFinite(c[1]))) {
            const ring = [...coords, [...coords[0]]];
            dispatch('preview', { coordinates: [ring] });
        }
    }

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
        <div class="coords-section-header">
            <span class="section-label">Polygon vertices (WGS84)</span>
            <div class="history-controls">
                <button type="button" class="history-btn" disabled={!canUndo} on:click={undo} title="Undo">
                    <i class="material-icons">undo</i>
                </button>
                <button type="button" class="history-btn" disabled={!canRedo} on:click={redo} title="Redo">
                    <i class="material-icons">redo</i>
                </button>
                <button type="button" class="history-btn" disabled={!hasChanges} on:click={reset} title="Reset to original">
                    <i class="material-icons">restart_alt</i>
                </button>
            </div>
        </div>
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
                        on:change={pushHistory}
                    >
                    <input
                        type="number"
                        step="any"
                        placeholder="0.000000"
                        bind:value={points[i].lat}
                        on:change={pushHistory}
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
        gap: var(--space-lg);
    }

    .section-label {
        font-size: var(--text-xs);
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
        gap: var(--space-sm);
    }

    .coords-section-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
    }

    .history-controls {
        display: flex;
        gap: var(--space-2xs);
    }

    .history-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        padding: 0;
        background: var(--bg-secondary);
        border: 1px solid var(--border-primary);
        border-radius: var(--radius-sm);
        color: var(--text-secondary);
        cursor: pointer;
        transition: background-color 0.15s, color 0.15s, border-color 0.15s;
    }

    .history-btn:hover:not(:disabled) {
        color: var(--accent-primary);
        border-color: var(--accent-primary);
    }

    .history-btn:disabled {
        opacity: 0.3;
        cursor: not-allowed;
    }

    .history-btn i {
        font-size: var(--icon-sm);
    }

    .coords-header {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
    }

    .header-spacer {
        width: 28px;
        flex-shrink: 0;
    }

    .header-label {
        flex: 1;
        font-size: var(--text-xs);
        color: var(--text-secondary);
        font-weight: 500;
    }

    .coords-grid {
        display: flex;
        flex-direction: column;
        gap: var(--space-xs);
    }

    .coord-row {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
        padding: var(--space-xs);
        border-radius: var(--radius-sm);
        transition: background-color 0.15s;
    }

    .coord-row:hover {
        background: var(--bg-secondary);
    }

    .point-label {
        width: var(--space-2xl);
        height: var(--space-2xl);
        line-height: var(--space-2xl);
        font-size: var(--text-sm);
        font-weight: 700;
        border-radius: var(--radius-sm);
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
        padding: var(--space-sm) 10px;
        border: 1px solid var(--border-primary);
        border-radius: var(--radius-sm);
        font-size: var(--text-base);
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
        gap: var(--space-sm);
    }

    .lane-row {
        display: flex;
        gap: var(--space-md);
    }

    .lane-field {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: var(--space-xs);
    }

    .lane-field label {
        font-size: var(--text-xs);
        font-weight: 500;
        color: var(--text-secondary);
    }

    /* Save button */
    .save-btn {
        width: 100%;
        padding: var(--space-sm) var(--space-md);
        background: var(--success-primary);
        color: white;
        border: none;
        border-radius: var(--radius-sm);
        font-size: var(--text-md);
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
