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
            player.src = '//localhost:5003' + self.rows[i].path;
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
                if (row.path === decodeURI(player.src).slice(21)) {
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
                var path = decodeURI(event.dataTransfer.getData('text')).slice(21);
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

        registry.linkAll(document);
    });
})(muu, PromiseXHR, Mustache, _);
