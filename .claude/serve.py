import http.server, socketserver, functools

DIRECTORY = "/Users/juan/Desktop/FACULTAD/COMPOSICION DIGITAL/tp_claude/web"
PORT = 8753

Handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=DIRECTORY)

with socketserver.TCPServer(("127.0.0.1", PORT), Handler) as httpd:
    print(f"serving {DIRECTORY} on http://127.0.0.1:{PORT}")
    httpd.serve_forever()
