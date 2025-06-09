<script lang="ts">
    import { onMount, onDestroy } from 'svelte'

    import maplibregl, { Map as MMap, MapMouseEvent, type MapGeoJSONFeature} from 'maplibre-gl'
    import type MapboxDraw from "@mapbox/mapbox-gl-draw"
    import 'maplibre-gl/dist/maplibre-gl.css'
    import { map, draw } from '../store/map'
    import { mapStyleStore, changeStyle } from '../store/state'
    import { dataStorage, updateDataStorage, resetZoneSpatialInfo } from '../store/data_storage'
    import { EMPTY_POLYGON_RGB } from '../lib/gl_draw_styles.js'
	import type { Feature, GeoJsonObject, Polygon } from 'geojson';
    
    export let klass: string = ''

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
        console.log('Mounted map component')
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

        $map.on('click', 'gl-draw-polygon-fill-inactive.cold', function (e: MapMouseEvent & {features?: MapGeoJSONFeature[] | undefined; } & Object) {
            const mapFeature = <Feature><GeoJsonObject>$draw.get(e.features?.[0].properties.id);
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
            const clickedFeature = [...$dataStorage].find((f) => f[1].properties.spatial_object_id === mapFeature.id)?.[1]
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
                            <input value="${clickedFeature ? clickedFeature.properties?.road_lane_direction : -1}" id="lane-direction" type="number" class="validate">
                            <label class="active" for="lane-direction">Direction value</label>
                        </div>
                    </div>
                    <div class="row">
                        <div class="input-field col s12">
                            <input value="${clickedFeature ? clickedFeature.properties?.road_lane_num : -1}" id="lane-number" type="number" class="validate">
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
            const selectElem = <HTMLInputElement>document.getElementById("select-canvas");
            if (!selectElem) {
                return
            }
            Array.from($dataStorage.values()).some(element => {
                // Pick default value if it's possible
                if (element.properties.spatial_object_id === mapFeature.id) {
                    selectElem.value = element.id ?? 'No canvas ID';
                    return true;
                }
            })
            // @ts-ignore
            const selectsInstances = M.FormSelect.init(selectElem, {});
            const attachBtn = document.getElementById('attach-canvas-btn');
            if (!attachBtn) {
                console.error("No container 'attach-canvas-btn'")
                return
            }
            attachBtn.addEventListener('click', (clickEvent) => {
                const directionElem = <HTMLInputElement>document.getElementById("lane-direction");
                const laneElem = <HTMLInputElement>document.getElementById("lane-number");
                // https://github.com/Dogfalo/materialize/issues/6536 - There is a workaround to get correct selected values via `getSelectedValues()` call
                // So just leave next two code lines just for history:
                // const selectInstance = M.FormSelect.getInstance(selectElem);
                // console.log("bug", selectInstance.getSelectedValues())
                attachSpatialToDataStorage(mapFeature, selectElem.value, {road_lane_direction: directionElem ? parseInt(directionElem.value) : -1, road_lane_num: laneElem ? parseInt(laneElem.value) : -1});
            });
        })
    });

    onDestroy(() => {
        unsubStylesChange()
        $map.remove()
    });

    export function attachDraw(draw: any) {
        $map.addControl(draw);
    }
    
    export const drawGeoPolygons = (draw: MapboxDraw, dataStorage: Map<string, any>) => {
        const features: any[] = [];
        dataStorage.forEach((feature: any) => {
            const spatialFeature = {
                ...feature,
                properties: {
                    color_rgb_str: feature.properties.color_rgb_str,
                },
                id: feature.properties.spatial_object_id
            }
            draw.add(spatialFeature);
            features.push(spatialFeature);
        });
        if (features.length === 0) {
            return
        }
        const featureCollection = {
            type: "FeatureCollection",
            features: features
        };
        let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
        let hasValidCoords = false;
        features.forEach(feature => {
            if (feature.geometry && feature.geometry.coordinates) {
                feature.geometry.coordinates.forEach((ring: number[][]) => {
                    ring.forEach((coord: number[]) => {
                        if (coord.length >= 2 && isFinite(coord[0]) && isFinite(coord[1])) {
                            minLng = Math.min(minLng, coord[0]);
                            maxLng = Math.max(maxLng, coord[0]);
                            minLat = Math.min(minLat, coord[1]);
                            maxLat = Math.max(maxLat, coord[1]);
                            hasValidCoords = true;
                        }
                    });
                });
            }
        });
        if (hasValidCoords && isFinite(minLng) && isFinite(maxLng) && isFinite(minLat) && isFinite(maxLat)) {
            const bounds = new maplibregl.LngLatBounds([minLng, minLat], [maxLng, maxLat]);
            $map.fitBounds(bounds, {
                maxZoom: 18,
                padding: 100
            });
            return
        }
        console.warn('No valid coordinates found for fitBounds');
    };

    const attachSpatialToDataStorage = (mapTargetFeature: Feature, targetFeatureID: string, options = {road_lane_direction: -1, road_lane_num: -1}) => {
        if (targetFeatureID === '' || targetFeatureID === null || targetFeatureID === undefined) {
            return
        }
        if (!mapTargetFeature.properties || !mapTargetFeature.id) {
            return
        }
        const targetFeature = $dataStorage.get(targetFeatureID)
        if (!targetFeature) {
            console.error(`ID '${targetFeatureID}' not found in datastorage`)
            return
        }
        const spatialID = mapTargetFeature.id as string
        // Reset style for previously attached spatial object if possible
        const prevSpatialID = targetFeature.properties.spatial_object_id
        if (prevSpatialID) {
            const prevMapFeature = $draw.get(prevSpatialID)
            if (prevMapFeature) {
                $draw.add(prevMapFeature) // Just to trigger re-draw
                $draw.setFeatureProperty(prevSpatialID, 'color_rgb_str', EMPTY_POLYGON_RGB);                    
            }
        }
        // Reset datastore object if current spatial object has been attached to the one
        const prevFeature = [...$dataStorage].find((f) => f[1].id !== targetFeatureID && f[1].properties.spatial_object_id === spatialID)?.[1]
        if (prevFeature) {
            resetZoneSpatialInfo($dataStorage, prevFeature.id)
        }

        // Update datastorage (actual attachment)
        targetFeature.properties.spatial_object_id = spatialID
        targetFeature.properties.road_lane_direction = options.road_lane_direction
        targetFeature.properties.road_lane_num = options.road_lane_num
        const spatialPolygon = mapTargetFeature.geometry as Polygon // @todo: Do we need type check?
        targetFeature.geometry.coordinates = spatialPolygon.coordinates
        updateDataStorage(targetFeatureID, targetFeature)
        $draw.add(mapTargetFeature) // Just to trigger re-draw
        $draw.setFeatureProperty(spatialID, 'color_rgb_str', targetFeature.properties.color_rgb_str);
    }
</script>
  
<div class={'map-wrap' + ' ' + klass}>
    <div class="map" id="map" bind:this={mapContainer}></div>
</div>

<style global>
    @import 'maplibre-gl/dist/maplibre-gl.css';
    
    .map-wrap {
        position: relative;
        width: 100%;
        height: 100vh;
        /* background-color: red; */
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