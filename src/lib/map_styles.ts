import type { StyleSpecification } from 'maplibre-gl';

export const BLANK_MAP_STYLE_MARKER = 'blank';

export const EMPTY_MAP_STYLE: StyleSpecification = {
    version: 8,
    sources: {},
    layers: [{
        id: 'background',
        type: 'background',
        paint: { 'background-color': '#e5e5e5' }
    }]
};

export function resolveMapStyle(value: string): string | StyleSpecification {
    return value === BLANK_MAP_STYLE_MARKER ? EMPTY_MAP_STYLE : value;
}
