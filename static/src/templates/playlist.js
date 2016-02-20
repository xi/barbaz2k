var h = require('virtual-dom/h');
var _ = require('../lodash');


module.exports = function(data) {
    var params = {
        dataset: {
            onclick: 'click',
            onfocusin: 'focusin',
            onfocusout: 'focusout',
            ondragover: 'dragover',
            ondrop: 'drop',
            ondragleave: 'dragleave',
        }
    };
    if (!data.hasFocus) {
        params.tabIndex = 0;
    }
    return h('div.playlist', params, _.map(data.items, function(item) {
        var params = {
            className: 'listitem',
            tabIndex: -1,
            draggable: true,
            dataset: {
                onclick: 'click',
                ondblclick: 'dblclick',
                onkeydown: 'keydown',
                ondragstart: 'dragstart',
            }
        };
        if (item.selected) {
            params.className += ' is-selected';
        }
        var playing = [];
        if (item.playing) {
            playing.push(h('i.fa.fa-play'));
        } else if (item.paused) {
            playing.push(h('i.fa.fa-pause'));
        }
        return h('div', params, [
            h('div.playlist-item-playing', playing),
            h('div.playlist-item-title', [item.title]),
            h('div.playlist-item-artist', [item.artist]),
            h('div.playlist-item-duration', [item.duration]),
        ]);
    }));
};
