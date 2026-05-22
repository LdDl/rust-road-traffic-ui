export const EMPTY_POLYGON_RGB = 'rgb(127, 127, 127)';

export function createDrawStyles(dark = false) {
    const lineColor = dark ? 'rgb(255, 255, 255)' : 'rgb(0, 0, 0)';
    const outlineColor = dark ? 'rgb(200, 200, 200)' : 'rgb(0, 0, 0)';
    const vertexColor = dark ? 'rgb(100, 160, 255)' : 'rgb(0, 0, 255)';
    const strokeActiveColor = dark ? 'rgb(120, 170, 255)' : 'rgb(178, 204, 255)';

    return [
        // ACTIVE (draw)
        {
            'id': 'gl-draw-line',
            'type': 'line',
            'filter': ['all', ['==', '$type', 'LineString'], ['==', 'active', 'true']],
            'layout': {
                'line-cap': 'round',
                'line-join': 'round'
            },
            'paint': {
                'line-color': lineColor,
                'line-dasharray': [0.2, 2],
                'line-width': 2
            }
        },
        {
            'id': 'gl-draw-polygon-fill',
            'type': 'fill',
            'filter': ['all', ['==', '$type', 'Polygon'], ['==', 'active', 'true']],
            'paint': {
                'fill-color': [
                    'case',
                    ['==', ['get', 'user_color_rgb_str'], null],
                    EMPTY_POLYGON_RGB,
                    ['get', 'user_color_rgb_str']
                ],
                'fill-outline-color': outlineColor,
                'fill-opacity': 0.5
            }
        },
        {
            'id': 'gl-draw-polygon-midpoint',
            'type': 'circle',
            'filter': ['all',
                ['==', '$type', 'Point'],
                ['==', 'meta', 'midpoint']
            ],
            'paint': {
                'circle-radius': 3,
                'circle-color': vertexColor
            },
        },
        {
            'id': 'gl-draw-polygon-stroke-active',
            'type': 'line',
            'filter': ['all', ['==', '$type', 'Polygon'], ['==', 'active', 'true']],
            'layout': {
                'line-cap': 'round',
                'line-join': 'round'
            },
            'paint': {
                'line-color': strokeActiveColor,
                'line-dasharray': [0.2, 2],
                'line-width': 2
            }
        },
        {
            'id': 'gl-draw-polygon-and-line-vertex-halo-active',
            'type': 'circle',
            'filter': ['all', ['==', 'meta', 'vertex'], ['==', '$type', 'Point'],],
            'paint': {
                'circle-radius': 5,
                'circle-color': vertexColor,
            }
        },
        {
            'id': 'gl-draw-polygon-and-line-vertex-active',
            'type': 'circle',
            'filter': ['all', ['==', 'meta', 'vertex'], ['==', '$type', 'Point'],],
            'paint': {
                'circle-radius': 3,
                'circle-color': vertexColor,
            }
        },
        // INACTIVE
        {
            'id': 'gl-draw-line-inactive',
            'type': 'line',
            'filter': ['all', ['==', '$type', 'LineString'], ['==', 'active', 'false']],
            'layout': {
                'line-cap': 'round',
                'line-join': 'round'
            },
            'paint': {
                'line-color': lineColor,
                'line-width': 3
            }
        },
        {
            'id': 'gl-draw-polygon-fill-inactive',
            'type': 'fill',
            'filter': ['all', ['==', '$type', 'Polygon'], ['==', 'active', 'false']],
            'paint': {
                'fill-color': [
                    'case',
                    ['==', ['get', 'user_color_rgb_str'], null],
                    EMPTY_POLYGON_RGB,
                    ['get', 'user_color_rgb_str']
                ],
                'fill-outline-color': outlineColor,
                'fill-opacity': 0.25
            }
        },
        {
            'id': 'gl-draw-polygon-stroke-inactive',
            'type': 'line',
            'filter': ['all', ['==', '$type', 'Polygon'], ['==', 'active', 'false']],
            'layout': {
                'line-cap': 'round',
                'line-join': 'round'
            },
            'paint': {
                'line-color': lineColor,
                'line-width': 3
            }
        }
    ];
}

// Default light theme styles for backward compatibility
export const CUSTOM_GL_DRAW_STYLES = createDrawStyles(false);
