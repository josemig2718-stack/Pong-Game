"""
Servidor de desarrollo sin caché.

    python tests/serve.py          # http://127.0.0.1:8000
    python tests/serve.py 9000     # otro puerto

`python -m http.server` no envía cabeceras de caché y el navegador aplica
caché heurística: tras editar un archivo puede seguir sirviendo la versión
anterior, y los tests pasarían midiendo código viejo. Este servidor responde
siempre con `Cache-Control: no-store` y fuerza el tipo MIME de los .js (en
algunos Windows el registro los asocia a text/plain y los módulos no cargan).
"""
import functools
import http.server
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        '.js': 'text/javascript',
        '.mjs': 'text/javascript',
        '.json': 'application/json',
    }

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def log_message(self, *args):
        pass  # sin ruido en la consola


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    handler = functools.partial(NoCacheHandler, directory=str(ROOT))
    with http.server.ThreadingHTTPServer(('127.0.0.1', port), handler) as server:
        print(f'Sirviendo {ROOT} en http://127.0.0.1:{port} (sin caché)')
        server.serve_forever()


if __name__ == '__main__':
    main()
