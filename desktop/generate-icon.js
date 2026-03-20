// Generates a 256x256 ICO icon for the desktop app
// Run: node generate-icon.js
const fs = require('fs');

function createIcoImage(width, height) {
  const bpp = 32;
  const pixelDataSize = width * height * 4;
  const rowBytes = Math.ceil(width / 32) * 4;
  const maskSize = rowBytes * height;
  const bmpHeaderSize = 40;

  const bmpHeader = Buffer.alloc(bmpHeaderSize);
  bmpHeader.writeUInt32LE(bmpHeaderSize, 0);
  bmpHeader.writeInt32LE(width, 4);
  bmpHeader.writeInt32LE(height * 2, 8);
  bmpHeader.writeUInt16LE(1, 12);
  bmpHeader.writeUInt16LE(bpp, 14);
  bmpHeader.writeUInt32LE(0, 16);
  bmpHeader.writeUInt32LE(pixelDataSize + maskSize, 20);

  const pixels = Buffer.alloc(pixelDataSize);
  const s = width;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = ((height - 1 - y) * width + x) * 4;
      const nx = x / s;
      const ny = y / s;

      // Rounded square background
      const margin = 0.06;
      const inBounds = nx >= margin && nx < 1 - margin && ny >= margin && ny < 1 - margin;

      const cornerR = 0.18;
      let inCorner = true;
      const checks = [
        [margin + cornerR, margin + cornerR],
        [1 - margin - cornerR, margin + cornerR],
        [margin + cornerR, 1 - margin - cornerR],
        [1 - margin - cornerR, 1 - margin - cornerR],
      ];
      for (const [cx, cy] of checks) {
        const nearX = (nx < margin + cornerR && cx < 0.5) || (nx > 1 - margin - cornerR && cx > 0.5);
        const nearY = (ny < margin + cornerR && cy < 0.5) || (ny > 1 - margin - cornerR && cy > 0.5);
        if (nearX && nearY) {
          if (Math.hypot(nx - cx, ny - cy) > cornerR) {
            inCorner = false;
          }
        }
      }

      if (inBounds && inCorner) {
        // Blue gradient background (slate to blue)
        const t = ny;
        let r = Math.round(15 + t * 20);
        let g = Math.round(23 + t * 40);
        let b = Math.round(42 + t * 80);

        // Draw grid/spreadsheet icon
        const lineW = 0.025;

        // Horizontal lines
        const hLines = [0.3, 0.45, 0.6, 0.75];
        for (const ly of hLines) {
          if (Math.abs(ny - ly) < lineW && nx > 0.2 && nx < 0.8) {
            r = 59; g = 130; b = 246; // blue #3b82f6
          }
        }

        // Vertical lines
        const vLines = [0.35, 0.5, 0.65];
        for (const lx of vLines) {
          if (Math.abs(nx - lx) < lineW && ny > 0.25 && ny < 0.8) {
            r = 59; g = 130; b = 246;
          }
        }

        // Dollar sign in center
        const cx = 0.5, cy = 0.52;
        const dx = nx - cx, dy = ny - cy;
        const dist = Math.hypot(dx, dy);
        if (dist < 0.12 && dist > 0.08) {
          // Partial circle for $
          const angle = Math.atan2(dy, dx);
          if ((angle > -2.5 && angle < -0.3) || (angle > 0.6 && angle < 2.8)) {
            r = 255; g = 255; b = 255;
          }
        }
        // Vertical bar of $
        if (Math.abs(nx - cx) < lineW && ny > cy - 0.14 && ny < cy + 0.14) {
          r = 255; g = 255; b = 255;
        }

        pixels[idx + 0] = b;
        pixels[idx + 1] = g;
        pixels[idx + 2] = r;
        pixels[idx + 3] = 255;
      } else {
        pixels[idx] = pixels[idx + 1] = pixels[idx + 2] = pixels[idx + 3] = 0;
      }
    }
  }

  const mask = Buffer.alloc(maskSize, 0);
  return { bmpHeader, pixels, mask, totalSize: bmpHeaderSize + pixelDataSize + maskSize };
}

function buildIco(sizes) {
  const images = sizes.map(s => createIcoImage(s, s));

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  const dirSize = 16 * images.length;
  let dataOffset = 6 + dirSize;
  const dirs = [];

  for (let i = 0; i < images.length; i++) {
    const s = sizes[i];
    const dir = Buffer.alloc(16);
    dir.writeUInt8(s >= 256 ? 0 : s, 0);
    dir.writeUInt8(s >= 256 ? 0 : s, 1);
    dir.writeUInt8(0, 2);
    dir.writeUInt8(0, 3);
    dir.writeUInt16LE(1, 4);
    dir.writeUInt16LE(32, 6);
    dir.writeUInt32LE(images[i].totalSize, 8);
    dir.writeUInt32LE(dataOffset, 12);
    dataOffset += images[i].totalSize;
    dirs.push(dir);
  }

  const imageBuffers = images.map(img => Buffer.concat([img.bmpHeader, img.pixels, img.mask]));
  return Buffer.concat([header, ...dirs, ...imageBuffers]);
}

const ico = buildIco([256, 48, 32, 16]);
fs.writeFileSync('icon.ico', ico);
console.log('Generated icon.ico (256x256, 48x48, 32x32, 16x16)');
