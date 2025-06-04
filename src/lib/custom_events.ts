import type { TEvent, FabricObject } from "fabric";
import type { CustomPolygon } from "./custom_canvas";
import type { DirectionType } from "./zones";

declare module "fabric" {
  interface ObjectEvents {
    'virtial_line:created': {
      target: CustomPolygon;
    };
    'virtial_line:modified': {
      target: CustomPolygon;
    };
    'virtial_line:removed': {
      target: CustomPolygon;
    };
  }
}