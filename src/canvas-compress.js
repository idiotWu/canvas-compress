const URL = window.URL || window.webkitURL;

const SCALE_FACTOR = Math.log(2);
const MAX_SCALE_STEPS = 4;

const DEFAULT_QUALITY = 0.9;
const DEFAULT_TYPE = 'image/jpeg';
const DEFAULT_SIZE = {
    width: 1000,
    height: 618
};

const GLOBAL_ENV = {
    _Promise: window.Promise,

    get Promise() {
        if (typeof this._Promise !== 'function') {
            throw new Error('canvas-compress requires Promise');
        }

        return this._Promise;
    },

    set Promise(Constructor) {
        if (typeof Constructor !== 'function') {
            throw new TypeError('Promise should be a function');
        }

        this._Promise = Constructor;
    }
};

function getTransform(image, orientation) {
    const { width, height } = image;

    switch (orientation) {
        case 1:
            // default
            return {
                width, height,
                matrix: [1, 0,
                         0, 1,
                         0, 0]
            };

        case 2:
            // horizontal flip
            return {
                width, height,
                matrix: [-1, 0,
                         0, 1,
                         width, 0]
            };

        case 3:
            // 180° rotated
            return {
                width, height,
                matrix: [-1, 0,
                         0, -1,
                         width, height]
            };

        case 4:
            // vertical flip
            return {
                width, height,
                matrix: [1, 0,
                         0, -1,
                         0, height]
            };

        case 5:
            // vertical flip + -90° rotated
            return {
                width: height,
                height: width,
                matrix: [0, 1,
                         1, 0,
                         0, 0]
            };

        case 6:
            // -90° rotated
            return {
                width: height,
                height: width,
                matrix: [0, 1,
                         -1, 0,
                         height, 0]
             };

        case 7:
            // horizontal flip + -90° rotate
            return {
                width: height,
                height: width,
                matrix: [0, -1,
                         -1, 0,
                         height, width]
            };

        case 8:
            // 90° rotated
            return {
                width: height,
                height: width,
                matrix: [0, -1,
                         1, 0,
                         0, width]
             };
    }
}

class Defer {
    constructor() {
        this.promise = new GLOBAL_ENV.Promise((resolve, reject) => {
            this.resolve = resolve;
            this.reject = reject;
        });
    }
}

/* export */ class CanvasCompress {
    static usePromise(Constructor) {
        GLOBAL_ENV.Promise = Constructor;
    }

    constructor({
        type = DEFAULT_TYPE,
        width = DEFAULT_SIZE.width,
        height = DEFAULT_SIZE.height,
        quality = DEFAULT_QUALITY
    } = {}) {

        quality = parseFloat(quality);

        const size = {
            width: parseFloat(width),
            height: parseFloat(height)
        };

        Object.defineProperties(this, {
            outputType: {
                get() {
                    return type;
                }
            },
            outputSize: {
                get() {
                    return size;
                }
            },
            outputQuality: {
                get() {
                    return quality;
                }
            }
        });
    }

    // resolved with image element
    _getOriginalImage(file) {
        const urlBlob = URL.createObjectURL(file);
        const image = new Image();
        const deferred = new Defer();

        image.onload = () => {
            deferred.resolve(image);
        };

        image.onerror = () => {
            deferred.reject('image load error');
        };

        image.src = urlBlob;

        return deferred.promise;
    }

    // resolved with source canvas
    _drawOriginalImage(image) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        const deferred = new Defer();

        EXIF.getData(image, () => {
            const orientation = EXIF.getTag(image, 'Orientation') || 1;

            const { width, height, matrix } = getTransform(image, orientation);

            canvas.width = width;
            canvas.height = height;
            context.save();
            context.transform(...matrix);
            context.drawImage(image, 0, 0);
            context.restore();

            URL.revokeObjectURL(image.src);
            deferred.resolve(canvas);
        });

        return deferred.promise;
    }

    // resolved with { source, scale }
    _resizeImage(source) {
        const { outputSize } = this;
        const { width, height } = source;

        const scale = Math.min(1, outputSize.width / width, outputSize.height / height);

        return GLOBAL_ENV.Promise.resolve({ source, scale });
    }

    // resolved with result canvas
    _drawImage({ source, scale }) {
        const sctx = source.getContext('2d');
        let steps = Math.min(MAX_SCALE_STEPS, Math.ceil((1 / scale) / SCALE_FACTOR));

        scale = Math.pow(scale, 1 / steps);

        let { width, height } = source;

        while(steps--) {
            let dw = width * scale | 0;
            let dh = height * scale | 0;

            sctx.drawImage(source, 0, 0, width, height, 0, 0, dw, dh);

            width = dw;
            height = dh;
        }

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = width;
        canvas.height = height;
        context.drawImage(source, 0, 0, width, height, 0, 0, width, height);

        return GLOBAL_ENV.Promise.resolve(canvas);
    }

    // resolved with compressed image blob
    _compress(canvas) {
        const { outputType, outputQuality } = this;

        const { width, height } = canvas;
        const dataURL = canvas.toDataURL(outputType, outputQuality);
        const buffer = atob(dataURL.split(',')[1]).split('').map((char) => char.charCodeAt(0));
        const blob = new Blob([new Uint8Array(buffer)], { type: outputType });

        return GLOBAL_ENV.Promise.resolve({ blob, width, height });
    }

    process(/* file blob */ file) {
        if (!file) {
            return GLOBAL_ENV.Promise.reject(new ReferenceError('file blob is required'));
        }

        if (!file.type.match(/^image/)) {
            return GLOBAL_ENV.Promise.reject(new TypeError(`unsupport file type: ${file.type}`));
        }

        const srcDimensions = {};

        return this._getOriginalImage(file)
            .then((image) => {
                srcDimensions.width = image.width;
                srcDimensions.height = image.height;

                return image;
            })
            .then(::this._drawOriginalImage)
            .then(::this._resizeImage)
            .then(::this._drawImage)
            .then(::this._compress)
            .then((result) => {
                return {
                    source: {
                        blob: file,
                        ...srcDimensions
                    },
                    result: { ...result }
                };
            });
    }
}
