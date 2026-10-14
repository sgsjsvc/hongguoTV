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
  try {
    sh('shell uiautomator dump /sdcard/window_dump.xml');
  } catch (e) {
    sh('shell input keyevent 85');
    sleep(200);
    sh('shell uiautomator dump /sdcard/window_dump.xml');
  }
  sh(`pull /sdcard/window_dump.xml .agents/shared/${name}.xml`);
  return fs.readFileSync(`.agents/shared/${name}.xml`, 'utf-8');
}

function snap(name) {
  sh('shell screencap -p /sdcard/screen.png');
  sh(`pull /sdcard/screen.png .agents/shared/${name}.png`);
  const buf = fs.readFileSync(`.agents/shared/${name}.png`);
  console.log(`[SNAP] ${name}.png size=${buf.length} magic=${buf.slice(0, 8).toString('hex')}`);
}

function getPid() {
  const out = sh('shell pidof com.hongguotv.tv').trim();
  return out;
}

try {
  // Ensure default size
  sh('shell wm size reset');
  sleep(500);

  console.log('1. Launching app...');
  sh('shell am force-stop com.hongguotv.tv');
  sleep(500);
  sh('shell am start -n com.hongguotv.tv/.MainActivity');
  sleep(3500);

  // Pause video to ensure stable dump
  sh('shell input keyevent 85');
  sleep(300);

  // Navigate focus to "分类" (DPAD_RIGHT from 推荐 -> 搜索 -> 分类)
  sh('shell input keyevent 22'); // 搜索
  sleep(200);
  sh('shell input keyevent 22'); // 分类
  sleep(300);

  const initialPid = getPid();
  console.log('Initial PID:', initialPid);

  console.log('2. Dumping initial 1280x720 state...');
  let xml1 = dump('t-r4-1280x720-before');
  snap('t-r4-1280x720-before-20261014');
  let focused1 = xml1.match(/<node [^>]*focused="true"[^>]*>/);
  console.log('Focused at 1280x720:', focused1 ? focused1[0] : 'none');

  console.log('3. Changing resolution to 1920x1080...');
  sh('shell wm size 1920x1080');
  sleep(1500);

  const pidAfter1080 = getPid();
  console.log('PID after 1920x1080:', pidAfter1080);

  let xml2 = dump('t-r4-1920x1080');
  snap('t-r4-1920x1080-20261014');
  let focused2 = xml2.match(/<node [^>]*focused="true"[^>]*>/);
  console.log('Focused at 1920x1080:', focused2 ? focused2[0] : 'none');

  console.log('4. Changing resolution back to 1280x720...');
  sh('shell wm size 1280x720');
  sleep(1500);

  const pidAfter720 = getPid();
  console.log('PID after 1280x720:', pidAfter720);

  let xml3 = dump('t-r4-1280x720-after');
  snap('t-r4-1280x720-after-20261014');
  let focused3 = xml3.match(/<node [^>]*focused="true"[^>]*>/);
  console.log('Focused at 1280x720 after:', focused3 ? focused3[0] : 'none');

  const pidNotChanged = (initialPid === pidAfter1080 && initialPid === pidAfter720);
  console.log('PID stayed same (no process restart):', pidNotChanged);

  const focusRetained = (focused1 && focused2 && focused1[0].includes('分类') && focused2[0].includes('分类'));
  console.log('Focus retained across resolution changes:', focusRetained);

  if (pidNotChanged && focusRetained) {
    console.log('SUCCESS: Activity was NOT recreated, page state and focus retained!');
  } else {
    console.error('FAIL: Activity was recreated or focus lost');
    process.exit(1);
  }
} finally {
  console.log('Resetting wm size...');
  sh('shell wm size reset');
}
