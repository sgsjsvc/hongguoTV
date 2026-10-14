import pathlib, zipfile, tarfile, hashlib, struct, json
root=pathlib.Path('outputs/bundles')
names=['hongguotv-web-'+p for p in ['win-x64','win-arm64','linux-x64','linux-arm64','darwin-x64','darwin-arm64']]+['hongguotv-sync-linux-x64','hongguotv-sync-linux-arm64']
rows=[]
for name in names:
    windows='-win-' in name
    file=root/(name+('.zip' if windows else '.tar.gz'))
    z=zipfile.ZipFile(file) if windows else tarfile.open(file)
    entries=z.namelist() if windows else z.getnames()
    def read(rel):
        key=name+'/'+rel
        return z.read(key) if windows else z.extractfile(key).read()
    forbidden=[s for s in entries if s.lower().endswith(('/dockerfile','/compose.yaml','/shared-key.txt','/service-state.json','.sqlite','.sqlite-wal','.sqlite-shm'))]
    assert not forbidden, forbidden
    runtime=read('runtime/node.exe' if windows else 'runtime/node')
    if windows:
        machine=struct.unpack_from('<H',runtime,struct.unpack_from('<I',runtime,0x3c)[0]+4)[0]
        assert machine==(0xaa64 if 'arm64' in name else 0x8664)
        assert 'runtime\\node.exe' in read('start.cmd').decode()
        assert name+'/stop.cmd' in entries
        assert z.testzip() is None
        mode=None
    else:
        if '-linux-' in name:
            assert runtime[:4]==b'\x7fELF'
            assert struct.unpack_from('<H',runtime,18)[0]==(183 if 'arm64' in name else 62)
        else:
            assert struct.unpack_from('<II',runtime,0)==(0xfeedfacf,0x100000c if 'arm64' in name else 0x1000007)
        assert '$ROOT/runtime/node' in read('start.sh').decode()
        mode={p:oct(z.getmember(name+'/'+p).mode) for p in ['runtime/node','start.sh','stop.sh']}
        assert all(z.getmember(name+'/'+p).mode&0o777==0o755 for p in mode)
    assert name+'/scripts/service-launcher.mjs' in entries
    assert name+'/apps/sync-server/index.mjs' in entries if '-sync-' in name else name+'/custom-server/index.mjs' in entries
    if '-web-' in name:
        assert hashlib.sha256(read('shared/content-core/hongguo.js')).digest()==hashlib.sha256(pathlib.Path('shared/content-core/hongguo.js').read_bytes()).digest()
        assert read('apps/web-pc/dist/index.html')==pathlib.Path('apps/web-pc/dist/index.html').read_bytes()
    rows.append({'file':str(file),'bytes':file.stat().st_size,'sha256':hashlib.sha256(file.read_bytes()).hexdigest(),'runtimeBytes':len(runtime),'entryCount':len(entries),'unixModes':mode,'privateDataExcluded':True})
    z.close()
(root/'SHA256SUMS.txt').write_text(''.join(r['sha256']+'  '+pathlib.Path(r['file']).name+'\n' for r in rows),encoding='utf8')
pathlib.Path('.agents/shared/t-b2-artifacts.json').write_text(json.dumps(rows,indent=2),encoding='utf8')
print(json.dumps(rows))
