//@ts-nocheck
import { Point, util, Shadow } from 'fabric';

export function getRandomRGB() {
    // https://stackoverflow.com/a/23095731/6026885
    const num = Math.round(0xffffff * Math.random());
    const r = num >> 16;
    const g = num >> 8 & 255;
    const b = num & 255;
    return 'rgb(' + r + ', ' + g + ', ' + b + ')';
}

export const rgba2array = (rgbValue?: string): [number, number, number] => {
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

export const getClickPoint = (fbCanvas: Canvas, options: any) => {
    // const left = fbCanvas.getElement().offsetLeft;
    // const top = fbCanvas.getElement().offsetTop;
    const left = fbCanvas._offset.left;
    const top = fbCanvas._offset.top;
    const drawX = options.e.pageX - left;
    const drawY = options.e.pageY - top;
    return {x: drawX, y: drawY};
}

export const findLeftTopY = (coordinates: any) => {
    return Math.abs(Math.min.apply(Math, coordinates.map(function(a) { 
        return a.y;
    })));
}

export const findLefTopX = (coordinates: any) => {
    return Math.abs(Math.min.apply(Math, coordinates.map(function(a) { 
        return a.x;
    })));
}

// FabricJS v5
// export const getObjectSizeWithStroke = (object: any) => {
//     let stroke = new Point(
//         object.strokeUniform ? 1 / object.scaleX : 1, 
//         object.strokeUniform ? 1 / object.scaleY : 1
//     ).multiply(object.strokeWidth);
//     return new Point(object.width + stroke.x, object.height + stroke.y);
// }

export const getObjectSizeWithStroke = (object: any) => {
    // For polygons, we need to calculate the actual bounding box
    let width = object.width;
    let height = object.height;
    // If width/height are not set, calculate from bounding rect
    if (!width || !height || isNaN(width) || isNaN(height)) {
        const boundingRect = object.getBoundingRect();
        width = boundingRect.width;
        height = boundingRect.height;
    }
    const strokeWidth = object.strokeWidth || 0;
    const result = new Point(width + strokeWidth, height + strokeWidth);
    return result;
};

export class UUIDv4 {
    // https://dirask.com/posts/JavaScript-UUID-function-in-Vanilla-JS-1X9kgD
    generateNumber (limit: number) {
        const value = limit * Math.random();
        return value | 0;
    };
    generateX () {
        const value = this.generateNumber(16);
        return value.toString(16);
    };
    generateXes (count: number) {
        let result = '';
        for(let i = 0; i < count; ++i) {
            result += this.generateX();
        }
        return result;
    };
    generateVariant () {
        const value = this.generateNumber(16);
        const variant = (value & 0x3) | 0x8;
        return variant.toString(16);
    };
    // UUID v4
    //
    //   varsion: M=4 
    //   variant: N
    //   pattern: xxxxxxxx-xxxx-Mxxx-Nxxx-xxxxxxxxxxxx
    //
    generate () {
        const result = this.generateXes(8)
            + '-' + this.generateXes(4)
            + '-' + '4' + this.generateXes(3)
            + '-' + this.generateVariant() + this.generateXes(3)
            + '-' + this.generateXes(12)
        return result;
    };
}

// Interpolate a point by specified distance from B point for segment AB
export const interpolatePoint = (p1: Point, p2: Point, dist: number) => {
    const x1 = p1.x
    const y1 = p1.y
    const x2 = p2.x
    const y2 = p2.y
    const ratio = dist / Math.hypot(x2-x1, y2-y1)
    const x = x2 + (x2 - x1) * ratio
    const y = y2 + (y2 - y1) * ratio
    return new Point(x, y)
}

export const makeValidPoint = (p: Point, minx: number, miny: number, maxx: number, maxy: number) => {
    if (p.x < minx) {
        p.x = minx
    }
    if (p.y < miny) {
        p.y = miny
    }
    if (p.x > maxx) {
        p.x = maxx
    }
    if (p.y > maxy) {
        p.y = maxy
    }
}

const eps = 10e-6
export const perpendicularToVectorByMidpoint = (A: Point, B: Point, dist: number): [Point, Point] => {
    const p1 = new Point((A.x + B.x) / 2.0, (A.y + B.y) / 2.0) // Just a midpoint
    if (Math.abs(B.x - A.x) < eps) {
        // Vertical
        return [p1, new Point(p1.x + (B.y > A.y? dist : -dist), p1.y)]
    }
    if (Math.abs(B.y - A.y) < eps) {
        // Horizontal
        return [p1, new Point(p1.x, p1.y + (B.x > A.x? dist : -dist))]
    }
    const slopeAB = (B.y - A.y) / (B.x - A.x)
    const slopePerpendicular = -1 / slopeAB
    const deltaX = Math.sqrt((dist*dist) / (1 + slopePerpendicular * slopePerpendicular))
    const deltaY = slopePerpendicular * deltaX
    // If B is on the right side of A, P2 will be to the right, otherwise to the left
    // @todo: refactor, because of vertical-ish lines
    const direction = (B.x > A.x) ? 1 : -1
    const p2 = new Point(p1.x + direction * deltaX, p1.y + direction * deltaY)
    return [p1, p2]
}

export const scalePoint = (p: Point, scaleWidth: number, scaleHeight: number): Point => {
    return new Point(Math.floor(p.x/scaleWidth), Math.floor(p.y/scaleHeight))
}