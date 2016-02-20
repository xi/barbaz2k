var h = require('virtual-dom/h');


module.exports = function(data) {
    return h('div.playback-buttons', [
        h('a.stop', {
            href: '#',
            dataset: {
                onclick: 'stop'
            }
        }, [ h('i.fa.fa-stop') ]),
        h('a.play', {
            href: '#',
            dataset: {
                onclick: 'play'
            }
        }, [ h('i.fa.fa-play') ]),
        h('a.pause', {
            href: '#',
            dataset: {
                onclick: 'pause'
            }
        }, [ h('i.fa.fa-pause') ]),
        h('a.prev', {
            href: '#',
            dataset: {
                onclick: 'prev'
            }
        }, [ h('i.fa.fa-step-backward') ]),
        h('a.next', {
            href: '#',
            dataset: {
                onclick: 'next'
            }
        }, [ h('i.fa.fa-step-forward') ])
    ]);
};
