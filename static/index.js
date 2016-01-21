(function(muu, xhr, Mustache, _) {
    'use strict';

    var Playlist = function(player) {
        var self = this;

        self.rows = [];
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
            return _.sum(_.map(self.rows, 'duration_raw')) || 0;
        };

        self.clear = function() {
            self.rows = [];
            self.dispatchEvent('clear');
            self.dispatchEvent('change');
            player.src= null;
        };
        self.append = function(item) {
            self.rows.push(item);
            self.dispatchEvent('change');
        };
        self.delete = function(index) {
            self.rows.splice(index, 1);
            self.dispatchEvent('change');
        };

        self.play = function(i) {
            self.current = i;
            player.src = '/proxy' + self.rows[i].path;
            player.play();
            self.dispatchEvent('change');
        };
        self.next = function() {
            self.play(self.current + 1);
        };
        self.prev = function() {
            self.play(self.current - 1);
        };

        var updateStatus = function() {
            _.forEach(self.rows, function(row) {
                if (row.path === decodeURI(player.src).slice(27)) {
                    row.playing = !player.paused;
                    row.paused = player.paused;
                } else {
                    row.playing = false;
                    row.paused = false;
                }
            });
            self.dispatchEvent('change');
        };

        muu.$.on(player, 'ended', self.next);
        muu.$.on(player, 'play', updateStatus);
        muu.$.on(player, 'pause', updateStatus);
    };

    var formatTime = function(duration) {
        var s = '';
        s += Math.round(duration / 60) || 0;
        s += ':'
        s += ('00' + Math.round(duration) % 60).slice(-2);
        return s;
    };

    var createTree = function(paths, expanded) {
        var tree = {
            dirs: [],
            files: [],
        };

        _.forEach(paths, function(path) {
            var parts = path.slice(1).split('/');
            var head = tree;

            _.forEach(parts.slice(0, -1), function(part) {
                var item = _.find(head.dirs, function(i) {
                    return i.title === part;
                });
                if (!item) {
                    item = {
                        title: part,
                        dirs: [],
                        files: [],
                        expanded: expanded,
                    }
                    head.dirs.push(item)
                }
                head = item;
            });

            head.files.push({
                title: parts[parts.length - 1],
                path: path,
            });
        });

        return tree;
    };

    var createTree2 = function(paths, expands, q) {
        if (q) {
            paths = _.filter(paths, function(p) {
                return p.toLowerCase().match(q.toLowerCase());
            });
        }

        return createTree(paths, q);
    };

    Promise.all([
        xhr.get('/static/foobar.html'),
        xhr.get('/static/filelist.html'),
        xhr.get('/static/buttons.html'),
        xhr.getJSON('/files.json'),
    ]).then(function(args) {
        var template = args[0];
        var buttons = args[2]
        var files = args[3];

        var partials = {
            filelist: args[1],
        };

        var registry = new muu.Registry({
            renderer: function(a, b) {
                return Mustache.render(a, b, partials);
            }
        });
        registry.events.push('dragover');
        registry.events.push('drop');
        registry.events.push('input');
        registry.events.push('dblclick');

        var player = document.createElement('audio');
        var playlist = new Playlist(player);

        registry.registerDirective('foobar', template, function(self) {
            var update = function() {
                self.update({
                    files: createTree2(files, null, self.getModel('q')),
                    playlist: playlist.rows,
                });
            };

            update();

            self.on('playlist-click', function(event) {
                event.preventDefault();
                var row = event.currentTarget;
                var index = _.indexOf(row.parentNode.children, row);
                playlist.play(index);
            });

            self.on('filter', update);
            playlist.on('change', update);

            self.on('play', function(event) {
                event.preventDefault();
                var url = event.currentTarget.href;
                player.src = url;
                player.play();
            });

            self.on('dragover', function(event) {
                event.preventDefault();
                event.dataTransfer.dropEffect = "copy";
            });
            self.on('drop', function(event) {
                event.preventDefault();
                var path = decodeURI(event.dataTransfer.getData('text')).slice(27);
                xhr.getJSON('/info.json?path=' + encodeURIComponent(path)).then(function(info) {
                    playlist.append(info);
                });
            });
        });

        var slider = '<input class="{{class}}" data-oninput="change" data-onchange="change" type="range" min="0" max="1000" step="10" name="value" value="{{value}}"/>';

        registry.registerDirective('seeker', slider, function(self, element) {
            self.update({
                value: 0,
                class: 'seeker',
            });

            muu.$.on(player, 'timeupdate', function() {
                self.setModel('value', player.currentTime / player.duration * 1000);
            });

            self.on('change', function(event) {
                player.currentTime = player.duration * self.getModel('value') / 1000;
            });
        });

        registry.registerDirective('volume', slider, function(self, element) {
            self.update({
                value: player.volume * 1000,
                class: 'volume',
            });

            muu.$.on(player, 'volumechange', function() {
                self.setModel('value', player.volume * 1000);
            });

            self.on('change', function(event) {
                player.volume = self.getModel('value') / 1000;
            });
        });

        registry.registerDirective('buttons', buttons, function(self) {
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
                    gradient.addColorStop(1, "blue");
                    ctx.fillStyle = gradient;

                    ctx.fillRect(x, y0, width, y1);
                }
            };

            var intervalID = setInterval(updateCanvas, 100);

            return function() {
                clearInterval(intervalID);
            };
        });

        registry.registerDirective('statusbar', '{{ status }} | {{time}} | Total time: {{ totalTime }}', function(self) {
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
})(muu, PromiseXHR, Mustache, _);
