var muu = require('muu');
var xhr = require('promise-xhr');
var _ = require('./lodash');

var tree = require('./tree');


var Playlist = function(player, files) {
    var self = this;

    self.element = document.createElement('div');
    self.current = -1;

    var updateStatus = function() {
        _.forEach(self.items, function(item, i) {
            if (i === self.current) {
                item.playing = !player.paused;
                item.paused = player.paused;
            } else {
                item.playing = false;
                item.paused = false;
            }
        });
        self.dispatchEvent('change');
    };

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
        self.stop();
        self.items = [];
        self.dispatchEvent('clear');
    };

    self.insertBefore = function(items, index, focus) {
        tree.TreeStore.prototype.insertBefore.call(self, items, index, focus);

        if (index <= self.current) {
            self.current += items.length;
        }

        self.dispatchEvent('change');
    };

    self.remove = function(indices) {
        var removed = tree.TreeStore.prototype.remove.call(self, indices);

        if (_.indexOf(indices, self.current) === -1) {
            self.current -= _.filter(indices, function(i) {
                return i < self.current;
            }).length;
        } else {
            self.current = -1;
        }

        _.forEach(removed, function(item) {
            item.playing = false;
            item.paused = false;
        });

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
        if (i < 0 || i >= self.items.length) {
            self.stop();
        } else {
            self.current = i;
            player.src = '/file' + self.items[i].path;
            player._loaded = true;
            player.play();
            self.dispatchEvent('change');
        }
    };
    self.next = function() {
        self.play(self.current + 1);
    };
    self.prev = function() {
        self.play(self.current - 1);
    };
    self.stop = function() {
        self.current = -1;
        player.pause();
        player.currentTime = 0;
        player._loaded = false;
        updateStatus();
        self.dispatchEvent('change');
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
