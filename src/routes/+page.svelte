<script lang="ts">
    import { onMount, onDestroy } from 'svelte'
	import type { Unsubscriber } from 'svelte/store';
    import MapComponent from '../components/MapComponent.svelte'
    import CanvasComponent from '../components/CanvasComponent.svelte'
    import Switchers from '../components/Switchers.svelte'
    import ConfigurationStorage from '../components/ConfigurationStorage.svelte';
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

    const { apiURL } = apiUrlStore
    let initialAPIURL = $apiURL

    let stateVariable: States;
    state.subscribe((value) => stateVariable = value)

	const title = 'Rust Road Traffic UI'
    
    let mapComponent: any
    let unsubscribeCanvas: Unsubscriber
    let unsubscribeGeoData: Unsubscriber
    $: canvasFocused = ($state === States.AddingZoneCanvas || $state === States.DeletingZoneCanvas)
    $: mapFocused = ($state === States.AddingZoneMap || $state === States.DeletingZoneMap)
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
    $: cancelActionText = cancelActionTexts.get($state)

    const initSubscribers = (subType: SubscriberState) => {
        unsubscribeCanvas = canvasReady.subscribe(value => {
            if (value === true && $dataReady == true) {
                console.log(`MJPEG is loaded after geo data: ${subType}`)
                drawCanvasPolygons($canvasState, state, $dataStorage, updateDataStorage)
            }
        })
        unsubscribeGeoData = dataReady.subscribe(value => {
            if (value === true && $canvasReady == true) {
                console.log(`MJPEG is loaded before geo data: '${subType}'`)
                drawCanvasPolygons($canvasState, state, $dataStorage, updateDataStorage)
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
        console.log('Mounted')
        initializeMaterialize()
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

    const initializeMaterialize = () => {
        const fixedButtons = document.querySelectorAll('.fixed-action-btn')
        // @ts-ignore
        const fixedButtonsInstances = M.FloatingActionButton.init(fixedButtons, {
            direction: 'left',
            hoverEnabled: false
        })
        const collapsibleElem = document.getElementById('collapsible-data')
        // @ts-ignore
        const collapsibleInstances = M.Collapsible.init(collapsibleElem, {})
	}

    const resetCurrentCanvasDrawing = (extendedCanvas: FabricCanvasWrap) => {
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
</script>

<sveltekit:head>
	<title>{title}</title>
</sveltekit:head>

<svelte:window on:keydown={keyPress} />

<div id="main-app">
    <div class="fixed-action-btn horizontal click-to-toggle spin-close">
        <!-- svelte-ignore a11y-missing-attribute -->
        <a class="btn-floating btn-large red">
            <i class="material-icons">edit</i>
        </a>
        <ul>
            <li>
                <!-- svelte-ignore a11y-click-events-have-key-events -->
                <a id="add-btn" class="btn-floating green" on:click={stateAddToCanvas} title="Add zone to the canvas" aria-label="Add zone to the canvas" role="button" tabindex="0"><i class="material-icons">add</i></a>
            </li>
            <li>
                <!-- svelte-ignore a11y-click-events-have-key-events -->
                <a id="del-btn" class="btn-floating blue" on:click={stateDelFromCanvas} title="Delete zone from the canvas" aria-label="Delete zone from the canvas" role="button" tabindex="0"><i class="material-icons">delete</i></a>
            </li>
            <li>
                <!-- svelte-ignore a11y-click-events-have-key-events -->
                <a id="add-btn" class="btn-floating orange" on:click={stateAddToMap} title="Add zone to the map" aria-label="Add zone to the map" role="button" tabindex="0"><i class="material-icons">add_location</i></a>
            </li>
            <li>
                <!-- svelte-ignore a11y-click-events-have-key-events -->
                <a id="del-btn" class="btn-floating blue" on:click={stateDelFromMap} title="Delete zone from the map" aria-label="Delete zone from the map" role="button" tabindex="0"><i class="material-icons">location_off</i></a>
            </li>
            <li>
                <!-- svelte-ignore a11y-click-events-have-key-events -->
                <a id="save-btn" class="btn-floating grey" on:click={() => saveTOML(initialAPIURL, dataStorageFiltered)} title="Apply and save changes" aria-label="Apply and save changes" role="button" tabindex="0"><i class="material-icons">save</i></a>
            </li>
        </ul>
    </div>
    <Switchers klass={canvasFocused || mapFocused ? 'blurred noselect' : ''}/>
    <div id="main_workspace">
        <div id="left_workspace">
            <CanvasComponent klass={!canvasFocused && mapFocused ? 'blurred noselect' : ''}/>
            <ConfigurationStorage dataReady={dataReady} data={dataStorageFiltered} klass={!($canvasReady) || (canvasFocused || mapFocused) ? 'blurred noselect' : ''}/>
            <div class="overlay" style="{!canvasFocused && mapFocused ? 'display: block;' : 'display: none;'}">
                Press ESC to cancel '{cancelActionText !== undefined? cancelActionText : cancelActionUnexpected}' mode
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
	}

    #right_workspace, #left_workspace {
        position: relative;
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
        grid-template-columns: 1fr 1fr;
        height: 100%
    }

    #left_workspace {
        width: 100%;
        /* color: #ff00ff; */
        background: #eeeeee;
        display: grid;
        grid-auto-flow: row;
        grid-template-areas: 
            "A"
            "B";
        grid-template-rows: 80% 20%;
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