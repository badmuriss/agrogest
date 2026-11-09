# CPU image: no CUDA, GPU runtime or hosted inference service.
FROM python:3.14-slim-bookworm@sha256:3fe1a0b6c2d6b2ebb572906cdabeca75aeb558c0c17db5ffefbcf8094871c32b AS base
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 OMP_THREAD_LIMIT=2
RUN apt-get update \
    && apt-get install -y --no-install-recommends tesseract-ocr=5.3.0-2 \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app/services/extraction
COPY services/extraction/server.py services/extraction/setup.py ./
# Model and license are fetched at build time from a fixed public revision.
# setup.py verifies the model's SHA-256. Runtime never downloads weights.
RUN python setup.py \
    && python -c "import urllib.request; from pathlib import Path; Path('.models/LICENSE.txt').write_bytes(urllib.request.urlopen('https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/87416418657359cb625c412a48b6e1d6d41c29bd/LICENSE', timeout=60).read())"
USER 10001:10001

FROM base AS test
COPY services/extraction/test_extraction.py ./
COPY tests/fixtures/comprovante-gs-001.png tests/fixtures/comprovante-gs-002.png /app/tests/fixtures/
CMD ["python", "-m", "unittest", "discover", "-p", "test_*.py", "-v"]

FROM base AS runtime
ENV AGROGEST_OCR_HOST=0.0.0.0 AGROGEST_OCR_PORT=8091
EXPOSE 8091
HEALTHCHECK --interval=3s --timeout=3s --start-period=3s --retries=5 \
    CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8091/health', timeout=2).read()"]
CMD ["python", "server.py"]
