from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import importlib.util
from urllib.parse import urlparse, parse_qs

skill = Path('/Users/yingpengwang/.codex/plugins/cache/openai-bundled/visualize/1.0.29/skills/visualize/scripts/render.py')
source = Path('/Users/yingpengwang/.codex/visualizations/2026/09/08/01a07ff3-7d05-7302-a5c6-8419182a3362/pantopus-next-stage.html')
spec = importlib.util.spec_from_file_location('visualize_renderer', skill)
renderer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(renderer)

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        args = parse_qs(urlparse(self.path).query)
        fragment = source.read_text()
        theme = args.get('theme', ['auto'])[0]
        if theme in ('light', 'dark'):
            fragment = fragment.replace('color-scheme: light dark', 'color-scheme: ' + theme)
        scene = args.get('scene', ['settling'])[0]
        scenes = {'empty': 'No home added', 'quiet': 'Quiet neighborhood'}
        if scene in scenes:
            fragment = fragment.replace("situation:'Settling in'", "situation:'" + scenes[scene] + "'")
        if args.get('labels') == ['branded']:
            fragment = fragment.replace("labels:'Plain language'", "labels:'Branded'")
        document = renderer._render_document(fragment, 'Pantopus design review')
        if theme in ('light', 'dark'):
            document = document.replace('color-scheme:light dark', 'color-scheme:' + theme)
        encoded = document.encode()
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_header('Content-Length', str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def log_message(self, *_):
        pass

print('http://127.0.0.1:8845/', flush=True)
ThreadingHTTPServer(('127.0.0.1', 8845), Handler).serve_forever()
