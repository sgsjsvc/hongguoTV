import { execSync } from 'child_process';
import fs from 'fs';

const ADB = `"${process.env.LOCALAPPDATA}\\Android\\Sdk\\platform-tools\\adb.exe" -s emulator-5554`;

function sh(cmd) {
  return execSync(`${ADB} ${cmd}`, { encoding: 'utf-8' });
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function dump(name) {
  sh('shell uiautomator dump /sdcard/window_dump.xml');
  sh(`pull /sdcard/window_dump.xml .agents/shared/${name}.xml`);
  return fs.readFileSync(`.agents/shared/${name}.xml`, 'utf-8');
}

function snap(name) {
  sh('shell screencap -p /sdcard/screen.png');
  sh(`pull /sdcard/screen.png .agents/shared/${name}.png`);
  const buf = fs.readFileSync(`.agents/shared/${name}.png`);
  console.log(`[SNAP] ${name}.png size=${buf.length} magic=${buf.slice(0, 8).toString('hex')}`);
}

function getActivityRecord() {
  const out = sh('shell dumpsys activity activities');
  const m = out.match(/ActivityRecord\{([a-f0-9]+)\s+u0\s+com\.hongguotv\.tv\/\.MainActivity/);
  return m ? m[1] : 'unknown';
}

try {
  sh('shell wm size reset');
  sleep(500);

  console.log('1. Starting app...');
  sh('shell am force-stop com.hongguotv.tv');
  sleep(500);
  sh('shell am start -n com.hongguotv.tv/.MainActivity');
  sleep(3500);

  // Pause playback
  sh('shell input keyevent 85');
  sleep(300);

  // Navigate to "搜索" tab and open Search page
  console.log('Navigating to Search page...');
  // Tap "搜索" button directly: bounds in top bar approx [345, 9][477, 54] -> center (411, 31)
  sh('shell input tap 411 31');
  sleep(1000);

  const actBefore = getActivityRecord();
  console.log('Initial ActivityRecord in Search page:', actBefore);

  let xml1 = dump('t-r4-search-1280x720');
  snap('t-r4-search-1280x720-20261014');
  const inSearchBefore = xml1.includes('搜索短剧') || xml1.includes('EditText');
  console.log('In Search page before wm size change:', inSearchBefore);

  console.log('2. Changing resolution to 1920x1080...');
  sh('shell wm size 1920x1080');
  sleep(1500);

  const act1080 = getActivityRecord();
  console.log('ActivityRecord after 1920x1080:', act1080);

  let xml2 = dump('t-r4-search-1920x1080');
  snap('t-r4-search-1920x1080-20261014');
  const inSearch1080 = xml2.includes('搜索短剧') || xml2.includes('EditText');
  console.log('In Search page after 1920x1080:', inSearch1080);

  console.log('3. Changing resolution back to 1280x720...');
  sh('shell wm size 1280x720');
  sleep(1500);

  const act720 = getActivityRecord();
  console.log('ActivityRecord after 1280x720:', act720);

  let xml3 = dump('t-r4-search-1280x720-restored');
  snap('t-r4-search-1280x720-restored-20261014');
  const inSearch720 = xml3.includes('搜索短剧') || xml3.includes('EditText');
  console.log('In Search page after 1280x720 restored:', inSearch720);

  const activityRetained = (actBefore === act1080 && actBefore === act720);
  console.log('Activity instance retained across all resolution changes:', activityRetained);

  if (activityRetained && inSearchBefore && inSearch1080 && inSearch720) {
    console.log('SUCCESS: Activity was NOT destroyed, page state (Search page) perfectly preserved!');
  } else {
    console.error('FAIL: Activity was destroyed or page state lost');
    process.exit(1);
  }
} finally {
  console.log('Resetting wm size to default...');
  sh('shell wm size reset');
}
