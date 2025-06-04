<script lang="ts">
    import { onMount, onDestroy } from 'svelte'
    import ThreeDotLoader from './ThreeDotLoader.svelte'
    import { Line, Shadow, FabricText, FabricObject } from 'fabric'
    import { canvasReady, canvasState, apiUrlStore, changeAPI, state } from '../store/state.js'
	import { ExtendedCanvas, prepareContour, verticesChars, type FabricCanvasWrap, CustomPolygon } from '$lib/custom_canvas.js';
	import { States } from '$lib/states.js';
	import { getClickPoint, rgba2array } from '$lib/utils.js';
	import { dataStorage, deattachCanvasFromSpatial, deleteFromDataStorage, updateDataStorage } from '../store/data_storage.js';
	import { draw } from '../store/map.js';
	import { writable } from 'svelte/store';
	import { lineControl } from '$lib/custom_control_zone.js';
	import { changeDirectionControl, deleteVirtualLineControl } from '$lib/custom_control_line.js';
	import { CUSTOM_CONTROL_TYPES } from '$lib/custom_control.js';

    export let klass: string = ''

    const { apiURL } = apiUrlStore
    let initialAPIURL = `${$apiURL}`
    
    let stateVariable: States;
    state.subscribe((value) => stateVariable = value)
    
    let imgSrcLoaded = writable(false)

    const imageLoaded = () => {
        console.log('Image source reloaded')
        if ($canvasState === null || $canvasState === undefined) {
            console.log('Prepare canvas on first initialization')
            const fbCanvas = initializeCanvas()
            canvasState.set(fbCanvas)
        }
        imgSrcLoaded.set(true)
        canvasReady.set(true)
    }

    const unsubApiChange = changeAPI.subscribe(value => {
        if (initialAPIURL !== value) {
            console.log(`Need to change API URL for MJPEG: '${$apiURL}'`)
            initialAPIURL = value
            imgSrcLoaded.set(false)
        }
    })

    onMount(() => {
        console.log('Mounted canvas component')
        document.getElementById('fit_canvas')?.addEventListener('contextmenu', function(e) {
            e.preventDefault();
            return false;
        }, false);
    });

    onDestroy(() => {
        canvasReady.set(false)
        $canvasState?.getObjects().forEach(obj => {
            $canvasState.remove(obj);
        })
        unsubApiChange()
        canvasState.set(undefined)
    });

    const deleteZoneFromCanvas = (extendedCanvas: FabricCanvasWrap, zoneID: string) => {
        extendedCanvas.getObjects().forEach((object) => {
            if (object instanceof CustomPolygon && object.unid === zoneID) {
                // FIX: The signature '(eventName: "mouseout"): void' of 'object.off' is deprecated.
                object.off('mouseout');
                object.off('mouseover');
                object.off('mousedown');
                object.off('modified');
                object.off('virtial_line:created');
                object.off('virtial_line:modified');
                object.off('virtial_line:removed');
                if (object.virtual_line) {
                    extendedCanvas.remove(object.virtual_line)                    
                }
                object.notation.forEach((textObject) => {
                    extendedCanvas.remove(textObject)    
                })
                extendedCanvas.remove(object)
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
        if (!FabricObject.prototype.controls) {
            FabricObject.prototype.controls = {};
        }
        FabricObject.prototype.controls[CUSTOM_CONTROL_TYPES.LINE_CONTROL] = lineControl;
        FabricObject.prototype.controls[CUSTOM_CONTROL_TYPES.CHANGE_DIRECTION_CONTROL] = changeDirectionControl;
        FabricObject.prototype.controls[CUSTOM_CONTROL_TYPES.DELETE_VIRTUAL_LINE_CONTROL] = deleteVirtualLineControl;

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
            const points = [clicked.x, clicked.y, clicked.x, clicked.y] as [number, number, number, number]
            const textShadow = new Shadow({
                color: 'rgba(255, 255, 255, 0.7)',
                blur: 10,
                offsetX: 0,
                offsetY: 0
            });
            const newLine = new Line(points, {
                strokeWidth: 3,
                selectable: false,
                stroke: 'purple',
            })
            const newVertexNotation = new FabricText(verticesChars[fbCanvas.contourFinalized.length-1], {
                left: clicked.x,
                top: clicked.y,
                fontSize: 24,
                fontFamily: 'Roboto',
                fill: 'purple',
                shadow: textShadow,
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

            const contour = prepareContour(fbCanvas.contourFinalized, state, dataStorage, updateDataStorage)
            const rgbArray = rgba2array(contour.inner.stroke?.toString() || undefined);
            const newContour = {
                type: 'Feature',
                id: contour.unid,
                properties: {
                    color_rgb: rgbArray,
                    color_rgb_str: `rgb(${rgbArray[0]},${rgbArray[1]},${rgbArray[2]})`,
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
            contour.notation.forEach((vertextNotation: FabricText) => {
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
    <canvas id="fit_canvas" ></canvas>
    <div id="loading-message" class={$imgSrcLoaded? 'd-none' : 'd-block'}>
        <div class={$imgSrcLoaded? 'd-none' : 'loading d-block'}>
            <ThreeDotLoader msgText="Please wait until image is loaded"/>
        </div>
    </div>
</div>


<style scoped>
    .d-block {
        display: block;
    }
    .d-none {
        display: none;
    }
    #mjpeg {
        position: relative;
        grid-area: A;
        background-color: rgba(128, 128, 128, 0.8);
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
    #loading-message {
        justify-content: center;
        align-items: center;
        position: absolute;
        top: 0;
        height: 100%;
        width: 100%;
        background-color: rgba(128, 128, 128, 0.8);
    }
    .loading {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background-color: rgba(128, 128, 128, 0.8);
        padding: 0.66665rem;
        border-radius: 5px;
        pointer-events: none;
        font-size: 2rem;
    }
    /* .loading:after {
        overflow: hidden;
        display: inline-block;
        vertical-align: bottom;
        -webkit-animation: ellipsis steps(6, end) 1000ms infinite;
        animation: ellipsis steps(6, end) 1000ms infinite;
        content: "\2026";
        width: 0px;
    } */
    /* @keyframes ellipsis {
        to {
            width: 40px;
        }
    }
    @-webkit-keyframes ellipsis {
        to {
            width: 40px;
        }
    } */
</style>