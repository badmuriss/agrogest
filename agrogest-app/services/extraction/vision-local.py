"""Pinned optional local VLM. Downloads public artifacts only during explicit setup."""
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
import os
from pathlib import Path
import platform
import re
import secrets
import subprocess
import sys
import tarfile
import urllib.request

ROOT = Path(__file__).resolve().parent
APP = ROOT.parents[1]
STATE = APP / '.local' / 'vision'
MANIFEST = json.loads((ROOT / 'vision-model.json').read_text())


def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def download(item):
    path = STATE / item['name']
    if path.is_file() and digest(path) == item['sha256']:
        return path
    temporary = path.with_suffix(path.suffix + '.download')
    print(f"Obtendo artefato público: {item['name']}", flush=True)
    with urllib.request.urlopen(item['url'], timeout=120) as source, temporary.open('wb') as target:
        while chunk := source.read(1024 * 1024):
            target.write(chunk)
    if digest(temporary) != item['sha256']:
        raise RuntimeError(f"Checksum inválido: {item['name']}")
    temporary.replace(path)
    return path


def setup():
    STATE.mkdir(parents=True, exist_ok=True)
    with ThreadPoolExecutor(max_workers=3) as pool:
        paths = list(pool.map(download, MANIFEST['files']))
    runtime = STATE / 'runtime'
    runtime.mkdir(exist_ok=True)
    for path in paths:
        if path.name.endswith('.tar.gz'):
            with tarfile.open(path) as archive:
                archive.extractall(runtime, filter='data')
    token_file = STATE / 'api-key'
    if not token_file.exists():
        token_file.write_text(secrets.token_urlsafe(32))
        token_file.chmod(0o600)
    # Change only this provider's settings; never discard existing private config.
    private = APP / 'apps' / 'api' / '.dev.vars'
    lines = private.read_text().splitlines() if private.exists() else []
    updates = {'INFERENCE_PROVIDER': 'local-vision', 'INFERENCE_REMOTE_ALLOWED': 'false', 'LOCAL_VISION_BASE_URL': 'http://127.0.0.1:8092', 'LOCAL_VISION_MODEL': 'agrogest-vision', 'LOCAL_VISION_REVISION': MANIFEST['model'] + '@' + MANIFEST['revision'], 'LOCAL_VISION_API_KEY': token_file.read_text().strip()}
    lines = [line for line in lines if line.partition('=')[0].strip() not in updates]
    private.write_text('\n'.join([*lines, *(f'{key}={value}' for key, value in updates.items())]) + '\n')
    private.chmod(0o600)
    print('IA visual local verificada. Configuração privada preservada/atualizada; nenhuma chave foi exibida.', flush=True)


def serve():
    binary = next((STATE / 'runtime').rglob('llama-server'), None) if (STATE / 'runtime').exists() else None
    if binary is None or not (STATE / 'api-key').is_file():
        raise RuntimeError('Execute npm run setup:vision antes de iniciar a IA visual.')
    for item in MANIFEST['files'][:2]:
        if not (STATE / item['name']).is_file() or digest(STATE / item['name']) != item['sha256']:
            raise RuntimeError('Modelo ausente/inválido. Execute npm run setup:vision.')
    libraries = [str(binary.parent), *(str(path.parent) for path in (STATE / 'runtime').rglob('libcudart.so.12'))]
    env = {**os.environ, 'LD_LIBRARY_PATH': ':'.join([*libraries, os.environ.get('LD_LIBRARY_PATH', '')])}
    if os.environ.get('AGROGEST_VISION_GPU_LAYERS', '99') != '0':
        devices = subprocess.run([str(binary), '--list-devices'], env=env, capture_output=True, timeout=15)
        if devices.returncode != 0 or not re.search(rb'^\s*CUDA\d+:\s+\S', devices.stdout, re.M):
            raise RuntimeError('CUDA local indisponível. Corrija o driver ou selecione explicitamente AGROGEST_VISION_GPU_LAYERS=0 para CPU.')
    args = [str(binary), '-m', str(STATE / MANIFEST['files'][0]['name']), '--mmproj', str(STATE / MANIFEST['files'][1]['name']), '--host', '127.0.0.1', '--port', '8092', '--alias', 'agrogest-vision', '--ctx-size', '8192', '--n-gpu-layers', os.environ.get('AGROGEST_VISION_GPU_LAYERS', '99'), '--parallel', '1', '--threads', '4', '--jinja', '--no-webui', '--log-disable', '--api-key-file', str(STATE / 'api-key')]
    if os.environ.get('AGROGEST_VISION_GPU_LAYERS', '99') == '0':
        args.append('--no-mmproj-offload')
    print('IA visual local em http://127.0.0.1:8092; imagem → campos, sem inferência hospedada.', flush=True)
    os.execve(binary, args, env)


if __name__ == '__main__':
    if sys.version_info < (3, 12) or platform.system() != 'Linux' or platform.machine() != 'x86_64':
        raise SystemExit('Este launcher opcional requer Linux x86_64 e Python 3.12+. Outros ambientes: configurar servidor local compatível ou OpenRouter.')
    try:
        if sys.argv[1:] == ['setup']:
            setup()
        elif sys.argv[1:] == ['serve']:
            serve()
        else:
            raise ValueError('Use setup ou serve.')
    except Exception as error:
        raise SystemExit(str(error))
