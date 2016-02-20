all: static/foobar.css static/foobar.js

static/foobar.css: src/foobar.less
	lessc $< > $@

static/foobar.js: build/index.js build/tree.js build/lodash.js
	browserify $< -o $@

build/index.js: src/index.js build
	cp $< $@

build/tree.js: src/tree.js build
	cp $< $@

build/lodash.js: build
	lodash include=assign,clone,concat,filter,find,findIndex,flatten,forEach,indexOf,last,map,some,startsWith,sum -d -o build/lodash.js

build:
	mkdir build

node_modules: package.json
	npm install

clean:
	rm -rf node_modules
	rm -rf build
	rm -f static/foobar.css
	rm -f static/foobar.js
