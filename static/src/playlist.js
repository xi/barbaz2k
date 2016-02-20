var muu = require('muu');
var xhr = require('promise-xhr');
var _ = require('./lodash');

var tree = require('./tree');


var Playlist = function(player, files) {
    var self = this;

    self.items = [];
    self.element = document.createElement('div');
    self.current = 0;

    self.dispatchEvent = function(name, data) {
        var event = muu.$.createEvent(name, undefined, undefined, data);
        self.element.dispatchEvent(event);
    };

    self.on = function(name, fn) {
        return muu.$.on(self.element, name, fn);
    };

    self.getTotalTime = function() {
        return _.sum(_.map(self.items, 'duration_raw')) || 0;
    };

    self.clear = function() {
        self.current = 0;
        self.items = [];
        self.dispatchEvent('clear');
        self.dispatchEvent('change');
        player.src = null;
    };

    self.insertBefore = function(items, index) {
        // FIXME calculate self.current if it is moved itself
        if (index <= self.current) {
            self.current += items.length;
        }
        self.items.splice.apply(self.items, [index, 0].concat(items));
        self.dispatchEvent('change');
    };

    self.remove = function(indices) {
        var pop = function(arr, i) {
            return arr.splice(i, 1)[0];
        };

        var done = [];
        var removed = [];

        for (var i = 0; i < indices.length; i++) {
            var index = indices[i];
            index -= _.filter(done, function(i) {
                return i < index;
            }).length;
            removed.push(pop(self.items, index))
            done.push(indices[i]);
        }
        self.current -= _.filter(done, function(i) {
            return i < self.current;
        }).length;

        self.dispatchEvent('change');
        return removed;
    };

    self.expandUris = function(uris) {
        return _.flatten(_.map(uris, function(uri) {
            return _.filter(files, function(file) {
                return _.startsWith(file, uri);
            });
        }));
    };

    self.uris2items = function(uris) {
        return _.map(self.expandUris(uris), function(uri) {
            var item = {
                path: uri,
                title: _.last(uri.split('/')),
            };

            var _uri = '/info.json?path=' + encodeURIComponent(uri);
            xhr.getJSON(_uri).then(function(data) {
                _.assign(item, data);
                self.update();
            });

            return item;
        });
    };

    self.insertUriBefore = function(uris, index) {
        self.insertBefore(self.uris2items(uris), index);
    };

    self.appendUri = function(uris) {
        self.append(self.uris2items(uris));
    };

    self.play = function(i) {
        self.current = i;
        player.src = '/file' + self.items[i].path;
        player.play();
        self.dispatchEvent('change');
    };
    self.next = function() {
        self.play(self.current + 1);
    };
    self.prev = function() {
        self.play(self.current - 1);
    };

    self.drag = function(index) {
        return {
            origin: 'playlist',
            focus: index,
            selection: self.getSelection(),
        };
    };

    self.canDrop = function(data) {
        if (data.origin === 'playlist') {
            return true;
        } else if (data.origin === 'filelist') {
            return true;
        } else {
            return false;
        }
    };

    self.drop = function(data, index) {
        if (data.origin === 'playlist') {
            self.moveBefore(data.selection, index);
            self.update();
            // FIXME: index has changed in moveBefore
            self.setFocus(data.index);
        } else if (data.origin === 'filelist') {
            self.insertUriBefore(data.uris, index);
            self.update();
            // FIXME: set focus
        }
    };

    var updateStatus = function() {
        _.forEach(self.items, function(row, i) {
            if (i === self.current) {
                row.playing = !player.paused;
                row.paused = player.paused;
            } else {
                row.playing = false;
                row.paused = false;
            }
        });
        self.dispatchEvent('change');
    };

    // FIXME: memory leak
    muu.$.on(player, 'ended', self.next);
    muu.$.on(player, 'play', updateStatus);
    muu.$.on(player, 'pause', updateStatus);
};
Playlist.prototype = new tree.TreeStore();

module.exports = Playlist;
