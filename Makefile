run: all
	. .env/bin/activate && python server.py

all: static/foobar.css static/foobar.js

static/foobar.css: src/foobar.less .env
	. .env/bin/activate && lessc $< > $@

static/foobar.js: build/index.js build/tree.js build/filestore.js build/playlist.js build/lodash.js .env
	. .env/bin/activate && browserify $< -o $@

build/%.js: src/%.js build
	cp $< $@

build/lodash.js: build .env
	. .env/bin/activate && lodash include=assign,clone,concat,filter,find,findIndex,flatten,forEach,indexOf,last,map,some,startsWith,sum -d -o build/lodash.js

build:
	mkdir build

.env:
	virtualenv -p python3 .env
	. .env/bin/activate && pip install nodeenv
	. .env/bin/activate && nodeenv -p --node=system
	. .env/bin/activate && pip install fakes mutagen audioread
	. .env/bin/activate && npm install lodash-cli mustache xi/muu wildlyinaccurate/promise-xhr

clean:
	rm -rf .env
	rm -rf build
	rm -f static/foobar.css
	rm -f static/foobar.js
