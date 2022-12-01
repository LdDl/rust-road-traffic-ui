import { writable, type Writable } from 'svelte/store';
import type { Map as MMap } from 'maplibre-gl';
import type MapboxDraw from "@mapbox/mapbox-gl-draw"

export const map: Writable<MMap> = writable();
export const draw: Writable<MapboxDraw> = writable();