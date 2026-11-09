"""Fetch a pinned public model, verify it, never call a hosted inference service."""
import hashlib
from pathlib import Path
import urllib.request
from server import MODEL, MODEL_SHA256

if not MODEL.exists() or hashlib.sha256(MODEL.read_bytes()).hexdigest() != MODEL_SHA256:
    data = urllib.request.urlopen('https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/87416418657359cb625c412a48b6e1d6d41c29bd/por.traineddata', timeout=60).read()
    if hashlib.sha256(data).hexdigest() != MODEL_SHA256:
        raise RuntimeError('Checksum inválido')
    MODEL.parent.mkdir(parents=True, exist_ok=True)
    temporary = MODEL.with_suffix('.download')
    temporary.write_bytes(data)
    temporary.replace(MODEL)
print('Modelo por verificado (Apache-2.0). Tesseract 5 deve estar instalado no sistema.')
