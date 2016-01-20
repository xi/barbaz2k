import os

from fakes import Fakes, jsonify

MUSIC_DIR = os.path.expanduser('~/Musik')

app = Fakes(__name__)


@app.route('/')
def index_route(request):
    return app.render_template('index.html')


@app.route('/files.json')
def files_route(request):
    paths = []

    for dirpath, dirnames, filenames in os.walk(MUSIC_DIR, followlinks=True):
        for filename in filenames:
            if filename.split('.')[-1] in ['mp3', 'ogg', 'flac', 'm4a']:
                paths.append(os.path.join(dirpath, filename))

    tree = {}

    for path in paths:
        parts = path[len(MUSIC_DIR)+1:].split('/')
        head = tree

        for part in parts[:-1]:
            if part not in head:
                head[part] = {}
            head = head[part]

        head[parts[-1]] = path

    return jsonify(tree)


if __name__ == '__main__':
    app.run()
