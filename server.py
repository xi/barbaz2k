import os
import re

from fakes import Fakes, jsonify
import mutagen
import audioread

MUSIC_DIR = os.path.expanduser('~/Musik')

app = Fakes(__name__)


def human_key(s):
    # https://stackoverflow.com/questions/4836710/#answer-16090640
    parts = re.split('(\d+)', s)
    return [int(t) if t.isnumeric() else t.lower() for t in parts]


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

    return jsonify(sorted(paths, key=human_key))


def find_album_art(path):
    d = os.path.dirname(path)
    candidates = os.listdir(d)

    for filename in candidates:
        if filename.startswith('AlbumArt'):
            return os.path.join(d, filename)[len(MUSIC_DIR):]
    for filename in candidates:
        if filename[-3:].lower() in ['jpg', 'gif', 'png']:
            return os.path.join(d, filename)[len(MUSIC_DIR):]


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
            'title': get('title') or os.path.basename(path),
            'art': find_album_art(path),
            'duration_raw': fh.duration,
            'duration': '{}:{:02}'.format(int(fh.duration / 60), int(fh.duration % 60)),
            'path': request.GET['path'],
        }
        return jsonify(metadata)


if __name__ == '__main__':
    app.run()
