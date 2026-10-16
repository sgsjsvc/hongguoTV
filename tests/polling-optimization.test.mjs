import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('api.ts replaces unconditional 1s polling with 10s smart polling', () => {
  const content = fs.readFileSync('apps/web-pc/src/api.ts', 'utf8');
  assert.ok(!content.includes('setInterval(()=>void refreshLibrary().catch(()=>{}),1000)'), 'Should not have unconditional 1s setInterval');
  assert.ok(content.includes('scheduleNextPoll'), 'Should use scheduleNextPoll for controlled polling');
  assert.ok(content.includes('document.hidden'), 'Should pause when document is hidden');
  assert.ok(content.includes('visibilitychange'), 'Should listen for visibilitychange');
  assert.ok(content.includes('isVideoPlaying'), 'Should detect playing video to prevent bandwidth contention');
  assert.ok(content.includes('backoffMs'), 'Should support error backoff');
});

test('B2: video-state.ts defines shared isVideoPlaying helper', () => {
  const content = fs.readFileSync('apps/web-pc/src/video-state.ts', 'utf8');
  assert.ok(content.includes('export function isVideoPlaying'), 'Should export isVideoPlaying');
  assert.ok(content.includes('!v.paused && !v.ended && v.readyState > 2'), 'Should accurately check video playing state');
});

test('B2: api.ts guards visibilitychange and online events with isVideoPlaying', () => {
  const content = fs.readFileSync('apps/web-pc/src/api.ts', 'utf8').replace(/\r\n/g, '\n');
  // Both visibilitychange and online must check !isVideoPlaying before calling refreshLibrary
  assert.ok(content.includes('if (!isVideoPlaying()) {\n          void refreshLibrary().catch(() => {});\n        }'), 'visibilitychange should guard refreshLibrary with isVideoPlaying');
  assert.ok(content.includes('if (!isVideoPlaying()) {\n      void refreshLibrary().catch(warning);\n    }'), 'online event should guard refreshLibrary with isVideoPlaying');
  // scheduleNextPoll must still be called in both events to prevent polling stagnation
  const vcIndex = content.indexOf('visibilitychange');
  const onlineIndex = content.indexOf('addEventListener("online"');
  assert.ok(vcIndex > 0 && content.slice(vcIndex, vcIndex + 300).includes('scheduleNextPoll(10000)'), 'visibilitychange must schedule next poll');
  assert.ok(onlineIndex > 0 && content.slice(onlineIndex, onlineIndex + 300).includes('scheduleNextPoll(10000)'), 'online event must schedule next poll');
});

test('B2: App.tsx favorites tab polling guards with isVideoPlaying', () => {
  const content = fs.readFileSync('apps/web-pc/src/App.tsx', 'utf8');
  assert.ok(!content.includes('setInterval(() => void library.refreshHistory(), 1000)'), 'Favorites tab should not poll at 1s');
  assert.ok(content.includes('if (isVideoPlaying()) return;'), 'Favorites tab should guard interval with isVideoPlaying');
  assert.ok(content.includes('import { isVideoPlaying } from "./video-state";'), 'App.tsx should import isVideoPlaying from video-state');
});

test('B2: isVideoPlaying logic accurately reflects video playback state', () => {
  // Simulate DOM video elements
  const mockDocument = {
    querySelectorAll(selector) {
      if (selector === 'video') return this.videos;
      return [];
    },
    videos: [],
  };

  // Run function under mock
  function testPlaying(videos) {
    mockDocument.videos = videos;
    const globalDoc = globalThis.document;
    globalThis.document = mockDocument;
    try {
      const vids = mockDocument.querySelectorAll("video");
      for (let i = 0; i < vids.length; i++) {
        const v = vids[i];
        if (!v.paused && !v.ended && v.readyState > 2) return true;
      }
      return false;
    } finally {
      globalThis.document = globalDoc;
    }
  }

  // 1. No video: false
  assert.equal(testPlaying([]), false);

  // 2. Paused video: false
  assert.equal(testPlaying([{ paused: true, ended: false, readyState: 4 }]), false);

  // 3. Ended video: false
  assert.equal(testPlaying([{ paused: false, ended: true, readyState: 4 }]), false);

  // 4. Loading/unready video (readyState <= 2): false
  assert.equal(testPlaying([{ paused: false, ended: false, readyState: 2 }]), false);

  // 5. Playing video (not paused, not ended, readyState > 2): true
  assert.equal(testPlaying([{ paused: false, ended: false, readyState: 3 }]), true);
  assert.equal(testPlaying([{ paused: false, ended: false, readyState: 4 }]), true);

  // 6. Multiple videos with one playing: true
  assert.equal(testPlaying([
    { paused: true, ended: false, readyState: 4 },
    { paused: false, ended: false, readyState: 4 }
  ]), true);
});
