barbaz2k - web based audio player

barbaz2k is a simple web based audio player havily inspired by
[foobar2k](http://www.foobar2000.org/). However, it is an experiment and not
meant to be used in production.

# Architecture

The most interesting part about this project are the tree/listviews. These are
UI elements commonly seen in native applications, but not so much in web
applications. I wanted to see how easy it would be to implement a rich
application that makes heavy use of selection, keyboard navigation and drag and
drop.

So the biggest part of barbaz2k is implemented as client side JavaScript. There
is also some CSS with several available themes. Finally, there is a small
python server that takes care of reading audio meta data.

# installation

barbaz2k depends on python3, python3-venv and nodejs. Once these are installed,
running `make` should be sufficient to install all dependencies and compile all
files.

You can now start the server with `make run`. It will run on port 5000.
However, barbaz2k also needs to be able to access your audio files. This can
best be done by configuring a local nginx. See `example.nginx` for an example
configuration.

# configuration

## change color theme

In `static/src/barbaz.scss` edit the line `@import "colorschemes/foobar";`,
then run `make` again. Available colorschemes can be found in
`static/src/colorschemes/`.

## change music directory

Change the definition of `MUSIC_DIR` in `server.py`. Also adjust the nginx
configuration.
