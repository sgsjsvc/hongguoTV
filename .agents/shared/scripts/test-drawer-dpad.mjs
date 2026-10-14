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

console.log('1. Starting app...');
sh('shell am force-stop com.hongguotv.tv');
sleep(500);
sh('shell am start -n com.hongguotv.tv/.MainActivity');
sleep(3500);

// Pause
sh('shell input keyevent 85');
sleep(400);

// DPAD DOWN to reveal chrome and focus collectionButton
console.log('Pressing DPAD_DOWN to focus collection button...');
sh('shell input keyevent 20'); // KEYCODE_DPAD_DOWN
sleep(500);

let xml = dump('t-r3-test-down');
let collMatch = xml.match(/<node [^>]*合集[^>]*>/);
console.log('Collection button after DOWN:', collMatch ? collMatch[0] : 'not found');

// DPAD CENTER to click collection button
console.log('Pressing DPAD_CENTER to open drawer...');
sh('shell input keyevent 23'); // DPAD_CENTER
sleep(800);

xml = dump('t-r3-drawer-opened');
snap('t-r3-drawer-opened-20261014');

console.log('Checking drawer content...');
const tabs = [...xml.matchAll(/<node [^>]*text="(\d+—\d+)"[^>]*>/g)].map(m => m[0]);
console.log('Drawer Tabs:', tabs);

const activeEp = [...xml.matchAll(/<node [^>]*class="android.widget.Button"[^>]*focused="true"[^>]*>/g)].map(m => m[0]);
console.log('Focused button in drawer:', activeEp);
