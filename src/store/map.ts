import { writable, type Writable } from 'svelte/store';
import type { Map as MMap } from 'maplibre-gl';
import MapboxDraw from "@mapbox/mapbox-gl-draw"
import { CUSTOM_GL_DRAW_STYLES } from '../lib/gl_draw_styles.js'
import { PolygonFourPointsOnly } from '../lib/custom_poly.js'
import { DeleteClickedZone } from '../lib/custom_delete.js'

export const map: Writable<MMap> = writable();
export const draw: Writable<MapboxDraw> = writable(new MapboxDraw({
    userProperties: true,
    displayControlsDefault: false,
    controls: {
        polygon: false,
        trash: false
    },
    // @ts-ignore
    modes: Object.assign({
        // draw_delete_zone: DeleteZoneOnClick,
        draw_restricted_polygon: PolygonFourPointsOnly,
        delete_zone: DeleteClickedZone
    }, MapboxDraw.modes),
    styles: CUSTOM_GL_DRAW_STYLES
}))