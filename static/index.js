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

    var TreeNode = function(path) {
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
            });
        });

        return tree;
    };

    var linkListview = function(self, element, store) {
        // FIXME: generalize
        // FIXME: handle focus on enter/exit

        store.update();

        var initialShiftIndex = null;

        var getKeyIndex = function(event) {
            var index = _.indexOf(store.getElements(), event.currentTarget);

            if (event.keyCode === 40) {  // Down
                return index + 1;
            } else if (event.keyCode === 38) {  // Up
                return index - 1
            } else if (event.keyCode === 36) {  // Home
                return 0
            } else if (event.keyCode === 35) {  // End
                return siblings.length - 1;
            } else if (event.keyCode === 34) {  // PageDown
                return index + 10;
            } else if (event.keyCode === 33) {  // PageUp
                return index - 10;
            }
        };

        self.on('keydown', function(event) {
            // FIXME: delete, ctrl-x, ctrl-c, ctrl-v

            var index = _.indexOf(store.getElements(), event.currentTarget);
            var newIndex = getKeyIndex(event);

            if (newIndex !== undefined) {
                event.preventDefault();

                newIndex = Math.min(store.items.length - 1, Math.max(0, newIndex));

                if (event.ctrlKey) {
                    // do not change selection
                } else if (event.shiftKey) {
                    var a = Math.min(newIndex, initialShiftIndex);
                    var b = Math.max(newIndex, initialShiftIndex);
                    _.forEach(store.items, function(item, i) {
                        item.selected = a <= i && i <= b;
                    });
                } else {
                    _.forEach(store.items, function(item, i) {
                        item.selected = i === newIndex;
                    });
                }

                store.update();
                store.getElements()[newIndex].focus();
            } else if (event.keyCode === 32) {
                event.preventDefault();
                if (event.ctrlKey) {
                    store.items[index].selected = !store.items[index].selected;
                } else {
                    _.forEach(store.items, function(item, i) {
                        item.selected = i === index;
                    });
                }
                store.update();
            } else if (event.keyCode === 16) {
                event.preventDefault();
                initialShiftIndex = index;
            } else if (event.keyCode === 13) {
                event.preventDefault();
                var ev = muu.$.createEvent(
                    'muu-activate', undefined, undefined, event);
                element.dispatchEvent(ev);
            }
        });

        self.on('click', function(event) {
            // FIXME: click outside of elements should deselect all
            event.preventDefault();

            var index = _.indexOf(store.getElements(), event.currentTarget);

            if (event.shiftKey) {
                var a = Math.min(index, initialShiftIndex);
                var b = Math.max(index, initialShiftIndex);
                _.forEach(store.items, function(item, i) {
                    item.selected = a <= i && i <= b;
                });
            } else if (event.ctrlKey) {
                store.items[index].selected = !store.items[index].selected;
            } else {
                _.forEach(store.items, function(item, i) {
                    item.selected = i === index;
                });
            }

            store.update();
        });

        self.on('dragstart', function(event) {
            var index = _.indexOf(store.getElements(), event.currentTarget);
            if (!store.items[index].selected) {
                _.forEach(store.items, function(item, i) {
                    item.selected = i === index;
                });
            }
            store.update();

            var selection = _.map(_.filter(store.items, 'selected'), 'path');
            event.dataTransfer.setData('text/plain', selection.join('\n'));
            event.dataTransfer.setData('text/uri-list', selection.join('\n'));
            event.dataTransfer.effectAllowed = 'move';
        });

        var getDragIndex = function(event) {
            var element = _.last(_.filter(store.getElements(), function(el) {
                var rect = el.getBoundingClientRect()
                return (rect.top + rect.bottom) / 2 < event.clientY;
            }));

            if (element) {
                return _.indexOf(store.getElements(), element) + 1;
            } else {
                return 0;
            }
        };

        self.on('dragover', function(event) {
            event.preventDefault();
            var elements = store.getElements();
            var index = getDragIndex(event);

            _.forEach(elements, function(el, i) {
                if (i + 1 === index) {
                    el.classList.add('drop-below');
                } else {
                    el.classList.remove('drop-below');
                }
                el.classList.remove('drop-above');
            });
            if (index === 0 && elements.length > 0) {
                elements[0].classList.add('drop-above');
            }
        });

        self.on('drop', function(event) {
            event.preventDefault();
            var index = getDragIndex(event);
            var _items = [];

            var uriList = event.dataTransfer.getData('text');
            var dropEffect = event.dataTransfer.effectAllowed;  // HACK: dropEffect is not available in chrome

            Promise.all(_.map(uriList.split('\n'), store.uri2item)).then(function(newItems) {
                _.forEach(store.items, function(item, i) {
                    if (i === index) {
                        _items = _items.concat(newItems);
                    }
                    if (!item.selected || dropEffect !== 'move') {
                        _items.push(item);
                    }
                });
                if (store.items.length <= index) {
                    _items = _items.concat(newItems);
                }

                store.items = _items;
                store.update();

                // FIXME: focus the element that was dragged
            });

            event.dataTransfer.clearData();
        });
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

        registry.registerDirective('foobar', template, function(self, element) {
            // FIXME: items need to be sorted like tree (dirs first)
            var tree = createTree(files);

            var store = {
                items: []
            };
            store.getElements = function() {
                return self.querySelectorAll('.listitem');
            };
            store.update = function() {
                var q = self.getModel('q', '').toLowerCase();
                store.items = tree.asList(q);
                self.update({
                    items: tree.asTree(q),
                    art: (playlist.rows[playlist.current] || {}).art,
                });
            };

            linkListview(self, element, store);

            self.on('activate', function(event) {
                event.preventDefault();
                var url = event.currentTarget.dataset.href;
                player.src = url;
                player.play();
            });

            // self.on('focusout', function(event) {
            //     var root = event.currentTarget;
            //     if (!muu.$.isDescendant(event.relatedTarget, root)) {
            //         // FIXME: do not manipulate DOM directly
            //         event.target.classList.add('focus-inactive');
            //         root.setAttribute('tabindex', '0');
            //     }
            // });
            //
            // self.on('focusin', function(event) {
            //     var root = event.currentTarget;
            //     if (!muu.$.isDescendant(event.relatedTarget, root)) {
            //         var el = root.querySelector('.focus-inactive');
            //         if (el) {
            //             el.classList.remove('focus-inactive');
            //         }
            //         if (event.target !== root) {
            //             el = event.target;
            //         }
            //         if (!el) {
            //             el = root.querySelector('a:not(.expander)');
            //         }
            //         el.focus();
            //         root.setAttribute('tabindex', '-1');
            //     }
            // });

            self.on('filter', store.update);
        });

        registry.registerDirective('listview', listview, function(self, element) {
            var store = {
                items: []
            };

            store.getElements = function() {
                return self.querySelectorAll('.listitem');
            };
            store.uri2item = function(uri) {
                // FIXME: folder to list of items
                uri = uri.replace(/^https?:\/\/localhost:[0-9]*/, '');
                uri = uri.replace(/^\/proxy/, '');
                return xhr.getJSON('/info.json?path=' + uri);
            };
            store.update = function() {
                self.update({
                    items: store.items
                });
            };

            linkListview(self, element, store);

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
