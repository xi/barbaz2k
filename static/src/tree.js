/**
 * This module containes abstract functionality for tree-/listviews.
 * This includes:
 *
 * - moving focus (mouse/keybaord)
 * - managing selection (ATM mostly keybaord)
 * - drag and drop support
 * - adding/removing/moving items
 *
 * This is handled by two separate functions:
 *
 * - `TreeStore` is an abstract constructor for managing the underlying data.
 * - `treeView` is a mixin for muu directives.
 *
 * Data list stored as a plain list of arbitrary objects. They are commonly
 * identified by their index in the list. Mapping this to a hierarhical tree
 * structure is up to the concrete implementation, but you can use
 * `TreeStore.parentIndex` and `TreeStore.childIndex` as a starting point.
 *
 * In order for this to work, the template must implement some event bindings.
 * They all use the original event name as alias:
 *
 * - on item: keydown, click, dblclick
 * - on container: click, focusin, focusout
 *
 * For drag and drop:
 *
 * - on item: dragstart
 * - on container: dragover, dragleave, drop
 *
 * Additionally, the container should be focusable if and only if
 * `TreeStore.hasFocus` is falsy. The items should always have `tabIndex="-1"`
 * so they can receive focus without being in the taborder. And for items to be
 * draggable they may need `traggable="true"`
 */

var muu = require('muu');
var _ = require('./lodash');


var TreeStoreProto = function() {
    /** List of objects that represent the data in the tree. */
    this.items = [];

    /**
     * True if focus is currently inside of the tree.
     *
     * The template should make sure that the container is focusable if and
     * only of this is false. */
    this.hasFocus = false;

    /** Update the DOM from `this.items`. */
    this.update = function() {
        throw new Error('Not implemented');
    };

    /**
     * Get a list of DOM elements that correspond the items.
     *
     * They must be in the same order as items. */
    this.getElements = function() {
        throw new Error('Not implemented');
    };

    this.clear = function() {
        this.items = [];
    };

    this.insertBefore = function(items, index) {
        this.items.splice.apply(this.items, [index, 0].concat(items));
    };

    this.insertAfter = function(items, index) {
        this.insertBefore(items, index + 1);
    };

    this.append = function(items) {
        this.insertAfter(items, this.items.length - 1);
    };

    this.remove = function(indices) {
        var pop = function(arr, i) {
            return arr.splice(i, 1)[0];
        };

        var done = [];
        var removed = [];

        for (var i = 0; i < indices.length; i++) {
            var index = indices[i];
            index -= done.filter(function(i) {
                return p < index;
            }).length;
            removed.push(pop(this.items, index))
            done.push(indices[i]);
        }

        return removed;
    };

    this.moveBefore = function(indices, index) {
        var items = this.remove(indices);
        index -= _.filter(indices, function(i) {
            return i < index;
        }).length;
        this.insertBefore(items, index);
    };

    this.moveAfter = function(indices, index) {
        this.moveBefore(indices, index + 1);
    };

    /** Return the index of the parent item in a tree, else -1. */
    this.parentIndex = function(index) {
        return -1;
    };

    /** Return the index of the first child item in a tree, else -1. */
    this.childIndex = function(index) {
        return -1;
    };

    /**
     * Return whether the dragged data can be dropped here.
     *
     * Defaults to `false`. */
    this.canDrop = function(data) {
        return false;
    };

    /** Provide data that will be dragged. */
    this.drag = function(index) {
        throw new Error('Not implemented');
    };

    /** Drop the dragged data here. */
    this.drop = function(data, index) {
        throw new Error('Not implemented');
    };

    /** Set focus to an item. */
    this.setFocus = function(index) {
        _.forEach(this.items, function(item, i) {
            item.focus = i === index;
        });
        this.getElements()[index].focus();
    };

    /** Get the indices of selected items. */
    this.getSelection = function() {
        var selection = [];
        _.forEach(this.items, function(item, index) {
            if (item.selected) {
                selection.push(index);
            }
        });
        return selection;
    };
};

var TreeStore = function() {};
TreeStore.prototype = new TreeStoreProto();


var treeView = function(self, element, store) {
    store.update();

    var initialShiftIndex = null;
    var clipboard = null;

    var getKeyIndex = function(event) {
        var index = _.indexOf(store.getElements(), event.currentTarget);

        if (event.keyCode === 40) {  // Down
            return index + 1;
        } else if (event.keyCode === 38) {  // Up
            return index - 1
        } else if (event.keyCode === 39) {  // Right
            if (store.childIndex && !event.defaultPrevented) {
                var childIndex = store.childIndex(index);
                if (childIndex !== -1) {
                    return childIndex;
                }
            }
        } else if (event.keyCode === 37) {  // Left
            if (store.parentIndex && !event.defaultPrevented) {
                var parentIndex = store.parentIndex(index);
                if (parentIndex !== -1) {
                    return parentIndex;
                }
            }
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
            store.setFocus(newIndex);
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
        } else if (event.keyCode === 46) {  // delete
            event.preventDefault();
            store.remove(store.getSelection());
            store.update();
        } else if (event.keyCode == 88 && event.ctrlKey) {  // ctrl-x
            event.preventDefault();
            clipboard = store.remove(store.getSelection());
            _.forEach(clipboard, function(item) {
                item.focus = false;
                item.selected = false;
            });
        } else if (event.keyCode == 67 && event.ctrlKey) {  // ctrl-c
            event.preventDefault();
            clipboard = _.map(store.getSelection(), function(i) {
                return store.items[i];
            });
            _.forEach(clipboard, function(item) {
                item.focus = false;
                item.selected = false;
            });
        } else if (event.keyCode == 86 && event.ctrlKey) {  // ctrl-v
            event.preventDefault();
            if (clipboard) {
                store.insertAfter(_.map(clipboard, function(i) {
                    return _.clone(i);
                }), index);
            }
        } else if (event.keyCode == 65 && event.ctrlKey) {  // ctrl-a
            _.forEach(store.items, function(item) {
                item.selected = true;
            });
            store.update();
        }
    });

    var getClickIndex = function(event) {
        // try all elements from target to currentTarget, bottom-up

        var elements = store.getElements();
        var element = event.target;
        var index = -1;

        while (true) {
            index = _.indexOf(elements, element);
            if (index !== -1 || element === event.currentTarget) {
                return index;
            }
            element = element.parentElement;
        }
    };

    self.on('click', function(event) {
        event.preventDefault();

        var index = getClickIndex(event);

        if (index === -1) {
            _.forEach(store.items, function(item, i) {
                item.selected = false;
            });
        } else {
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

            store.setFocus(index);
        }

        store.update();
    });

    self.on('dblclick', function(event) {
        event.preventDefault();
        var ev = muu.$.createEvent(
            'muu-activate', undefined, undefined, event);
        element.dispatchEvent(ev);
    });

    self.on('focusin', function(event) {
        var root = event.currentTarget;
        var previous = event.relatedTarget;

        if (!muu.$.isDescendant(previous, root)) {
            var elements = store.getElements();
            var index = _.indexOf(elements, event.target);

            if (index === -1) {
                index = _.findIndex(store.items, 'focus');
            }
            if (index === -1 && event.target === root) {
                index = 0;
            }

            if (index !== -1 && index < elements.length) {
                store.setFocus(index);
            }

            store.hasFocus = true;
            store.update();
        }
    });

    self.on('focusout', function(event) {
        var root = event.currentTarget;
        var next = event.relatedTarget;
        if (!muu.$.isDescendant(next, root)) {
            store.hasFocus = false;
            store.update();
        }
    });

    self.on('dragstart', function(event) {
        var index = _.indexOf(store.getElements(), event.currentTarget);
        if (!store.items[index].selected) {
            _.forEach(store.items, function(item, i) {
                item.selected = i === index;
            });
            store.update();
        }

        window.dragDropData = store.drag(index);
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
        if (store.canDrop(window.dragDropData)) {
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
        }
    });

    self.on('drop', function(event) {
        if (store.canDrop(window.dragDropData)) {
            event.preventDefault();
            var index = getDragIndex(event);
            store.drop(window.dragDropData, index);
            window.dragDropData = null;
        }
    });

    self.on('dragleave', function(event) {
        _.forEach(store.getElements(), function(el, i) {
            el.classList.remove('drop-below');
            el.classList.remove('drop-above');
        });
    });
};


module.exports.TreeStore = TreeStore;
module.exports.treeView = treeView;
