var _ = require('./lodash');

var tree = require('./tree');


var TreeNode = function(path) {
    // FIXME select=false on collapse
    this.dirs = [];
    this.files = [];

    this.state = {
        dir: true,
        path: path,
        title: _.last(path.split('/')),
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

    this.asList = function(q, ignoreExpanded) {
        var list = [];
        _.forEach(this.getDirs(q), function(dir) {
            list.push(dir.state);
            if (dir.state.expanded || ignoreExpanded) {
                list = _.concat(list, dir.asList(q));
            }
        });
        return _.concat(list, this.getFiles(q));
    };

    this.asTree = function(q) {
        this.state.dirs =  _.map(this.getDirs(q), function(dir) {
            return dir.asTree(q);
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
        var _parts = [''];

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
            focus: false,
        });
    });

    return tree;
};

var FileStore = function(files) {
    var self = this;

    self.items = [];
    self.hasFocus = false;
    self.tree = createTree(files);
    self.defaultExpanded = false;

    self.parentIndex = function(index) {
        var item = self.items[index];
        return _.findIndex(self.items, function(i) {
            return _.indexOf(i.dirs, item) !== -1 || _.indexOf(i.files, item) !== -1;
        });
    };

    self.childIndex = function(index) {
        var item = self.items[index];
        var childItem = item.dirs[0] || item.files[0];
        return _.indexOf(self.items, childItem);
    };

    self.drag = function(index) {
        var selection = self.getSelection();
        return {
            origin: 'filelist',
            uris: _.map(selection, function(i) {
                return self.items[i].path;
            }),
        };
    };

    self.updateExpanded = function(q) {
        // NOTE: there may be some better heuristic
        self.defaultExpanded = q.length > 3;

        var items = self.tree.asList(null, true);
        _.forEach(items, function(item) {
            if (item.dir) {
                if (item._expanded === void 0) {
                    item.expanded = self.defaultExpanded;
                } else {
                    item.expanded = item._expanded;
                }
            }
        });
    };

    self.toggle = function(index, state) {
        var item = self.items[index];
        if (state === void 0) {
            state = !item.expanded;
        }
        if (state === self.defaultExpanded) {
            item._expanded = void 0;
        } else {
            item._expanded = state;
        }
        self.update();
    };
};
FileStore.prototype = new tree.TreeStore();

module.exports = FileStore;
