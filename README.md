# CanvasCompress

Compressing image with HTML5 canvas.

## Browser Compatibility

| Browser | Version |
| :------ | :-----: |
| IE      | 10+     |
| Chrome  | 22+     |
| Firefox | 16+     |
| Safari  | 8+      |
| Android Browser | 4+ |
| Chrome for Android | 32+ |
| iOS Safarri | 7+ |

## Dependencies

1. [Exif.js](https://github.com/exif-js/exif-js)
2. ES6 Promise polyfill.

## Install

Via npm:

```
npm install canvas-compress --save
```

Via bower:

```
bower install canvas-compress --save
```

## Usage

```javascript
    import { CanvasCompress } from 'canvas-compress';

    let compressor = new CanvasCompress(options);

    compressor.process(fileBlob).then(({ source, result }) => {
        const { blob, width, height } = source;
        const { blob, width, height } = result;
        ...
    });
```

## Options

There're four optional properties for options object:

- `type<string>`: output type, default is `image/jpeg`

- `width<number>`: output width, default is `1000`

- `height<number>`: ouput height, default is `618`

- `quality<number>`: output quality, defalut is `0.9`


## License

MIT.