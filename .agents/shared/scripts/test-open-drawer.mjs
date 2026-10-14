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
    sh('shell input keyevent 85'); // pause video
    sleep(300);
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

console.log('1. Starting app fresh...');
sh('shell am force-stop com.hongguotv.tv');
sleep(500);
sh('shell am start -n com.hongguotv.tv/.MainActivity');
sleep(3500);

// Pause playback
sh('shell input keyevent 85');
sleep(500);

// Hide chrome first if visible (or ensure clean state)
sh('shell input keyevent 82'); // KEYCODE_MENU
sleep(500);

// Now press KEYCODE_MENU to reveal chrome and focus collectionButton
sh('shell input keyevent 82'); // KEYCODE_MENU
sleep(500);

let xml = dump('t-r3-menu-focused');
console.log('Dumped menu, checking collection button focus...');
let m = xml.match(/<node [^>]*text="[^"]*合集[^"]*"[^>]*>/);
console.log('Collection button node:', m ? m[0] : 'not found');

// Now press DPAD_CENTER to click collectionButton and open drawer
console.log('Pressing DPAD_CENTER to open drawer...');
sh('shell input keyevent 23');
sleep(1000);

xml = dump('t-r3-drawer-view');
snap('t-r3-drawer-opened-20261014');

const tabs = [...xml.matchAll(/<node [^>]*text="(\d+—\d+)"[^>]*>/g)].map(m => m[0]);
console.log('Drawer Tabs:', tabs);

const epButtons = [...xml.matchAll(/<node [^>]*text="(\d+)"[^>]*focused="true"[^>]*>/g)].map(m => m[0]);
console.log('Focused episode button:', epButtons);
