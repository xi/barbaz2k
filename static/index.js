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

        var player = document.createElement('audio');

        registry.registerDirective('foobar', template, function(self) {
            var update = function() {
                self.update({
                    files: createTree(files),
                });
            };

            update();

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
                xhr.get('/info.json?path=' + encodeURIComponent(path)).then(function(info) {
                    console.log(info);
                });
            });
        });

        var slider = '<div class="{{class}}" data-onclick="click"><div class="slider" style="left: {{value}}%"></div></div>';
        var sliderValue = function(element, event) {
            var x0 = element.getBoundingClientRect().left;
            var x1 = element.getBoundingClientRect().right;
            var x = event.clientX;
            return (x - x0) / (x1 - x0);
        };

        registry.registerDirective('seeker', slider, function(self, element) {
            self.update({
                value: 0,
                class: 'seeker',
            });

            muu.$.on(player, 'timeupdate', function() {
                self.update({
                    value: player.currentTime / player.duration * 100,
                    class: 'seeker',
                });
            });

            self.on('click', function(event) {
                player.currentTime = player.duration * sliderValue(element, event);
            });
        });

        registry.registerDirective('volume', slider, function(self, element) {
            self.update({
                value: player.volume * 100,
                class: 'volume',
            });

            muu.$.on(player, 'volumechange', function() {
                self.update({
                    value: player.volume * 100,
                    class: 'volume',
                });
            });

            self.on('click', function(event) {
                player.volume = sliderValue(element, event);
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
