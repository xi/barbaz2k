all: static/barbaz.css static/barbaz.min.js

run: all
	. .env/bin/activate && python server.py

static/barbaz.css: static/src/barbaz.scss static/src/contrast.scss static/src/math.scss static/src/colorschemes/*.scss .env
	. .env/bin/activate && node-sass $< $@

static/barbaz.min.js: static/barbaz.js .env
	. .env/bin/activate && cd static && uglifyjs --source-map barbaz.js.map barbaz.js -o barbaz.min.js

static/barbaz.js: static/src/index.js static/src/tree.js static/src/filestore.js static/src/playlist.js static/src/lodash.js .env
	. .env/bin/activate && browserify $< -o $@

static/src/lodash.js: .env
	. .env/bin/activate && lodash include=assign,clone,concat,filter,find,findIndex,flatten,forEach,indexOf,last,map,some,startsWith,sum -d -o $@

.env:
	python3 -m venv .env
	. .env/bin/activate && pip install fakes mutagen audioread
	. .env/bin/activate && pip install nodeenv
	echo lodash-cli > node_deps
	echo browserify >> node_deps
	echo uglifyjs >> node_deps
	echo node-sass >> node_deps
	echo mustache >> node_deps
	echo xi/muu >> node_deps
	echo wildlyinaccurate/promise-xhr >> node_deps
	. .env/bin/activate && nodeenv -p --node=system -r node_deps
	rm node_deps

clean-dev:
	rm -rf .env
	rm -f static/src/lodash.js

clean-prod:
	rm -f static/barbaz.css
	rm -f static/barbaz.js
	rm -f static/barbaz.js.map
	rm -f static/barbaz.min.js

clean: clean-dev clean-prod
