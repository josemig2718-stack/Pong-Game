"""
Servidor de desarrollo sin caché.

    python tests/serve.py          # http://127.0.0.1:8000
    python tests/serve.py 9000     # otro puerto

`python -m http.server` no envía cabeceras de caché y el navegador aplica
caché heurística: tras editar un archivo puede seguir sirviendo la versión
anterior, y los tests pasarían midiendo código viejo. Este servidor responde
siempre con `Cache-Control: no-store` y fuerza el tipo MIME de los .js (en
algunos Windows el registro los asocia a text/plain). Además sirve en
/tests/js-files la lista de scripts de js/, que usa tests/lib/scripts.js.

Para jugar no hace falta: basta abrir index.html.
"""
import functools
import http.server
import json
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

    def do_GET(self):
        # Lista de los scripts de js/, para que los tests comprueben que
        # index.html los carga todos (ver tests/lib/scripts.js).
        if self.path.split('?')[0] == '/tests/js-files':
            files = sorted(p.relative_to(ROOT).as_posix() for p in (ROOT / 'js').rglob('*.js'))
            body = json.dumps(files).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()

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
