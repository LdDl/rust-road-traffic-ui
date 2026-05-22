import type { StyleSpecification } from 'maplibre-gl';

export const BLANK_MAP_STYLE_MARKER = 'blank';

export function createBlankStyle(dark: boolean): StyleSpecification {
    return {
        version: 8,
        sources: {},
        layers: [{
            id: 'background',
            type: 'background',
            paint: { 'background-color': dark ? '#2d2d2d' : '#e5e5e5' }
        }]
    };
}

// Default light blank style (used for initial load)
export const EMPTY_MAP_STYLE: StyleSpecification = createBlankStyle(false);

export function resolveMapStyle(value: string, dark = false): string | StyleSpecification {
    return value === BLANK_MAP_STYLE_MARKER ? createBlankStyle(dark) : value;
}
