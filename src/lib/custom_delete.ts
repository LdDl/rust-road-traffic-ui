import { type GeoJSON } from "geojson";
import { type MapMouseEvent } from "@mapbox/mapbox-gl-draw"


export const DeleteClickedZone = {
  name: 'delete_zone',

  onSetup: function (): any {
    return {}
  },

  onClick: function (state: any, e: MapMouseEvent): void {
    if (e.featureTarget) {
      const feature = e.featureTarget
      const id = feature?.properties?.id
      if (!id) {
        return
      }
      // @ts-ignore
      this.deleteFeature(id)
      // @ts-ignore
      this.changeMode("simple_select")
    }
    return
  },

  toDisplayFeatures: function (state: any, geojson: GeoJSON, display: (geojson: GeoJSON) => void): void {
    display(geojson)
  },

  // onDrag: function (state: any): void { },
  // onMouseMove: function (state: any, e: MapMouseEvent): void {  },
  // onMouseDown: function (state: any, e: MapMouseEvent): void {  },
  // onMouseUp: function (state: any, e: MapMouseEvent): void {  },
  // onMouseOut: function (state: any, e: MapMouseEvent): void {  },
  // onKeyUp: function (state: any, e: KeyboardEvent): void { },
  // onKeyDown: function (state: any, e: KeyboardEvent): void { },
  // onTouchStart: function (state: any, e: MapTouchEvent): void { },
  // onTouchMove: function (state: any, e: MapTouchEvent): void { },
  // onTouchEnd: function (state: any, e: MapTouchEvent): void { },
  // onTap: function (state: any, e: MapTouchEvent): void { },
  // onStop: function (state: any): void { },
  // onTrash: function (state: any): void { },
  // onCombineFeature: function (state: any): void { },
  // onUncombineFeature: function (state: any): void { },
}