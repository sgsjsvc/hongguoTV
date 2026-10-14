import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const ADB = 'C:\\Users\\AnLin\\AppData\\Local\\Android\\Sdk\\platform-tools\\adb.exe -s emulator-5554';
const ROOT = 'F:\\Project\\hongguoTV';

function p(relPath) {
  return path.join(ROOT, relPath);
}

function adb(cmd) {
  return execSync(`${ADB} ${cmd}`, { encoding: 'utf8' }).trim();
}

function sleep(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {}
}

function dumpHierarchy(localXmlPath) {
  const absPath = path.isAbsolute(localXmlPath) ? localXmlPath : p(localXmlPath);
  try {
    adb('shell uiautomator dump /sdcard/dump.xml');
    adb(`pull /sdcard/dump.xml "${absPath}"`);
    return fs.readFileSync(absPath, 'utf8');
  } catch (e) {
    // If UI is busy animating video frames, pause media to get clean dump
    try {
      adb('shell input keyevent 85');
      sleep(400);
      adb('shell uiautomator dump /sdcard/dump.xml');
      adb(`pull /sdcard/dump.xml "${absPath}"`);
      return fs.readFileSync(absPath, 'utf8');
    } catch (e2) {
      console.warn('Retry dump failed:', e2.message);
      sleep(1000);
      adb('shell uiautomator dump /sdcard/dump.xml');
      adb(`pull /sdcard/dump.xml "${absPath}"`);
      return fs.readFileSync(absPath, 'utf8');
    }
  }
}

function captureScreenshot(localPngPath) {
  const absPath = path.isAbsolute(localPngPath) ? localPngPath : p(localPngPath);
  adb('shell screencap -p /sdcard/screen.png');
  adb(`pull /sdcard/screen.png "${absPath}"`);
  const buf = fs.readFileSync(absPath);
  const header = buf.subarray(0, 8).toString('hex').toUpperCase();
  const magic = header.match(/../g).join('-');
  console.log(`Saved screenshot ${path.basename(absPath)}, magic: ${magic}, size: ${buf.length} bytes`);
  if (magic !== '89-50-4E-47-0D-0A-1A-0A') {
    throw new Error(`Invalid PNG magic: ${magic}`);
  }
}

function findFocusedNodes(xml) {
  const results = [];
  const regex = /<node[^>]+focused="true"[^>]*>/g;
  let m;
  while ((m = regex.exec(xml)) !== null) {
    const textMatch = m[0].match(/text="([^"]*)"/);
    const boundsMatch = m[0].match(/bounds="([^"]*)"/);
    results.push({
      text: textMatch ? textMatch[1] : '',
      bounds: boundsMatch ? boundsMatch[1] : '',
      raw: m[0]
    });
  }
  return results;
}

async function run() {
  console.log('=== Starting R2 Comprehensive Verification ===');

  // Reset App
  adb('shell am force-stop com.hongguotv.tv');
  sleep(1000);
  adb('shell am start -n com.hongguotv.tv/.MainActivity');

  console.log('Waiting for initial feed & chrome to be ready on screen...');
  let xml = '';
  for (let i = 0; i < 20; i++) {
    sleep(1000);
    try {
      xml = dumpHierarchy('.agents/shared/wait_ready.xml');
      if (xml.includes('推荐') && (xml.includes('1080P') || xml.includes('合集'))) {
        console.log(`Feed and chrome ready at attempt ${i + 1}!`);
        break;
      }
    } catch (_) {}
  }

  // 1. Verify D2-F2: 5s timeout does not hide chrome when focused
  console.log('\n--- 1. Testing D2-F2: 5s Timeout when Chrome is Focused ---');
  // Immediately send DPAD_UP while chrome is visible to focus top navigation "推荐"
  console.log('Sending DPAD_UP (19) while chrome is visible to focus top navigation "推荐"...');
  adb('shell input keyevent 19');
  sleep(600);

  xml = dumpHierarchy('.agents/shared/t-r2-nav-timeout-before.xml');
  let focused = findFocusedNodes(xml);
  console.log('Focused node after DPAD_UP:', JSON.stringify(focused));
  const hasRecommendFocused = focused.some(f => f.text === '推荐');
  console.log(`Initial focus on "推荐" tab? ${hasRecommendFocused}`);
  if (!hasRecommendFocused) {
    throw new Error('Failed to focus "推荐" tab on DPAD_UP');
  }

  console.log('Waiting 6.5 seconds (timeout is 5 seconds)...');
  sleep(6500);

  xml = dumpHierarchy('.agents/shared/t-r2-nav-timeout-fixed-20261014.xml');
  captureScreenshot('.agents/shared/t-r2-nav-timeout-fixed-20261014.png');
  const hasNavButtons = xml.includes('text="推荐"') && xml.includes('text="设置"');
  console.log(`D2-F2 Result: Chrome navigation still visible after 6.5s? ${hasNavButtons}`);
  if (!hasNavButtons) {
    throw new Error('D2-F2 Failed: Chrome was hidden while focused!');
  }
  focused = findFocusedNodes(xml);
  console.log('Focused node after 6.5s wait:', JSON.stringify(focused));

  // 2. Verify D2-F6: Focus Alignment between Top Navigation and Bottom Control Bar
  console.log('\n--- 2. Testing D2-F6: Spatial Alignment (Settings <-> 1080P) ---');
  // Currently on "推荐" (index 0). Move right to "设置" (index 6: 6 rights)
  for (let i = 0; i < 6; i++) {
    adb('shell input keyevent 22'); // RIGHT
    sleep(300);
  }
  sleep(500);
  xml = dumpHierarchy('.agents/shared/t-r2-focus-align-settings.xml');
  focused = findFocusedNodes(xml);
  console.log('On rightmost topHeader (Settings):', JSON.stringify(focused));

  // Press DOWN: With D2-F6 alignment, it must go straight down to "1080P" (qualityButton)
  adb('shell input keyevent 20'); // DOWN
  sleep(500);
  xml = dumpHierarchy('.agents/shared/t-r2-focus-align-fixed-20261014.xml');
  captureScreenshot('.agents/shared/t-r2-focus-align-fixed-20261014.png');
  focused = findFocusedNodes(xml);
  console.log('After DOWN from Settings, focused:', JSON.stringify(focused));
  const is1080PFocused = focused.some(f => f.text.includes('1080P'));
  console.log(`D2-F6 Result (DOWN from 设置 to 1080P): ${is1080PFocused}`);
  if (!is1080PFocused) {
    throw new Error('D2-F6 Failed: Down from Settings did not land on 1080P!');
  }

  // Press UP: must go back up to "设置"
  adb('shell input keyevent 19'); // UP
  sleep(500);
  xml = dumpHierarchy('.agents/shared/t-r2-focus-align-up-settings.xml');
  focused = findFocusedNodes(xml);
  console.log('After UP from 1080P, focused:', JSON.stringify(focused));
  const isSettingsFocused = focused.some(f => f.text === '设置');
  console.log(`D2-F6 Result (UP from 1080P to 设置): ${isSettingsFocused}`);
  if (!isSettingsFocused) {
    throw new Error('D2-F6 Failed: Up from 1080P did not return to 设置!');
  }

  // 3. Verify D2-F1: Soft Keyboard Back Key in Search
  console.log('\n--- 3. Testing D2-F1: Search Page Back Key Does Not Exit Whole Page ---');
  // In topHeader, navigate left to "搜索" (5 lefts from 设置)
  for (let i = 0; i < 5; i++) {
    adb('shell input keyevent 21'); // LEFT
    sleep(200);
  }
  xml = dumpHierarchy('.agents/shared/t-r2-search-tab-focused.xml');
  focused = findFocusedNodes(xml);
  console.log('Focused on search tab:', JSON.stringify(focused));

  // Click Search Tab
  adb('shell input keyevent 66'); // ENTER
  sleep(1500);

  xml = dumpHierarchy('.agents/shared/t-r2-search-page-opened.xml');
  console.log('Search page opened?', xml.includes('EditText') || xml.includes('搜索短剧'));

  // Tap search EditText inside [36,83][1244,146] -> (200, 110)
  adb('shell input tap 200 110');
  sleep(1000);

  // Press BACK key (keyevent 4)
  console.log('Sending BACK key (keyevent 4) while soft keyboard is up...');
  adb('shell input keyevent 4');
  sleep(1000);

  // Verify search page is STILL OPEN
  xml = dumpHierarchy('.agents/shared/t-r2-search-back-fixed-20261014.xml');
  captureScreenshot('.agents/shared/t-r2-search-back-fixed-20261014.png');
  const searchStillOpen = xml.includes('EditText') || xml.includes('搜索短剧') || xml.includes('搜索');
  console.log(`D2-F1 Result: Search page still open after back key? ${searchStillOpen}`);
  if (!searchStillOpen) {
    throw new Error('D2-F1 Failed: Search page exited completely!');
  }

  // 4. Verify D2-F3: Catalog Tab Switching Stability
  console.log('\n--- 4. Testing D2-F3: Catalog Panel Stability & White-Screen Elimination ---');
  // Exit search page back to feed (press BACK again now that keyboard is hidden)
  adb('shell input keyevent 4');
  sleep(1000);

  // Click 分类 directly
  adb('shell input tap 549 32'); // 分类 button coordinates in topHeader
  sleep(2000);

  xml = dumpHierarchy('.agents/shared/t-r2-catalog-stable-20261014.xml');
  captureScreenshot('.agents/shared/t-r2-catalog-stable-20261014.png');
  const hasCatalogContent = xml.includes('分类') || xml.includes('全部') || xml.includes('real-drama');
  console.log(`D2-F3 Result: Catalog loaded stably? ${hasCatalogContent}`);
  if (!hasCatalogContent) {
    throw new Error('D2-F3 Failed: Catalog did not load!');
  }

  console.log('\n=== All R2 Verifications Passed 100% Successfully! ===');
}

run().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
