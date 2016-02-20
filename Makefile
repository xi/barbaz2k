static/foobar.css: src/foobar.less
	lessc $< > $@
