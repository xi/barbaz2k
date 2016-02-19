/* - `items` is an array of plain objects
 * - `elements` is an array of DOMElements that correspond with the items
 * - they have the same order
 * - `update()` can be used to sync `elements` with `items`
 * - selection and focus are stored in the items
 * - treeview only changes selection and focus on items, nothing else
 * - there is an interface for adding/removing/moving items (e.g. playlist can react to changes)
 * - `!hasFocus` needs to set tabindex=0 on container
 * - `parentIndex` and `childIndex` allow for tree navigation
 *
 * # events
 *
 * - keydown/click/dblclick (on single element)
 * - click (on container for deselect)
 * - focusin/focusout (on container; focus is instantly moved to element)
 * - drag* (on single element)
 * - drop (on container)
 *
 * # options
 *
 * - drag
 * - drop
 *
 * # drag/drop
 *
 * circumvent browser apis, use shared data object instead
 * dragDropData should contain some information for the drop target on how to
 * use this data
 *
 * - store.canDrop - can this kind of data be dropped in this treeView?
 * - store.setupData(indices) : any - return value is saved in dragDropData
 * - onDrop(dragDropData : any) - execute action based on dragDropData
 */

// FIXME: use one store with more than one view

(function(window, undefined, muu, _) {
    'use strict';

    var TreeStoreProto = function() {
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
                index -= done.filter((p) => p < index).length;
                removed.push(pop(this.items, index))
                done.push(indices[i]);
            }

            return removed;
        };

        this.moveBefore = function(indices, index) {
            var items = this.remove(indices);
            index -= _.filter(indices, (i) => i < index).length;
            this.insertBefore(items, index);
        };

        this.moveAfter = function(indices, index) {
            this.moveBefore(indices, index + 1);
        };

        this.parentIndex = function(index) {
            return -1;
        };

        this.childIndex = function(index) {
            return -1;
        };

        this.canDrop = function(data) {
            return false;
        };

        this.drag = function(index) {
            return null;
        };

        this.drop = function(data, index) {};

        this.setFocus = function(index) {
            _.forEach(this.items, function(item, i) {
                item.focus = i === index;
            });
            this.getElements()[index].focus();
        };

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
                clipboard = _.map(store.getSelection(), (i) => store.items[i]);
                _.forEach(clipboard, function(item) {
                    item.focus = false;
                    item.selected = false;
                });
            } else if (event.keyCode == 86 && event.ctrlKey) {  // ctrl-v
                event.preventDefault();
                if (clipboard) {
                    store.insertAfter(_.map(clipboard, (i) => _.clone(i)), index);
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
            // FIXME: focus expander
            var root = event.currentTarget;
            var previous = event.relatedTarget;

            if (!muu.$.isDescendant(previous, root)) {
                var elements = store.getElements();
                var index = _.indexOf(elements, event.target);

                if (index === -1) {
                    index = _.findIndex(store.items, 'focus');
                }
                if (index === -1) {
                    index = 0;
                }

                if (index < elements.length) {
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


    window.TreeStore = TreeStore;
    window.treeView = treeView;
})(window, void 0, muu, _);
