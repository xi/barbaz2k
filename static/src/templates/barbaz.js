var h = require('virtual-dom/h');
var _ = require('../lodash');


var muu = function(type) {
    return h('muu', {attributes: {type: type}});
};

var filetree = function(data) {
    var elements = [];

    _.forEach(data.dirs, function(dir) {
        var className = 'listitem';
        if (dir.selected) {
            className += ' is-selected';
        }
        var children = [
            h('a.expander', {
                href: '#',
                tabIndex: -1,
                dataset: {
                    onclick: 'toggle'
                }
            }, [dir.expanded ? '–' : '+']),
            h('span', {
                className: className,
                tabIndex: -1,
                draggable: true,
                dataset: {
                    onclick: 'click',
                    onkeydown: 'keydown',
                    ondragstart: 'dragstart'
                }
            }, [dir.title])
        ];

        if (dir.expanded) {
            children.push(h('ul', filetree(dir)));
        }

        elements.push(h('li', children));
    });

    _.forEach(data.files, function(file) {
        var className = 'listitem';
        if (file.selected) {
            className += ' is-selected';
        }
        elements.push(h('li', [
            h('span', {
                className: className,
                tabIndex: -1,
                draggable: true,
                dataset: {
                    onclick: 'click',
                    ondblclick: 'dblclick',
                    onkeydown: 'keydown',
                    ondragstart: 'dragstart'
                }
            }, [file.title])
        ]));
    });

    return elements;
};

var filebrowser = function(data) {
    var params = {
        dataset: {
            onclick: 'click',
            onfocusin: 'focusin',
            onfocusout: 'focusout'
        }
    };
    if (data.hasFocus) {
        params.tabIndex = 0;
    }

    var children = [
        h('div.search-wrapper', [
            h('input', {
                type: 'search',
                name: 'q',
                dataset: {
                    onsearch: 'filter',
                    onkeyup: 'filter'
                }
            })
        ]),
        h('ul.filetree', params, filetree(data.items))
    ];

    if (data.art) {
        children.push(h('div.art', {
            style: {
                'background-image': 'url("/file' + data.art + '")'
            }
        }));
    }

    return h('div.file-browser', children);
}

module.exports = function(data) {
    return h('div', [
        h('div.topbar', [
            muu('buttons'),
            h('span.separator'),
            muu('volume'),
            h('span.separator'),
            muu('spectrum'),
            h('span.separator'),
            muu('seeker'),
        ]),
        filebrowser(data),
        muu('playlist'),
        muu('statusbar')
    ]);
};
