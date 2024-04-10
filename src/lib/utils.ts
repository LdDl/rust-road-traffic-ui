//@ts-nocheck
import type { fabric } from 'fabric'

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

export const getClickPoint = (fbCanvas: fabric.Canvas, options: any) => {
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

export const getObjectSizeWithStroke = (object: any) => {
    let stroke = new fabric.Point(
        object.strokeUniform ? 1 / object.scaleX : 1, 
        object.strokeUniform ? 1 / object.scaleY : 1
    ).multiply(object.strokeWidth);
    return new fabric.Point(object.width + stroke.x, object.height + stroke.y);
}

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