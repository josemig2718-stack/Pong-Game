"""
Servidor de desarrollo sin caché.

    python tools/serve.py          # http://127.0.0.1:8000
    python tools/serve.py 9000     # otro puerto

`python -m http.server` no envía cabeceras de caché y el navegador aplica
caché heurística: tras editar un archivo puede seguir sirviendo la versión
anterior, y lo que se comprueba sería código viejo. Este servidor responde
siempre con `Cache-Control: no-store` y fuerza el tipo MIME de los .js (en
algunos Windows el registro los asocia a text/plain).

Para jugar no hace falta: basta abrir index.html.
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


class Server(http.server.ThreadingHTTPServer):
    # index.html pide ~50 scripts a la vez: con la cola por defecto (5),
    # Windows rechaza conexiones y algún script no llega a cargarse.
    request_queue_size = 256


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    handler = functools.partial(NoCacheHandler, directory=str(ROOT))
    with Server(('127.0.0.1', port), handler) as server:
        print(f'Sirviendo {ROOT} en http://127.0.0.1:{port} (sin caché)')
        server.serve_forever()


if __name__ == '__main__':
    main()
