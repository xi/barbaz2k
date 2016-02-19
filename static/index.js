(function(muu, xhr, Mustache, _) {
    'use strict';

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
                index -= _.filter(done, (i) => i < index).length;
                removed.push(pop(self.items, index))
                done.push(indices[i]);
            }
            self.current -= _.filter(done, (i) => i < self.current).length;

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

        muu.$.on(player, 'ended', self.next);
        muu.$.on(player, 'play', updateStatus);
        muu.$.on(player, 'pause', updateStatus);
    };
    Playlist.prototype = new TreeStore();

    var formatTime = function(duration) {
        var s = '';
        s += Math.floor(duration / 60) || 0;
        s += ':'
        s += ('00' + Math.floor(duration) % 60).slice(-2);
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
            expanded: false,
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
                return dir.asTree(q);
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

    var FileStore = function(files) {
        var self = this;

        self.items = [];
        self.hasFocus = false;
        self.tree = createTree(files);

        self.parentIndex = function(index) {
            var item = self.items[index];
            return _.findIndex(self.items, function(i) {
                return _.indexOf(i.dirs, item) !== -1 || _.indexOf(i.files, item) !== -1;
            });
        };
        self.childIndex = function(index) {
            var item = self.items[index];
            var childItem = item.dirs[0] || item.files[0];
            return _.indexOf(self.items, childItem);
        };
        self.drag = function(index) {
            var selection = self.getSelection();
            return {
                origin: 'filelist',
                uris: _.map(selection, (i) => self.items[i].path),
            };
        };
    };
    FileStore.prototype = new TreeStore();

    Promise.all([
        xhr.get('/static/foobar.html'),
        xhr.get('/static/filetree.html'),
        xhr.get('/static/buttons.html'),
        xhr.get('/static/playlist.html'),
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
            muu.$.on(player, 'play', () => store.update());

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
                    player.src = '/proxy' + store.items[index].path;
                    player.play();
                }
            });

            self.on('filter', () => store.update());

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

            treeView(self, element, store);
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

            treeView(self, element, playlist);

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
})(muu, PromiseXHR, Mustache, _);
