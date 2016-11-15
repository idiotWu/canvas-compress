var URL = window.URL || window.webkitURL;

var lastFile = null;

var options = {
    quality: 0.9,
    width: 1000,
    height: 618
};

var resultImg = document.querySelector('#result'),
    sourceImg = document.querySelector('#source'),
    resultInfo = document.querySelector('#result-info'),
    sourceInfo = document.querySelector('#source-info');

var compress = function(file) {
    file = file || lastFile;

    if (!file) return;

    lastFile = file;

    URL.revokeObjectURL(sourceImg.src);
    URL.revokeObjectURL(resultImg.src);

    sourceImg.src = resultImg.src = '';
    sourceInfo.textContent = resultInfo.textContent = '';

    var compressor = new CanvasCompress(Object.assign({
        type: CanvasCompress.isSupportedType(file.type) ? file.type : CanvasCompress.MIME.JPEG,
    }, options));
    var startTime = Date.now();

    compressor.process(file).then(function(res) {
        var source = res.source,
            result = res.result;

        sourceImg.src = URL.createObjectURL(source.blob);
        resultImg.src = URL.createObjectURL(result.blob);

        sourceInfo.textContent = [
            'File size: ' + (source.blob.size / 1024 ).toFixed(2) + 'KB',
            'File type: ' + source.blob.type,
            'Dimensions: ' + source.width + ' * ' + source.height
        ].join('\n');

        resultInfo.textContent = [
            'File size: ' + (result.blob.size / 1024 ).toFixed(2) + 'KB',
            'File type: ' + result.blob.type,
            'Dimensions: ' + result.width + ' * ' + result.height,
            'Compress rate: ' + ((result.blob.size / source.blob.size) * 100).toFixed(2) + '%',
            'Compress duration: ' + (Date.now() - startTime)+ 'ms'
        ].join('\n');
    }).catch(alert);
}

Array.prototype.forEach.call(document.querySelectorAll('input[type="range"]'), function(input) {
    var value = input.nextElementSibling;
    var prop = input.name;

    input.value = options[prop];
    value.textContent = input.value;

    input.addEventListener('change', function() {
        options[prop] = value.textContent = input.value;
        compress();
    });
});

document.querySelector('#upload').addEventListener('change', function() {
    compress(this.files[0]);
});
