"""Read-only validation of W7 archive contents and unpacked Windows apps."""
import hashlib
import json
import pathlib
import struct
import tarfile
import zipfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
EVIDENCE = ROOT / 'outputs/testing/w7-release'
PLATFORMS = ['win-x64', 'win-arm64', 'darwin-x64', 'darwin-arm64', 'linux-x64', 'linux-arm64']
engine = (ROOT / 'shared/content-core/hongguo.js').read_bytes()
assert b'deviceEntropy' in engine and b'typeof crypto.randomBytes' in engine
assert b'1905892595378490' not in engine


def pe_machine(data):
    return struct.unpack_from('<H', data, struct.unpack_from('<I', data, 0x3c)[0] + 4)[0]


def check_runtime(platform, data):
    arch = platform.split('-')[1]
    if platform.startswith('win-'):
        assert pe_machine(data) == {'x64': 0x8664, 'arm64': 0xaa64}[arch]
    elif platform.startswith('linux-'):
        assert data[:4] == b'\x7fELF'
        assert struct.unpack_from('<H', data, 18)[0] == {'x64': 62, 'arm64': 183}[arch]
    else:
        assert data[:4] == b'\xcf\xfa\xed\xfe'
        assert struct.unpack_from('<I', data, 4)[0] == {'x64': 0x1000007, 'arm64': 0x100000c}[arch]


def verify_content(read, platform):
    assert read('shared/content-core/hongguo.js') == engine
    assert read('shared/listen-port.mjs') == (ROOT / 'shared/listen-port.mjs').read_bytes()
    assert read('custom-server/index.mjs') == (ROOT / 'custom-server/index.mjs').read_bytes()
    frontend = b''
    for file in (ROOT / 'apps/web-pc/dist').rglob('*'):
        if file.is_file():
            rel = file.relative_to(ROOT / 'apps/web-pc/dist').as_posix()
            content = read('apps/web-pc/dist/' + rel)
            assert content == file.read_bytes(), rel
            if file.suffix == '.js':
                frontend += content
    assert '退出全屏'.encode() in frontend and '滚轮'.encode() in frontend
    check_runtime(platform, read('runtime/node.exe' if platform.startswith('win-') else 'runtime/node'))
    assert read('README.txt')


results = []
for platform in PLATFORMS:
    prefix = 'hongguotv-web-' + platform
    file = ROOT / 'outputs/bundles' / (prefix + ('.zip' if platform.startswith('win-') else '.tar.gz'))
    if file.suffix == '.zip':
        with zipfile.ZipFile(file) as archive:
            mapping = {n.replace('\\', '/'): n for n in archive.namelist()}
            verify_content(lambda rel: archive.read(mapping[prefix + '/' + rel]), platform)
    else:
        with tarfile.open(file) as archive:
            verify_content(lambda rel: archive.extractfile(prefix + '/' + rel).read(), platform)
            for rel in ['runtime/node', 'start.sh', 'stop.sh']:
                assert archive.getmember(prefix + '/' + rel).mode & 0o111, rel
    item = {'platform': platform, 'archive': file.name, 'engineMatchesSource': True, 'frontendMatchesSource': True, 'runtimeArchitecture': True, 'listenPort': True}
    results.append(item)
    print(json.dumps(item, ensure_ascii=False))

for arch, directory in [('x64', 'win-unpacked'), ('arm64', 'win-arm64-unpacked')]:
    folder = ROOT / 'outputs/w7-release' / directory
    resources = folder / 'resources'
    verify_content(lambda rel: (resources / 'hongguotv' / rel).read_bytes(), 'win-' + arch)
    assert pe_machine((folder / '红果短剧.exe').read_bytes()) == {'x64': 0x8664, 'arm64': 0xaa64}[arch]
    for name in ['main.cjs', 'preload.cjs']:
        assert (resources / 'app/electron' / name).read_bytes() == (ROOT / 'apps/web-pc/electron' / name).read_bytes()
    for file in (ROOT / 'apps/web-pc/dist').rglob('*'):
        if file.is_file():
            assert file.read_bytes() == (resources / 'app/dist' / file.relative_to(ROOT / 'apps/web-pc/dist')).read_bytes()
    item = {'desktop': arch, 'engineMatchesSource': True, 'frontendMatchesSource': True, 'nativeAppArchitecture': True, 'preloadMatchesSource': True}
    results.append(item)
    print(json.dumps(item))

(EVIDENCE / 'archive-verification.json').write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
