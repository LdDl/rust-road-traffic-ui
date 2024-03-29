<script lang="ts">
    import { onMount, onDestroy } from 'svelte'
	import type { Unsubscriber } from 'svelte/store';
    import { fabric } from "fabric"
    import MapComponent from '../components/MapComponent.svelte'
    import CanvasComponent from '../components/CanvasComponent.svelte'
    import Switchers from '../components/Switchers.svelte'
    import { States, state, mjpegReady, dataReady, apiUrlStore, changeAPI } from '../store/state.js'
    import MapboxDraw, { type DrawCreateEvent, type DrawUpdateEvent } from "@mapbox/mapbox-gl-draw"
    import { dataStorage, addZoneFeature, updateDataStorage, deleteFromDataStorage, clearDataStorage, resetZoneSpatialInfo, deattachCanvasFromSpatial, type Zone, type ZonesCollection } from '../store/data_storage'
    import { map, draw } from '../store/map'
    import { CUSTOM_GL_DRAW_STYLES, EMPTY_POLYGON_RGB } from '../lib/gl_draw_styles.js'
    import { PolygonFourPointsOnly } from '../lib/custom_poly.js'
    import { DeleteClickedZone } from '../lib/custom_delete.js'
    import { getClickPoint, findLeftTopY, findLefTopX, getObjectSizeWithStroke, UUIDv4 } from '../lib/utils'
	import type { Polygon } from 'geojson';

    const { apiURL } = apiUrlStore
    let initialAPIURL = $apiURL

    interface ContourPoint {
        x: number,
        y: number
    }

    interface ContourWrap {
        inner: fabric.Polygon,
        unid: string,
        notation: fabric.Text[]
    }

	const title = 'Rust Road Traffic UI'
    let scaleWidth: number, scaleHeight: number
    let canvas: HTMLCanvasElement
    let image: HTMLImageElement
    let fbCanvas: fabric.Canvas
    let fbCanvasParent: Element
    let contourTemporary = new Array<fabric.Line>()
    let contourNotationTemporary = new Array<fabric.Text>()
    let contourFinalized = new Array<ContourPoint>()
    const verticesChars = ['A', 'B', 'C', 'D']
    let mapComponent: any
    let unsubscribeMJPEG: Unsubscriber
    let unsubscribeGeoData: Unsubscriber
    $: canvasFocused = ($state === States.AddingZoneCanvas || $state === States.DeletingZoneCanvas)
    $: mapFocused = ($state === States.AddingZoneMap || $state === States.DeletingZoneMap)
    $: dataStorageFiltered = [...$dataStorage].filter((element)=> {
        return (element[1].id && element[1].properties.spatial_object_id)
    })

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
                    drawCanvasPolygons()
                }
            })
            unsubscribeGeoData = dataReady.subscribe(value => {
                if (value === true && $mjpegReady == true) {
                    // console.log(`Geo data is loaded before MJPEG`)
                    drawCanvasPolygons()
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
                drawCanvasPolygons()
            }
        })

        unsubscribeGeoData = dataReady.subscribe(value => {
            if (value === true && $mjpegReady == true) {
                console.log(`Geo data is loaded before MJPEG`)
                drawCanvasPolygons()
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
        draw.set(new MapboxDraw({
            userProperties: true,
            displayControlsDefault: false,
            controls: {
                polygon: false,
                trash: false
            },
            // @ts-ignore
            modes: Object.assign({
                // draw_delete_zone: DeleteZoneOnClick,
                draw_restricted_polygon: PolygonFourPointsOnly,
                delete_zone: DeleteClickedZone
            }, MapboxDraw.modes),
            styles: CUSTOM_GL_DRAW_STYLES
        }))
        
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
                data.features.forEach((feature) => {
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
            resetCurrentCanvasDrawing()
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
        scaleWidth = image.clientWidth/image.naturalWidth
        scaleHeight = image.clientHeight/image.naturalHeight
        fbCanvas = new fabric.Canvas('fit_canvas', {
            containerClass: 'custom-container-canvas',
            fireRightClick: true,  
            fireMiddleClick: true, 
            stopContextMenu: true
        })
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
            if (contourTemporary[0] !== null && contourTemporary[0] !== undefined && $state === States.AddingZoneCanvas) {
                const clicked = getClickPoint(fbCanvas, options)
                contourTemporary[contourTemporary.length - 1].set({ x2: clicked.x, y2: clicked.y })
                fbCanvas.renderAll()
            }
        })
        fbCanvas.on('mouse:down', (options: any) => {
            if ($state !== States.AddingZoneCanvas) {
                return
            }
            fbCanvas.selection = false
            const clicked = getClickPoint(fbCanvas, options)
            contourFinalized.push({ x: clicked.x, y: clicked.y })
            const points = [clicked.x, clicked.y, clicked.x, clicked.y]
            const newLine = new fabric.Line(points, {
                strokeWidth: 3,
                selectable: false,
                stroke: 'purple',
            })
            const newVertexNotation = new fabric.Text(verticesChars[contourFinalized.length-1], {
                left: clicked.x,
                top: clicked.y,
                fontSize: 24,
                fontFamily: 'Roboto',
                fill: 'purple',
                shadow: '0 0 10px rgba(255, 255, 255, 0.7)',
                stroke: 'rgb(0, 0, 0)',
                strokeWidth: 0.9,
            })
            contourNotationTemporary.push(newVertexNotation)
            contourTemporary.push(newLine)
            fbCanvas.add(newLine)
            fbCanvas.add(newVertexNotation)
            fbCanvas.on('mouse:up', function (options: any) {
                fbCanvas.selection = true;
            })
            if (contourFinalized.length <= 3) {
                // Return till there are four points in contour atleast
                return
            }
            contourTemporary.forEach((value) => {
                fbCanvas.remove(value)
            })
            contourNotationTemporary.forEach((value) => {
                fbCanvas.remove(value)
            })
            const contour = makeContour(contourFinalized)
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
                                Math.floor(element.x/scaleWidth),
                                Math.floor(element.y/scaleHeight)
                            ]
                        })
                        updateDataStorage(contour.unid, existingContour)
                    }
                    editContour(contour.inner, fbCanvas);
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
                        Math.floor(element.x/scaleWidth),
                        Math.floor(element.y/scaleHeight)
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
                            Math.floor(element.x/scaleWidth),
                            Math.floor(element.y/scaleHeight)
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
            contourTemporary = []
            contourNotationTemporary = []
            contourFinalized = []
            state.set(States.Waiting)
            $draw.changeMode('simple_select')
        })
    }

    const resetCurrentCanvasDrawing = () => {
        contourTemporary.forEach((value) => {
                fbCanvas.remove(value)
        })
        contourNotationTemporary.forEach((value) => {
            fbCanvas.remove(value)
        })
        contourTemporary = []
        contourNotationTemporary = []
        contourFinalized = []
    }
    
    const drawCanvasPolygons = () => {
        $dataStorage.forEach(feature => {
            const contourFinalized = feature.properties.coordinates.map((element: any) => {
                return {
                    x: element[0]*scaleWidth,
                    y: element[1]*scaleHeight
                }
            });
            let contour = makeContour(contourFinalized, `rgb(${feature.properties.color_rgb[0]},${feature.properties.color_rgb[1]},${feature.properties.color_rgb[2]})`);
            contour.inner.on('mousedown', (options: any) => {
                options.e.preventDefault();
                options.e.stopPropagation();
                // state = States.PickPolygon;
                if (options.button === 3) {
                    if ($state != States.EditingZone) {
                        state.set(States.EditingZone);
                    } else {
                        state.set(States.Waiting);
                        //@ts-ignore
                        let existingContour = $dataStorage.get(contour.unid);
                        if (!existingContour) {
                            return
                        }
                        //@ts-ignore
                        existingContour.properties.coordinates = contour.inner.current_points.map((element: { x: number; y: number; }) => {
                            return [
                                Math.floor(element.x/scaleWidth),
                                Math.floor(element.y/scaleHeight)
                            ]
                        })
                        updateDataStorage(contour.unid, existingContour)
                    }
                    editContour(contour.inner, fbCanvas);
                }
            });
            contour.inner.on('modified', (options: any) => {
                // Recalculate points
                const matrix = contour.inner.calcTransformMatrix();
                //@ts-ignore
                const transformedPoints = contour.inner.points.map(function (p) {
                    return new fabric.Point(
                        p.x - contour.inner.pathOffset.x,
                        p.y - contour.inner.pathOffset.y
                    );
                }).map(function (p) {
                    return fabric.util.transformPoint(p, matrix);
                });
                //@ts-ignore
                contour.inner.current_points = transformedPoints;

                // Update notation
                contour.notation.forEach((vertextNotation: fabric.Text, idx: number) => {
                    //@ts-ignore
                    const vertex = contour.inner.current_points[idx]
                    vertextNotation.set({ left: vertex.x, top: vertex.y })
                })

                //@ts-ignore
                let existingContour = $dataStorage.get(contour.unid);
                if (!existingContour) {
                    return
                }
                //@ts-ignore
                existingContour.properties.coordinates = contour.inner.current_points.map((element: { x: number; y: number; }) => {
                    return [
                        Math.floor(element.x/scaleWidth),
                        Math.floor(element.y/scaleHeight)
                    ]
                })
                updateDataStorage(contour.unid, existingContour)
            })
            //@ts-ignore
            contour.unid = feature.id
            //@ts-ignore
            contour.inner.unid = feature.id
            contour.notation.forEach((_, idx) => {
                //@ts-ignore
                contour.notation[idx].text_id = feature.id
            })
            fbCanvas.add(contour.inner);
            contour.notation.forEach((vertextNotation: fabric.Text) => {
                fbCanvas.add(vertextNotation)
            })
            fbCanvas.renderAll()
        })
    }

    const makeContour = (coordinates: any, color = getRandomRGB()): ContourWrap => {
        let left = findLefTopX(coordinates)
        let top = findLeftTopY(coordinates)
        let contour = new fabric.Polygon(coordinates, {
            fill: 'rgba(0,0,0,0)',
            stroke: color,
            strokeWidth: 3,
            objectCaching: false
        })
        contour.set({
            left: left,
            top: top,
        })

        const denotedVertices = new Array<fabric.Text>()
        coordinates.forEach((point: ContourPoint, idx: number) => {
            const vertexTextObject = new fabric.Text(verticesChars[idx], {
                left: point.x,
                top: point.y,
                fontSize: 24,
                fontFamily: 'Roboto',
                fill: color,
                shadow: '0 0 10px rgba(255, 255, 255, 0.7)',
                stroke: 'rgb(0, 0, 0)',
                strokeWidth: 0.9,
            });
            denotedVertices.push(vertexTextObject)
        })

        // Before `current_points` is undefined
        //@ts-ignore
        contour.current_points = contour.points;
        return { inner: contour , unid: '00000000-0000-0000-0000-000000000000', notation: denotedVertices};
    }

    function editContour(contour: fabric.Polygon, fbCanvas: fabric.Canvas) {
        fbCanvas.setActiveObject(contour);
        //@ts-ignore
        contour.edit = !contour.edit;
        //@ts-ignore
        if (contour.edit) {
            let lastControl = (contour?.points?.length as number) - 1;
            contour.cornerStyle = 'circle';
            contour.cornerSize = 15;
            contour.cornerColor = 'rgba(0, 0, 255, 1.0)';
            contour.controls = contour?.points?.reduce(function(acc: any, point: any, index: any) {
                acc['p' + index] = new fabric.Control({
                    positionHandler: polygonPositionHandler,
                    actionHandler: anchorWrapper(index > 0 ? index - 1 : lastControl, actionHandler),
                    actionName: 'modifyPolygon',
                    //@ts-ignore
                    pointIndex: index
                });
                return acc;
            }, { });
        } else {
            contour.cornerColor = 'rgb(178, 204, 255)';
            contour.cornerStyle = 'rect';
            contour.controls = fabric.Object.prototype.controls;
        }
        //@ts-ignore
        contour.hasBorders = !contour.edit;
        fbCanvas.requestRenderAll();
    }

    const deleteZoneFromCanvas = (fbCanvas: any, zoneID: string) => {
        // Пересмотреть поведение
        fbCanvas.getObjects().forEach( (contour: { unid: string; }) => {
            if (contour.unid === zoneID) {
                fbCanvas.remove(contour)
                return
            }
        })
        fbCanvas.getObjects().forEach( (textObject: { text_id: string; }) => {
            if (textObject.text_id === zoneID) {
                fbCanvas.remove(textObject)
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

    const saveTOML = () => {
        const sendData = {
            // Should send only zones with both canvas and spatial object IDs
            data: dataStorageFiltered.map(e => {
                const element = e[1]
                return {
                    lane_number: element.properties.road_lane_num,  
                    lane_direction: element.properties.road_lane_direction,
                    color_rgb: element.properties.color_rgb,
                    pixel_points: element.properties.coordinates,
                    spatial_points: [...element.geometry.coordinates[0].slice(0, -1)]
                };
            })
        };
        console.log('Replacing data')
        const endpointReplace = `${initialAPIURL}/api/mutations/replace_all`
        fetch(`${endpointReplace}`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(sendData)})
            .then((response) => {
                return response.json()
            })
            .then((data) => {
                const endpointSave = `${initialAPIURL}/api/mutations/save_toml`
                console.log('Replacing configuration with polygons:', data)
                fetch(`${endpointSave}`, {method: 'GET'})
                    .then((response) => {
                        return response.json()
                    })
                    .then((data) => {
                        console.log("Configuration has been updated. Reply from server:", data)
                    })
                    .catch((error) => {
                        console.log('Error on updating configuration:', error)
                    })
            })
            .catch((error) => {
                console.log('Error on replacing data', error)
            })
    }

    function getRandomRGB() {
        // https://stackoverflow.com/a/23095731/6026885
        const num = Math.round(0xffffff * Math.random());
        const r = num >> 16;
        const g = num >> 8 & 255;
        const b = num & 255;
        return 'rgb(' + r + ', ' + g + ', ' + b + ')';
    }

    const rgba2array = (rgbValue?: string): [number, number, number] => {
        if (!rgbValue) {
            return [0, 0, 0];
        }
        // https://stackoverflow.com/a/34980657/6026885
        const match = rgbValue.match(/rgba?\((\d{1,3}), ?(\d{1,3}), ?(\d{1,3})\)?(?:, ?(\d(?:\.\d?))\))?/);
        if (!match) {
            return [0, 0, 0];
        }
        return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])]
    }

    // define a function that can locate the controls.
    // this function will be used both for drawing and for interaction.
    // this is not an anonymus function since we need parent scope (`this`)
    const polygonPositionHandler = function (this: { positionHandler: (dim: any, finalMatrix: any, fabricObject: any) => fabric.Point; actionHandler: (eventData: any, transform: any, x: any, y: any) => any; actionName: string; pointIndex: number; }, dim: any, finalMatrix: any, fabricObject: any) {
        let x = (fabricObject.points[this.pointIndex].x - fabricObject.pathOffset.x)
        let y = (fabricObject.points[this.pointIndex].y - fabricObject.pathOffset.y)
        const pt = new fabric.Point(x, y)
        return fabric.util.transformPoint(
            pt,
            fabric.util.multiplyTransformMatrices(
                fabricObject.canvas.viewportTransform,
                fabricObject.calcTransformMatrix()
            )
        )
    }

    // define a function that can keep the polygon in the same position when we change its
    // width/height/top/left.
    const anchorWrapper = function (anchorIndex: any, fn: any) {
        return function(eventData: any, transform: any, x: any, y: any) {
            let fabricObject = transform.target;
            const pt = new fabric.Point((fabricObject.points[anchorIndex].x - fabricObject.pathOffset.x), (fabricObject.points[anchorIndex].y - fabricObject.pathOffset.y))
            let absolutePoint = fabric.util.transformPoint(pt, fabricObject.calcTransformMatrix());
            let actionPerformed = fn(eventData, transform, x, y);
            let newDim = fabricObject._setPositionDimensions({});
            let polygonBaseSize = getObjectSizeWithStroke(fabricObject);
            let newX = (fabricObject.points[anchorIndex].x - fabricObject.pathOffset.x) / polygonBaseSize.x;
            let newY = (fabricObject.points[anchorIndex].y - fabricObject.pathOffset.y) / polygonBaseSize.y;
            fabricObject.setPositionByOrigin(absolutePoint, newX + 0.5, newY + 0.5);
            return actionPerformed;
        }
    }

    // define a function that will define what the control does
    // this function will be called on every mouse move after a control has been
    // clicked and is being dragged.
    // The function receive as argument the mouse event, the current trasnform object
    // and the current position in canvas coordinate
    // transform.target is a reference to the current object being transformed,
    const actionHandler = function (eventData: any, transform: any, x: any, y: any) {
        let polygon = transform.target;
        let currentControl = polygon.controls[polygon.__corner];
        let mouseLocalPosition = polygon.toLocalPoint(new fabric.Point(x, y), 'center', 'center')
        let polygonBaseSize = getObjectSizeWithStroke(polygon);
        let size = polygon._getTransformedDimensions(0, 0);
        let finalPointPosition = {
            x: mouseLocalPosition.x * polygonBaseSize.x / size.x + polygon.pathOffset.x,
            y: mouseLocalPosition.y * polygonBaseSize.y / size.y + polygon.pathOffset.y
        };
        polygon.points[currentControl.pointIndex] = finalPointPosition;
        return true;
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
                <a id="save-btn" class="btn-floating grey" on:click={saveTOML} title="Apply and save changes" aria-label="Apply and save changes" role="button" tabindex="0"><i class="material-icons">save</i></a>
            </li>
        </ul>
    </div>
    <div id="flex_component">
        <div id="grid_component">
            <CanvasComponent klass={!canvasFocused && mapFocused ? 'blurred noselect' : ''}/>
            <div id="configuration" class={canvasFocused || mapFocused ? 'blurred noselect' : ''}>
                <div id="configuration-content">
                    <ul id="collapsible-data" class="collapsible">
                        {#if $dataReady === true}
                            {#each dataStorageFiltered as [k, element]}
                                <li>
                                    <div class="collapsible-header">
                                        <i class="material-icons">place</i>Polygon identifier: {element.id}
                                    </div>
                                    <div class="collapsible-body">
                                        <table class="collapsible-table">
                                            <thead>
                                                <tr>
                                                    <th>Attirubute</th>
                                                    <th>Value</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr>
                                                    <td>Road lane direction</td>
                                                    <td>{element.properties.road_lane_direction}</td>
                                                </tr>
                                                <tr>
                                                    <td>Road lane number</td>
                                                    <td>{element.properties.road_lane_num}</td>
                                                </tr>
                                                <tr>
                                                    <td>Color</td>
                                                    <td><div style="background-color: {element.properties.color_rgb_str}; width: 32px; height: 16px; border: 1px solid #000000;"></div></td>
                                                </tr>
                                                <tr>
                                                    <td>Canvas coordinates</td>
                                                    <td>{JSON.stringify(element.properties.coordinates)}</td>
                                                </tr>
                                                <tr>
                                                    <td>Spatial coordinates</td>
                                                    <td>{JSON.stringify(element.geometry.coordinates)}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </li>
                            {/each}
                        {/if}
                    </ul>
                </div>
            </div>
        </div>
        <MapComponent bind:this={mapComponent} klass={canvasFocused && !mapFocused ? 'blurred noselect' : ''}/>
        <Switchers klass={canvasFocused || mapFocused ? 'blurred noselect' : ''}/>
    </div>
</div>

<style global>
    @import url("https://fonts.googleapis.com/css?family=Roboto");
    :global(body) {
		margin: 0;
        padding: 0;
        font-family: 'Roboto', sans-serif;
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

    #flex_component {
        display: flex;
        /* font-family: arial, sans-serif; */
        height: 100%
    }

    #grid_component {
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

    #configuration {
        grid-area: B;
        /* background: blue; */
        overflow-y: auto;
        max-height: 185px;
    }

    .collapsible-table {
        font-size: 14px;
    }

    /* Override collapsible */
    .collapsible-header, .collapsible-body, .collapsible, ul.collapsible>li {
        margin: 0 !important;
    }
    .custom-container-canvas {
        position: absolute !important; 
        left: 0;
        top: 0;
    }

    /* Custom scrollbar */
    #configuration::-webkit-scrollbar {
        background-color:#fff;
        width:16px
    }
    #configuration::-webkit-scrollbar-track {
        background-color:#fff
    }
    #configuration::-webkit-scrollbar-track:hover {
        background-color:#f4f4f4
    }
    #configuration::-webkit-scrollbar-thumb {
        background-color:#babac0;
        border-radius:16px;
        border:5px solid #fff
    }
    #configuration::-webkit-scrollbar-thumb:hover {
        background-color:#a0a0a5;
        border:4px solid #f4f4f4
    }
    #configuration::-webkit-scrollbar-button {
        display:none
    }

    /* Maplibre pointer overwrite for mapbox-gl-draw */
    .maplibregl-map.mouse-pointer .maplibregl-canvas-container.maplibregl-interactive {
        cursor: pointer;
    }
    .maplibregl-map.mouse-move .maplibregl-canvas-container.maplibregl-interactive {
        cursor: move;
    }

    /* #main-app > #flex_component > *:not(.map-wrap) {
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