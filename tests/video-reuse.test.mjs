import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('RecommendStream video element reuses DOM node without key', () => {
  const content = fs.readFileSync('apps/web-pc/src/components/RecommendStream.tsx', 'utf8');
  assert.ok(!content.includes('key={`${currentItem.id}'), 'RecommendStream should not have key on video tag');
  assert.ok(content.includes('loadedStreamEpisodeKeyRef'), 'RecommendStream should guard handlers with loadedStreamEpisodeKeyRef');
  assert.ok(content.includes('video.load()'), 'RecommendStream should explicitly call video.load() on src switch');
  assert.ok(content.includes('lastTimeUpdateRef'), 'RecommendStream should throttle onTimeUpdate');
});

test('PlayerModal video element reuses DOM node without key', () => {
  const content = fs.readFileSync('apps/web-pc/src/components/PlayerModal.tsx', 'utf8');
  assert.ok(!content.includes('key={currentEpisode.id}'), 'PlayerModal should not have key on video tag');
  assert.ok(content.includes('video.load()'), 'PlayerModal should explicitly call video.load() on src switch');
});

test('usePlayback guards timeupdate against stale episode progress', () => {
  const content = fs.readFileSync('apps/web-pc/src/hooks/usePlayback.ts', 'utf8');
  assert.ok(content.includes('loadedEpisodeIdRef'), 'usePlayback should have loadedEpisodeIdRef');
  assert.ok(content.includes('if (loadedEpisodeIdRef.current !== currentEpisode.id) return;'), 'handleTimeUpdate should guard against stale episode');
  assert.ok(content.includes('loadedEpisodeIdRef.current = currentEpisode?.id;'), 'handleLoadedMetadata should update loadedEpisodeIdRef');
});
