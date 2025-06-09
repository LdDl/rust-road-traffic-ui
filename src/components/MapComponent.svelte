<script lang="ts">
    import { onMount, onDestroy } from 'svelte'
    import maplibregl, { Map as MMap, MapMouseEvent, type MapGeoJSONFeature} from 'maplibre-gl'
    import type MapboxDraw from "@mapbox/mapbox-gl-draw"
    import 'maplibre-gl/dist/maplibre-gl.css'
    import { map, draw } from '../store/map'
    import { mapStyleStore, changeStyle } from '../store/state'
    import { dataStorage, updateDataStorage, resetZoneSpatialInfo } from '../store/data_storage'
    import { EMPTY_POLYGON_RGB } from '../lib/gl_draw_styles.js'
    import { theme } from '../store/theme' // Add theme import
    import type { Feature, GeoJsonObject, Polygon } from 'geojson';
    
    export let klass: string = ''

    let mapContainer: HTMLElement;
    const { accepted_uri } = mapStyleStore;
    let initialStylesURI = $accepted_uri
    let currentTheme = $theme;

    const unsubStylesChange = accepted_uri.subscribe(value => {
        if (initialStylesURI !== value) {
            $map.setStyle(value)
            initialStylesURI = $accepted_uri
        }
    })

    const unsubThemeChange = theme.subscribe(newTheme => {
        if ($map) {
            // Update all existing popup containers with new theme
            const popupContainers = document.querySelectorAll('.popup-container');
            popupContainers.forEach(container => {
                container.setAttribute('data-theme', newTheme);
            });
        }
    });

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

        $map.on('load', () => {
            $map.resize()
        })

        $map.on('click', 'gl-draw-polygon-fill-inactive.cold', function (e: MapMouseEvent & {features?: MapGeoJSONFeature[] | undefined; } & Object) {
            const mapFeature = <Feature><GeoJsonObject>$draw.get(e.features?.[0].properties.id);
            if (!mapFeature) {
                return
            }
            
            // Create options for the custom dropdown
            const polygonOptions = Array.from($dataStorage.values()).map((feature) => {
                const color = feature.properties.color_rgb_str as string;
                return {
                    id: feature.id,
                    color: color,
                    label: feature.id
                };
            });
            
            const clickedFeature = [...$dataStorage].find((f) => f[1].properties.spatial_object_id === mapFeature.id)?.[1]
            
            const popupContent = `
                <div class="popup-container" data-theme="${$theme}">
                    <div class="popup-header">
                        <h3 class="popup-title">Zone Configuration</h3>
                    </div>
                    
                    <div class="popup-content">
                        <div class="form-control w-full">
                            <label class="label">
                                <span class="label-text">Attach canvas polygons</span>
                            </label>
                            <div class="custom-select-wrapper">
                                <div class="custom-select-trigger" id="select-trigger">
                                    <div class="selected-option">
                                        <div class="selected-color" id="selected-color" style="display: none;"></div>
                                        <span class="selected-text" id="selected-text">Pick up polygon</span>
                                    </div>
                                    <i class="material-icons dropdown-arrow">expand_more</i>
                                </div>
                                <div class="custom-select-dropdown" id="select-dropdown">
                                    ${polygonOptions.map(option => `
                                        <div class="custom-option" data-value="${option.id}" data-color="${option.color}">
                                            <div class="option-color" style="background-color: ${option.color};"></div>
                                            <span class="option-text">${option.label}</span>
                                        </div>
                                    `).join('')}
                                </div>
                                <input type="hidden" id="select-canvas" value="">
                            </div>
                        </div>
                        
                        <div class="form-control w-full">
                            <label class="label">
                                <span class="label-text">Direction value</span>
                            </label>
                            <input 
                                value="${clickedFeature ? clickedFeature.properties?.road_lane_direction : -1}" 
                                id="lane-direction" 
                                type="number" 
                                class="input input-bordered w-full"
                            >
                        </div>
                        
                        <div class="form-control w-full">
                            <label class="label">
                                <span class="label-text">Lane</span>
                            </label>
                            <input 
                                value="${clickedFeature ? clickedFeature.properties?.road_lane_num : -1}" 
                                id="lane-number" 
                                type="number" 
                                class="input input-bordered w-full"
                            >
                        </div>
                        
                        <div class="form-actions">
                            <button id="attach-canvas-btn" class="btn btn-primary btn-sm">
                                <i class="material-icons">save</i>
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            `
            
            new maplibregl.Popup({ 
                className: "themed-popup",
                closeButton: true,
                closeOnClick: false
            })
                .setLngLat(e.lngLat)
                .setHTML(popupContent)
                .addTo($map);
                
            // Setup custom dropdown functionality
            const selectTrigger = document.getElementById("select-trigger");
            const selectDropdown = document.getElementById("select-dropdown");
            const selectedColor = document.getElementById("selected-color");
            const selectedText = document.getElementById("selected-text");
            const hiddenInput = <HTMLInputElement>document.getElementById("select-canvas");
            
            if (!selectTrigger || !selectDropdown || !selectedColor || !selectedText || !hiddenInput) {
                return;
            }

            // Toggle dropdown
            selectTrigger.addEventListener('click', () => {
                selectDropdown.classList.toggle('show');
            });

            // Close dropdown when clicking outside
            document.addEventListener('click', (e) => {
                if (!selectTrigger.contains(e.target as Node) && !selectDropdown.contains(e.target as Node)) {
                    selectDropdown.classList.remove('show');
                }
            });

            // Handle option selection
            const options = selectDropdown.querySelectorAll('.custom-option');
            options.forEach(option => {
                option.addEventListener('click', (e) => {
                    const value = option.getAttribute('data-value');
                    const color = option.getAttribute('data-color');
                    const text = option.querySelector('.option-text')?.textContent;
                    
                    if (value && color && text) {
                        hiddenInput.value = value;
                        selectedColor.style.backgroundColor = color;
                        selectedColor.style.display = 'block';
                        selectedText.textContent = text;
                        selectDropdown.classList.remove('show');
                    }
                });
            });

            // Set initial value if polygon is already attached
            Array.from($dataStorage.values()).some(element => {
                if (element.properties.spatial_object_id === mapFeature.id) {
                    const value = element.id ?? 'No canvas ID';
                    const color = element.properties.color_rgb_str;
                    hiddenInput.value = value;
                    selectedColor.style.backgroundColor = color;
                    selectedColor.style.display = 'block';
                    selectedText.textContent = value;
                    return true;
                }
            });
            
            const attachBtn = document.getElementById('attach-canvas-btn');
            if (!attachBtn) {
                console.error("No container 'attach-canvas-btn'")
                return
            }
            attachBtn.addEventListener('click', (clickEvent) => {
                const directionElem = <HTMLInputElement>document.getElementById("lane-direction");
                const laneElem = <HTMLInputElement>document.getElementById("lane-number");
                attachSpatialToDataStorage(mapFeature, hiddenInput.value, {
                    road_lane_direction: directionElem ? parseInt(directionElem.value) : -1, 
                    road_lane_num: laneElem ? parseInt(laneElem.value) : -1
                });
            });
        });
    });

    onDestroy(() => {
        unsubStylesChange()
        unsubThemeChange()
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
        const prevSpatialID = targetFeature.properties.spatial_object_id
        if (prevSpatialID) {
            const prevMapFeature = $draw.get(prevSpatialID)
            if (prevMapFeature) {
                $draw.add(prevMapFeature)
                $draw.setFeatureProperty(prevSpatialID, 'color_rgb_str', EMPTY_POLYGON_RGB);                    
            }
        }
        const prevFeature = [...$dataStorage].find((f) => f[1].id !== targetFeatureID && f[1].properties.spatial_object_id === spatialID)?.[1]
        if (prevFeature) {
            resetZoneSpatialInfo($dataStorage, prevFeature.id)
        }

        targetFeature.properties.spatial_object_id = spatialID
        targetFeature.properties.road_lane_direction = options.road_lane_direction
        targetFeature.properties.road_lane_num = options.road_lane_num
        const spatialPolygon = mapTargetFeature.geometry as Polygon
        targetFeature.geometry.coordinates = spatialPolygon.coordinates
        updateDataStorage(targetFeatureID, targetFeature)
        $draw.add(mapTargetFeature)
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
    }
    
    .map {
        position: absolute;
        width: 100%;
        height: 100%;
    }

    /* DaisyUI themed popup styling */
    .maplibregl-popup.themed-popup .maplibregl-popup-content {
        background: var(--bg-primary);
        border: 1px solid var(--border-primary);
        border-radius: 12px;
        box-shadow: 0 4px 20px var(--shadow);
        padding: 0;
        min-width: 320px;
        max-width: 380px;
        transition: background-color 0.3s ease, border-color 0.3s ease;
    }

    .maplibregl-popup.themed-popup .maplibregl-popup-tip {
        border-top-color: var(--bg-primary);
        border-bottom-color: var(--bg-primary);
        border-left-color: var(--bg-primary);
        border-right-color: var(--bg-primary);
        transition: border-color 0.3s ease;
    }

    .maplibregl-popup.themed-popup .maplibregl-popup-close-button {
        background: var(--bg-secondary);
        color: var(--text-secondary);
        border: 1px solid var(--border-primary);
        border-radius: 6px;
        width: 28px;
        height: 28px;
        top: 12px;
        right: 12px;
        font-size: 18px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
        transition: all 0.3s ease;
    }

    .maplibregl-popup.themed-popup .maplibregl-popup-close-button:hover {
        background: var(--bg-tertiary);
        color: var(--text-primary);
    }

    .popup-container {
        color: var(--text-primary);
        font-family: 'Roboto', sans-serif;
        transition: color 0.3s ease;
    }

    .popup-header {
        padding: 20px 20px 16px 20px;
        border-bottom: 1px solid var(--border-secondary);
        transition: border-color 0.3s ease;
    }

    .popup-title {
        margin: 0;
        font-size: 18px;
        font-weight: 600;
        color: var(--text-primary);
        transition: color 0.3s ease;
    }

    .popup-content {
        padding: 20px;
        display: flex;
        flex-direction: column;
        gap: 16px;
    }

    /* Override DaisyUI colors with theme variables */
    .popup-container .form-control .label-text {
        color: var(--text-secondary);
        font-weight: 500;
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        transition: color 0.3s ease;
    }

    .popup-container .select,
    .popup-container .input {
        background: var(--bg-primary);
        border-color: var(--border-primary);
        color: var(--text-primary);
        transition: all 0.3s ease;
    }

    .popup-container .select:focus,
    .popup-container .input:focus {
        border-color: var(--accent-primary);
        box-shadow: 0 0 0 2px rgba(var(--accent-primary-rgb), 0.1);
        outline: none;
    }

    .popup-container .select option {
        background: var(--bg-primary);
        color: var(--text-primary);
    }

    .popup-container .btn-primary {
        background: var(--accent-primary);
        border-color: var(--accent-primary);
        color: white;
        gap: 6px;
        transition: all 0.3s ease;
    }

    .popup-container .btn-primary:hover {
        background: var(--accent-hover);
        border-color: var(--accent-hover);
    }

    .form-actions {
        display: flex;
        justify-content: flex-end;
        margin-top: 8px;
    }

    /* Material Icons in popup */
    .popup-container .material-icons {
        font-size: 16px;
    }

    /* Dark theme specific adjustments */
    .popup-container[data-theme="dark"] .select,
    .popup-container[data-theme="dark"] .input {
        background: var(--bg-secondary);
    }

    .popup-container[data-theme="dark"] .select option {
        background: var(--bg-secondary);
    }

    .custom-select-wrapper {
        position: relative;
        width: 100%;
    }

    .custom-select-trigger {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        background: var(--bg-primary);
        border: 1px solid var(--border-primary);
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.3s ease;
        min-height: 48px;
    }

    .custom-select-trigger:hover {
        border-color: var(--border-secondary);
    }

    .custom-select-trigger:focus-within {
        border-color: var(--accent-primary);
        box-shadow: 0 0 0 2px rgba(var(--accent-primary-rgb), 0.1);
    }

    .selected-option {
        display: flex;
        align-items: center;
        gap: 8px;
        flex: 1;
    }

    .selected-color {
        width: 20px;
        height: 20px;
        border-radius: 50%;
        border: 2px solid var(--border-primary);
        flex-shrink: 0;
        transition: border-color 0.3s ease;
    }

    .selected-text {
        color: var(--text-primary);
        font-size: 14px;
        transition: color 0.3s ease;
    }

    .dropdown-arrow {
        color: var(--text-secondary);
        font-size: 20px;
        transition: all 0.3s ease;
    }

    .custom-select-trigger:hover .dropdown-arrow {
        color: var(--text-primary);
    }

    .custom-select-dropdown {
        position: absolute;
        top: calc(100% + 4px);
        left: 0;
        right: 0;
        background: var(--bg-primary);
        border: 1px solid var(--border-primary);
        border-radius: 8px;
        box-shadow: 0 4px 12px var(--shadow);
        z-index: 1000;
        max-height: 200px;
        overflow-y: auto;
        display: none;
        transition: all 0.3s ease;
    }

    .custom-select-dropdown.show {
        display: block;
    }

    .custom-option {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 16px;
        cursor: pointer;
        transition: all 0.3s ease;
        border-bottom: 1px solid var(--border-secondary);
    }

    .custom-option:last-child {
        border-bottom: none;
    }

    .custom-option:hover {
        background: var(--bg-secondary);
    }

    .option-color {
        width: 20px;
        height: 20px;
        border-radius: 50%;
        border: 2px solid var(--border-primary);
        flex-shrink: 0;
        transition: border-color 0.3s ease;
    }

    .option-text {
        color: var(--text-primary);
        font-size: 14px;
        font-weight: 500;
        transition: color 0.3s ease;
    }

    /* Custom scrollbar for dropdown */
    .custom-select-dropdown::-webkit-scrollbar {
        width: 6px;
    }

    .custom-select-dropdown::-webkit-scrollbar-track {
        background: var(--bg-secondary);
        transition: background-color 0.3s ease;
    }

    .custom-select-dropdown::-webkit-scrollbar-thumb {
        background: var(--text-secondary);
        border-radius: 3px;
        transition: background-color 0.3s ease;
    }

    .custom-select-dropdown::-webkit-scrollbar-thumb:hover {
        background: var(--text-primary);
    }
    
</style>