'use strict';
var gutil = require('gulp-util'),
    path = require('path'),
    fs = require('fs'),
    through = require('through2');

function isUrl(url) {
    return (/^[\w]+:\/\/./).test(url);
}

function unquote(str) {
    var firstChar = str[0];

    return (str.length > 1 && firstChar === str[str.length - 1] && (firstChar === '"' || firstChar === "'")) ?
        str.slice(1, -1) : str;
}

module.exports = function (destFile) {
    var destDir = path.dirname(destFile);
    var buffer = [];
    var firstFile = null;

    function loadCss(fileBase, filePath, contents) {
        if (!contents) {
            try {
                contents = fs.readFileSync(filePath, 'utf8');
            } catch(err) {
                gutil.log(gutil.colors.red("[gulp-concat-css] Cannot resolve import " + filePath));
                return;
            }
        }

        return contents
            .replace(/\burl\(\s*(.+?)\s*\)/gi, function (match, url) {
                url = unquote(url);

                if (isUrl(url)) {
                    return match;
                }

                var resourceAbsUrl = path.relative(fileBase, path.resolve(path.dirname(filePath), url));
                var newUrl = path.relative(destDir, resourceAbsUrl);

                return 'url("' + newUrl + '")';
            })
            .replace(/@import\s+(?:((['"]).+?\2)|url\(\s*(.+?)\s*\))\s*;/gi, function (match) {
                var url = unquote(arguments[1] || arguments[3]);

                if (isUrl(url)) {
                    return match;
                }

                return loadCss(fileBase, path.resolve(path.dirname(filePath), url)) || match;
            });
    }


    return through.obj(
        function (file, enc, cb) {
            if (file.isStream()) {
                this.emit('error', new gutil.PluginError('gulp-concat-css', 'Streaming not supported'));
                return cb();
            }

            if (!firstFile) {
                firstFile = file;
            }

            buffer.push(loadCss(file.base, file.path, String(file.contents)));
            cb();
        },
        function (cb) {
            this.push(new gutil.File({
                base: firstFile.base,
                cwd: firstFile.cwd,
                path: path.join(firstFile.base, destFile),
                contents: new Buffer(buffer.join(gutil.linefeed))
            }));
            cb();
        }
    );
};