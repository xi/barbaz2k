import os

from fakes import Fakes, jsonify
import mutagen
import audioread

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
                paths.append(os.path.join(dirpath, filename)[len(MUSIC_DIR):])

    return jsonify(sorted(paths))


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
    path = os.path.join(MUSIC_DIR, request.GET['path'][1:])

    metadata = mutagen.File(path, easy=True)
    get = lambda key: metadata.get(key, [None])[0]

    with audioread.audio_open(path) as fh:
        metadata = {
            'artist': get('artist'),
            'album': get('album'),
            'tracknumber': get('tracknumber'),
            'title': get('title'),
            'art': find_album_art(path),
            'duration': '{}:{:02}'.format(int(fh.duration / 60), int(fh.duration % 60)),
            'path': request.GET['path'],
        }
        return jsonify(metadata)


app.app.router.add_static('/proxy/', MUSIC_DIR)


if __name__ == '__main__':
    app.run()
