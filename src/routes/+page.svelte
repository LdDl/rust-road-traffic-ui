<script lang="ts">
    import { onMount, onDestroy } from 'svelte'
	import type { Unsubscriber } from 'svelte/store';
    import MapComponent from '../components/MapComponent.svelte'
    import CanvasComponent from '../components/CanvasComponent.svelte'
    import Switchers from '../components/Switchers.svelte'
    import ConfigurationStorage from '../components/ConfigurationStorage.svelte';
    import Toolbar from '../components/Toolbar.svelte';
    import { state, canvasReady, dataReady, canvasState, apiUrlStore, changeAPI } from '../store/state.js'
    import { type DrawCreateEvent, type DrawUpdateEvent } from "@mapbox/mapbox-gl-draw"
    import { dataStorage, addZoneFeature, updateDataStorage, clearDataStorage, resetZoneSpatialInfo } from '../store/data_storage'
    import { map, draw } from '../store/map'
    import { EMPTY_POLYGON_RGB } from '../lib/gl_draw_styles.js'
    import { DeleteClickedZone } from '../lib/custom_delete.js'
	import type { Polygon } from 'geojson';
	import { type FabricCanvasWrap, drawCanvasPolygons } from '$lib/custom_canvas';
	import type { ZoneFeature, ZonesCollection } from '$lib/zones';
	import { saveTOML } from '$lib/rest_api_mutations';
	import { States, SubscriberState } from '$lib/states';
    import "../style.css";
    
    const { apiURL } = apiUrlStore
    let initialAPIURL = $apiURL

    let isDragging = false;
    let leftPanelWidth = 50;
    let startX = 0;
    let startWidth = 0;

    let isHorizontalDragging = false;
    let topPanelHeight = 80;
    let startY = 0;
    let startHeight = 0;

    let stateVariable: States;
    state.subscribe((value) => stateVariable = value)

	const title = 'Rust Road Traffic UI'
    
    let mapComponent: any
    let unsubscribeCanvas: Unsubscriber
    let unsubscribeGeoData: Unsubscriber
    $: canvasFocused = (stateVariable === States.AddingZoneCanvas || stateVariable === States.DeletingZoneCanvas)
    $: mapFocused = (stateVariable === States.AddingZoneMap || stateVariable === States.DeletingZoneMap)
    $: dataStorageFiltered = [...$dataStorage].filter((element)=> {
        return (element[1].id && element[1].properties.spatial_object_id)
    })

    const cancelActionTexts: Map<States, string> = new Map([
        [States.AddingZoneCanvas, 'Adding zone to the canvas'],
        [States.DeletingZoneCanvas, 'Deleting zone from the canvas'],
        [States.AddingZoneMap, 'Adding zone to the map'],
        [States.DeletingZoneMap, 'Deleting zone from the map'],
    ])
    const cancelActionUnexpected = 'Unexpected action'
    $: cancelActionText = cancelActionTexts.get(stateVariable)

    const initSubscribers = (subType: SubscriberState) => {
        unsubscribeCanvas = canvasReady.subscribe(value => {
            if (value === true && $dataReady == true && $canvasState) {
                console.log(`MJPEG is loaded after geo data: ${subType}`)
                drawCanvasPolygons($canvasState, state, dataStorage, updateDataStorage)
            }
        })
        unsubscribeGeoData = dataReady.subscribe(value => {
            if (value === true && $canvasReady == true && $canvasState) {
                console.log(`MJPEG is loaded before geo data: '${subType}'`)
                drawCanvasPolygons($canvasState, state, dataStorage, updateDataStorage)
            }
        })
        const endpoint = `${initialAPIURL}/api/polygons/geojson`
        fetch(`${endpoint}`)
            .then((response) => {
                return response.json()
            })
            .then((data: ZonesCollection) => {
                data.features.forEach((feature: ZoneFeature) => {
                    addZoneFeature(feature)
                });
                if (subType === SubscriberState.ReInit) {
                    mapComponent.drawGeoPolygons($draw, $dataStorage);
                } else {
                    $map.on('load', () => {
                        mapComponent.drawGeoPolygons($draw, $dataStorage);
                    });
                }
                dataReady.set(true)
            })
            .catch((error) => {
                console.log(`Error on loading polygons ['${subType}']`, error)
            })
    }

    const unsubApiChange = changeAPI.subscribe(value => {
        if (initialAPIURL !== value) {
            console.log(`Need to change API URL for Data: '${$apiURL}'`)
            initialAPIURL = value

            /* Clean UP */
            canvasReady.set(false)
            dataReady.set(false)
            unsubscribeCanvas()
            unsubscribeGeoData()
            clearDataStorage()
            if ($canvasState !== undefined && $canvasState != null) {
                //@ts-ignore
                $canvasState.getObjects().forEach( (contour: { unid: string; }) => {
                    //@ts-ignore
                    $canvasState.remove(contour);
                })
            }
            $draw.deleteAll()
            initSubscribers(SubscriberState.ReInit)
        }
    })

    onMount(() => {
        console.log('Mounted page')
        initSubscribers(SubscriberState.Init)

        // Override DeleteClickedZone click event
        DeleteClickedZone.onClick = (s: any, e: any) => {
            if (e.featureTarget && stateVariable === States.DeletingZoneMap) {
                const mapTargetFeature = e.featureTarget
                const spatialID = mapTargetFeature.properties.id
                state.set(States.Waiting)
                let mustUpdateSpatial = [...$dataStorage].find((f) => f[1].properties.spatial_object_id === spatialID)?.[1]
                if (!mustUpdateSpatial) {
                    console.warn(`Spatial ID '${spatialID}' not found in datastorage. Just removing from the spatial map...`)
                    $draw.delete(spatialID)
                    $draw.changeMode("simple_select")
                    return
                }
                resetZoneSpatialInfo($dataStorage, mustUpdateSpatial.id)
                $draw.delete(spatialID)
                $draw.changeMode("simple_select")
            }
            return
        }
        
        mapComponent.attachDraw($draw)
        $map.on("draw.create", function(e: DrawCreateEvent) {
            e.features[0].properties = {
                color_rgb_str: EMPTY_POLYGON_RGB,
            }
            $draw.add(e.features[0])
            state.set(States.Waiting);
        })

        $map.on("draw.update", function(e: DrawUpdateEvent) {
            const mapTargetFeature = e.features[0]
            const spatialID = mapTargetFeature.id as string
            let mustUpdateSpatial = [...$dataStorage].find((f) => f[1].properties.spatial_object_id === spatialID)?.[1]
            if (!mustUpdateSpatial) {
                console.warn(`Spatial ID '${spatialID}' not found in datastorage. Ignoring...`)
                return
            }
            const spatialPolygon = mapTargetFeature.geometry as Polygon // @todo: Do we need type check?
            mustUpdateSpatial.geometry.coordinates = spatialPolygon.coordinates
            updateDataStorage(mustUpdateSpatial.id, mustUpdateSpatial)
        })
    });

    onDestroy(() => {
        console.log('Destroyed')
        canvasReady.set(false)
        dataReady.set(false)
        unsubscribeCanvas()
        unsubscribeGeoData()
        unsubApiChange()
    });

    function keyPress(e: KeyboardEvent) { 
        if (e.key === "Escape") {
            resetCurrentCanvasDrawing($canvasState)
            $draw.changeMode('simple_select')
            state.set(States.Waiting)
        }
    }

    const resetCurrentCanvasDrawing = (extendedCanvas?: FabricCanvasWrap) => {
        if (!extendedCanvas) {
            console.warn('No canvas provided to reset current drawing')
            return;
        }
        extendedCanvas.contourTemporary.forEach((value) => {
            extendedCanvas.remove(value)
        })
        extendedCanvas.contourNotationTemporary.forEach((value) => {
            extendedCanvas.remove(value)
        })
        extendedCanvas.contourTemporary = []
        extendedCanvas.contourNotationTemporary = []
        extendedCanvas.contourFinalized = []
    }

    const stateAddToCanvas = () => {
        if (stateVariable !== States.AddingZoneCanvas) {
            state.set(States.AddingZoneCanvas)
            $draw.changeMode('draw_restricted_polygon');
        } else {
            state.set(States.Waiting)
            $draw.changeMode('simple_select');
        }
    }

    const stateAddToMap = () => {
        if (stateVariable !== States.AddingZoneMap) {
            state.set(States.AddingZoneMap)
            $draw.changeMode('draw_restricted_polygon');
        } else {
            state.set(States.Waiting)
            $draw.changeMode('simple_select');
        }
    }

    const stateDelFromCanvas = () => {
        if (stateVariable !== States.DeletingZoneCanvas) {
            state.set(States.DeletingZoneCanvas)
        } else {
            state.set(States.Waiting)
        }
    }

    const stateDelFromMap = () => {
        if (stateVariable !== States.DeletingZoneMap) {
            state.set(States.DeletingZoneMap)
            $draw.changeMode('delete_zone');
        } else {
            state.set(States.Waiting)
            $draw.changeMode('simple_select');
        }
    }

    /* Vertical Splitter Logic */
    const startDrag = (e: MouseEvent) => {
        isDragging = true;
        startX = e.clientX;
        startWidth = leftPanelWidth;
        document.addEventListener('mousemove', handleDrag);
        document.addEventListener('mouseup', stopDrag);
        e.preventDefault();
    };

    const handleDrag = (e: MouseEvent) => {
        if (!isDragging) return;
        const deltaX = e.clientX - startX;
        const containerWidth = window.innerWidth;
        const deltaPercent = (deltaX / containerWidth) * 100;
        leftPanelWidth = Math.max(20, Math.min(80, startWidth + deltaPercent));
    };

    const stopDrag = () => {
        isDragging = false;
        document.removeEventListener('mousemove', handleDrag);
        document.removeEventListener('mouseup', stopDrag);
    };

    /* Horizontal Splitter Logic */
    const startHorizontalDrag = (e: MouseEvent) => {
        isHorizontalDragging = true;
        startY = e.clientY;
        startHeight = topPanelHeight;
        document.addEventListener('mousemove', handleHorizontalDrag);
        document.addEventListener('mouseup', stopHorizontalDrag);
        e.preventDefault();
    };

    const handleHorizontalDrag = (e: MouseEvent) => {
        if (!isHorizontalDragging) return;
        const deltaY = e.clientY - startY;
        const containerHeight = window.innerHeight - 60; // Subtract toolbar height
        const deltaPercent = (deltaY / containerHeight) * 100;
        topPanelHeight = Math.max(30, Math.min(85, startHeight + deltaPercent));
    };

    const stopHorizontalDrag = () => {
        isHorizontalDragging = false;
        document.removeEventListener('mousemove', handleHorizontalDrag);
        document.removeEventListener('mouseup', stopHorizontalDrag);
    };
</script>

<sveltekit:head>
	<title>{title}</title>
</sveltekit:head>

<svelte:window on:keydown={keyPress} />

<div id="main-app">
    <Toolbar 
        onAddToCanvas={stateAddToCanvas}
        onDeleteFromCanvas={stateDelFromCanvas}
        onAddToMap={stateAddToMap}
        onDeleteFromMap={stateDelFromMap}
        onSave={() => saveTOML(initialAPIURL, dataStorageFiltered)}
    />
    <Switchers klass={canvasFocused || mapFocused ? 'blurred noselect' : ''}/>
    <div id="main_workspace" style="grid-template-columns: {leftPanelWidth}% 2px {100 - leftPanelWidth}%;">
        <div id="left_workspace" style="grid-template-rows: {topPanelHeight}% 2px {100 - topPanelHeight}%;">
            <CanvasComponent klass={!canvasFocused && mapFocused ? 'blurred noselect' : ''}/>
            <div class="horizontal-splitter" 
                class:dragging={isHorizontalDragging}
                on:mousedown={startHorizontalDrag}
                role="slider"
                tabindex="0"
                aria-label="Panel height"
                aria-valuemin="30"
                aria-valuemax="85"
                aria-valuenow={topPanelHeight}
                >
                <div class="horizontal-splitter-handle">
                    <div></div> <!-- top line -->
                    <div></div> <!-- center line -->
                    <div></div> <!-- bottom line -->
                </div>
            </div>
            <ConfigurationStorage dataReady={dataReady} data={dataStorageFiltered} klass={!($canvasReady) || (canvasFocused || mapFocused) ? 'blurred noselect' : ''}/>
            <div class="overlay" style="{!canvasFocused && mapFocused ? 'display: block;' : 'display: none;'}">
                Press ESC to cancel '{cancelActionText !== undefined? cancelActionText : cancelActionUnexpected}' mode
            </div>
        </div>
        <div class="splitter" 
            class:dragging={isDragging}
            on:mousedown={startDrag}
            role="slider"
            tabindex="0"
            aria-label="Panel width"
            aria-valuemin="20"
            aria-valuemax="80"
            aria-valuenow={leftPanelWidth}
            >
            <div class="splitter-handle">
                <div></div> <!-- left line -->
                <div></div> <!-- center line -->
                <div></div> <!-- right line -->
            </div>
        </div>
        <div id="right_workspace">
            <MapComponent bind:this={mapComponent} klass={!($canvasReady) || (canvasFocused && !mapFocused) ? 'blurred noselect' : ''}/>
            <div class="overlay" style="{canvasFocused && !mapFocused ? 'display: block;' : 'display: none;'}">
                Press ESC to cancel '{cancelActionText !== undefined? cancelActionText : cancelActionUnexpected}' mode
            </div>
        </div>
    </div>
</div>

<style global>
    :global(body) {
		margin: 0;
        padding: 0;
        font-family: 'Roboto';
        height: 100vh;
        overflow: hidden;
	}

    :global(html) {
        height: 100%;
    }

    /* Dragging cursors */
    :global(body.dragging) {
        user-select: none;
        cursor: col-resize !important;
    }
    :global(body.horizontal-dragging) {
        user-select: none;
        cursor: row-resize !important;
    }

    #right_workspace {
        position: relative;
        overflow: hidden;
    }
    
    .overlay {
        justify-content: center;
        align-items: center;
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background-color: rgba(128, 128, 128, 0.8);
        padding: 0.66665rem;
        border-radius: 5px;
        pointer-events: none;
    }

    .fixed-action-btn.spin-close .btn-large {
        position: relative;
    }
    .fixed-action-btn.spin-close .btn-large i {
        opacity: 1;
        transition: transform 0.3s, opacity 0.3s;
    }
    .fixed-action-btn.spin-close .btn-large:before {
        transition: transform 0.3s, opacity 0.3s;
        content: ' ';
        position: absolute;
        top: 50%;
        left: 50%;
        width: 1.64rem;
        height: 2px;
        background: white;
        margin-top: -2px;
        margin-left: -0.82rem;
        transform: rotate(0);
        opacity: 0;
    }
    .fixed-action-btn.spin-close .btn-large:after {
        transition: transform 0.3s, opacity 0.3s;
        content: ' ' ;
        position: absolute;
        top: 50%;
        left: 50%;
        width: 1.64rem;
        height: 2px;
        background: white;
        margin-top: -2px;
        margin-left: -0.82rem;
        transform: rotate(0);
        opacity: 0;
    }
    .fixed-action-btn.spin-close.active .btn-large i {
        opacity: 0;
    }
    .fixed-action-btn.spin-close.active .btn-large:before {
        opacity: 1;
        transform: rotate(135deg);
    }
    .fixed-action-btn.spin-close.active .btn-large:after {
        opacity: 1;
        transform: rotate(405deg);
    }

    #main_workspace {
        display: grid;
        height: 100%;
        overflow: hidden;
        flex: 1;
        min-height: 0;
    }

    /* Vertical Splitter */
    .splitter {
        width: 2px;
        background-color: #444;
        position: relative;
        z-index: 10;
    }

    .splitter::before {
        content: '';
        position: absolute;
        left: -7px;
        top: 0;
        height: 100%;
        width: 16px;
        cursor: col-resize;
        z-index: 15;
    }

    .splitter .splitter-handle {
        position: absolute;
        left: 50%;
        top: 50%;
        width: 14px;
        height: 20px;
        transform: translate(-50%, -50%);
        display: flex;
        flex-direction: row;
        justify-content: space-between;
        align-items: center;
        pointer-events: none;
    }

    .splitter .splitter-handle div {
        width: 4px;
        height: 38px;
        background-color: #888;
        border: 1px solid #000;
        border-radius: 1px;
    }

    /* Horizontal Splitter */
    .horizontal-splitter {
        height: 2px;
        background-color: #444;
        position: relative;
        z-index: 10;
        grid-area: splitter;
    }

    .horizontal-splitter::before {
        content: '';
        position: absolute;
        top: -7px;
        left: 0;
        width: 100%;
        height: 16px;
        cursor: row-resize;
        z-index: 15;
    }

    .horizontal-splitter .horizontal-splitter-handle {
        position: absolute;
        left: 50%;
        top: 50%;
        width: 20px;
        height: 14px;
        transform: translate(-50%, -50%);
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        align-items: center;
        pointer-events: none;
    }

    .horizontal-splitter .horizontal-splitter-handle div {
        width: 38px;
        height: 4px;
        background-color: #888;
        border: 1px solid #000;
        border-radius: 1px;
    }

    #left_workspace {
        width: 100%;
        background: #eeeeee;
        display: grid;
        grid-auto-flow: row;
        grid-template-areas: 
            "A"
            "splitter"
            "B";
        overflow: hidden;
        min-height: 0;
    }

    .custom-container-canvas {
        position: absolute !important; 
        left: 0;
        top: 0;
    }

    /* Maplibre pointer overwrite for mapbox-gl-draw */
    .maplibregl-map.mouse-pointer .maplibregl-canvas-container.maplibregl-interactive {
        cursor: pointer;
    }
    .maplibregl-map.mouse-move .maplibregl-canvas-container.maplibregl-interactive {
        cursor: move;
    }

    #main-app {
        height: 100vh;
        display: flex;
        flex-direction: column;
        overflow: hidden;
    }
    
    /* #main-app > #main_workspace > *:not(.map-wrap) {
        background: #ffd83c;
        filter: blur(3px);
    } */

    .blurred {
        /* background: #ffd83c; */
        filter: blur(3px);
        cursor: not-allowed !important;
    }
    .blurred div{
        pointer-events: none;
    }
    .noselect {
        -webkit-touch-callout: none; /* iOS Safari */
        -webkit-user-select: none; /* Safari */
        -khtml-user-select: none; /* Konqueror HTML */
        -moz-user-select: none; /* Old versions of Firefox */
        -ms-user-select: none; /* Internet Explorer/Edge */
        user-select: none; /* Non-prefixed version, currently supported by Chrome, Edge, Opera and Firefox */
    }
</style>