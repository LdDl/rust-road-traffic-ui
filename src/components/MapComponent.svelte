<script lang="ts">
    import { onMount, onDestroy } from 'svelte'

    import maplibregl, { Map as MMap} from 'maplibre-gl'
    import type MapboxDraw from "@mapbox/mapbox-gl-draw"
    import 'maplibre-gl/dist/maplibre-gl.css'
    import { map, draw } from '../store/map'
    import { mapStyleStore, changeStyle } from '../store/state'
    import { dataStorage, updateDataStorage } from '../store/data_storage'
    import { EMPTY_POLYGON_RGB } from '../lib/gl_draw_styles.js'
    
    // let map: MMap;
    let mapContainer: HTMLElement;
    const { accepted_uri } = mapStyleStore;
    let initialStylesURI = $accepted_uri

    const radioButton = (color: string): string => {
        return `<svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20" fill="${color}"><path d="M480.276-96Q401-96 331-126q-70-30-122.5-82.5T126-330.958q-30-69.959-30-149.5Q96-560 126-629.5t82.5-122Q261-804 330.958-834q69.959-30 149.5-30Q560-864 629.5-834t122 82.5Q804-699 834-629.276q30 69.725 30 149Q864-401 834-331q-30 70-82.5 122.5T629.276-126q-69.725 30-149 30ZM480-168q130 0 221-91t91-221q0-130-91-221t-221-91q-130 0-221 91t-91 221q0 130 91 221t221 91Zm0 0q-130 0-221-91t-91-221q0-130 91-221t221-91q130 0 221 91t91 221q0 130-91 221t-221 91Z"/></svg>`
    }

    const unsubStylesChange = accepted_uri.subscribe(value => {
        if (initialStylesURI !== value) {
            $map.setStyle(value)
            initialStylesURI = $accepted_uri
        }
    })

    function svgToDataURL(svg: string): string {
        return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    }
    
    onMount(() => {
        const initialState = { lng: 0, lat: 0, zoom: 5 };
        map.set(new MMap({
            container: mapContainer,
            style: initialStylesURI,
            center: [initialState.lng, initialState.lat],
            zoom: initialState.zoom
        }));

        // Fix maplibre-gl canvas size
        $map.on('load', () => {
            $map.resize()
        })

        $map.on('click', 'gl-draw-polygon-fill-inactive.cold', function (e) {
            // @ts-ignore
            const mapFeature = $draw.get(e.features[0].properties.id);
            if (!mapFeature) {
                // mapFeature could be undefined if it's not found in the draw storage since some other process removed it
                return
            }
            const options = Array.from($dataStorage.values()).map((feature, idx) => {
                const color = feature.properties.color_rgb_str as string
                // https://github.com/Dogfalo/materialize/issues/4056
                const elem = `<option value="${feature.id}" data-icon="${svgToDataURL(radioButton(color))}">${feature.id}</option>`
                return elem
            });
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
                if (element.properties.spatial_object_id === mapFeature?.id) {
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
        unsubStylesChange()
        $map.remove()
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
            // $dataStorage.set(mapFeature.properties.canvas_object_id, previousFeature);
            updateDataStorage(mapFeature.properties.canvas_object_id, previousFeature)
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
        feature.properties.canvas_object_id = canvasID;
        feature.properties.spatial_object_id = spatialID;
        feature.properties.road_lane_direction = Number(options.road_lane_direction);
        feature.properties.road_lane_num = Number(options.road_lane_num);
        feature.geometry.coordinates = options.coordinates;
        // $dataStorage.set(canvasID, feature);
        updateDataStorage(canvasID, feature)
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