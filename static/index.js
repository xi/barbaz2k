(function(muu, xhr, Mustache, _) {
    'use strict';

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

        var player = document.createElement('audio');

        registry.registerDirective('foobar', template, function(self) {
            var update = function() {
                self.update({
                    files: files,
                });
            };

            update();

            self.on('play', function(event) {
                event.preventDefault();
                var url = event.currentTarget.href;
                player.src = url;
                player.play();
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
