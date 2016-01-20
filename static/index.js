(function(muu, xhr, Mustache, _) {
    'use strict';

    var registry = new muu.Registry({
        renderer: Mustache.render
    });

    Promise.all([
        xhr.get('/static/foobar.html'),
        xhr.getJSON('/files.json'),
    ]).then(function(args) {
        var template = args[0];
        var files = args[1];

        registry.registerDirective('foobar', template, function(self) {
            self.update({});
        });

        registry.linkAll(document);
    });
})(muu, PromiseXHR, Mustache, _);
