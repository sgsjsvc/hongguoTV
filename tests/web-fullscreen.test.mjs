import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('RecommendStream contains top-right fullscreen button with dynamic aria-label and title', () => {
  const content = fs.readFileSync('apps/web-pc/src/components/RecommendStream.tsx', 'utf8');
  assert.ok(content.includes('aria-label={isFullscreen ? "退出全屏" : "全屏"}'), 'Missing dynamic aria-label in RecommendStream');
  assert.ok(content.includes('title={isFullscreen ? "退出全屏 (ESC)" : "全屏 (F)"}'), 'Missing dynamic title in RecommendStream');
  assert.ok(content.includes('toggleFullscreen();'), 'Missing toggleFullscreen invocation');
  assert.ok(content.includes('onDoubleClick'), 'Missing onDoubleClick video fullscreen toggle');
  assert.ok(content.includes('fixed inset-0 z-50 w-screen h-screen'), 'Missing fullscreen container layout');
});

test('PlayerModal contains standard bottom bar fullscreen button without redundant top floating button', () => {
  const content = fs.readFileSync('apps/web-pc/src/components/PlayerModal.tsx', 'utf8');
  assert.ok(content.includes('aria-label={isFullscreen ? "退出全屏" : "全屏"}'), 'Missing dynamic aria-label in PlayerModal bottom bar');
  assert.ok(!content.includes('absolute top-4 right-4 z-40'), 'Redundant floating button should not exist in PlayerModal');
});

test('usePlayback handles desktop bridge and DOM requestFullscreen with error toasts', () => {
  const content = fs.readFileSync('apps/web-pc/src/hooks/usePlayback.ts', 'utf8');
  assert.ok(content.includes('desktop.toggleFullScreen()'), 'Missing desktop bridge toggle');
  assert.ok(content.includes('container.requestFullscreen()'), 'Missing DOM requestFullscreen fallback');
  assert.ok(content.includes('全屏失败，请先点击播放窗口再试'), 'Missing friendly user toast on rejection');
  assert.ok(content.includes('desktop.onFullScreenChanged'), 'Missing desktop onFullScreenChanged subscription');
  assert.ok(content.includes('fullscreenchange'), 'Missing DOM fullscreenchange event listener');
});

test('useKeyboardShortcuts isolates Escape key handling between fullscreen and modal dismissal', () => {
  const content = fs.readFileSync('apps/web-pc/src/hooks/useKeyboardShortcuts.ts', 'utf8');
  assert.ok(content.includes('if (document.fullscreenElement || playback.isFullscreen)'), 'Missing fullscreen Escape branch');
  assert.ok(content.includes('desktop.setFullScreen(false)'), 'Missing desktop exit fullscreen on Escape');
  assert.ok(content.includes('document.exitFullscreen()'), 'Missing DOM exitFullscreen on Escape');
  assert.ok(content.includes('setActiveSeries(null)'), 'Missing setActiveSeries(null) in non-fullscreen Escape branch');
});
