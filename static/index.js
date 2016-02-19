(function(muu, xhr, Mustache, _) {
    'use strict';

    var Playlist = function(player) {
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

        self.insertBefore = function(items, position) {
            // FIXME calculate self.current if it is moved itself
            if (position <= self.current) {
                self.current += items.length;
            }
            self.items.splice.apply(self.items, [position, 0].concat(items));
            self.dispatchEvent('change');
        };

        self.remove = function(positions) {
            var pop = function(arr, i) {
                return arr.splice(i, 1)[0];
            };

            var done = [];
            var removed = [];

            for (var i = 0; i < positions.length; i++) {
                var position = positions[i];
                position -= _.filter(done, (p) => p < position).length;
                removed.push(pop(self.items, position))
                done.push(positions[i]);
            }
            self.current -= _.filter(done, (p) => p < self.current).length;

            self.dispatchEvent('change');
            return removed;
        };

        self.uri2item = function(uri) {
            // FIXME: folder to list of items
            uri = uri.replace(/^https?:\/\/localhost:[0-9]*/, '');
            uri = uri.replace(/^\/proxy/, '');
            return xhr.getJSON('/info.json?path=' + uri);
        };

        self.insertUriBefore = function(uris, position) {
            var promises = _.map(uris, self.uri2item);
            return Promise.all(promises).then(function(items) {
                self.insertBefore(items, position);
            });
        };

        self.appendUri = function(uri) {
            return self.uri2item(uri).then((i) => self.append([i]));
        };

        self.play = function(i) {
            self.current = i;
            player.src = '/proxy' + self.items[i].path;
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

        muu.$.on(player, 'ended', self.next);
        muu.$.on(player, 'play', updateStatus);
        muu.$.on(player, 'pause', updateStatus);
    };
    Playlist.prototype = new TreeStore();

    var formatTime = function(duration) {
        var s = '';
        s += Math.round(duration / 60) || 0;
        s += ':'
        s += ('00' + Math.round(duration) % 60).slice(-2);
        return s;
    };

    var TreeNode = function(path) {
        // FIXME select=false on collapse
        this.dirs = [];
        this.files = [];

        this.state = {
            dir: true,
            path: path,
            title: _.last(path.split('/')),
            expanded: path.match(/Beat/i),
            selected: false,
        };

        var match = function(path, q) {
            return !q || path.toLowerCase().match(q);
        };

        this.include = function(q) {
            return _.some(this.files, function(file) {
                return match(file.path, q);
            }) || _.some(this.dirs, function(dir) {
                return dir.include(q);
            });
        };

        this.getDirs = function(q) {
            return _.filter(this.dirs, function(dir) {
                return dir.include(q);
            });
        };

        this.getFiles = function(q) {
            return _.filter(this.files, function(file) {
                return match(file.path, q);
            });
        };

        this.asList = function(q) {
            var list = [];
            _.forEach(this.getDirs(q), function(dir) {
                list.push(dir.state);
                if (dir.state.expanded) {
                    list = _.concat(list, dir.asList(q));
                }
            });
            return _.concat(list, this.getFiles(q));
        };

        this.asTree = function(q) {
            this.state.dirs =  _.map(this.getDirs(q), function(dir) {
                return dir.asTree();
            });
            this.state.files = this.getFiles(q);
            return this.state;
        };
    };

    var createTree = function(files) {
        var tree = new TreeNode('/');

        _.forEach(files, function(path) {
            var parts = path.slice(1).split('/');
            var head = tree;
            var _parts = [];

            _.forEach(parts.slice(0, -1), function(part) {
                _parts.push(part);
                var item = _.find(head.dirs, function(i) {
                    return i.state.path === _parts.join('/');
                });
                if (!item) {
                    item = new TreeNode(_parts.join('/'));
                    head.dirs.push(item)
                }
                head = item;
            });

            head.files.push({
                path: path,
                title: _.last(path.split('/')),
                selected: false,
                focus: false,
            });
        });

        return tree;
    };

    Promise.all([
        xhr.get('/static/foobar.html'),
        xhr.get('/static/filelist.html'),
        xhr.get('/static/buttons.html'),
        xhr.get('/static/listview.html'),
        xhr.getJSON('/files.json'),
    ]).then(function(args) {
        var template = args[0];
        var buttons = args[2]
        var listview = args[3];
        var files = args[4];

        var partials = {
            filelist: args[1],
        };

        var registry = new muu.Registry({
            renderer: function(a, b) {
                return Mustache.render(a, b, partials);
            }
        });
        registry.events.push('dragstart');
        registry.events.push('dragover');
        registry.events.push('drop');
        registry.events.push('input');
        registry.events.push('dblclick');
        registry.events.push('keydown');
        registry.events.push('focusin');
        registry.events.push('focusout');

        var player = document.createElement('audio');
        var playlist = new Playlist(player);
        window.player = player;
        window.playlist = playlist;

        registry.registerDirective('foobar', template, function(self, element) {
            var tree = createTree(files);

            var store = {
                items: [],
                hasFocus: false,
            };
            store.getElements = function() {
                return self.querySelectorAll('.listitem');
            };
            store.update = function() {
                var q = self.getModel('q', '').toLowerCase();
                store.items = tree.asList(q);
                self.update({
                    items: tree.asTree(q),
                    hasFocus: store.hasFocus,
                    art: (playlist.items[playlist.current] || {}).art,
                });
            };
            store.parentIndex = function(index) {
                var item = store.items[index];
                return _.findIndex(store.items, function(i) {
                    return _.indexOf(i.dirs, item) !== -1 || _.indexOf(i.files, item) !== -1;
                });
            };
            store.childIndex = function(index) {
                var item = store.items[index];
                var childItem = item.dirs[0] || item.files[0];
                return _.indexOf(store.items, childItem);
            };

            treeView(self, element, store);

            self.on('activate', function(event) {
                event.preventDefault();
                var url = event.currentTarget.dataset.href;
                if (event.ctrlKey) {
                    playlist.appendUri(url);
                } else {
                    player.src = url;
                    player.play();
                }
            });

            self.on('filter', store.update);

            self.on('toggle', function(event) {
                var element = event.currentTarget.parentNode.children[1];
                var index = _.indexOf(store.getElements(), element);
                var item = store.items[index];
                item.expanded = !item.expanded;
                store.update();
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
        });

        registry.registerDirective('listview', listview, function(self, element) {
            playlist.getElements = function() {
                return self.querySelectorAll('.listitem');
            };
            playlist.update = function() {
                self.update({
                    items: playlist.items,
                    hasFocus: playlist.hasFocus,
                });
            };
            playlist.canDrop = function() {
                return true;
            };

            playlist.on('change', playlist.update);

            treeView(self, element, playlist);

            self.on('activate', function(event) {
                event.preventDefault();
                var url = event.currentTarget.dataset.href;
                player.src = url;
                player.play();
            });
        });

        var slider = '<input class="{{class}}" data-oninput="change" data-onchange="change" type="range" min="0" max="{{max}}" name="value" value="{{value}}"/>';

        registry.registerDirective('seeker', slider, function(self, element) {
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

        registry.registerDirective('volume', slider, function(self, element) {
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
