<script lang="ts">
    import { onMount, onDestroy } from 'svelte'
    import maplibregl, { Map as MMap, MapMouseEvent, type MapGeoJSONFeature} from 'maplibre-gl'
    import type MapboxDraw from "@mapbox/mapbox-gl-draw"
    import 'maplibre-gl/dist/maplibre-gl.css'
    import { map, draw } from '../store/map'
    import { mapStyleStore, changeStyle } from '../store/state'
    import { dataStorage, updateDataStorage, resetZoneSpatialInfo } from '../store/data_storage'
    import { canvasState } from '../store/state'
    import { CustomPolygon, updateCanvasMeasurements } from '../lib/custom_canvas'
    import { EMPTY_POLYGON_RGB, createDrawStyles } from '../lib/gl_draw_styles.js'
    import { resolveMapStyle, createBlankStyle, BLANK_MAP_STYLE_MARKER } from '../lib/map_styles'
    import { resolvedTheme } from '../store/theme'
    import type { Feature, GeoJsonObject, Polygon } from 'geojson';

    export let klass: string = ''

    /** Called after the map comes back from a hidden tab: MapLibre measures nothing while hidden */
    export function resize() {
        $map?.resize()
    }

    let mapContainer: HTMLElement;
    const { accepted_uri } = mapStyleStore;
    let initialStylesURI = $accepted_uri

    const unsubStylesChange = accepted_uri.subscribe(value => {
        if (initialStylesURI !== value) {
            $map.setStyle(resolveMapStyle(value, $resolvedTheme === 'dark'))
            initialStylesURI = $accepted_uri
        }
    })

    const unsubThemeChange = resolvedTheme.subscribe(newTheme => {
        if ($map) {
            const popupContainers = document.querySelectorAll('.popup-container');
            popupContainers.forEach(container => {
                container.setAttribute('data-theme', newTheme);
            });
            // Update blank map background on theme change
            if ($accepted_uri === BLANK_MAP_STYLE_MARKER) {
                $map.setStyle(createBlankStyle(newTheme === 'dark'));
            }
            // Update draw layer paint properties for theme
            const isDark = newTheme === 'dark';
            const styles = createDrawStyles(isDark);
            for (const style of styles) {
                if ($map.getLayer(style.id) && 'paint' in style) {
                    const paint = style.paint as Record<string, unknown>;
                    for (const [prop, value] of Object.entries(paint)) {
                        try {
                            $map.setPaintProperty(style.id, prop, value);
                        } catch { /* layer may not exist yet */ }
                    }
                }
            }
        }
    });

    onMount(() => {
        console.log('Mounted map component')
        const initialState = { lng: 0, lat: 0, zoom: 5 };
        map.set(new MMap({
            container: mapContainer,
            style: resolveMapStyle(initialStylesURI, $resolvedTheme === 'dark'),
            center: [initialState.lng, initialState.lat],
            zoom: initialState.zoom
        }));

        let fellBackToBlank = false;
        $map.on('error', (e: any) => {
            if (fellBackToBlank) {
                return
            }
            const err = e?.error;
            const status = err?.status;
            const isStyleLoadError = status === 401 || status === 403 || status === 404 ||
                (typeof err?.message === 'string' && /style/i.test(err.message));
            if (!isStyleLoadError) {
                return
            }
            fellBackToBlank = true;
            console.warn('Map style failed to load, falling back to blank style:', err);
            $map.setStyle(createBlankStyle($resolvedTheme === 'dark'));
            mapStyleStore.accepted_uri.set(BLANK_MAP_STYLE_MARKER);
            mapStyleStore.uri.set(BLANK_MAP_STYLE_MARKER);
            initialStylesURI = BLANK_MAP_STYLE_MARKER;
        })

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

            // Get current polygon vertex coordinates
            const polyGeom = mapFeature.geometry as Polygon;
            const ring = polyGeom?.coordinates?.[0] || [];
            const vertexLabels = ['A', 'B', 'C', 'D'];
            const vertices = vertexLabels.map((label, i) => {
                const coord = ring[i];
                return {
                    label,
                    lng: coord && isFinite(coord[0]) ? coord[0] : '',
                    lat: coord && isFinite(coord[1]) ? coord[1] : '',
                };
            });

            const popupContent = `
                <div class="popup-container" data-theme="${$resolvedTheme}">
                    <div class="popup-main" id="popup-main">
                        <div class="popup-accent-bar"></div>
                        <div class="popup-header">
                            <div class="popup-header-left">
                                <i class="material-icons popup-header-icon">layers</i>
                                <h3 class="popup-title">Zone configuration</h3>
                            </div>
                            <button class="popup-close-btn" id="popup-close-btn" type="button">
                                <i class="material-icons">close</i>
                            </button>
                        </div>

                        <div class="popup-content">
                            <div class="popup-field-group">
                                <label class="popup-label">
                                    <i class="material-icons">polyline</i>
                                    Attach canvas polygon
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

                            <div class="popup-fields-card">
                                <div class="popup-field-group">
                                    <label class="popup-label">
                                        <i class="material-icons">swap_horiz</i>
                                        Direction value
                                    </label>
                                    <input
                                        value="${clickedFeature ? clickedFeature.properties?.road_lane_direction : -1}"
                                        id="lane-direction"
                                        type="number"
                                        class="popup-input"
                                    >
                                </div>

                                <div class="popup-field-group">
                                    <label class="popup-label">
                                        <i class="material-icons">format_list_numbered</i>
                                        Lane
                                    </label>
                                    <input
                                        value="${clickedFeature ? clickedFeature.properties?.road_lane_num : -1}"
                                        id="lane-number"
                                        type="number"
                                        class="popup-input"
                                    >
                                </div>
                            </div>

                            <button id="toggle-coords-btn" class="toggle-coords-btn" type="button">
                                <i class="material-icons" id="toggle-coords-icon">chevron_right</i>
                                Edit coordinates
                            </button>
                        </div>

                        <div class="popup-footer">
                            <button id="attach-canvas-btn" class="popup-save-btn">
                                <i class="material-icons">save</i>
                                Save zone
                            </button>
                        </div>
                    </div>

                    <div class="coords-side-panel" id="coords-slide">
                        <div class="coords-side-header">
                            <span class="coords-side-title">Coordinates</span>
                            <div class="coords-history-controls">
                                <button type="button" class="coords-history-btn" id="coords-undo-btn" title="Undo" disabled>
                                    <i class="material-icons">undo</i>
                                </button>
                                <button type="button" class="coords-history-btn" id="coords-redo-btn" title="Redo" disabled>
                                    <i class="material-icons">redo</i>
                                </button>
                                <button type="button" class="coords-history-btn" id="coords-reset-btn" title="Reset">
                                    <i class="material-icons">restart_alt</i>
                                </button>
                            </div>
                        </div>
                        <div class="coords-side-body">
                            <div class="coords-col-headers">
                                <span class="coords-spacer"></span>
                                <span class="coords-col-label">Longitude</span>
                                <span class="coords-col-label">Latitude</span>
                            </div>
                            ${vertices.map((v, i) => `
                                <div class="coords-row" data-point-index="${i}">
                                    <span class="coords-point-label">${v.label}</span>
                                    <input type="number" step="any" placeholder="0.000000" value="${v.lng}" id="coord-lng-${i}" class="coords-input">
                                    <input type="number" step="any" placeholder="0.000000" value="${v.lat}" id="coord-lat-${i}" class="coords-input">
                                </div>
                            `).join('')}
                            <button id="save-coords-btn" class="save-coords-btn" type="button">
                                Save coordinates
                            </button>
                        </div>
                    </div>
                </div>
            `
            
            const popup = new maplibregl.Popup({
                className: "themed-popup",
                closeButton: false,
                closeOnClick: false,
                maxWidth: 'none',
                offset: 12
            })
                .setLngLat(e.lngLat)
                .setHTML(popupContent)
                .addTo($map);
                
            // Close button
            const popupCloseBtn = document.getElementById('popup-close-btn');
            if (popupCloseBtn) {
                popupCloseBtn.addEventListener('click', () => popup.remove());
            }

            // Draggable popup - any non-interactive area
            const popupContainer = document.querySelector('.popup-container') as HTMLElement;
            const popupEl = popup.getElement();
            if (popupContainer && popupEl) {
                const interactive = 'input, button, select, textarea, label, .custom-select-trigger, .custom-select-dropdown, .custom-option';
                let isDragging = false;
                let dragOffsetX = 0, dragOffsetY = 0;
                let startX = 0, startY = 0;

                popupContainer.addEventListener('mousedown', (e) => {
                    if ((e.target as HTMLElement).closest(interactive)) return;
                    isDragging = true;
                    startX = e.clientX - dragOffsetX;
                    startY = e.clientY - dragOffsetY;
                    popupContainer.style.cursor = 'grabbing';
                    e.preventDefault();
                });

                document.addEventListener('mousemove', (e) => {
                    if (!isDragging) return;
                    dragOffsetX = e.clientX - startX;
                    dragOffsetY = e.clientY - startY;
                    popupEl.style.marginLeft = `${dragOffsetX}px`;
                    popupEl.style.marginTop = `${dragOffsetY}px`;
                });

                document.addEventListener('mouseup', () => {
                    if (!isDragging) return;
                    isDragging = false;
                    popupContainer.style.cursor = '';
                });
            }

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
                    const color = element.properties.color_rgb_str ?? '#666';
                    hiddenInput.value = value;
                    selectedColor.style.backgroundColor = color;
                    selectedColor.style.display = 'block';
                    selectedText.textContent = value;
                    return true;
                }
            });
            
            // Toggle coordinates slide
            const toggleBtn = document.getElementById('toggle-coords-btn');
            const coordsSlide = document.getElementById('coords-slide');
            const toggleIcon = document.getElementById('toggle-coords-icon');
            const popupMain = document.getElementById('popup-main');
            if (toggleBtn && coordsSlide && toggleIcon && popupMain) {
                toggleBtn.addEventListener('click', () => {
                    const isOpen = coordsSlide.classList.toggle('open');
                    toggleIcon.textContent = isOpen ? 'chevron_left' : 'chevron_right';
                    popupMain.classList.toggle('side-open', isOpen);
                });
            }

            // Save coordinates
            const saveCoordsBtn = document.getElementById('save-coords-btn');
            if (saveCoordsBtn) {
                saveCoordsBtn.addEventListener('click', () => {
                    const coords: number[][] = [];
                    for (let i = 0; i < 4; i++) {
                        const lngEl = <HTMLInputElement>document.getElementById(`coord-lng-${i}`);
                        const latEl = <HTMLInputElement>document.getElementById(`coord-lat-${i}`);
                        if (!lngEl || !latEl) return;
                        const lng = parseFloat(lngEl.value);
                        const lat = parseFloat(latEl.value);
                        if (!isFinite(lng) || !isFinite(lat)) return;
                        coords.push([lng, lat]);
                    }
                    coords.push([...coords[0]]); // close ring
                    // Update draw feature geometry
                    const updated = $draw.get(mapFeature.id as string);
                    if (updated && updated.geometry.type === 'Polygon') {
                        updated.geometry.coordinates = [coords];
                        $draw.add(updated);
                    }
                    // Update dataStorage if linked
                    const linked = [...$dataStorage].find((f) => f[1].properties.spatial_object_id === mapFeature.id)?.[1];
                    if (linked) {
                        linked.geometry.coordinates = [coords];
                        updateDataStorage(linked.id, linked);
                    }
                });
            }

            // Coordinate history for undo/redo
            const initialCoordSnap = vertices.map(v => ({ lng: String(v.lng), lat: String(v.lat) }));
            let coordHistory: { lng: string; lat: string }[][] = [initialCoordSnap.map(p => ({ ...p }))];
            let coordHistoryIdx = 0;

            const undoBtn = document.getElementById('coords-undo-btn') as HTMLButtonElement;
            const redoBtn = document.getElementById('coords-redo-btn') as HTMLButtonElement;
            const resetBtn = document.getElementById('coords-reset-btn') as HTMLButtonElement;

            function updateHistoryButtons() {
                if (undoBtn) undoBtn.disabled = coordHistoryIdx <= 0;
                if (redoBtn) redoBtn.disabled = coordHistoryIdx >= coordHistory.length - 1;
            }

            function readCurrentCoords(): { lng: string; lat: string }[] {
                return [0, 1, 2, 3].map(j => ({
                    lng: (document.getElementById(`coord-lng-${j}`) as HTMLInputElement)?.value ?? '',
                    lat: (document.getElementById(`coord-lat-${j}`) as HTMLInputElement)?.value ?? '',
                }));
            }

            function writeCoords(snap: { lng: string; lat: string }[]) {
                for (let j = 0; j < 4; j++) {
                    const lngEl = document.getElementById(`coord-lng-${j}`) as HTMLInputElement;
                    const latEl = document.getElementById(`coord-lat-${j}`) as HTMLInputElement;
                    if (lngEl) lngEl.value = snap[j].lng;
                    if (latEl) latEl.value = snap[j].lat;
                }
                updatePreviewFromInputs();
            }

            function pushCoordHistory() {
                const snap = readCurrentCoords();
                coordHistory = [...coordHistory.slice(0, coordHistoryIdx + 1), snap];
                coordHistoryIdx = coordHistory.length - 1;
                updateHistoryButtons();
            }

            function updatePreviewFromInputs() {
                const coords: number[][] = [];
                for (let j = 0; j < 4; j++) {
                    const lng = parseFloat((document.getElementById(`coord-lng-${j}`) as HTMLInputElement)?.value);
                    const lat = parseFloat((document.getElementById(`coord-lat-${j}`) as HTMLInputElement)?.value);
                    if (!isFinite(lng) || !isFinite(lat)) return;
                    coords.push([lng, lat]);
                }
                coords.push([...coords[0]]);
                const updated = $draw.get(mapFeature.id as string);
                if (updated && updated.geometry.type === 'Polygon') {
                    updated.geometry.coordinates = [coords];
                    $draw.add(updated);
                }
                for (let j = 0; j < 4; j++) {
                    ring[j] = coords[j];
                }
            }

            if (undoBtn) {
                undoBtn.addEventListener('click', () => {
                    if (coordHistoryIdx <= 0) return;
                    coordHistoryIdx--;
                    writeCoords(coordHistory[coordHistoryIdx]);
                    updateHistoryButtons();
                });
            }
            if (redoBtn) {
                redoBtn.addEventListener('click', () => {
                    if (coordHistoryIdx >= coordHistory.length - 1) return;
                    coordHistoryIdx++;
                    writeCoords(coordHistory[coordHistoryIdx]);
                    updateHistoryButtons();
                });
            }
            if (resetBtn) {
                resetBtn.addEventListener('click', () => {
                    writeCoords(initialCoordSnap);
                    pushCoordHistory();
                });
            }

            // Reactive coordinate preview on input change
            for (let i = 0; i < 4; i++) {
                const lngEl = document.getElementById(`coord-lng-${i}`) as HTMLInputElement;
                const latEl = document.getElementById(`coord-lat-${i}`) as HTMLInputElement;
                if (lngEl && latEl) {
                    lngEl.addEventListener('input', updatePreviewFromInputs);
                    latEl.addEventListener('input', updatePreviewFromInputs);
                    lngEl.addEventListener('change', pushCoordHistory);
                    latEl.addEventListener('change', pushCoordHistory);
                }
            }

            // Highlight map point on coords row hover
            let highlightMarker: maplibregl.Marker | null = null;
            const coordsRows = document.querySelectorAll('.coords-row[data-point-index]');
            coordsRows.forEach(row => {
                row.addEventListener('mouseenter', () => {
                    if (highlightMarker) { highlightMarker.remove(); highlightMarker = null; }
                    const idx = parseInt(row.getAttribute('data-point-index') || '0');
                    const coord = ring[idx];
                    if (!coord || !isFinite(coord[0]) || !isFinite(coord[1]) || !$map) return;
                    const el = document.createElement('div');
                    const bgColor = getComputedStyle(document.documentElement).getPropertyValue('--bg-primary').trim() || '#ffffff';
                    const color = mapFeature.properties?.color_rgb_str || '#ff0000';
                    el.style.cssText = `
                        width: 14px; height: 14px;
                        border-radius: 50%;
                        border: 2px solid ${color};
                        background: ${bgColor};
                        opacity: 0.9;
                        pointer-events: none;
                    `;
                    highlightMarker = new maplibregl.Marker({ element: el })
                        .setLngLat([coord[0], coord[1]])
                        .addTo($map);
                });
                row.addEventListener('mouseleave', () => {
                    if (highlightMarker) { highlightMarker.remove(); highlightMarker = null; }
                });
            });

            // Clean up highlight when popup closes
            popup.on('close', () => {
                if (highlightMarker) { highlightMarker.remove(); highlightMarker = null; }
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
            const isBlank = $accepted_uri === BLANK_MAP_STYLE_MARKER;
            $map.fitBounds(bounds, {
                maxZoom: 18,
                padding: 100,
                ...(isBlank ? { duration: 0 } : {})
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
            // Clear measurements on the previously linked canvas polygon
            if ($canvasState) {
                const prevCanvasPolygon = $canvasState.getObjects().find(
                    obj => obj instanceof CustomPolygon && obj.unid === prevFeature.id
                ) as CustomPolygon | undefined;
                if (prevCanvasPolygon) {
                    updateCanvasMeasurements(prevCanvasPolygon);
                }
            }
        }

        targetFeature.properties.spatial_object_id = spatialID
        targetFeature.properties.road_lane_direction = options.road_lane_direction
        targetFeature.properties.road_lane_num = options.road_lane_num
        const spatialPolygon = mapTargetFeature.geometry as Polygon
        targetFeature.geometry.coordinates = spatialPolygon.coordinates
        updateDataStorage(targetFeatureID, targetFeature)
        $draw.add(mapTargetFeature)
        $draw.setFeatureProperty(spatialID, 'color_rgb_str', targetFeature.properties.color_rgb_str);

        // Update canvas edge labels and skeleton after linking
        if ($canvasState) {
            const canvasPolygon = $canvasState.getObjects().find(
                obj => obj instanceof CustomPolygon && obj.unid === targetFeatureID
            ) as CustomPolygon | undefined;
            if (canvasPolygon) {
                updateCanvasMeasurements(canvasPolygon, spatialPolygon.coordinates);
                $canvasState.renderAll();
            }
        }
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
        height: 100%;
    }
    
    .map {
        position: absolute;
        width: 100%;
        height: 100%;
    }

    /* DaisyUI themed popup styling */
    .maplibregl-popup.themed-popup .maplibregl-popup-content {
        background: transparent;
        border: none;
        border-radius: 0;
        box-shadow: none;
        padding: 0;
        overflow: visible;
        height: auto;
    }

    .maplibregl-popup.themed-popup .maplibregl-popup-tip {
        display: none;
    }

    .maplibregl-popup.themed-popup .maplibregl-popup-close-button {
        display: none;
    }

    .maplibregl-popup.themed-popup {
        overflow: visible;
        max-width: none !important;
    }

    .popup-container {
        position: relative;
        display: inline-block;
        color: var(--text-primary);
        font-family: 'Roboto', sans-serif;
        transition: color 0.3s ease;
    }

    .popup-main {
        min-width: 340px;
        max-width: 400px;
        background: var(--bg-primary);
        border: 1px solid var(--border-primary);
        border-radius: var(--radius-lg);
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.08);
        flex-shrink: 0;
        position: relative;
        overflow: hidden;
        transition: border-radius 0.3s ease, background-color 0.3s ease, border-color 0.3s ease;
    }

    .popup-main.side-open {
        border-radius: var(--radius-lg) 0 0 var(--radius-lg);
        border-right: none;
    }

    /* Accent bar at the top - subtle top border */
    .popup-accent-bar {
        height: 2px;
        background: var(--accent-primary);
        opacity: 0.6;
    }

    .popup-header {
        padding: var(--space-md) var(--space-xl);
        border-bottom: 1px solid var(--border-secondary);
        display: flex;
        align-items: center;
        justify-content: space-between;
        transition: border-color 0.3s ease;
    }

    .popup-header-left {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
    }

    .popup-header-icon {
        font-size: var(--icon-lg);
        color: var(--accent-primary);
    }

    .popup-title {
        margin: 0;
        font-size: var(--text-md);
        font-weight: 600;
        color: var(--text-primary);
        letter-spacing: -0.01em;
    }

    .popup-close-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: var(--touch-target-sm);
        height: var(--touch-target-sm);
        padding: 0;
        background: var(--bg-secondary);
        border: 1px solid var(--border-primary);
        border-radius: var(--radius-sm);
        color: var(--text-secondary);
        cursor: pointer;
        transition: background-color 0.2s, color 0.2s;
    }

    .popup-close-btn:hover {
        background: var(--bg-tertiary);
        color: var(--text-primary);
    }

    .popup-close-btn i {
        font-size: var(--icon-md);
    }

    .popup-content {
        padding: var(--space-xl);
        display: flex;
        flex-direction: column;
        gap: var(--space-lg);
    }

    /* Popup field groups */
    .popup-field-group {
        display: flex;
        flex-direction: column;
        gap: var(--space-xs);
    }

    .popup-label {
        display: flex;
        align-items: center;
        gap: var(--space-xs);
        color: var(--text-secondary);
        font-weight: 500;
        font-size: var(--text-sm);
    }

    .popup-label .material-icons {
        font-size: var(--icon-sm);
        color: var(--text-secondary);
        opacity: 0.7;
    }

    /* Card grouping for related fields */
    .popup-fields-card {
        display: flex;
        flex-direction: column;
        gap: var(--space-md);
        padding: var(--space-md);
        background: var(--bg-secondary);
        border-radius: var(--radius-md);
        border: 1px solid var(--border-secondary);
    }

    /* Compact popup inputs (replaces DaisyUI input classes) */
    .popup-input {
        width: 100%;
        padding: var(--space-sm) var(--space-md);
        border: 1px solid var(--border-primary);
        border-radius: var(--radius-sm);
        font-size: var(--text-base);
        background: var(--bg-primary);
        color: var(--text-primary);
        box-sizing: border-box;
        transition: border-color 0.15s, box-shadow 0.15s;
    }

    .popup-input:focus {
        outline: none;
        border-color: var(--accent-primary);
        box-shadow: 0 0 0 2px rgba(var(--accent-primary-rgb), 0.15);
    }

    /* Hide number spinners in popup inputs */
    .popup-input::-webkit-inner-spin-button,
    .popup-input::-webkit-outer-spin-button {
        -webkit-appearance: none;
        margin: 0;
    }
    .popup-input {
        -moz-appearance: textfield;
        appearance: textfield;
    }

    .popup-footer {
        padding: var(--space-md) var(--space-xl) var(--space-lg);
    }

    .popup-save-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: var(--space-sm);
        width: 100%;
        padding: var(--space-md) var(--space-lg);
        background: var(--accent-primary);
        border: none;
        border-radius: var(--radius-md);
        color: white;
        font-size: var(--text-md);
        font-weight: 600;
        cursor: pointer;
        transition: background-color 0.2s, transform 0.1s, box-shadow 0.2s;
        box-shadow: 0 2px 8px rgba(var(--accent-primary-rgb, 59, 130, 246), 0.3);
    }

    .popup-save-btn:hover {
        background: var(--accent-hover);
        box-shadow: 0 4px 12px rgba(var(--accent-primary-rgb, 59, 130, 246), 0.4);
    }

    .popup-save-btn:active {
        transform: scale(0.98);
    }

    /* Coordinates slide toggle */
    .toggle-coords-btn {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
        width: 100%;
        padding: var(--space-sm) var(--space-md);
        background: transparent;
        border: 1px dashed var(--border-secondary);
        border-radius: var(--radius-md);
        color: var(--text-secondary);
        font-size: var(--text-sm);
        cursor: pointer;
        transition: color 0.2s, border-color 0.2s, background-color 0.2s;
    }

    .toggle-coords-btn:hover {
        color: var(--accent-primary);
        border-color: var(--accent-primary);
        background: rgba(var(--accent-primary-rgb, 59, 130, 246), 0.05);
    }

    .toggle-coords-btn i {
        font-size: var(--icon-sm);
        transition: transform 0.2s;
    }

    .coords-side-panel {
        position: absolute;
        top: 0;
        left: 100%;
        width: 0;
        overflow: hidden;
        background: var(--bg-primary);
        border: 1px solid var(--border-primary);
        border-left: 1px dashed var(--border-secondary);
        border-radius: 0 var(--radius-lg) var(--radius-lg) 0;
        transition: width 0.3s ease;
    }

    .coords-side-panel.open {
        width: 250px;
    }

    .coords-side-header {
        padding: var(--space-md) var(--space-lg);
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-bottom: 1px solid var(--border-secondary);
        box-sizing: border-box;
        min-height: calc(2px + var(--touch-target-sm) + var(--space-md) * 2 + 1px);
    }

    .coords-history-controls {
        display: flex;
        gap: var(--space-2xs);
    }

    .coords-history-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        padding: 0;
        background: var(--bg-secondary);
        border: 1px solid var(--border-primary);
        border-radius: var(--radius-sm);
        color: var(--text-secondary);
        cursor: pointer;
        transition: background-color 0.15s, color 0.15s, border-color 0.15s;
    }

    .coords-history-btn:hover:not(:disabled) {
        color: var(--accent-primary);
        border-color: var(--accent-primary);
    }

    .coords-history-btn:disabled {
        opacity: 0.3;
        cursor: not-allowed;
    }

    .coords-history-btn i {
        font-size: 16px;
    }

    .coords-side-title {
        font-size: var(--text-md);
        font-weight: 600;
        color: var(--text-primary);
    }

    .coords-side-body {
        padding: var(--space-md) var(--space-md) var(--space-md);
        display: flex;
        flex-direction: column;
        gap: var(--space-xs);
    }

    .coords-col-headers {
        display: flex;
        gap: var(--space-xs);
        align-items: center;
        padding: 0 var(--space-xs) var(--space-2xs);
    }

    .coords-spacer {
        width: 22px;
        flex-shrink: 0;
    }

    .coords-col-label {
        flex: 1;
        font-size: var(--text-2xs);
        color: var(--text-secondary);
        font-weight: 500;
    }

    .coords-row {
        display: flex;
        gap: var(--space-xs);
        align-items: center;
        padding: var(--space-xs);
        border-radius: var(--radius-sm);
        transition: background-color 0.15s;
    }

    .coords-row:hover {
        background: var(--bg-secondary);
    }

    .coords-point-label {
        width: 22px;
        height: 22px;
        line-height: 22px;
        text-align: center;
        font-size: var(--text-xs);
        font-weight: 700;
        border-radius: var(--radius-sm);
        background: var(--bg-tertiary);
        color: var(--text-primary);
        flex-shrink: 0;
        transition: background-color 0.15s, color 0.15s;
    }

    .coords-row:hover .coords-point-label {
        background: var(--accent-primary);
        color: white;
    }

    /* High specificity to override Tailwind/DaisyUI base input styles */
    .popup-container .coords-side-panel input.coords-input {
        flex: 1;
        min-width: 0;
        padding: var(--space-xs) var(--space-xs);
        border: 1px solid var(--border-primary);
        border-radius: var(--radius-sm);
        font-size: var(--text-xs);
        line-height: 1.3;
        font-family: monospace;
        background: var(--bg-primary);
        color: var(--text-primary);
        box-sizing: border-box;
        height: auto;
        min-height: 0;
        transition: border-color 0.15s, box-shadow 0.15s;
    }

    .popup-container .coords-side-panel input.coords-input:focus {
        outline: none;
        border-color: var(--accent-primary);
        box-shadow: 0 0 0 2px rgba(var(--accent-primary-rgb), 0.15);
    }

    /* Hide number spinners in popup */
    .coords-side-panel input.coords-input::-webkit-inner-spin-button,
    .coords-side-panel input.coords-input::-webkit-outer-spin-button {
        -webkit-appearance: none;
        margin: 0;
    }
    .coords-side-panel input.coords-input {
        -moz-appearance: textfield;
        appearance: textfield;
    }

    .save-coords-btn {
        width: 100%;
        padding: var(--space-xs) var(--space-sm);
        margin-top: var(--space-sm);
        background: var(--bg-secondary);
        color: var(--text-primary);
        border: 1px solid var(--border-primary);
        border-radius: var(--radius-sm);
        font-size: var(--text-xs);
        font-weight: 600;
        cursor: pointer;
        transition: background-color 0.2s, border-color 0.2s;
    }

    .save-coords-btn:hover {
        background: var(--accent-primary);
        border-color: var(--accent-primary);
        color: white;
    }


    /* Material Icons in popup */
    .popup-container .material-icons {
        font-size: var(--icon-lg);
    }

    /* Dark theme adjustments */
    .popup-container[data-theme="dark"] .popup-input {
        background: var(--bg-secondary);
    }

    .popup-container[data-theme="dark"] .popup-main {
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(0, 0, 0, 0.3);
    }

    .popup-container[data-theme="dark"] .popup-fields-card {
        background: var(--bg-tertiary);
        border-color: var(--border-primary);
    }

    .popup-container[data-theme="dark"] .popup-save-btn {
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
    }

    .custom-select-wrapper {
        position: relative;
        width: 100%;
    }

    .custom-select-trigger {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--space-sm) var(--space-md);
        background: var(--bg-primary);
        border: 1px solid var(--border-primary);
        border-radius: var(--radius-sm);
        cursor: pointer;
        transition: border-color 0.15s;
        min-height: var(--touch-target-sm);
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
        gap: var(--space-sm);
        flex: 1;
    }

    .selected-color {
        width: var(--space-xl);
        height: var(--space-xl);
        border-radius: 50%;
        border: 2px solid var(--border-primary);
        flex-shrink: 0;
        transition: border-color 0.3s ease;
    }

    .selected-text {
        color: var(--text-primary);
        font-size: var(--text-md);
        transition: color 0.3s ease;
    }

    .dropdown-arrow {
        color: var(--text-secondary);
        font-size: var(--icon-lg);
        transition: color 0.3s ease;
    }

    .custom-select-trigger:hover .dropdown-arrow {
        color: var(--text-primary);
    }

    .custom-select-dropdown {
        position: absolute;
        top: calc(100% + var(--space-xs));
        left: 0;
        right: 0;
        background: var(--bg-primary);
        border: 1px solid var(--border-primary);
        border-radius: var(--radius-sm);
        box-shadow: 0 var(--space-xs) var(--space-md) var(--shadow);
        z-index: 10;
        max-height: 200px;
        overflow-y: auto;
        display: none;
    }

    .custom-select-dropdown.show {
        display: block;
    }

    .custom-option {
        display: flex;
        align-items: center;
        gap: var(--space-md);
        padding: var(--space-md) var(--space-lg);
        cursor: pointer;
        transition: background-color 0.15s;
        border-bottom: 1px solid var(--border-secondary);
    }

    .custom-option:last-child {
        border-bottom: none;
    }

    .custom-option:hover {
        background: var(--bg-secondary);
    }

    .option-color {
        width: var(--space-xl);
        height: var(--space-xl);
        border-radius: 50%;
        border: 2px solid var(--border-primary);
        flex-shrink: 0;
        transition: border-color 0.3s ease;
    }

    .option-text {
        color: var(--text-primary);
        font-size: var(--text-md);
        font-weight: 500;
        transition: color 0.3s ease;
    }

    /* Custom scrollbar for dropdown */
    .custom-select-dropdown::-webkit-scrollbar {
        width: 6px;
    }

    .custom-select-dropdown::-webkit-scrollbar-track {
        background: var(--bg-secondary);
    }

    .custom-select-dropdown::-webkit-scrollbar-thumb {
        background: var(--text-secondary);
        border-radius: 3px;
    }

    .custom-select-dropdown::-webkit-scrollbar-thumb:hover {
        background: var(--text-primary);
    }
    
</style>