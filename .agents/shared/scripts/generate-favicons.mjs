import fs from 'fs';
import path from 'path';

const publicDir = 'apps/web-pc/public';
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// 1. Create favicon.svg
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="8" fill="#e11d48"/>
  <path d="M12 9l12 7-12 7V9z" fill="#ffffff"/>
</svg>`;

fs.writeFileSync(path.join(publicDir, 'favicon.svg'), svg, 'utf-8');

// 2. Create minimal valid 16x16 32bpp BMP-in-ICO favicon.ico
// ICO header: 6 bytes
// Icon directory entry: 16 bytes
// Bitmap header + image data
const width = 16;
const height = 16;
const bpp = 32;

const bmpHeaderSize = 40;
const pixelDataSize = width * height * 4;
const maskDataSize = (width * height) / 8; // 1-bit transparency mask
const imageSize = bmpHeaderSize + pixelDataSize + maskDataSize;

const icoBuf = Buffer.alloc(6 + 16 + imageSize);

// ICONDIR
icoBuf.writeUInt16LE(0, 0); // reserved
icoBuf.writeUInt16LE(1, 2); // 1 = ICO
icoBuf.writeUInt16LE(1, 4); // 1 image

// ICONDIRENTRY
icoBuf.writeUInt8(width, 6); // width
icoBuf.writeUInt8(height, 7); // height
icoBuf.writeUInt8(0, 8); // color count
icoBuf.writeUInt8(0, 9); // reserved
icoBuf.writeUInt16LE(1, 10); // color planes
icoBuf.writeUInt16LE(bpp, 12); // bits per pixel
icoBuf.writeUInt32LE(imageSize, 14); // size of image data
icoBuf.writeUInt32LE(22, 18); // offset of image data

// BITMAPINFOHEADER (offset 22)
let offset = 22;
icoBuf.writeUInt32LE(bmpHeaderSize, offset); offset += 4;
icoBuf.writeInt32LE(width, offset); offset += 4;
icoBuf.writeInt32LE(height * 2, offset); offset += 4; // in ICO, height is doubled for XOR + AND masks
icoBuf.writeUInt16LE(1, offset); offset += 2; // planes
icoBuf.writeUInt16LE(bpp, offset); offset += 2; // bit count
icoBuf.writeUInt32LE(0, offset); offset += 4; // compression (BI_RGB)
icoBuf.writeUInt32LE(pixelDataSize, offset); offset += 4;
icoBuf.writeInt32LE(0, offset); offset += 4; // xpels
icoBuf.writeInt32LE(0, offset); offset += 4; // ypels
icoBuf.writeUInt32LE(0, offset); offset += 4; // clrUsed
icoBuf.writeUInt32LE(0, offset); offset += 4; // clrImportant

// Pixel data: bottom-to-top, BGRA
// Let's paint red (#e11d48 -> B=0x48, G=0x1d, R=0xe1, A=0xff) with white play button
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    // Check if inside play triangle: approx x: 6..11, y: 4..12
    const inTriangle = (x >= 6 && x <= 11 && Math.abs((height - 1 - y) - 8) <= (x - 5));
    if (inTriangle) {
      icoBuf.writeUInt8(0xff, offset); // B
      icoBuf.writeUInt8(0xff, offset + 1); // G
      icoBuf.writeUInt8(0xff, offset + 2); // R
      icoBuf.writeUInt8(0xff, offset + 3); // A
    } else {
      icoBuf.writeUInt8(0x48, offset); // B
      icoBuf.writeUInt8(0x1d, offset + 1); // G
      icoBuf.writeUInt8(0xe1, offset + 2); // R
      icoBuf.writeUInt8(0xff, offset + 3); // A
    }
    offset += 4;
  }
}

// 1-bit AND mask: all 0 (opaque)
for (let i = 0; i < maskDataSize; i++) {
  icoBuf.writeUInt8(0x00, offset++);
}

fs.writeFileSync(path.join(publicDir, 'favicon.ico'), icoBuf);
console.log('Created favicon.svg and favicon.ico successfully!');
