all: static/barbaz.css static/barbaz.min.js

run: all
	. .env/bin/activate && python server.py

static/barbaz.css: static/src/barbaz.scss static/src/contrast.scss static/src/math.scss static/src/colorschemes/*.scss .env
	. .env/bin/activate && node-sass $< $@

static/barbaz.min.js: static/barbaz.js .env
	. .env/bin/activate && cd static && uglifyjs --source-map barbaz.js.map barbaz.js -o barbaz.min.js

static/barbaz.js: static/src/index.js static/src/tree.js static/src/filestore.js static/src/playlist.js static/src/lodash.js .env
	. .env/bin/activate && browserify -r ./static/src/lodash.js:lodash $< -o $@

static/src/lodash.js: .env
	. .env/bin/activate && lodash include=assign,clone,concat,filter,find,findIndex,flatten,forEach,indexOf,last,map,some,startsWith,sum,union,difference,isArray,isFunction,isString,once -d -o $@

.env: node_requirements
	python3 -m venv .env
	. .env/bin/activate && pip install fakes mutagen audioread
	. .env/bin/activate && pip install nodeenv
	. .env/bin/activate && nodeenv -p --node=system -r node_requirements

clean-dev:
	rm -rf .env
	rm -f static/src/lodash.js

clean-prod:
	rm -f static/barbaz.css
	rm -f static/barbaz.js
	rm -f static/barbaz.js.map
	rm -f static/barbaz.min.js

clean: clean-dev clean-prod
