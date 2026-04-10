import maplibregl from 'maplibre-gl';
import type { Map as MMap } from 'maplibre-gl';
import type MapboxDraw from '@mapbox/mapbox-gl-draw';

const LABELS = ['A', 'B', 'C', 'D'] as const;

// featureId -> markers + last known color
const managedFeatures = new Map<string, { markers: maplibregl.Marker[], color: string }>();

function createLabelElement(label: string, color: string): HTMLDivElement {
    const el = document.createElement('div');
    el.textContent = label;
    el.style.cssText = `
        width: 20px;
        height: 20px;
        line-height: 20px;
        text-align: center;
        font-size: 11px;
        font-weight: 700;
        font-family: system-ui, sans-serif;
        color: white;
        background: ${color};
        border: 2px solid white;
        border-radius: 4px;
        box-shadow: 0 1px 4px rgba(0,0,0,0.3);
        pointer-events: none;
    `;
    return el;
}

function removeFeatureLabels(featureId: string) {
    const managed = managedFeatures.get(featureId);
    if (managed) {
        managed.markers.forEach(m => m.remove());
        managedFeatures.delete(featureId);
    }
}

function syncLabelsFromDraw(map: MMap, mdraw: MapboxDraw) {
    const allFeatures = mdraw.getAll();
    const activeIds = new Set<string>();

    for (const feature of allFeatures.features) {
        if (!feature.id || feature.geometry.type !== 'Polygon') continue;

        const fid = String(feature.id);
        activeIds.add(fid);

        const ring = feature.geometry.coordinates[0];
        if (!ring || ring.length < 2) continue;

        const uniqueCount = ring.length - 1;
        const labelCount = Math.min(4, uniqueCount);
        if (labelCount < 1) continue;

        const color = (feature.properties?.color_rgb_str as string) || '#666';
        const existing = managedFeatures.get(fid);

        if (existing && existing.markers.length === labelCount && existing.color === color) {
            // Same count and color — just update positions
            for (let i = 0; i < labelCount; i++) {
                const [lng, lat] = ring[i];
                if (isFinite(lng) && isFinite(lat)) {
                    existing.markers[i].setLngLat([lng, lat]);
                }
            }
        } else {
            // Color changed, label count changed, or new feature — recreate
            if (existing) {
                existing.markers.forEach(m => m.remove());
            }
            const markers: maplibregl.Marker[] = [];
            for (let i = 0; i < labelCount; i++) {
                const [lng, lat] = ring[i];
                if (!isFinite(lng) || !isFinite(lat)) continue;

                const el = createLabelElement(LABELS[i], color);
                const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
                    .setLngLat([lng, lat])
                    .addTo(map);
                markers.push(marker);
            }
            managedFeatures.set(fid, { markers, color });
        }
    }

    // Remove labels for features no longer in draw
    for (const fid of [...managedFeatures.keys()]) {
        if (!activeIds.has(fid)) {
            removeFeatureLabels(fid);
        }
    }
}

let boundMap: MMap | null = null;
let boundDraw: MapboxDraw | null = null;

function onDrawRender() {
    if (boundMap && boundDraw) {
        syncLabelsFromDraw(boundMap, boundDraw);
    }
}

export function bindVertexLabels(map: MMap, mdraw: MapboxDraw) {
    unbindVertexLabels();
    boundMap = map;
    boundDraw = mdraw;
    map.on('draw.render', onDrawRender);
    syncLabelsFromDraw(map, mdraw);
}

export function unbindVertexLabels() {
    if (boundMap) {
        boundMap.off('draw.render', onDrawRender);
    }
    clearAllVertexLabels();
    boundMap = null;
    boundDraw = null;
}

export function clearAllVertexLabels() {
    for (const fid of [...managedFeatures.keys()]) {
        removeFeatureLabels(fid);
    }
}
