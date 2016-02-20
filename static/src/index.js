var muu = require('muu');
var xhr = require('promise-xhr');
var Mustache = require('mustache');
var virtualDom = require('virtual-dom');
var h = require('virtual-dom/h');
var _ = require('./lodash');

var tree = require('./tree');
var Playlist = require('./playlist');
var FileStore = require('./filestore');

var template = require('./templates/barbaz');
var buttonsTpl = require('./templates/buttons');
var playlistTpl = require('./templates/playlist');


var formatTime = function(duration) {
    var s = '';
    s += Math.floor(duration / 60) || 0;
    s += ':';
    s += ('00' + Math.floor(duration) % 60).slice(-2);
    return s;
};

var int2hex = function(i) {
    return ('00' + i.toString(16)).substr(-2);
};

var sniffColor = function(className, key) {
    var el = document.createElement('div');
    el.className = className;
    document.body.appendChild(el);

    var style = window.getComputedStyle(el, null);
    var rgb = style.getPropertyValue(key).match(/\d+/g);
    var r = int2hex(parseInt(rgb[0]));
    var g = int2hex(parseInt(rgb[1]));
    var b = int2hex(parseInt(rgb[2]));

    document.body.removeChild(el);
    return '#' + r + g + b;
};

xhr.getJSON('/files.json').then(function(files) {

    var registry = new muu.Registry({
        renderer: function(template, data) {
            if (typeof template == 'string') {
                return Mustache.render(template, data);
            } else {
                return template(data);
            }
        }
    });

    _updateDOM = registry.updateDOM;
    registry.updateDOM = function(target, newTree) {
        if (typeof newTree == 'string') {
            _updateDOM(target, newTree);
        } else {
            if (!target.tree) {
                var el = virtualDom.create(newTree);
                target.appendChild(el);
            } else {
                var patches = virtualDom.diff(target.tree, newTree);
                virtualDom.patch(target.children[0], patches);
            }
            target.tree = newTree;
        }
    };

    registry.events.push('dragstart');
    registry.events.push('dragover');
    registry.events.push('drop');
    registry.events.push('dragleave');
    registry.events.push('input');
    registry.events.push('dblclick');
    registry.events.push('keydown');
    registry.events.push('focusin');
    registry.events.push('focusout');

    var player = document.createElement('audio');
    var playlist = new Playlist(player, files);
    window.player = player;
    window.playlist = playlist;

    registry.registerDirective('barbaz', template, function(self, element) {
        var store = new FileStore(files);
        window.filestore = store;

        store.getElements = function() {
            return self.querySelectorAll('.listitem');
        };
        store.update = function() {
            var q = self.getModel('q', '').toLowerCase();
            store.updateExpanded(q);
            this.items = store.tree.asList(q);
            self.update({
                items: store.tree.asTree(q),
                hasFocus: store.hasFocus,
                art: (playlist.items[playlist.current] || {}).art,
            });
        };

        self.on('activate', function(event) {
            event.preventDefault();
            if (event.ctrlKey) {
                var selection = store.getSelection();
                var uris = _.map(selection, function(index) {
                    return store.items[index].path;
                });
                playlist.appendUri(uris);
            } else {
                var index = _.indexOf(store.getElements(), event.currentTarget);
                player.src = '/file' + store.items[index].path;
                player._loaded = true;
                player.play();
            }
        });

        self.on('filter', function() {
            store.update();
        });

        self.on('toggle', function(event) {
            event.preventDefault();
            var element = event.currentTarget.parentNode.children[1];
            var index = _.indexOf(store.getElements(), element);
            store.toggle(index);
            store.setFocus(index);
        });

        self.on('keydown', function(event) {
            var index = _.indexOf(store.getElements(), event.currentTarget);
            var item;
            if (!event.ctrlKey && !event.altKey) {
                if (event.keyCode === 39) {  // Right
                    item = store.items[index];
                    if (!item.expanded) {
                        event.preventDefault();
                        store.toggle(index, true);
                    }
                } else if (event.keyCode === 37) {  // Left
                    item = store.items[index];
                    if (item.dir && item.expanded) {
                        event.preventDefault();
                        store.toggle(index, false);
                    }
                }
            }
        });

        tree.treeView(self, element, store);

        muu.$.on(document, 'keydown', function(event) {
            if (!event.defaultPrevented && !event.ctrlKey && event.altKey) {
                if (event.keyCode === 72) {  // alt-h
                    playlist.prev();
                } else if (event.keyCode === 74) {  // alt-j
                    if (player.paused) {
                        player.play();
                    } else {
                        player.pause();
                    }
                } else if (event.keyCode === 75) {  // alt-k
                    playlist.stop();
                } else if (event.keyCode === 76) {  // alt-l
                    playlist.next();
                } else if (event.keyCode === 188) {  // alt-<
                    player.volume -= 0.1;
                } else if (event.keyCode === 190) {  // alt->
                    player.volume += 0.1;
                } else if (event.keyCode === 83) {  // alt-s
                    document.getElementsByName('q')[0].focus();
                } else {
                    console.log(event.keyCode);
                }
            }
        });

        // for updating cover art
        return muu.$.on(player, 'play', function() {
            store.update();
        });
    });

    registry.registerDirective('playlist', playlistTpl, function(self, element) {
        playlist.getElements = function() {
            return self.querySelectorAll('.listitem');
        };
        playlist.update = function() {
            self.update({
                items: playlist.items,
                hasFocus: playlist.hasFocus,
            });
        };

        tree.treeView(self, element, playlist);

        self.on('activate', function(event) {
            event.preventDefault();
            var index = _.indexOf(playlist.getElements(), event.currentTarget);
            playlist.play(index);
        });

        return playlist.on('change', playlist.update);
    });

    var sliderTpl = function(data) {
        return h('input', {
            className: data.class,
            type: 'range',
            min: 0,
            max: data.max,
            name: 'value',
            value: data.value,
            dataset: {
                oninput: 'change',
                onchange: 'change'
            }
        });
    };

    registry.registerDirective('seeker', sliderTpl, function(self, element) {
        self.update({
            value: 0,
            max: 500,
            class: 'seeker',
        });

        self.on('change', function(event) {
            player.currentTime = player.duration * self.getModel('value') / 500;
        });

        return muu.$.on(player, 'timeupdate', function() {
            self.setModel('value', player.currentTime / player.duration * 500);
        });
    });

    registry.registerDirective('volume', sliderTpl, function(self, element) {
        self.update({
            value: player.volume * 500,
            max: 100,
            class: 'volume',
        });

        self.on('change', function(event) {
            player.volume = self.getModel('value') / 100;
        });

        return muu.$.on(player, 'volumechange', function() {
            self.setModel('value', player.volume * 100);
        });
    });

    registry.registerDirective('buttons', buttonsTpl, function(self) {
        self.update({});

        self.on('play', function(event) {
            event.preventDefault();
            if (player._loaded) {
                player.play();
            } else {
                playlist.play(0);
            }
        });
        self.on('pause', function(event) {
            event.preventDefault();
            player.pause();
        });
        self.on('stop', function(event) {
            event.preventDefault();
            playlist.stop();
        });
        self.on('next', function(event) {
            event.preventDefault();
            playlist.next();
        });
        self.on('prev', function(event) {
            event.preventDefault();
            playlist.prev();
        });
    });

    registry.registerDirective('spectrum', '', function(self, element) {
        self.update({});

        var color1 = sniffColor('spectrum', 'color');
        var color2 = sniffColor('listitem is-selected', 'background-color');

        var canvas = document.createElement('canvas');
        canvas.className = 'spectrum';
        element.appendChild(canvas);

        var context = new AudioContext();
        var analyser = context.createAnalyser();
        analyser.fftSize = 64;
        var source = context.createMediaElementSource(player);
        source.connect(analyser);
        source.connect(context.destination);

        var updateCanvas = function() {
            var spectrums = new Uint8Array(analyser.frequencyBinCount);
            analyser.getByteFrequencyData(spectrums);

            var ctx = canvas.getContext('2d');
            var chartImage = new Image();

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            var n = spectrums.length;
            for (var i = 0; i < n; i++) {
                var x = (i / n) * canvas.width;
                var width = canvas.width / n * 0.8;
                var height = spectrums[i] / 255 * canvas.height;

                var y0 = canvas.height - height;
                var y1 = canvas.height;

                var gradient = ctx.createLinearGradient(0, y0, 0, y1);
                gradient.addColorStop(0, color1);
                gradient.addColorStop(1, color2);
                ctx.fillStyle = gradient;

                ctx.fillRect(x, y0, width, y1);
            }
        };

        var intervalID = setInterval(updateCanvas, 100);

        return function() {
            clearInterval(intervalID);
        };
    });

    var statusbarTpl = function(data) {
        return h('div.statusbar', [data.status, '|', data.time, '|', 'Total time: ' + data.totalTime]);
    };
    registry.registerDirective('statusbar', statusbarTpl, function(self) {
        var update = function() {
            self.update({
                status: player.paused ? 'paused' : 'playing',
                time: formatTime(player.currentTime),
                totalTime: formatTime(playlist.getTotalTime()),
            });
        };

        update();

        var unregister = [];
        unregister.push(playlist.on('change', update));
        unregister.push(muu.$.on(player, 'timeupdate', update));
        unregister.push(muu.$.on(player, 'play', update));
        unregister.push(muu.$.on(player, 'pause', update));

        return function() {
            _.forEach(unregister, function(fn) {
                fn();
            });
        };
    });

    registry.linkAll(document);
});
