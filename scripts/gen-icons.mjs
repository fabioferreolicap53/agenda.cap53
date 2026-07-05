// PNG generator for PWA agenda icons (no deps)
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { deflateSync } from 'zlib';

function createAgendaPNG(size) {
  const width = size;
  const height = size;
  
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;  // bit depth
  ihdrData[9] = 2;  // RGB
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;
  const ihdr = makeChunk('IHDR', ihdrData);
  
  const rowSize = 1 + width * 3;
  const rawData = Buffer.alloc(rowSize * height);
  
  const cx = width / 2;
  const cy = height / 2;
  
  // Rounded rectangle helper
  const roundedRect = (x1, y1, x2, y2, radius, px, py) => {
    // Check if point is inside rounded rectangle
    if (px < x1 || px > x2 || py < y1 || py > y2) return false;
    
    // Check corners
    const corners = [
      [x1 + radius, y1 + radius], // top-left
      [x2 - radius, y1 + radius], // top-right
      [x1 + radius, y2 - radius], // bottom-left
      [x2 - radius, y2 - radius], // bottom-right
    ];
    
    for (const [ccx, ccy] of corners) {
      const dx = px - ccx;
      const dy = py - ccy;
      // If we're in a corner zone, check radius
      if (
        (px < x1 + radius && py < y1 + radius) ||
        (px > x2 - radius && py < y1 + radius) ||
        (px < x1 + radius && py > y2 - radius) ||
        (px > x2 - radius && py > y2 - radius)
      ) {
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > radius) return false;
      }
    }
    return true;
  };
  
  // Circle helper
  const inCircle = (cx, cy, r, px, py) => {
    const dx = px - cx;
    const dy = py - cy;
    return Math.sqrt(dx * dx + dy * dy) <= r;
  };
  
  // Rectangle check
  const inRect = (x1, y1, x2, y2, px, py) => {
    return px >= x1 && px <= x2 && py >= y1 && py <= y2;
  };
  
  // Colors
  const BG = [22, 35, 58];           // dark blue background
  const CARD = [245, 247, 250];       // white card
  const HEADER = [28, 46, 74];        // primary dark header
  const ACCENT = [217, 119, 6];       // amber accent
  const TEXT_DARK = [30, 41, 59];     // slate-800
  const TEXT_LIGHT = [100, 116, 139]; // slate-500
  const GRID = [203, 213, 225];       // slate-300
  
  // Calendar card dimensions (centered, with margin)
  const margin = Math.round(width * 0.12);
  const cardL = margin;
  const cardT = margin + Math.round(height * 0.02); // slight offset up
  const cardR = width - margin;
  const cardB = height - margin;
  const cardRounded = Math.round(width * 0.08);
  
  // Header area
  const headerH = Math.round(height * 0.22);
  const headerBottom = cardT + headerH;
  
  // Ring/loop at top of calendar
  const ringY = cardT - Math.round(height * 0.04);
  const ringR = Math.round(width * 0.04);
  
  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0;
    
    for (let x = 0; x < width; x++) {
      let pr, pg, pb;
      
      const inCard = roundedRect(cardL, cardT, cardR, cardB, cardRounded, x, y);
      
      if (!inCard) {
        // Background - rounded corners on the whole icon
        const inBg = roundedRect(0, 0, width, height, Math.round(width * 0.22), x, y);
        if (inBg) {
          pr = BG[0]; pg = BG[1]; pb = BG[2];
        } else {
          // Outside bg rounded rect - keep bg color (will blend with OS masking)
          pr = BG[0]; pg = BG[1]; pb = BG[2];
        }
      } else {
        // Inside card
        if (y < headerBottom) {
          // Header area
          pr = HEADER[0]; pg = HEADER[1]; pb = HEADER[2];
          
          // "5" number in center of header (large, bold look)
          const numCx = cx;
          const numCy = cardT + headerH * 0.55;
          const numH = headerH * 0.5;
          const numW = numH * 0.65;
          
          // Draw "5" shape using rectangles and curves
          const nrx = (x - (numCx - numW/2)) / numW;
          const nry = (y - (numCy - numH/2)) / numH;
          
          // Simple "5" representation
          const inNum = (
            // Top horizontal bar
            (nry >= -0.45 && nry <= -0.15 && nrx >= -0.4 && nrx <= 0.45) ||
            // Left vertical (top half)
            (nry >= -0.45 && nry <= 0.0 && nrx >= -0.4 && nrx <= -0.1) ||
            // Middle horizontal bar
            (nry >= -0.05 && nry <= 0.15 && nrx >= -0.4 && nrx <= 0.35) ||
            // Right vertical (bottom half)
            (nry >= 0.0 && nry <= 0.45 && nrx >= 0.15 && nrx <= 0.45) ||
            // Bottom horizontal
            (nry >= 0.35 && nry <= 0.5 && nrx >= -0.35 && nrx <= 0.45) ||
            // Left vertical (bottom part of curve)
            (nry >= 0.0 && nry <= 0.45 && nrx >= -0.4 && nrx <= -0.1)
          );
          
          if (inNum) {
            pr = 255; pg = 255; pb = 255;
          }
          
          // Accent dots at top (calendar rings)
          const ringSpacing = width * 0.08;
          const ring1x = cx - ringSpacing;
          const ring2x = cx + ringSpacing;
          if (inCircle(ring1x, ringY, ringR, x, y) || inCircle(ring2x, ringY, ringR, x, y)) {
            pr = ACCENT[0]; pg = ACCENT[1]; pb = ACCENT[2];
          }
          
        } else {
          // Body area - white
          pr = CARD[0]; pg = CARD[1]; pb = CARD[2];
          
          const bodyTop = headerBottom + Math.round(height * 0.02);
          const cellH = (cardB - bodyTop - Math.round(height * 0.04)) / 3;
          const cellW = (cardR - cardL - Math.round(width * 0.08)) / 7;
          const gridLeft = cardL + Math.round(width * 0.04);
          
          // Draw calendar grid (3 rows x 7 cols of dots)
          for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 7; col++) {
              const dotCx = gridLeft + col * cellW + cellW / 2;
              const dotCy = bodyTop + row * cellH + cellH / 2;
              const dotR = Math.min(cellW, cellH) * 0.2;
              
              if (inCircle(dotCx, dotCy, dotR, x, y)) {
                // Highlight one dot as "current day"
                if (row === 1 && col === 3) {
                  pr = ACCENT[0]; pg = ACCENT[1]; pb = ACCENT[2];
                } else {
                  pr = GRID[0]; pg = GRID[1]; pb = GRID[2];
                }
              }
            }
          }
        }
      }
      
      const px = rowOffset + 1 + x * 3;
      rawData[px] = pr;
      rawData[px + 1] = pg;
      rawData[px + 2] = pb;
    }
  }
  
  const compressed = deflateSync(rawData);
  const idat = makeChunk('IDAT', compressed);
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

writeFileSync(join(publicDir, 'pwa-192x192.png'), createAgendaPNG(192));
writeFileSync(join(publicDir, 'pwa-512x512.png'), createAgendaPNG(512));

console.log('Agenda PWA icons created!');
