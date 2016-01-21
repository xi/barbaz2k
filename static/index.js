(function(muu, xhr, Mustache, _) {
    'use strict';

    var Playlist = function() {
        this.rows = [];
        this.element = document.createElement('div');
        this.current = 0;

        this.dispatchEvent = function(name, data) {
            var event = muu.$.createEvent(name, undefined, undefined, data);
            this.element.dispatchEvent(event);
        };

        this.on = function(name, fn) {
            return muu.$.on(this.element, name, fn);
        };

        this.clear = function() {
            this.rows = [];
            this.dispatchEvent('clear');
            this.dispatchEvent('change');
        };
        this.append = function(item) {
            this.rows.push(item);
            this.dispatchEvent('change');
        };
        this.delete = function(index) {
            this.rows.splice(index, 1);
            this.dispatchEvent('change');
        };

        this.next = function() {
            this.current += 1;
            return this.rows[this.current];
        };
        this.prev = function() {
            this.current -= 1;
            return this.rows[this.current];
        };
    };

    var createTree = function(paths) {
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

        return createTree(paths);
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

        var player = document.createElement('audio');

        registry.registerDirective('foobar', template, function(self) {
            var update = function() {
                self.update({
                    files: createTree2(files, null, self.getModel('q')),
                });
            };

            update();

            self.on('filter', update);

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
                    console.log(info);
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
        });

        registry.linkAll(document);
    });
})(muu, PromiseXHR, Mustache, _);
