var gulp = require('gulp');
var babel = require('gulp-babel');
var eslint = require('gulp-eslint');
var uglify = require('gulp-uglify');
var wrapUMD = require('gulp-wrap-umd');
var browserSync = require('browser-sync').create();
var friendlyFormatter = require("eslint-friendly-formatter");

gulp.task('compile', function() {
    return gulp.src('src/canvas-compress.js')
        .pipe(babel({
            presets: ['es2015', 'stage-0']
        }))
        .pipe(wrapUMD({
            exports: 'CanvasCompress',
            namespace: 'CanvasCompress',
            deps: [{
                name: 'exif-js',
                globalName: 'EXIF',
                paramName: 'EXIF'
            }]
        }))
        .pipe(gulp.dest('build/'))
        .pipe(browserSync.stream());
});

gulp.task('lint', function() {
    return gulp.src('src/canvas-compress.js')
        .pipe(eslint())
        .pipe(eslint.format(friendlyFormatter));
});

gulp.task('serve', ['compile', 'lint'], function() {
    browserSync.init({
        server: {
            baseDir: 'test',
            routes: {
                '/build': 'build',
                '/bower_components': 'bower_components'
            }
        }
    });

    gulp.watch('src/canvas-compress.js', ['compile', 'lint']);
    gulp.watch('test/*.*').on('change', browserSync.reload);
});

gulp.task('dist', ['compile', 'lint'], function() {
    return gulp.src('build/*.js')
            .pipe(uglify())
            .pipe(gulp.dest('dist/'))
});

gulp.task('default', ['serve']);