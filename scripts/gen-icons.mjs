// Minimal PNG generator for PWA icons (no deps)
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { deflateSync } from 'zlib';

function createPNG(size, r, g, b) {
  const width = size;
  const height = size;
  
  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  
  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 2; // color type (RGB)
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdr = makeChunk('IHDR', ihdrData);
  
  // IDAT chunk - raw image data
  // Each row: filter byte (0) + RGB pixels
  const rowSize = 1 + width * 3;
  const rawData = Buffer.alloc(rowSize * height);
  
  // Draw a circle with "C" letter look
  const cx = width / 2;
  const cy = height / 2;
  const radius = width * 0.4;
  
  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // no filter
    for (let x = 0; x < width; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      let pr = r, pg = g, pb = b;
      
      // Circle border
      if (dist <= radius && dist >= radius - width * 0.08) {
        pr = 255; pg = 255; pb = 255;
      }
      // Inner fill - slightly lighter
      else if (dist < radius - width * 0.08) {
        pr = Math.min(255, r + 15);
        pg = Math.min(255, g + 15);
        pb = Math.min(255, b + 15);
      }
      // Outside - transparent-looking (just bg)
      else {
        pr = r; pg = g; pb = b;
      }
      
      const px = rowOffset + 1 + x * 3;
      rawData[px] = pr;
      rawData[px + 1] = pg;
      rawData[px + 2] = pb;
    }
  }
  
  const compressed = deflateSync(rawData);
  const idat = makeChunk('IDAT', compressed);
  
  // IEND chunk
  const iend = makeChunk('IEND', Buffer.alloc(0));
  
  return Buffer.concat([signature, ihdr, idat, iend]);
}

function makeChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuffer = Buffer.from(type, 'ascii');
  const crcData = Buffer.concat([typeBuffer, data]);
  const crc = crc32(crcData);
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc >>> 0, 0);
  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let j = 0; j < 8; j++) {
      c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
    }
  }
  return (c ^ 0xffffffff);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const publicDir = join(__dirname, '..', 'public');

// Primary blue: rgb(28, 46, 74)
writeFileSync(join(publicDir, 'pwa-192x192.png'), createPNG(192, 28, 46, 74));
writeFileSync(join(publicDir, 'pwa-512x512.png'), createPNG(512, 28, 46, 74));

console.log('PWA icons created!');
