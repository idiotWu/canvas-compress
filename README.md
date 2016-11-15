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
import CanvasCompress from 'canvas-compress';

const compressor = new CanvasCompress({
    type: CanvasCompress.MIME.JPEG,
    width: 1000,
    height: 618,
    quality: 0.9,
});

compressor.process(fileBlob).then(({ source, result }) => {
    // const { blob, width, height } = source;
    const { blob, width, height } = result;
    ...
});
```

## Options

There're four optional properties for options object:

- `type: string`: output type, default is `CanvasCompress.MIME.JPEG`

- `width: number`: output width, default is `1000`

- `height: number`: ouput height, default is `618`

- `quality: number`: output quality, defalut is `0.9`

## Use third-party Promise

```javascript
CanvasCompress.usePromise(require('bluebird'));
```

## Supported output MIME types

canvas-compress uses [`canvas.toDataUrl()`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toDataURL) method to convert canvas to binary. So the supported MIME types is:

- `'image/png'`
- `'image/jpeg'`
- `'image/webp'`

You can get MIME type via `CanvasCompress.MIME`, or use `CanvasCompress.isSupportedType(MIMEtype: string)` to check if it's a valid MIME type.

## About alpha channel

Alpha channel is not available with MIME type `image/jpeg`, so when you are trying to turn an image into jpeg, you'll get a full white background(`rgb(255, 255, 255)`) instead of transparent black(`rgba(0, 0, 0, 0)`).

## License

MIT.
