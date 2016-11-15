const URL = window.URL || window.webkitURL;

const SCALE_FACTOR = Math.log(2);
const MAX_SCALE_STEPS = 4;

const MIME_TYPES = {
    PNG: 'image/png',
    JPEG: 'image/jpeg',
    WEBP: 'image/webp',
};

const SUPPORT_MIME_TYPES = Object.keys(MIME_TYPES).map(type => MIME_TYPES[type]);

const DEFAULT_TYPE = MIME_TYPES.JPEG;
const DEFAULT_QUALITY = 0.9;
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

function adjustMIME(type) {
    if (!SUPPORT_MIME_TYPES.includes(type)) {
        console.warn(`[canvas-compress]: unsupport MIME type ${type}, will fallback to default ${DEFAULT_TYPE}`);

        return DEFAULT_TYPE;
    }

    return type;
}

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
    };

    static isSupportedType(type) {
        return SUPPORT_MIME_TYPES.includes(type);
    };

    static MIME = {
        ...MIME_TYPES,
        JPG: MIME_TYPES.JPEG,
    };

    constructor({
        type = DEFAULT_TYPE,
        width = DEFAULT_SIZE.width,
        height = DEFAULT_SIZE.height,
        quality = DEFAULT_QUALITY
    } = {}) {
        type = adjustMIME(type);

        quality = parseFloat(quality);

        const size = {
            width: parseFloat(width),
            height: parseFloat(height)
        };

        Object.defineProperties(this, {
            isJPEG: {
                value: type === MIME_TYPES.JPEG,
            },
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

    _clear(ctx, width, height) {
        // is canvas?
        if (ctx.nodeType === 1) {
            ctx = ctx.getContext('2d');
            width = ctx.width;
            height = ctx.height;
        }

        if (this.isJPEG) {
            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, width, height);
        } else {
            ctx.clearRect(0, 0, width, height);
        }
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
            this._clear(context, width, height);
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
        if (scale === 1) {
            return GLOBAL_ENV.Promise.resolve(source);
        }

        const sctx = source.getContext('2d');
        const steps = Math.min(MAX_SCALE_STEPS, Math.ceil((1 / scale) / SCALE_FACTOR));

        const factor = Math.pow(scale, 1 / steps);

        const mirror = document.createElement('canvas');
        const mctx = mirror.getContext('2d');

        let { width, height } = source;

        mirror.width = width;
        mirror.height = height;

        let i = 0;

        while (i < steps) {
            const dw = width * factor | 0;
            const dh = height * factor | 0;

            let src, context;

            if (i % 2 === 0) {
                src = source;
                context = mctx;
            } else {
                src = mirror;
                context = sctx;
            }

            this._clear(context, width, height);
            context.drawImage(src, 0, 0, width, height, 0, 0, dw, dh);

            i++;
            width = dw;
            height = dh;

            if (i === steps) {
                // get current working canvas
                const canvas = src === source ? mirror : source;

                // save data
                const data = context.getImageData(0, 0, width, height);

                // resize
                canvas.width = width;
                canvas.height = height;

                // restore image data
                context.putImageData(data, 0, 0);

                return GLOBAL_ENV.Promise.resolve(canvas);
            }
        }
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
