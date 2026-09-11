<script lang="ts">
    import { onMount, onDestroy, tick } from 'svelte'
	import type { Unsubscriber } from 'svelte/store';
    import MapComponent from '../components/MapComponent.svelte'
    import CanvasComponent from '../components/CanvasComponent.svelte'
    import ConfigurationStorage from '../components/ConfigurationStorage.svelte';
    import Toolbar from '../components/Toolbar.svelte';
    import StatusBar from '../components/StatusBar.svelte';
    import DeviceView from '../components/DeviceView.svelte';
    import { state, canvasReady, dataReady, canvasState, apiUrlStore, changeAPI } from '../store/state.js'
    import { type DrawCreateEvent, type DrawUpdateEvent } from "@mapbox/mapbox-gl-draw"
    import { dataStorage, addZoneFeature, updateDataStorage, clearDataStorage, resetZoneSpatialInfo, markZonesSaved, forgetSavedZones } from '../store/data_storage'
    import { map, draw } from '../store/map'
    import { EMPTY_POLYGON_RGB } from '../lib/gl_draw_styles.js'
    import { DeleteClickedZone } from '../lib/custom_delete.js'
	import type { Polygon } from 'geojson';
	import { type FabricCanvasWrap, drawCanvasPolygons, CustomPolygon, updateCanvasMeasurements } from '$lib/custom_canvas';
	import type { ZoneFeature, ZonesCollection } from '$lib/zones';
	import { registerEscapeLayer } from '$lib/escape_stack';
	import { activeTab } from '../store/navigation';
	import { restartEpoch } from '../store/status';
	import { saveAll } from '$lib/save_flow';
	import { States, SubscriberState } from '$lib/states';
	import { bindVertexLabels, unbindVertexLabels, clearAllVertexLabels } from '$lib/vertex_labels';
	import { bindEdgeLabels, unbindEdgeLabels } from '$lib/edge_labels';
    import "../style.css";
    
    const { apiURL } = apiUrlStore
    let initialAPIURL = $apiURL

    let isDragging = false;
    let leftPanelWidth = 50;
    let startX = 0;
    let startWidth = 0;

    let releaseEscape: (() => void) | undefined;
    let leftWorkspaceHeight = 0;
    let isHorizontalDragging = false;
    let topPanelHeight = 80;
    let startY = 0;
    let startHeight = 0;

    // Mobile tab switching
    let mobileTab: 'view' | 'zones' = 'view';

    // Responsive detection via matchMedia
    let isMobile = false;
    let isLandscape = false;
    let mqlMobile: MediaQueryList;
    let mqlLandscape: MediaQueryList;

    const onMobileChange = (e: MediaQueryListEvent) => { isMobile = e.matches };
    const onLandscapeChange = (e: MediaQueryListEvent) => { isLandscape = e.matches };

    // MapLibre measures nothing while its panel is hidden, so it needs a nudge on return
    async function onTabChange(tab: string) {
        if (tab !== 'setup') return
        await tick()
        mapComponent?.resize()
    }

    $: onTabChange($activeTab)

    // Cancel active mode when leaving View tab on mobile
    $: if (mobileTab !== 'view' && stateVariable !== States.Waiting) {
        cancelCurrentAction();
    }

    let stateVariable: States;
    state.subscribe((value) => stateVariable = value)

	const title = 'Rust Road Traffic UI'
    
    let mapComponent: MapComponent
    let unsubscribeCanvas: Unsubscriber
    let unsubscribeGeoData: Unsubscriber
    $: canvasFocused = (stateVariable === States.AddingZoneCanvas || stateVariable === States.DeletingZoneCanvas)
    $: mapFocused = (stateVariable === States.AddingZoneMap || stateVariable === States.DeletingZoneMap)
    $: dataStorageAll = [...$dataStorage].filter((element) => element[1].id)

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

        // Two async operations race: map style load and data fetch.
        // With fast styles (e.g. blank), 'load' fires before fetch completes.
        // Coordinate via two flags so drawGeoPolygons runs once both are done.
        let mapReady = (subType === SubscriberState.ReInit) || $map.isStyleLoaded()
        let dataFetched = false

        const tryDrawGeo = () => {
            if (mapReady && dataFetched) {
                mapComponent.drawGeoPolygons($draw, $dataStorage)
            }
        }

        if (!mapReady) {
            $map.once('load', () => { mapReady = true; tryDrawGeo() })
        }

        fetch(`${endpoint}`)
            .then((response) => {
                return response.json()
            })
            .then((data: ZonesCollection) => {
                data.features.forEach((feature: ZoneFeature) => {
                    addZoneFeature(feature)
                });
                dataFetched = true
                tryDrawGeo()
                markZonesSaved()
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

            // The frame comes from the new address too, so the canvas waits for it again
            canvasReady.set(false)
            reloadZones()
        }
    })

    function reloadZones() {
        dataReady.set(false)
        forgetSavedZones()
        if (unsubscribeCanvas) unsubscribeCanvas()
        if (unsubscribeGeoData) unsubscribeGeoData()
        clearDataStorage()
        clearAllVertexLabels()
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

    // A restart rereads the file: the zones on screen are read again from the new run.
    // The canvas stays ready, the frame is the same size and only the stream reconnects
    let seenRestartEpoch = $restartEpoch
    const unsubRestart = restartEpoch.subscribe(epoch => {
        if (epoch === seenRestartEpoch) return
        seenRestartEpoch = epoch
        reloadZones()
    })

    onMount(() => {
        console.log('Mounted page')
        // Registered first, so any panel opened later gets Escape before the drawing mode does
        releaseEscape = registerEscapeLayer(cancelCurrentAction)
        initSubscribers(SubscriberState.Init)

        // Responsive breakpoint detection
        mqlMobile = window.matchMedia('(max-width: 1024px)');
        mqlLandscape = window.matchMedia('(max-width: 1024px) and (orientation: landscape)');
        isMobile = mqlMobile.matches;
        isLandscape = mqlLandscape.matches;
        mqlMobile.addEventListener('change', onMobileChange);
        mqlLandscape.addEventListener('change', onLandscapeChange);

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
        bindVertexLabels($map, $draw)
        bindEdgeLabels($map, $draw)
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

            // Update canvas measurements in real-time
            if ($canvasState) {
                const canvasPolygon = $canvasState.getObjects().find(
                    obj => obj instanceof CustomPolygon && obj.unid === mustUpdateSpatial!.id
                ) as CustomPolygon | undefined;
                if (canvasPolygon) {
                    updateCanvasMeasurements(canvasPolygon, spatialPolygon.coordinates);
                    $canvasState.renderAll();
                }
            }
        })
    });

    onDestroy(() => {
        console.log('Destroyed')
        canvasReady.set(false)
        dataReady.set(false)
        unbindVertexLabels()
        unbindEdgeLabels()
        unsubscribeCanvas()
        unsubscribeGeoData()
        mqlMobile?.removeEventListener('change', onMobileChange);
        mqlLandscape?.removeEventListener('change', onLandscapeChange);
        unsubApiChange()
        unsubRestart()
        releaseEscape?.()
    });

    function cancelCurrentAction() {
        resetCurrentCanvasDrawing($canvasState)
        $draw.changeMode('simple_select')
        state.set(States.Waiting)
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

    /* Vertical Splitter Logic (pointer events for mouse + touch) */
    const startDrag = (e: PointerEvent) => {
        isDragging = true;
        startX = e.clientX;
        startWidth = leftPanelWidth;
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        document.addEventListener('pointermove', handleDrag);
        document.addEventListener('pointerup', stopDrag);
        e.preventDefault();
    };

    const handleDrag = (e: PointerEvent) => {
        if (!isDragging) return;
        const deltaX = e.clientX - startX;
        const containerWidth = window.innerWidth;
        const deltaPercent = (deltaX / containerWidth) * 100;
        leftPanelWidth = Math.max(20, Math.min(80, startWidth + deltaPercent));
    };

    const stopDrag = () => {
        isDragging = false;
        document.removeEventListener('pointermove', handleDrag);
        document.removeEventListener('pointerup', stopDrag);
    };

    /* Horizontal Splitter Logic (pointer events for mouse + touch) */
    const startHorizontalDrag = (e: PointerEvent) => {
        isHorizontalDragging = true;
        startY = e.clientY;
        startHeight = topPanelHeight;
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        document.addEventListener('pointermove', handleHorizontalDrag);
        document.addEventListener('pointerup', stopHorizontalDrag);
        e.preventDefault();
    };

    const handleHorizontalDrag = (e: PointerEvent) => {
        if (!isHorizontalDragging) return;
        const deltaY = e.clientY - startY;
        const containerHeight = leftWorkspaceHeight || window.innerHeight;
        const deltaPercent = (deltaY / containerHeight) * 100;
        topPanelHeight = Math.max(30, Math.min(85, startHeight + deltaPercent));
    };

    const stopHorizontalDrag = () => {
        isHorizontalDragging = false;
        document.removeEventListener('pointermove', handleHorizontalDrag);
        document.removeEventListener('pointerup', stopHorizontalDrag);
    };
</script>

<sveltekit:head>
	<title>{title}</title>
	<meta name="viewport" content="width=device-width, initial-scale=1" />
</sveltekit:head>


<div id="main-app">
    <StatusBar />
    <DeviceView active={$activeTab === 'device'} />
    <div class="tab-panel" class:tab-hidden={$activeTab !== 'setup'}>
    <div class="toolbar-wrapper" class:toolbar-hidden-mobile={mobileTab !== 'view'}>
        <Toolbar
            onAddToCanvas={stateAddToCanvas}
            onDeleteFromCanvas={stateDelFromCanvas}
            onAddToMap={stateAddToMap}
            onDeleteFromMap={stateDelFromMap}
            onSave={() => saveAll(initialAPIURL)}
            compact={isMobile}
            landscape={isLandscape}
        />
    </div>
    <!-- Mobile tab bar (visible < 1024px) -->
    <div class="mobile-tab-bar">
        <button class="mobile-tab" class:active={mobileTab === 'view'} on:click={() => mobileTab = 'view'}>
            <i class="material-icons">dashboard</i>
            <span>View</span>
        </button>
        <button class="mobile-tab" class:active={mobileTab === 'zones'} on:click={() => mobileTab = 'zones'}>
            <i class="material-icons">list</i>
            <span>Zones</span>
        </button>
    </div>
    <div id="main_workspace" class:mobile={isMobile} style={isMobile ? '' : `grid-template-columns: ${leftPanelWidth}% 2px ${100 - leftPanelWidth}%`}>
        <div id="left_workspace" bind:clientHeight={leftWorkspaceHeight} style={isMobile ? '' : `grid-template-rows: ${topPanelHeight}% 2px ${100 - topPanelHeight}%`}>
            <div class="canvas-panel" class:mobile-hidden={mobileTab === 'zones'}>
                <CanvasComponent active={$activeTab === 'setup'} klass={!canvasFocused && mapFocused ? 'blurred noselect' : ''}/>
            </div>
            <div class="horizontal-splitter"
                class:dragging={isHorizontalDragging}
                on:pointerdown={startHorizontalDrag}
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
            <div class="zones-panel" class:mobile-hidden={mobileTab === 'view'}>
                <ConfigurationStorage dataReady={dataReady} data={dataStorageAll} klass={!($canvasReady) || (canvasFocused || mapFocused) ? 'blurred noselect' : ''}/>
            </div>
            <div class="overlay" style="{!canvasFocused && mapFocused ? 'display: flex;' : 'display: none;'}">
                <span>Press ESC to cancel '{cancelActionText !== undefined? cancelActionText : cancelActionUnexpected}' mode</span>
                <button class="overlay-cancel-btn" on:click={cancelCurrentAction}>Cancel</button>
            </div>
        </div>
        <div class="splitter"
            class:dragging={isDragging}
            on:pointerdown={startDrag}
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
        <div id="right_workspace" class:mobile-hidden={mobileTab === 'zones'}>
            <MapComponent bind:this={mapComponent} klass={!($canvasReady) || (canvasFocused && !mapFocused) ? 'blurred noselect' : ''}/>
            <div class="overlay" style="{canvasFocused && !mapFocused ? 'display: flex;' : 'display: none;'}">
                <span>Press ESC to cancel '{cancelActionText !== undefined? cancelActionText : cancelActionUnexpected}' mode</span>
                <button class="overlay-cancel-btn" on:click={cancelCurrentAction}>Cancel</button>
            </div>
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
        background-color: var(--bg-primary);
        color: var(--text-primary);
        transition: background-color 0.3s ease, color 0.3s ease;
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
        display: flex;
        flex-direction: column;
        gap: var(--space-sm);
        justify-content: center;
        align-items: center;
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background-color: var(--bg-secondary);
        color: var(--text-primary);
        padding: var(--space-md) var(--space-lg);
        border-radius: var(--radius-md);
        pointer-events: auto;
        border: 1px solid var(--border-primary);
        box-shadow: 0 var(--space-xs) var(--space-md) var(--shadow);
        backdrop-filter: blur(10px);
        opacity: 0.95;
        font-weight: 500;
        font-size: var(--text-md);
        z-index: 20;
    }

    .overlay-cancel-btn {
        padding: var(--space-xs) var(--space-md);
        background: var(--danger-primary);
        color: white;
        border: none;
        border-radius: var(--radius-sm);
        cursor: pointer;
        font-size: var(--text-base);
        font-weight: 500;
        transition: background-color 0.2s;
    }

    .overlay-cancel-btn:hover {
        background: var(--danger-hover);
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
        background-color: var(--splitter-bg);
        position: relative;
        z-index: 10;
        transition: background-color 0.3s ease;
        touch-action: none;
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
        background-color: var(--splitter-handle);
        border: 1px solid var(--border-primary);
        border-radius: 1px;
        transition: background-color 0.3s ease, border-color 0.3s ease;
    }

    .splitter:hover .splitter-handle div {
        background-color: var(--text-primary);
        border-color: var(--text-secondary);
    }

    /* Horizontal Splitter */
    .horizontal-splitter {
        height: 2px;
        background-color: var(--splitter-bg);
        position: relative;
        z-index: 10;
        grid-area: splitter;
        transition: background-color 0.3s ease;
        touch-action: none;
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
        background-color: var(--splitter-handle);
        border: 1px solid var(--border-primary);
        border-radius: 1px;
        transition: background-color 0.3s ease, border-color 0.3s ease;
    }

    .horizontal-splitter:hover .horizontal-splitter-handle div {
        background-color: var(--text-primary);
        border-color: var(--text-secondary);
    }
    
    /* Dragging states for splitters */
    .splitter.dragging,
    .horizontal-splitter.dragging {
        background-color: var(--accent-primary);
    }

    .splitter.dragging .splitter-handle div,
    .horizontal-splitter.dragging .horizontal-splitter-handle div {
        background-color: var(--accent-primary);
        border-color: var(--accent-hover);
    }

    #left_workspace {
        position: relative;
        width: 100%;
        background: var(--bg-secondary);
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
        background: var(--bg-primary);
    }

    .tab-panel {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-height: 0;
    }

    .tab-panel.tab-hidden {
        display: none;
    }
    
    .blurred {
        filter: blur(3px);
        cursor: not-allowed !important;
        transition: filter 0.3s ease;
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
        user-select: none;
    }

    /* Mobile tab bar - hidden on desktop */
    .mobile-tab-bar {
        display: none;
    }

    .canvas-panel, .zones-panel {
        display: contents;
    }

    /* Responsive: tablet/phone (<768px) */
    @media (max-width: 1024px) {
        .mobile-tab-bar {
            display: flex;
            background: var(--bg-primary);
            border-bottom: 1px solid var(--border-primary);
            flex-shrink: 0;
            z-index: 50;
        }

        .mobile-tab {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: var(--space-2xs);
            padding: var(--space-sm) var(--space-xs);
            background: transparent;
            border: none;
            border-bottom: 2px solid transparent;
            color: var(--text-secondary);
            font-size: var(--text-xs);
            cursor: pointer;
            transition: color 0.2s, background-color 0.2s, border-color 0.2s;
            min-height: 44px;
        }

        .mobile-tab i {
            font-size: var(--icon-lg);
        }

        .mobile-tab.active {
            color: var(--accent-primary);
            border-bottom-color: var(--accent-primary);
        }

        .mobile-tab:hover {
            color: var(--text-primary);
            background: var(--bg-secondary);
        }

        /* Portrait: canvas on top, map on bottom (column) */
        #main_workspace {
            display: flex;
            flex-direction: column;
        }

        /* Hide splitters on mobile */
        .splitter,
        .horizontal-splitter {
            display: none;
        }

        /* Left workspace: holds canvas OR zones depending on tab */
        #left_workspace {
            display: flex;
            flex-direction: column;
            flex: 1;
            min-height: 0;
        }

        #left_workspace .canvas-panel {
            display: flex;
            flex-direction: column;
            flex: 1;
            min-height: 0;
        }

        #left_workspace .zones-panel {
            display: block;
            flex: 1;
            min-height: 0;
            overflow-y: auto;
        }

        /* Right workspace: map, flex: 1 to share space with left */
        #right_workspace {
            flex: 1;
            min-height: 0;
        }

        /* Tab switching - ID-qualified selectors to beat #id specificity */
        #right_workspace.mobile-hidden,
        #left_workspace .canvas-panel.mobile-hidden,
        #left_workspace .zones-panel.mobile-hidden {
            display: none !important;
        }

        /* Hide toolbar on Zones/Settings tabs */
        .toolbar-hidden-mobile {
            display: none !important;
        }

        /* Hide main workspace when on settings tab */
        #main_workspace.mobile-hidden {
            display: none !important;
        }
    }

    /* Landscape phone: canvas left, map right (row) */
    @media (max-width: 1024px) and (orientation: landscape) {
        #main_workspace {
            flex-direction: row;
        }

        /* In landscape row layout, left_workspace should not stretch full width */
        #left_workspace {
            flex: 1;
            min-width: 0;
        }

        #right_workspace {
            flex: 1;
            min-width: 0;
        }

        /* Compact tab bar in landscape */
        .mobile-tab {
            padding: var(--space-xs);
            min-height: 32px;
            font-size: var(--text-2xs);
        }

        .mobile-tab i {
            font-size: var(--icon-lg);
        }
    }
</style>