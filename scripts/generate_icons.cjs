const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Simple CRC32 implementation
function makeCRCTable() {
  let c;
  const table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c;
  }
  return table;
}

const crcTable = makeCRCTable();

function crc32(buf) {
  let crc = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xFF];
  }
  return (crc ^ (-1)) >>> 0;
}

function writePNG(width, height, getPixel) {
  // Each scanline begins with a filter byte (0 = None) followed by width * 4 bytes (RGBA)
  const lineLength = 1 + width * 4;
  const rawData = Buffer.alloc(lineLength * height);

  for (let y = 0; y < height; y++) {
    const lineOffset = y * lineLength;
    rawData[lineOffset] = 0; // Filter: None
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = getPixel(x, y, width, height);
      const pixelOffset = lineOffset + 1 + x * 4;
      rawData[pixelOffset] = r;
      rawData[pixelOffset + 1] = g;
      rawData[pixelOffset + 2] = b;
      rawData[pixelOffset + 3] = a;
    }
  }

  const compressedData = zlib.deflateSync(rawData);

  // PNG Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR Chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // Bit depth
  ihdrData[9] = 6; // Color type: RGBA
  ihdrData[10] = 0; // Compression
  ihdrData[11] = 0; // Filter
  ihdrData[12] = 0; // Interlace
  const ihdrChunk = createChunk('IHDR', ihdrData);

  // IDAT Chunk
  const idatChunk = createChunk('IDAT', compressedData);

  // IEND Chunk
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const len = data.length;
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crcVal = crc32(typeAndData);

  const chunk = Buffer.alloc(8 + len + 4);
  chunk.writeUInt32BE(len, 0);
  typeAndData.copy(chunk, 4);
  chunk.writeUInt32BE(crcVal, 4 + 4 + len);
  return chunk;
}

function drawTapeIcon(x, y, w, h, isMaskable = false) {
  // Normalize coordinates (-1 to 1)
  const cx = (x / w) * 2 - 1;
  const cy = (y / h) * 2 - 1;
  const scale = isMaskable ? 0.65 : 0.85;
  const nx = cx / scale;
  const ny = cy / scale;

  // Background kraft color
  const bg = [216, 194, 157, 255]; // #d8c29d

  // Tape roll geometry:
  // Center is slightly left/up (-0.1, -0.05)
  const ox = -0.1;
  const oy = -0.05;
  const dist = Math.sqrt((nx - ox) ** 2 + (ny - oy) ** 2);

  // Outer tape radius = 0.58, Inner core radius = 0.28, Hole = 0.20
  const rOuter = 0.58;
  const rCore = 0.28;
  const rHole = 0.18;

  // Peeling tape strip: from bottom of roll stretching right
  // Strip runs from y in [0.28, 0.52] and x in [-0.1, 0.78]
  const inStrip = ny >= 0.28 && ny <= 0.52 && nx >= -0.1 && nx <= 0.78;
  // Torn edge at the end of strip
  const tornPattern = 0.74 + 0.04 * Math.sin(ny * 40);
  const inTornStrip = inStrip && nx <= tornPattern;

  // Cream tape color: [251, 247, 238]
  // Tape roll layers:
  if (inTornStrip) {
    // Subtle shadow beneath strip or texture
    if (ny > 0.50) return [235, 225, 205, 255];
    return [252, 248, 239, 255];
  }

  if (dist <= rHole) {
    // Center hole: shows kraft background
    return bg;
  } else if (dist <= rCore) {
    // Cardboard core: darker warm kraft cardboard
    const coreGrad = Math.sin((dist - rHole) / (rCore - rHole) * Math.PI);
    return [180 - coreGrad * 15, 150 - coreGrad * 10, 115 - coreGrad * 10, 255];
  } else if (dist <= rOuter) {
    // Tape roll body: cream with subtle rings
    const ring = Math.sin(dist * 75) * 5;
    const base = [251 + ring, 247 + ring, 238 + ring];
    // Edge shading
    if (dist > rOuter - 0.02) {
      return [230, 220, 200, 255];
    }
    return [Math.min(255, Math.max(0, base[0])), Math.min(255, Math.max(0, base[1])), Math.min(255, Math.max(0, base[2])), 255];
  } else if (dist <= rOuter + 0.04) {
    // Soft shadow around roll
    const alpha = (1 - (dist - rOuter) / 0.04) * 0.35;
    return [
      Math.round(bg[0] * (1 - alpha) + 80 * alpha),
      Math.round(bg[1] * (1 - alpha) + 60 * alpha),
      Math.round(bg[2] * (1 - alpha) + 40 * alpha),
      255
    ];
  }

  return bg;
}

const outDir = path.join(__dirname, '..', 'public');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// Generate apple-touch-icon.png: 180x180
fs.writeFileSync(path.join(outDir, 'apple-touch-icon.png'), writePNG(180, 180, (x, y, w, h) => drawTapeIcon(x, y, w, h, false)));
console.log('Created apple-touch-icon.png (180x180)');

// Generate icon-192.png: 192x192
fs.writeFileSync(path.join(outDir, 'icon-192.png'), writePNG(192, 192, (x, y, w, h) => drawTapeIcon(x, y, w, h, false)));
console.log('Created icon-192.png (192x192)');

// Generate icon-512.png: 512x512
fs.writeFileSync(path.join(outDir, 'icon-512.png'), writePNG(512, 512, (x, y, w, h) => drawTapeIcon(x, y, w, h, false)));
console.log('Created icon-512.png (512x512)');

// Generate icon-maskable.png: 512x512 with safe margin
fs.writeFileSync(path.join(outDir, 'icon-maskable.png'), writePNG(512, 512, (x, y, w, h) => drawTapeIcon(x, y, w, h, true)));
console.log('Created icon-maskable.png (512x512)');

// Generate favicon.ico (can be 32x32 PNG inside or 32x32 standard)
fs.writeFileSync(path.join(outDir, 'favicon.ico'), writePNG(32, 32, (x, y, w, h) => drawTapeIcon(x, y, w, h, false)));
console.log('Created favicon.ico');
