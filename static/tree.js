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
// FIXME: cleanup position/index

var TreeStore = function() {};

TreeStore.prototype.clear = function() {
    this.items = [];
};

TreeStore.prototype.insertBefore = function(items, position) {
    this.items.splice.apply(this.items, [position, 0].concat(items));
};

TreeStore.prototype.insertAfter = function(items, position) {
    this.insertBefore(items, position + 1);
};

TreeStore.prototype.append = function(items) {
    this.insertAfter(items, this.items.length - 1);
};

TreeStore.prototype.remove = function(positions) {
    var pop = function(arr, i) {
        return arr.splice(i, 1)[0];
    };

    var done = [];
    var removed = [];

    for (var i = 0; i < positions.length; i++) {
        var position = positions[i];
        position -= done.filter((p) => p < position).length;
        removed.push(pop(this.items, position))
        done.push(positions[i]);
    }

    return removed;
};

TreeStore.prototype.moveBefore = function(positions, position) {
    var items = this.remove(positions);
    position -= _.filter(positions, (p) => p < position).length;
    this.insertBefore(items, position);
};

TreeStore.prototype.moveAfter = function(positions, position) {
    this.moveBefore(positions, position + 1);
};

TreeStore.prototype.parentIndex = function(index) {
    return -1;
};

TreeStore.prototype.childIndex = function(index) {
    return -1;
};

TreeStore.prototype.canDrop = function(dragDropData) {
    return false;
};

TreeStore.prototype.setFocus = function(position) {
    _.forEach(this.items, function(item, p) {
        item.focus = p === position;
    });
    this.getElements()[position].focus();
};


var treeView = function(self, element, store) {
    store.update();

    var initialShiftIndex = null;

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
        }
        store.update();

        var selection = _.reduce(store.items, function(result, item, i) {
            if (item.selected) {
                result.push(i);
            }
            return result;
        }, []);
        window.dragDropData = {
            action: 'move',
            items: selection,
        };
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
            var data = window.dragDropData;

            if (data.action = 'move') {
                store.moveBefore(data.items, index);
            } else {
                store.insertBefore(data.items, index);
            }

            store.update();
        }
    });

    self.on('dragend', function(event) {
        // FIXME: not executed
        window.dragDropData = null;

        _.forEach(store.getElements(), function(el, i) {
            el.classList.remove('drop-below');
            el.classList.remove('drop-above');
        });
    });
};
