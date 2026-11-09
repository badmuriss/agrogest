"""Loopback-only OCR. Tesseract decodes the actual image; no sample substitutions."""
import csv
import hashlib
import io
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
import threading
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROOT = Path(__file__).resolve().parent
MODEL = ROOT / '.models' / 'por.traineddata'
MODEL_SHA256 = 'c4932b937207a9514b7514d518b931a99938c02a28a5a5a553f8599ed58b7deb'
LIMIT = 8 * 1024 * 1024
SLOT = threading.BoundedSemaphore(1)


def fields_from_text(text):
    lines = [s.strip() for s in text.splitlines() if s.strip()]
    amount = None
    # Only labelled totals. A missing/ambiguous field stays null for human review.
    totals = []
    for line in lines:
        if re.search(r'\b(total|valor\s+(?:pago|final|a\s+pagar))\b', line, re.I) and not re.search(r'sub\s*total', line, re.I):
            values = re.findall(r'(?<!\d)(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})(?!\d)', line)
            if values:
                totals.append(int(values[-1].replace('.', '').replace(',', '')))
    if len(set(totals)) == 1:
        amount = totals[0]
    date = None
    match = re.search(r'\b(\d{2})[/.-](\d{2})[/.-](20\d{2})\b', text)
    if match:
        try:
            date = datetime.strptime('/'.join(match.groups()), '%d/%m/%Y').strftime('%Y-%m-%d')
        except ValueError:
            pass
    supplier = None
    for line in lines:
        match = re.match(r'(?:fornecedor|emitente|empresa)\s*[:\-]\s*(.+)', line, re.I)
        if match:
            supplier = match[1][:160]
            break
    if supplier is None and lines and not re.match(r'(nota|cupom|recibo|documento)\b', lines[0], re.I):
        supplier = lines[0][:160]
    description = None
    for line in lines:
        match = re.match(r'(?:descri[cç][aã]o|produto|servi[cç]o|item)\s*[:\-]\s*(.+)', line, re.I)
        if match:
            description = match[1][:240]
            break
    document = None
    match = re.search(r'(?:nota|recibo|documento)\s*(?:n[ºo°.]*)?\s*[:#\-]\s*([A-Z0-9/.-]+)', text, re.I)
    if match:
        document = match[1][:80]
    return dict(amountCents=amount, occurredAt=date, supplier=supplier, description=description, document=document)


def extract(data):
    if not (data.startswith(b'\x89PNG\r\n\x1a\n') or data.startswith(b'\xff\xd8\xff') or (data[:4] == b'RIFF' and data[8:12] == b'WEBP')):
        raise ValueError('Envie uma imagem PNG, JPEG ou WebP válida.')
    if not MODEL.exists() or hashlib.sha256(MODEL.read_bytes()).hexdigest() != MODEL_SHA256:
        raise ValueError('Modelo de português ausente ou inválido. Execute setup.py.')
    with tempfile.TemporaryDirectory(prefix='agrogest-ocr-') as tmp:
        path = Path(tmp) / 'document'
        path.write_bytes(data)
        # A timeout and a single processing slot bound CPU and memory pressure.
        result = subprocess.run(['tesseract', str(path), 'stdout', '--tessdata-dir', str(MODEL.parent), '-l', 'por', '--oem', '1', '--psm', '6', '-c', 'tessedit_create_tsv=1'], capture_output=True, timeout=35, env={**os.environ, 'OMP_THREAD_LIMIT': '2'})
        if result.returncode:
            raise ValueError('A imagem não pôde ser decodificada. Fotografe novamente.')
    words, groups = [], {}
    for row in csv.DictReader(io.StringIO(result.stdout.decode('utf-8')), delimiter='\t'):
        word = (row.get('text') or '').strip()
        if not word:
            continue
        confidence = float(row['conf']) / 100
        words.append(dict(text=word, confidence=round(max(0, confidence), 3), box=[int(row[k]) for k in ('left', 'top', 'width', 'height')]))
        key = tuple(row[k] for k in ('page_num', 'block_num', 'par_num', 'line_num'))
        groups.setdefault(key, []).append(word)
    text = '\n'.join(' '.join(items) for items in groups.values())
    fields = fields_from_text(text)
    warnings = ['Revise os campos e a imagem antes de registrar. OCR pode errar.']
    if not text:
        warnings.append('Nenhum texto legível encontrado.')
    for key, label in [('amountCents', 'valor total'), ('occurredAt', 'data'), ('supplier', 'fornecedor'), ('description', 'descrição')]:
        if fields[key] is None:
            warnings.append(f'Não foi possível identificar {label}. Preencha manualmente.')
    return dict(fields=fields, text=text[:24000], words=words[:2500], warnings=warnings, provider='local', model='tesseract-5/por-tessdata_fast@8741641', modelSha256=MODEL_SHA256, confidence=round(sum(w['confidence'] for w in words) / max(len(words), 1), 3))


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass  # Documents, identities and credentials must never appear in access logs.

    def send_json(self, status, value):
        body = json.dumps(value, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        self.send_json(200 if self.path == '/health' else 404, {'ok': self.path == '/health', 'provider': 'local', 'modelInstalled': MODEL.exists()})

    def do_POST(self):
        if self.path != '/extract':
            return self.send_json(404, {'error': 'Rota inválida.'})
        if self.headers.get('Origin'):
            return self.send_json(403, {'error': 'Use o backend autenticado.'})
        try:
            length = int(self.headers.get('Content-Length', '0'))
        except ValueError:
            length = 0
        if not 0 < length <= LIMIT:
            return self.send_json(413, {'error': 'Imagem vazia ou maior que 8 MiB.'})
        if not SLOT.acquire(blocking=False):
            return self.send_json(429, {'error': 'OCR ocupado. Tente novamente.'})
        try:
            self.send_json(200, extract(self.rfile.read(length)))
        except (ValueError, subprocess.TimeoutExpired) as error:
            self.send_json(422, {'error': str(error) if isinstance(error, ValueError) else 'Tempo de leitura excedido. Recorte a imagem e tente novamente.'})
        finally:
            SLOT.release()


if __name__ == '__main__':
    print('OCR local em http://127.0.0.1:8091 (Tesseract/português)', flush=True)
    ThreadingHTTPServer(('127.0.0.1', int(os.environ.get('AGROGEST_OCR_PORT', '8091'))), Handler).serve_forever()
