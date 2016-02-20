var muu = require('muu');
var xhr = require('promise-xhr');
var Mustache = require('mustache');
var _ = require('./lodash');

var tree = require('./tree');
var Playlist = require('./playlist');
var FileStore = require('./filestore');


var formatTime = function(duration) {
    var s = '';
    s += Math.floor(duration / 60) || 0;
    s += ':'
    s += ('00' + Math.floor(duration) % 60).slice(-2);
    return s;
};

Promise.all([
    xhr.get('/static/templates/foobar.html'),
    xhr.get('/static/templates/filetree.html'),
    xhr.get('/static/templates/buttons.html'),
    xhr.get('/static/templates/playlist.html'),
    xhr.getJSON('/files.json'),
]).then(function(args) {
    var template = args[0];
    var buttonsTpl = args[2]
    var playlistTpl = args[3];
    var files = args[4];

    var partials = {
        filetree: args[1],
    };

    var registry = new muu.Registry({
        renderer: function(a, b) {
            return Mustache.render(a, b, partials);
        }
    });
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

    registry.registerDirective('foobar', template, function(self, element) {
        var store = new FileStore(files);

        store.getElements = function() {
            return self.querySelectorAll('.listitem');
        };
        store.update = function() {
            var q = self.getModel('q', '').toLowerCase();
            this.items = store.tree.asList(q);
            self.update({
                items: store.tree.asTree(q),
                hasFocus: store.hasFocus,
                art: (playlist.items[playlist.current] || {}).art,
            });
        };

        // for updating cover art
        muu.$.on(player, 'play', function() {
            store.update()
        });

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
            var item = store.items[index];
            item.expanded = !item.expanded;
            store.update();
            store.setFocus(index);
        });

        self.on('keydown', function(event) {
            var index = _.indexOf(store.getElements(), event.currentTarget);
            if (event.keyCode === 39) {  // Right
                var item = store.items[index];
                if (!item.expanded) {
                    event.preventDefault();
                    item.expanded = true;
                    store.update();
                }
            }
            if (event.keyCode === 37) {  // Left
                var item = store.items[index];
                if (item.dir && item.expanded) {
                    event.preventDefault();
                    item.expanded = false;
                    store.update();
                }
            }
        });

        tree.treeView(self, element, store);
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

        playlist.on('change', playlist.update);

        tree.treeView(self, element, playlist);

        self.on('activate', function(event) {
            event.preventDefault();
            var index = _.indexOf(playlist.getElements(), event.currentTarget);
            playlist.play(index);
        });
    });

    var sliderTpl = '<input class="{{class}}" ' +
        'data-oninput="change" ' +
        'data-onchange="change" ' +
        'type="range" ' +
        'min="0" ' +
        'max="{{max}}" ' +
        'name="value" ' +
        'value="{{value}}"/>';

    registry.registerDirective('seeker', sliderTpl, function(self, element) {
        self.update({
            value: 0,
            max: 500,
            class: 'seeker',
        });

        muu.$.on(player, 'timeupdate', function() {
            self.setModel('value', player.currentTime / player.duration * 500);
        });

        self.on('change', function(event) {
            player.currentTime = player.duration * self.getModel('value') / 500;
        });
    });

    registry.registerDirective('volume', sliderTpl, function(self, element) {
        self.update({
            value: player.volume * 500,
            max: 100,
            class: 'volume',
        });

        muu.$.on(player, 'volumechange', function() {
            self.setModel('value', player.volume * 100);
        });

        self.on('change', function(event) {
            player.volume = self.getModel('value') / 100;
        });
    });

    registry.registerDirective('buttons', buttonsTpl, function(self) {
        self.update({});

        self.on('play', function(event) {
            event.preventDefault();
            player.play();
        });
        self.on('pause', function(event) {
            event.preventDefault();
            player.pause();
        });
        self.on('stop', function(event) {
            event.preventDefault();
            player.src = null;
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
                gradient.addColorStop(0, "white");
                gradient.addColorStop(1, "#006FA5");
                ctx.fillStyle = gradient;

                ctx.fillRect(x, y0, width, y1);
            }
        };

        var intervalID = setInterval(updateCanvas, 100);

        return function() {
            clearInterval(intervalID);
        };
    });

    var statusbarTpl = '<div class="statusbar">{{ status }} | {{time}} | Total time: {{ totalTime }}</div>';
    registry.registerDirective('statusbar', statusbarTpl, function(self) {
        var update = function() {
            self.update({
                status: player.paused ? 'paused' : 'playing',
                time: formatTime(player.currentTime),
                totalTime: formatTime(playlist.getTotalTime()),
            });
        };

        update();
        playlist.on('change', update);
        muu.$.on(player, 'timeupdate', update);
        muu.$.on(player, 'play', update);
        muu.$.on(player, 'pause', update);
    });

    registry.linkAll(document);
});
