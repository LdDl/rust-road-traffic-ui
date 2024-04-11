<script lang="ts">
    import { onMount, onDestroy } from 'svelte'
	import type { Unsubscriber } from 'svelte/store';
    import { fabric } from "fabric"
    import MapComponent from '../components/MapComponent.svelte'
    import CanvasComponent from '../components/CanvasComponent.svelte'
    import Switchers from '../components/Switchers.svelte'
    import ConfigurationStorage from '../components/ConfigurationStorage.svelte';
    import { States, state, mjpegReady, dataReady, apiUrlStore, changeAPI } from '../store/state.js'
    import { type DrawCreateEvent, type DrawUpdateEvent } from "@mapbox/mapbox-gl-draw"
    import { dataStorage, addZoneFeature, updateDataStorage, deleteFromDataStorage, clearDataStorage, resetZoneSpatialInfo, deattachCanvasFromSpatial } from '../store/data_storage'
    import { map, draw } from '../store/map'
    import { EMPTY_POLYGON_RGB } from '../lib/gl_draw_styles.js'
    import { DeleteClickedZone } from '../lib/custom_delete.js'
    import { getClickPoint, UUIDv4, rgba2array } from '../lib/utils'
	import type { Polygon } from 'geojson';
	import { ExtendedCanvas, makeContour, type FabricCanvasWrap, verticesChars, drawCanvasPolygons, type ContourPoint } from '$lib/custom_canvas';
	import type { ZoneFeature, ZonesCollection } from '$lib/zones';
	import { saveTOML } from '$lib/rest_api_mutations';

    const { apiURL } = apiUrlStore
    let initialAPIURL = $apiURL

	const title = 'Rust Road Traffic UI'
    // let scaleWidth: number, scaleHeight: number
    let canvas: HTMLCanvasElement
    let image: HTMLImageElement
    let fbCanvas: FabricCanvasWrap
    let fbCanvasParent: Element
    let mapComponent: any
    let unsubscribeMJPEG: Unsubscriber
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

    const unsubApiChange = changeAPI.subscribe(value => {
        if (initialAPIURL !== value) {
            console.log(`Need to change API URL for Data: '${$apiURL}'`)
            initialAPIURL = value

            /* Clean UP */
            mjpegReady.set(false)
            dataReady.set(false)
            unsubscribeMJPEG()
            unsubscribeGeoData()
            clearDataStorage()

            if (fbCanvas !== undefined && fbCanvas != null) {
                //@ts-ignore
                fbCanvas.getObjects().forEach( (contour: { unid: string; }) => {
                    //@ts-ignore
                    fbCanvas.remove(contour);
                    if ($draw !== null) {
                        $draw.delete(contour.unid)
                    }
                })
            }

            /* Re-init */
            unsubscribeMJPEG = mjpegReady.subscribe(value => {
            if (value === true) {
                    // Initialize canvas if it's empty (due the MJPEG error)
                    if (fbCanvas === undefined || fbCanvas == null) {
                        initializeCanvas()
                    }
                }
                if (value === true && $dataReady == true) {
                    // console.log(`MJPEG is loaded before geo data`)
                    drawCanvasPolygons(fbCanvas, state, $dataStorage, updateDataStorage)
                }
            })
            unsubscribeGeoData = dataReady.subscribe(value => {
                if (value === true && $mjpegReady == true) {
                    // console.log(`Geo data is loaded before MJPEG`)
                    drawCanvasPolygons(fbCanvas, state, $dataStorage, updateDataStorage)
                }
            })
            const endpoint = `${initialAPIURL}/api/polygons/geojson`
            fetch(`${endpoint}`)
                .then((response) => {
                    return response.json()
                })
                .then((data: ZonesCollection) => {
                    data.features.forEach((feature) => {
                        addZoneFeature(feature)
                    });
                    mapComponent.drawGeoPolygons($draw, $dataStorage);
                    dataReady.set(true)
                })
                .catch((error) => {
                    console.log('Error on loading polygons', error)
                })
        }
    })

    onMount(() => {
        console.log('Mounted')

        // Initialize subscribers
        unsubscribeMJPEG = mjpegReady.subscribe(value => {
        if (value === true) {
                initializeCanvas()
            }
            if (value === true && $dataReady == true) {
                console.log(`MJPEG is loaded before geo data`)
                drawCanvasPolygons(fbCanvas, state, $dataStorage, updateDataStorage)
            }
        })

        unsubscribeGeoData = dataReady.subscribe(value => {
            if (value === true && $mjpegReady == true) {
                console.log(`Geo data is loaded before MJPEG`)
                drawCanvasPolygons(fbCanvas, state, $dataStorage, updateDataStorage)
            }
        })

        // Override DeleteClickedZone click event
        DeleteClickedZone.onClick = (s: any, e: any) => {
            if (e.featureTarget && $state === States.DeletingZoneMap) {
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

        const endpoint = `${initialAPIURL}/api/polygons/geojson`
        fetch(`${endpoint}`)
            .then((response) => {
                return response.json()
            })
            .then((data: ZonesCollection) => {
                data.features.forEach((feature: ZoneFeature) => {
                    addZoneFeature(feature)
                });
                $map.on('load', () => {
                    mapComponent.drawGeoPolygons($draw, $dataStorage);
                });
                dataReady.set(true)
            })
            .catch((error) => {
                console.log('Error on loading polygons [initial]', error)
            })
    });

    onDestroy(() => {
        console.log('Destroyed')
        mjpegReady.set(false)
        dataReady.set(false)
        unsubscribeMJPEG()
        unsubscribeGeoData()
        unsubApiChange()
    });

    function keyPress(e: KeyboardEvent) { 
        if (e.key === "Escape") {
            resetCurrentCanvasDrawing(fbCanvas)
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
    
    const initializeCanvas = () => {
        canvas = document.getElementById('fit_canvas') as HTMLCanvasElement
        image = document.getElementById('fit_img') as HTMLImageElement
        canvas.width = image.clientWidth
        canvas.height = image.clientHeight
        fbCanvas = new ExtendedCanvas('fit_canvas', {
            containerClass: 'custom-container-canvas',
            fireRightClick: true,  
            fireMiddleClick: true, 
            stopContextMenu: true
        })
        fbCanvas.scaleWidth = image.clientWidth/image.naturalWidth
        fbCanvas.scaleHeight = image.clientHeight/image.naturalHeight
        fbCanvasParent = document.getElementsByClassName('custom-container-canvas')[0];
        fbCanvasParent.id = "fbcanvas";
        fbCanvas.on('selection:created', (options: any) => {
            if ($state === States.DeletingZoneCanvas) {
                deleteZoneFromCanvas(fbCanvas, options.selected[0].unid);
                state.set(States.Waiting)
            }
        })
        fbCanvas.on('selection:updated', (options: any) => {
            if ($state === States.DeletingZoneCanvas) {
                deleteZoneFromCanvas(fbCanvas, options.selected[0].unid);
                state.set(States.Waiting)
            }
        })
        fbCanvas.on('mouse:move', (options: any) => {
            if (fbCanvas.contourTemporary[0] !== null && fbCanvas.contourTemporary[0] !== undefined && $state === States.AddingZoneCanvas) {
                const clicked = getClickPoint(fbCanvas, options)
                fbCanvas.contourTemporary[fbCanvas.contourTemporary.length - 1].set({ x2: clicked.x, y2: clicked.y })
                fbCanvas.renderAll()
            }
        });
        fbCanvas.on('mouse:down', (options: any) => {
            if ($state !== States.AddingZoneCanvas) {
                return
            }
            fbCanvas.selection = false
            const clicked = getClickPoint(fbCanvas, options)
            fbCanvas.contourFinalized.push({ x: clicked.x, y: clicked.y })
            const points = [clicked.x, clicked.y, clicked.x, clicked.y]
            const newLine = new fabric.Line(points, {
                strokeWidth: 3,
                selectable: false,
                stroke: 'purple',
            })
            const newVertexNotation = new fabric.Text(verticesChars[fbCanvas.contourFinalized.length-1], {
                left: clicked.x,
                top: clicked.y,
                fontSize: 24,
                fontFamily: 'Roboto',
                fill: 'purple',
                shadow: '0 0 10px rgba(255, 255, 255, 0.7)',
                stroke: 'rgb(0, 0, 0)',
                strokeWidth: 0.9,
            })
            fbCanvas.contourNotationTemporary.push(newVertexNotation)
            fbCanvas.contourTemporary.push(newLine)
            fbCanvas.add(newLine)
            fbCanvas.add(newVertexNotation)
            fbCanvas.on('mouse:up', function (options: any) {
                fbCanvas.selection = true;
            })
            if (fbCanvas.contourFinalized.length <= 3) {
                // Return till there are four points in contour atleast
                return
            }
            fbCanvas.contourTemporary.forEach((value) => {
                fbCanvas.remove(value)
            })
            fbCanvas.contourNotationTemporary.forEach((value) => {
                fbCanvas.remove(value)
            })
            const contour = makeContour(fbCanvas.contourFinalized)
            contour.inner.on('mousedown', (options: any) => {
                options.e.preventDefault();
                options.e.stopPropagation();
                // Handle right-click
                // Turn on "Edit" mode
                if (options.button === 3) {
                    if ($state !== States.EditingZone) {
                        $state = States.EditingZone;
                    } else {
                        $state = States.Waiting;
                        let existingContour = $dataStorage.get(contour.unid);
                        if (!existingContour) {
                            return
                        }
                        //@ts-ignore
                        existingContour.properties.coordinates = contour.inner.current_points.map((element: { x: number; y: number; }) => {
                            return [
                                Math.floor(element.x/fbCanvas.scaleWidth),
                                Math.floor(element.y/fbCanvas.scaleHeight)
                            ]
                        })
                        updateDataStorage(contour.unid, existingContour)
                    }
                    fbCanvas.editContour(contour.inner);
                }
            });
            contour.inner.on('modified', (options: any) => {
                // Recalculate points
                const matrix = contour.inner.calcTransformMatrix();
                const transformedPoints = contour.inner.points?.map(function (p) {
                        return new fabric.Point(
                            p.x - contour.inner.pathOffset.x,
                            p.y - contour.inner.pathOffset.y
                        );
                    }).map(function (p: any) {
                        return fabric.util.transformPoint(p, matrix);
                    });
                //@ts-ignore
                contour.inner.current_points = transformedPoints;

                // Update notation
                contour.notation.forEach((vertextNotation: fabric.Text, idx: number) => {
                    //@ts-ignore
                    const vertex = contour.inner.current_points[idx];
                    vertextNotation.set({ left: vertex.x, top: vertex.y });
                })

                let existingContour = $dataStorage.get(contour.unid);
                if (!existingContour) {
                    return
                }
                //@ts-ignore
                existingContour.properties.coordinates = contour.inner.current_points.map((element: { x: number; y: number; }) => {
                    return [
                        Math.floor(element.x/fbCanvas.scaleWidth),
                        Math.floor(element.y/fbCanvas.scaleHeight)
                    ]
                })
                updateDataStorage(contour.unid, existingContour)
            })
            //@ts-ignore
            contour.unid = new UUIDv4().generate()
            //@ts-ignore
            contour.inner.unid = contour.unid
            contour.notation.forEach((_, idx) => {
                //@ts-ignore
                contour.notation[idx].text_id = contour.unid
            })
            const newContour = {
                type: 'Feature',
                id: contour.unid,
                properties: {
                    color_rgb: rgba2array(contour.inner.stroke),
                    color_rgb_str: contour.inner.stroke ? contour.inner.stroke : "rgb(0, 0, 0)",
                    //@ts-ignore
                    coordinates: contour.inner.current_points.map((element: { x: number; y: number; }) => {
                        return [
                            Math.floor(element.x/fbCanvas.scaleWidth),
                            Math.floor(element.y/fbCanvas.scaleHeight)
                        ]
                    }),
                    road_lane_direction: -1,
                    road_lane_num: -1,
                    spatial_object_id: undefined
                },
                geometry: {
                    type: 'Polygon',
                    coordinates: [[[-1, -1], [-1, -1], [-1, -1], [-1, -1], [-1, -1]]]
                }
            }
            updateDataStorage(contour.unid, newContour)
            fbCanvas.add(contour.inner)
            contour.notation.forEach((vertextNotation: fabric.Text) => {
                fbCanvas.add(vertextNotation)
            })
            fbCanvas.renderAll()
            fbCanvas.contourTemporary = []
            fbCanvas.contourNotationTemporary = []
            fbCanvas.contourFinalized = []
            state.set(States.Waiting)
            $draw.changeMode('simple_select')
        })
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
    
    const deleteZoneFromCanvas = (extendedCanvas: any, zoneID: string) => {
        // Пересмотреть поведение
        extendedCanvas.getObjects().forEach( (contour: { unid: string; }) => {
            if (contour.unid === zoneID) {
                extendedCanvas.remove(contour)
                return
            }
        })
        extendedCanvas.getObjects().forEach( (textObject: { text_id: string; }) => {
            if (textObject.text_id === zoneID) {
                extendedCanvas.remove(textObject)
                return
            }
        })
        deattachCanvasFromSpatial($dataStorage, $draw, zoneID)
        deleteFromDataStorage(zoneID)
    }

    const stateAddToCanvas = () => {
        if ($state !== States.AddingZoneCanvas) {
            state.set(States.AddingZoneCanvas)
            $draw.changeMode('draw_restricted_polygon');
        } else {
            state.set(States.Waiting)
            $draw.changeMode('simple_select');
        }
    }

    const stateAddToMap = () => {
        if ($state !== States.AddingZoneMap) {
            state.set(States.AddingZoneMap)
            $draw.changeMode('draw_restricted_polygon');
        } else {
            state.set(States.Waiting)
            $draw.changeMode('simple_select');
        }
    }

    const stateDelFromCanvas = () => {
        if ($state !== States.DeletingZoneCanvas) {
            state.set(States.DeletingZoneCanvas)
        } else {
            state.set(States.Waiting)
        }
    }

    const stateDelFromMap = () => {
        if ($state !== States.DeletingZoneMap) {
            state.set(States.DeletingZoneMap)
            $draw.changeMode('delete_zone');
        } else {
            state.set(States.Waiting)
            $draw.changeMode('simple_select');
        }
    }
</script>

<sveltekit:head>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/materialize/1.0.0/css/materialize.min.css">
    <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
    <!-- <script src="https://cdnjs.cloudflare.com/ajax/libs/materialize/1.0.0/js/materialize.min.js"></script> -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/materialize/1.0.0/js/materialize.min.js" on:load={initializeMaterialize}></script>
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
            <ConfigurationStorage dataReady={dataReady} data={dataStorageFiltered} klass={canvasFocused || mapFocused ? 'blurred noselect' : ''}/>
            <div class="overlay" style="{!canvasFocused && mapFocused ? 'display: block;' : 'display: none;'}">
                Press ESC to cancel '{cancelActionText !== undefined? cancelActionText : cancelActionUnexpected}' mode
            </div>
        </div>
        <div id="right_workspace">
            <MapComponent bind:this={mapComponent} klass={canvasFocused && !mapFocused ? 'blurred noselect' : ''}/>
            <div class="overlay" style="{canvasFocused && !mapFocused ? 'display: block;' : 'display: none;'}">
                Press ESC to cancel '{cancelActionText !== undefined? cancelActionText : cancelActionUnexpected}' mode
            </div>
        </div>
    </div>
</div>

<style global>
    @import url("https://fonts.googleapis.com/css?family=Roboto");
    :global(body) {
		margin: 0;
        padding: 0;
        font-family: 'Roboto', sans-serif;
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
        /* font-family: arial, sans-serif; */
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