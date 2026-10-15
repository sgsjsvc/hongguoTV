import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../apps/web-pc/package.json', import.meta.url));
const ts = require('typescript');
const source = ts.transpileModule(fs.readFileSync('apps/web-pc/src/hooks/useKeyboardShortcuts.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;

function fixture({ fullscreen = false, domFullscreen = false, index = 1, active = true, modal = false } = {}) {
  let listener;
  const exports = {};
  const video = { volume: 0.5 };
  const state = { index, volume: 0.5, messages: [], prevented: false };
  vm.runInNewContext(source, {
    exports, require: () => ({ useEffect: effect => effect() }),
    window: { addEventListener: (_, fn) => { listener = fn; } },
    document: { fullscreenElement: domFullscreen ? {} : null },
  });
  exports.useKeyboardShortcuts({
    activeSeries: active ? { episodes: [{ id: '1' }, { id: '2' }, { id: '3' }] } : null,
    currentEpisodeIndex: index, showSeriesEndModal: modal,
    setCurrentEpisodeIndex: update => { state.index = typeof update === 'function' ? update(state.index) : update; },
    playback: { isFullscreen: fullscreen, videoRef: { current: video },
      setVolume: update => { state.volume = update(state.volume); }, setIsMuted() {} },
    showToast: message => state.messages.push(message),
  });
  return { state, press(key, overrides = {}) {
    listener({ key, target: { tagName: 'BODY' }, preventDefault: () => { state.prevented = true; }, ...overrides });
  } };
}

test('browser and desktop fullscreen arrows select adjacent episodes without changing volume', () => {
  for (const flags of [{ domFullscreen: true }, { fullscreen: true }]) {
    for (const [key, expected] of [['ArrowUp', 0], ['ArrowDown', 2]]) {
      const f = fixture(flags); f.press(key);
      assert.equal(f.state.index, expected); assert.equal(f.state.volume, 0.5);
      assert.equal(f.state.prevented, true);
    }
  }
});

test('episode boundaries and repeated keydown do not skip or wrap episodes', () => {
  for (const [index, key] of [[0, 'ArrowUp'], [2, 'ArrowDown']]) {
    const f = fixture({ fullscreen: true, index }); f.press(key);
    assert.equal(f.state.index, index);
    assert.equal(f.state.messages.length, 1);
  }
  const f = fixture({ fullscreen: true }); f.press('ArrowDown', { repeat: true });
  assert.equal(f.state.index, 1); assert.equal(f.state.volume, 0.5);
});

test('windowed arrows retain volume and input, recommendation and end modal retain behavior', () => {
  const f = fixture(); f.press('ArrowUp'); assert.equal(f.state.volume, 0.6); assert.equal(f.state.index, 1);
  for (const options of [{ active: false }, { modal: true }, {}]) {
    const f = fixture({ fullscreen: true, ...options });
    f.press('ArrowDown', options.active === undefined && !options.modal ? { target: { tagName: 'INPUT' } } : {});
    assert.equal(f.state.index, 1); assert.equal(f.state.volume, 0.5);
  }
});
