"""Extract and validate actual architecture-specific EXE payloads, without installing."""
import hashlib
import json
import pathlib
import struct
import subprocess

root = pathlib.Path(__file__).resolve().parents[2]
out = root / 'outputs/testing/w7-release'
seven = next((pathlib.Path.home() / 'AppData/Local/electron-builder/Cache/7zip@1.0.0').rglob('7za.exe'))
results = []
for arch in ['x64', 'arm64']:
    for form in ['setup', 'portable']:
        archive = root / f'outputs/w7-release/红果短剧-1.0.0-{arch}-{form}.exe'
        dest = out / f'payload-{arch}-{form}'
        dest.mkdir(parents=True, exist_ok=True)
        args = [str(seven), 'x', str(archive), '-y', '-r', '-o' + str(dest),
                'resources\\hongguotv\\shared\\content-core\\hongguo.js',
                'resources\\hongguotv\\shared\\listen-port.mjs',
                'resources\\hongguotv\\runtime\\node.exe',
                'resources\\app\\electron\\main.cjs', 'resources\\app\\electron\\preload.cjs',
                'resources\\app\\dist\\*', '红果短剧.exe']
        result = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
        (out / f'extract-{arch}-{form}.log').write_bytes(result.stdout)
        # 7za returns warning 1 for signed / NSIS PE overlays, while extracting the embedded 7z successfully.
        assert result.returncode in [0, 1], result.stdout.decode(errors='replace')[-1000:]
        for rel in ['shared/content-core/hongguo.js', 'shared/listen-port.mjs']:
            assert (dest / 'resources/hongguotv' / rel).read_bytes() == (root / rel).read_bytes(), rel
        for name in ['main.cjs', 'preload.cjs']:
            assert (dest / 'resources/app/electron' / name).read_bytes() == (root / 'apps/web-pc/electron' / name).read_bytes()
        for f in (root / 'apps/web-pc/dist').rglob('*'):
            if f.is_file():
                assert (dest / 'resources/app/dist' / f.relative_to(root / 'apps/web-pc/dist')).read_bytes() == f.read_bytes()
        for binary in [dest / '红果短剧.exe', dest / 'resources/hongguotv/runtime/node.exe']:
            with binary.open('rb') as stream:
                stream.seek(0x3c)
                offset = struct.unpack('<I', stream.read(4))[0]
                stream.seek(offset + 4)
                assert struct.unpack('<H', stream.read(2))[0] == {'x64': 0x8664, 'arm64': 0xaa64}[arch]
        item = {'artifact': archive.name, 'actualEmbeddedPayloadVerified': True, 'engineMatchesSource': True, 'frontendMatchesSource': True, 'nativeArchitecture': arch}
        results.append(item)
        print(json.dumps(item, ensure_ascii=False), flush=True)
(out / 'installer-verification.json').write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
