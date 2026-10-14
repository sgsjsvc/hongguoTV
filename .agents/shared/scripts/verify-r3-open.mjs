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

console.log('1. Launching app...');
sh('shell am force-stop com.hongguotv.tv');
sleep(500);
sh('shell am start -n com.hongguotv.tv/.MainActivity');
sleep(3500);

// Pause playback
sh('shell input keyevent 85');
sleep(500);

// Reveal chrome
sh('shell input keyevent 82');
sleep(600);

// Click directly on collection button (which is focused by default or focus it)
console.log('Clicking collection button to open drawer...');
sh('shell input keyevent 23'); // DPAD_CENTER
sleep(1000);

let xml = dump('t-r3-drawer-opened');
snap('t-r3-drawer-opened-20261014');

console.log('Drawer opened. Checking if drawer is visible...');
console.log('Contains "选集":', xml.includes('选集'));

// Find focused element in drawer
const focusedMatches = [...xml.matchAll(/<node [^>]*focused="true"[^>]*>/g)].map(m => m[0]);
console.log('Focused nodes in drawer:', focusedMatches);

// Find tabs in drawer: e.g. "1—50", "51—"
const tabMatches = [...xml.matchAll(/<node [^>]*text="(\d+—\d+)"[^>]*>/g)].map(m => m[0]);
console.log('Found group tabs:', tabMatches);
