import http.server
import socketserver
import os
import re
import shutil

PORT = 8000

class ThreadedTCPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    daemon_threads = True
    allow_reuse_address = True

class RangeRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Desativa cache agressivamente para tudo enquanto estamos desenvolvendo
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        # Habilitar CORS para o painel admin e outros casos
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

    def do_GET(self):
        """ Sobrescreve para lidar com Range e ignorar erros de conexão resetada """
        try:
            range_header = self.headers.get('Range')
            if not range_header or not self.path_exists_as_file():
                return super().do_GET()
            
            # Se for Range, processamos aqui para enviar apenas os bytes necessários
            self.handle_range_get(range_header)
        except (ConnectionResetError, BrokenPipeError):
            # Erros comuns quando o browser dá refresh ou fecha a aba durante o stream
            pass
        except Exception as e:
            print(f"ERRO NO SERVIDOR: {e}")

    def path_exists_as_file(self):
        path = self.translate_path(self.path)
        return os.path.isfile(path)

    def handle_range_get(self, range_header):
        path = self.translate_path(self.path)
        size = os.path.getsize(path)
        
        range_match = re.match(r'bytes=(\d+)-(\d+)?', range_header)
        if not range_match:
            return super().do_GET()

        start = int(range_match.group(1))
        end = range_match.group(2)
        end = int(end) if end else size - 1

        if start >= size:
            self.send_error(416, 'Requested Range Not Satisfiable')
            return

        self.send_response(206)
        self.send_header('Content-Type', self.guess_type(path))
        self.send_header('Content-Range', f'bytes {start}-{end}/{size}')
        self.send_header('Content-Length', str(end - start + 1))
        self.send_header('Accept-Ranges', 'bytes')
        self.end_headers()

        with open(path, 'rb') as f:
            f.seek(start)
            remaining = end - start + 1
            buffer_size = 64 * 1024 # 64KB chunks
            while remaining > 0:
                chunk_size = min(remaining, buffer_size)
                data = f.read(chunk_size)
                if not data:
                    break
                self.wfile.write(data)
                remaining -= len(data)

    def do_POST(self):
        """ Handles saving the config.json file from the admin panel. """
        if self.path == '/save-config':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                # Salva os dados recebidos no arquivo config.json
                with open('config.json', 'wb') as f:
                    f.write(post_data)
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(b'{"status": "success"}')
                print("LOG: Configurações (config.json) atualizadas via Admin.")
            except Exception as e:
                self.send_error(500, str(e))
        else:
            self.send_error(404)

if __name__ == "__main__":
    try:
        with ThreadedTCPServer(("", PORT), RangeRequestHandler) as httpd:
            print(f"BhaskaraTV Multi-Threaded Server rodando em http://localhost:{PORT}")
            print("Suporte a Seek e Pre-buffering OTIMIZADO.")
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor encerrado.")
