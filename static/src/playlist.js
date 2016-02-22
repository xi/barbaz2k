var muu = require('muu');
var xhr = require('promise-xhr');
var _ = require('./lodash');

var tree = require('./tree');


var Playlist = function(player, files) {
    var self = this;

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

    self.insertBefore = function(items, index, focus) {
        // FIXME calculate self.current if it is moved itself
        if (index <= self.current) {
            self.current += items.length;
        }

        tree.TreeStore.prototype.insertBefore.call(self, items, index, focus);
        self.dispatchEvent('change');
    };

    self.remove = function(indices) {
        var removed = tree.TreeStore.prototype.remove.call(self, indices);

        self.current -= _.filter(indices, function(i) {
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

    self.insertUriBefore = function(uris, index, focus) {
        self.insertBefore(self.uris2items(uris), index, focus);
    };

    self.appendUri = function(uris, focus) {
        self.append(self.uris2items(uris), focus);
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
        var selection = self.getSelection();
        return {
            origin: 'playlist',
            focus: _.indexOf(selection, index),
            selection: selection,
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
            self.moveBefore(data.selection, index, data.focus);
            self.update();
        } else if (data.origin === 'filelist') {
            self.insertUriBefore(data.uris, index, data.focus);
            self.update();
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

    var unregister = [];
    unregister.push(muu.$.on(player, 'ended', self.next));
    unregister.push(muu.$.on(player, 'play', updateStatus));
    unregister.push(muu.$.on(player, 'pause', updateStatus));

    self.destroy = function() {
        _.forEach(unregister, function(fn) {
            fn();
        });
    };
};
Playlist.prototype = new tree.TreeStore();

module.exports = Playlist;
