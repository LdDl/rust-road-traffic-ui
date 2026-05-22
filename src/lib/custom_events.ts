import type { TEvent, FabricObject } from "fabric";
import type { CustomPolygon } from "./custom_canvas";
import type { DirectionType } from "./zones";

declare module "fabric" {
  interface ObjectEvents {
    'virtual_line:created': {
      target: CustomPolygon;
    };
    'virtual_line:modified': {
      target: CustomPolygon;
    };
    'virtual_line:removed': {
      target: CustomPolygon;
    };
  }
}