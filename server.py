from fakes import Fakes

app = Fakes(__name__)


@app.route("/")
def hello(request):
    return app.render_template('index.html')


if __name__ == "__main__":
    app.run()
