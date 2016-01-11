const URL = window.URL || window.webkitURL;

const SCALE_FACTOR = Math.log(2);
const MAX_SCALE_STEPS = 4;

const DEFAULT_QUALITY = 0.9;
const DEFAULT_TYPE = 'image/jpeg';
const DEFAULT_SIZE = {
    width: 1000,
    height: 618
};

const ORIENTATION_MAP = {
    1: {
        // default
        swap: false,
        matrix: [1, 0,
                 0, 1,
                 0, 0]
    },
    2: {
        // horizontal flip
        swap: false,
        matrix: [-1, 0,
                 0, 1,
                 'width', 0]
    },
    3: {
        // 180° rotated
        swap: false,
        matrix: [-1, 0,
                 0, -1,
                 'width', 'height']
    },
    4: {
        // vertical flip
        swap: false,
        matrix: [1, 0,
                 0, -1,
                 0, 'height']
    },
    5: {
        // vertical flip + -90° rotated
        swap: true,
        matrix: [0, 1,
                 1, 0,
                 0, 0]
    },
    6: {
        // -90° rotated
        swap: true,
        matrix: [0, 1,
                 -1, 0,
                 'height', 0]
    },
    7: {
        // horizontal flip + -90° rotate
        swap: true,
        matrix: [0, -1,
                 -1, 0,
                 'height', 'width']
    },
    8: {
        // 90° rotated
        swap: true,
        matrix: [0, -1,
                 1, 0,
                 0, 'width']
    }
};

class Defer {
    constructor() {
        this.promise = new Promise((resolve, reject) => {
            this.resolve = resolve;
            this.reject = reject;
        });
    }
}

/* export */ class CanvasCompress {
    constructor({ type = DEFAULT_TYPE, width = DEFAULT_SIZE.width, height = DEFAULT_SIZE.height, quality = DEFAULT_QUALITY } = {}) {

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

        let { width, height } = image;

        EXIF.getData(image, () => {
            const orientation = EXIF.getTag(image, 'Orientation') || 1;
            const { swap, matrix } = ORIENTATION_MAP[orientation];

            if (swap) {
                width = image.height;
                height = image.width;
            }

            if (typeof matrix[4] === 'string') {
                matrix[4] = image[matrix[4]];
            }

            if (typeof matrix[5] === 'string') {
                matrix[5] = image[matrix[5]];
            }

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

        return Promise.resolve({ source, scale });
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

        return Promise.resolve(canvas);
    }

    // resolved with compressed image blob
    _compress(canvas) {
        const { outputType, outputQuality } = this;

        const { width, height } = canvas;
        const dataURL = canvas.toDataURL(outputType, outputQuality);
        const buffer = atob(dataURL.split(',')[1]).split('').map((char) => char.charCodeAt(0));
        const blob = new Blob([new Uint8Array(buffer)], { type: outputType });

        return Promise.resolve({ blob, width, height });
    }

    process(/* file blob */ file) {
        if (!file) {
            return Promise.reject(new ReferenceError('file blob is required'));
        }

        if (!file.type.match(/^image/)) {
            return Promise.reject(new TypeError(`unsupport file type: ${file.type}`));
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
