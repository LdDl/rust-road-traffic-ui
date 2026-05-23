import maplibregl from 'maplibre-gl';
import type { Map as MMap, GeoJSONSource } from 'maplibre-gl';
import type MapboxDraw from '@mapbox/mapbox-gl-draw';
import { haversineDistance, geoMidpoint, formatDistance } from './geo_utils';

const SKELETON_SOURCE_ID = 'edge-skeleton-source';
const SKELETON_LAYER_ID = 'edge-skeleton-layer';

interface ManagedFeature {
    edgeMarkers: maplibregl.Marker[];
    skeletonMarkers: maplibregl.Marker[];
    edgeCount: number;
    color: string;
}

const managedFeatures = new Map<string, ManagedFeature>();

function createEdgeLabelElement(text: string): HTMLDivElement {
    const el = document.createElement('div');
    el.textContent = text;
    el.style.cssText = `
        font-size: 11px;
        font-weight: 600;
        font-family: system-ui, sans-serif;
        color: white;
        text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000, 0 0 4px rgba(0,0,0,0.8);
        pointer-events: none;
        white-space: nowrap;
    `;
    return el;
}

function createSkeletonLabelElement(text: string): HTMLDivElement {
    const el = document.createElement('div');
    el.textContent = text;
    el.style.cssText = `
        font-size: 11px;
        font-weight: 700;
        font-family: system-ui, sans-serif;
        color: #e63946;
        text-shadow: -1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 1px 1px 0 #fff, 0 0 4px rgba(255,255,255,0.9);
        pointer-events: none;
        white-space: nowrap;
    `;
    return el;
}

function syncEdgeLabelsFromDraw(map: MMap, mdraw: MapboxDraw) {
    const allFeatures = mdraw.getAll();
    const activeIds = new Set<string>();
    const skeletonFeatures: GeoJSON.Feature[] = [];

    for (const feature of allFeatures.features) {
        if (!feature.id) continue;
        if (feature.geometry.type !== 'Polygon') continue;

        const fid = String(feature.id);
        activeIds.add(fid);

        const ring = feature.geometry.coordinates[0];
        if (!ring || ring.length < 2) continue;

        const uniqueCount = ring.length - 1;
        if (uniqueCount < 2) continue;

        // edges = number of unique vertices for a closed ring
        const edgeCount = uniqueCount;
        const color = (feature.properties?.color_rgb_str as string) || '#666';
        const existing = managedFeatures.get(fid);

        // Compute edge midpoints and distances
        const edgeData: { mid: [number, number]; dist: string }[] = [];
        for (let i = 0; i < edgeCount; i++) {
            const j = (i + 1) % uniqueCount;
            const c1 = ring[i] as [number, number];
            const c2 = ring[j] as [number, number];
            if (!isFinite(c1[0]) || !isFinite(c1[1]) || !isFinite(c2[0]) || !isFinite(c2[1])) continue;
            const mid = geoMidpoint(c1, c2);
            const dist = haversineDistance(c1, c2);
            edgeData.push({ mid, dist: formatDistance(dist) });
        }

        if (existing && existing.edgeCount === edgeData.length && existing.color === color) {
            // Update positions and text only
            for (let i = 0; i < edgeData.length; i++) {
                existing.edgeMarkers[i].setLngLat(edgeData[i].mid);
                const el = existing.edgeMarkers[i].getElement();
                if (el.textContent !== edgeData[i].dist) {
                    el.textContent = edgeData[i].dist;
                }
            }
        } else {
            // Recreate edge markers
            if (existing) {
                existing.edgeMarkers.forEach(m => m.remove());
                existing.skeletonMarkers.forEach(m => m.remove());
            }
            const edgeMarkers: maplibregl.Marker[] = [];
            for (const ed of edgeData) {
                const el = createEdgeLabelElement(ed.dist);
                const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
                    .setLngLat(ed.mid)
                    .addTo(map);
                edgeMarkers.push(marker);
            }

            const skeletonMarkers: maplibregl.Marker[] = [];
            managedFeatures.set(fid, { edgeMarkers, skeletonMarkers, edgeCount: edgeData.length, color });
        }

        // Skeleton: only for complete quadrilaterals (4 unique vertices)
        if (uniqueCount === 4) {
            const A = ring[0] as [number, number];
            const B = ring[1] as [number, number];
            const C = ring[2] as [number, number];
            const D = ring[3] as [number, number];

            const midAB = geoMidpoint(A, B);
            const midCD = geoMidpoint(C, D);
            const midBC = geoMidpoint(B, C);
            const midDA = geoMidpoint(D, A);

            const skelLine1: GeoJSON.Feature = {
                type: 'Feature',
                properties: {},
                geometry: { type: 'LineString', coordinates: [midAB, midCD] }
            };
            const skelLine2: GeoJSON.Feature = {
                type: 'Feature',
                properties: {},
                geometry: { type: 'LineString', coordinates: [midDA, midBC] }
            };
            skeletonFeatures.push(skelLine1, skelLine2);

            // Skeleton length labels - offset from center to avoid overlap
            const dist1 = haversineDistance(midAB, midCD);
            const dist2 = haversineDistance(midDA, midBC);

            // Place label at 30% along the line (not 50%) to avoid crossing point
            const labelPos1: [number, number] = [
                midAB[0] + (midCD[0] - midAB[0]) * 0.3,
                midAB[1] + (midCD[1] - midAB[1]) * 0.3
            ];
            const labelPos2: [number, number] = [
                midDA[0] + (midBC[0] - midDA[0]) * 0.3,
                midDA[1] + (midBC[1] - midDA[1]) * 0.3
            ];

            const managed = managedFeatures.get(fid)!;
            if (managed.skeletonMarkers.length === 2) {
                // Update positions and text
                managed.skeletonMarkers[0].setLngLat(labelPos1);
                managed.skeletonMarkers[1].setLngLat(labelPos2);
                const el0 = managed.skeletonMarkers[0].getElement();
                const el1 = managed.skeletonMarkers[1].getElement();
                const t0 = formatDistance(dist1);
                const t1 = formatDistance(dist2);
                if (el0.textContent !== t0) el0.textContent = t0;
                if (el1.textContent !== t1) el1.textContent = t1;
            } else {
                // Recreate skeleton markers
                managed.skeletonMarkers.forEach(m => m.remove());
                const el1 = createSkeletonLabelElement(formatDistance(dist1));
                const el2 = createSkeletonLabelElement(formatDistance(dist2));
                managed.skeletonMarkers = [
                    new maplibregl.Marker({ element: el1, anchor: 'center' }).setLngLat(labelPos1).addTo(map),
                    new maplibregl.Marker({ element: el2, anchor: 'center' }).setLngLat(labelPos2).addTo(map),
                ];
            }
        } else {
            // Not a quad - clear skeleton markers
            const managed = managedFeatures.get(fid);
            if (managed && managed.skeletonMarkers.length > 0) {
                managed.skeletonMarkers.forEach(m => m.remove());
                managed.skeletonMarkers = [];
            }
        }
    }

    // Update skeleton GeoJSON source (only if layer is ready)
    if (skeletonLayerReady) {
        const source = map.getSource(SKELETON_SOURCE_ID) as GeoJSONSource | undefined;
        if (source) {
            source.setData({ type: 'FeatureCollection', features: skeletonFeatures });
        }
    }

    // Cleanup removed features
    for (const fid of [...managedFeatures.keys()]) {
        if (!activeIds.has(fid)) {
            removeFeatureLabels(fid);
        }
    }
}

function removeFeatureLabels(featureId: string) {
    const managed = managedFeatures.get(featureId);
    if (managed) {
        managed.edgeMarkers.forEach(m => m.remove());
        managed.skeletonMarkers.forEach(m => m.remove());
        managedFeatures.delete(featureId);
    }
}


let boundMap: MMap | null = null;
let boundDraw: MapboxDraw | null = null;

function onDrawRender() {
    if (boundMap && boundDraw) {
        syncEdgeLabelsFromDraw(boundMap, boundDraw);
    }
}

function ensureSkeletonLayer(map: MMap) {
    if (!map.getSource(SKELETON_SOURCE_ID)) {
        map.addSource(SKELETON_SOURCE_ID, {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] }
        });
    }
    if (!map.getLayer(SKELETON_LAYER_ID)) {
        map.addLayer({
            id: SKELETON_LAYER_ID,
            type: 'line',
            source: SKELETON_SOURCE_ID,
            paint: {
                'line-color': '#000000',
                'line-width': 2,
                'line-dasharray': [4, 4]
            }
        });
    }
    skeletonLayerReady = true;
}

let skeletonLayerReady = false;

export function bindEdgeLabels(map: MMap, mdraw: MapboxDraw) {
    unbindEdgeLabels();
    boundMap = map;
    boundDraw = mdraw;
    skeletonLayerReady = false;

    // Add skeleton source + layer (may need to wait for style.load)
    if (map.isStyleLoaded()) {
        ensureSkeletonLayer(map);
    } else {
        map.once('style.load', () => {
            if (boundMap === map) {
                ensureSkeletonLayer(map);
            }
        });
    }

    map.on('draw.render', onDrawRender);
    syncEdgeLabelsFromDraw(map, mdraw);
}

export function unbindEdgeLabels() {
    if (boundMap) {
        boundMap.off('draw.render', onDrawRender);
        if (boundMap.getLayer(SKELETON_LAYER_ID)) {
            boundMap.removeLayer(SKELETON_LAYER_ID);
        }
        if (boundMap.getSource(SKELETON_SOURCE_ID)) {
            boundMap.removeSource(SKELETON_SOURCE_ID);
        }
    }
    clearAllEdgeLabels();
    boundMap = null;
    boundDraw = null;
}

export function clearAllEdgeLabels() {
    for (const fid of [...managedFeatures.keys()]) {
        removeFeatureLabels(fid);
    }
}
