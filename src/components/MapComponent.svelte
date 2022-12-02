<script lang="ts">
    import { onMount, onDestroy } from 'svelte'

    import maplibregl, { Map as MMap} from 'maplibre-gl';
    import type MapboxDraw from "@mapbox/mapbox-gl-draw"
    import 'maplibre-gl/dist/maplibre-gl.css';
    import { map, draw } from '../store/map'
    import { dataStorage } from '../store/data_storage'
    import { EMPTY_POLYGON_RGB } from '../lib/gl_draw_styles.js'

    // let map: MMap;
    let mapContainer: HTMLElement;
    
    onMount(() => {
        const apiKey = 'dznzK4GQ1Lj5U7XsI22j';
        const initialState = { lng: 38.447050424171266, lat: 56.35162245676929, zoom: 5.16 };
        map.set(new MMap({
            container: mapContainer,
            // style: `https://api.maptiler.com/maps/streets/style.json?key=${apiKey}`,
            style: `https://api.maptiler.com/maps/streets/style.json?key=get_your_own_OpIi9ZULNHzrESv6T2vL`,
            center: [initialState.lng, initialState.lat],
            zoom: initialState.zoom
        }));

        // Fix maplibre-gl canvas size
        $map.resize()

        $map.on('click', 'gl-draw-polygon-fill-inactive.cold', function (e) {
            const options = Array.from($dataStorage.values()).map((feature, idx) => { return `<option value="${feature.id}">${feature.id}</option>`});
            // @ts-ignore
            const mapFeature = $draw.get(e.features[0].properties.id);
            const popupContent = `
                <div id="custom-popup">
                    <div class="row">
                        <div class="input-field col s12">
                            <select id="select-canvas">
                                <option value="" disabled selected>Pick up polygon</option>
                                ${options.join('\n')}
                            </select>
                            <label>Attach canvas polygons</label>
                        </div>
                    </div>
                    <div class="row">
                        <div class="input-field col s12">
                            <input value="${mapFeature?.properties?.road_lane_direction}" id="lane-direction" type="number" class="validate">
                            <label class="active" for="lane-direction">Direction value</label>
                        </div>
                    </div>
                    <div class="row">
                        <div class="input-field col s12">
                            <input value="${mapFeature?.properties?.road_lane_num}" id="lane-number" type="number" class="validate">
                            <label class="active" for="lane-number">Lane</label>
                        </div>
                    </div>
                    <div class="row">
                        <div class="col s12">
                            <button id="attach-canvas-btn" class="btn-small waves-effect waves-light" type="submit" name="action" onclick>Save
                                <i class="material-icons right">save</i>
                            </button>
                        </div>
                    </div>
                </div>
            `
            new maplibregl.Popup({ className: "custom-popup" })
                .setLngLat(e.lngLat)
                .setHTML(popupContent)
                .addTo($map);
            // @ts-ignore
            const feature = e.features[0];
            const selectElem = document.getElementById("select-canvas");
            Array.from($dataStorage.values()).some(element => {
                // Pick default value if it's possible
                // @ts-ignore
                if (element.properties.spatial_object_id === mapFeature.id) {
                    // @ts-ignore
                    selectElem.value = element.id;
                    return true;
                }
            })
            // @ts-ignore
            const selectsInstances = M.FormSelect.init(selectElem, {});
            const attachBtn = document.getElementById('attach-canvas-btn');
            // @ts-ignore
            attachBtn.addEventListener('click', (clickEvent) => {
                const directionElem = document.getElementById("lane-direction");
                const laneElem = document.getElementById("lane-number");
                // https://github.com/Dogfalo/materialize/issues/6536 - There is a workaround to get correct selected values via `getSelectedValues()` call
                // So just leave next two code lines just for history:
                // const selectInstance = M.FormSelect.getInstance(selectElem);
                // console.log("bug", selectInstance.getSelectedValues())
                // @ts-ignore
                attachCanvasToSpatial(feature.properties.id, selectElem.value, {road_lane_direction: directionElem.value, road_lane_num: laneElem.value, coordinates: $draw.get(feature.properties.id).geometry.coordinates});
            });
        })
    });

    onDestroy(() => {
        $map.remove();
    });

    export function attachDraw(draw: any) {
        // @ts-ignore
        $map.addControl(draw);
    }
    
    export const drawGeoPolygons = (draw: MapboxDraw, dataStorage: Map<string, any>) => {
        dataStorage.forEach((feature: any) => {
            draw.add(feature);
        });
        if (dataStorage.size === 0) {
            return
        }
        // @ts-ignore
        const firstCoordinates = Array.from(dataStorage.values())[0].geometry.coordinates;
        let llBbox = new maplibregl.LngLatBounds(firstCoordinates[0]);
        for (const coord of firstCoordinates) {
            llBbox.extend(coord);
        }
        $map.fitBounds(llBbox, {
            maxZoom: 18,
            padding: 100
        });
    };

    const attachCanvasToSpatial = (spatialID: any, canvasID: any, options = {road_lane_direction: -1, road_lane_num: -1, coordinates: []}) => {
        if (spatialID === '' || canvasID === '' || spatialID === null || canvasID === null || spatialID === undefined|| canvasID === undefined) {
            return
        }
        let feature = $dataStorage.get(canvasID);
        let mapFeature = $draw.get(spatialID);

        if (mapFeature === undefined || mapFeature?.properties === null) {
            return
        }

        // Reset information for previously attached DATASTORAGE object
        if (mapFeature.properties.canvas_object_id !== null && mapFeature.properties.canvas_object_id !== undefined) {
            let previousFeature = $dataStorage.get(mapFeature.properties.canvas_object_id);
            previousFeature.properties.spatial_object_id = null;
            previousFeature.properties.road_lane_direction = -1;
            previousFeature.properties.road_lane_num = -1;
            previousFeature.geometry.coordinates = [[], [], [], [], []];
            $dataStorage.set(mapFeature.properties.canvas_object_id, previousFeature);
        }

        // Scan for other spatial objects to share same canvas ID
        $draw.getAll().features.forEach(element => {
            if (element.properties === null || element.id === spatialID) {
                // Skip picked map feature
                return
            }
            if (element.properties.canvas_object_id === canvasID) {
                // Reset information for MAP object:
                element.properties.canvas_object_id = null;
                element.properties.color_rgb = [127, 127, 127];
                element.properties.color_rgb_str = EMPTY_POLYGON_RGB;
                $draw.add(element);
                // @ts-ignore
                $draw.setFeatureProperty(element.id, 'color_rgb_str', EMPTY_POLYGON_RGB);
            }
        })
        // Update information for MAP object
        mapFeature.properties.canvas_object_id = canvasID;
        mapFeature.properties.color_rgb = feature.properties.color_rgb;
        mapFeature.properties.color_rgb_str = feature.properties.color_rgb_str;
        mapFeature.properties.road_lane_direction = Number(options.road_lane_direction);
        mapFeature.properties.road_lane_num = Number(options.road_lane_num);
        $draw.add(mapFeature);
        $draw.setFeatureProperty(spatialID, 'color_rgb_str', feature.properties.color_rgb_str);
        // Update information for DATASTORE object
        feature.properties.spatial_object_id = spatialID;
        feature.properties.road_lane_direction = Number(options.road_lane_direction);
        feature.properties.road_lane_num = Number(options.road_lane_num);
        feature.geometry.coordinates = options.coordinates;
        $dataStorage.set(canvasID, feature);
    }
</script>
  
<div class="map-wrap">
    <div class="map" id="map" bind:this={mapContainer}></div>
</div>

<style global>
    @import 'maplibre-gl/dist/maplibre-gl.css';
    
    .map-wrap {
        position: relative;
        width: 100%;
        height: 100vh;
        background-color: red;
    }
    .map {
        position: absolute;
        width: 100%;
        height: 100%;
    }

    /* Maplibre popup overwrite */
    .maplibregl-popup-content {
        background-color: rgb(240, 240, 240);
    }
    .mapboxgl-popup-anchor-bottom .mapboxgl-popup-tip, .maplibregl-popup-anchor-bottom .maplibregl-popup-tip {
        border-top-color: rgb(240, 240, 240) ;
    }
</style>