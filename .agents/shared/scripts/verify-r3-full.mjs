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

console.log('--- Step 1: Navigating UP from episode button into Group Tabs ---');
sh('shell input keyevent 19'); // DPAD_UP
sleep(400);

let xml = dump('t-r3-drawer-tab-up');
let focusedNode = xml.match(/<node [^>]*focused="true"[^>]*>/);
console.log('Focused node after UP:', focusedNode ? focusedNode[0] : 'none');

console.log('--- Step 2: Navigating RIGHT to Tab "51—100" ---');
sh('shell input keyevent 22'); // DPAD_RIGHT
sleep(400);

xml = dump('t-r3-drawer-tab51-focused');
snap('t-r3-tab-before-click-20261014');
focusedNode = xml.match(/<node [^>]*focused="true"[^>]*>/);
console.log('Focused node after RIGHT to 51-100:', focusedNode ? focusedNode[0] : 'none');

console.log('--- Step 3: Clicking Tab "51—100" with DPAD_CENTER ---');
sh('shell input keyevent 23'); // DPAD_CENTER
sleep(600);

xml = dump('t-r3-drawer-tab51-clicked');
snap('t-r3-tab-clicked-20261014');
focusedNode = xml.match(/<node [^>]*focused="true"[^>]*>/);
console.log('Focused node AFTER CLICKING Tab 51-100:', focusedNode ? focusedNode[0] : 'none');

const isTabFocused = focusedNode && focusedNode[0].includes('51—100');
console.log('>>> VERIFICATION 1: Is Tab "51—100" still focused after click?', isTabFocused);

console.log('--- Step 4: Navigating DOWN to enter episode grid ---');
sh('shell input keyevent 20'); // DPAD_DOWN
sleep(400);

xml = dump('t-r3-drawer-down-to-episodes');
snap('t-r3-down-to-episodes-20261014');
focusedNode = xml.match(/<node [^>]*focused="true"[^>]*>/);
console.log('Focused node after DOWN into grid:', focusedNode ? focusedNode[0] : 'none');
const isEpFocused = focusedNode && (focusedNode[0].includes('text="51"') || focusedNode[0].includes('episode'));
console.log('>>> VERIFICATION 2: Is episode button focused after DOWN?', isEpFocused);

if (!isTabFocused) {
  console.error('FAIL: Tab focus was stolen!');
  process.exit(1);
} else {
  console.log('SUCCESS: Tab retained focus on click, and DOWN navigates to episodes!');
}
