(function(muu, xhr, Mustache, _) {
    'use strict';

    Promise.all([
        xhr.get('/static/foobar.html'),
        xhr.get('/static/filelist.html'),
        xhr.getJSON('/files.json'),
    ]).then(function(args) {
        var template = args[0];
        var files = args[2];

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

        registry.linkAll(document);
    });
})(muu, PromiseXHR, Mustache, _);
