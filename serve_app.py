from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import os
import sys
from datetime import datetime


ROOT = Path(__file__).resolve().parent
HOST = "0.0.0.0"
PORT = int(os.environ.get("PORT", "4173"))


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        line = f"{datetime.now().isoformat(timespec='seconds')} {self.client_address[0]} {self.path} {format % args}\n"
        with (ROOT / "server-access.log").open("a", encoding="utf-8") as log:
            log.write(line)


def main():
    os.chdir(ROOT)
    log_path = ROOT / "server-status.txt"
    with ThreadingHTTPServer((HOST, PORT), QuietHandler) as server:
        log_path.write_text(
            f"Server attivo su http://127.0.0.1:{PORT}/ e rete locale porta {PORT}\n",
            encoding="utf-8",
        )
        server.serve_forever()


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        (ROOT / "server-status.txt").write_text(f"Errore server: {exc}\n", encoding="utf-8")
        sys.exit(1)
