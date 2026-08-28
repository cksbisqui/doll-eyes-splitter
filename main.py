import os
import sys
import http.server
import socketserver
import threading
import webbrowser
import time

# Determine the directory where assets are hosted.
# When running as a PyInstaller bundle, files are extracted to the sys._MEIPASS temp directory.
if getattr(sys, 'frozen', False):
    base_dir = sys._MEIPASS
else:
    base_dir = os.path.dirname(os.path.abspath(__file__))

def find_free_port():
    import socket
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('', 0))
        return s.getsockname()[1]

class SafeHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=base_dir, **kwargs)

    # Disable logging requests to console to keep it clean
    def log_message(self, format, *args):
        pass

def start_server(port):
    handler = SafeHTTPRequestHandler
    with socketserver.TCPServer(("", port), handler) as httpd:
        httpd.serve_forever()

def main():
    port = find_free_port()
    
    # Start server in a background daemon thread
    server_thread = threading.Thread(target=start_server, args=(port,), daemon=True)
    server_thread.start()
    
    # Allow server a moment to bind, then launch browser
    time.sleep(0.5)
    webbrowser.open(f"http://localhost:{port}")
    
    print("=========================================================", flush=True)
    print("      [+]  DOLL EYES SPLITTER & BACKGROUND REMOVER  [+]", flush=True)
    print("=========================================================", flush=True)
    print(f" Application is running on: http://localhost:{port}", flush=True)
    print(" The browser tab should have opened automatically.", flush=True)
    print(" ", flush=True)
    print(" NOTE: Keep this window open while using the app.", flush=True)
    print(" Close this window or press Ctrl+C here to exit.", flush=True)
    print("=========================================================", flush=True)
    
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nExiting Doll Eyes Splitter. Goodbye!", flush=True)

if __name__ == '__main__':
    main()
