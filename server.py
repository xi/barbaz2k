import os

from fakes import Fakes, jsonify
import mutagen

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


def find_album_art(path):
    d = os.path.dirname(path)
    candidates = os.listdir(d)

    for filename in candidates:
        if filename.startswith('AlbumArt'):
            return os.path.join(d, filename)
    for filename in candidates:
        if filename[-3:].lower() in ['jpg', 'gif', 'png']:
            return os.path.join(d, filename)


@app.route('/info.json')
def info_route(request):
    path = request.GET['path']

    metadata = mutagen.File(path, easy=True)
    get = lambda key: metadata.get(key, [None])[0]

    metadata = {
        'artist': get('artist'),
        'album': get('album'),
        'tracknumber': get('tracknumber'),
        'title': get('title'),
        'art': find_album_art(path),
    }
    return jsonify(metadata)


if __name__ == '__main__':
    app.run()
