<script lang="ts">
    import { onMount, onDestroy } from 'svelte'
    import { fabric } from "fabric"
    import { canvasReady, canvasState, apiUrlStore, changeAPI, state } from '../store/state.js'
	import { ExtendedCanvas, prepareContour, verticesChars, type FabricCanvasWrap } from '$lib/custom_canvas.js';
	import { States } from '$lib/states.js';
	import { getClickPoint, rgba2array } from '$lib/utils.js';
	import { dataStorage, deattachCanvasFromSpatial, deleteFromDataStorage, updateDataStorage } from '../store/data_storage.js';
	import { draw } from '../store/map.js';

    export let klass: string = ''

    const { apiURL } = apiUrlStore
    let initialAPIURL = `${$apiURL}`
    
    let stateVariable: States;
    state.subscribe((value) => stateVariable = value)
    
    const imageLoaded = () => {
        console.log('Image source reloaded')
        const fbCanvas = initializeCanvas()
        canvasState.set(fbCanvas)
        canvasReady.set(true)
    }

    const unsubApiChange = changeAPI.subscribe(value => {
        if (initialAPIURL !== value) {
            console.log(`Need to change API URL for MJPEG: '${$apiURL}'`)
            initialAPIURL = value
        }
    })

    onMount(() => {
    });

    onDestroy(() => {
        unsubApiChange()
    });

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
    
    const initializeCanvas = (): FabricCanvasWrap => {
        const canvasElem = document.getElementById('fit_canvas') as HTMLCanvasElement
        const imageElem = document.getElementById('fit_img') as HTMLImageElement
        canvasElem.width = imageElem.clientWidth
        canvasElem.height = imageElem.clientHeight
        const fbCanvas = new ExtendedCanvas('fit_canvas', {
            containerClass: 'custom-container-canvas',
            fireRightClick: true,  
            fireMiddleClick: true, 
            stopContextMenu: true
        })
        fbCanvas.scaleWidth = imageElem.clientWidth/imageElem.naturalWidth
        fbCanvas.scaleHeight = imageElem.clientHeight/imageElem.naturalHeight
        const fbCanvasParent = document.getElementsByClassName('custom-container-canvas')[0];
        fbCanvasParent.id = "fbcanvas";
        fbCanvas.on('selection:created', (options: any) => {
            if (stateVariable === States.DeletingZoneCanvas) {
                deleteZoneFromCanvas(fbCanvas, options.selected[0].unid);
                state.set(States.Waiting)
            }
        })
        fbCanvas.on('selection:updated', (options: any) => {
            if (stateVariable === States.DeletingZoneCanvas) {
                deleteZoneFromCanvas(fbCanvas, options.selected[0].unid);
                state.set(States.Waiting)
            }
        })
        fbCanvas.on('mouse:move', (options: any) => {
            if (fbCanvas.contourTemporary[0] !== null && fbCanvas.contourTemporary[0] !== undefined && stateVariable === States.AddingZoneCanvas) {
                const clicked = getClickPoint(fbCanvas, options)
                fbCanvas.contourTemporary[fbCanvas.contourTemporary.length - 1].set({ x2: clicked.x, y2: clicked.y })
                fbCanvas.renderAll()
            }
        });
        fbCanvas.on('mouse:down', (options: any) => {
            if (stateVariable !== States.AddingZoneCanvas) {
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

            const contour = prepareContour(fbCanvas.contourFinalized, state, $dataStorage, updateDataStorage)

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

        return fbCanvas
    }

</script>

<div id="mjpeg" class={"mjpeg-canvas" + ' ' + klass}>
    <!-- svelte-ignore a11y-missing-attribute -->
    <img id="fit_img" src="{initialAPIURL}/live_streaming" width="500" height="500" on:load={imageLoaded}>
    <!-- <img id="fit_img" src="https://pngimg.com/uploads/google/google_PNG19632.png" width="500" height="500" on:load={imageLoaded}> -->
    <canvas id="fit_canvas"></canvas>
</div>

<style global>
    #mjpeg {
        grid-area: A;
        background: green;
    }
    #fit_img {
        height: 100%;
        width: 100%;
    }
    #fit_canvas {
        height: 80%;
        width: 50%;
        background-color: transparent;
        position: absolute;
        left: 0;
        top: 0;
    }
</style>